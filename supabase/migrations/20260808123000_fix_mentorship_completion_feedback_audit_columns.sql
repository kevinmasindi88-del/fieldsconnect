create or replace function
public.submit_mentorship_completion_feedback(
  target_mentorship_id uuid,
  feedback_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  feedback_id uuid;
  next_author_role text;
  cleaned_feedback text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  cleaned_feedback := trim(feedback_text);

  if char_length(cleaned_feedback) < 10 then
    raise exception
      'Feedback must be at least 10 characters';
  end if;

  if char_length(cleaned_feedback) > 2000 then
    raise exception
      'Feedback may not exceed 2000 characters';
  end if;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if target_mentorship.status <> 'completed' then
    raise exception
      'Completion feedback is only available after the mentorship is completed';
  end if;

  if auth.uid() = target_mentorship.mentor_id then
    next_author_role := 'mentor';
  elsif auth.uid() = target_mentorship.mentee_id then
    next_author_role := 'mentee';
  else
    raise exception
      'Only mentorship participants may submit completion feedback';
  end if;

  if exists (
    select 1
    from public.mentorship_completion_feedback
    where mentorship_id = target_mentorship_id
      and author_id = auth.uid()
  ) then
    raise exception
      'Completion feedback has already been submitted';
  end if;

  insert into public.mentorship_completion_feedback (
    mentorship_id,
    author_id,
    author_role,
    feedback
  )
  values (
    target_mentorship_id,
    auth.uid(),
    next_author_role,
    cleaned_feedback
  )
  returning id
  into feedback_id;

  insert into public.mentorship_audit_events (
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes
  )
  values (
    target_mentorship_id,
    auth.uid(),
    'completion_feedback_submitted',
    'completed',
    'completed',
    null
  );

  return feedback_id;
end;
$function$;

revoke all
on function
public.submit_mentorship_completion_feedback(
  uuid,
  text
)
from public, anon;

grant execute
on function
public.submit_mentorship_completion_feedback(
  uuid,
  text
)
to authenticated;