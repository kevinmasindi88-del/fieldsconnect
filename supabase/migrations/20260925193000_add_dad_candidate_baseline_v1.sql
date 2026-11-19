-- DAD Candidate Baseline v1
--
-- Purpose:
-- 1. Establish a point-in-time pre-pilot reference for the 15 governed
--    snapshot metrics.
-- 2. Mark those snapshot baselines as candidate, not frozen.
-- 3. Keep daily-flow metrics pending until a sufficient observation
--    window exists.
-- 4. Do not establish benchmarks, targets, tolerances or thresholds.
--
-- Baseline date: 2026-09-25 UTC
--
-- Important:
-- These values represent the platform state immediately before formal
-- pilot measurement. They are not mature performance norms and may
-- include pre-pilot development/testing activity.

do $$
declare
  v_admin_id uuid;
  v_admin_count integer;
  v_updated_count integer;
begin
  select count(*)
  into v_admin_count
  from public.platform_roles
  where role = 'admin'
    and revoked_at is null;

  if v_admin_count <> 1 then
    raise exception
      'Expected exactly one active platform admin for DAD Baseline v1; found %',
      v_admin_count;
  end if;

  select user_id
  into v_admin_id
  from public.platform_roles
  where role = 'admin'
    and revoked_at is null;

  -- The two current daily-flow metrics must remain pending.
  if (
    select count(*)
    from public.dad_metric_governance
    where is_active = true
      and measurement_type = 'daily_flow'
      and metric_key in (
        'users_new',
        'analytics_events_today'
      )
  ) <> 2 then
    raise exception
      'Expected users_new and analytics_events_today to remain the two governed daily-flow metrics.';
  end if;

  -- Refuse to stamp stale baseline values if the live pre-pilot
  -- snapshot has changed before this migration is applied.
  if exists (
    with expected(metric_key, expected_value) as (
      values
        ('users_total', 8::numeric),
        ('connections_total', 7::numeric),
        ('connections_accepted', 6::numeric),
        ('mentorship_requests_total', 10::numeric),
        ('mentorship_requests_accepted', 8::numeric),
        ('mentorships_active', 2::numeric),
        ('mentorships_completed', 6::numeric),
        ('mentorship_milestones_completed', 5::numeric),
        ('mentorship_action_items_completed', 13::numeric),
        ('library_documents_total', 3::numeric),
        ('library_documents_published', 3::numeric),
        ('posts_total', 9::numeric),
        ('comments_total', 15::numeric),
        ('post_reactions_total', 16::numeric),
        ('messages_total', 73::numeric)
    ),
    actual as (
      select 'users_total' as metric_key, count(*)::numeric as actual_value
      from public.profiles
      where deleted_at is null

      union all
      select 'connections_total', count(*)::numeric
      from public.connections

      union all
      select 'connections_accepted', count(*)::numeric
      from public.connections
      where status = 'accepted'

      union all
      select 'mentorship_requests_total', count(*)::numeric
      from public.mentorship_requests

      union all
      select 'mentorship_requests_accepted', count(*)::numeric
      from public.mentorship_requests
      where status = 'accepted'

      union all
      select 'mentorships_active', count(*)::numeric
      from public.mentorships
      where status = 'active'

      union all
      select 'mentorships_completed', count(*)::numeric
      from public.mentorships
      where status = 'completed'

      union all
      select 'mentorship_milestones_completed', count(*)::numeric
      from public.mentorship_milestones
      where status = 'completed'

      union all
      select 'mentorship_action_items_completed', count(*)::numeric
      from public.mentorship_action_items
      where status = 'completed'

      union all
      select 'library_documents_total', count(*)::numeric
      from public.library_documents
      where deleted_at is null

      union all
      select 'library_documents_published', count(*)::numeric
      from public.library_documents
      where deleted_at is null
        and is_published is true

      union all
      select 'posts_total', count(*)::numeric
      from public.posts
      where deleted_at is null

      union all
      select 'comments_total', count(*)::numeric
      from public.comments
      where deleted_at is null

      union all
      select 'post_reactions_total', count(*)::numeric
      from public.reactions

      union all
      select 'messages_total', count(*)::numeric
      from public.messages
      where deleted_at is null
    )
    select 1
    from expected e
    join actual a using (metric_key)
    where a.actual_value <> e.expected_value
  ) then
    raise exception
      'DAD Candidate Baseline v1 snapshot has changed since review. Reassess baseline values before applying.';
  end if;

  -- Mark only the 15 current snapshot metrics as candidate baselines.
  update public.dad_metric_governance
  set
    baseline_status = 'candidate',
    updated_at = now()
  where is_active = true
    and measurement_type = 'snapshot'
    and metric_key in (
      'users_total',
      'connections_total',
      'connections_accepted',
      'mentorship_requests_total',
      'mentorship_requests_accepted',
      'mentorships_active',
      'mentorships_completed',
      'mentorship_milestones_completed',
      'mentorship_action_items_completed',
      'library_documents_total',
      'library_documents_published',
      'posts_total',
      'comments_total',
      'post_reactions_total',
      'messages_total'
    );

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 15 then
    raise exception
      'Expected to mark 15 snapshot metrics as candidate; updated %',
      v_updated_count;
  end if;

  -- Explicitly retain pending status for daily-flow baselines.
  update public.dad_metric_governance
  set
    baseline_status = 'pending',
    updated_at = now()
  where metric_key in (
    'users_new',
    'analytics_events_today'
  );

  -- Versioned Candidate Baseline v1.
  --
  -- status remains draft because these are candidate baseline references,
  -- not active thresholds.
  insert into public.dad_metric_threshold_versions (
    metric_key,
    version,
    status,
    baseline_value,
    baseline_period_start,
    baseline_period_end,
    benchmark_value,
    benchmark_type,
    benchmark_source,
    target_value,
    tolerance_definition,
    trigger_definition,
    notes,
    created_by
  )
  values
    (
      'users_total',
      1,
      'draft',
      8,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'connections_total',
      1,
      'draft',
      7,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'connections_accepted',
      1,
      'draft',
      6,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorship_requests_total',
      1,
      'draft',
      10,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorship_requests_accepted',
      1,
      'draft',
      8,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorships_active',
      1,
      'draft',
      2,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorships_completed',
      1,
      'draft',
      6,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorship_milestones_completed',
      1,
      'draft',
      5,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'mentorship_action_items_completed',
      1,
      'draft',
      13,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'library_documents_total',
      1,
      'draft',
      3,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'library_documents_published',
      1,
      'draft',
      3,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'posts_total',
      1,
      'draft',
      9,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'comments_total',
      1,
      'draft',
      15,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'post_reactions_total',
      1,
      'draft',
      16,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    ),
    (
      'messages_total',
      1,
      'draft',
      73,
      date '2026-09-25',
      date '2026-09-25',
      null,
      null,
      null,
      null,
      null,
      null,
      'Candidate pre-pilot snapshot baseline captured on 2026-09-25 UTC. Point-in-time reference only; not a mature performance norm.',
      v_admin_id
    );
end
$$;
