-- FieldsConnect feedback, FC Team recruitment and internal ticket workflow.
--
-- Normal users submit only a title and description.
-- They receive an acknowledgement but cannot read, edit or track submissions.
-- Administrators and active FC Team members manage the internal workflow.

-- ============================================================
-- Make notifications extensible for future FieldsConnect modules
-- ============================================================

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%notification_type%'
        or pg_get_constraintdef(oid) ilike '%entity_type%'
      )
  loop
    execute format(
      'alter table public.notifications drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.notifications
  add constraint notifications_notification_type_format_check
  check (
    char_length(trim(notification_type)) between 1 and 80
  );

alter table public.notifications
  add constraint notifications_entity_type_format_check
  check (
    char_length(trim(entity_type)) between 1 and 80
  );

-- ============================================================
-- FC Team membership and recruitment
-- ============================================================

create table if not exists public.fc_team_members (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  activated_by uuid
    references auth.users(id)
    on delete set null,

  activated_at timestamptz not null default now(),

  revoked_by uuid
    references auth.users(id)
    on delete set null,

  revoked_at timestamptz,
  revocation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_team_members_revocation_reason_length_check
  check (
    revocation_reason is null
    or char_length(trim(revocation_reason)) between 3 and 1000
  )
);

create table if not exists public.fc_team_recruitment_requests (
  id uuid primary key default gen_random_uuid(),

  candidate_id uuid not null
    references auth.users(id)
    on delete cascade,

  recruited_by uuid not null
    references auth.users(id)
    on delete restrict,

  invitation_message text,

  status text not null default 'awaiting_response'
    check (
      status in (
        'awaiting_response',
        'accepted',
        'declined',
        'awaiting_final_approval',
        'activated',
        'expired',
        'revoked'
      )
    ),

  responsibilities_acknowledged boolean not null default false,
  confidentiality_acknowledged boolean not null default false,
  appropriate_use_acknowledged boolean not null default false,

  responded_at timestamptz,

  approved_by uuid
    references auth.users(id)
    on delete set null,

  approved_at timestamptz,
  activated_at timestamptz,

  expires_at timestamptz not null
    default (now() + interval '14 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_team_invitation_message_length_check
  check (
    invitation_message is null
    or char_length(trim(invitation_message)) <= 2000
  )
);

create unique index if not exists
  fc_team_one_active_recruitment_per_candidate_idx
on public.fc_team_recruitment_requests(candidate_id)
where status in (
  'awaiting_response',
  'accepted',
  'awaiting_final_approval'
);

create index if not exists
  fc_team_recruitment_candidate_idx
on public.fc_team_recruitment_requests(candidate_id, created_at desc);

create index if not exists
  fc_team_recruitment_status_idx
on public.fc_team_recruitment_requests(status, created_at desc);

-- Bootstrap the FieldsConnect founder as an active FC Team member.
insert into public.fc_team_members (
  user_id,
  activated_by,
  activated_at
)
select
  id,
  id,
  now()
from auth.users
where lower(email) = lower('kevinmasindi@yahoo.com')
on conflict (user_id) do update
set
  revoked_by = null,
  revoked_at = null,
  revocation_reason = null,
  updated_at = now();

-- ============================================================
-- Raw user feedback
-- ============================================================

create table if not exists public.fc_feedback_submissions (
  id uuid primary key default gen_random_uuid(),

  submitted_by uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,
  description text not null,

  review_status text not null default 'new'
    check (
      review_status in (
        'new',
        'reviewing',
        'ticket_created',
        'dismissed',
        'archived'
      )
    ),

  reviewed_by uuid
    references auth.users(id)
    on delete set null,

  reviewed_at timestamptz,
  review_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_feedback_title_length_check
  check (
    char_length(trim(title)) between 3 and 160
  ),

  constraint fc_feedback_description_length_check
  check (
    char_length(trim(description)) between 10 and 5000
  ),

  constraint fc_feedback_review_notes_length_check
  check (
    review_notes is null
    or char_length(trim(review_notes)) <= 5000
  )
);

create index if not exists
  fc_feedback_submissions_status_idx
on public.fc_feedback_submissions(review_status, created_at desc);

create index if not exists
  fc_feedback_submissions_created_idx
on public.fc_feedback_submissions(created_at desc);

-- ============================================================
-- Internal FC feedback tickets
-- ============================================================

create table if not exists public.fc_feedback_tickets (
  id uuid primary key default gen_random_uuid(),

  ticket_number text unique,

  source_submission_id uuid unique
    references public.fc_feedback_submissions(id)
    on delete set null,

  title text not null,
  description text not null,

  internal_classification text,

  priority text not null default 'medium'
    check (
      priority in (
        'low',
        'medium',
        'high',
        'urgent'
      )
    ),

  status text not null default 'open'
    check (
      status in (
        'open',
        'assigned',
        'in_progress',
        'blocked',
        'resolved',
        'closed',
        'cancelled'
      )
    ),

  assigned_to uuid
    references auth.users(id)
    on delete set null,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  resolution_summary text,

  fc_news_required boolean not null default false,

  fc_news_post_id uuid,

  assigned_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_feedback_ticket_title_length_check
  check (
    char_length(trim(title)) between 3 and 160
  ),

  constraint fc_feedback_ticket_description_length_check
  check (
    char_length(trim(description)) between 10 and 5000
  ),

  constraint fc_feedback_ticket_classification_length_check
  check (
    internal_classification is null
    or char_length(trim(internal_classification)) <= 200
  ),

  constraint fc_feedback_resolution_summary_length_check
  check (
    resolution_summary is null
    or char_length(trim(resolution_summary)) <= 5000
  )
);

create index if not exists
  fc_feedback_tickets_status_idx
on public.fc_feedback_tickets(status, created_at desc);

create index if not exists
  fc_feedback_tickets_assignee_idx
on public.fc_feedback_tickets(assigned_to, status);

create table if not exists public.fc_feedback_ticket_activity (
  id uuid primary key default gen_random_uuid(),

  ticket_id uuid not null
    references public.fc_feedback_tickets(id)
    on delete cascade,

  performed_by uuid not null
    references auth.users(id)
    on delete restrict,

  activity_type text not null,
  notes text,

  created_at timestamptz not null default now(),

  constraint fc_feedback_activity_type_length_check
  check (
    char_length(trim(activity_type)) between 2 and 80
  ),

  constraint fc_feedback_activity_notes_length_check
  check (
    notes is null
    or char_length(trim(notes)) <= 5000
  )
);

create index if not exists
  fc_feedback_ticket_activity_ticket_idx
on public.fc_feedback_ticket_activity(ticket_id, created_at desc);

-- ============================================================
-- Shared helper functions
-- ============================================================

create or replace function public.is_fc_team_member(
  candidate uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fc_team_members
    where user_id = candidate
      and revoked_at is null
  );
$$;

create or replace function public.can_manage_fc_feedback()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_platform_role(array['admin'])
    or public.is_fc_team_member(auth.uid());
$$;

-- ============================================================
-- User feedback submission
-- ============================================================

create or replace function public.submit_fc_feedback(
  feedback_title text,
  feedback_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  feedback_id uuid;
  team_member record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(feedback_title, ''))) < 3 then
    raise exception 'Feedback title must contain at least 3 characters';
  end if;

  if char_length(trim(coalesce(feedback_title, ''))) > 160 then
    raise exception 'Feedback title may not exceed 160 characters';
  end if;

  if char_length(trim(coalesce(feedback_description, ''))) < 10 then
    raise exception 'Feedback description must contain at least 10 characters';
  end if;

  if char_length(trim(coalesce(feedback_description, ''))) > 5000 then
    raise exception 'Feedback description may not exceed 5000 characters';
  end if;

  insert into public.fc_feedback_submissions (
    submitted_by,
    title,
    description
  )
  values (
    auth.uid(),
    trim(feedback_title),
    trim(feedback_description)
  )
  returning id into feedback_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    auth.uid(),
    null,
    'feedback_acknowledgement',
    'feedback_submission',
    feedback_id,
    'Thank you for your feedback',
    'Thank you for submitting your feedback. The FieldsConnect team will review it and take appropriate action.'
  );

  for team_member in
    select member.user_id
    from public.fc_team_members member
    where member.revoked_at is null
  loop
    if team_member.user_id is distinct from auth.uid() then
      insert into public.notifications (
        recipient_id,
        actor_id,
        notification_type,
        entity_type,
        entity_id,
        title,
        body
      )
      values (
        team_member.user_id,
        null,
        'new_fc_feedback',
        'feedback_submission',
        feedback_id,
        'New FieldsConnect feedback',
        'A new community feedback submission is ready for review.'
      );
    end if;
  end loop;

  return feedback_id;
end;
$$;

-- ============================================================
-- FC Team recruitment
-- ============================================================

create or replace function public.recruit_fc_team_member(
  candidate uuid,
  invitation_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recruitment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may recruit FC Team members';
  end if;

  if candidate is null then
    raise exception 'Select a candidate';
  end if;

  if candidate = auth.uid() then
    raise exception 'You are already managing the FC Team';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = candidate
  ) then
    raise exception 'Candidate account not found';
  end if;

  if public.is_fc_team_member(candidate) then
    raise exception 'This user is already an active FC Team member';
  end if;

  if exists (
    select 1
    from public.fc_team_recruitment_requests
    where candidate_id = candidate
      and status in (
        'awaiting_response',
        'accepted',
        'awaiting_final_approval'
      )
  ) then
    raise exception 'This user already has an active FC Team recruitment request';
  end if;

  insert into public.fc_team_recruitment_requests (
    candidate_id,
    recruited_by,
    invitation_message
  )
  values (
    candidate,
    auth.uid(),
    nullif(trim(coalesce(invitation_text, '')), '')
  )
  returning id into recruitment_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    candidate,
    auth.uid(),
    'fc_team_recruitment',
    'fc_team_recruitment',
    recruitment_id,
    'FieldsConnect Team invitation',
    'You have been invited to join the FieldsConnect Team. Review the invitation and accept or decline it.'
  );

  return recruitment_id;
end;
$$;

create or replace function public.respond_to_fc_team_recruitment(
  recruitment uuid,
  accept_recruitment boolean,
  acknowledge_responsibilities boolean default false,
  acknowledge_confidentiality boolean default false,
  acknowledge_appropriate_use boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recruitment_record public.fc_team_recruitment_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into recruitment_record
  from public.fc_team_recruitment_requests
  where id = recruitment
  for update;

  if recruitment_record.id is null then
    raise exception 'Recruitment request not found';
  end if;

  if recruitment_record.candidate_id <> auth.uid() then
    raise exception 'This recruitment request does not belong to you';
  end if;

  if recruitment_record.status <> 'awaiting_response' then
    raise exception 'This recruitment request can no longer be answered';
  end if;

  if recruitment_record.expires_at <= now() then
    update public.fc_team_recruitment_requests
    set
      status = 'expired',
      updated_at = now()
    where id = recruitment;

    raise exception 'This recruitment request has expired';
  end if;

  if not accept_recruitment then
    update public.fc_team_recruitment_requests
    set
      status = 'declined',
      responded_at = now(),
      updated_at = now()
    where id = recruitment;

    return;
  end if;

  if not (
    acknowledge_responsibilities
    and acknowledge_confidentiality
    and acknowledge_appropriate_use
  ) then
    raise exception 'All FC Team responsibilities must be acknowledged';
  end if;

  update public.fc_team_recruitment_requests
  set
    status = 'awaiting_final_approval',
    responsibilities_acknowledged = true,
    confidentiality_acknowledged = true,
    appropriate_use_acknowledged = true,
    responded_at = now(),
    updated_at = now()
  where id = recruitment;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  select
    role_record.user_id,
    auth.uid(),
    'fc_team_recruitment_accepted',
    'fc_team_recruitment',
    recruitment,
    'FC Team invitation accepted',
    'A candidate accepted an FC Team invitation and is awaiting final approval.'
  from public.platform_roles role_record
  where role_record.role = 'admin'
    and role_record.revoked_at is null;
end;
$$;

create or replace function public.activate_fc_team_recruitment(
  recruitment uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recruitment_record public.fc_team_recruitment_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may activate FC Team membership';
  end if;

  select *
  into recruitment_record
  from public.fc_team_recruitment_requests
  where id = recruitment
  for update;

  if recruitment_record.id is null then
    raise exception 'Recruitment request not found';
  end if;

  if recruitment_record.status <> 'awaiting_final_approval' then
    raise exception 'Recruitment request is not awaiting final approval';
  end if;

  if not (
    recruitment_record.responsibilities_acknowledged
    and recruitment_record.confidentiality_acknowledged
    and recruitment_record.appropriate_use_acknowledged
  ) then
    raise exception 'Required acknowledgements are incomplete';
  end if;

  insert into public.fc_team_members (
    user_id,
    activated_by,
    activated_at,
    revoked_by,
    revoked_at,
    revocation_reason,
    updated_at
  )
  values (
    recruitment_record.candidate_id,
    auth.uid(),
    now(),
    null,
    null,
    null,
    now()
  )
  on conflict (user_id) do update
  set
    activated_by = excluded.activated_by,
    activated_at = excluded.activated_at,
    revoked_by = null,
    revoked_at = null,
    revocation_reason = null,
    updated_at = now();

  update public.fc_team_recruitment_requests
  set
    status = 'activated',
    approved_by = auth.uid(),
    approved_at = now(),
    activated_at = now(),
    updated_at = now()
  where id = recruitment;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    recruitment_record.candidate_id,
    auth.uid(),
    'fc_team_activated',
    'fc_team_recruitment',
    recruitment,
    'Welcome to the FieldsConnect Team',
    'Your FC Team membership has been activated. You can now receive and action assigned feedback tickets.'
  );
end;
$$;

-- ============================================================
-- Feedback review and ticket assignment
-- ============================================================

create or replace function public.create_fc_feedback_ticket(
  submission uuid,
  ticket_title text,
  ticket_description text,
  ticket_priority text default 'medium',
  classification_text text default null,
  assignee uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  feedback_record public.fc_feedback_submissions%rowtype;
  new_ticket_id uuid;
  generated_ticket_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may create FC feedback tickets';
  end if;

  select *
  into feedback_record
  from public.fc_feedback_submissions
  where id = submission
  for update;

  if feedback_record.id is null then
    raise exception 'Feedback submission not found';
  end if;

  if feedback_record.review_status = 'ticket_created' then
    raise exception 'A ticket has already been created from this feedback';
  end if;

  if ticket_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid ticket priority';
  end if;

  if assignee is not null and not public.is_fc_team_member(assignee) then
    raise exception 'Tickets may only be assigned to active FC Team members';
  end if;

  new_ticket_id := gen_random_uuid();

  generated_ticket_number :=
    'FC-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(replace(new_ticket_id::text, '-', ''), 1, 6));

  insert into public.fc_feedback_tickets (
    id,
    ticket_number,
    source_submission_id,
    title,
    description,
    internal_classification,
    priority,
    status,
    assigned_to,
    created_by,
    assigned_at
  )
  values (
    new_ticket_id,
    generated_ticket_number,
    feedback_record.id,
    trim(ticket_title),
    trim(ticket_description),
    nullif(trim(coalesce(classification_text, '')), ''),
    ticket_priority,
    case when assignee is null then 'open' else 'assigned' end,
    assignee,
    auth.uid(),
    case when assignee is null then null else now() end
  );

  update public.fc_feedback_submissions
  set
    review_status = 'ticket_created',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = submission;

  insert into public.fc_feedback_ticket_activity (
    ticket_id,
    performed_by,
    activity_type,
    notes
  )
  values (
    new_ticket_id,
    auth.uid(),
    'ticket_created',
    'Ticket created from community feedback.'
  );

  if assignee is not null then
    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      title,
      body
    )
    values (
      assignee,
      auth.uid(),
      'fc_feedback_assignment',
      'fc_feedback_ticket',
      new_ticket_id,
      'New FC feedback ticket assigned',
      'You have been assigned ticket ' || generated_ticket_number || '.'
    );
  end if;

  return new_ticket_id;
end;
$$;

create or replace function public.assign_fc_feedback_ticket(
  ticket uuid,
  assignee uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_record public.fc_feedback_tickets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may assign FC feedback tickets';
  end if;

  if not public.is_fc_team_member(assignee) then
    raise exception 'Assignee must be an active FC Team member';
  end if;

  select *
  into ticket_record
  from public.fc_feedback_tickets
  where id = ticket
  for update;

  if ticket_record.id is null then
    raise exception 'Feedback ticket not found';
  end if;

  if ticket_record.status in ('closed', 'cancelled') then
    raise exception 'Closed or cancelled tickets cannot be assigned';
  end if;

  update public.fc_feedback_tickets
  set
    assigned_to = assignee,
    assigned_at = now(),
    status = case
      when status = 'open' then 'assigned'
      else status
    end,
    updated_at = now()
  where id = ticket;

  insert into public.fc_feedback_ticket_activity (
    ticket_id,
    performed_by,
    activity_type,
    notes
  )
  values (
    ticket,
    auth.uid(),
    'assigned',
    'Ticket assigned to an FC Team member.'
  );

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    assignee,
    auth.uid(),
    'fc_feedback_assignment',
    'fc_feedback_ticket',
    ticket,
    'New FC feedback ticket assigned',
    'You have been assigned ticket '
      || coalesce(ticket_record.ticket_number, ticket::text)
      || '.'
  );
end;
$$;

create or replace function public.update_fc_feedback_ticket(
  ticket uuid,
  new_status text,
  action_notes text default null,
  resolution_text text default null,
  publish_fc_news boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_record public.fc_feedback_tickets%rowtype;
  caller_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if new_status not in (
    'assigned',
    'in_progress',
    'blocked',
    'resolved',
    'closed',
    'cancelled'
  ) then
    raise exception 'Invalid ticket status';
  end if;

  select *
  into ticket_record
  from public.fc_feedback_tickets
  where id = ticket
  for update;

  if ticket_record.id is null then
    raise exception 'Feedback ticket not found';
  end if;

  caller_is_admin := public.has_platform_role(array['admin']);

  if not caller_is_admin
     and ticket_record.assigned_to <> auth.uid() then
    raise exception 'You may only update feedback tickets assigned to you';
  end if;

  if not caller_is_admin and new_status in ('closed', 'cancelled') then
    raise exception 'Only an administrator may close or cancel a ticket';
  end if;

  if new_status = 'resolved'
     and char_length(trim(coalesce(resolution_text, ''))) < 10 then
    raise exception 'A resolution summary is required before resolving a ticket';
  end if;

  update public.fc_feedback_tickets
  set
    status = new_status,

    started_at = case
      when new_status = 'in_progress'
           and started_at is null
      then now()
      else started_at
    end,

    resolved_at = case
      when new_status = 'resolved'
      then now()
      else resolved_at
    end,

    closed_at = case
      when new_status = 'closed'
      then now()
      else closed_at
    end,

    resolution_summary = case
      when resolution_text is not null
      then trim(resolution_text)
      else resolution_summary
    end,

    fc_news_required = case
      when new_status = 'resolved'
      then publish_fc_news
      else fc_news_required
    end,

    updated_at = now()
  where id = ticket;

  insert into public.fc_feedback_ticket_activity (
    ticket_id,
    performed_by,
    activity_type,
    notes
  )
  values (
    ticket,
    auth.uid(),
    new_status,
    nullif(trim(coalesce(action_notes, '')), '')
  );
end;
$$;

-- ============================================================
-- Updated-at triggers
-- ============================================================

create or replace function public.set_fc_feedback_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_fc_team_members_updated_at
on public.fc_team_members;

create trigger set_fc_team_members_updated_at
before update on public.fc_team_members
for each row
execute function public.set_fc_feedback_updated_at();

drop trigger if exists set_fc_team_recruitment_updated_at
on public.fc_team_recruitment_requests;

create trigger set_fc_team_recruitment_updated_at
before update on public.fc_team_recruitment_requests
for each row
execute function public.set_fc_feedback_updated_at();

drop trigger if exists set_fc_feedback_submissions_updated_at
on public.fc_feedback_submissions;

create trigger set_fc_feedback_submissions_updated_at
before update on public.fc_feedback_submissions
for each row
execute function public.set_fc_feedback_updated_at();

drop trigger if exists set_fc_feedback_tickets_updated_at
on public.fc_feedback_tickets;

create trigger set_fc_feedback_tickets_updated_at
before update on public.fc_feedback_tickets
for each row
execute function public.set_fc_feedback_updated_at();

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.fc_team_members enable row level security;
alter table public.fc_team_recruitment_requests enable row level security;
alter table public.fc_feedback_submissions enable row level security;
alter table public.fc_feedback_tickets enable row level security;
alter table public.fc_feedback_ticket_activity enable row level security;

revoke all on table public.fc_team_members
from anon, authenticated;

revoke all on table public.fc_team_recruitment_requests
from anon, authenticated;

revoke all on table public.fc_feedback_submissions
from anon, authenticated;

revoke all on table public.fc_feedback_tickets
from anon, authenticated;

revoke all on table public.fc_feedback_ticket_activity
from anon, authenticated;

grant select on table public.fc_team_members
to authenticated;

grant select on table public.fc_team_recruitment_requests
to authenticated;

grant select on table public.fc_feedback_submissions
to authenticated;

grant select on table public.fc_feedback_tickets
to authenticated;

grant select on table public.fc_feedback_ticket_activity
to authenticated;

create policy "fc_team_members_read_team_or_admin"
on public.fc_team_members
for select
to authenticated
using (
  public.is_fc_team_member()
  or public.has_platform_role(array['admin'])
);

create policy "fc_team_recruitment_read_relevant"
on public.fc_team_recruitment_requests
for select
to authenticated
using (
  candidate_id = auth.uid()
  or recruited_by = auth.uid()
  or public.has_platform_role(array['admin'])
);

create policy "fc_feedback_submissions_internal_read"
on public.fc_feedback_submissions
for select
to authenticated
using (
  public.can_manage_fc_feedback()
);

create policy "fc_feedback_tickets_internal_read"
on public.fc_feedback_tickets
for select
to authenticated
using (
  public.has_platform_role(array['admin'])
  or assigned_to = auth.uid()
  or public.is_fc_team_member()
);

create policy "fc_feedback_ticket_activity_internal_read"
on public.fc_feedback_ticket_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.fc_feedback_tickets ticket
    where ticket.id = ticket_id
      and (
        public.has_platform_role(array['admin'])
        or ticket.assigned_to = auth.uid()
        or public.is_fc_team_member()
      )
  )
);

-- ============================================================
-- Function permissions
-- ============================================================

revoke all on function public.is_fc_team_member(uuid)
from public, anon;

revoke all on function public.can_manage_fc_feedback()
from public, anon;

revoke all on function public.submit_fc_feedback(text, text)
from public, anon;

revoke all on function public.recruit_fc_team_member(uuid, text)
from public, anon;

revoke all on function public.respond_to_fc_team_recruitment(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
)
from public, anon;

revoke all on function public.activate_fc_team_recruitment(uuid)
from public, anon;

revoke all on function public.create_fc_feedback_ticket(
  uuid,
  text,
  text,
  text,
  text,
  uuid
)
from public, anon;

revoke all on function public.assign_fc_feedback_ticket(uuid, uuid)
from public, anon;

revoke all on function public.update_fc_feedback_ticket(
  uuid,
  text,
  text,
  text,
  boolean
)
from public, anon;

grant execute on function public.is_fc_team_member(uuid)
to authenticated;

grant execute on function public.can_manage_fc_feedback()
to authenticated;

grant execute on function public.submit_fc_feedback(text, text)
to authenticated;

grant execute on function public.recruit_fc_team_member(uuid, text)
to authenticated;

grant execute on function public.respond_to_fc_team_recruitment(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean
)
to authenticated;

grant execute on function public.activate_fc_team_recruitment(uuid)
to authenticated;

grant execute on function public.create_fc_feedback_ticket(
  uuid,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;

grant execute on function public.assign_fc_feedback_ticket(uuid, uuid)
to authenticated;

grant execute on function public.update_fc_feedback_ticket(
  uuid,
  text,
  text,
  text,
  boolean
)
to authenticated;

-- ============================================================
-- Realtime
-- ============================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fc_team_members',
    'fc_team_recruitment_requests',
    'fc_feedback_submissions',
    'fc_feedback_tickets',
    'fc_feedback_ticket_activity'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;