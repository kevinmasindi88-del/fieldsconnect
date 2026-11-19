-- Explicit opt-in to identifying the mentee and field-based cycle title.
-- The previous anonymous public-comment consent does not imply consent to identity.
alter table public.mentorship_completion_feedback
  add column if not exists is_public_named_review boolean not null default false;

create or replace function public.get_mentor_reviews_page(
  target_mentor_id uuid,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  rating integer,
  cycle_title text,
  mentee_name text,
  public_comment text,
  is_identified boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if result_limit is null or result_limit not between 1 and 50
     or result_offset is null or result_offset not between 0 and 1000 then
    raise exception 'Invalid review page';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_mentor_id
      and p.mentor_available = true and p.is_active = true and p.deleted_at is null
      and (
        p.id = auth.uid() or p.profile_visibility = 'public'
        or (p.profile_visibility = 'connections'
            and public.are_accepted_connections(auth.uid(), p.id))
      )
  ) then
    return;
  end if;

  return query
  select
    f.mentor_rating::integer,
    case when f.is_public_review and f.is_public_named_review
        and mentee.is_active = true and mentee.deleted_at is null
        and nullif(btrim(mentee.display_name), '') is not null
      then coalesce(nullif(btrim(m.mentorship_field), ''), 'General') || ' mentorship'
      else 'Mentorship cycle' end as cycle_title,
    case when f.is_public_review and f.is_public_named_review
        and mentee.is_active = true and mentee.deleted_at is null
        and nullif(btrim(mentee.display_name), '') is not null
      then mentee.display_name
      else 'Verified mentee' end as mentee_name,
    case when f.is_public_review then f.feedback else null end as public_comment,
    (f.is_public_review and f.is_public_named_review
      and mentee.is_active = true and mentee.deleted_at is null
      and nullif(btrim(mentee.display_name), '') is not null) as is_identified
  from public.mentorships m
  join public.mentorship_completion_feedback f
    on f.mentorship_id = m.id and f.author_id = m.mentee_id
    and f.author_role = 'mentee' and f.mentor_rating between 1 and 5
  left join public.profiles mentee on mentee.id = m.mentee_id
  where m.mentor_id = target_mentor_id and m.status = 'completed'
  order by f.submitted_at desc, f.id desc
  limit result_limit offset result_offset;
end;
$function$;

revoke all on function public.get_mentor_reviews_page(uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function public.get_mentor_reviews_page(uuid,integer,integer)
  to authenticated;

-- This new endpoint is intentionally separate from legacy anonymous-publication consent.
create or replace function public.set_mentorship_named_review_publication(
  target_mentorship_id uuid,
  publish_review boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if publish_review is null then
    raise exception 'Choose whether to publish your named review';
  end if;
  update public.mentorship_completion_feedback f
  set is_public_review = publish_review,
      is_public_named_review = publish_review
  from public.mentorships m
  where f.mentorship_id = target_mentorship_id
    and m.id = f.mentorship_id and m.status = 'completed'
    and m.mentee_id = auth.uid()
    and f.author_id = auth.uid() and f.author_role = 'mentee'
    and f.mentor_rating between 1 and 5
  returning f.id into changed_id;
  if changed_id is null then
    raise exception 'Only the mentee may publish or hide their review for a completed mentorship';
  end if;
end;
$function$;

revoke all on function public.set_mentorship_named_review_publication(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.set_mentorship_named_review_publication(uuid,boolean)
  to authenticated;
