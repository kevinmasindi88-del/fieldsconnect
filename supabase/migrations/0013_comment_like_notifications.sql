-- Notify a comment author when another user likes their comment.

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
      'comment_liked'
    )
  );

create or replace function public.notify_comment_liked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author_id uuid;
  actor_name text;
begin
  select author_id
  into comment_author_id
  from public.comments
  where id = new.comment_id
    and deleted_at is null;

  if comment_author_id is null or comment_author_id = new.profile_id then
    return new;
  end if;

  select display_name
  into actor_name
  from public.profiles
  where id = new.profile_id;

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
    comment_author_id,
    new.profile_id,
    'comment_liked',
    'comment',
    new.comment_id,
    'Someone liked your comment',
    coalesce(actor_name, 'Someone') || ' liked your comment.'
  );

  return new;
end;
$$;

drop trigger if exists comment_reactions_notify_liked
on public.comment_reactions;

create trigger comment_reactions_notify_liked
after insert on public.comment_reactions
for each row execute function public.notify_comment_liked();
