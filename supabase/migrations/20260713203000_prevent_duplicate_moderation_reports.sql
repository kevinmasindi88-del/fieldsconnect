-- Prevent accidental duplicate moderation reports for the same reporter and target.

create unique index if not exists reports_one_open_ticket_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where closed_at is null;

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
  existing_ticket text;
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

  select ticket_number
    into existing_ticket
  from public.reports
  where reporter_id = auth.uid()
    and target_type = report_target_type
    and target_id = report_target_id
    and closed_at is null
  order by created_at desc
  limit 1;

  if existing_ticket is not null then
    return existing_ticket;
  end if;

  new_ticket := public.next_moderation_ticket_number();

  begin
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
  exception
    when unique_violation then
      select ticket_number
        into existing_ticket
      from public.reports
      where reporter_id = auth.uid()
        and target_type = report_target_type
        and target_id = report_target_id
        and closed_at is null
      order by created_at desc
      limit 1;

      if existing_ticket is not null then
        return existing_ticket;
      end if;

      raise;
  end;

  return new_ticket;
end;
$$;

revoke all on function public.submit_moderation_report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_moderation_report(text, uuid, uuid, text, text) to authenticated;
