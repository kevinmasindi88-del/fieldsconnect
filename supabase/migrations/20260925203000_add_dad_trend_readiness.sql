-- DAD Trend & Benchmark Readiness
--
-- Structured trend observation begins 2026-09-26 UTC, immediately after
-- the Candidate Baseline v1 reference captured on 2026-09-25.
--
-- Important distinctions:
-- 1. A metric may have a useful trend series without being appropriate
--    for direct benchmarking.
-- 2. Benchmark eligibility is a review gate, not automatic benchmark
--    activation.
-- 3. Existing benchmark_status and threshold_status values remain unchanged.

create table public.dad_trend_policies (
  metric_key text primary key
    references public.dad_metric_governance(metric_key)
    on update cascade
    on delete cascade,

  series_aggregation text not null
    check (
      series_aggregation in (
        'period_end_snapshot',
        'period_sum'
      )
    ),

  benchmark_basis text not null
    check (
      benchmark_basis in (
        'direct_trend',
        'derived_kpi_required',
        'instrumentation_dependency'
      )
    ),

  observation_start date not null,
  primary_grain text not null
    check (
      primary_grain in (
        'day',
        'week',
        'month',
        'cohort'
      )
    ),

  min_complete_days integer not null default 0
    check (min_complete_days >= 0),

  min_complete_weeks integer not null default 0
    check (min_complete_weeks >= 0),

  min_complete_months integer not null default 0
    check (min_complete_months >= 0),

  min_denominator_events integer
    check (
      min_denominator_events is null
      or min_denominator_events >= 0
    ),

  readiness_rule text not null,
  dependency_note text,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dad_trend_policies
  enable row level security;

revoke all
on table public.dad_trend_policies
from public, anon, authenticated;

grant select
on table public.dad_trend_policies
to authenticated;

create policy dad_trend_policies_select_dad
on public.dad_trend_policies
for select
to authenticated
using ((select public.has_dad_access()));

insert into public.dad_trend_policies (
  metric_key,
  series_aggregation,
  benchmark_basis,
  observation_start,
  primary_grain,
  min_complete_days,
  min_complete_weeks,
  min_complete_months,
  min_denominator_events,
  readiness_rule,
  dependency_note
)
values
  (
    'users_total',
    'period_end_snapshot',
    'direct_trend',
    date '2026-09-26',
    'month',
    0,
    0,
    3,
    null,
    'Review only after three complete UTC calendar months. Benchmark growth trend or rate of change rather than absolute user count.',
    null
  ),
  (
    'users_new',
    'period_sum',
    'direct_trend',
    date '2026-09-26',
    'week',
    28,
    4,
    0,
    null,
    'Review only after at least 28 complete UTC days and four complete UTC weeks. Eligibility does not imply statistical maturity.',
    null
  ),
  (
    'connections_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative connection-request count directly.',
    'Requires a normalized connection decision/acceptance KPI with a defensible denominator.'
  ),
  (
    'connections_accepted',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative accepted-connection count directly.',
    'Requires a normalized connection decision/acceptance KPI with a defensible denominator.'
  ),
  (
    'mentorship_requests_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative mentorship-request count directly.',
    'Requires mentorship request acceptance/conversion KPI by resolved decision or mature cohort.'
  ),
  (
    'mentorship_requests_accepted',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative accepted-request count directly.',
    'Requires mentorship request acceptance/conversion KPI by resolved decision or mature cohort.'
  ),
  (
    'mentorships_active',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Active mentorship count is operational context, not a standalone benchmark.',
    'Requires cohort-based mentorship activation and lifecycle measures.'
  ),
  (
    'mentorships_completed',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative completed-mentorship count directly.',
    'Requires a completion/outcome rate using an eligible or terminal mentorship denominator.'
  ),
  (
    'mentorship_milestones_completed',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative completed-milestone count directly.',
    'Requires milestone completion/outcome rate with mature mentorship-cycle context.'
  ),
  (
    'mentorship_action_items_completed',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'cohort',
    0, 0, 0, 30,
    'Do not benchmark cumulative completed-action count directly.',
    'Requires action-item completion/outcome rate with mature mentorship-cycle context.'
  ),
  (
    'posts_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'week',
    0, 0, 0, null,
    'Cumulative post count is trend context only.',
    'Requires posts per active user or another governed active-user-normalized engagement KPI.'
  ),
  (
    'comments_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'week',
    0, 0, 0, null,
    'Cumulative comment count is trend context only.',
    'Requires comments per active user or another governed active-user-normalized engagement KPI.'
  ),
  (
    'post_reactions_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'week',
    0, 0, 0, null,
    'Cumulative reaction count is trend context only.',
    'Requires reactions per active user or another governed active-user-normalized engagement KPI.'
  ),
  (
    'messages_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'week',
    0, 0, 0, null,
    'Cumulative private-message count is trend context only; message content remains excluded from analytics.',
    'Requires aggregate messages per active user or active connection. Message content must never become benchmark input.'
  ),
  (
    'library_documents_total',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'month',
    0, 0, 0, null,
    'Cumulative Library resource count is inventory context only.',
    'Requires Library usage/open/share KPI normalized by active users or published resources.'
  ),
  (
    'library_documents_published',
    'period_end_snapshot',
    'derived_kpi_required',
    date '2026-09-26',
    'month',
    0, 0, 0, null,
    'Published-resource count is inventory context only.',
    'Requires Library usage/open/share KPI normalized by active users or published resources.'
  ),
  (
    'analytics_events_today',
    'period_sum',
    'instrumentation_dependency',
    date '2026-09-26',
    'day',
    28,
    4,
    0,
    null,
    'Do not benchmark event volume while instrumentation coverage is incomplete.',
    'Requires the intended behavioral event map to be implemented and coverage validated before event-volume trend can be interpreted.'
  );

do $$
declare
  v_policy_count integer;
  v_direct_count integer;
begin
  select count(*)
  into v_policy_count
  from public.dad_trend_policies
  where is_active = true;

  if v_policy_count <> 17 then
    raise exception
      'Expected 17 active DAD trend policies; found %',
      v_policy_count;
  end if;

  select count(*)
  into v_direct_count
  from public.dad_trend_policies
  where is_active = true
    and benchmark_basis = 'direct_trend';

  if v_direct_count <> 2 then
    raise exception
      'Expected exactly 2 direct-trend benchmark policies; found %',
      v_direct_count;
  end if;
end
$$;

create or replace function public.get_dad_metric_trend_series(
  p_metric_key text,
  p_grain text default 'week',
  p_start date default date '2026-09-26',
  p_end date default current_date
)
returns table (
  period_start date,
  period_end date,
  metric_value numeric,
  observation_count integer,
  is_complete_period boolean,
  series_aggregation text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_policy public.dad_trend_policies%rowtype;
  v_start date;
  v_end date;
  v_today_utc date;
  v_last_complete_date date;
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required.'
      using errcode = '42501';
  end if;

  if p_grain not in ('day', 'week', 'month') then
    raise exception
      'Unsupported trend grain: %. Expected day, week or month.',
      p_grain;
  end if;

  select *
  into v_policy
  from public.dad_trend_policies
  where metric_key = p_metric_key
    and is_active = true;

  if not found then
    raise exception
      'No active DAD trend policy exists for metric %.',
      p_metric_key;
  end if;

  v_today_utc := (now() at time zone 'UTC')::date;
  v_start := greatest(p_start, v_policy.observation_start);
  v_end := least(p_end, v_today_utc);
  v_last_complete_date := least(p_end, v_today_utc) - 1;

  if v_end < v_start then
    return;
  end if;

  return query
  with base as (
    select
      m.metric_date,
      m.metric_value
    from public.dad_daily_metrics m
    where m.metric_key = p_metric_key
      and m.dimension_type = 'global'
      and m.dimension_value = 'all'
      and m.metric_date between v_start and v_end
  ),
  bucketed as (
    select
      case p_grain
        when 'day' then b.metric_date
        else date_trunc(p_grain, b.metric_date::timestamp)::date
      end as bucket_start,
      b.metric_date,
      b.metric_value
    from base b
  ),
  aggregated as (
    select
      b.bucket_start,
      case p_grain
        when 'day' then b.bucket_start
        when 'week' then b.bucket_start + 6
        when 'month' then
          (b.bucket_start + interval '1 month - 1 day')::date
      end as bucket_end,
      case v_policy.series_aggregation
        when 'period_sum' then sum(b.metric_value)
        else (array_agg(
          b.metric_value
          order by b.metric_date desc
        ))[1]
      end as bucket_value,
      count(distinct b.metric_date)::integer as observed_days
    from bucketed b
    group by b.bucket_start
  )
  select
    a.bucket_start,
    a.bucket_end,
    a.bucket_value,
    a.observed_days,
    (
      a.bucket_start >= v_policy.observation_start
      and a.bucket_end <= v_last_complete_date
      and a.observed_days = (a.bucket_end - a.bucket_start + 1)
    ) as complete_period,
    v_policy.series_aggregation
  from aggregated a
  order by a.bucket_start;
end;
$$;

revoke all
on function public.get_dad_metric_trend_series(
  text,
  text,
  date,
  date
)
from public, anon, authenticated;

grant execute
on function public.get_dad_metric_trend_series(
  text,
  text,
  date,
  date
)
to authenticated;

create or replace function public.get_dad_trend_readiness(
  p_as_of date default current_date
)
returns table (
  metric_key text,
  display_name text,
  domain text,
  benchmark_basis text,
  primary_grain text,
  observation_start date,
  first_observed_date date,
  last_observed_date date,
  complete_days integer,
  complete_weeks integer,
  complete_months integer,
  min_complete_days integer,
  min_complete_weeks integer,
  min_complete_months integer,
  min_denominator_events integer,
  readiness_state text,
  readiness_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today_utc date;
  v_as_of date;
  v_last_complete_date date;
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required.'
      using errcode = '42501';
  end if;

  v_today_utc := (now() at time zone 'UTC')::date;
  v_as_of := least(p_as_of, v_today_utc);
  v_last_complete_date := v_as_of - 1;

  return query
  with policy as (
    select
      p.*,
      g.display_name,
      g.domain
    from public.dad_trend_policies p
    join public.dad_metric_governance g
      on g.metric_key = p.metric_key
    where p.is_active = true
      and g.is_active = true
  ),
  observed as (
    select
      p.metric_key,
      min(m.metric_date)
        filter (
          where m.metric_date >= p.observation_start
            and m.metric_date <= v_as_of
        ) as first_observed_date,
      max(m.metric_date)
        filter (
          where m.metric_date >= p.observation_start
            and m.metric_date <= v_as_of
        ) as last_observed_date,
      count(distinct m.metric_date)
        filter (
          where m.metric_date >= p.observation_start
            and m.metric_date <= v_last_complete_date
        )::integer as complete_days
    from policy p
    left join public.dad_daily_metrics m
      on m.metric_key = p.metric_key
      and m.dimension_type = 'global'
      and m.dimension_value = 'all'
    group by p.metric_key
  ),
  complete_dates as (
    select
      p.metric_key,
      p.observation_start,
      m.metric_date
    from policy p
    join public.dad_daily_metrics m
      on m.metric_key = p.metric_key
      and m.dimension_type = 'global'
      and m.dimension_value = 'all'
      and m.metric_date >= p.observation_start
      and m.metric_date <= v_last_complete_date
  ),
  week_counts as (
    select
      d.metric_key,
      date_trunc(
        'week',
        d.metric_date::timestamp
      )::date as week_start,
      min(d.observation_start) as observation_start,
      count(distinct d.metric_date)::integer as observed_days
    from complete_dates d
    group by
      d.metric_key,
      date_trunc('week', d.metric_date::timestamp)::date
  ),
  weeks as (
    select
      w.metric_key,
      count(*) filter (
        where w.week_start >= w.observation_start
          and w.week_start + 6 <= v_last_complete_date
          and w.observed_days = 7
      )::integer as complete_weeks
    from week_counts w
    group by w.metric_key
  ),
  month_counts as (
    select
      d.metric_key,
      date_trunc(
        'month',
        d.metric_date::timestamp
      )::date as month_start,
      min(d.observation_start) as observation_start,
      count(distinct d.metric_date)::integer as observed_days
    from complete_dates d
    group by
      d.metric_key,
      date_trunc('month', d.metric_date::timestamp)::date
  ),
  months as (
    select
      m.metric_key,
      count(*) filter (
        where m.month_start >= m.observation_start
          and (
            m.month_start
            + interval '1 month - 1 day'
          )::date <= v_last_complete_date
          and m.observed_days = (
            (
              m.month_start
              + interval '1 month - 1 day'
            )::date
            - m.month_start
            + 1
          )
      )::integer as complete_months
    from month_counts m
    group by m.metric_key
  ),
  resolved as (
    select
      p.metric_key,
      p.display_name,
      p.domain,
      p.benchmark_basis,
      p.primary_grain,
      p.observation_start,
      o.first_observed_date,
      o.last_observed_date,
      coalesce(o.complete_days, 0) as complete_days,
      coalesce(w.complete_weeks, 0) as complete_weeks,
      coalesce(m.complete_months, 0) as complete_months,
      p.min_complete_days,
      p.min_complete_weeks,
      p.min_complete_months,
      p.min_denominator_events,
      p.readiness_rule,
      p.dependency_note
    from policy p
    left join observed o
      on o.metric_key = p.metric_key
    left join weeks w
      on w.metric_key = p.metric_key
    left join months m
      on m.metric_key = p.metric_key
  )
  select
    r.metric_key,
    r.display_name,
    r.domain,
    r.benchmark_basis,
    r.primary_grain,
    r.observation_start,
    r.first_observed_date,
    r.last_observed_date,
    r.complete_days,
    r.complete_weeks,
    r.complete_months,
    r.min_complete_days,
    r.min_complete_weeks,
    r.min_complete_months,
    r.min_denominator_events,
    case
      when r.benchmark_basis in (
        'derived_kpi_required',
        'instrumentation_dependency'
      ) then 'blocked'
      when r.complete_days = 0 then 'insufficient'
      when r.complete_days >= r.min_complete_days
        and r.complete_weeks >= r.min_complete_weeks
        and r.complete_months >= r.min_complete_months
        then 'eligible_for_review'
      else 'collecting'
    end as readiness_state,
    case
      when r.benchmark_basis in (
        'derived_kpi_required',
        'instrumentation_dependency'
      ) then coalesce(
        r.dependency_note,
        r.readiness_rule
      )
      when r.complete_days = 0 then
        'No complete post-baseline observation days are available yet.'
      when r.complete_days >= r.min_complete_days
        and r.complete_weeks >= r.min_complete_weeks
        and r.complete_months >= r.min_complete_months
        then
          'Minimum evidence gate met. Eligible for benchmark review; no benchmark is activated automatically.'
      else format(
        'Collecting evidence: %s complete days, %s complete weeks and %s complete months.',
        r.complete_days,
        r.complete_weeks,
        r.complete_months
      )
    end as readiness_reason
  from resolved r
  order by r.domain, r.metric_key;
end;
$$;

revoke all
on function public.get_dad_trend_readiness(date)
from public, anon, authenticated;

grant execute
on function public.get_dad_trend_readiness(date)
to authenticated;
