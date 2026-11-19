-- Add milestone linkage and controlled completion review
-- to mentorship action items.

begin;


-- ---------------------------------------------------------
-- 1. Link an action item to a mentorship milestone.
-- ---------------------------------------------------------

alter table public.mentorship_action_items
add column if not exists milestone_id uuid
references public.mentorship_milestones(id)
on delete set null;


create index if not exists
mentorship_action_items_milestone_idx
on public.mentorship_action_items (
  milestone_id
)
where milestone_id is not null;


-- ---------------------------------------------------------
-- 2. Add completion submission and review evidence.
-- ---------------------------------------------------------

alter table public.mentorship_action_items
add column if not exists completion_summary text;

alter table public.mentorship_action_items
add column if not exists completion_submitted_at timestamptz;

alter table public.mentorship_action_items
add column if not exists completion_rating smallint;

alter table public.mentorship_action_items
add column if not exists completion_review text;

alter table public.mentorship_action_items
add column if not exists completion_reviewed_at timestamptz;

alter table public.mentorship_action_items
add column if not exists completion_reviewed_by uuid
references public.profiles(id)
on delete set null;


alter table public.mentorship_action_items
drop constraint if exists
mentorship_action_items_completion_rating_check;

alter table public.mentorship_action_items
add constraint
mentorship_action_items_completion_rating_check
check (
  completion_rating is null
  or completion_rating between 1 and 5
);


alter table public.mentorship_action_items
drop constraint if exists
mentorship_action_items_completion_summary_check;

alter table public.mentorship_action_items
add constraint
mentorship_action_items_completion_summary_check
check (
  completion_summary is null
  or char_length(trim(completion_summary))
    between 10 and 5000
);


alter table public.mentorship_action_items
drop constraint if exists
mentorship_action_items_completion_review_check;

alter table public.mentorship_action_items
add constraint
mentorship_action_items_completion_review_check
check (
  completion_review is null
  or char_length(trim(completion_review))
    between 2 and 3000
);


-- ---------------------------------------------------------
-- 3. Extend the status options.
-- ---------------------------------------------------------

do $block$
declare
  constraint_record record;
begin
  for constraint_record in
    select
      constraint_entry.conname
    from pg_catalog.pg_constraint constraint_entry
    where constraint_entry.conrelid =
      'public.mentorship_action_items'::regclass
      and constraint_entry.contype = 'c'
      and pg_catalog.pg_get_constraintdef(
        constraint_entry.oid
      ) ilike '%status%'
      and pg_catalog.pg_get_constraintdef(
        constraint_entry.oid
      ) ilike '%open%'
      and pg_catalog.pg_get_constraintdef(
        constraint_entry.oid
      ) ilike '%in_progress%'
  loop
    execute format(
      'alter table public.mentorship_action_items drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$block$;


alter table public.mentorship_action_items
add constraint
mentorship_action_items_status_check
check (
  status in (
    'open',
    'in_progress',
    'awaiting_review',
    'revision_requested',
    'completed',
    'cancelled'
  )
);


-- ---------------------------------------------------------
-- 4. Enforce the action-item workflow.
-- ---------------------------------------------------------

create or replace function
public.enforce_action_item_completion_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentorship_record public.mentorships%rowtype;
  milestone_mentorship_id uuid;
  caller_id uuid;
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
      'Only mentorship participants may manage action items';
  end if;


  -- The selected milestone must belong to the same mentorship.
  if new.milestone_id is not null then
    select milestone.mentorship_id
    into milestone_mentorship_id
    from public.mentorship_milestones milestone
    where milestone.id = new.milestone_id;

    if milestone_mentorship_id is null then
      raise exception
        'Linked milestone not found';
    end if;

    if milestone_mentorship_id <>
      new.mentorship_id then
      raise exception
        'The linked milestone must belong to the same mentorship';
    end if;
  end if;


  if tg_op = 'INSERT' then
    if caller_id <> new.created_by then
      raise exception
        'The action-item creator must be the signed-in participant';
    end if;

    if new.status <> 'open' then
      raise exception
        'New action items must start with open status';
    end if;

    new.completion_summary := null;
    new.completion_submitted_at := null;
    new.completion_rating := null;
    new.completion_review := null;
    new.completion_reviewed_at := null;
    new.completion_reviewed_by := null;
    new.completed_by := null;
    new.completed_at := null;

    return new;
  end if;


  if new.created_by <> old.created_by then
    raise exception
      'Action-item creator cannot be changed';
  end if;

  if new.mentorship_id <> old.mentorship_id then
    raise exception
      'Action-item mentorship cannot be changed';
  end if;


  -- Only the creator may change the milestone link.
  if new.milestone_id is distinct from
    old.milestone_id
    and caller_id <> old.created_by then
    raise exception
      'Only the action-item creator may change the linked milestone';
  end if;


  -- Only the creator may change the assignee.
  if new.assigned_to is distinct from
    old.assigned_to
    and caller_id <> old.created_by then
    raise exception
      'Only the action-item creator may change the assignee';
  end if;


  -- Only the assignee may write or revise the completion summary.
  if new.completion_summary is distinct from
    old.completion_summary
    and caller_id <> old.assigned_to then
    raise exception
      'Only the assignee may provide the completion summary';
  end if;


  -- Only the creator may write review evidence.
  if (
    new.completion_rating is distinct from
      old.completion_rating
    or new.completion_review is distinct from
      old.completion_review
  )
  and caller_id <> old.created_by then
    raise exception
      'Only the action-item creator may review the completion';
  end if;


  if new.status is distinct from old.status then

    -- The assignee starts or resumes work.
    if new.status = 'in_progress' then
      if caller_id <> old.assigned_to then
        raise exception
          'Only the assignee may start this action item';
      end if;

      if old.status not in (
        'open',
        'revision_requested'
      ) then
        raise exception
          'This action item cannot be moved to in progress from its current status';
      end if;

      new.completion_rating := null;
      new.completion_reviewed_at := null;
      new.completion_reviewed_by := null;
      new.completed_by := null;
      new.completed_at := null;


    -- The assignee submits completion evidence.
    elsif new.status = 'awaiting_review' then
      if caller_id <> old.assigned_to then
        raise exception
          'Only the assignee may submit this action item for review';
      end if;

      if old.status not in (
        'open',
        'in_progress',
        'revision_requested'
      ) then
        raise exception
          'This action item cannot be submitted from its current status';
      end if;

      if new.completion_summary is null
        or char_length(
          trim(new.completion_summary)
        ) < 10 then
        raise exception
          'A completion summary of at least 10 characters is required';
      end if;

      new.completion_submitted_at := now();
      new.completion_rating := null;
      new.completion_review := null;
      new.completion_reviewed_at := null;
      new.completion_reviewed_by := null;
      new.completed_by := null;
      new.completed_at := null;


    -- The creator approves and rates the completion.
    elsif new.status = 'completed' then
      if caller_id <> old.created_by then
        raise exception
          'Only the action-item creator may approve completion';
      end if;

      if old.status <> 'awaiting_review' then
        raise exception
          'Only an action item awaiting review may be completed';
      end if;

      if new.completion_summary is null
        or new.completion_submitted_at is null then
        raise exception
          'Completion evidence must be submitted before approval';
      end if;

      if new.completion_rating is null
        or new.completion_rating not between 1 and 5 then
        raise exception
          'A completion rating between 1 and 5 is required';
      end if;

      new.completion_reviewed_by := caller_id;
      new.completion_reviewed_at := now();

      -- The assignee completed the work.
      new.completed_by := old.assigned_to;
      new.completed_at := now();


    -- The creator returns the work for revision.
    elsif new.status = 'revision_requested' then
      if caller_id <> old.created_by then
        raise exception
          'Only the action-item creator may request revision';
      end if;

      if old.status <> 'awaiting_review' then
        raise exception
          'Only an action item awaiting review may be returned for revision';
      end if;

      if new.completion_review is null
        or char_length(
          trim(new.completion_review)
        ) < 2 then
        raise exception
          'Review feedback is required when requesting revision';
      end if;

      new.completion_rating := null;
      new.completion_reviewed_by := caller_id;
      new.completion_reviewed_at := now();
      new.completed_by := null;
      new.completed_at := null;


    -- Only the creator may cancel an action item.
    elsif new.status = 'cancelled' then
      if caller_id <> old.created_by then
        raise exception
          'Only the action-item creator may cancel it';
      end if;

      if old.status = 'completed' then
        raise exception
          'A completed action item cannot be cancelled';
      end if;

      new.completed_by := null;
      new.completed_at := null;


    -- Directly returning to open is not permitted.
    elsif new.status = 'open' then
      raise exception
        'An action item cannot be returned directly to open status';
    end if;
  end if;


  return new;
end;
$function$;


revoke all
on function
public.enforce_action_item_completion_review()
from public, anon, authenticated;


drop trigger if exists
mentorship_action_items_completion_review
on public.mentorship_action_items;


create trigger
mentorship_action_items_completion_review
before insert or update
on public.mentorship_action_items
for each row
execute function
public.enforce_action_item_completion_review();


commit;