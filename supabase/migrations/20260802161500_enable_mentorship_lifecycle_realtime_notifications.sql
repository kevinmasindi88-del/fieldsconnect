-- Enable realtime mentorship lifecycle updates and notify
-- the other participant when the relationship status changes.

begin;


-- ---------------------------------------------------------------------------
-- Realtime support for the parent mentorship row
-- ---------------------------------------------------------------------------

alter table public.mentorships
  replica identity full;


do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables publication_table
    where publication_table.pubname =
      'supabase_realtime'
      and publication_table.schemaname =
        'public'
      and publication_table.tablename =
        'mentorships'
  ) then
    alter publication supabase_realtime
      add table public.mentorships;
  end if;
end;
$block$;


-- ---------------------------------------------------------------------------
-- Lifecycle notifications
-- ---------------------------------------------------------------------------

create or replace function
public.notify_mentorship_lifecycle_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  notification_recipient_id uuid;
  acting_user_id uuid;
  actor_name text;
  next_notification_type text;
  next_title text;
  next_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  acting_user_id :=
    case
      when new.status = 'paused'
        then new.paused_by

      when old.status = 'paused'
        and new.status in (
          'active',
          'ending'
        )
        then new.mentor_id

      when new.status =
        'completion_requested'
        then new.completion_requested_by

      when new.status = 'completed'
        then new.completion_responded_by

      when old.status =
        'completion_requested'
        and new.status in (
          'active',
          'ending'
        )
        then new.completion_responded_by

      when new.status = 'ended_early'
        then new.ended_early_by

      else auth.uid()
    end;

  if acting_user_id is null then
    acting_user_id := auth.uid();
  end if;

  notification_recipient_id :=
    case
      when acting_user_id = new.mentor_id
        then new.mentee_id
      when acting_user_id = new.mentee_id
        then new.mentor_id
      else null
    end;

  if notification_recipient_id is null
    or notification_recipient_id =
      acting_user_id then
    return new;
  end if;

  select profile.display_name
  into actor_name
  from public.profiles profile
  where profile.id = acting_user_id;

  actor_name :=
    coalesce(actor_name, 'The other participant');

  if new.status = 'paused' then
    next_notification_type :=
      'mentorship_paused';

    next_title :=
      'Mentorship paused';

    next_body :=
      actor_name
      || ' paused your mentorship in '
      || new.mentorship_field
      || case
           when new.pause_reason is not null
             then '. Reason: '
               || new.pause_reason
           else '.'
         end;

  elsif old.status = 'paused'
    and new.status in (
      'active',
      'ending'
    ) then
    next_notification_type :=
      'mentorship_resumed';

    next_title :=
      'Mentorship resumed';

    next_body :=
      actor_name
      || ' resumed your mentorship in '
      || new.mentorship_field
      || '.';

  elsif new.status =
    'completion_requested' then
    next_notification_type :=
      'mentorship_completion_requested';

    next_title :=
      'Mentorship completion requested';

    next_body :=
      actor_name
      || ' requested completion of your mentorship in '
      || new.mentorship_field
      || case
           when new.completion_request_note
             is not null
             then '. Note: '
               || new.completion_request_note
           else '.'
         end;

  elsif new.status = 'completed' then
    next_notification_type :=
      'mentorship_completed';

    next_title :=
      'Mentorship completed';

    next_body :=
      actor_name
      || ' approved completion of your mentorship in '
      || new.mentorship_field
      || '.';

  elsif old.status =
    'completion_requested'
    and new.status in (
      'active',
      'ending'
    ) then
    next_notification_type :=
      'mentorship_completion_declined';

    next_title :=
      'Mentorship completion declined';

    next_body :=
      actor_name
      || ' declined the completion request for your mentorship in '
      || new.mentorship_field
      || case
           when new.completion_response_note
             is not null
             then '. Reason: '
               || new.completion_response_note
           else '.'
         end;

  elsif new.status = 'ended_early' then
    next_notification_type :=
      'mentorship_ended_early';

    next_title :=
      'Mentorship ended early';

    next_body :=
      actor_name
      || ' ended your mentorship in '
      || new.mentorship_field
      || case
           when new.end_reason is not null
             then '. Reason: '
               || new.end_reason
           else '.'
         end;

  else
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
    'mentorship',
    new.id,
    next_title,
    next_body
  );

  return new;
end;
$function$;


drop trigger if exists
mentorships_notify_lifecycle_change
on public.mentorships;


create trigger
mentorships_notify_lifecycle_change
after update of status
on public.mentorships
for each row
when (
  old.status is distinct from new.status
)
execute function
public.notify_mentorship_lifecycle_activity();


revoke all
on function
public.notify_mentorship_lifecycle_activity()
from public, anon, authenticated;


commit;