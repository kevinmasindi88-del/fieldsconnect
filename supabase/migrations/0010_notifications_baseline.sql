-- FieldsConnect Notifications Baseline
-- Scope: in-app notifications for connection activity, messages,
-- timeline likes, and timeline comments.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (
    notification_type in (
      'connection_request',
      'connection_accepted',
      'new_message',
      'post_liked',
      'post_commented'
    )
  ),
  entity_type text not null check (
    entity_type in (
      'connection',
      'conversation',
      'message',
      'post',
      'comment'
    )
  ),
  entity_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx
on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
on public.notifications(recipient_id, created_at desc)
where read_at is null;

create index if not exists notifications_actor_id_idx
on public.notifications(actor_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own"
on public.notifications;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  recipient_id = auth.uid()
);

drop policy if exists "notifications_insert_actor"
on public.notifications;

create policy "notifications_insert_actor"
on public.notifications
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and recipient_id <> auth.uid()
);

drop policy if exists "notifications_update_own"
on public.notifications;

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (
  recipient_id = auth.uid()
)
with check (
  recipient_id = auth.uid()
);

drop policy if exists "notifications_delete_own"
on public.notifications;

create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (
  recipient_id = auth.uid()
);

grant select, insert, update, delete
on public.notifications
to authenticated;
