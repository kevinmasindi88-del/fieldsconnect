-- Restrict mentorship pause and resume governance to the mentor.

begin;


create or replace function
public.pause_mentorship(
  target_mentorship_id uuid,
  pause_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
begin
  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> target_mentorship.mentor_id then
    raise exception
      'Only the mentor may pause the mentorship';
  end if;

  if target_mentorship.status not in (
    'active',
    'ending'
  ) then
    raise exception
      'Only an active or ending mentorship may be paused';
  end if;

  if pause_note is null
    or char_length(trim(pause_note)) < 5 then
    raise exception
      'A pause reason of at least 5 characters is required';
  end if;

  update public.mentorships
  set
    status = 'paused',
    paused_at = now(),
    paused_by = auth.uid(),
    pause_reason = trim(pause_note),
    resumed_at = null
  where id = target_mentorship.id;

  insert into public.mentorship_audit_events (
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes
  )
  values (
    target_mentorship.id,
    auth.uid(),
    'mentorship_paused',
    target_mentorship.status,
    'paused',
    trim(pause_note)
  );

  return target_mentorship.id;
end;
$function$;


create or replace function
public.resume_mentorship(
  target_mentorship_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  restored_status text;
begin
  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> target_mentorship.mentor_id then
    raise exception
      'Only the mentor may resume the mentorship';
  end if;

  if target_mentorship.status <> 'paused' then
    raise exception
      'Only a paused mentorship may be resumed';
  end if;

  restored_status :=
    case
      when target_mentorship.expected_end_date
        is not null
        and target_mentorship.expected_end_date
          <= current_date + 30
        then 'ending'
      else 'active'
    end;

  update public.mentorships
  set
    status = restored_status,
    resumed_at = now(),
    paused_at = null,
    paused_by = null,
    pause_reason = null
  where id = target_mentorship.id;

  insert into public.mentorship_audit_events (
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes
  )
  values (
    target_mentorship.id,
    auth.uid(),
    'mentorship_resumed',
    target_mentorship.status,
    restored_status,
    'The mentorship was resumed by the mentor.'
  );

  return target_mentorship.id;
end;
$function$;


revoke all
on function public.pause_mentorship(
  uuid,
  text
)
from public, anon;

grant execute
on function public.pause_mentorship(
  uuid,
  text
)
to authenticated;


revoke all
on function public.resume_mentorship(uuid)
from public, anon;

grant execute
on function public.resume_mentorship(uuid)
to authenticated;


commit;