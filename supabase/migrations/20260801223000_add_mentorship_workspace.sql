-- Private mentorship workspace foundation.
-- Includes shared updates, milestones and participant action items.

begin;

create table if not exists public.mentorship_updates (
  id uuid primary key default gen_random_uuid(),

  mentorship_id uuid not null
    references public.mentorships(id)
    on delete cascade,

  author_id uuid not null
    references public.profiles(id)
    on delete restrict,

  update_type text not null default 'progress'
    check (
      update_type in (
        'progress',
        'discussion',
        'reflection',
        'decision'
      )
    ),

  body text not null
    check (
      char_length(trim(body))
      between 2 and 5000
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists
mentorship_updates_mentorship_created_idx
on public.mentorship_updates (
  mentorship_id,
  created_at desc
);

create index if not exists
mentorship_updates_author_idx
on public.mentorship_updates (
  author_id,
  created_at desc
);

drop trigger if exists
mentorship_updates_set_updated_at
on public.mentorship_updates;

create trigger
mentorship_updates_set_updated_at
before update
on public.mentorship_updates
for each row
execute function public.set_updated_at();


create table if not exists public.mentorship_milestones (
  id uuid primary key default gen_random_uuid(),

  mentorship_id uuid not null
    references public.mentorships(id)
    on delete cascade,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  title text not null
    check (
      char_length(trim(title))
      between 2 and 160
    ),

  description text
    check (
      description is null
      or char_length(trim(description)) <= 3000
    ),

  target_date date,

  status text not null default 'planned'
    check (
      status in (
        'planned',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  completed_by uuid
    references public.profiles(id)
    on delete set null,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (
      status = 'completed'
      and completed_at is not null
      and completed_by is not null
    )
    or
    (
      status <> 'completed'
      and completed_at is null
      and completed_by is null
    )
  )
);

create index if not exists
mentorship_milestones_mentorship_status_idx
on public.mentorship_milestones (
  mentorship_id,
  status,
  target_date
);

drop trigger if exists
mentorship_milestones_set_updated_at
on public.mentorship_milestones;

create trigger
mentorship_milestones_set_updated_at
before update
on public.mentorship_milestones
for each row
execute function public.set_updated_at();


create table if not exists public.mentorship_action_items (
  id uuid primary key default gen_random_uuid(),

  mentorship_id uuid not null
    references public.mentorships(id)
    on delete cascade,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  assigned_to uuid not null
    references public.profiles(id)
    on delete restrict,

  title text not null
    check (
      char_length(trim(title))
      between 2 and 200
    ),

  description text
    check (
      description is null
      or char_length(trim(description)) <= 3000
    ),

  due_date date,

  status text not null default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  completed_by uuid
    references public.profiles(id)
    on delete set null,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (
      status = 'completed'
      and completed_at is not null
      and completed_by is not null
    )
    or
    (
      status <> 'completed'
      and completed_at is null
      and completed_by is null
    )
  )
);

create index if not exists
mentorship_action_items_mentorship_status_idx
on public.mentorship_action_items (
  mentorship_id,
  status,
  due_date
);

create index if not exists
mentorship_action_items_assigned_idx
on public.mentorship_action_items (
  assigned_to,
  status,
  due_date
);

drop trigger if exists
mentorship_action_items_set_updated_at
on public.mentorship_action_items;

create trigger
mentorship_action_items_set_updated_at
before update
on public.mentorship_action_items
for each row
execute function public.set_updated_at();


create or replace function
public.is_mentorship_participant(
  target_mentorship_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.mentorships mentorship
      where mentorship.id = target_mentorship_id
        and (
          mentorship.mentor_id = auth.uid()
          or mentorship.mentee_id = auth.uid()
        )
    );
$function$;

revoke all
on function public.is_mentorship_participant(uuid)
from public, anon;

grant execute
on function public.is_mentorship_participant(uuid)
to authenticated;


create or replace function
public.validate_mentorship_workspace_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentorship_record public.mentorships%rowtype;
begin
  select *
  into mentorship_record
  from public.mentorships
  where id = new.mentorship_id;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if mentorship_record.status not in (
    'active',
    'paused',
    'completion_requested'
  ) then
    raise exception
      'This mentorship workspace is no longer active';
  end if;

  if tg_table_name = 'mentorship_updates' then
    if new.author_id not in (
      mentorship_record.mentor_id,
      mentorship_record.mentee_id
    ) then
      raise exception
        'Update author must be a mentorship participant';
    end if;

    if tg_op = 'UPDATE'
      and new.author_id <> old.author_id then
      raise exception 'Update author cannot be changed';
    end if;

    if tg_op = 'UPDATE'
      and new.body is distinct from old.body then
      new.edited_at := now();
    end if;
  end if;

  if tg_table_name = 'mentorship_milestones' then
    if new.created_by not in (
      mentorship_record.mentor_id,
      mentorship_record.mentee_id
    ) then
      raise exception
        'Milestone creator must be a mentorship participant';
    end if;

    if tg_op = 'UPDATE'
      and new.created_by <> old.created_by then
      raise exception 'Milestone creator cannot be changed';
    end if;

    if new.status = 'completed' then
      new.completed_by := coalesce(
        new.completed_by,
        auth.uid()
      );
      new.completed_at := coalesce(
        new.completed_at,
        now()
      );

      if new.completed_by not in (
        mentorship_record.mentor_id,
        mentorship_record.mentee_id
      ) then
        raise exception
          'Milestone completer must be a mentorship participant';
      end if;
    else
      new.completed_by := null;
      new.completed_at := null;
    end if;
  end if;

  if tg_table_name = 'mentorship_action_items' then
    if new.created_by not in (
      mentorship_record.mentor_id,
      mentorship_record.mentee_id
    ) then
      raise exception
        'Action-item creator must be a mentorship participant';
    end if;

    if new.assigned_to not in (
      mentorship_record.mentor_id,
      mentorship_record.mentee_id
    ) then
      raise exception
        'Action item can only be assigned to a mentorship participant';
    end if;

    if tg_op = 'UPDATE'
      and new.created_by <> old.created_by then
      raise exception 'Action-item creator cannot be changed';
    end if;

    if new.status = 'completed' then
      new.completed_by := coalesce(
        new.completed_by,
        auth.uid()
      );
      new.completed_at := coalesce(
        new.completed_at,
        now()
      );

      if new.completed_by not in (
        mentorship_record.mentor_id,
        mentorship_record.mentee_id
      ) then
        raise exception
          'Action-item completer must be a mentorship participant';
      end if;
    else
      new.completed_by := null;
      new.completed_at := null;
    end if;
  end if;

  return new;
end;
$function$;

revoke all
on function public.validate_mentorship_workspace_record()
from public, anon, authenticated;


drop trigger if exists
mentorship_updates_validate
on public.mentorship_updates;

create trigger
mentorship_updates_validate
before insert or update
on public.mentorship_updates
for each row
execute function
public.validate_mentorship_workspace_record();


drop trigger if exists
mentorship_milestones_validate
on public.mentorship_milestones;

create trigger
mentorship_milestones_validate
before insert or update
on public.mentorship_milestones
for each row
execute function
public.validate_mentorship_workspace_record();


drop trigger if exists
mentorship_action_items_validate
on public.mentorship_action_items;

create trigger
mentorship_action_items_validate
before insert or update
on public.mentorship_action_items
for each row
execute function
public.validate_mentorship_workspace_record();


alter table public.mentorship_updates
enable row level security;

alter table public.mentorship_milestones
enable row level security;

alter table public.mentorship_action_items
enable row level security;


drop policy if exists
"mentorship_updates_select_participants"
on public.mentorship_updates;

create policy
"mentorship_updates_select_participants"
on public.mentorship_updates
for select
to authenticated
using (
  public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_updates_insert_participants"
on public.mentorship_updates;

create policy
"mentorship_updates_insert_participants"
on public.mentorship_updates
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_updates_update_author"
on public.mentorship_updates;

create policy
"mentorship_updates_update_author"
on public.mentorship_updates
for update
to authenticated
using (
  author_id = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
)
with check (
  author_id = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_updates_delete_author"
on public.mentorship_updates;

create policy
"mentorship_updates_delete_author"
on public.mentorship_updates
for delete
to authenticated
using (
  author_id = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);


drop policy if exists
"mentorship_milestones_select_participants"
on public.mentorship_milestones;

create policy
"mentorship_milestones_select_participants"
on public.mentorship_milestones
for select
to authenticated
using (
  public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_milestones_insert_participants"
on public.mentorship_milestones;

create policy
"mentorship_milestones_insert_participants"
on public.mentorship_milestones
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_milestones_update_participants"
on public.mentorship_milestones;

create policy
"mentorship_milestones_update_participants"
on public.mentorship_milestones
for update
to authenticated
using (
  public.is_mentorship_participant(
    mentorship_id
  )
)
with check (
  public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_milestones_delete_creator"
on public.mentorship_milestones;

create policy
"mentorship_milestones_delete_creator"
on public.mentorship_milestones
for delete
to authenticated
using (
  created_by = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);


drop policy if exists
"mentorship_action_items_select_participants"
on public.mentorship_action_items;

create policy
"mentorship_action_items_select_participants"
on public.mentorship_action_items
for select
to authenticated
using (
  public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_action_items_insert_participants"
on public.mentorship_action_items;

create policy
"mentorship_action_items_insert_participants"
on public.mentorship_action_items
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_action_items_update_participants"
on public.mentorship_action_items;

create policy
"mentorship_action_items_update_participants"
on public.mentorship_action_items
for update
to authenticated
using (
  public.is_mentorship_participant(
    mentorship_id
  )
)
with check (
  public.is_mentorship_participant(
    mentorship_id
  )
);

drop policy if exists
"mentorship_action_items_delete_creator"
on public.mentorship_action_items;

create policy
"mentorship_action_items_delete_creator"
on public.mentorship_action_items
for delete
to authenticated
using (
  created_by = auth.uid()
  and public.is_mentorship_participant(
    mentorship_id
  )
);


grant select, insert, update, delete
on public.mentorship_updates
to authenticated;

grant select, insert, update, delete
on public.mentorship_milestones
to authenticated;

grant select, insert, update, delete
on public.mentorship_action_items
to authenticated;

commit;