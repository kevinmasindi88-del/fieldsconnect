-- Restricted read-only evidence for assigned FCModerators and eligible admins.
begin;
CREATE OR REPLACE FUNCTION public.get_moderation_mentorship_evidence(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_report public.reports%rowtype;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  v_role := public.current_platform_role();
  if v_role is null or v_role not in ('moderator','senior_moderator','admin') then
    raise exception 'Moderator access required';
  end if;
  select * into v_report from public.reports where id=p_report_id;
  if not found then raise exception 'Moderation ticket not found'; end if;
  if v_report.target_type <> 'mentorship' then
    raise exception 'Ticket does not concern a mentorship';
  end if;
  if v_actor = v_report.reported_user_id then
    raise exception 'A reported user cannot investigate their own ticket';
  end if;
  if v_report.status not in ('open','reviewing') then
    raise exception 'Evidence access ends when a ticket is resolved';
  end if;
  if v_report.assigned_to is distinct from v_actor
     and not (v_role = 'admin' and v_report.assigned_to is null) then
    raise exception 'Ticket is not assigned to you';
  end if;

  select jsonb_build_object(
    'cycle', jsonb_build_object(
      'id',m.id,'field',m.mentorship_field,'status',m.status,
      'objective',m.objective,'duration',m.agreed_duration,
      'frequency',m.agreed_frequency,'start_date',m.start_date,
      'expected_end_date',m.expected_end_date,
      'mentor_id',m.mentor_id,'mentee_id',m.mentee_id,
      'mentor_name',coalesce(mp.display_name,'Mentor'),
      'mentee_name',coalesce(ep.display_name,'Mentee'),
      'end_reason',m.end_reason,'pause_reason',m.pause_reason,
      'completion_request_note',m.completion_request_note,
      'completion_response_note',m.completion_response_note
    ),
    'updates',coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at)
      from (
        select author_id,update_type,body,created_at,edited_at
        from public.mentorship_updates
        where mentorship_id=m.id
        order by created_at desc limit 200
      ) u
    ),'[]'::jsonb),
    'milestones',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
      from (
        select title,description,target_date,status,created_at,completed_at
        from public.mentorship_milestones
        where mentorship_id=m.id order by created_at desc limit 200
      ) x
    ),'[]'::jsonb),
    'action_items',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from (
        select title,description,status,due_date,created_at,assigned_to,
               completion_summary,completion_submitted_at,completion_rating,
               completion_review,completion_reviewed_at
        from public.mentorship_action_items
        where mentorship_id=m.id order by created_at desc limit 200
      ) a
    ),'[]'::jsonb),
    'completion_feedback',coalesce((
      select jsonb_agg(to_jsonb(f) order by f.submitted_at)
      from (
        select author_role,feedback,mentor_rating,submitted_at
        from public.mentorship_completion_feedback
        where mentorship_id=m.id order by submitted_at desc limit 200
      ) f
    ),'[]'::jsonb),
    'extensions',coalesce((
      select jsonb_agg(to_jsonb(e) order by e.requested_at)
      from (
        select requested_duration,reason,status,requested_at,responded_at,
               previous_end_date,proposed_end_date
        from public.mentorship_extension_requests
        where mentorship_id=m.id order by requested_at desc limit 100
      ) e
    ),'[]'::jsonb)
  ) into v_result
  from public.mentorships m
  left join public.profiles mp on mp.id=m.mentor_id
  left join public.profiles ep on ep.id=m.mentee_id
  where m.id=v_report.target_id
    and v_report.reporter_id in (m.mentor_id,m.mentee_id)
    and v_report.reported_user_id in (m.mentor_id,m.mentee_id)
    and v_report.reporter_id<>v_report.reported_user_id;
  if v_result is null then
    raise exception 'Mentorship evidence unavailable';
  end if;
  return v_result;
end;
$function$

revoke all on function public.get_moderation_mentorship_evidence(uuid) from public, anon, authenticated;
grant execute on function public.get_moderation_mentorship_evidence(uuid) to authenticated;
commit;
