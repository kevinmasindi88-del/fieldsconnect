-- DAD Foundation v1
create table if not exists public.dad_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_role text not null default 'analyst' check (access_role in ('analyst')),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  feature text not null,
  occurred_at timestamptz not null default now(),
  session_id text,
  related_user_id uuid references public.profiles(id) on delete set null,
  mentorship_id uuid references public.mentorships(id) on delete set null,
  skill_id uuid references public.skills(id) on delete set null,
  library_document_id uuid references public.library_documents(id) on delete set null,
  connection_id uuid references public.connections(id) on delete set null,
  source text,
  context jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id, occurred_at desc);
create index if not exists analytics_events_feature_name_idx
  on public.analytics_events (feature, event_name, occurred_at desc);
create index if not exists analytics_events_mentorship_idx
  on public.analytics_events (mentorship_id) where mentorship_id is not null;
create index if not exists analytics_events_library_idx
  on public.analytics_events (library_document_id) where library_document_id is not null;

create table if not exists public.dad_daily_metrics (
  metric_date date not null,
  metric_key text not null,
  metric_value numeric not null,
  dimension_type text not null default 'global',
  dimension_value text not null default 'all',
  calculated_at timestamptz not null default now(),
  primary key (metric_date, metric_key, dimension_type, dimension_value)
);

create table if not exists public.dad_analyst_reviews (
  id uuid primary key default gen_random_uuid(),
  analyst_id uuid not null references public.profiles(id) on delete cascade,
  review_date date not null default current_date,
  observation text not null,
  evidence jsonb not null default '{}'::jsonb,
  interpretation text,
  recommendation text,
  action_owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  outcome text,
  status text not null default 'open'
    check (status in ('open','accepted','in_progress','completed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dad_access enable row level security;
alter table public.analytics_events enable row level security;
alter table public.dad_daily_metrics enable row level security;
alter table public.dad_analyst_reviews enable row level security;

create or replace function public.has_dad_access(candidate uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate is not null
    and (
      exists (
        select 1
        from public.platform_roles pr
        where pr.user_id = candidate
          and pr.role = 'admin'
          and pr.revoked_at is null
      )
      or exists (
        select 1
        from public.dad_access da
        where da.user_id = candidate
          and da.access_role = 'analyst'
          and da.revoked_at is null
      )
    );
$$;

revoke all on function public.has_dad_access(uuid) from public;
grant execute on function public.has_dad_access(uuid) to authenticated;

drop policy if exists dad_access_select_authorized on public.dad_access;
create policy dad_access_select_authorized
on public.dad_access for select to authenticated
using (public.has_dad_access((select auth.uid())));

drop policy if exists dad_access_admin_insert on public.dad_access;
create policy dad_access_admin_insert
on public.dad_access for insert to authenticated
with check (
  exists (
    select 1 from public.platform_roles pr
    where pr.user_id = (select auth.uid())
      and pr.role = 'admin'
      and pr.revoked_at is null
  )
  and granted_by = (select auth.uid())
);

drop policy if exists dad_access_admin_update on public.dad_access;
create policy dad_access_admin_update
on public.dad_access for update to authenticated
using (
  exists (
    select 1 from public.platform_roles pr
    where pr.user_id = (select auth.uid())
      and pr.role = 'admin'
      and pr.revoked_at is null
  )
)
with check (
  exists (
    select 1 from public.platform_roles pr
    where pr.user_id = (select auth.uid())
      and pr.role = 'admin'
      and pr.revoked_at is null
  )
);

drop policy if exists analytics_events_insert_self on public.analytics_events;
create policy analytics_events_insert_self
on public.analytics_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists analytics_events_select_dad on public.analytics_events;
create policy analytics_events_select_dad
on public.analytics_events for select to authenticated
using (public.has_dad_access((select auth.uid())));

drop policy if exists dad_daily_metrics_select_dad on public.dad_daily_metrics;
create policy dad_daily_metrics_select_dad
on public.dad_daily_metrics for select to authenticated
using (public.has_dad_access((select auth.uid())));

drop policy if exists dad_reviews_select_dad on public.dad_analyst_reviews;
create policy dad_reviews_select_dad
on public.dad_analyst_reviews for select to authenticated
using (public.has_dad_access((select auth.uid())));

drop policy if exists dad_reviews_insert_self on public.dad_analyst_reviews;
create policy dad_reviews_insert_self
on public.dad_analyst_reviews for insert to authenticated
with check (
  public.has_dad_access((select auth.uid()))
  and analyst_id = (select auth.uid())
);

drop policy if exists dad_reviews_update_self_or_admin on public.dad_analyst_reviews;
create policy dad_reviews_update_self_or_admin
on public.dad_analyst_reviews for update to authenticated
using (
  analyst_id = (select auth.uid())
  or exists (
    select 1 from public.platform_roles pr
    where pr.user_id = (select auth.uid())
      and pr.role = 'admin'
      and pr.revoked_at is null
  )
)
with check (public.has_dad_access((select auth.uid())));

grant select, insert on public.analytics_events to authenticated;
grant select on public.dad_daily_metrics to authenticated;
grant select, insert, update on public.dad_analyst_reviews to authenticated;
grant select, insert, update on public.dad_access to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.refresh_dad_daily_metrics(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.dad_daily_metrics(metric_date, metric_key, metric_value, dimension_type, dimension_value, calculated_at)
  values
    (p_date, 'users_total',
      (select count(*) from public.profiles where deleted_at is null), 'global', 'all', now()),
    (p_date, 'users_new',
      (select count(*) from public.profiles where deleted_at is null and created_at::date = p_date), 'global', 'all', now()),
    (p_date, 'connections_total',
      (select count(*) from public.connections), 'global', 'all', now()),
    (p_date, 'connections_accepted',
      (select count(*) from public.connections where status = 'accepted'), 'global', 'all', now()),
    (p_date, 'mentorship_requests_total',
      (select count(*) from public.mentorship_requests), 'global', 'all', now()),
    (p_date, 'mentorship_requests_accepted',
      (select count(*) from public.mentorship_requests where status = 'accepted'), 'global', 'all', now()),
    (p_date, 'mentorships_active',
      (select count(*) from public.mentorships where status = 'active'), 'global', 'all', now()),
    (p_date, 'mentorships_completed',
      (select count(*) from public.mentorships where status = 'completed'), 'global', 'all', now()),
    (p_date, 'mentorship_milestones_completed',
      (select count(*) from public.mentorship_milestones where status = 'completed'), 'global', 'all', now()),
    (p_date, 'mentorship_action_items_completed',
      (select count(*) from public.mentorship_action_items where status = 'completed'), 'global', 'all', now()),
    (p_date, 'library_documents_total',
      (select count(*) from public.library_documents where deleted_at is null), 'global', 'all', now()),
    (p_date, 'library_documents_published',
      (select count(*) from public.library_documents where deleted_at is null and is_published = true), 'global', 'all', now()),
    (p_date, 'posts_total',
      (select count(*) from public.posts where deleted_at is null), 'global', 'all', now()),
    (p_date, 'comments_total',
      (select count(*) from public.comments where deleted_at is null), 'global', 'all', now()),
    (p_date, 'post_reactions_total',
      (select count(*) from public.reactions), 'global', 'all', now()),
    (p_date, 'messages_total',
      (select count(*) from public.messages where deleted_at is null), 'global', 'all', now()),
    (p_date, 'analytics_events_today',
      (select count(*) from public.analytics_events where occurred_at::date = p_date), 'global', 'all', now())
  on conflict (metric_date, metric_key, dimension_type, dimension_value)
  do update set
    metric_value = excluded.metric_value,
    calculated_at = excluded.calculated_at;
end;
$$;

revoke all on function private.refresh_dad_daily_metrics(date) from public, anon, authenticated;

create or replace function public.refresh_dad_metrics(p_date date default current_date)
returns timestamptz
language plpgsql
security definer
set search_path = public, private
as $$
declare
  refreshed_at timestamptz := now();
begin
  if auth.uid() is null or not public.has_dad_access(auth.uid()) then
    raise exception 'DAD access required';
  end if;

  perform private.refresh_dad_daily_metrics(p_date);
  return refreshed_at;
end;
$$;

revoke all on function public.refresh_dad_metrics(date) from public, anon;
grant execute on function public.refresh_dad_metrics(date) to authenticated;

select private.refresh_dad_daily_metrics(current_date);

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'fieldsconnect-dad-daily-refresh'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fieldsconnect-dad-daily-refresh',
    '15 0 * * *',
    $job$select private.refresh_dad_daily_metrics(current_date);$job$
  );
end $$;
