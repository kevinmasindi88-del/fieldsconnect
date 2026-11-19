alter table public.posts
add column if not exists edited_at timestamptz;

create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type = 'like'),
  created_at timestamptz not null default now(),
  unique (comment_id, profile_id)
);

alter table public.comment_reactions enable row level security;

drop policy if exists "comment_reactions_select_authenticated"
on public.comment_reactions;

create policy "comment_reactions_select_authenticated"
on public.comment_reactions
for select
to authenticated
using (true);

drop policy if exists "comment_reactions_insert_own"
on public.comment_reactions;

create policy "comment_reactions_insert_own"
on public.comment_reactions
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists "comment_reactions_delete_own"
on public.comment_reactions;

create policy "comment_reactions_delete_own"
on public.comment_reactions
for delete
to authenticated
using (profile_id = auth.uid());
