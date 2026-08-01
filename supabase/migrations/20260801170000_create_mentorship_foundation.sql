-- FieldsConnect structured mentor–mentee foundation.

begin;

create table if not exists public.mentor_profiles (
  mentor_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  mentorship_summary text,
  mentoring_fields text[] not null default '{}'::text[],
  mentoring_levels text[] not null default '{}'::text[],

  maximum_active_mentees integer not null default 3
    check (maximum_active_mentees between 1 and 50),

  preferred_frequency text
    check (
      preferred_frequency is null
      or preferred_frequency in (
        'weekly',
        'fortnightly',
        'monthly',
        'flexible'
      )
    ),

  accepts_3_month boolean not null default true,
  accepts_6_month boolean not null default true,
  accepts_1_year boolean not null default true,
  accepts_ongoing boolean not null default false,

  is_accepting_requests boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mentor_profiles_set_updated_at
on public.mentor_profiles;

create trigger mentor_profiles_set_updated_at
before update on public.mentor_profiles
for each row execute function public.set_updated_at();

create table if not exists public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),

  mentee_id uuid not null
    references public.profiles(id)
    on delete cascade,

  mentor_id uuid not null
    references public.profiles(id)
    on delete cascade,

  mentorship_field text not null
    check (
      char_length(trim(mentorship_field))
      between 2 and 120
    ),

  objective text not null
    check (
      char_length(trim(objective))
      between 10 and 1000
    ),

  motivation text not null
    check (
      char_length(trim(motivation))
      between 10 and 1500
    ),

  requested_duration text not null
    check (
      requested_duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),

  requested_frequency text not null
    check (
      requested_frequency in (
        'weekly',
        'fortnightly',
        'monthly',
        'flexible'
      )
    ),

  proposed_duration text
    check (
      proposed_duration is null
      or proposed_duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),

  proposed_frequency text
    check (
      proposed_frequency is null
      or proposed_frequency in (
        'weekly',
        'fortnightly',
        'monthly',
        'flexible'
      )
    ),

  proposal_message text
    check (
      proposal_message is null
      or char_length(trim(proposal_message))
        between 5 and 1000
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'change_proposed',
        'accepted',
        'declined',
        'cancelled',
        'expired'
      )
    ),

  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null
    default (now() + interval '30 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (mentee_id <> mentor_id)
);

create index if not exists mentorship_requests_mentee_idx
  on public.mentorship_requests (
    mentee_id,
    created_at desc
  );

create index if not exists mentorship_requests_mentor_idx
  on public.mentorship_requests (
    mentor_id,
    status,
    created_at desc
  );

create unique index if not exists
mentorship_requests_one_open_pair_idx
  on public.mentorship_requests (
    mentee_id,
    mentor_id
  )
  where status in (
    'pending',
    'change_proposed'
  );

drop trigger if exists mentorship_requests_set_updated_at
on public.mentorship_requests;

create trigger mentorship_requests_set_updated_at
before update on public.mentorship_requests
for each row execute function public.set_updated_at();

create table if not exists public.mentorships (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null unique
    references public.mentorship_requests(id)
    on delete restrict,

  mentor_id uuid not null
    references public.profiles(id)
    on delete restrict,

  mentee_id uuid not null
    references public.profiles(id)
    on delete restrict,

  mentorship_field text not null,

  agreed_duration text not null
    check (
      agreed_duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),

  agreed_frequency text not null
    check (
      agreed_frequency in (
        'weekly',
        'fortnightly',
        'monthly',
        'flexible'
      )
    ),

  objective text not null,

  status text not null default 'active'
    check (
      status in (
        'active',
        'paused',
        'completion_requested',
        'completed',
        'cancelled',
        'ended_early'
      )
    ),

  start_date date not null default current_date,
  expected_end_date date,

  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  ended_early_at timestamptz,
  end_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (mentor_id <> mentee_id),

  check (
    (
      agreed_duration = 'ongoing'
      and expected_end_date is null
    )
    or
    (
      agreed_duration <> 'ongoing'
      and expected_end_date is not null
    )
  )
);

create index if not exists mentorships_mentor_idx
  on public.mentorships (
    mentor_id,
    status,
    created_at desc
  );

create index if not exists mentorships_mentee_idx
  on public.mentorships (
    mentee_id,
    status,
    created_at desc
  );

create unique index if not exists
mentorships_one_active_pair_idx
  on public.mentorships (
    mentor_id,
    mentee_id
  )
  where status in (
    'active',
    'paused',
    'completion_requested'
  );

drop trigger if exists mentorships_set_updated_at
on public.mentorships;

create trigger mentorships_set_updated_at
before update on public.mentorships
for each row execute function public.set_updated_at();

create table if not exists public.mentorship_audit_events (
  id uuid primary key default gen_random_uuid(),

  request_id uuid
    references public.mentorship_requests(id)
    on delete set null,

  mentorship_id uuid
    references public.mentorships(id)
    on delete set null,

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  event_type text not null,
  previous_status text,
  new_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  check (
    request_id is not null
    or mentorship_id is not null
  )
);

create index if not exists mentorship_audit_request_idx
  on public.mentorship_audit_events (
    request_id,
    created_at
  );

create index if not exists mentorship_audit_relationship_idx
  on public.mentorship_audit_events (
    mentorship_id,
    created_at
  );

alter table public.mentor_profiles enable row level security;
alter table public.mentorship_requests enable row level security;
alter table public.mentorships enable row level security;
alter table public.mentorship_audit_events enable row level security;

drop policy if exists
"mentor_profiles_select_authenticated"
on public.mentor_profiles;

create policy
"mentor_profiles_select_authenticated"
on public.mentor_profiles
for select
to authenticated
using (true);

drop policy if exists
"mentor_profiles_manage_own"
on public.mentor_profiles;

create policy
"mentor_profiles_manage_own"
on public.mentor_profiles
for all
to authenticated
using (mentor_id = auth.uid())
with check (mentor_id = auth.uid());

drop policy if exists
"mentorship_requests_select_participants"
on public.mentorship_requests;

create policy
"mentorship_requests_select_participants"
on public.mentorship_requests
for select
to authenticated
using (
  mentee_id = auth.uid()
  or mentor_id = auth.uid()
);

drop policy if exists
"mentorships_select_participants"
on public.mentorships;

create policy
"mentorships_select_participants"
on public.mentorships
for select
to authenticated
using (
  mentor_id = auth.uid()
  or mentee_id = auth.uid()
);

drop policy if exists
"mentorship_audit_select_participants"
on public.mentorship_audit_events;

create policy
"mentorship_audit_select_participants"
on public.mentorship_audit_events
for select
to authenticated
using (
  exists (
    select 1
    from public.mentorship_requests request
    where request.id =
      mentorship_audit_events.request_id
      and (
        request.mentor_id = auth.uid()
        or request.mentee_id = auth.uid()
      )
  )
  or exists (
    select 1
    from public.mentorships mentorship
    where mentorship.id =
      mentorship_audit_events.mentorship_id
      and (
        mentorship.mentor_id = auth.uid()
        or mentorship.mentee_id = auth.uid()
      )
  )
);

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
  created_request_id uuid;
  mentor_is_available boolean;
  mentor_accepts_period boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_mentor_id = auth.uid() then
    raise exception 'You cannot request mentorship from yourself';
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

  select
    case requested_period
      when '3_months'
        then settings.accepts_3_month
      when '6_months'
        then settings.accepts_6_month
      when '1_year'
        then settings.accepts_1_year
      when 'ongoing'
        then settings.accepts_ongoing
      else false
    end
  into mentor_accepts_period
  from public.mentor_profiles settings
  where settings.mentor_id = target_mentor_id
    and settings.is_accepting_requests = true;

  if coalesce(mentor_accepts_period, false) = false then
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
    requested_frequency
  )
  values (
    auth.uid(),
    target_mentor_id,
    trim(requested_mentorship_field),
    trim(requested_objective),
    trim(requested_motivation),
    requested_period,
    requested_contact_frequency
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
        trim(requested_mentorship_field)
    )
  );

  return created_request_id;
end;
$function$;

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

revoke all
on function public.create_mentorship_request(
  uuid,
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
  text
)
to authenticated;

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

commit;