create table if not exists public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id) on delete cascade,
  mentioned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_mentions_unique unique(comment_id, mentioned_profile_id)
);
create index if not exists comment_mentions_comment_idx on public.comment_mentions(comment_id);
alter table public.comment_mentions enable row level security;
grant select, insert on public.comment_mentions to authenticated;
drop policy if exists "comment_mentions_read_visible_post" on public.comment_mentions;
create policy "comment_mentions_read_visible_post" on public.comment_mentions
  for select to authenticated
  using (exists (
    select 1 from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_id and c.deleted_at is null and p.deleted_at is null
      and (
        p.visibility = 'public' or p.author_id = (select auth.uid())
        or (p.visibility = 'connections' and public.are_accepted_connections((select auth.uid()), p.author_id))
      )
  ));
drop policy if exists "comment_mentions_insert_by_self" on public.comment_mentions;
create policy "comment_mentions_insert_by_self" on public.comment_mentions
  for insert to authenticated with check (mentioned_by = (select auth.uid()));

create or replace function public.validate_comment_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_comment public.comments%rowtype; target_post public.posts%rowtype;
begin
  if auth.uid() is null or new.mentioned_by is distinct from auth.uid() then
    raise exception 'Authentication required for mentions';
  end if;
  if new.mentioned_profile_id = auth.uid() then raise exception 'You cannot mention yourself'; end if;
  select * into target_comment from public.comments where id = new.comment_id and deleted_at is null for update;
  if not found or target_comment.author_id <> auth.uid() then
    raise exception 'You may only mention people in your own comment';
  end if;
  select * into target_post from public.posts where id = target_comment.post_id and deleted_at is null;
  if not found then raise exception 'Post unavailable'; end if;
  if not (
    target_post.visibility = 'public'
    or target_post.author_id = auth.uid()
    or (target_post.visibility = 'connections' and public.are_accepted_connections(auth.uid(), target_post.author_id))
  ) then raise exception 'Post unavailable'; end if;
  if not public.are_accepted_connections(auth.uid(), new.mentioned_profile_id)
    or public.has_block_between(auth.uid(), new.mentioned_profile_id)
  then raise exception 'Only accepted, unblocked connections may be mentioned'; end if;
  if not (
    target_post.visibility = 'public'
    or target_post.author_id = new.mentioned_profile_id
    or (target_post.visibility = 'connections' and public.are_accepted_connections(new.mentioned_profile_id, target_post.author_id))
  ) then raise exception 'The mentioned person cannot view this post'; end if;
  if (select count(*) from public.comment_mentions where comment_id = new.comment_id) >= 10
  then raise exception 'Maximum 10 mentions per comment'; end if;
  return new;
end $$;
drop trigger if exists validate_comment_mentions_insert on public.comment_mentions;
create trigger validate_comment_mentions_insert before insert on public.comment_mentions
for each row execute function public.validate_comment_mention();

create or replace function public.notify_comment_mentioned()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_name text;
begin
  select display_name into actor_name from public.profiles where id = new.mentioned_by;
  insert into public.notifications(recipient_id, actor_id, notification_type, entity_type, entity_id, title, body)
  values(new.mentioned_profile_id, new.mentioned_by, 'comment_mentioned', 'comment', new.comment_id,
    'You were mentioned in a comment', coalesce(actor_name,'Someone') || ' mentioned you in a comment.');
  return new;
end $$;
drop trigger if exists notify_comment_mentions_insert on public.comment_mentions;
create trigger notify_comment_mentions_insert after insert on public.comment_mentions
for each row execute function public.notify_comment_mentioned();
