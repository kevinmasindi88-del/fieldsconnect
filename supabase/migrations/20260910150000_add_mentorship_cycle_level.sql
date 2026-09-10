-- Add mentorship-cycle level selection independently of a user's global profile role.

begin;

-- ---------------------------------------------------------------------------
-- Store the requested/agreed mentorship level
-- ---------------------------------------------------------------------------

alter table public.mentorship_requests
  add column if not exists requested_mentorship_level text;

alter table public.mentorships
  add column if not exists mentorship_level text;


-- Backfill existing requests from the mentee's current profile level.
update public.mentorship_requests request
set requested_mentorship_level = profile.role_type
from public.profiles profile
where profile.id = request.mentee_id
  and request.requested_mentorship_level is null;


-- Backfill existing mentorships from their originating request first.
update public.mentorships mentorship
set mentorship_level = request.requested_mentorship_level
from public.mentorship_requests request
where request.id = mentorship.request_id
  and mentorship.mentorship_level is null;


-- Defensive fallback for any historical mentorship without a usable request value.
update public.mentorships mentorship
set mentorship_level = profile.role_type
from public.profiles profile
where profile.id = mentorship.mentee_id
  and mentorship.mentorship_level is null;


alter table public.mentorship_requests
  alter column requested_mentorship_level set not null;

alter table public.mentorships
  alter column mentorship_level set not null;


-- ---------------------------------------------------------------------------
-- New request RPC with explicit mentorship-cycle level
-- ---------------------------------------------------------------------------

create or replace function public.create_mentorship_request(
  target_mentor_id uuid,
  requested_mentorship_field text,
  requested_objective text,
  requested_motivation text,
  requested_period text,
  requested_contact_frequency text,
  requested_mentorship_level text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  created_request_id uuid;
  mentor_settings public.mentor_profiles%rowtype;
  mentor_is_available boolean;
  normalized_mentorship_level text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_mentor_id = auth.uid() then
    raise exception 'You cannot request mentorship from yourself';
  end if;

  normalized_mentorship_level :=
    nullif(trim(requested_mentorship_level), '');

  if normalized_mentorship_level is null then
    raise exception 'Select a mentorship level offered by this mentor';
  end if;

  select profile.mentor_available
  into mentor_is_available
  from public.profiles profile
  where profile.id = target_mentor_id
    and profile.deleted_at is null
    and profile.is_active = true;

  if coalesce(mentor_is_available, false) = false then
    raise exception
      'This user is not currently available as a mentor';
  end if;

  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = target_mentor_id
    and is_accepting_requests = true;

  if not found then
    raise exception
      'This mentor is not currently accepting requests';
  end if;

  if not (
    normalized_mentorship_level =
      any(mentor_settings.mentoring_levels)
  ) then
    raise exception
      'This mentor does not offer mentorship at the selected level';
  end if;

  if not (
    case requested_period
      when '3_months'
        then mentor_settings.accepts_3_month
      when '6_months'
        then mentor_settings.accepts_6_month
      when '1_year'
        then mentor_settings.accepts_1_year
      when 'ongoing'
        then mentor_settings.accepts_ongoing
      else false
    end
  ) then
    raise exception
      'The mentor is not accepting this mentorship period';
  end if;

  if exists (
    select 1
    from public.mentorships mentorship
    where mentorship.mentor_id = target_mentor_id
      and mentorship.mentee_id = auth.uid()
      and mentorship.status in (
        'active',
        'ending',
        'extension_pending',
        'paused',
        'completion_requested'
      )
  ) then
    raise exception
      'An active mentorship already exists with this mentor';
  end if;

  insert into public.mentorship_requests (
    mentee_id,
    mentor_id,
    mentorship_field,
    objective,
    motivation,
    requested_duration,
    requested_frequency,
    requested_mentorship_level
  )
  values (
    auth.uid(),
    target_mentor_id,
    trim(requested_mentorship_field),
    trim(requested_objective),
    trim(requested_motivation),
    requested_period,
    requested_contact_frequency,
    normalized_mentorship_level
  )
  returning id into created_request_id;

  insert into public.mentorship_audit_events (
    request_id,
    actor_id,
    event_type,
    new_status,
    notes,
    metadata
  )
  values (
    created_request_id,
    auth.uid(),
    'request_created',
    'pending',
    'The mentee submitted a mentorship request.',
    jsonb_build_object(
      'requested_duration',
        requested_period,
      'requested_frequency',
        requested_contact_frequency,
      'mentorship_field',
        trim(requested_mentorship_field),
      'requested_mentorship_level',
        normalized_mentorship_level
    )
  );

  return created_request_id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Keep the original six-argument RPC working during rollout.
-- Existing clients use the requester's profile level as their default.
-- ---------------------------------------------------------------------------

create or replace function public.create_mentorship_request(
  target_mentor_id uuid,
  requested_mentorship_field text,
  requested_objective text,
  requested_motivation text,
  requested_period text,
  requested_contact_frequency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  requester_level text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select profile.role_type
  into requester_level
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.deleted_at is null
    and profile.is_active = true;

  if requester_level is null then
    raise exception 'Your profile level is unavailable';
  end if;

  return public.create_mentorship_request(
    target_mentor_id,
    requested_mentorship_field,
    requested_objective,
    requested_motivation,
    requested_period,
    requested_contact_frequency,
    requester_level
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- Accept/counter/decline request while preserving mentorship level
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_mentorship_request(
  target_request_id uuid,
  response_action text,
  counterproposal_duration text default null,
  counterproposal_frequency text default null,
  response_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_request public.mentorship_requests%rowtype;
  created_mentorship_id uuid;
  final_duration text;
  final_frequency text;
  calculated_end_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_request
  from public.mentorship_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Mentorship request not found';
  end if;

  if target_request.status not in (
    'pending',
    'change_proposed'
  ) then
    raise exception
      'This mentorship request cannot be changed';
  end if;

  if target_request.status = 'pending'
    and target_request.mentor_id <> auth.uid() then
    raise exception
      'Only the requested mentor may respond to a new request';
  end if;

  if target_request.status = 'change_proposed'
    and target_request.mentee_id <> auth.uid() then
    raise exception
      'Only the mentee may accept or decline the proposed terms';
  end if;

  if target_request.expires_at <= now() then
    update public.mentorship_requests
    set
      status = 'expired',
      responded_at = now()
    where id = target_request.id;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes,
      metadata
    )
    values (
      target_request.id,
      auth.uid(),
      'request_expired',
      target_request.status,
      'expired',
      'The mentorship request expired before a response was completed.',
      jsonb_build_object(
        'expires_at',
          target_request.expires_at
      )
    );

    return null;
  end if;

  if response_action = 'decline' then
    update public.mentorship_requests
    set
      status = 'declined',
      responded_at = now(),
      proposal_message =
        nullif(trim(response_message), '')
    where id = target_request.id;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes
    )
    values (
      target_request.id,
      auth.uid(),
      'request_declined',
      target_request.status,
      'declined',
      nullif(trim(response_message), '')
    );

    return null;
  end if;

  if response_action = 'counterpropose' then
    if target_request.status <> 'pending'
      or target_request.mentor_id <> auth.uid() then
      raise exception
        'Only the mentor may propose changes to a new request';
    end if;

    if counterproposal_duration is null
      or counterproposal_frequency is null then
      raise exception
        'A counterproposal requires a duration and frequency';
    end if;

    update public.mentorship_requests
    set
      status = 'change_proposed',
      proposed_duration =
        counterproposal_duration,
      proposed_frequency =
        counterproposal_frequency,
      proposal_message =
        nullif(trim(response_message), ''),
      responded_at = now()
    where id = target_request.id;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes,
      metadata
    )
    values (
      target_request.id,
      auth.uid(),
      'change_proposed',
      target_request.status,
      'change_proposed',
      nullif(trim(response_message), ''),
      jsonb_build_object(
        'proposed_duration',
          counterproposal_duration,
        'proposed_frequency',
          counterproposal_frequency
      )
    );

    return null;
  end if;

  if response_action <> 'accept' then
    raise exception 'Invalid mentorship response';
  end if;

  final_duration :=
    coalesce(
      target_request.proposed_duration,
      target_request.requested_duration
    );

  final_frequency :=
    coalesce(
      target_request.proposed_frequency,
      target_request.requested_frequency
    );

  calculated_end_date :=
    case final_duration
      when '3_months'
        then (current_date + interval '3 months')::date
      when '6_months'
        then (current_date + interval '6 months')::date
      when '1_year'
        then (current_date + interval '1 year')::date
      when 'ongoing'
        then null
      else null
    end;

  update public.mentorship_requests
  set
    status = 'accepted',
    responded_at = now()
  where id = target_request.id;

  insert into public.mentorships (
    request_id,
    mentor_id,
    mentee_id,
    mentorship_field,
    mentorship_level,
    agreed_duration,
    agreed_frequency,
    objective,
    start_date,
    expected_end_date
  )
  values (
    target_request.id,
    target_request.mentor_id,
    target_request.mentee_id,
    target_request.mentorship_field,
    target_request.requested_mentorship_level,
    final_duration,
    final_frequency,
    target_request.objective,
    current_date,
    calculated_end_date
  )
  returning id into created_mentorship_id;

  insert into public.mentorship_audit_events (
    request_id,
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes,
    metadata
  )
  values (
    target_request.id,
    created_mentorship_id,
    auth.uid(),
    'request_accepted',
    target_request.status,
    'active',
    'The mentorship terms were accepted.',
    jsonb_build_object(
      'agreed_duration',
        final_duration,
      'agreed_frequency',
        final_frequency,
      'mentorship_level',
        target_request.requested_mentorship_level,
      'start_date',
        current_date,
      'expected_end_date',
        calculated_end_date
    )
  );

  return created_mentorship_id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Enforce mentor capacity and the selected mentorship-cycle level
-- ---------------------------------------------------------------------------

create or replace function
public.enforce_mentorship_capacity_and_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentor_settings public.mentor_profiles%rowtype;
  active_mentorship_count integer;
begin
  if new.status not in (
    'active',
    'ending',
    'extension_pending',
    'paused',
    'completion_requested'
  ) then
    return new;
  end if;

  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = new.mentor_id
  for update;

  if not found then
    raise exception
      'This mentor has not configured mentorship settings';
  end if;

  if new.mentorship_level is null
    or not (
      new.mentorship_level =
        any(mentor_settings.mentoring_levels)
    ) then
    raise exception
      'This mentor is not accepting mentorship at the selected level';
  end if;

  select count(*)::integer
  into active_mentorship_count
  from public.mentorships mentorship
  where mentorship.mentor_id = new.mentor_id
    and mentorship.status in (
      'active',
      'ending',
      'extension_pending',
      'paused',
      'completion_requested'
    )
    and mentorship.id <> new.id;

  if active_mentorship_count >=
    mentor_settings.maximum_active_mentees then
    raise exception
      'This mentor has reached their maximum active mentee capacity';
  end if;

  return new;
end;
$function$;


drop trigger if exists
mentorships_enforce_capacity_and_level
on public.mentorships;

create trigger
mentorships_enforce_capacity_and_level
before insert or update of
  mentor_id,
  mentee_id,
  mentorship_level,
  status
on public.mentorships
for each row
execute function
public.enforce_mentorship_capacity_and_level();


-- Permissions for the new overload.
revoke all
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

commit;
