-- Restrict mentorship milestone governance to the mentor.

begin;

create or replace function
public.enforce_mentorship_milestone_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentorship_record public.mentorships%rowtype;
  caller_id uuid;
  unfinished_action_count integer;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception
      'Authentication is required';
  end if;

  select *
  into mentorship_record
  from public.mentorships mentorship
  where mentorship.id = new.mentorship_id;

  if mentorship_record.id is null then
    raise exception
      'Mentorship not found';
  end if;

  if caller_id not in (
    mentorship_record.mentor_id,
    mentorship_record.mentee_id
  ) then
    raise exception
      'Only mentorship participants may access milestones';
  end if;

  if tg_op = 'INSERT' then
    if caller_id <> mentorship_record.mentor_id then
      raise exception
        'Only the mentor may create milestones';
    end if;

    if new.created_by <> mentorship_record.mentor_id then
      raise exception
        'The milestone creator must be the mentor';
    end if;

    if new.status <> 'planned' then
      raise exception
        'New milestones must start with planned status';
    end if;

    new.completed_by := null;
    new.completed_at := null;

    return new;
  end if;

  if new.mentorship_id <> old.mentorship_id then
    raise exception
      'Milestone mentorship cannot be changed';
  end if;

  if new.created_by <> old.created_by then
    raise exception
      'Milestone creator cannot be changed';
  end if;

  if caller_id <> mentorship_record.mentor_id then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.target_date is distinct from old.target_date
      or new.status is distinct from old.status then
      raise exception
        'Only the mentor may update milestones';
    end if;
  end if;

  if new.status is distinct from old.status then
    if caller_id <> mentorship_record.mentor_id then
      raise exception
        'Only the mentor may change milestone status';
    end if;

    if new.status = 'in_progress' then
      if old.status <> 'planned' then
        raise exception
          'Only a planned milestone may be started';
      end if;

      new.completed_by := null;
      new.completed_at := null;

    elsif new.status = 'completed' then
      if old.status <> 'in_progress' then
        raise exception
          'Only an in-progress milestone may be completed';
      end if;

      select count(*)
      into unfinished_action_count
      from public.mentorship_action_items action_item
      where action_item.milestone_id = new.id
        and action_item.status not in (
          'completed',
          'cancelled'
        );

      if unfinished_action_count > 0 then
        raise exception
          'Complete or cancel all linked action items before completing this milestone';
      end if;

      new.completed_by := caller_id;
      new.completed_at := now();

    elsif new.status = 'cancelled' then
      if old.status = 'completed' then
        raise exception
          'A completed milestone cannot be cancelled';
      end if;

      select count(*)
      into unfinished_action_count
      from public.mentorship_action_items action_item
      where action_item.milestone_id = new.id
        and action_item.status not in (
          'completed',
          'cancelled'
        );

      if unfinished_action_count > 0 then
        raise exception
          'Complete or cancel all linked action items before cancelling this milestone';
      end if;

      new.completed_by := null;
      new.completed_at := null;

    elsif new.status = 'planned' then
      raise exception
        'A milestone cannot be returned directly to planned status';
    end if;
  end if;

  return new;
end;
$function$;

revoke all
on function
public.enforce_mentorship_milestone_lifecycle()
from public, anon, authenticated;

commit;