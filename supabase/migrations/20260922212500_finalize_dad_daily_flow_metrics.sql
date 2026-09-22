-- DAD daily flow finalization
--
-- The existing daily refresh runs at 00:15 UTC. Snapshot metrics may be
-- refreshed at that time, but date-bounded flow metrics for the new day
-- are necessarily incomplete.
--
-- Finalize the previous UTC day's flow metrics after that day has closed,
-- then preserve the existing current-day snapshot refresh behavior.

create or replace function private.finalize_dad_daily_flow_metrics(
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.dad_daily_metrics (
    metric_date,
    metric_key,
    metric_value,
    dimension_type,
    dimension_value,
    calculated_at
  )
  values
    (
      p_date,
      'users_new',
      (
        select count(*)
        from public.profiles
        where deleted_at is null
          and created_at::date = p_date
      ),
      'global',
      'all',
      now()
    ),
    (
      p_date,
      'analytics_events_today',
      (
        select count(*)
        from public.analytics_events
        where occurred_at::date = p_date
      ),
      'global',
      'all',
      now()
    )
  on conflict (
    metric_date,
    metric_key,
    dimension_type,
    dimension_value
  )
  do update set
    metric_value = excluded.metric_value,
    calculated_at = excluded.calculated_at;
end;
$$;

revoke all
on function private.finalize_dad_daily_flow_metrics(date)
from public, anon, authenticated;

create or replace function private.run_dad_daily_refresh()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.finalize_dad_daily_flow_metrics(
    current_date - 1
  );

  perform private.refresh_dad_daily_metrics(
    current_date
  );
end;
$$;

revoke all
on function private.run_dad_daily_refresh()
from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'fieldsconnect-dad-daily-refresh'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fieldsconnect-dad-daily-refresh',
    '15 0 * * *',
    $job$select private.run_dad_daily_refresh();$job$
  );
end
$$;

-- Correct the most recently completed UTC day immediately.
select private.finalize_dad_daily_flow_metrics(
  current_date - 1
);