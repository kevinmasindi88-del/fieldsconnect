-- Consolidate multiple reports about the same moderation target while
-- preserving every original ticket, reporter and audit entry.

begin;

alter table public.reports
  add column if not exists consolidated_into_report_id uuid
    references public.reports(id) on delete restrict,
  add column if not exists consolidated_at timestamptz,
  add column if not exists consolidated_by uuid
    references auth.users(id) on delete set null;

create index if not exists reports_consolidated_into_idx
  on public.reports(consolidated_into_report_id)
  where consolidated_into_report_id is not null;

alter table public.reports
  drop constraint if exists reports_resolution_action_check;

alter table public.reports
  add constraint reports_resolution_action_check
  check (
    resolution_action is null
    or resolution_action in (
      'dismissed',
      'warned',
      'escalated',
      'redacted',
      'removed',
      'suspended',
      'consolidated'
    )
  );

alter table public.moderation_action_log
  drop constraint if exists moderation_action_log_action_check;

alter table public.moderation_action_log
  add constraint moderation_action_log_action_check
  check (
    action in (
      'dismissed',
      'warned',
      'escalated',
      'redacted',
      'removed',
      'suspended',
      'consolidated'
    )
  );

create or replace function public.consolidate_moderation_ticket(
  secondary_report_id uuid,
  primary_report_id uuid,
  consolidation_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  secondary_ticket public.reports%rowtype;
  primary_ticket public.reports%rowtype;
  notes_value text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('senior_moderator', 'admin') then
    raise exception 'Senior moderator or administrator access required';
  end if;

  if secondary_report_id is null or primary_report_id is null then
    raise exception 'Both secondary and primary ticket IDs are required';
  end if;

  if secondary_report_id = primary_report_id then
    raise exception 'A ticket cannot be consolidated into itself';
  end if;

  notes_value := trim(coalesce(consolidation_notes, ''));

  if char_length(notes_value) < 5 then
    raise exception 'Provide a consolidation reason of at least 5 characters';
  end if;

  select *
  into primary_ticket
  from public.reports
  where id = primary_report_id
  for update;

  if primary_ticket.id is null then
    raise exception 'Primary moderation ticket not found';
  end if;

  select *
  into secondary_ticket
  from public.reports
  where id = secondary_report_id
  for update;

  if secondary_ticket.id is null then
    raise exception 'Secondary moderation ticket not found';
  end if;

  if primary_ticket.consolidated_into_report_id is not null then
    raise exception 'The selected primary ticket is already consolidated into another ticket';
  end if;

  if secondary_ticket.consolidated_into_report_id is not null then
    raise exception 'The selected secondary ticket has already been consolidated';
  end if;

  if primary_ticket.status in ('actioned', 'dismissed') then
    raise exception 'A resolved ticket cannot be used as the primary active case';
  end if;

  if secondary_ticket.status in ('actioned', 'dismissed') then
    raise exception 'Resolved tickets cannot be consolidated';
  end if;

  if primary_ticket.target_type <> secondary_ticket.target_type
     or primary_ticket.target_id <> secondary_ticket.target_id then
    raise exception 'Only reports concerning the same target can be consolidated';
  end if;

  update public.reports
  set
    status = 'dismissed',
    resolution_action = 'consolidated',
    moderator_notes = notes_value,
    resolved_by = auth.uid(),
    resolved_at = now(),
    closed_at = now(),
    consolidated_into_report_id = primary_report_id,
    consolidated_at = now(),
    consolidated_by = auth.uid(),
    updated_at = now()
  where id = secondary_report_id;

  insert into public.moderation_action_log (
    report_id,
    action,
    notes,
    performed_by,
    target_snapshot
  )
  values (
    secondary_report_id,
    'consolidated',
    notes_value,
    auth.uid(),
    jsonb_build_object(
      'primary_report_id', primary_report_id,
      'primary_ticket_number', primary_ticket.ticket_number,
      'secondary_report_id', secondary_report_id,
      'secondary_ticket_number', secondary_ticket.ticket_number,
      'target_type', secondary_ticket.target_type,
      'target_id', secondary_ticket.target_id
    )
  );

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'moderation_ticket_consolidated',
    'moderation_ticket',
    secondary_report_id,
    jsonb_build_object(
      'primary_report_id', primary_report_id,
      'primary_ticket_number', primary_ticket.ticket_number,
      'secondary_ticket_number', secondary_ticket.ticket_number,
      'notes', notes_value
    )
  );
end;
$$;

revoke all
on function public.consolidate_moderation_ticket(uuid, uuid, text)
from public, anon;

grant execute
on function public.consolidate_moderation_ticket(uuid, uuid, text)
to authenticated;

create or replace function public.notify_reporter_of_moderation_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_reference text;
  primary_ticket_reference text;
  outcome_body text;
begin
  if new.reporter_id is null then
    return new;
  end if;

  if new.status not in ('actioned', 'dismissed')
     or new.closed_at is null
     or new.resolution_action is null then
    return new;
  end if;

  if old.status in ('actioned', 'dismissed')
     and old.closed_at is not null then
    return new;
  end if;

  ticket_reference := coalesce(new.ticket_number, new.id::text);

  if new.resolution_action = 'consolidated'
     and new.consolidated_into_report_id is not null then
    select coalesce(ticket_number, id::text)
    into primary_ticket_reference
    from public.reports
    where id = new.consolidated_into_report_id;
  end if;

  outcome_body := case new.resolution_action
    when 'dismissed' then
      'FCModerators reviewed your report and did not find sufficient grounds for enforcement. The ticket has been closed. Reference: '
      || ticket_reference
    when 'warned' then
      'FCModerators reviewed your report and issued a warning to the reported user. The ticket has been closed. Reference: '
      || ticket_reference
    when 'redacted' then
      'FCModerators reviewed your report and redacted the reported content. The ticket has been closed. Reference: '
      || ticket_reference
    when 'removed' then
      'FCModerators reviewed your report and removed the reported content. The ticket has been closed. Reference: '
      || ticket_reference
    when 'suspended' then
      'FCModerators reviewed your report and applied an account suspension. The ticket has been closed. Reference: '
      || ticket_reference
    when 'consolidated' then
      'Your report concerns the same item as another active moderation case. It has been linked to the primary case so the reports can be reviewed together. Your original report remains recorded. Primary reference: '
      || coalesce(primary_ticket_reference, ticket_reference)
    else
      'FCModerators reviewed your report and completed the moderation process. The ticket has been closed. Reference: '
      || ticket_reference
  end;

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
    new.reporter_id,
    null,
    'moderation_outcome',
    'moderation_ticket',
    new.id,
    'Update on your moderation report',
    outcome_body
  )
  on conflict (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_outcome'
  do nothing;

  return new;
end;
$$;

commit;