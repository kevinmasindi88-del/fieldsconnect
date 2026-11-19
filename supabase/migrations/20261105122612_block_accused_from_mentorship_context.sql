-- Prevent the reported individual from viewing their own moderation case
-- through the legacy mentorship-context summary RPC.
begin;
CREATE OR REPLACE FUNCTION public.get_moderation_mentorship_context(p_report_id uuid)
 RETURNS TABLE(mentorship_id uuid, mentorship_field text, mentorship_status text, mentor_id uuid, mentor_name text, mentee_id uuid, mentee_name text, reported_user_id uuid, started_on date, expected_end_on date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_report public.reports%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_role := public.current_platform_role();
  if v_role is null or v_role not in ('moderator','senior_moderator','admin') then
    raise exception 'Moderator access required';
  end if;
  select * into v_report from public.reports where id=p_report_id;
  if not found then raise exception 'Moderation ticket not found'; end if;
  if v_report.target_type <> 'mentorship' then
    raise exception 'This ticket does not concern a mentorship';
  end if;
  if v_actor = v_report.reported_user_id then
    raise exception 'A reported user cannot investigate their own ticket';
  end if;
  if v_report.status not in ('open','reviewing') then
    raise exception 'Mentorship context is no longer available';
  end if;
  if v_report.assigned_to is distinct from v_actor
     and not (v_role='admin' and v_report.assigned_to is null) then
    raise exception 'This ticket is not assigned to you';
  end if;
  return query
  select m.id,m.mentorship_field,m.status,m.mentor_id,
    coalesce(nullif(btrim(mentor.display_name),''),'FieldsConnect user'),
    m.mentee_id,
    coalesce(nullif(btrim(mentee.display_name),''),'FieldsConnect user'),
    v_report.reported_user_id,m.start_date,m.expected_end_date
  from public.mentorships m
  left join public.profiles mentor on mentor.id=m.mentor_id
  left join public.profiles mentee on mentee.id=m.mentee_id
  where m.id=v_report.target_id
    and v_report.reported_user_id in (m.mentor_id,m.mentee_id)
    and v_report.reporter_id in (m.mentor_id,m.mentee_id)
    and v_report.reporter_id<>v_report.reported_user_id;
end;
$function$

revoke all on function public.get_moderation_mentorship_context(uuid) from public, anon, authenticated;
grant execute on function public.get_moderation_mentorship_context(uuid) to authenticated;
commit;
