-- Enforce mentor capacity and accepted mentee levels for live mentorships.

begin;

create or replace function
public.enforce_mentorship_capacity_and_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentor_settings public.mentor_profiles%rowtype;
  mentee_level text;
  active_mentorship_count integer;
begin
  if new.status not in (
    'active',
    'ending',
    'extension_pending',
    'paused',
    'completion_requested'
  ) then
    return new;
  end if;

  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = new.mentor_id
  for update;

  if not found then
    raise exception
      'This mentor has not configured mentorship settings';
  end if;

  select profile.role_type
  into mentee_level
  from public.profiles profile
  where profile.id = new.mentee_id
    and profile.deleted_at is null
    and profile.is_active = true;

  if mentee_level is null then
    raise exception
      'The mentee profile is unavailable';
  end if;

  if not (
    mentee_level = any(mentor_settings.mentoring_levels)
  ) then
    raise exception
      'This mentor is not accepting mentees at your profile level';
  end if;

  select count(*)::integer
  into active_mentorship_count
  from public.mentorships mentorship
  where mentorship.mentor_id = new.mentor_id
    and mentorship.status in (
      'active',
      'ending',
      'extension_pending',
      'paused',
      'completion_requested'
    )
    and mentorship.id <> new.id;

  if active_mentorship_count >=
    mentor_settings.maximum_active_mentees then
    raise exception
      'This mentor has reached their maximum active mentee capacity';
  end if;

  return new;
end;
$function$;

drop trigger if exists
mentorships_enforce_capacity_and_level
on public.mentorships;

create trigger
mentorships_enforce_capacity_and_level
before insert or update of
  mentor_id,
  mentee_id,
  status
on public.mentorships
for each row
execute function
public.enforce_mentorship_capacity_and_level();

revoke all
on function public.enforce_mentorship_capacity_and_level()
from public, anon, authenticated;

commit;