-- Allow a mentee with historical completion feedback to attach one star rating.
-- This never creates a second review, changes written feedback, or permits edits to rated feedback.
create or replace function public.rate_existing_mentorship_completion_feedback(
  target_mentorship_id uuid,
  rating_value integer
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  updated_feedback_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if rating_value is null or rating_value not between 1 and 5 then
    raise exception 'Select a rating from 1 to 5 stars';
  end if;

  select * into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found or target_mentorship.status <> 'completed' then
    raise exception 'Only completed mentorships can be rated';
  end if;

  if auth.uid() <> target_mentorship.mentee_id then
    raise exception 'Only the mentee may rate the mentor';
  end if;

  update public.mentorship_completion_feedback
  set mentor_rating = rating_value::smallint
  where mentorship_id = target_mentorship_id
    and author_id = auth.uid()
    and author_role = 'mentee'
    and mentor_rating is null
  returning id into updated_feedback_id;

  if updated_feedback_id is null then
    raise exception 'No eligible unrated feedback found or rating already submitted';
  end if;

  insert into public.mentorship_audit_events (
    mentorship_id, actor_id, event_type, previous_status, new_status, notes
  ) values (
    target_mentorship_id, auth.uid(), 'mentor_rating_added', 'completed', 'completed',
    'Star rating added to existing completion feedback'
  );
end;
$function$;

revoke all on function public.rate_existing_mentorship_completion_feedback(uuid,integer)
  from public, anon;
grant execute on function public.rate_existing_mentorship_completion_feedback(uuid,integer)
  to authenticated;
