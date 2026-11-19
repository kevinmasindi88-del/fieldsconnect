begin;

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
      'moderation_action'
    )
  );

alter table public.reports
  add column if not exists resolution_action text,
  add column if not exists moderator_notes text,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null,
  add column if not exists escalated_at timestamptz;

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
      'suspended'
    )
  );

create table if not exists public.moderation_action_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  action text not null check (
    action in (
      'dismissed',
      'warned',
      'escalated',
      'redacted',
      'removed',
      'suspended'
    )
  ),
  notes text not null,
  performed_by uuid not null references auth.users(id) on delete restrict,
  performed_at timestamptz not null default now()
);

alter table public.moderation_action_log
  add column if not exists target_snapshot jsonb;

create index if not exists moderation_action_log_report_idx
  on public.moderation_action_log(report_id, performed_at desc);

alter table public.moderation_action_log enable row level security;

revoke all on public.moderation_action_log from anon, authenticated;
grant select on public.moderation_action_log to authenticated;

drop policy if exists "moderation_team_read_action_log"
on public.moderation_action_log;

create policy "moderation_team_read_action_log"
on public.moderation_action_log
for select
to authenticated
using (
  public.has_platform_role(
    array['moderator', 'senior_moderator', 'admin']
  )
);

create or replace function public.resolve_moderation_ticket(
  report_id uuid,
  moderation_action text,
  action_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  ticket_record public.reports%rowtype;
  post_record public.posts%rowtype;
  next_status text;
  notification_recipient uuid;
  action_snapshot jsonb;
  is_final_action boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in (
    'moderator',
    'senior_moderator',
    'admin'
  ) then
    raise exception 'Moderator access required';
  end if;

  if moderation_action not in (
    'dismissed',
    'warned',
    'escalated',
    'redacted',
    'removed'
  ) then
    raise exception 'Unsupported moderation action';
  end if;

  if char_length(trim(coalesce(action_notes, ''))) < 10 then
    raise exception 'Moderator notes must contain at least 10 characters';
  end if;

  select *
  into ticket_record
  from public.reports
  where id = report_id
  for update;

  if ticket_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if caller_role = 'moderator'
     and ticket_record.assigned_to is distinct from auth.uid() then
    raise exception 'This ticket must be assigned to you before you can action it';
  end if;

  if ticket_record.status in ('actioned', 'dismissed') then
    raise exception 'This ticket has already been resolved';
  end if;

  notification_recipient := ticket_record.reported_user_id;
  action_snapshot := null;

  if moderation_action in ('redacted', 'removed') then
    if ticket_record.target_type <> 'post' then
      raise exception 'This moderation action currently supports posts only';
    end if;

    if ticket_record.target_id is null then
      raise exception 'The moderation ticket has no target post';
    end if;

    select *
    into post_record
    from public.posts
    where id = ticket_record.target_id
    for update;

    if post_record.id is null then
      raise exception 'Reported post not found';
    end if;

    if post_record.deleted_at is not null then
      raise exception 'The reported post has already been removed';
    end if;

    notification_recipient := post_record.author_id;

    action_snapshot := jsonb_build_object(
      'target_type', 'post',
      'target_id', post_record.id,
      'author_id', post_record.author_id,
      'body', post_record.body,
      'visibility', post_record.visibility,
      'created_at', post_record.created_at,
      'updated_at', post_record.updated_at,
      'edited_at', post_record.edited_at,
      'deleted_at', post_record.deleted_at
    );

    if moderation_action = 'redacted' then
      update public.posts
      set
        body = '[This post was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        edited_at = now(),
        updated_at = now()
      where id = post_record.id;
    end if;

    if moderation_action = 'removed' then
      update public.posts
      set
        deleted_at = now(),
        updated_at = now()
      where id = post_record.id;
    end if;
  end if;

  next_status := case
    when moderation_action = 'dismissed' then 'dismissed'
    when moderation_action = 'escalated' then 'reviewing'
    else 'actioned'
  end;

  is_final_action := moderation_action in (
    'dismissed',
    'warned',
    'redacted',
    'removed'
  );

  update public.reports
  set
    status = next_status,
    resolution_action = moderation_action,
    moderator_notes = trim(action_notes),

    resolved_by = case
      when is_final_action then auth.uid()
      else null
    end,

    resolved_at = case
      when is_final_action then now()
      else null
    end,

    closed_at = case
      when is_final_action then now()
      else null
    end,

    escalated_by = case
      when moderation_action = 'escalated' then auth.uid()
      else escalated_by
    end,

    escalated_at = case
      when moderation_action = 'escalated' then now()
      else escalated_at
    end,

    updated_at = now()
  where id = report_id;

  insert into public.moderation_action_log (
    report_id,
    action,
    notes,
    performed_by,
    target_snapshot
  )
  values (
    report_id,
    moderation_action,
    trim(action_notes),
    auth.uid(),
    action_snapshot
  );

  if moderation_action = 'warned'
     and notification_recipient is not null then
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
      notification_recipient,
      null,
      'moderation_warning',
      'moderation_ticket',
      report_id,
      'Message from FCModerators',
      'Your content was reviewed and found to breach the FieldsConnect Code of Conduct. '
      || 'Please review the Code of Conduct and avoid similar violations. Reference: '
      || coalesce(ticket_record.ticket_number, report_id::text)
    );
  end if;

  if moderation_action = 'redacted'
     and notification_recipient is not null then
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
      notification_recipient,
      null,
      'moderation_action',
      'moderation_ticket',
      report_id,
      'Your post was redacted',
      'FCModerators reviewed your post and redacted its content because it breached the FieldsConnect Code of Conduct. Reference: '
      || coalesce(ticket_record.ticket_number, report_id::text)
    );
  end if;

  if moderation_action = 'removed'
     and notification_recipient is not null then
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
      notification_recipient,
      null,
      'moderation_action',
      'moderation_ticket',
      report_id,
      'Your post was removed',
      'FCModerators reviewed your post and removed it because it breached the FieldsConnect Code of Conduct. Reference: '
      || coalesce(ticket_record.ticket_number, report_id::text)
    );
  end if;
end;
$$;

revoke all
on function public.resolve_moderation_ticket(uuid, text, text)
from public, anon;

grant execute
on function public.resolve_moderation_ticket(uuid, text, text)
to authenticated;

commit;