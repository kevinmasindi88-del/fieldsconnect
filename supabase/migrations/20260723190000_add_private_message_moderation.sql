begin;

create or replace function public.get_moderation_message_context(
  report_id uuid
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  created_at timestamptz,
  is_reported_message boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller_role text := public.current_platform_role();
  report_record public.reports%rowtype;
  reported_message public.messages%rowtype;
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

  select *
  into report_record
  from public.reports
  where id = report_id;

  if report_record.id is null then
    raise exception 'Moderation ticket not found';
  end if;

  if report_record.target_type <> 'message' then
    raise exception 'This ticket does not concern a message';
  end if;

  if report_record.status not in ('open', 'reviewing') then
    raise exception 'Message evidence is no longer available';
  end if;

  if report_record.assigned_to is distinct from auth.uid()
     and not (
       caller_role = 'admin'
       and report_record.assigned_to is null
     ) then
    raise exception 'This ticket is not assigned to you';
  end if;

  select *
  into reported_message
  from public.messages
  where id = report_record.target_id;

  if reported_message.id is null then
    raise exception 'Reported message not found';
  end if;

  return query
  select
    context.message_id,
    context.conversation_id,
    context.sender_id,
    context.sender_name,
    context.body,
    context.created_at,
    context.is_reported_message
  from (
    select
      m.id as message_id,
      m.conversation_id,
      m.sender_id,
      coalesce(
        nullif(trim(p.display_name), ''),
        'FieldsConnect user'
      ) as sender_name,
      m.body,
      m.created_at,
      m.id = reported_message.id as is_reported_message
    from public.messages m
    left join public.profiles p
      on p.id = m.sender_id
    where m.conversation_id = reported_message.conversation_id
      and (
        m.created_at < reported_message.created_at
        or m.id = reported_message.id
      )
      and (
        m.deleted_at is null
        or m.id = reported_message.id
      )
    order by
      m.created_at desc,
      m.id desc
    limit 11
  ) context
  order by
    context.created_at asc,
    context.message_id asc;
end;
$function$;

revoke all
on function public.get_moderation_message_context(uuid)
from public, anon;

grant execute
on function public.get_moderation_message_context(uuid)
to authenticated;

create or replace function public.resolve_moderation_ticket(
  report_id uuid,
  moderation_action text,
  action_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  requested_action text := moderation_action;
  requested_notes text := nullif(trim(action_notes), '');
  caller_role text := public.current_platform_role();

  report_record public.reports%rowtype;
  post_record public.posts%rowtype;
  comment_record public.comments%rowtype;
  library_record public.library_documents%rowtype;
  message_record public.messages%rowtype;

  action_snapshot jsonb;
  notification_recipient uuid;
  target_label text;

  conversation_partner_name text;
  warning_context text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if caller_role not in ('moderator', 'senior_moderator', 'admin') then
    raise exception 'Moderator access required';
  end if;

  if requested_action not in (
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

    warning_context :=
      'FCModerators reviewed a post published from your account on '
      || to_char(
           post_record.created_at at time zone 'Africa/Johannesburg',
           'DD Mon YYYY at HH24:MI'
         )
      || '. The concern reviewed was: '
      || coalesce(report_record.reason, 'Reported conduct')
      || '.';

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

    if requested_action = 'redacted' then
      update public.posts
      set
        body = '[This post was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        edited_at = now(),
        updated_at = now()
      where id = post_record.id;

    elsif requested_action = 'removed' then
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

    warning_context :=
      'FCModerators reviewed a comment published from your account on '
      || to_char(
           comment_record.created_at at time zone 'Africa/Johannesburg',
           'DD Mon YYYY at HH24:MI'
         )
      || '. The concern reviewed was: '
      || coalesce(report_record.reason, 'Reported conduct')
      || '.';

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

    if requested_action = 'redacted' then
      update public.comments
      set
        body = '[This comment was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        updated_at = now()
      where id = comment_record.id;

    elsif requested_action = 'removed' then
      update public.comments
      set
        deleted_at = now(),
        updated_at = now()
      where id = comment_record.id;
    end if;

  elsif report_record.target_type = 'library_document' then
    select *
    into library_record
    from public.library_documents
    where id = report_record.target_id
    for update;

    if library_record.id is null then
      raise exception 'Reported library resource not found';
    end if;

    notification_recipient := library_record.owner_id;
    target_label := 'library resource';

    warning_context :=
      'FCModerators reviewed your library resource titled "'
      || library_record.title
      || '". The concern reviewed was: '
      || coalesce(report_record.reason, 'Reported conduct')
      || '.';

    action_snapshot := jsonb_build_object(
      'target_type', 'library_document',
      'target_id', library_record.id,
      'owner_id', library_record.owner_id,
      'title', library_record.title,
      'description', library_record.description,
      'file_name', library_record.file_name,
      'file_size_bytes', library_record.file_size_bytes,
      'mime_type', library_record.mime_type,
      'storage_bucket', library_record.storage_bucket,
      'storage_path', library_record.storage_path,
      'visibility', library_record.visibility,
      'is_published', library_record.is_published,
      'created_at', library_record.created_at,
      'updated_at', library_record.updated_at,
      'deleted_at', library_record.deleted_at
    );

    if requested_action = 'redacted' then
      update public.library_documents
      set
        title = '[Resource redacted by FCModerators]',
        description =
          '[This resource was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        is_published = false,
        visibility = 'connections',
        updated_at = now()
      where id = library_record.id;

    elsif requested_action = 'removed' then
      update public.library_documents
      set
        is_published = false,
        deleted_at = now(),
        updated_at = now()
      where id = library_record.id;
    end if;

  elsif report_record.target_type = 'message' then
    select *
    into message_record
    from public.messages
    where id = report_record.target_id
    for update;

    if message_record.id is null then
      raise exception 'Reported message not found';
    end if;

    notification_recipient := message_record.sender_id;
    target_label := 'message';

    select coalesce(
      nullif(trim(p.display_name), ''),
      'another FieldsConnect user'
    )
    into conversation_partner_name
    from public.conversation_members cm
    left join public.profiles p
      on p.id = cm.profile_id
    where cm.conversation_id = message_record.conversation_id
      and cm.profile_id <> message_record.sender_id
    order by cm.created_at asc
    limit 1;

    conversation_partner_name :=
      coalesce(conversation_partner_name, 'another FieldsConnect user');

    warning_context :=
      'FCModerators reviewed a message you sent in your conversation with '
      || conversation_partner_name
      || ' on '
      || to_char(
           message_record.created_at at time zone 'Africa/Johannesburg',
           'DD Mon YYYY at HH24:MI'
         )
      || '. The concern reviewed was: '
      || coalesce(report_record.reason, 'Reported conduct')
      || '.';

    action_snapshot := jsonb_build_object(
      'target_type', 'message',
      'target_id', message_record.id,
      'conversation_id', message_record.conversation_id,
      'sender_id', message_record.sender_id,
      'body', message_record.body,
      'created_at', message_record.created_at,
      'updated_at', message_record.updated_at,
      'deleted_at', message_record.deleted_at
    );

    if requested_action = 'redacted' then
      update public.messages
      set
        body = '[This message was redacted by FCModerators for violating the FieldsConnect Code of Conduct.]',
        updated_at = now()
      where id = message_record.id;

    elsif requested_action = 'removed' then
      update public.messages
      set
        deleted_at = now(),
        updated_at = now()
      where id = message_record.id;
    end if;

  elsif requested_action in ('redacted', 'removed') then
    raise exception
      'Redaction and removal currently support posts, comments, library resources, and messages only';
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
    requested_action,
    requested_notes,
    auth.uid(),
    action_snapshot
  );

  if requested_action = 'dismissed' then
    update public.reports
    set
      status = 'dismissed',
      resolution_action = requested_action,
      moderator_notes = requested_notes,
      resolved_by = auth.uid(),
      resolved_at = now(),
      closed_at = now(),
      updated_at = now()
    where id = report_id;

  elsif requested_action = 'escalated' then
    update public.reports
    set
      status = 'reviewing',
      resolution_action = requested_action,
      moderator_notes = requested_notes,
      escalated_by = auth.uid(),
      escalated_at = now(),
      updated_at = now()
    where id = report_id;

  else
    update public.reports
    set
      status = 'actioned',
      resolution_action = requested_action,
      moderator_notes = requested_notes,
      resolved_by = auth.uid(),
      resolved_at = now(),
      closed_at = now(),
      updated_at = now()
    where id = report_id;
  end if;

  if requested_action = 'warned'
     and report_record.reported_user_id is not null then

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
      coalesce(
        warning_context,
        'FCModerators reviewed reported activity connected to your account.'
      )
      || ' A warning was issued. Please ensure that your future activity complies with the FieldsConnect Code of Conduct.'
    );

  elsif requested_action in ('redacted', 'removed')
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
           when requested_action = 'redacted' then 'redacted'
           else 'removed'
         end
      || ' by FCModerators for violating the FieldsConnect Code of Conduct.'
    );
  end if;
end;
$function$;

revoke all
on function public.resolve_moderation_ticket(uuid, text, text)
from public, anon;

grant execute
on function public.resolve_moderation_ticket(uuid, text, text)
to authenticated;

commit;