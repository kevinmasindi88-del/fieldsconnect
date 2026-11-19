-- FieldsConnect: mentorship participant reporting through the EXISTING FCModerators pipeline.
-- REVIEWED CANDIDATE: do not apply before permission and regression validation.
-- No separate reporting tables or ticket workflow are created.
-- Existing moderation resolver governs permissible outcomes; do not add destructive
-- mentorship actions without a separate, audited policy review.

begin;

-- Existing schema restricts public.reports.target_type to a fixed set.
-- Include mentorship without changing other report categories.
alter table public.reports
  drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('profile', 'post', 'comment', 'message', 'library_document', 'mentorship'));

-- The existing partial unique index already prevents repeated OPEN reports
-- from the same reporter for the same mentorship cycle.
create or replace function public.submit_mentorship_participant_report(
  p_mentorship_id uuid,
  p_reported_user_id uuid,
  p_reason text,
  p_details text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_mentorship public.mentorships%rowtype;
  v_existing_ticket text;
  v_new_ticket text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_mentorship_id is null or p_reported_user_id is null then
    raise exception 'A mentorship and reported participant are required';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A report reason is required';
  end if;

  if char_length(btrim(p_reason)) > 500
     or char_length(coalesce(p_details, '')) > 5000 then
    raise exception 'Report content exceeds the permitted length';
  end if;

  select * into v_mentorship
  from public.mentorships
  where id = p_mentorship_id;

  if not found then
    raise exception 'Mentorship cycle not found';
  end if;

  if v_actor not in (v_mentorship.mentor_id, v_mentorship.mentee_id) then
    raise exception 'You are not a participant in this mentorship';
  end if;

  if p_reported_user_id = v_actor then
    raise exception 'You cannot report yourself';
  end if;

  if not (
    (v_actor = v_mentorship.mentor_id and p_reported_user_id = v_mentorship.mentee_id)
    or
    (v_actor = v_mentorship.mentee_id and p_reported_user_id = v_mentorship.mentor_id)
  ) then
    raise exception 'The reported user is not the other mentorship participant';
  end if;

  select ticket_number into v_existing_ticket
  from public.reports
  where reporter_id = v_actor
    and target_type = 'mentorship'
    and target_id = p_mentorship_id
    and closed_at is null
  order by created_at desc
  limit 1;

  if v_existing_ticket is not null then
    return v_existing_ticket;
  end if;

  v_new_ticket := public.next_moderation_ticket_number();

  begin
    insert into public.reports (
      reporter_id, target_type, target_id, reported_user_id,
      reason, details, ticket_number
    ) values (
      v_actor, 'mentorship', p_mentorship_id, p_reported_user_id,
      btrim(p_reason), nullif(btrim(coalesce(p_details, '')), ''), v_new_ticket
    );
  exception when unique_violation then
    -- Concurrency-safe duplicate handling via the existing partial unique index.
    select ticket_number into v_existing_ticket
    from public.reports
    where reporter_id = v_actor
      and target_type = 'mentorship'
      and target_id = p_mentorship_id
      and closed_at is null
    order by created_at desc
    limit 1;
    if v_existing_ticket is not null then
      return v_existing_ticket;
    end if;
    raise;
  end;

  return v_new_ticket;
end;
$function$;

revoke all on function public.submit_mentorship_participant_report(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_mentorship_participant_report(uuid, uuid, text, text)
  to authenticated;

-- Return only the metadata rendered by the current ModerationReview.tsx UI.
-- Do not expose private messages, notes, milestones, payment details or attachments.
create or replace function public.get_moderation_mentorship_context(p_report_id uuid)
returns table (
  mentorship_id uuid,
  mentorship_field text,
  mentorship_status text,
  mentor_id uuid,
  mentor_name text,
  mentee_id uuid,
  mentee_name text,
  reported_user_id uuid,
  started_on date,
  expected_end_on date
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_report public.reports%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  v_role := public.current_platform_role();
  if v_role is null or v_role not in ('moderator', 'senior_moderator', 'admin') then
    raise exception 'Moderator access required';
  end if;

  select * into v_report
  from public.reports
  where id = p_report_id;

  if not found then
    raise exception 'Moderation ticket not found';
  end if;

  if v_report.target_type <> 'mentorship' then
    raise exception 'This ticket does not concern a mentorship';
  end if;

  if v_report.status not in ('open', 'reviewing') then
    raise exception 'Mentorship context is no longer available';
  end if;

  if v_report.assigned_to is distinct from v_actor
     and not (v_role = 'admin' and v_report.assigned_to is null) then
    raise exception 'This ticket is not assigned to you';
  end if;

  return query
  select
    m.id, m.mentorship_field, m.status,
    m.mentor_id,
    coalesce(nullif(btrim(mentor.display_name), ''), 'FieldsConnect user'),
    m.mentee_id,
    coalesce(nullif(btrim(mentee.display_name), ''), 'FieldsConnect user'),
    v_report.reported_user_id,
    m.start_date, m.expected_end_date
  from public.mentorships m
  left join public.profiles mentor on mentor.id = m.mentor_id
  left join public.profiles mentee on mentee.id = m.mentee_id
  where m.id = v_report.target_id
    and v_report.reported_user_id in (m.mentor_id, m.mentee_id)
    and v_report.reporter_id in (m.mentor_id, m.mentee_id)
    and v_report.reporter_id <> v_report.reported_user_id;
end;
$function$;

revoke all on function public.get_moderation_mentorship_context(uuid)
  from public, anon, authenticated;
grant execute on function public.get_moderation_mentorship_context(uuid)
  to authenticated;

commit;
