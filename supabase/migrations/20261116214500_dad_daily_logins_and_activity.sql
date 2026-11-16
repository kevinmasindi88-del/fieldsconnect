-- DAD daily login and active-user telemetry v1
-- SAST daily boundaries (Africa/Johannesburg); no emails, IP addresses,
-- page contents, or arbitrary user-supplied identity fields are recorded.
--
-- Existing DAD metrics and cron jobs are deliberately unchanged. DAD reads
-- the last 30 days of aggregates through one restricted RPC.

create table if not exists private.dad_daily_active_users (
  activity_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (activity_date, user_id)
);

create table if not exists private.dad_login_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null
);

create index if not exists dad_login_sessions_signed_in_idx
  on private.dad_login_sessions (signed_in_at);
create index if not exists dad_login_sessions_user_idx
  on private.dad_login_sessions (user_id, signed_in_at desc);

alter table private.dad_daily_active_users enable row level security;
alter table private.dad_login_sessions enable row level security;
revoke all on private.dad_daily_active_users from public, anon, authenticated;
revoke all on private.dad_login_sessions from public, anon, authenticated;

-- A user can only mark their own authenticated presence, once per local day.
-- Repeated focus/resume and multiple tabs are handled by the primary key.
create or replace function public.record_dad_activity()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  insert into private.dad_daily_active_users (activity_date, user_id)
  values ((now() at time zone 'Africa/Johannesburg')::date, v_user_id)
  on conflict (activity_date, user_id) do nothing;

  return true;
end;
$$;

-- Record an explicitly successful sign-in once per actual Supabase auth
-- session. The UUID is read from the signed JWT, not accepted as an argument.
-- Require a recently CREATED auth session so old sessions cannot be replayed
-- into new login counts when an app or browser is reopened.
create or replace function public.record_dad_signin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_text text := auth.jwt() ->> 'session_id';
  v_session_id uuid;
  v_recorded boolean := false;
begin
  if v_user_id is null or v_session_text is null then
    return false;
  end if;

  if v_session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_session_id := v_session_text::uuid;

  with recorded as (
    insert into private.dad_login_sessions (session_id, user_id, signed_in_at)
    select s.id, s.user_id, s.created_at
    from auth.sessions s
    where s.id = v_session_id
      and s.user_id = v_user_id
      and s.created_at >= now() - interval '15 minutes'
      and s.created_at <= now()
    on conflict (session_id) do nothing
    returning 1
  )
  select exists (select 1 from recorded) into v_recorded;

  return v_recorded;
end;
$$;

-- Aggregate only. No member identity, session ID, or raw event is exposed
-- via the DAD data API. Authorization uses existing DAD role controls.
create or replace function public.get_dad_activity_30d(p_days integer default 30)
returns table (
  activity_date date,
  login_count bigint,
  active_users bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_start date;
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'Activity period must be between 1 and 90 days'
      using errcode = '22023';
  end if;

  -- Avoid presenting days before the first recorded activity as real zeroes.
  v_start := greatest(
    v_today - (p_days - 1),
    coalesce(
      (select min(a.activity_date) from private.dad_daily_active_users a),
      v_today
    )
  );

  return query
  with days as (
    select gs::date as day
    from pg_catalog.generate_series(
      v_start::timestamp, v_today::timestamp, interval '1 day'
    ) gs
  ),
  logins as (
    select (l.signed_in_at at time zone 'Africa/Johannesburg')::date as day,
           count(*)::bigint as n
    from private.dad_login_sessions l
    where l.signed_in_at >= (v_start::timestamp at time zone 'Africa/Johannesburg')
      and l.signed_in_at < ((v_today + 1)::timestamp at time zone 'Africa/Johannesburg')
    group by 1
  ),
  activity as (
    select a.activity_date as day, count(*)::bigint as n
    from private.dad_daily_active_users a
    where a.activity_date between v_start and v_today
    group by a.activity_date
  )
  select d.day, coalesce(l.n, 0)::bigint, coalesce(a.n, 0)::bigint
  from days d
  left join logins l on l.day = d.day
  left join activity a on a.day = d.day
  order by d.day;
end;
$$;

revoke all on function public.record_dad_activity() from public, anon, authenticated;
revoke all on function public.record_dad_signin() from public, anon, authenticated;
revoke all on function public.get_dad_activity_30d(integer) from public, anon, authenticated;
grant execute on function public.record_dad_activity() to authenticated;
grant execute on function public.record_dad_signin() to authenticated;
grant execute on function public.get_dad_activity_30d(integer) to authenticated;
