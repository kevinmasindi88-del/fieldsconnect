-- Add controlled pause, completion and early-ending workflows.

begin;


-- ---------------------------------------------------------------------------
-- Lifecycle metadata
-- ---------------------------------------------------------------------------

alter table public.mentorships
  add column if not exists paused_by uuid
    references public.profiles(id)
    on delete set null,

  add column if not exists pause_reason text,

  add column if not exists resumed_at timestamptz,

  add column if not exists completion_requested_by uuid
    references public.profiles(id)
    on delete set null,

  add column if not exists completion_requested_at timestamptz,

  add column if not exists completion_request_note text,

  add column if not exists completion_responded_by uuid
    references public.profiles(id)
    on delete set null,

  add column if not exists completion_responded_at timestamptz,

  add column if not exists completion_response_note text,

  add column if not exists ended_early_by uuid
    references public.profiles(id)
    on delete set null;


alter table public.mentorships
  drop constraint if exists
    mentorships_pause_reason_length_check;

alter table public.mentorships
  add constraint
    mentorships_pause_reason_length_check
  check (
    pause_reason is null
    or char_length(trim(pause_reason))
      between 5 and 1000
  );


alter table public.mentorships
  drop constraint if exists
    mentorships_completion_request_note_length_check;

alter table public.mentorships
  add constraint
    mentorships_completion_request_note_length_check
  check (
    completion_request_note is null
    or char_length(trim(completion_request_note))
      between 5 and 2000
  );


alter table public.mentorships
  drop constraint if exists
    mentorships_completion_response_note_length_check;

alter table public.mentorships
  add constraint
    mentorships_completion_response_note_length_check
  check (
    completion_response_note is null
    or char_length(trim(completion_response_note))
      between 2 and 2000
  );


alter table public.mentorships
  drop constraint if exists
    mentorships_end_reason_length_check;

alter table public.mentorships
  add constraint
    mentorships_end_reason_length_check
  check (
    end_reason is null
    or char_length(trim(end_reason))
      between 10 and 2000
  );


-- ---------------------------------------------------------------------------
-- Shared participant validation
-- ---------------------------------------------------------------------------

create or replace function
public.assert_mentorship_participant(
  target_mentorship public.mentorships
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() not in (
    target_mentorship.mentor_id,
    target_mentorship.mentee_id
  ) then
    raise exception
      'Only mentorship participants may perform this action';
  end if;
end;
$function$;


revoke all
on function
public.assert_mentorship_participant(
  public.mentorships
)
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Pause mentorship
-- ---------------------------------------------------------------------------

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

  perform public.assert_mentorship_participant(
    target_mentorship
  );

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


-- ---------------------------------------------------------------------------
-- Resume mentorship
-- ---------------------------------------------------------------------------

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

  perform public.assert_mentorship_participant(
    target_mentorship
  );

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
    'The mentorship was resumed.'
  );

  return target_mentorship.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Request mutual completion
-- ---------------------------------------------------------------------------

create or replace function
public.request_mentorship_completion(
  target_mentorship_id uuid,
  request_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  unfinished_milestone_count integer;
  unfinished_action_count integer;
begin
  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  perform public.assert_mentorship_participant(
    target_mentorship
  );

  if target_mentorship.status not in (
    'active',
    'ending'
  ) then
    raise exception
      'Completion may only be requested for an active or ending mentorship';
  end if;

  if request_note is null
    or char_length(trim(request_note)) < 5 then
    raise exception
      'A completion note of at least 5 characters is required';
  end if;

  select count(*)
  into unfinished_milestone_count
  from public.mentorship_milestones milestone
  where milestone.mentorship_id =
      target_mentorship.id
    and milestone.status not in (
      'completed',
      'cancelled'
    );

  select count(*)
  into unfinished_action_count
  from public.mentorship_action_items action_item
  where action_item.mentorship_id =
      target_mentorship.id
    and action_item.status not in (
      'completed',
      'cancelled'
    );

  if unfinished_milestone_count > 0
    or unfinished_action_count > 0 then
    raise exception
      'Complete or cancel all milestones and action items before requesting mentorship completion';
  end if;

  update public.mentorships
  set
    status = 'completion_requested',
    completion_requested_by = auth.uid(),
    completion_requested_at = now(),
    completion_request_note =
      trim(request_note),
    completion_responded_by = null,
    completion_responded_at = null,
    completion_response_note = null
  where id = target_mentorship.id;

  insert into public.mentorship_audit_events (
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes,
    metadata
  )
  values (
    target_mentorship.id,
    auth.uid(),
    'completion_requested',
    target_mentorship.status,
    'completion_requested',
    trim(request_note),
    jsonb_build_object(
      'unfinished_milestones',
        unfinished_milestone_count,
      'unfinished_action_items',
        unfinished_action_count
    )
  );

  return target_mentorship.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Approve or decline completion
-- ---------------------------------------------------------------------------

create or replace function
public.respond_to_mentorship_completion(
  target_mentorship_id uuid,
  response_action text,
  response_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  responder_status text;
begin
  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  perform public.assert_mentorship_participant(
    target_mentorship
  );

  if target_mentorship.status
    <> 'completion_requested' then
    raise exception
      'This mentorship has no pending completion request';
  end if;

  if target_mentorship.completion_requested_by
    = auth.uid() then
    raise exception
      'The participant who requested completion cannot respond to their own request';
  end if;

  if response_action not in (
    'approve',
    'decline'
  ) then
    raise exception
      'Completion response must be approve or decline';
  end if;

  if response_action = 'decline'
    and (
      response_note is null
      or char_length(trim(response_note)) < 2
    ) then
    raise exception
      'A reason is required when declining completion';
  end if;

  responder_status :=
    case
      when target_mentorship.expected_end_date
        is not null
        and target_mentorship.expected_end_date
          <= current_date + 30
        then 'ending'
      else 'active'
    end;

  if response_action = 'approve' then
    update public.mentorships
    set
      status = 'completed',
      completed_at = now(),
      completion_responded_by = auth.uid(),
      completion_responded_at = now(),
      completion_response_note =
        nullif(trim(response_note), '')
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
      'completion_approved',
      target_mentorship.status,
      'completed',
      nullif(trim(response_note), '')
    );
  else
    update public.mentorships
    set
      status = responder_status,
      completion_responded_by = auth.uid(),
      completion_responded_at = now(),
      completion_response_note =
        trim(response_note)
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
      'completion_declined',
      target_mentorship.status,
      responder_status,
      trim(response_note)
    );
  end if;

  return target_mentorship.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- End mentorship early
-- ---------------------------------------------------------------------------

create or replace function
public.end_mentorship_early(
  target_mentorship_id uuid,
  ending_reason text
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

  perform public.assert_mentorship_participant(
    target_mentorship
  );

  if target_mentorship.status not in (
    'active',
    'ending',
    'paused',
    'completion_requested'
  ) then
    raise exception
      'This mentorship can no longer be ended early';
  end if;

  if ending_reason is null
    or char_length(trim(ending_reason)) < 10 then
    raise exception
      'An early-ending reason of at least 10 characters is required';
  end if;

  update public.mentorships
  set
    status = 'ended_early',
    ended_early_at = now(),
    ended_early_by = auth.uid(),
    end_reason = trim(ending_reason)
  where id = target_mentorship.id;

  update public.mentorship_extension_requests
  set
    status = 'cancelled',
    cancelled_at = now()
  where mentorship_id = target_mentorship.id
    and status = 'pending';

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
    'mentorship_ended_early',
    target_mentorship.status,
    'ended_early',
    trim(ending_reason)
  );

  return target_mentorship.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

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


revoke all
on function public.request_mentorship_completion(
  uuid,
  text
)
from public, anon;

grant execute
on function public.request_mentorship_completion(
  uuid,
  text
)
to authenticated;


revoke all
on function public.respond_to_mentorship_completion(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.respond_to_mentorship_completion(
  uuid,
  text,
  text
)
to authenticated;


revoke all
on function public.end_mentorship_early(
  uuid,
  text
)
from public, anon;

grant execute
on function public.end_mentorship_early(
  uuid,
  text
)
to authenticated;


commit;