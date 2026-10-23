-- Extend the existing completed-mentorship feedback record; do not create parallel reviews.
-- Historical feedback remains valid with a NULL star rating.
alter table public.mentorship_completion_feedback
  add column if not exists mentor_rating smallint;

alter table public.mentorship_completion_feedback
  drop constraint if exists mentorship_completion_feedback_mentor_rating_range;

alter table public.mentorship_completion_feedback
  add constraint mentorship_completion_feedback_mentor_rating_range
  check (mentor_rating is null or mentor_rating between 1 and 5);

-- Existing 2-argument RPC stays intact for in-flight/legacy clients.
-- The new version requires a mentee rating and forbids mentors rating themselves.
-- Both use the same unique feedback row, lifecycle checks, audit and notification.
create or replace function public.submit_mentorship_completion_feedback(
  target_mentorship_id uuid,
  feedback_text text,
  mentor_rating integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  feedback_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found or target_mentorship.status <> 'completed' then
    raise exception 'Mentorship must be completed before feedback can be submitted';
  end if;

  if auth.uid() = target_mentorship.mentee_id then
    if mentor_rating is null or mentor_rating not between 1 and 5 then
      raise exception 'Select a mentor rating from 1 to 5 stars';
    end if;
  elsif auth.uid() = target_mentorship.mentor_id then
    if mentor_rating is not null then
      raise exception 'Only the mentee can rate the mentor';
    end if;
  else
    raise exception 'Only mentorship participants may submit completion feedback';
  end if;

  -- Existing routine enforces one submission, content length, completed
  -- cycle, audit history and notifications. Transaction is atomic.
  select public.submit_mentorship_completion_feedback(
    target_mentorship_id, feedback_text
  ) into feedback_id;

  if auth.uid() = target_mentorship.mentee_id then
    update public.mentorship_completion_feedback
    set mentor_rating = mentor_rating::smallint
    where id = feedback_id
      and author_id = auth.uid();
  end if;

  return feedback_id;
end;
$function$;

revoke all on function public.submit_mentorship_completion_feedback(uuid,text,integer)
  from public, anon;
grant execute on function public.submit_mentorship_completion_feedback(uuid,text,integer)
  to authenticated;

-- Only expose rounded aggregates, never private comments or reviewer identities.
-- Match the existing profiles visibility policy, with an upper bound on batch size.
create or replace function public.get_mentor_rating_summaries(
  target_mentor_ids uuid[]
)
returns table (
  mentor_id uuid,
  average_rating numeric,
  review_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if cardinality(coalesce(target_mentor_ids, array[]::uuid[])) > 100 then
    raise exception 'A maximum of 100 mentors may be requested at once';
  end if;

  return query
  select p.id as mentor_id,
         round(avg(f.mentor_rating)::numeric, 1) as average_rating,
         count(f.id)::bigint as review_count
  from (select distinct unnest(target_mentor_ids) as id) ids
  join public.profiles p on p.id = ids.id
  left join public.mentorships m
    on m.mentor_id = p.id and m.status = 'completed'
  left join public.mentorship_completion_feedback f
    on f.mentorship_id = m.id
    and f.author_id = m.mentee_id
    and f.author_role = 'mentee'
    and f.mentor_rating is not null
  where p.mentor_available = true
    and p.is_active = true
    and p.deleted_at is null
    and (
      p.id = auth.uid()
      or p.profile_visibility = 'public'
      or (
        p.profile_visibility = 'connections'
        and public.are_accepted_connections(auth.uid(), p.id)
      )
    )
  group by p.id;
end;
$function$;

revoke all on function public.get_mentor_rating_summaries(uuid[])
  from public, anon;
grant execute on function public.get_mentor_rating_summaries(uuid[])
  to authenticated;
