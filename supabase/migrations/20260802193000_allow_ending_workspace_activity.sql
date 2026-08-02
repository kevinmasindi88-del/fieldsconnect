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
  caller_id uuid;
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
    else
      if new.mentorship_id <> old.mentorship_id then
        raise exception
          'The mentorship cannot be changed';
      end if;

      if new.created_by <> old.created_by then
        raise exception
          'The milestone creator cannot be changed';
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
    else
      if new.mentorship_id <> old.mentorship_id then
        raise exception
          'The mentorship cannot be changed';
      end if;

      if new.created_by <> old.created_by then
        raise exception
          'The action-item creator cannot be changed';
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