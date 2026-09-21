-- DAD hardening: access checks are self-only from the client.

drop policy if exists analytics_events_select_dad on public.analytics_events;
drop policy if exists dad_daily_metrics_select_dad on public.dad_daily_metrics;
drop policy if exists dad_reviews_select_dad on public.dad_analyst_reviews;
drop policy if exists dad_reviews_insert_self on public.dad_analyst_reviews;
drop policy if exists dad_reviews_update_self_or_admin on public.dad_analyst_reviews;

drop function if exists public.has_dad_access(uuid);

create or replace function public.has_dad_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.platform_roles pr
        where pr.user_id = auth.uid()
          and pr.role = 'admin'
          and pr.revoked_at is null
      )
      or exists (
        select 1
        from public.dad_access da
        where da.user_id = auth.uid()
          and da.access_role = 'analyst'
          and da.revoked_at is null
      )
    );
$$;

revoke all on function public.has_dad_access() from public, anon;
grant execute on function public.has_dad_access() to authenticated;

create policy analytics_events_select_dad
on public.analytics_events for select to authenticated
using ((select public.has_dad_access()));

create policy dad_daily_metrics_select_dad
on public.dad_daily_metrics for select to authenticated
using ((select public.has_dad_access()));

create policy dad_reviews_select_dad
on public.dad_analyst_reviews for select to authenticated
using ((select public.has_dad_access()));

create policy dad_reviews_insert_self
on public.dad_analyst_reviews for insert to authenticated
with check (
  (select public.has_dad_access())
  and analyst_id = (select auth.uid())
);

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
with check ((select public.has_dad_access()));

create or replace function public.refresh_dad_metrics(p_date date default current_date)
returns timestamptz
language plpgsql
security definer
set search_path = public, private
as $$
declare
  refreshed_at timestamptz := now();
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required';
  end if;

  perform private.refresh_dad_daily_metrics(p_date);
  return refreshed_at;
end;
$$;

revoke all on function public.refresh_dad_metrics(date) from public, anon;
grant execute on function public.refresh_dad_metrics(date) to authenticated;
