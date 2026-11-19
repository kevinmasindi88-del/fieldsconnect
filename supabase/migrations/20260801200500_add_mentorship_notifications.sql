-- Add transactional notifications for mentorship request activity.

begin;

create or replace function
public.notify_mentorship_request_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  acting_user_id uuid;
  notification_recipient_id uuid;
  actor_name text;
  next_notification_type text;
  next_title text;
  next_body text;
begin
  acting_user_id := auth.uid();

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      return new;
    end if;

    notification_recipient_id := new.mentor_id;
    acting_user_id := new.mentee_id;
    next_notification_type := 'mentorship_request';
    next_title := 'New mentorship request';

    select profile.display_name
    into actor_name
    from public.profiles profile
    where profile.id = new.mentee_id;

    next_body :=
      coalesce(actor_name, 'Someone')
      || ' requested mentorship in '
      || new.mentorship_field
      || '.';
  elsif tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;

    if new.status = 'change_proposed' then
      notification_recipient_id := new.mentee_id;
      acting_user_id := new.mentor_id;
      next_notification_type :=
        'mentorship_change_proposed';
      next_title := 'Mentorship changes proposed';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = new.mentor_id;

      next_body :=
        coalesce(actor_name, 'Your requested mentor')
        || ' proposed changes to your mentorship request.';
    elsif new.status = 'accepted' then
      if acting_user_id = new.mentee_id then
        notification_recipient_id := new.mentor_id;
      else
        notification_recipient_id := new.mentee_id;
        acting_user_id := new.mentor_id;
      end if;

      next_notification_type :=
        'mentorship_accepted';
      next_title := 'Mentorship request accepted';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = acting_user_id;

      next_body :=
        coalesce(actor_name, 'Someone')
        || ' accepted the mentorship request.';
    elsif new.status = 'declined' then
      if acting_user_id = new.mentee_id then
        notification_recipient_id := new.mentor_id;
      else
        notification_recipient_id := new.mentee_id;
        acting_user_id := new.mentor_id;
      end if;

      next_notification_type :=
        'mentorship_declined';
      next_title := 'Mentorship request declined';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = acting_user_id;

      next_body :=
        coalesce(actor_name, 'Someone')
        || ' declined the mentorship request.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if notification_recipient_id is null
    or notification_recipient_id =
      acting_user_id then
    return new;
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
    notification_recipient_id,
    acting_user_id,
    next_notification_type,
    'mentorship_request',
    new.id,
    next_title,
    next_body
  );

  return new;
end;
$function$;

drop trigger if exists
mentorship_requests_notify_on_insert
on public.mentorship_requests;

create trigger
mentorship_requests_notify_on_insert
after insert
on public.mentorship_requests
for each row
execute function
public.notify_mentorship_request_activity();

drop trigger if exists
mentorship_requests_notify_on_status_change
on public.mentorship_requests;

create trigger
mentorship_requests_notify_on_status_change
after update of status
on public.mentorship_requests
for each row
when (
  old.status is distinct from new.status
)
execute function
public.notify_mentorship_request_activity();

revoke all
on function
public.notify_mentorship_request_activity()
from public, anon, authenticated;

-- Backfill notifications for pending requests created before this trigger.
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
  request.mentor_id,
  request.mentee_id,
  'mentorship_request',
  'mentorship_request',
  request.id,
  'New mentorship request',
  coalesce(mentee.display_name, 'Someone')
    || ' requested mentorship in '
    || request.mentorship_field
    || '.'
from public.mentorship_requests request
left join public.profiles mentee
  on mentee.id = request.mentee_id
where request.status = 'pending'
  and not exists (
    select 1
    from public.notifications notification
    where notification.entity_type =
      'mentorship_request'
      and notification.entity_id = request.id
      and notification.notification_type =
        'mentorship_request'
      and notification.recipient_id =
        request.mentor_id
  );

commit;