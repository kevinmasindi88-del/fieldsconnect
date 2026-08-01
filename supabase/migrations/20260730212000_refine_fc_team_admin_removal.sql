create or replace function public.remove_fc_team_member(
  member uuid,
  removal_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(array['admin']) then
    raise exception 'Only an administrator may remove an FC Team member';
  end if;

  if member = auth.uid() then
    raise exception 'You cannot remove your own FC Team membership through this control';
  end if;

  if not public.is_fc_team_member(member) then
    raise exception 'This user is not an active FC Team member';
  end if;

  if char_length(
    trim(coalesce(removal_reason, ''))
  ) < 10 then
    raise exception 'A detailed removal justification is required';
  end if;

  if char_length(trim(removal_reason)) > 2000 then
    raise exception 'The removal justification may not exceed 2000 characters';
  end if;

  if public.fc_team_member_has_open_work(member) then
    raise exception 'This member still has unresolved assigned feedback tickets. Unassign, reassign or complete them before removal';
  end if;

  update public.fc_team_members
  set
    revoked_by = auth.uid(),
    revoked_at = now(),
    revocation_reason = trim(removal_reason),
    updated_at = now()
  where user_id = member
    and revoked_at is null;

  update public.fc_team_leave_requests
  set
    status = 'cancelled',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_response =
      'Membership ended through administrative removal.',
    updated_at = now()
  where member_id = member
    and status = 'pending';

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
    member,
    auth.uid(),
    'fc_team_removed',
    'fc_team_member',
    member,
    'FC Team membership revoked',
    'An administrator has revoked your FC Team membership due to the following reason: ' ||
      trim(removal_reason) ||
      '. Your FC Team privileges have been removed and your profile has been reinstated to standard-user access.'
  );
end;
$$;

revoke all on function
  public.remove_fc_team_member(uuid, text)
from public, anon;

grant execute on function
  public.remove_fc_team_member(uuid, text)
to authenticated;