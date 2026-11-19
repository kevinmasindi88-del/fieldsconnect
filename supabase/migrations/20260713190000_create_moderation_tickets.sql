-- Traceable moderation tickets and contextual reporting.

alter table public.reports
  add column if not exists ticket_number text,
  add column if not exists reported_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz;

create unique index if not exists reports_ticket_number_key
  on public.reports (ticket_number)
  where ticket_number is not null;

create table if not exists public.moderation_ticket_sequences (
  ticket_year integer primary key,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_moderation_ticket_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  full_year integer := extract(year from now())::integer;
  short_year text := right(full_year::text, 2);
  next_number integer;
begin
  insert into public.moderation_ticket_sequences (ticket_year, last_number)
  values (full_year, 1)
  on conflict (ticket_year) do update
  set last_number = public.moderation_ticket_sequences.last_number + 1,
      updated_at = now()
  returning last_number into next_number;

  return 'FC-MOD-' || short_year || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.submit_moderation_report(
  report_target_type text,
  report_target_id uuid,
  reported_user uuid,
  report_reason text,
  report_details text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ticket text;
  valid_target boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if report_target_type not in ('profile', 'post', 'comment', 'message', 'skill', 'library_document', 'profile_picture') then
    raise exception 'Unsupported report target type';
  end if;

  if char_length(trim(coalesce(report_reason, ''))) = 0 then
    raise exception 'A report reason is required';
  end if;

  case report_target_type
    when 'profile' then
      select exists(select 1 from public.profiles where id = report_target_id and deleted_at is null) into valid_target;
    when 'post' then
      select exists(select 1 from public.posts where id = report_target_id and deleted_at is null) into valid_target;
    when 'comment' then
      select exists(select 1 from public.comments where id = report_target_id and deleted_at is null) into valid_target;
    when 'library_document' then
      select exists(select 1 from public.library_documents where id = report_target_id) into valid_target;
    else
      valid_target := true;
  end case;

  if not valid_target then
    raise exception 'The reported item is no longer available';
  end if;

  if reported_user = auth.uid() then
    raise exception 'You cannot report your own content';
  end if;

  new_ticket := public.next_moderation_ticket_number();

  insert into public.reports (
    reporter_id,
    target_type,
    target_id,
    reported_user_id,
    reason,
    details,
    ticket_number
  ) values (
    auth.uid(),
    report_target_type,
    report_target_id,
    reported_user,
    trim(report_reason),
    nullif(trim(coalesce(report_details, '')), ''),
    new_ticket
  );

  return new_ticket;
end;
$$;

revoke all on function public.next_moderation_ticket_number() from public, anon, authenticated;
revoke all on function public.submit_moderation_report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_moderation_report(text, uuid, uuid, text, text) to authenticated;

-- Moderators and administrators can read the full incoming queue.
drop policy if exists "reports_moderation_team_read_all" on public.reports;
create policy "reports_moderation_team_read_all"
on public.reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or public.has_platform_role(array['moderator', 'senior_moderator', 'admin'])
);
