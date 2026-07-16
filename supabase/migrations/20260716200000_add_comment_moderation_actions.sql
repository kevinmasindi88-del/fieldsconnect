create or replace function public.resolve_moderation_ticket(
  report_id uuid,
  resolution_action text,
  moderator_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  report_record public.reports%rowtype;
  post_record public.posts%rowtype;
  comment_record public.comments%rowtype;
  action_snapshot jsonb;
  notification_recipient uuid;
  target_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('moderator', 'senior_moderator', 'admin') then
    raise exception 'Moderator access required';
  end if;

  if resolution_action not in (
    'dismissed',
    'warned',
    'escalated',
    'redacted',
    'removed'
  ) then
    raise exception 'Unsupported moderation action';
  end if;

  select *
  into report_record
  from public.reports
  where id = report_id
  for update;

  if report_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if report_record.status in ('actioned', 'dismissed') then
    raise exception 'Moderation ticket is already resolved';
  end if;

  if report_record.assigned_to is not null
     and report_record.assigned_to <> auth.uid()
     and caller_role <> 'admin' then
    raise exception 'This ticket is assigned to another moderator';
  end if;

  if report_record.target_type = 'post' then
    select *
    into post_record
    from public.posts
    where id = report_record.target_id
    for update;

    if post_record.id is null then
      raise exception 'Reported post not found';
    end if;

    notification_recipient := post_record.author_id;
    target_label := 'post';

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

    if resolution_action = 'redacted' then
      update public.posts
      set
        body = '[This post was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        edited_at = now(),
        updated_at = now()
      where id = post_record.id;
    elsif resolution_action = 'removed' then
      update public.posts
      set
        deleted_at = now(),
        updated_at = now()
      where id = post_record.id;
    end if;

  elsif report_record.target_type = 'comment' then
    select *
    into comment_record
    from public.comments
    where id = report_record.target_id
    for update;

    if comment_record.id is null then
      raise exception 'Reported comment not found';
    end if;

    notification_recipient := comment_record.author_id;
    target_label := 'comment';

    action_snapshot := jsonb_build_object(
      'target_type', 'comment',
      'target_id', comment_record.id,
      'post_id', comment_record.post_id,
      'author_id', comment_record.author_id,
      'body', comment_record.body,
      'created_at', comment_record.created_at,
      'updated_at', comment_record.updated_at,
      'deleted_at', comment_record.deleted_at
    );

    if resolution_action = 'redacted' then
      update public.comments
      set
        body = '[This comment was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        updated_at = now()
      where id = comment_record.id;
    elsif resolution_action = 'removed' then
      update public.comments
      set
        deleted_at = now(),
        updated_at = now()
      where id = comment_record.id;
    end if;

  elsif resolution_action in ('redacted', 'removed') then
    raise exception 'Redaction and removal currently support posts and comments only';
  end if;

  insert into public.moderation_action_log (
    report_id,
    action,
    notes,
    performed_by,
    target_snapshot
  )
  values (
    report_id,
    resolution_action,
    nullif(trim(moderator_notes), ''),
    auth.uid(),
    action_snapshot
  );

  if resolution_action = 'dismissed' then
    update public.reports
    set
      status = 'dismissed',
      resolution_action = resolution_action,
      moderator_notes = nullif(trim(moderator_notes), ''),
      resolved_by = auth.uid(),
      resolved_at = now(),
      closed_at = now(),
      updated_at = now()
    where id = report_id;

  elsif resolution_action = 'escalated' then
    update public.reports
    set
      status = 'reviewing',
      resolution_action = resolution_action,
      moderator_notes = nullif(trim(moderator_notes), ''),
      escalated_by = auth.uid(),
      escalated_at = now(),
      updated_at = now()
    where id = report_id;

  else
    update public.reports
    set
      status = 'actioned',
      resolution_action = resolution_action,
      moderator_notes = nullif(trim(moderator_notes), ''),
      resolved_by = auth.uid(),
      resolved_at = now(),
      closed_at = now(),
      updated_at = now()
    where id = report_id;
  end if;

  if resolution_action = 'warned' and report_record.reported_user_id is not null then
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
      'moderation_warning',
      'moderation_ticket',
      report_id,
      'Warning from FCModerators',
      'FCModerators reviewed reported activity connected to your account and issued a warning. Please review the FieldsConnect Code of Conduct.'
    );
  elsif resolution_action in ('redacted', 'removed')
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
      'Content moderation action',
      'Your '
      || target_label
      || ' was '
      || case
           when resolution_action = 'redacted' then 'redacted'
           else 'removed'
         end
      || ' by FCModerators for violating the FieldsConnect Code of Conduct.'
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