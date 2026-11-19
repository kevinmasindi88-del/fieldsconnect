begin;


-- ---------------------------------------------------------------------------
-- Structured post mentions
-- ---------------------------------------------------------------------------

create table if not exists public.post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.posts(id)
    on delete cascade,
  mentioned_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,
  mentioned_by uuid not null
    references public.profiles(id)
    on delete cascade,
  created_at timestamptz not null default now(),

  unique (post_id, mentioned_profile_id),

  check (
    mentioned_profile_id <> mentioned_by
  )
);


create index if not exists
post_mentions_post_id_idx
on public.post_mentions(post_id);


create index if not exists
post_mentions_mentioned_profile_id_idx
on public.post_mentions(
  mentioned_profile_id,
  created_at desc
);


alter table public.post_mentions
enable row level security;


-- ---------------------------------------------------------------------------
-- Mention integrity
-- ---------------------------------------------------------------------------

create or replace function
public.validate_post_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_post public.posts%rowtype;
  existing_mention_count integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if new.mentioned_by <> auth.uid() then
    raise exception
      'The mention creator must be the authenticated user';
  end if;


  if new.mentioned_profile_id = auth.uid() then
    raise exception
      'You cannot mention yourself';
  end if;


  select *
  into target_post
  from public.posts
  where id = new.post_id
    and deleted_at is null
  for update;

  if not found then
    raise exception
      'Post not found';
  end if;


  if target_post.author_id <> auth.uid() then
    raise exception
      'Only the post author may add mentions';
  end if;


  if not public.are_accepted_connections(
    auth.uid(),
    new.mentioned_profile_id
  ) then
    raise exception
      'Only accepted connections may be mentioned';
  end if;


  if public.has_block_between(
    auth.uid(),
    new.mentioned_profile_id
  ) then
    raise exception
      'This connection cannot be mentioned';
  end if;


  select count(*)
  into existing_mention_count
  from public.post_mentions
  where post_id = new.post_id;

  if existing_mention_count >= 10 then
    raise exception
      'A post may mention at most 10 connections';
  end if;


  return new;
end;
$function$;


drop trigger if exists
post_mentions_validate
on public.post_mentions;


create trigger
post_mentions_validate
before insert on public.post_mentions
for each row
execute function
public.validate_post_mention();


revoke all
on function
public.validate_post_mention()
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Mention notification
-- ---------------------------------------------------------------------------

create or replace function
public.notify_post_mentioned()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_name text;
begin
  select display_name
  into actor_name
  from public.profiles
  where id = new.mentioned_by;


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
    new.mentioned_profile_id,
    new.mentioned_by,
    'post_mentioned',
    'post',
    new.post_id,
    'You were mentioned in a post',
    coalesce(actor_name, 'Someone') ||
      ' mentioned you in a post.'
  );


  return new;
end;
$function$;


drop trigger if exists
post_mentions_notify
on public.post_mentions;


create trigger
post_mentions_notify
after insert on public.post_mentions
for each row
execute function
public.notify_post_mentioned();


revoke all
on function
public.notify_post_mentioned()
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

drop policy if exists
"post_mentions_select_visible"
on public.post_mentions;


create policy
"post_mentions_select_visible"
on public.post_mentions
for select
to authenticated
using (
  exists (
    select 1
    from public.posts post
    where post.id = post_mentions.post_id
  )
);


drop policy if exists
"post_mentions_insert_own"
on public.post_mentions;


create policy
"post_mentions_insert_own"
on public.post_mentions
for insert
to authenticated
with check (
  mentioned_by = auth.uid()
);


drop policy if exists
"post_mentions_delete_own"
on public.post_mentions;


create policy
"post_mentions_delete_own"
on public.post_mentions
for delete
to authenticated
using (
  mentioned_by = auth.uid()
);


grant select, insert, delete
on public.post_mentions
to authenticated;


commit;
