-- FieldsConnect account-suspension workflow.
-- Includes senior escalation, 10/30-day suspensions, early lifting,
-- notifications, audit records and platform-wide write enforcement.

begin;

-- ============================================================
-- Notification types
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
      and pg_get_constraintdef(oid) ilike '%notification_type%'
  loop
    execute format(
      'alter table public.notifications drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.notifications
add constraint notifications_notification_type_check
check (
  notification_type in (
    'connection_request',
    'connection_accepted',
    'new_message',
    'post_liked',
    'post_commented',
    'comment_liked',
    'moderation_warning',
    'moderation_action',
    'moderation_report',
    'moderation_assignment',
    'moderation_outcome',
    'moderation_escalation',
    'account_suspension',
    'suspension_revoked'
  )
);

-- ============================================================
-- Suspension records
-- ============================================================

create table if not exists public.account_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  report_id uuid not null
    references public.reports(id)
    on delete restrict,
  duration_days integer not null
    check (duration_days in (10, 30)),
  reason text not null
    check (char_length(trim(reason)) >= 10),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  imposed_by uuid not null
    references auth.users(id)
    on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid
    references auth.users(id)
    on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),

  constraint account_suspensions_end_after_start
    check (ends_at > starts_at),

  constraint account_suspensions_revocation_complete
    check (
      (
        revoked_at is null
        and revoked_by is null
        and revocation_reason is null
      )
      or
      (
        revoked_at is not null
        and revoked_by is not null
        and char_length(trim(revocation_reason)) >= 10
      )
    )
);

create index if not exists account_suspensions_user_idx
on public.account_suspensions(user_id, created_at desc);

create index if not exists account_suspensions_report_idx
on public.account_suspensions(report_id, created_at desc);

create unique index if not exists account_suspensions_one_per_report_idx
on public.account_suspensions(report_id);

create index if not exists account_suspensions_active_user_idx
on public.account_suspensions(user_id, ends_at)
where revoked_at is null;

alter table public.account_suspensions enable row level security;

drop policy if exists "account_suspensions_select_senior_team"
on public.account_suspensions;

create policy "account_suspensions_select_senior_team"
on public.account_suspensions
for select
to authenticated
using (
  public.current_platform_role()
    in ('senior_moderator', 'admin')
);

drop policy if exists "account_suspensions_select_own"
on public.account_suspensions;

create policy "account_suspensions_select_own"
on public.account_suspensions
for select
to authenticated
using (user_id = auth.uid());

grant select
on public.account_suspensions
to authenticated;

-- ============================================================
-- Active-suspension checks
-- ============================================================

create or replace function public.is_account_suspended(
  user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_suspensions suspension
    where suspension.user_id = is_account_suspended.user_id
      and suspension.revoked_at is null
      and suspension.starts_at <= now()
      and suspension.ends_at > now()
  );
$$;

create or replace function public.get_my_active_suspension()
returns table (
  suspension_id uuid,
  report_id uuid,
  duration_days integer,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    suspension.id,
    suspension.report_id,
    suspension.duration_days,
    suspension.reason,
    suspension.starts_at,
    suspension.ends_at
  from public.account_suspensions suspension
  where suspension.user_id = auth.uid()
    and suspension.revoked_at is null
    and suspension.starts_at <= now()
    and suspension.ends_at > now()
  order by suspension.starts_at desc
  limit 1;
$$;

revoke all
on function public.is_account_suspended(uuid)
from public, anon;

grant execute
on function public.is_account_suspended(uuid)
to authenticated;

revoke all
on function public.get_my_active_suspension()
from public, anon;

grant execute
on function public.get_my_active_suspension()
to authenticated;

-- ============================================================
-- Escalation notification
-- ============================================================

create or replace function public.notify_senior_team_of_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    new.status = 'reviewing'
    and new.resolution_action = 'escalated'
    and (
      old.status is distinct from new.status
      or old.resolution_action is distinct from new.resolution_action
      or old.escalated_at is distinct from new.escalated_at
    )
  then
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
      'moderation_escalation',
      'moderation_ticket',
      new.id,
      'Moderation ticket escalated',
      'A moderation ticket requires senior review and possible account-level action.'
    from public.platform_roles role_record
    where role_record.role in ('senior_moderator', 'admin')
      and role_record.revoked_at is null
      and role_record.user_id is distinct from auth.uid()
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_notify_senior_team_of_escalation
on public.reports;

create trigger reports_notify_senior_team_of_escalation
after update of status, resolution_action, escalated_at
on public.reports
for each row
execute function public.notify_senior_team_of_escalation();

create unique index if not exists
notifications_unique_moderation_escalation_idx
on public.notifications(
  recipient_id,
  notification_type,
  entity_type,
  entity_id
)
where notification_type = 'moderation_escalation';

-- ============================================================
-- Impose suspension
-- ============================================================

create or replace function public.suspend_account_for_ticket(
  report_id uuid,
  suspension_days integer,
  suspension_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller_role text := public.current_platform_role();
  report_record public.reports%rowtype;
  suspension_record public.account_suspensions%rowtype;
  v_suspension_reason text :=
    trim(coalesce(suspension_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('senior_moderator', 'admin') then
    raise exception
      'Only senior moderators and administrators may suspend accounts';
  end if;

  if suspension_days not in (10, 30) then
    raise exception
      'Suspension duration must be either 10 or 30 days';
  end if;

  if char_length(v_suspension_reason) < 10 then
    raise exception
      'Suspension reason must contain at least 10 characters';
  end if;

  select report.*
  into report_record
  from public.reports report
  where report.id = suspend_account_for_ticket.report_id
  for update;

  if report_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if
    report_record.status <> 'reviewing'
    or report_record.resolution_action <> 'escalated'
  then
    raise exception
      'This ticket must be escalated and under review before suspension';
  end if;

  if report_record.reported_user_id is null then
    raise exception
      'The reported account could not be determined';
  end if;

  if report_record.reported_user_id = auth.uid() then
    raise exception 'You cannot suspend your own account';
  end if;

  if public.is_account_suspended(report_record.reported_user_id) then
    raise exception 'This account already has an active suspension';
  end if;

  insert into public.account_suspensions (
    user_id,
    report_id,
    duration_days,
    reason,
    starts_at,
    ends_at,
    imposed_by
  )
  values (
    report_record.reported_user_id,
    report_record.id,
    suspension_days,
    v_suspension_reason,
    now(),
    now() + make_interval(days => suspension_days),
    auth.uid()
  )
  returning *
  into suspension_record;

  insert into public.moderation_action_log (
    report_id,
    action,
    notes,
    performed_by,
    target_snapshot
  )
  values (
    report_record.id,
    'suspended',
    v_suspension_reason,
    auth.uid(),
    jsonb_build_object(
      'target_type', report_record.target_type,
      'target_id', report_record.target_id,
      'reported_user_id', report_record.reported_user_id,
      'suspension_id', suspension_record.id,
      'duration_days', suspension_days,
      'starts_at', suspension_record.starts_at,
      'ends_at', suspension_record.ends_at
    )
  );

  update public.reports report
  set
    status = 'actioned',
    resolution_action = 'suspended',
    resolution_notes = v_suspension_reason,
    resolved_by = auth.uid(),
    resolved_at = now(),
    closed_at = now(),
    updated_at = now()
  where report.id = report_record.id;

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
    report_record.reported_user_id,
    null,
    'account_suspension',
    'moderation_ticket',
    report_record.id,
    format(
      'FieldsConnect account suspended for %s days',
      suspension_days
    ),
    format(
      'Your FieldsConnect account is suspended from %s until %s. Reason: %s',
      to_char(
        suspension_record.starts_at at time zone 'Africa/Johannesburg',
        'DD Mon YYYY HH24:MI'
      ),
      to_char(
        suspension_record.ends_at at time zone 'Africa/Johannesburg',
        'DD Mon YYYY HH24:MI'
      ),
      v_suspension_reason
    )
  );

  return suspension_record.id;
end;
$function$;

revoke all
on function public.suspend_account_for_ticket(uuid, integer, text)
from public, anon;

grant execute
on function public.suspend_account_for_ticket(uuid, integer, text)
to authenticated;

-- ============================================================
-- Early suspension lifting
-- ============================================================

create or replace function public.revoke_account_suspension(
  suspension_id uuid,
  revocation_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller_role text := public.current_platform_role();
  suspension_record public.account_suspensions%rowtype;
  v_revocation_reason text :=
    trim(coalesce(revocation_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('senior_moderator', 'admin') then
    raise exception
      'Only senior moderators and administrators may revoke suspensions';
  end if;

  if char_length(v_revocation_reason) < 10 then
    raise exception
      'Revocation reason must contain at least 10 characters';
  end if;

  select suspension.*
  into suspension_record
  from public.account_suspensions suspension
  where suspension.id =
    revoke_account_suspension.suspension_id
  for update;

  if suspension_record.id is null then
    raise exception 'Suspension not found';
  end if;

  if suspension_record.revoked_at is not null then
    raise exception 'This suspension has already been revoked';
  end if;

  if suspension_record.ends_at <= now() then
    raise exception 'This suspension has already expired';
  end if;

  update public.account_suspensions suspension
  set
    revoked_at = now(),
    revoked_by = auth.uid(),
    revocation_reason = v_revocation_reason
  where suspension.id = suspension_record.id;

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'account_suspension_revoked',
    'profile',
    suspension_record.user_id,
    jsonb_build_object(
      'suspension_id', suspension_record.id,
      'report_id', suspension_record.report_id,
      'original_ends_at', suspension_record.ends_at,
      'reason', v_revocation_reason
    )
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
    suspension_record.user_id,
    null,
    'suspension_revoked',
    'moderation_ticket',
    suspension_record.report_id,
    'FieldsConnect suspension ended early',
    'Your FieldsConnect account suspension has been revoked following a senior review. You may resume normal platform activity.'
  );
end;
$function$;

revoke all
on function public.revoke_account_suspension(uuid, text)
from public, anon;

grant execute
on function public.revoke_account_suspension(uuid, text)
to authenticated;

-- ============================================================
-- Database write enforcement
-- ============================================================

create or replace function public.block_suspended_account_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if public.is_account_suspended(auth.uid()) then
    raise exception
      'Your FieldsConnect account is currently suspended. Platform activity is unavailable until the suspension ends.';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all
on function public.block_suspended_account_writes()
from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'profile_interests',
    'skills',
    'posts',
    'comments',
    'reactions',
    'comment_reactions',
    'connections',
    'conversations',
    'conversation_members',
    'messages',
    'blocks',
    'reports',
    'library_documents'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_block_suspended_writes',
      table_name
    );

    execute format(
      'create trigger %I
       before insert or update or delete
       on public.%I
       for each row
       execute function public.block_suspended_account_writes()',
      table_name || '_block_suspended_writes',
      table_name
    );
  end loop;
end;
$$;

-- ============================================================
-- Storage enforcement
-- ============================================================

drop policy if exists "library_storage_insert_own_folder"
on storage.objects;

create policy "library_storage_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "library_storage_update_own_folder"
on storage.objects;

create policy "library_storage_update_own_folder"
on storage.objects
for update
to authenticated
using (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "library_storage_delete_own_folder"
on storage.objects;

create policy "library_storage_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatar_storage_insert_own_folder"
on storage.objects;

create policy "profile_avatar_storage_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatar_storage_update_own_folder"
on storage.objects;

create policy "profile_avatar_storage_update_own_folder"
on storage.objects
for update
to authenticated
using (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatar_storage_delete_own_folder"
on storage.objects;

create policy "profile_avatar_storage_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  not public.is_account_suspended(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

notify pgrst, 'reload schema';