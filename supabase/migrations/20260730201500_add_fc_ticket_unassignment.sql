-- ============================================================
-- Admin ticket unassignment
-- ============================================================

create or replace function public.unassign_fc_feedback_ticket(
  ticket uuid,
  unassignment_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_record public.fc_feedback_tickets%rowtype;
  former_assignee uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may unassign FC feedback tickets';
  end if;

  if char_length(
    trim(coalesce(unassignment_reason, ''))
  ) < 3 then
    raise exception 'An unassignment reason is required';
  end if;

  if char_length(trim(unassignment_reason)) > 2000 then
    raise exception 'The unassignment reason may not exceed 2000 characters';
  end if;

  select *
  into ticket_record
  from public.fc_feedback_tickets
  where id = ticket
  for update;

  if ticket_record.id is null then
    raise exception 'Feedback ticket not found';
  end if;

  if ticket_record.assigned_to is null then
    raise exception 'This ticket is already unassigned';
  end if;

  if ticket_record.status in (
    'resolved',
    'closed',
    'cancelled'
  ) then
    raise exception 'Resolved, closed or cancelled tickets cannot be unassigned';
  end if;

  former_assignee := ticket_record.assigned_to;

  update public.fc_feedback_tickets
  set
    assigned_to = null,
    assigned_at = null,
    status = 'open',
    started_at = null,
    updated_at = now()
  where id = ticket;

  insert into public.fc_feedback_ticket_activity (
    ticket_id,
    performed_by,
    activity_type,
    notes
  )
  values (
    ticket,
    auth.uid(),
    'unassigned',
    trim(unassignment_reason)
  );

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    former_assignee,
    auth.uid(),
    'fc_feedback_unassigned',
    'fc_feedback_ticket',
    ticket,
    'FC feedback ticket unassigned',
    'Ticket ' ||
      coalesce(
        ticket_record.ticket_number,
        ticket::text
      ) ||
      ' has been unassigned from you. Reason: ' ||
      trim(unassignment_reason)
  );
end;
$$;

revoke all on function
  public.unassign_fc_feedback_ticket(uuid, text)
from public, anon;

grant execute on function
  public.unassign_fc_feedback_ticket(uuid, text)
to authenticated;

-- ============================================================
-- Update leave approval outcome wording
-- ============================================================

create or replace function public.respond_to_fc_team_leave_request(
  leave_request uuid,
  approve_request boolean,
  response_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.fc_team_leave_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may review FC Team leave requests';
  end if;

  select *
  into request_record
  from public.fc_team_leave_requests
  where id = leave_request
  for update;

  if request_record.id is null then
    raise exception 'FC Team leave request not found';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'This leave request has already been reviewed';
  end if;

  if approve_request
    and public.fc_team_member_has_open_work(
      request_record.member_id
    )
  then
    raise exception 'This member still has unresolved assigned feedback tickets. Unassign, reassign or complete them before approving the request';
  end if;

  if not approve_request
    and char_length(
      trim(coalesce(response_text, ''))
    ) < 3
  then
    raise exception 'A reason is required when declining a leave request';
  end if;

  update public.fc_team_leave_requests
  set
    status = case
      when approve_request then 'approved'
      else 'declined'
    end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_response =
      nullif(trim(coalesce(response_text, '')), ''),
    updated_at = now()
  where id = leave_request;

  if approve_request then
    update public.fc_team_members
    set
      revoked_by = auth.uid(),
      revoked_at = now(),
      revocation_reason =
        'Member-requested departure: ' ||
        request_record.reason,
      updated_at = now()
    where user_id = request_record.member_id
      and revoked_at is null;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    request_record.member_id,
    auth.uid(),
    case
      when approve_request
        then 'fc_team_leave_approved'
      else 'fc_team_leave_declined'
    end,
    'fc_team_leave_request',
    request_record.id,
    case
      when approve_request
        then 'FC Team leave request approved'
      else 'FC Team leave request declined'
    end,
    case
      when approve_request then
        'Your request has been approved, your FC Team membership has been revoked, and your profile has been reinstated to standard-user access.'
      else
        'Your request to leave the FC Team was declined. Review the administrator response on the FC Team page.'
    end
  );
end;
$$;