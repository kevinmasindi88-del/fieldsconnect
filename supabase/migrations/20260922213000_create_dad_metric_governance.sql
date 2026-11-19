-- DAD KPI Governance Registry v1
--
-- Purpose:
-- 1. Freeze the semantic contract for current DAD metrics.
-- 2. Separate metric definition from threshold/benchmark versions.
-- 3. Keep governance metadata readable only to DAD-authorized users.
-- 4. Keep client-side governance mutation closed until audited admin RPCs exist.
--
-- This migration does not change any existing DAD calculation.

create table public.dad_metric_governance (
  metric_key text primary key,
  display_name text not null,
  domain text not null,
  definition text not null,
  calculation_definition text not null,
  source_relations text[] not null default '{}'::text[],
  source_type text not null
    check (
      source_type in (
        'durable_record',
        'behavioral_event',
        'mixed'
      )
    ),
  measurement_type text not null default 'snapshot'
    check (measurement_type in ('snapshot', 'daily_flow')),
  time_basis text not null default 'UTC'
    check (length(trim(time_basis)) > 0),
  time_rule text not null default
    'Point-in-time snapshot associated with metric_date; value reflects the latest refresh for that date and may be recalculated.'
    check (length(trim(time_rule)) > 0),
  unit text not null default 'count',
  calculation_cadence text not null default 'daily',
  review_cadence text not null default 'daily',
  privacy_class text not null default 'aggregate_internal'
    check (
      privacy_class in (
        'aggregate_internal',
        'restricted_aggregate'
      )
    ),
  owner_role text not null default 'platform_admin',
  baseline_status text not null default 'pending'
    check (
      baseline_status in (
        'pending',
        'candidate',
        'frozen'
      )
    ),
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
  check (length(trim(metric_key)) > 0),
  check (length(trim(display_name)) > 0),
  check (length(trim(domain)) > 0)
);

create index dad_metric_governance_domain_idx
  on public.dad_metric_governance (
    domain,
    is_active
  );

create table public.dad_metric_threshold_versions (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null
    references public.dad_metric_governance(metric_key)
    on delete cascade,
  version integer not null
    check (version > 0),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'active',
        'retired'
      )
    ),
  effective_from date,
  effective_to date,
  baseline_value numeric,
  baseline_period_start date,
  baseline_period_end date,
  benchmark_value numeric,
  benchmark_type text
    check (
      benchmark_type in (
        'internal',
        'external',
        'hybrid'
      )
    ),
  benchmark_source text,
  target_value numeric,
  tolerance_definition text,
  trigger_definition text,
  notes text,
  created_by uuid not null
    references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_key, version),
  check (
    effective_to is null
    or effective_from is null
    or effective_to >= effective_from
  ),
  check (
    baseline_period_end is null
    or baseline_period_start is null
    or baseline_period_end >= baseline_period_start
  )
);

create unique index dad_metric_threshold_one_active_idx
  on public.dad_metric_threshold_versions(metric_key)
  where status = 'active';

alter table public.dad_metric_governance
  enable row level security;

alter table public.dad_metric_threshold_versions
  enable row level security;

revoke all
on table public.dad_metric_governance
from public, anon, authenticated;

revoke all
on table public.dad_metric_threshold_versions
from public, anon, authenticated;

grant select
on table public.dad_metric_governance
to authenticated;

grant select
on table public.dad_metric_threshold_versions
to authenticated;

create policy dad_metric_governance_select_dad
on public.dad_metric_governance
for select
to authenticated
using ((select public.has_dad_access()));

create policy dad_metric_threshold_versions_select_dad
on public.dad_metric_threshold_versions
for select
to authenticated
using ((select public.has_dad_access()));

insert into public.dad_metric_governance (
  metric_key,
  display_name,
  domain,
  definition,
  calculation_definition,
  source_relations,
  source_type,
  unit,
  calculation_cadence,
  review_cadence,
  privacy_class,
  owner_role,
  baseline_status,
  benchmark_status,
  threshold_status,
  governance_version,
  is_active
)
values
  (
    'users_total',
    'Total users',
    'growth_activation',
    'Total non-deleted FieldsConnect profiles.',
    'Count public.profiles rows where deleted_at is null.',
    array['public.profiles'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'users_new',
    'New users',
    'growth_activation',
    'Non-deleted profiles created on the metric date.',
    'Count public.profiles rows where deleted_at is null and created_at::date equals metric_date.',
    array['public.profiles'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'connections_total',
    'Connection requests',
    'connections_discovery',
    'Total connection records regardless of status.',
    'Count all rows in public.connections.',
    array['public.connections'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'connections_accepted',
    'Accepted connections',
    'connections_discovery',
    'Connection records currently in accepted status.',
    'Count public.connections rows where status equals accepted.',
    array['public.connections'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorship_requests_total',
    'Mentorship requests',
    'mentorship',
    'Total mentorship request records.',
    'Count all rows in public.mentorship_requests.',
    array['public.mentorship_requests'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorship_requests_accepted',
    'Accepted mentorship requests',
    'mentorship',
    'Mentorship requests currently in accepted status.',
    'Count public.mentorship_requests rows where status equals accepted.',
    array['public.mentorship_requests'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorships_active',
    'Active mentorships',
    'mentorship',
    'Mentorship records currently in active status.',
    'Count public.mentorships rows where status equals active.',
    array['public.mentorships'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorships_completed',
    'Completed mentorships',
    'mentorship',
    'Mentorship records currently in completed status.',
    'Count public.mentorships rows where status equals completed.',
    array['public.mentorships'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorship_milestones_completed',
    'Milestones completed',
    'mentorship',
    'Mentorship milestones currently in completed status.',
    'Count public.mentorship_milestones rows where status equals completed.',
    array['public.mentorship_milestones'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'mentorship_action_items_completed',
    'Action items completed',
    'mentorship',
    'Mentorship action items currently in completed status.',
    'Count public.mentorship_action_items rows where status equals completed.',
    array['public.mentorship_action_items'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'library_documents_total',
    'Library resources',
    'library_resources',
    'Total non-deleted Library resources.',
    'Count public.library_documents rows where deleted_at is null.',
    array['public.library_documents'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'library_documents_published',
    'Published Library resources',
    'library_resources',
    'Published, non-deleted Library resources.',
    'Count public.library_documents rows where deleted_at is null and is_published is true.',
    array['public.library_documents'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'posts_total',
    'Posts',
    'engagement_network',
    'Total non-deleted Timeline posts.',
    'Count public.posts rows where deleted_at is null.',
    array['public.posts'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'comments_total',
    'Comments',
    'engagement_network',
    'Total non-deleted Timeline comments.',
    'Count public.comments rows where deleted_at is null.',
    array['public.comments'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'post_reactions_total',
    'Post reactions',
    'engagement_network',
    'Total post reaction records.',
    'Count all rows in public.reactions.',
    array['public.reactions'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'messages_total',
    'Messages',
    'engagement_network',
    'Total non-deleted private message records.',
    'Count public.messages rows where deleted_at is null. Only the aggregate count is exposed to DAD; message content is not analytics data.',
    array['public.messages'],
    'durable_record',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  ),
  (
    'analytics_events_today',
    'Tracked events',
    'instrumentation',
    'Behavioral analytics events recorded on the metric date.',
    'Count public.analytics_events rows where occurred_at::date equals metric_date.',
    array['public.analytics_events'],
    'behavioral_event',
    'count',
    'daily',
    'daily',
    'aggregate_internal',
    'platform_admin',
    'pending',
    'pending',
    'pending',
    1,
    true
  )
on conflict (metric_key)
do update set
  display_name = excluded.display_name,
  domain = excluded.domain,
  definition = excluded.definition,
  calculation_definition = excluded.calculation_definition,
  source_relations = excluded.source_relations,
  source_type = excluded.source_type,
  unit = excluded.unit,
  calculation_cadence = excluded.calculation_cadence,
  review_cadence = excluded.review_cadence,
  privacy_class = excluded.privacy_class,
  owner_role = excluded.owner_role,
  baseline_status = excluded.baseline_status,
  benchmark_status = excluded.benchmark_status,
  threshold_status = excluded.threshold_status,
  governance_version = excluded.governance_version,
  is_active = excluded.is_active,
  updated_at = now();

-- Explicitly freeze time semantics for the v1 metric contract.
update public.dad_metric_governance
set
  measurement_type = 'snapshot',
  time_basis = 'UTC',
  time_rule = 'Point-in-time snapshot associated with metric_date; value reflects the latest refresh for that date and may be recalculated.',
  updated_at = now();

update public.dad_metric_governance
set
  measurement_type = 'daily_flow',
  time_basis = 'UTC',
  time_rule = 'UTC calendar-day flow for metric_date; current-day values are provisional and the completed day is finalized by the scheduled 00:15 UTC run on the following day.',
  updated_at = now()
where metric_key in (
  'users_new',
  'analytics_events_today'
);