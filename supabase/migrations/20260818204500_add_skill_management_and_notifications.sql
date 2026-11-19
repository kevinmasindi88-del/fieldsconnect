-- FieldsConnect Skills v2
-- Edit/update, publish notifications, progression notifications,
-- and owner soft deletion.

begin;

-- ============================================================
-- Create skill
-- ============================================================

create or replace function public.create_skill(
  skill_name text,
  skill_description text default null,
  skill_rating integer default 3,
  publish_skill boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  new_skill public.skills%rowtype;
  connection_record record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(skill_name, '')) = '' then
    raise exception 'Skill name is required';
  end if;

  if skill_rating is null or skill_rating not between 1 and 5 then
    raise exception 'Skill rating must be between 1 and 5';
  end if;

  if publish_skill is null then
    raise exception 'Publish state is required';
  end if;

  insert into public.skills (
    profile_id,
    name,
    description,
    rating,
    is_published
  )
  values (
    auth.uid(),
    trim(skill_name),
    nullif(trim(coalesce(skill_description, '')), ''),
    skill_rating,
    publish_skill
  )
  returning *
  into new_skill;

  if publish_skill then
    for connection_record in
      select distinct
        case
          when connection.requester_id = auth.uid()
            then connection.recipient_id
          else connection.requester_id
        end as connection_user_id
      from public.connections connection
      where connection.status = 'accepted'
        and (
          connection.requester_id = auth.uid()
          or connection.recipient_id = auth.uid()
        )
    loop
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
        connection_record.connection_user_id,
        auth.uid(),
        'skill_published',
        'skill',
        new_skill.id,
        'New skill published',
        'A connection published a new skill: ' || new_skill.name || '.'
      );
    end loop;
  end if;

  return new_skill.id;
end;
$function$;

-- ============================================================
-- Update own skill
-- ============================================================

create or replace function public.update_own_skill(
  skill_id uuid,
  skill_name text,
  skill_description text,
  skill_rating integer,
  publish_skill boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_skill public.skills%rowtype;
  changed boolean;
  became_published boolean;
  published_update boolean;
  connection_record record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(skill_name, '')) = '' then
    raise exception 'Skill name is required';
  end if;

  if skill_rating is null or skill_rating not between 1 and 5 then
    raise exception 'Skill rating must be between 1 and 5';
  end if;

  if publish_skill is null then
    raise exception 'Publish state is required';
  end if;

  select skill.*
  into existing_skill
  from public.skills skill
  where skill.id = skill_id
    and skill.profile_id = auth.uid()
    and skill.deleted_at is null
  for update;

  if existing_skill.id is null then
    raise exception 'Skill not found or access denied';
  end if;

  changed :=
    existing_skill.name is distinct from trim(skill_name)
    or existing_skill.description is distinct from
      nullif(trim(coalesce(skill_description, '')), '')
    or existing_skill.rating is distinct from skill_rating
    or existing_skill.is_published is distinct from publish_skill;

  if not changed then
    return;
  end if;

  became_published :=
    existing_skill.is_published = false
    and publish_skill = true;

  published_update :=
    existing_skill.is_published = true
    and publish_skill = true
    and (
      existing_skill.name is distinct from trim(skill_name)
      or existing_skill.description is distinct from
        nullif(trim(coalesce(skill_description, '')), '')
      or existing_skill.rating is distinct from skill_rating
    );

  update public.skills
  set
    name = trim(skill_name),
    description = nullif(trim(coalesce(skill_description, '')), ''),
    rating = skill_rating,
    is_published = publish_skill
  where id = existing_skill.id;

  if became_published or published_update then
    for connection_record in
      select distinct
        case
          when connection.requester_id = auth.uid()
            then connection.recipient_id
          else connection.requester_id
        end as connection_user_id
      from public.connections connection
      where connection.status = 'accepted'
        and (
          connection.requester_id = auth.uid()
          or connection.recipient_id = auth.uid()
        )
    loop
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
        connection_record.connection_user_id,
        auth.uid(),
        case
          when became_published then 'skill_published'
          else 'skill_updated'
        end,
        'skill',
        existing_skill.id,
        case
          when became_published then 'Skill published'
          else 'Skill updated'
        end,
        case
          when became_published
            then 'A connection published a skill: ' || trim(skill_name) || '.'
          else 'A connection updated their skill: ' || trim(skill_name) || '.'
        end
      );
    end loop;
  end if;
end;
$function$;

-- ============================================================
-- Soft-delete own skill
-- ============================================================

create or replace function public.soft_delete_own_skill(
  skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.skills
  set
    deleted_at = now(),
    is_published = false
  where id = skill_id
    and profile_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Skill not found or access denied';
  end if;
end;
$function$;

-- ============================================================
-- Permissions
-- ============================================================

revoke all
on function public.create_skill(text, text, integer, boolean)
from public, anon;

grant execute
on function public.create_skill(text, text, integer, boolean)
to authenticated;

revoke all
on function public.update_own_skill(uuid, text, text, integer, boolean)
from public, anon;

grant execute
on function public.update_own_skill(uuid, text, text, integer, boolean)
to authenticated;

revoke all
on function public.soft_delete_own_skill(uuid)
from public, anon;

grant execute
on function public.soft_delete_own_skill(uuid)
to authenticated;

commit;

notify pgrst, 'reload schema';
