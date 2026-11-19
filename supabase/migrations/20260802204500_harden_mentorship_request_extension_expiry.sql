begin;


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
      'start_date',
        current_date,
      'expected_end_date',
        calculated_end_date
    )
  );

  return created_mentorship_id;
end;
$function$;


create or replace function public.request_mentorship_extension(
  target_mentorship_id uuid,
  requested_extension_duration text,
  extension_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  stale_extension public.mentorship_extension_requests%rowtype;
  created_extension_id uuid;
  calculated_end_date date;
  restored_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if auth.uid() not in (
    target_mentorship.mentor_id,
    target_mentorship.mentee_id
  ) then
    raise exception
      'Only mentorship participants may request an extension';
  end if;

  select *
  into stale_extension
  from public.mentorship_extension_requests
  where mentorship_id = target_mentorship.id
    and status = 'pending'
  order by requested_at desc
  limit 1
  for update;

  if found then
    if stale_extension.expires_at > now() then
      raise exception
        'An extension request is already pending for this mentorship';
    end if;

    restored_status :=
      case
        when target_mentorship.expected_end_date is not null
          and target_mentorship.expected_end_date
            <= current_date + 30
          then 'ending'
        else 'active'
      end;

    update public.mentorship_extension_requests
    set status = 'expired'
    where id = stale_extension.id;

    update public.mentorships
    set status = restored_status
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
      'extension_expired',
      'extension_pending',
      restored_status,
      'A previous extension request expired before a response was completed.',
      jsonb_build_object(
        'extension_request_id',
          stale_extension.id,
        'expires_at',
          stale_extension.expires_at
      )
    );

    return null;
  end if;

  if target_mentorship.status not in (
    'active',
    'ending'
  ) then
    raise exception
      'This mentorship is not eligible for an extension';
  end if;

  if target_mentorship.agreed_duration = 'ongoing'
    or target_mentorship.expected_end_date is null then
    raise exception
      'An ongoing mentorship does not require an extension';
  end if;

  if current_date <
    target_mentorship.expected_end_date - 30 then
    raise exception
      'An extension may only be requested within 30 days of the expected end date';
  end if;

  if requested_extension_duration not in (
    '3_months',
    '6_months',
    '1_year',
    'ongoing'
  ) then
    raise exception 'Invalid extension duration';
  end if;

  if char_length(trim(extension_reason))
    not between 10 and 1000 then
    raise exception
      'The extension reason must contain between 10 and 1000 characters';
  end if;

  calculated_end_date :=
    case requested_extension_duration
      when '3_months' then
        target_mentorship.expected_end_date
          + interval '3 months'
      when '6_months' then
        target_mentorship.expected_end_date
          + interval '6 months'
      when '1_year' then
        target_mentorship.expected_end_date
          + interval '1 year'
      when 'ongoing' then null
      else null
    end;

  insert into public.mentorship_extension_requests (
    mentorship_id,
    requested_by,
    requested_duration,
    reason,
    previous_duration,
    previous_end_date,
    proposed_end_date
  )
  values (
    target_mentorship.id,
    auth.uid(),
    requested_extension_duration,
    trim(extension_reason),
    target_mentorship.agreed_duration,
    target_mentorship.expected_end_date,
    calculated_end_date
  )
  returning id into created_extension_id;

  update public.mentorships
  set status = 'extension_pending'
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
    'extension_requested',
    target_mentorship.status,
    'extension_pending',
    trim(extension_reason),
    jsonb_build_object(
      'extension_request_id',
        created_extension_id,
      'previous_duration',
        target_mentorship.agreed_duration,
      'requested_duration',
        requested_extension_duration,
      'previous_end_date',
        target_mentorship.expected_end_date,
      'proposed_end_date',
        calculated_end_date
    )
  );

  return created_extension_id;
end;
$function$;


create or replace function public.respond_to_mentorship_extension(
  target_extension_request_id uuid,
  response_action text,
  response_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_extension
    public.mentorship_extension_requests%rowtype;
  target_mentorship public.mentorships%rowtype;
  other_participant_id uuid;
  restored_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_extension
  from public.mentorship_extension_requests
  where id = target_extension_request_id
  for update;

  if not found then
    raise exception 'Extension request not found';
  end if;

  if target_extension.status <> 'pending' then
    raise exception
      'This extension request has already been resolved';
  end if;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_extension.mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if target_extension.requested_by =
    target_mentorship.mentor_id then
    other_participant_id :=
      target_mentorship.mentee_id;
  elsif target_extension.requested_by =
    target_mentorship.mentee_id then
    other_participant_id :=
      target_mentorship.mentor_id;
  else
    raise exception
      'The extension requester is not a mentorship participant';
  end if;

  if auth.uid() <> other_participant_id then
    raise exception
      'Only the other mentorship participant may respond';
  end if;

  restored_status :=
    case
      when target_mentorship.expected_end_date is not null
        and target_mentorship.expected_end_date
          <= current_date + 30
        then 'ending'
      else 'active'
    end;

  if target_extension.expires_at <= now() then
    update public.mentorship_extension_requests
    set
      status = 'expired',
      responded_by = auth.uid(),
      responded_at = now()
    where id = target_extension.id;

    update public.mentorships
    set status = restored_status
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
      'extension_expired',
      target_mentorship.status,
      restored_status,
      'The extension request expired before a response was completed.',
      jsonb_build_object(
        'extension_request_id',
          target_extension.id,
        'expires_at',
          target_extension.expires_at
      )
    );

    return null;
  end if;

  if response_action = 'decline' then
    update public.mentorship_extension_requests
    set
      status = 'declined',
      responded_by = auth.uid(),
      responded_at = now()
    where id = target_extension.id;

    update public.mentorships
    set status = restored_status
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
      'extension_declined',
      target_mentorship.status,
      restored_status,
      nullif(trim(response_note), ''),
      jsonb_build_object(
        'extension_request_id',
          target_extension.id,
        'requested_duration',
          target_extension.requested_duration,
        'retained_end_date',
          target_mentorship.expected_end_date
      )
    );

    return target_mentorship.id;
  end if;

  if response_action <> 'accept' then
    raise exception
      'Extension response must be accept or decline';
  end if;

  update public.mentorship_extension_requests
  set
    status = 'accepted',
    responded_by = auth.uid(),
    responded_at = now()
  where id = target_extension.id;

  update public.mentorships
  set
    agreed_duration =
      target_extension.requested_duration,
    expected_end_date =
      target_extension.proposed_end_date,
    status = 'active'
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
    'extension_accepted',
    target_mentorship.status,
    'active',
    nullif(trim(response_note), ''),
    jsonb_build_object(
      'extension_request_id',
        target_extension.id,
      'previous_duration',
        target_extension.previous_duration,
      'new_duration',
        target_extension.requested_duration,
      'previous_end_date',
        target_extension.previous_end_date,
      'new_end_date',
        target_extension.proposed_end_date
    )
  );

  return target_mentorship.id;
end;
$function$;


revoke all
on function public.respond_to_mentorship_request(
  uuid,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.respond_to_mentorship_request(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;


revoke all
on function public.request_mentorship_extension(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.request_mentorship_extension(
  uuid,
  text,
  text
)
to authenticated;


revoke all
on function public.respond_to_mentorship_extension(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.respond_to_mentorship_extension(
  uuid,
  text,
  text
)
to authenticated;


commit;