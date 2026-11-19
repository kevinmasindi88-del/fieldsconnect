begin;


-- ---------------------------------------------------------------------------
-- Shared mentorship block assertion
-- ---------------------------------------------------------------------------

create or replace function public.assert_no_mentorship_block(
  first_profile_id uuid,
  second_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if first_profile_id is null
    or second_profile_id is null then
    raise exception
      'Mentorship participants could not be determined';
  end if;

  if public.has_block_between(
    first_profile_id,
    second_profile_id
  ) then
    raise exception
      'Mentorship activity is unavailable because one participant has blocked the other';
  end if;
end;
$function$;


revoke all
on function public.assert_no_mentorship_block(
  uuid,
  uuid
)
from public, anon, authenticated;


-- The block helper is required by authenticated RLS and guarded functions,
-- but must not be directly callable by anonymous users.

revoke all
on function public.has_block_between(
  uuid,
  uuid
)
from public, anon;

grant execute
on function public.has_block_between(
  uuid,
  uuid
)
to authenticated;


-- ---------------------------------------------------------------------------
-- Mentorship request guard
-- ---------------------------------------------------------------------------

create or replace function
public.guard_mentorship_request_against_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.assert_no_mentorship_block(
      new.mentee_id,
      new.mentor_id
    );

    return new;
  end if;

  if public.has_block_between(
    new.mentee_id,
    new.mentor_id
  ) then
    if new.status in (
      'cancelled',
      'expired'
    ) then
      return new;
    end if;

    raise exception
      'This mentorship request cannot be changed because one participant has blocked the other';
  end if;

  return new;
end;
$function$;


revoke all
on function
public.guard_mentorship_request_against_block()
from public, anon, authenticated;


drop trigger if exists
a_mentorship_requests_block_guard
on public.mentorship_requests;

create trigger
a_mentorship_requests_block_guard
before insert or update
on public.mentorship_requests
for each row
execute function
public.guard_mentorship_request_against_block();


-- ---------------------------------------------------------------------------
-- Mentorship lifecycle guard
-- ---------------------------------------------------------------------------

create or replace function
public.guard_mentorship_against_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.assert_no_mentorship_block(
      new.mentor_id,
      new.mentee_id
    );

    return new;
  end if;

  if public.has_block_between(
    new.mentor_id,
    new.mentee_id
  ) then
    if new.status = 'ended_early'
      and old.status <> 'ended_early' then
      return new;
    end if;

    raise exception
      'This mentorship is read-only because one participant has blocked the other';
  end if;

  return new;
end;
$function$;


revoke all
on function
public.guard_mentorship_against_block()
from public, anon, authenticated;


drop trigger if exists
a_mentorships_block_guard
on public.mentorships;

create trigger
a_mentorships_block_guard
before insert or update
on public.mentorships
for each row
execute function
public.guard_mentorship_against_block();


-- ---------------------------------------------------------------------------
-- Extension guard
-- ---------------------------------------------------------------------------

create or replace function
public.guard_mentorship_extension_against_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  target_mentorship_id uuid;
begin
  target_mentorship_id :=
    case
      when tg_op = 'DELETE'
        then old.mentorship_id
      else new.mentorship_id
    end;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if public.has_block_between(
    target_mentorship.mentor_id,
    target_mentorship.mentee_id
  ) then
    if tg_op = 'UPDATE'
      and new.status in (
        'cancelled',
        'expired'
      ) then
      return new;
    end if;

    raise exception
      'Mentorship extension activity is unavailable because one participant has blocked the other';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


revoke all
on function
public.guard_mentorship_extension_against_block()
from public, anon, authenticated;


drop trigger if exists
a_mentorship_extension_requests_block_guard
on public.mentorship_extension_requests;

create trigger
a_mentorship_extension_requests_block_guard
before insert or update or delete
on public.mentorship_extension_requests
for each row
execute function
public.guard_mentorship_extension_against_block();


-- ---------------------------------------------------------------------------
-- Workspace write guard
-- ---------------------------------------------------------------------------

create or replace function
public.guard_mentorship_workspace_against_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  target_mentorship_id uuid;
begin
  target_mentorship_id :=
    case
      when tg_op = 'DELETE'
        then old.mentorship_id
      else new.mentorship_id
    end;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  perform public.assert_no_mentorship_block(
    target_mentorship.mentor_id,
    target_mentorship.mentee_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


revoke all
on function
public.guard_mentorship_workspace_against_block()
from public, anon, authenticated;


drop trigger if exists
a_mentorship_updates_block_guard
on public.mentorship_updates;

create trigger
a_mentorship_updates_block_guard
before insert or update or delete
on public.mentorship_updates
for each row
execute function
public.guard_mentorship_workspace_against_block();


drop trigger if exists
a_mentorship_milestones_block_guard
on public.mentorship_milestones;

create trigger
a_mentorship_milestones_block_guard
before insert or update or delete
on public.mentorship_milestones
for each row
execute function
public.guard_mentorship_workspace_against_block();


drop trigger if exists
a_mentorship_action_items_block_guard
on public.mentorship_action_items;

create trigger
a_mentorship_action_items_block_guard
before insert or update or delete
on public.mentorship_action_items
for each row
execute function
public.guard_mentorship_workspace_against_block();


commit;