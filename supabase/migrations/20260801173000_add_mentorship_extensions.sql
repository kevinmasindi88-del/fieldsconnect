-- Add controlled period-extension requests to structured mentorships.

begin;

-- ---------------------------------------------------------------------------
-- Extend the mentorship lifecycle
-- ---------------------------------------------------------------------------

alter table public.mentorships
  drop constraint if exists mentorships_status_check;

alter table public.mentorships
  add constraint mentorships_status_check
  check (
    status in (
      'active',
      'ending',
      'extension_pending',
      'paused',
      'completion_requested',
      'completed',
      'cancelled',
      'ended_early'
    )
  );

drop index if exists public.mentorships_one_active_pair_idx;

create unique index mentorships_one_active_pair_idx
  on public.mentorships (
    mentor_id,
    mentee_id
  )
  where status in (
    'active',
    'ending',
    'extension_pending',
    'paused',
    'completion_requested'
  );

-- ---------------------------------------------------------------------------
-- Extension requests
-- ---------------------------------------------------------------------------

create table if not exists public.mentorship_extension_requests (
  id uuid primary key default gen_random_uuid(),

  mentorship_id uuid not null
    references public.mentorships(id)
    on delete restrict,

  requested_by uuid not null
    references public.profiles(id)
    on delete restrict,

  requested_duration text not null
    check (
      requested_duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),

  reason text not null
    check (
      char_length(trim(reason))
      between 10 and 1000
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'cancelled',
        'expired'
      )
    ),

  responded_by uuid
    references public.profiles(id)
    on delete set null,

  previous_duration text not null
    check (
      previous_duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),

  previous_end_date date,
  proposed_end_date date,

  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  cancelled_at timestamptz,

  expires_at timestamptz not null
    default (now() + interval '30 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
mentorship_extension_requests_relationship_idx
  on public.mentorship_extension_requests (
    mentorship_id,
    status,
    requested_at desc
  );

create index if not exists
mentorship_extension_requests_requester_idx
  on public.mentorship_extension_requests (
    requested_by,
    requested_at desc
  );

create unique index if not exists
mentorship_extension_requests_one_open_idx
  on public.mentorship_extension_requests (
    mentorship_id
  )
  where status = 'pending';

drop trigger if exists
mentorship_extension_requests_set_updated_at
on public.mentorship_extension_requests;

create trigger
mentorship_extension_requests_set_updated_at
before update on public.mentorship_extension_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.mentorship_extension_requests
  enable row level security;

drop policy if exists
"mentorship_extension_requests_select_participants"
on public.mentorship_extension_requests;

create policy
"mentorship_extension_requests_select_participants"
on public.mentorship_extension_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.mentorships mentorship
    where mentorship.id =
      mentorship_extension_requests.mentorship_id
      and (
        mentorship.mentor_id = auth.uid()
        or mentorship.mentee_id = auth.uid()
      )
  )
);

-- Direct inserts and updates are intentionally omitted.
-- Extension changes must pass through the controlled RPCs below.

-- ---------------------------------------------------------------------------
-- Request an extension
-- ---------------------------------------------------------------------------

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

  if requested_extension_duration not in (
    '3_months',
    '6_months',
    '1_year',
    'ongoing'
  ) then
    raise exception 'Invalid extension duration';
  end if;

  if char_length(trim(extension_reason)) not between 10 and 1000 then
    raise exception
      'The extension reason must contain between 10 and 1000 characters';
  end if;

  if exists (
    select 1
    from public.mentorship_extension_requests extension_request
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
        coalesce(
          target_mentorship.expected_end_date,
          current_date
        ) + interval '3 months'

      when '6_months' then
        coalesce(
          target_mentorship.expected_end_date,
          current_date
        ) + interval '6 months'

      when '1_year' then
        coalesce(
          target_mentorship.expected_end_date,
          current_date
        ) + interval '1 year'

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

-- ---------------------------------------------------------------------------
-- Accept or decline an extension
-- ---------------------------------------------------------------------------

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

  if target_extension.expires_at <= now() then
    update public.mentorship_extension_requests
    set status = 'expired'
    where id = target_extension.id;

    raise exception 'This extension request has expired';
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

  if response_action = 'decline' then
    update public.mentorship_extension_requests
    set
      status = 'declined',
      responded_by = auth.uid(),
      responded_at = now()
    where id = target_extension.id;

    update public.mentorships
    set
      status = case
        when expected_end_date is not null
          and expected_end_date <= current_date + 30
          then 'ending'
        else 'active'
      end
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
      case
        when target_mentorship.expected_end_date
          is not null
          and target_mentorship.expected_end_date
            <= current_date + 30
          then 'ending'
        else 'active'
      end,
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

-- ---------------------------------------------------------------------------
-- Cancel a pending extension
-- ---------------------------------------------------------------------------

create or replace function public.cancel_mentorship_extension(
  target_extension_request_id uuid
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

  if target_extension.requested_by <> auth.uid() then
    raise exception
      'Only the requester may cancel this extension request';
  end if;

  if target_extension.status <> 'pending' then
    raise exception
      'Only pending extension requests may be cancelled';
  end if;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_extension.mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
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

  update public.mentorship_extension_requests
  set
    status = 'cancelled',
    cancelled_at = now()
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
    'extension_cancelled',
    target_mentorship.status,
    restored_status,
    'The extension requester cancelled the pending request.',
    jsonb_build_object(
      'extension_request_id',
        target_extension.id,
      'requested_duration',
        target_extension.requested_duration
    )
  );

  return target_mentorship.id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

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

revoke all
on function public.cancel_mentorship_extension(uuid)
from public, anon;

grant execute
on function public.cancel_mentorship_extension(uuid)
to authenticated;

commit;