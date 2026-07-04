-- FieldsConnect Initial Schema
-- Ticket 4: Initial Supabase schema migrations
-- Scope: schema only. No RLS policies in this migration.

create extension if not exists "pgcrypto";

-- Shared timestamp trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text unique,
  bio text,
  field text,
  role_type text not null check (role_type in ('student', 'professional', 'institution')),
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'connections', 'private')),
  mentor_available boolean not null default false,
  avatar_url text,
  is_active boolean not null default true,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  community_guidelines_accepted_at timestamptz,
  age_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Interests
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

-- Skills
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  rating smallint check (rating between 1 and 5),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

-- Posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  visibility text not null default 'public' check (visibility in ('public', 'connections')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- Reactions: one reaction per user per post
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, profile_id)
);

-- Connections
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id),
  unique (requester_id, recipient_id)
);

create trigger connections_set_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

-- Conversations: MVP supports 1:1 only
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.connections(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

-- Blocks
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'message')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- Moderation actions
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'message')),
  target_id uuid not null,
  action_type text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Admin audit logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists profiles_role_type_idx on public.profiles(role_type);
create index if not exists profiles_field_idx on public.profiles(field);
create index if not exists profiles_visibility_idx on public.profiles(profile_visibility);
create index if not exists skills_profile_id_idx on public.skills(profile_id);
create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists reactions_post_id_idx on public.reactions(post_id);
create index if not exists connections_requester_id_idx on public.connections(requester_id);
create index if not exists connections_recipient_id_idx on public.connections(recipient_id);
create index if not exists connections_status_idx on public.connections(status);
create index if not exists conversation_members_profile_id_idx on public.conversation_members(profile_id);
create index if not exists messages_conversation_id_created_at_idx on public.messages(conversation_id, created_at);
create index if not exists blocks_blocker_id_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_id_idx on public.blocks(blocked_id);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists moderation_actions_target_idx on public.moderation_actions(target_type, target_id);
create index if not exists admin_audit_logs_actor_id_idx on public.admin_audit_logs(actor_id);
