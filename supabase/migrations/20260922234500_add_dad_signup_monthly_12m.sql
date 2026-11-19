-- DAD rolling 12-month signup series.
-- This is a gross signup acquisition trend, distinct from the governed users_new daily KPI.
-- It counts profiles created in each UTC calendar month, regardless of later deletion.

create or replace function public.get_dad_signup_monthly_12m(
  p_as_of date default current_date
)
returns table (
  month_start date,
  signup_count bigint,
  is_current_month boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_dad_access() then
    raise exception 'DAD access required';
  end if;

  return query
  with bounds as (
    select
      (
        date_trunc('month', p_as_of::timestamp)
        - interval '11 months'
      )::date as start_month,
      date_trunc('month', p_as_of::timestamp)::date as current_month
  ),
  months as (
    select
      generate_series(
        b.start_month::timestamp,
        b.current_month::timestamp,
        interval '1 month'
      )::date as month_start,
      b.current_month
    from bounds b
  ),
  monthly_counts as (
    select
      date_trunc(
        'month',
        p.created_at at time zone 'UTC'
      )::date as month_start,
      count(*)::bigint as signup_count
    from public.profiles p
    cross join bounds b
    where (p.created_at at time zone 'UTC') >= b.start_month::timestamp
      and (p.created_at at time zone 'UTC')
        < (b.current_month + interval '1 month')::timestamp
    group by 1
  )
  select
    m.month_start,
    coalesce(c.signup_count, 0)::bigint as signup_count,
    m.month_start = m.current_month as is_current_month
  from months m
  left join monthly_counts c
    on c.month_start = m.month_start
  order by m.month_start;
end;
$$;

revoke all
on function public.get_dad_signup_monthly_12m(date)
from public, anon;

grant execute
on function public.get_dad_signup_monthly_12m(date)
to authenticated;
