
-- FieldsConnect RLS Baseline
-- Scope: enable RLS and add conservative MVP access policies.
-- This migration intentionally avoids broad public write access.

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.skills enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.connections enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Helper: accepted connection check
create or replace function public.are_accepted_connections(profile_a uuid, profile_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = profile_a and c.recipient_id = profile_b)
        or
        (c.requester_id = profile_b and c.recipient_id = profile_a)
      )
  );
$$;

-- Helper: block check
create or replace function public.has_block_between(profile_a uuid, profile_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where
      (b.blocker_id = profile_a and b.blocked_id = profile_b)
      or
      (b.blocker_id = profile_b and b.blocked_id = profile_a)
  );
$$;

-- Profiles
create policy "profiles_select_visible"
on public.profiles
for select
to authenticated
using (
  deleted_at is null
  and is_active = true
  and (
    id = auth.uid()
    or profile_visibility = 'public'
    or (
      profile_visibility = 'connections'
      and public.are_accepted_connections(auth.uid(), id)
    )
  )
);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Interests are readable by authenticated members.
create policy "interests_select_authenticated"
on public.interests
for select
to authenticated
using (true);

-- Profile interests
create policy "profile_interests_select_authenticated"
on public.profile_interests
for select
to authenticated
using (true);

create policy "profile_interests_insert_own"
on public.profile_interests
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "profile_interests_delete_own"
on public.profile_interests
for delete
to authenticated
using (profile_id = auth.uid());

-- Skills
create policy "skills_select_visible"
on public.skills
for select
to authenticated
using (
  deleted_at is null
  and is_published = true
);

create policy "skills_insert_own"
on public.skills
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "skills_update_own"
on public.skills
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

-- Posts
create policy "posts_select_visible"
on public.posts
for select
to authenticated
using (
  deleted_at is null
  and (
    visibility = 'public'
    or author_id = auth.uid()
    or (
      visibility = 'connections'
      and public.are_accepted_connections(auth.uid(), author_id)
    )
  )
);

create policy "posts_insert_own"
on public.posts
for insert
to authenticated
with check (author_id = auth.uid());

create policy "posts_update_own"
on public.posts
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- Comments
create policy "comments_select_authenticated"
on public.comments
for select
to authenticated
using (deleted_at is null);

create policy "comments_insert_own"
on public.comments
for insert
to authenticated
with check (author_id = auth.uid());

create policy "comments_update_own"
on public.comments
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- Reactions
create policy "reactions_select_authenticated"
on public.reactions
for select
to authenticated
using (true);

create policy "reactions_insert_own"
on public.reactions
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "reactions_delete_own"
on public.reactions
for delete
to authenticated
using (profile_id = auth.uid());

-- Connections
create policy "connections_select_involved"
on public.connections
for select
to authenticated
using (
  requester_id = auth.uid()
  or recipient_id = auth.uid()
);

create policy "connections_insert_own_request"
on public.connections
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and requester_id <> recipient_id
  and not public.has_block_between(requester_id, recipient_id)
);

create policy "connections_update_involved"
on public.connections
for update
to authenticated
using (
  requester_id = auth.uid()
  or recipient_id = auth.uid()
)
with check (
  requester_id = auth.uid()
  or recipient_id = auth.uid()
);

-- Conversations and messages: accepted-connection-only 1:1 MVP
create policy "conversations_select_members"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.profile_id = auth.uid()
  )
);

create policy "conversation_members_select_self"
on public.conversation_members
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.profile_id = auth.uid()
  )
);

create policy "messages_select_members"
on public.messages
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.profile_id = auth.uid()
  )
);

create policy "messages_insert_members"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.profile_id = auth.uid()
  )
);

-- Blocks
create policy "blocks_select_own"
on public.blocks
for select
to authenticated
using (
  blocker_id = auth.uid()
  or blocked_id = auth.uid()
);

create policy "blocks_insert_own"
on public.blocks
for insert
to authenticated
with check (
  blocker_id = auth.uid()
  and blocker_id <> blocked_id
);

create policy "blocks_delete_own"
on public.blocks
for delete
to authenticated
using (blocker_id = auth.uid());

-- Reports
create policy "reports_insert_own"
on public.reports
for insert
to authenticated
with check (reporter_id = auth.uid());

create policy "reports_select_own"
on public.reports
for select
to authenticated
using (reporter_id = auth.uid());

-- Moderation and audit logs are locked down at RLS level for now.
-- Admin/moderator access will be added through protected role management later.
