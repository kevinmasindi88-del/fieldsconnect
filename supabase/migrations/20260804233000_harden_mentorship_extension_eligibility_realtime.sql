begin;

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
  created_extension_id uuid;
  calculated_end_date date;
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
      'Ongoing mentorships do not require an extension';
  end if;

  if target_mentorship.expected_end_date < current_date then
    raise exception
      'This mentorship has already passed its expected end date';
  end if;

  if target_mentorship.expected_end_date >
    current_date + 30 then
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

  if exists (
    select 1
    from public.mentorship_extension_requests
      extension_request
    where extension_request.mentorship_id =
      target_mentorship.id
      and extension_request.status = 'pending'
  ) then
    raise exception
      'An extension request is already pending for this mentorship';
  end if;

  calculated_end_date :=
    case requested_extension_duration
      when '3_months' then
        target_mentorship.expected_end_date +
          interval '3 months'

      when '6_months' then
        target_mentorship.expected_end_date +
          interval '6 months'

      when '1_year' then
        target_mentorship.expected_end_date +
          interval '1 year'

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

alter table public.mentorship_extension_requests
  replica identity full;

do $block$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename =
        'mentorship_extension_requests'
  ) then
    alter publication supabase_realtime
      add table
        public.mentorship_extension_requests;
  end if;
end;
$block$;

commit;