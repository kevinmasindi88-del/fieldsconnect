-- DAD hardening: sensitive-by-default analytics context + least-privilege access register.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.analytics_context_is_safe(payload jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  with recursive nodes(value) as (
    select coalesce(payload, '{}'::jsonb)
    union all
    select child.value
    from nodes n
    cross join lateral (
      select e.value
      from jsonb_each(n.value) e
      where jsonb_typeof(n.value) = 'object'
      union all
      select a.value
      from jsonb_array_elements(n.value) a
      where jsonb_typeof(n.value) = 'array'
    ) child
  ),
  object_keys as (
    select k.key
    from nodes n
    cross join lateral jsonb_object_keys(n.value) k(key)
    where jsonb_typeof(n.value) = 'object'
  ),
  string_values as (
    select trim(both '"' from n.value::text) as value
    from nodes n
    where jsonb_typeof(n.value) = 'string'
  )
  select
    jsonb_typeof(coalesce(payload, '{}'::jsonb)) = 'object'
    and octet_length(coalesce(payload, '{}'::jsonb)::text) <= 2048
    and not exists (
      select 1
      from object_keys
      where key <> all (array[
        'owner_id',
        'related_user_id',
        'institution_id',
        'cohort_id',
        'visibility',
        'is_published',
        'mime_type',
        'resource_type',
        'file_extension',
        'file_size_bucket',
        'role_type',
        'status',
        'mentorship_level',
        'connection_status',
        'notification_type',
        'search_scope',
        'feature_variant',
        'device_class',
        'platform',
        'result',
        'count'
      ])
    )
    and not exists (
      select 1
      from string_values
      where length(value) > 120
    );
$$;

revoke all on function private.analytics_context_is_safe(jsonb)
from public, anon, authenticated;

alter table public.analytics_events
  drop constraint if exists analytics_events_context_safe;

alter table public.analytics_events
  add constraint analytics_events_context_safe
  check (private.analytics_context_is_safe(context));

drop policy if exists dad_access_select_authorized on public.dad_access;

create policy dad_access_select_least_privilege
on public.dad_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.platform_roles pr
    where pr.user_id = (select auth.uid())
      and pr.role = 'admin'
      and pr.revoked_at is null
  )
);
