begin;


create or replace function public.search_people(
  search_term text default '',
  role_filter text default 'all',
  mentor_filter text default 'all',
  result_limit integer default 21,
  result_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  username text,
  role_type text,
  field text,
  bio text,
  mentor_available boolean,
  avatar_url text
)
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_profile_id uuid;
  normalized_search text;
  safe_limit integer;
  safe_offset integer;
begin
  current_profile_id := auth.uid();

  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;


  if role_filter not in (
    'all',
    'student',
    'professional',
    'institution'
  ) then
    raise exception 'Invalid role filter';
  end if;


  if mentor_filter not in (
    'all',
    'mentors',
    'non-mentors'
  ) then
    raise exception 'Invalid mentor filter';
  end if;


  normalized_search :=
    nullif(
      trim(
        regexp_replace(
          coalesce(search_term, ''),
          '[,%()]',
          ' ',
          'g'
        )
      ),
      ''
    );


  safe_limit :=
    least(
      greatest(
        coalesce(result_limit, 21),
        1
      ),
      50
    );

  safe_offset :=
    greatest(
      coalesce(result_offset, 0),
      0
    );


  return query
  select
    profile.id,
    profile.display_name,
    profile.username,
    profile.role_type,
    profile.field,
    profile.bio,
    profile.mentor_available,
    profile.avatar_url
  from public.profiles profile
  where profile.id <> current_profile_id

    and not exists (
      select 1
      from public.connections connection
      where connection.status in (
        'pending',
        'accepted'
      )
        and (
          (
            connection.requester_id = current_profile_id
            and connection.recipient_id = profile.id
          )
          or
          (
            connection.recipient_id = current_profile_id
            and connection.requester_id = profile.id
          )
        )
    )

    and (
      role_filter = 'all'
      or profile.role_type = role_filter
    )

    and (
      mentor_filter = 'all'
      or (
        mentor_filter = 'mentors'
        and profile.mentor_available = true
      )
      or (
        mentor_filter = 'non-mentors'
        and profile.mentor_available = false
      )
    )

    and (
      normalized_search is null
      or profile.display_name ilike
        '%' || normalized_search || '%'
      or coalesce(profile.username, '') ilike
        '%' || normalized_search || '%'
      or coalesce(profile.field, '') ilike
        '%' || normalized_search || '%'
      or exists (
        select 1
        from public.skills skill
        where skill.profile_id = profile.id
          and skill.is_published = true
          and skill.deleted_at is null
          and skill.name ilike
            '%' || normalized_search || '%'
      )
    )

  order by
    profile.display_name asc,
    profile.id asc

  limit safe_limit
  offset safe_offset;
end;
$function$;


revoke all
on function public.search_people(
  text,
  text,
  text,
  integer,
  integer
)
from public, anon;


grant execute
on function public.search_people(
  text,
  text,
  text,
  integer,
  integer
)
to authenticated;


commit;
