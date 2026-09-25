-- DAD Derived KPI Foundation v1
--
-- Purpose:
-- Convert selected cumulative/raw DAD counts into normalized decision,
-- activation and outcome rates suitable for trend observation.
--
-- Governance:
-- - These are not benchmarks.
-- - Pre-pilot reference values are frozen reviewed measurements.
-- - Structured observation begins 2026-09-26 UTC.
-- - Existing 17 core DAD metrics remain unchanged.
-- - Derived KPI benchmark and threshold states remain pending.
--
-- Instrumentation:
-- Only behavior that cannot be reconstructed reliably from durable source
-- records is added to analytics_events:
--   1. connection accepted/declined decisions, because a later disconnect
--      mutates the same connection row;
--   2. milestone/action-item cancellation time, because those tables do not
--      carry a cancelled_at timestamp.
--
-- This migration must be applied before 2026-09-26 UTC unless a deliberate
-- event backfill strategy is added first.

do $$
begin
  if (now() at time zone 'UTC')::date > date '2026-09-25' then
    raise exception
      'DAD derived KPI foundation must be applied before 2026-09-26 UTC or reviewed with an explicit event backfill.';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Derived KPI governance
-- ---------------------------------------------------------------------------

create table public.dad_derived_kpi_governance (
  kpi_key text primary key,

  display_name text not null,
  domain text not null,

  definition text not null,
  numerator_definition text not null,
  denominator_definition text not null,

  source_relations text[] not null,

  observation_start date not null,
  time_basis text not null default 'UTC'
    check (length(trim(time_basis)) > 0),

  time_rule text not null
    check (length(trim(time_rule)) > 0),

  unit text not null default 'percent'
    check (unit = 'percent'),

  privacy_class text not null default 'aggregate_internal'
    check (
      privacy_class in (
        'aggregate_internal',
        'restricted_aggregate'
      )
    ),

  owner_role text not null default 'platform_admin',

  reference_as_of date not null,

  reference_numerator bigint not null
    check (reference_numerator >= 0),

  reference_denominator bigint not null
    check (reference_denominator >= 0),

  reference_value numeric(12,4),

  min_complete_days integer not null default 28
    check (min_complete_days >= 0),

  min_complete_weeks integer not null default 4
    check (min_complete_weeks >= 0),

  min_denominator_events integer not null default 30
    check (min_denominator_events >= 0),

  benchmark_status text not null default 'pending'
    check (
      benchmark_status in (
        'pending',
        'internal',
        'external',
        'hybrid'
      )
    ),

  threshold_status text not null default 'pending'
    check (
      threshold_status in (
        'pending',
        'draft',
        'active'
      )
    ),

  governance_version integer not null default 1
    check (governance_version > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (length(trim(kpi_key)) > 0),
  check (length(trim(display_name)) > 0),
  check (length(trim(domain)) > 0),

  check (
    reference_value is null
    or (
      reference_denominator > 0
      and reference_value >= 0
      and reference_value <= 100
    )
  )
);

create index dad_derived_kpi_governance_domain_idx
  on public.dad_derived_kpi_governance (
    domain,
    is_active
  );


-- ---------------------------------------------------------------------------
-- Daily cumulative post-baseline derived KPI snapshots
-- ---------------------------------------------------------------------------

create table public.dad_derived_kpi_daily (
  kpi_date date not null,

  kpi_key text not null
    references public.dad_derived_kpi_governance(kpi_key)
    on update cascade
    on delete cascade,

  numerator bigint not null
    check (numerator >= 0),

  denominator bigint not null
    check (denominator >= 0),

  kpi_value numeric(12,4),

  calculated_at timestamptz not null default now(),

  primary key (
    kpi_date,
    kpi_key
  ),

  check (numerator <= denominator),

  check (
    kpi_value is null
    or (
      denominator > 0
      and kpi_value >= 0
      and kpi_value <= 100
    )
  )
);

create index dad_derived_kpi_daily_metric_date_idx
  on public.dad_derived_kpi_daily (
    kpi_key,
    kpi_date desc
  );


-- ---------------------------------------------------------------------------
-- Core metric -> normalized KPI relationships
-- ---------------------------------------------------------------------------

create table public.dad_metric_derived_kpi_links (
  metric_key text not null
    references public.dad_metric_governance(metric_key)
    on update cascade
    on delete cascade,

  kpi_key text not null
    references public.dad_derived_kpi_governance(kpi_key)
    on update cascade
    on delete cascade,

  relation_type text not null default 'normalized_companion'
    check (
      relation_type = 'normalized_companion'
    ),

  rationale text not null
    check (length(trim(rationale)) > 0),

  primary key (
    metric_key,
    kpi_key
  )
);


-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

alter table public.dad_derived_kpi_governance
  enable row level security;

alter table public.dad_derived_kpi_daily
  enable row level security;

alter table public.dad_metric_derived_kpi_links
  enable row level security;


revoke all
on table public.dad_derived_kpi_governance
from public, anon, authenticated;

revoke all
on table public.dad_derived_kpi_daily
from public, anon, authenticated;

revoke all
on table public.dad_metric_derived_kpi_links
from public, anon, authenticated;


grant select
on table public.dad_derived_kpi_governance
to authenticated;

grant select
on table public.dad_derived_kpi_daily
to authenticated;

grant select
on table public.dad_metric_derived_kpi_links
to authenticated;


create policy dad_derived_kpi_governance_select_dad
on public.dad_derived_kpi_governance
for select
to authenticated
using ((select public.has_dad_access()));


create policy dad_derived_kpi_daily_select_dad
on public.dad_derived_kpi_daily
for select
to authenticated
using ((select public.has_dad_access()));


create policy dad_metric_derived_kpi_links_select_dad
on public.dad_metric_derived_kpi_links
for select
to authenticated
using ((select public.has_dad_access()));


-- ---------------------------------------------------------------------------
-- Pre-pilot reference drift guard
--
-- Reviewed state at the 2026-09-25 UTC cutoff:
--
-- connection decision acceptance        6 / 6   = 100%
-- mentorship request acceptance         8 / 10  = 80%
-- 7-day workboard activation            6 / 8   = 75%
-- mentorship terminal completion        6 / 6   = 100%
-- milestone terminal completion         5 / 8   = 62.5%
-- action-item terminal completion      13 / 13  = 100%
--
-- These are descriptive references, not benchmarks.
-- ---------------------------------------------------------------------------

do $$
declare
  v_cutoff constant timestamptz :=
    timestamptz '2026-09-26 00:00:00+00';

  v_numerator bigint;
  v_denominator bigint;
begin
  -- Connection decisions.
  select
    count(*) filter (
      where status = 'accepted'
        and created_at < v_cutoff
    ),
    count(*) filter (
      where status in (
        'accepted',
        'declined'
      )
        and created_at < v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.connections;

  if v_numerator <> 6
    or v_denominator <> 6 then
    raise exception
      'Connection pre-pilot reference drifted: expected 6/6, found %/%',
      v_numerator,
      v_denominator;
  end if;


  -- Mentorship request decisions.
  select
    count(*) filter (
      where status = 'accepted'
        and requested_at < v_cutoff
    ),
    count(*) filter (
      where status in (
        'accepted',
        'declined'
      )
        and requested_at < v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.mentorship_requests;

  if v_numerator <> 8
    or v_denominator <> 10 then
    raise exception
      'Mentorship request pre-pilot reference drifted: expected 8/10, found %/%',
      v_numerator,
      v_denominator;
  end if;


  -- 7-day mentorship workboard activation.
  select
    count(*) filter (
      where
        m.created_at < v_cutoff
        and m.created_at + interval '7 days' <= v_cutoff
        and (
          exists (
            select 1
            from public.mentorship_milestones ms
            where ms.mentorship_id = m.id
              and ms.created_at >= m.created_at
              and ms.created_at <
                m.created_at + interval '7 days'
          )
          or exists (
            select 1
            from public.mentorship_action_items ai
            where ai.mentorship_id = m.id
              and ai.created_at >= m.created_at
              and ai.created_at <
                m.created_at + interval '7 days'
          )
        )
    ),
    count(*) filter (
      where
        m.created_at < v_cutoff
        and m.created_at + interval '7 days' <= v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.mentorships m;

  if v_numerator <> 6
    or v_denominator <> 8 then
    raise exception
      'Workboard activation pre-pilot reference drifted: expected 6/8, found %/%',
      v_numerator,
      v_denominator;
  end if;


  -- Mentorship terminal outcome.
  select
    count(*) filter (
      where status = 'completed'
        and created_at < v_cutoff
    ),
    count(*) filter (
      where status in (
        'completed',
        'cancelled',
        'ended_early'
      )
        and created_at < v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.mentorships;

  if v_numerator <> 6
    or v_denominator <> 6 then
    raise exception
      'Mentorship terminal pre-pilot reference drifted: expected 6/6, found %/%',
      v_numerator,
      v_denominator;
  end if;


  -- Milestone terminal outcome.
  select
    count(*) filter (
      where status = 'completed'
        and created_at < v_cutoff
    ),
    count(*) filter (
      where status in (
        'completed',
        'cancelled'
      )
        and created_at < v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.mentorship_milestones;

  if v_numerator <> 5
    or v_denominator <> 8 then
    raise exception
      'Milestone terminal pre-pilot reference drifted: expected 5/8, found %/%',
      v_numerator,
      v_denominator;
  end if;


  -- Action-item terminal outcome.
  select
    count(*) filter (
      where status = 'completed'
        and created_at < v_cutoff
    ),
    count(*) filter (
      where status in (
        'completed',
        'cancelled'
      )
        and created_at < v_cutoff
    )
  into
    v_numerator,
    v_denominator
  from public.mentorship_action_items;

  if v_numerator <> 13
    or v_denominator <> 13 then
    raise exception
      'Action-item terminal pre-pilot reference drifted: expected 13/13, found %/%',
      v_numerator,
      v_denominator;
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Freeze reviewed derived KPI governance/reference values
-- ---------------------------------------------------------------------------

insert into public.dad_derived_kpi_governance (
  kpi_key,
  display_name,
  domain,
  definition,
  numerator_definition,
  denominator_definition,
  source_relations,
  observation_start,
  time_rule,
  reference_as_of,
  reference_numerator,
  reference_denominator,
  reference_value,
  min_complete_days,
  min_complete_weeks,
  min_denominator_events
)
values
  (
    'connection_decision_acceptance_rate',
    'Connection decision acceptance rate',
    'connections',
    'Share of post-baseline connection-request decisions that were accepted.',
    'Immutable accepted connection-request decision events.',
    'Immutable accepted or declined connection-request decision events.',
    array[
      'connections',
      'analytics_events'
    ]::text[],
    date '2026-09-26',
    'Cumulative post-baseline request-cycle rate. Accepted and declined transitions are recorded as immutable database analytics events because a later disconnect mutates the same connection row.',
    date '2026-09-25',
    6,
    6,
    100.0000,
    28,
    4,
    30
  ),
  (
    'mentorship_request_acceptance_rate',
    'Mentorship request acceptance rate',
    'mentorship',
    'Share of resolved post-baseline mentorship requests that were accepted.',
    'Post-baseline mentorship requests with a durable request_accepted audit event.',
    'Post-baseline mentorship requests with a durable request_accepted or request_declined audit event.',
    array[
      'mentorship_requests',
      'mentorship_audit_events'
    ]::text[],
    date '2026-09-26',
    'Cumulative post-baseline request cohort using durable mentorship audit events. Pending, change-proposed, cancelled and expired requests do not enter the resolved-decision denominator.',
    date '2026-09-25',
    8,
    10,
    80.0000,
    28,
    4,
    30
  ),
  (
    'mentorship_workboard_activation_7d_rate',
    '7-day mentorship workboard activation rate',
    'mentorship',
    'Share of matured post-baseline mentorships that received a milestone or action item within seven days of creation.',
    'Post-baseline mentorships with at least one milestone or action item created within seven days of mentorship creation.',
    'Post-baseline mentorships whose full seven-day activation window has elapsed.',
    array[
      'mentorships',
      'mentorship_milestones',
      'mentorship_action_items'
    ]::text[],
    date '2026-09-26',
    'Seven-day cohort activation. A mentorship enters the denominator only after its complete seven-day activation window has elapsed, preventing immature cohorts from being treated as failures.',
    date '2026-09-25',
    6,
    8,
    75.0000,
    28,
    4,
    30
  ),
  (
    'mentorship_terminal_completion_rate',
    'Mentorship terminal completion rate',
    'mentorship',
    'Share of concluded post-baseline mentorships that completed successfully rather than being cancelled or ended early.',
    'Post-baseline mentorships with completed_at before the snapshot boundary.',
    'Post-baseline mentorships with completed_at, cancelled_at or ended_early_at before the snapshot boundary.',
    array[
      'mentorships'
    ]::text[],
    date '2026-09-26',
    'Cumulative post-baseline terminal-outcome rate using durable lifecycle timestamps. Active and transitional mentorships remain outside the denominator.',
    date '2026-09-25',
    6,
    6,
    100.0000,
    28,
    4,
    30
  ),
  (
    'milestone_terminal_completion_rate',
    'Milestone terminal completion rate',
    'mentorship',
    'Share of terminal post-baseline milestones that were completed rather than cancelled.',
    'Post-baseline milestones with completed_at before the snapshot boundary.',
    'Post-baseline completed milestones plus immutable post-baseline milestone-cancellation events before the snapshot boundary.',
    array[
      'mentorship_milestones',
      'analytics_events'
    ]::text[],
    date '2026-09-26',
    'Cumulative post-baseline terminal milestone rate. Completion time comes from completed_at; cancellation time is captured as a minimal immutable database analytics event.',
    date '2026-09-25',
    5,
    8,
    62.5000,
    28,
    4,
    30
  ),
  (
    'action_item_terminal_completion_rate',
    'Action-item terminal completion rate',
    'mentorship',
    'Share of terminal post-baseline action items that were completed rather than cancelled.',
    'Post-baseline action items with completed_at before the snapshot boundary.',
    'Post-baseline completed action items plus immutable post-baseline action-item cancellation events before the snapshot boundary.',
    array[
      'mentorship_action_items',
      'analytics_events'
    ]::text[],
    date '2026-09-26',
    'Cumulative post-baseline terminal action-item rate. Completion time comes from completed_at; cancellation time is captured as a minimal immutable database analytics event.',
    date '2026-09-25',
    13,
    13,
    100.0000,
    28,
    4,
    30
  );


-- ---------------------------------------------------------------------------
-- Map raw core metrics to normalized companions
-- ---------------------------------------------------------------------------

insert into public.dad_metric_derived_kpi_links (
  metric_key,
  kpi_key,
  rationale
)
values
  (
    'connections_total',
    'connection_decision_acceptance_rate',
    'Connection-request volume is scale-dependent; acceptance among actual decisions supplies normalized conversion context.'
  ),
  (
    'connections_accepted',
    'connection_decision_acceptance_rate',
    'Cumulative accepted connections are scale-dependent; decision acceptance rate is the normalized analytical companion.'
  ),
  (
    'mentorship_requests_total',
    'mentorship_request_acceptance_rate',
    'Request volume is scale-dependent; acceptance among resolved mentorship requests supplies normalized conversion context.'
  ),
  (
    'mentorship_requests_accepted',
    'mentorship_request_acceptance_rate',
    'Cumulative accepted requests are scale-dependent; request acceptance rate is the normalized analytical companion.'
  ),
  (
    'mentorships_active',
    'mentorship_workboard_activation_7d_rate',
    'Active mentorship count is operational inventory; seven-day workboard activation measures whether a new mentorship begins producing structured activity.'
  ),
  (
    'mentorships_completed',
    'mentorship_terminal_completion_rate',
    'Cumulative completed mentorship count is scale-dependent; terminal completion rate normalizes successful versus unsuccessful conclusions.'
  ),
  (
    'mentorship_milestones_completed',
    'milestone_terminal_completion_rate',
    'Cumulative milestone completions are scale-dependent; terminal completion rate normalizes completed versus cancelled milestone outcomes.'
  ),
  (
    'mentorship_action_items_completed',
    'action_item_terminal_completion_rate',
    'Cumulative completed action items are scale-dependent; terminal completion rate normalizes completed versus cancelled action-item outcomes.'
  );


-- ---------------------------------------------------------------------------
-- Minimal immutable event capture: connection decisions
-- ---------------------------------------------------------------------------

create or replace function private.record_dad_connection_decision_event()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_changed boolean;
begin
  if new.created_at <
    timestamptz '2026-09-26 00:00:00+00' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed :=
      old.status is distinct from new.status;
  end if;

  if v_changed
    and new.status in (
      'accepted',
      'declined'
    ) then

    insert into public.analytics_events (
      user_id,
      event_name,
      feature,
      occurred_at,
      related_user_id,
      connection_id,
      source,
      context
    )
    values (
      new.recipient_id,
      case new.status
        when 'accepted'
          then 'dad_connection_request_accepted'
        else 'dad_connection_request_declined'
      end,
      'connections',
      coalesce(
        new.responded_at,
        now()
      ),
      new.requester_id,
      new.id,
      'dad_database_trigger_v1',
      jsonb_build_object(
        'status',
        new.status
      )
    );
  end if;

  return new;
end;
$$;

revoke all
on function private.record_dad_connection_decision_event()
from public, anon, authenticated;


create trigger dad_capture_connection_decision
after insert or update of status
on public.connections
for each row
execute function private.record_dad_connection_decision_event();


-- ---------------------------------------------------------------------------
-- Minimal immutable event capture: milestone cancellation
--
-- completed_at already gives a durable completion timestamp; only
-- cancellation needs supplemental event timing.
-- ---------------------------------------------------------------------------

create or replace function private.record_dad_milestone_cancellation_event()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_changed boolean;
begin
  if new.created_at <
    timestamptz '2026-09-26 00:00:00+00' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed :=
      old.status is distinct from new.status;
  end if;

  if v_changed
    and new.status = 'cancelled' then

    insert into public.analytics_events (
      user_id,
      event_name,
      feature,
      occurred_at,
      mentorship_id,
      source,
      context
    )
    values (
      new.created_by,
      'dad_mentorship_milestone_cancelled',
      'mentorship',
      now(),
      new.mentorship_id,
      'dad_database_trigger_v1',
      jsonb_build_object(
        'status',
        new.status
      )
    );
  end if;

  return new;
end;
$$;

revoke all
on function private.record_dad_milestone_cancellation_event()
from public, anon, authenticated;


create trigger dad_capture_milestone_cancellation
after insert or update of status
on public.mentorship_milestones
for each row
execute function private.record_dad_milestone_cancellation_event();


-- ---------------------------------------------------------------------------
-- Minimal immutable event capture: action-item cancellation
-- ---------------------------------------------------------------------------

create or replace function private.record_dad_action_item_cancellation_event()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_changed boolean;
begin
  if new.created_at <
    timestamptz '2026-09-26 00:00:00+00' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed :=
      old.status is distinct from new.status;
  end if;

  if v_changed
    and new.status = 'cancelled' then

    insert into public.analytics_events (
      user_id,
      event_name,
      feature,
      occurred_at,
      mentorship_id,
      source,
      context
    )
    values (
      new.created_by,
      'dad_mentorship_action_item_cancelled',
      'mentorship',
      now(),
      new.mentorship_id,
      'dad_database_trigger_v1',
      jsonb_build_object(
        'status',
        new.status
      )
    );
  end if;

  return new;
end;
$$;

revoke all
on function private.record_dad_action_item_cancellation_event()
from public, anon, authenticated;


create trigger dad_capture_action_item_cancellation
after insert or update of status
on public.mentorship_action_items
for each row
execute function private.record_dad_action_item_cancellation_event();


-- ---------------------------------------------------------------------------
-- Derived KPI refresh
--
-- Each stored row is a cumulative as-of-end-of-date post-baseline snapshot.
-- The current date may be refreshed provisionally.
-- Yesterday is refreshed by the daily cron after the day has fully closed.
-- ---------------------------------------------------------------------------

create or replace function private.refresh_dad_derived_kpis(
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_observation_start constant date :=
    date '2026-09-26';

  v_start constant timestamptz :=
    timestamptz '2026-09-26 00:00:00+00';

  v_today_utc date :=
    (now() at time zone 'UTC')::date;

  v_end timestamptz;
begin
  if p_date < v_observation_start then
    return;
  end if;

  if p_date > v_today_utc then
    raise exception
      'Derived KPI snapshots cannot be refreshed for a future UTC date.';
  end if;

  v_end :=
    ((p_date + 1)::timestamp at time zone 'UTC');


  with calculated as (

    -- 1. Connection decision acceptance rate.
    select
      'connection_decision_acceptance_rate'::text
        as kpi_key,

      count(*) filter (
        where e.event_name =
          'dad_connection_request_accepted'
      )::bigint as numerator,

      count(*) filter (
        where e.event_name in (
          'dad_connection_request_accepted',
          'dad_connection_request_declined'
        )
      )::bigint as denominator

    from public.analytics_events e
    where e.source = 'dad_database_trigger_v1'
      and e.feature = 'connections'
      and e.occurred_at >= v_start
      and e.occurred_at < v_end


    union all


    -- 2. Mentorship request acceptance rate.
    select
      'mentorship_request_acceptance_rate',

      count(*) filter (
        where e.event_type = 'request_accepted'
      )::bigint,

      count(*) filter (
        where e.event_type in (
          'request_accepted',
          'request_declined'
        )
      )::bigint

    from public.mentorship_audit_events e
    join public.mentorship_requests r
      on r.id = e.request_id
    where r.requested_at >= v_start
      and e.created_at < v_end
      and e.event_type in (
        'request_accepted',
        'request_declined'
      )


    union all


    -- 3. Seven-day mentorship workboard activation.
    select
      'mentorship_workboard_activation_7d_rate',

      count(*) filter (
        where
          m.created_at >= v_start
          and m.created_at + interval '7 days'
            <= v_end
          and (
            exists (
              select 1
              from public.mentorship_milestones ms
              where ms.mentorship_id = m.id
                and ms.created_at >= m.created_at
                and ms.created_at <
                  m.created_at + interval '7 days'
                and ms.created_at < v_end
            )
            or exists (
              select 1
              from public.mentorship_action_items ai
              where ai.mentorship_id = m.id
                and ai.created_at >= m.created_at
                and ai.created_at <
                  m.created_at + interval '7 days'
                and ai.created_at < v_end
            )
          )
      )::bigint,

      count(*) filter (
        where
          m.created_at >= v_start
          and m.created_at + interval '7 days'
            <= v_end
      )::bigint

    from public.mentorships m


    union all


    -- 4. Mentorship terminal completion.
    select
      'mentorship_terminal_completion_rate',

      count(*) filter (
        where
          m.created_at >= v_start
          and m.completed_at is not null
          and m.completed_at < v_end
      )::bigint,

      count(*) filter (
        where
          m.created_at >= v_start
          and (
            (
              m.completed_at is not null
              and m.completed_at < v_end
            )
            or (
              m.cancelled_at is not null
              and m.cancelled_at < v_end
            )
            or (
              m.ended_early_at is not null
              and m.ended_early_at < v_end
            )
          )
      )::bigint

    from public.mentorships m


    union all


    -- 5. Milestone terminal completion.
    select
      'milestone_terminal_completion_rate',

      (
        select count(*)::bigint
        from public.mentorship_milestones ms
        where ms.created_at >= v_start
          and ms.completed_at is not null
          and ms.completed_at < v_end
      ),

      (
        (
          select count(*)::bigint
          from public.mentorship_milestones ms
          where ms.created_at >= v_start
            and ms.completed_at is not null
            and ms.completed_at < v_end
        )
        +
        (
          select count(*)::bigint
          from public.analytics_events e
          where e.source =
              'dad_database_trigger_v1'
            and e.event_name =
              'dad_mentorship_milestone_cancelled'
            and e.occurred_at >= v_start
            and e.occurred_at < v_end
        )
      )


    union all


    -- 6. Action-item terminal completion.
    select
      'action_item_terminal_completion_rate',

      (
        select count(*)::bigint
        from public.mentorship_action_items ai
        where ai.created_at >= v_start
          and ai.completed_at is not null
          and ai.completed_at < v_end
      ),

      (
        (
          select count(*)::bigint
          from public.mentorship_action_items ai
          where ai.created_at >= v_start
            and ai.completed_at is not null
            and ai.completed_at < v_end
        )
        +
        (
          select count(*)::bigint
          from public.analytics_events e
          where e.source =
              'dad_database_trigger_v1'
            and e.event_name =
              'dad_mentorship_action_item_cancelled'
            and e.occurred_at >= v_start
            and e.occurred_at < v_end
        )
      )
  )

  insert into public.dad_derived_kpi_daily (
    kpi_date,
    kpi_key,
    numerator,
    denominator,
    kpi_value,
    calculated_at
  )
  select
    p_date,
    c.kpi_key,
    c.numerator,
    c.denominator,

    case
      when c.denominator = 0 then null
      else round(
        100.0
        * c.numerator
        / c.denominator,
        4
      )
    end,

    now()

  from calculated c

  on conflict (
    kpi_date,
    kpi_key
  )
  do update set
    numerator = excluded.numerator,
    denominator = excluded.denominator,
    kpi_value = excluded.kpi_value,
    calculated_at = excluded.calculated_at;
end;
$$;

revoke all
on function private.refresh_dad_derived_kpis(date)
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Daily DAD orchestration
--
-- Yesterday's derived snapshot is finalized after the complete UTC day has
-- closed. Today's snapshot is then refreshed as provisional current state.
-- ---------------------------------------------------------------------------

create or replace function private.run_dad_daily_refresh()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_today_utc date :=
    (now() at time zone 'UTC')::date;
begin
  perform private.finalize_dad_daily_flow_metrics(
    v_today_utc - 1
  );

  perform private.refresh_dad_daily_metrics(
    v_today_utc
  );

  perform private.refresh_dad_derived_kpis(
    v_today_utc - 1
  );

  perform private.refresh_dad_derived_kpis(
    v_today_utc
  );
end;
$$;

revoke all
on function private.run_dad_daily_refresh()
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Manual DAD refresh
--
-- Preserve existing core-metric behavior. Derived KPIs are refreshed only for
-- the current UTC date so manually revisiting an old core date does not rewrite
-- a finalized historical derived-KPI snapshot.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_dad_metrics(
  p_date date default current_date
)
returns timestamptz
language plpgsql
security definer
set search_path = public, private
as $$
declare
  refreshed_at timestamptz := now();

  v_today_utc date :=
    (now() at time zone 'UTC')::date;
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required';
  end if;

  perform private.refresh_dad_daily_metrics(
    p_date
  );

  if p_date = v_today_utc then
    perform private.refresh_dad_derived_kpis(
      p_date
    );
  end if;

  return refreshed_at;
end;
$$;

revoke all
on function public.refresh_dad_metrics(date)
from public, anon, authenticated;

grant execute
on function public.refresh_dad_metrics(date)
to authenticated;


-- ---------------------------------------------------------------------------
-- Derived KPI trend RPC
--
-- Because each daily row is a cumulative as-of-date snapshot, larger-grain
-- periods use the latest snapshot in the period rather than summing daily
-- percentages.
-- ---------------------------------------------------------------------------

create or replace function public.get_dad_derived_kpi_trend(
  p_kpi_key text,
  p_grain text default 'week',
  p_start date default date '2026-09-26',
  p_end date default current_date
)
returns table (
  period_start date,
  period_end date,
  kpi_value numeric,
  numerator bigint,
  denominator bigint,
  observation_count integer,
  is_complete_period boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_policy public.dad_derived_kpi_governance%rowtype;

  v_start date;
  v_end date;

  v_today_utc date;
  v_last_complete_date date;
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required.'
      using errcode = '42501';
  end if;

  if p_grain not in (
    'day',
    'week',
    'month'
  ) then
    raise exception
      'Unsupported derived KPI grain: %. Expected day, week or month.',
      p_grain;
  end if;

  select *
  into v_policy
  from public.dad_derived_kpi_governance
  where kpi_key = p_kpi_key
    and is_active = true;

  if not found then
    raise exception
      'No active derived KPI governance exists for %.',
      p_kpi_key;
  end if;

  v_today_utc :=
    (now() at time zone 'UTC')::date;

  v_start :=
    greatest(
      p_start,
      v_policy.observation_start
    );

  v_end :=
    least(
      p_end,
      v_today_utc
    );

  v_last_complete_date :=
    least(
      p_end,
      v_today_utc
    ) - 1;

  if v_end < v_start then
    return;
  end if;

  return query
  with base as (
    select
      d.kpi_date,
      d.kpi_value,
      d.numerator,
      d.denominator
    from public.dad_derived_kpi_daily d
    where d.kpi_key = p_kpi_key
      and d.kpi_date between
        v_start and v_end
  ),
  bucketed as (
    select
      case p_grain
        when 'day' then b.kpi_date
        else date_trunc(
          p_grain,
          b.kpi_date::timestamp
        )::date
      end as bucket_start,

      b.kpi_date,
      b.kpi_value,
      b.numerator,
      b.denominator

    from base b
  ),
  aggregated as (
    select
      b.bucket_start,

      case p_grain
        when 'day'
          then b.bucket_start

        when 'week'
          then b.bucket_start + 6

        when 'month'
          then (
            b.bucket_start
            + interval '1 month - 1 day'
          )::date
      end as bucket_end,

      (
        array_agg(
          b.kpi_value
          order by b.kpi_date desc
        )
      )[1] as bucket_value,

      (
        array_agg(
          b.numerator
          order by b.kpi_date desc
        )
      )[1] as bucket_numerator,

      (
        array_agg(
          b.denominator
          order by b.kpi_date desc
        )
      )[1] as bucket_denominator,

      count(
        distinct b.kpi_date
      )::integer as observed_days

    from bucketed b
    group by b.bucket_start
  )

  select
    a.bucket_start,
    a.bucket_end,
    a.bucket_value,
    a.bucket_numerator,
    a.bucket_denominator,
    a.observed_days,

    (
      a.bucket_start >=
        v_policy.observation_start

      and a.bucket_end <=
        v_last_complete_date

      and a.observed_days = (
        a.bucket_end
        - a.bucket_start
        + 1
      )
    ) as complete_period

  from aggregated a
  order by a.bucket_start;
end;
$$;

revoke all
on function public.get_dad_derived_kpi_trend(
  text,
  text,
  date,
  date
)
from public, anon, authenticated;

grant execute
on function public.get_dad_derived_kpi_trend(
  text,
  text,
  date,
  date
)
to authenticated;


-- ---------------------------------------------------------------------------
-- Derived KPI benchmark-readiness RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_dad_derived_kpi_readiness(
  p_as_of date default current_date
)
returns table (
  kpi_key text,
  display_name text,
  domain text,

  reference_value numeric,
  latest_value numeric,

  evidence_numerator bigint,
  evidence_denominator bigint,

  observation_start date,
  first_observed_date date,
  last_observed_date date,

  complete_days integer,
  complete_weeks integer,

  min_complete_days integer,
  min_complete_weeks integer,
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

  v_today_utc :=
    (now() at time zone 'UTC')::date;

  v_as_of :=
    least(
      p_as_of,
      v_today_utc
    );

  v_last_complete_date :=
    v_as_of - 1;

  return query
  with policy as (
    select *
    from public.dad_derived_kpi_governance
    where is_active = true
  ),

  observed as (
    select
      p.kpi_key,

      min(d.kpi_date) filter (
        where
          d.kpi_date >=
            p.observation_start
          and d.kpi_date <=
            v_as_of
      ) as first_observed_date,

      max(d.kpi_date) filter (
        where
          d.kpi_date >=
            p.observation_start
          and d.kpi_date <=
            v_as_of
      ) as last_observed_date,

      count(
        distinct d.kpi_date
      ) filter (
        where
          d.kpi_date >=
            p.observation_start
          and d.kpi_date <=
            v_last_complete_date
      )::integer as complete_days

    from policy p

    left join public.dad_derived_kpi_daily d
      on d.kpi_key = p.kpi_key

    group by p.kpi_key
  ),

  complete_dates as (
    select
      p.kpi_key,
      p.observation_start,
      d.kpi_date

    from policy p

    join public.dad_derived_kpi_daily d
      on d.kpi_key = p.kpi_key
      and d.kpi_date >=
        p.observation_start
      and d.kpi_date <=
        v_last_complete_date
  ),

  week_counts as (
    select
      d.kpi_key,

      date_trunc(
        'week',
        d.kpi_date::timestamp
      )::date as week_start,

      min(
        d.observation_start
      ) as observation_start,

      count(
        distinct d.kpi_date
      )::integer as observed_days

    from complete_dates d

    group by
      d.kpi_key,
      date_trunc(
        'week',
        d.kpi_date::timestamp
      )::date
  ),

  weeks as (
    select
      w.kpi_key,

      count(*) filter (
        where
          w.week_start >=
            w.observation_start

          and w.week_start + 6 <=
            v_last_complete_date

          and w.observed_days = 7
      )::integer as complete_weeks

    from week_counts w

    group by w.kpi_key
  ),

  latest_complete as (
    select distinct on (
      d.kpi_key
    )
      d.kpi_key,
      d.kpi_value,
      d.numerator,
      d.denominator

    from public.dad_derived_kpi_daily d

    join policy p
      on p.kpi_key = d.kpi_key

    where
      d.kpi_date >=
        p.observation_start

      and d.kpi_date <=
        v_last_complete_date

    order by
      d.kpi_key,
      d.kpi_date desc
  ),

  resolved as (
    select
      p.kpi_key,
      p.display_name,
      p.domain,
      p.reference_value,

      lc.kpi_value as latest_value,

      coalesce(
        lc.numerator,
        0
      )::bigint as evidence_numerator,

      coalesce(
        lc.denominator,
        0
      )::bigint as evidence_denominator,

      p.observation_start,

      o.first_observed_date,
      o.last_observed_date,

      coalesce(
        o.complete_days,
        0
      ) as complete_days,

      coalesce(
        w.complete_weeks,
        0
      ) as complete_weeks,

      p.min_complete_days,
      p.min_complete_weeks,
      p.min_denominator_events

    from policy p

    left join observed o
      on o.kpi_key = p.kpi_key

    left join weeks w
      on w.kpi_key = p.kpi_key

    left join latest_complete lc
      on lc.kpi_key = p.kpi_key
  )

  select
    r.kpi_key,
    r.display_name,
    r.domain,

    r.reference_value,
    r.latest_value,

    r.evidence_numerator,
    r.evidence_denominator,

    r.observation_start,
    r.first_observed_date,
    r.last_observed_date,

    r.complete_days,
    r.complete_weeks,

    r.min_complete_days,
    r.min_complete_weeks,
    r.min_denominator_events,

    case
      when
        r.complete_days = 0
        then 'insufficient'

      when
        r.evidence_denominator = 0
        then 'insufficient'

      when
        r.complete_days >=
          r.min_complete_days

        and r.complete_weeks >=
          r.min_complete_weeks

        and r.evidence_denominator >=
          r.min_denominator_events
        then 'eligible_for_review'

      else 'collecting'
    end as readiness_state,

    case
      when r.complete_days = 0 then
        'No complete post-baseline derived KPI observation days are available yet.'

      when r.evidence_denominator = 0 then
        'No eligible post-baseline denominator events are available yet.'

      when
        r.complete_days >=
          r.min_complete_days

        and r.complete_weeks >=
          r.min_complete_weeks

        and r.evidence_denominator >=
          r.min_denominator_events
        then
          'Minimum evidence gate met. Eligible for benchmark review; no benchmark is activated automatically.'

      else format(
        'Collecting evidence: %s complete days, %s complete weeks and %s denominator events.',
        r.complete_days,
        r.complete_weeks,
        r.evidence_denominator
      )
    end as readiness_reason

  from resolved r

  order by
    r.domain,
    r.kpi_key;
end;
$$;

revoke all
on function public.get_dad_derived_kpi_readiness(date)
from public, anon, authenticated;

grant execute
on function public.get_dad_derived_kpi_readiness(date)
to authenticated;


-- ---------------------------------------------------------------------------
-- Migration assertions
-- ---------------------------------------------------------------------------

do $$
declare
  v_kpi_count integer;
  v_link_count integer;
  v_non_pending_count integer;
  v_trigger_count integer;
begin
  select count(*)
  into v_kpi_count
  from public.dad_derived_kpi_governance
  where is_active = true;

  if v_kpi_count <> 6 then
    raise exception
      'Expected exactly 6 active DAD derived KPIs; found %',
      v_kpi_count;
  end if;


  select count(*)
  into v_link_count
  from public.dad_metric_derived_kpi_links;

  if v_link_count <> 8 then
    raise exception
      'Expected exactly 8 core-to-derived KPI links; found %',
      v_link_count;
  end if;


  select count(*)
  into v_non_pending_count
  from public.dad_derived_kpi_governance
  where benchmark_status <> 'pending'
     or threshold_status <> 'pending';

  if v_non_pending_count <> 0 then
    raise exception
      'Derived KPI benchmark or threshold state advanced unexpectedly.';
  end if;


  select count(
    distinct trigger_name
  )
  into v_trigger_count
  from information_schema.triggers
  where trigger_schema = 'public'
    and trigger_name in (
      'dad_capture_connection_decision',
      'dad_capture_milestone_cancellation',
      'dad_capture_action_item_cancellation'
    );

  if v_trigger_count <> 3 then
    raise exception
      'Expected exactly 3 DAD immutable-event triggers; found %',
      v_trigger_count;
  end if;
end
$$;
