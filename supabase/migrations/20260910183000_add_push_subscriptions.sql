begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint push_subscriptions_endpoint_not_blank
    check (char_length(trim(endpoint)) > 0),

  constraint push_subscriptions_p256dh_not_blank
    check (char_length(trim(p256dh)) > 0),

  constraint push_subscriptions_auth_not_blank
    check (char_length(trim(auth)) > 0),

  constraint push_subscriptions_endpoint_unique
    unique (endpoint)
);

create index push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

alter table public.push_subscriptions
enable row level security;

create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
);

grant select, insert, update, delete
on public.push_subscriptions
to authenticated;

create or replace function public.register_push_subscription(
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_user_id uuid;
  subscription_id uuid;
begin
  authenticated_user_id := auth.uid();

  if authenticated_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(subscription_endpoint), '') is null then
    raise exception 'Push subscription endpoint is required';
  end if;

  if nullif(trim(subscription_p256dh), '') is null then
    raise exception 'Push subscription p256dh key is required';
  end if;

  if nullif(trim(subscription_auth), '') is null then
    raise exception 'Push subscription auth key is required';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    updated_at,
    last_seen_at
  )
  values (
    authenticated_user_id,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    subscription_user_agent,
    now(),
    now()
  )
  on conflict (endpoint)
  do update set
    user_id = authenticated_user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now(),
    last_seen_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.unregister_push_subscription(
  subscription_endpoint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.push_subscriptions
  where endpoint = subscription_endpoint
    and user_id = auth.uid();
end;
$$;

revoke all
on function public.register_push_subscription(
  text,
  text,
  text,
  text
)
from public, anon;

revoke all
on function public.unregister_push_subscription(text)
from public, anon;

grant execute
on function public.register_push_subscription(
  text,
  text,
  text,
  text
)
to authenticated;

grant execute
on function public.unregister_push_subscription(text)
to authenticated;

commit;
