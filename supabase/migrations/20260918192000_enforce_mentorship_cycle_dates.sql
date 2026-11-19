begin;


create or replace function
public.validate_mentorship_workspace_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  linked_milestone public.mentorship_milestones%rowtype;
  caller_id uuid;
  validate_milestone_target boolean := false;
  validate_action_dates boolean := false;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception
      'Authentication is required';
  end if;


  select *
  into target_mentorship
  from public.mentorships
  where id = new.mentorship_id;

  if not found then
    raise exception
      'Mentorship not found';
  end if;


  if caller_id not in (
    target_mentorship.mentor_id,
    target_mentorship.mentee_id
  ) then
    raise exception
      'Only mentorship participants may modify the workspace';
  end if;


  if target_mentorship.status not in (
    'active',
    'ending',
    'paused',
    'completion_requested'
  ) then
    raise exception
      'This mentorship workspace is read-only';
  end if;


  if tg_table_name = 'mentorship_updates' then
    if tg_op = 'INSERT' then
      if new.author_id <> caller_id then
        raise exception
          'The update author must be the authenticated user';
      end if;
    else
      if old.author_id <> caller_id then
        raise exception
          'Only the update author may edit this update';
      end if;

      if new.mentorship_id <> old.mentorship_id then
        raise exception
          'The mentorship cannot be changed';
      end if;

      if new.author_id <> old.author_id then
        raise exception
          'The update author cannot be changed';
      end if;

      if new.body is distinct from old.body then
        new.edited_at := now();
      end if;
    end if;
  end if;


  if tg_table_name = 'mentorship_milestones' then
    if tg_op = 'INSERT' then
      if new.created_by <> caller_id then
        raise exception
          'The milestone creator must be the authenticated user';
      end if;

      validate_milestone_target := true;
    else
      if new.mentorship_id <> old.mentorship_id then
        raise exception
          'The mentorship cannot be changed';
      end if;

      if new.created_by <> old.created_by then
        raise exception
          'The milestone creator cannot be changed';
      end if;

      if new.target_date is distinct from old.target_date then
        validate_milestone_target := true;
      end if;
    end if;


    if
      validate_milestone_target
      and new.target_date is not null
    then
      if
        target_mentorship.start_date is not null
        and new.target_date <
          target_mentorship.start_date
      then
        raise exception
          'The milestone target date cannot fall before the mentorship start date';
      end if;

      if
        target_mentorship.expected_end_date is not null
        and new.target_date >
          target_mentorship.expected_end_date
      then
        raise exception
          'The milestone target date cannot fall after the mentorship end date';
      end if;
    end if;
  end if;


  if tg_table_name = 'mentorship_action_items' then
    if new.assigned_to not in (
      target_mentorship.mentor_id,
      target_mentorship.mentee_id
    ) then
      raise exception
        'Action items may only be assigned to mentorship participants';
    end if;


    if tg_op = 'INSERT' then
      if new.created_by <> caller_id then
        raise exception
          'The action-item creator must be the authenticated user';
      end if;

      validate_action_dates := true;
    else
      if new.mentorship_id <> old.mentorship_id then
        raise exception
          'The mentorship cannot be changed';
      end if;

      if new.created_by <> old.created_by then
        raise exception
          'The action-item creator cannot be changed';
      end if;

      if
        new.due_date is distinct from old.due_date
        or new.milestone_id is distinct from old.milestone_id
      then
        validate_action_dates := true;
      end if;
    end if;


    if validate_action_dates then
      if new.due_date is null then
        raise exception
          'Action items require a due date within the mentorship cycle';
      end if;


      if
        target_mentorship.start_date is not null
        and new.due_date <
          target_mentorship.start_date
      then
        raise exception
          'The action-item due date cannot fall before the mentorship start date';
      end if;


      if
        target_mentorship.expected_end_date is not null
        and new.due_date >
          target_mentorship.expected_end_date
      then
        raise exception
          'The action-item due date cannot fall after the mentorship end date';
      end if;


      if new.milestone_id is not null then
        select *
        into linked_milestone
        from public.mentorship_milestones
        where id = new.milestone_id;

        if not found then
          raise exception
            'Linked milestone not found';
        end if;


        if
          linked_milestone.mentorship_id <>
            new.mentorship_id
        then
          raise exception
            'The linked milestone must belong to the same mentorship';
        end if;


        if
          linked_milestone.target_date is not null
          and new.due_date >
            linked_milestone.target_date
        then
          raise exception
            'The action-item due date cannot fall after the linked milestone target date';
        end if;
      end if;
    end if;
  end if;


  return new;
end;
$function$;


revoke all
on function
public.validate_mentorship_workspace_record()
from public, anon, authenticated;


commit;
