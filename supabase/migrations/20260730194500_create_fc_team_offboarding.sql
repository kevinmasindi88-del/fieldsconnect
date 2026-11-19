-- ============================================================
-- FC Team controlled offboarding
-- ============================================================

create table if not exists public.fc_team_leave_requests (
  id uuid primary key default gen_random_uuid(),

  member_id uuid not null
    references auth.users(id)
    on delete cascade,

  reason text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'declined',
        'cancelled'
      )
    ),

  reviewed_by uuid
    references auth.users(id)
    on delete set null,

  reviewed_at timestamptz,
  admin_response text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_team_leave_reason_length_check
  check (
    char_length(trim(reason)) between 3 and 2000
  ),

  constraint fc_team_leave_admin_response_length_check
  check (
    admin_response is null
    or char_length(trim(admin_response)) between 3 and 2000
  )
);

create unique index if not exists
  fc_team_one_pending_leave_request_idx
on public.fc_team_leave_requests(member_id)
where status = 'pending';

create index if not exists
  fc_team_leave_requests_status_idx
on public.fc_team_leave_requests(status, created_at desc);

create index if not exists
  fc_team_leave_requests_member_idx
on public.fc_team_leave_requests(member_id, created_at desc);

-- ============================================================
-- Shared unresolved-ticket safeguard
-- ============================================================

create or replace function public.fc_team_member_has_open_work(
  candidate uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fc_feedback_tickets
    where assigned_to = candidate
      and status in (
        'open',
        'assigned',
        'in_progress',
        'blocked'
      )
  );
$$;

-- ============================================================
-- FC Team member requests to leave
-- ============================================================

create or replace function public.request_fc_team_leave(
  leave_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_fc_team_member(auth.uid()) then
    raise exception 'Only an active FC Team member may request to leave';
  end if;

  if char_length(trim(coalesce(leave_reason, ''))) < 3 then
    raise exception 'Please provide a reason for leaving';
  end if;

  if char_length(trim(leave_reason)) > 2000 then
    raise exception 'The reason may not exceed 2000 characters';
  end if;

  if exists (
    select 1
    from public.fc_team_leave_requests
    where member_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'You already have a pending FC Team leave request';
  end if;

  insert into public.fc_team_leave_requests (
    member_id,
    reason
  )
  values (
    auth.uid(),
    trim(leave_reason)
  )
  returning id into leave_request_id;

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
    'fc_team_leave_requested',
    'fc_team_leave_request',
    leave_request_id,
    'FC Team leave request',
    'An active FC Team member has requested to leave the team and is awaiting administrative review.'
  from public.platform_roles role_record
  where role_record.role = 'admin'
    and role_record.revoked_at is null
    and role_record.user_id is distinct from auth.uid();

  return leave_request_id;
end;
$$;

-- ============================================================
-- Admin reviews member leave request
-- ============================================================

create or replace function public.respond_to_fc_team_leave_request(
  leave_request uuid,
  approve_request boolean,
  response_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.fc_team_leave_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may review FC Team leave requests';
  end if;

  select *
  into request_record
  from public.fc_team_leave_requests
  where id = leave_request
  for update;

  if request_record.id is null then
    raise exception 'FC Team leave request not found';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'This leave request has already been reviewed';
  end if;

  if approve_request
    and public.fc_team_member_has_open_work(
      request_record.member_id
    )
  then
    raise exception 'This member still has unresolved assigned feedback tickets. Reassign or complete them before approving the request';
  end if;

  if not approve_request
    and char_length(trim(coalesce(response_text, ''))) < 3
  then
    raise exception 'A reason is required when declining a leave request';
  end if;

  update public.fc_team_leave_requests
  set
    status = case
      when approve_request then 'approved'
      else 'declined'
    end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_response =
      nullif(trim(coalesce(response_text, '')), ''),
    updated_at = now()
  where id = leave_request;

  if approve_request then
    update public.fc_team_members
    set
      revoked_by = auth.uid(),
      revoked_at = now(),
      revocation_reason =
        'Member-requested departure: ' ||
        request_record.reason,
      updated_at = now()
    where user_id = request_record.member_id
      and revoked_at is null;
  end if;

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
    request_record.member_id,
    auth.uid(),
    case
      when approve_request
        then 'fc_team_leave_approved'
      else 'fc_team_leave_declined'
    end,
    'fc_team_leave_request',
    request_record.id,
    case
      when approve_request
        then 'FC Team leave request approved'
      else 'FC Team leave request declined'
    end,
    case
      when approve_request then
        'Your request to leave the FC Team has been approved. Your account has returned to standard member access.'
      else
        'Your request to leave the FC Team was declined. Review the administrator response on the FC Team page.'
    end
  );
end;
$$;

-- ============================================================
-- Direct administrator removal
-- ============================================================

create or replace function public.remove_fc_team_member(
  member uuid,
  removal_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may remove an FC Team member';
  end if;

  if member = auth.uid() then
    raise exception 'You cannot remove your own FC Team membership through this control';
  end if;

  if not public.is_fc_team_member(member) then
    raise exception 'This user is not an active FC Team member';
  end if;

  if char_length(trim(coalesce(removal_reason, ''))) < 3 then
    raise exception 'A removal justification is required';
  end if;

  if char_length(trim(removal_reason)) > 2000 then
    raise exception 'The removal justification may not exceed 2000 characters';
  end if;

  if public.fc_team_member_has_open_work(member) then
    raise exception 'This member still has unresolved assigned feedback tickets. Reassign or complete them before removal';
  end if;

  update public.fc_team_members
  set
    revoked_by = auth.uid(),
    revoked_at = now(),
    revocation_reason = trim(removal_reason),
    updated_at = now()
  where user_id = member
    and revoked_at is null;

  update public.fc_team_leave_requests
  set
    status = 'cancelled',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_response =
      'Membership ended through administrative removal.',
    updated_at = now()
  where member_id = member
    and status = 'pending';

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
    member,
    auth.uid(),
    'fc_team_removed',
    'fc_team_member',
    member,
    'FC Team membership ended',
    'Your FC Team membership has been ended by an administrator. Your account has returned to standard member access. Reason: ' ||
      trim(removal_reason)
  );
end;
$$;

-- ============================================================
-- Updated-at trigger
-- ============================================================

drop trigger if exists
  set_fc_team_leave_requests_updated_at
on public.fc_team_leave_requests;

create trigger set_fc_team_leave_requests_updated_at
before update on public.fc_team_leave_requests
for each row
execute function public.set_fc_feedback_updated_at();

-- ============================================================
-- Row-level security and permissions
-- ============================================================

alter table public.fc_team_leave_requests
enable row level security;

revoke all on table public.fc_team_leave_requests
from anon, authenticated;

grant select on table public.fc_team_leave_requests
to authenticated;

drop policy if exists
  "fc_team_leave_requests_read_relevant"
on public.fc_team_leave_requests;

create policy "fc_team_leave_requests_read_relevant"
on public.fc_team_leave_requests
for select
to authenticated
using (
  member_id = auth.uid()
  or public.has_platform_role(array['admin'])
);

revoke all on function
  public.fc_team_member_has_open_work(uuid)
from public, anon;

revoke all on function
  public.request_fc_team_leave(text)
from public, anon;

revoke all on function
  public.respond_to_fc_team_leave_request(
    uuid,
    boolean,
    text
  )
from public, anon;

revoke all on function
  public.remove_fc_team_member(uuid, text)
from public, anon;

grant execute on function
  public.fc_team_member_has_open_work(uuid)
to authenticated;

grant execute on function
  public.request_fc_team_leave(text)
to authenticated;

grant execute on function
  public.respond_to_fc_team_leave_request(
    uuid,
    boolean,
    text
  )
to authenticated;

grant execute on function
  public.remove_fc_team_member(uuid, text)
to authenticated;

-- Include leave requests in realtime updates.
do $$
begin
  alter publication supabase_realtime
    add table public.fc_team_leave_requests;
exception
  when duplicate_object then null;
end
$$;