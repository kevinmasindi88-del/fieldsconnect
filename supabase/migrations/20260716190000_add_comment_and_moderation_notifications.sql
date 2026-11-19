begin;

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

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
      'moderation_outcome'
    )
  );

alter table public.notifications
  drop constraint if exists notifications_entity_type_check;

alter table public.notifications
  add constraint notifications_entity_type_check
  check (
    entity_type in (
      'connection',
      'conversation',
      'message',
      'post',
      'comment',
      'moderation_ticket'
    )
  );

create unique index if not exists notifications_unique_moderation_report
  on public.notifications (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_report';

create unique index if not exists notifications_unique_moderation_assignment
  on public.notifications (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_assignment';

create unique index if not exists notifications_unique_moderation_outcome
  on public.notifications (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_outcome';

create or replace function public.notify_admins_of_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
begin
  for admin_record in
    select pr.user_id
    from public.platform_roles pr
    where pr.role = 'admin'
      and pr.revoked_at is null
  loop
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
      admin_record.user_id,
      null,
      'moderation_report',
      'moderation_ticket',
      new.id,
      'New moderation report',
      'A new '
      || replace(new.target_type, '_', ' ')
      || ' report requires review. Ticket: '
      || coalesce(new.ticket_number, new.id::text)
    )
    on conflict (
      recipient_id,
      notification_type,
      entity_type,
      entity_id
    )
    where notification_type = 'moderation_report'
    do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists reports_notify_admins_after_insert
on public.reports;

create trigger reports_notify_admins_after_insert
after insert on public.reports
for each row
execute function public.notify_admins_of_new_report();

create or replace function public.assign_moderation_ticket(
  report_id uuid,
  assignee_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  assignee_role text;
  ticket_record public.reports%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role <> 'admin' then
    raise exception 'Administrator access required';
  end if;

  select pr.role
  into assignee_role
  from public.platform_roles pr
  where pr.user_id = assignee_id
    and pr.revoked_at is null
    and pr.role in ('moderator', 'senior_moderator', 'admin');

  if assignee_role is null then
    raise exception 'Selected assignee is not an active moderation team member';
  end if;

  select *
  into ticket_record
  from public.reports
  where id = report_id
  for update;

  if ticket_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if ticket_record.status in ('actioned', 'dismissed') then
    raise exception 'Resolved tickets cannot be reassigned';
  end if;

  update public.reports
  set
    assigned_to = assignee_id,
    updated_at = now()
  where id = report_id;

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
    assignee_id,
    null,
    'moderation_assignment',
    'moderation_ticket',
    report_id,
    'New moderation ticket assigned',
    'You have been assigned '
    || coalesce(ticket_record.ticket_number, report_id::text)
    || ' concerning a '
    || replace(ticket_record.target_type, '_', ' ')
    || '.'
  )
  on conflict (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_assignment'
  do nothing;
end;
$$;

revoke all
on function public.assign_moderation_ticket(uuid, uuid)
from public, anon;

grant execute
on function public.assign_moderation_ticket(uuid, uuid)
to authenticated;

create or replace function public.assign_moderation_ticket_to_me(
  report_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  ticket_record public.reports%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('moderator', 'senior_moderator', 'admin') then
    raise exception 'Moderator access required';
  end if;

  select *
  into ticket_record
  from public.reports
  where id = report_id
  for update;

  if ticket_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if ticket_record.status in ('actioned', 'dismissed') then
    raise exception 'Resolved tickets cannot be assigned';
  end if;

  if ticket_record.assigned_to is not null
     and ticket_record.assigned_to <> auth.uid() then
    raise exception 'This ticket is already assigned to another moderator';
  end if;

  update public.reports
  set
    assigned_to = auth.uid(),
    updated_at = now()
  where id = report_id;

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
    'moderation_assignment',
    'moderation_ticket',
    report_id,
    'Moderation ticket assigned to you',
    'You are now assigned '
    || coalesce(ticket_record.ticket_number, report_id::text)
    || ' concerning a '
    || replace(ticket_record.target_type, '_', ' ')
    || '.'
  )
  on conflict (
    recipient_id,
    notification_type,
    entity_type,
    entity_id
  )
  where notification_type = 'moderation_assignment'
  do nothing;
end;
$$;

revoke all
on function public.assign_moderation_ticket_to_me(uuid)
from public, anon;

grant execute
on function public.assign_moderation_ticket_to_me(uuid)
to authenticated;

create or replace function public.notify_reporter_of_moderation_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  outcome_body text;
  ticket_reference text;
begin
  if new.status not in ('actioned', 'dismissed') then
    return new;
  end if;

  if old.status in ('actioned', 'dismissed') then
    return new;
  end if;

  if new.reporter_id is null then
    return new;
  end if;

  ticket_reference := coalesce(new.ticket_number, new.id::text);

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

drop trigger if exists reports_notify_reporter_after_resolution
on public.reports;

create trigger reports_notify_reporter_after_resolution
after update of status, resolution_action, closed_at
on public.reports
for each row
execute function public.notify_reporter_of_moderation_outcome();

commit;