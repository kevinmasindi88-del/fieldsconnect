begin;


-- ---------------------------------------------------------------------------
-- Notify current post mentions when the post body is genuinely edited
-- ---------------------------------------------------------------------------

create or replace function
public.notify_mentioned_users_on_post_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_name text;
begin
  -- UPDATE OF body can still fire when the assigned value is unchanged.
  -- Do not create edit notifications unless the body genuinely changed.
  if old.body is not distinct from new.body then
    return new;
  end if;


  select display_name
  into actor_name
  from public.profiles
  where id = new.author_id;


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
    mention.mentioned_profile_id,
    new.author_id,
    'mentioned_post_edited',
    'post',
    new.id,
    'A post you were mentioned in was edited',
    coalesce(actor_name, 'Someone') ||
      ' edited a post you were mentioned in.'
  from public.post_mentions mention
  where mention.post_id = new.id
    and public.are_accepted_connections(
      new.author_id,
      mention.mentioned_profile_id
    )
    and not public.has_block_between(
      new.author_id,
      mention.mentioned_profile_id
    )
    and exists (
      select 1
      from public.profiles mentioned_profile
      where mentioned_profile.id = mention.mentioned_profile_id
        and mentioned_profile.deleted_at is null
        and mentioned_profile.is_active = true
    );


  return new;
end;
$function$;


drop trigger if exists
posts_notify_mentioned_users_on_edit
on public.posts;


create trigger
posts_notify_mentioned_users_on_edit
after update of body
on public.posts
for each row
execute function
public.notify_mentioned_users_on_post_edit();


revoke all
on function
public.notify_mentioned_users_on_post_edit()
from public, anon, authenticated;


commit;
