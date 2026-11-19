-- Allow authorised moderation team members to assign a ticket to themselves.

create or replace function public.assign_moderation_ticket_to_me(
  report_id uuid
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

  if not public.has_platform_role(
    array['moderator', 'senior_moderator', 'admin']
  ) then
    raise exception 'Moderator access required';
  end if;

  update public.reports
  set
    assigned_to = auth.uid(),
    status = case
      when status = 'open' then 'in_review'
      else status
    end,
    updated_at = now()
  where id = report_id;

  if not found then
    raise exception 'Moderation ticket not found';
  end if;
end;
$$;

revoke all
on function public.assign_moderation_ticket_to_me(uuid)
from public, anon;

grant execute
on function public.assign_moderation_ticket_to_me(uuid)
to authenticated;