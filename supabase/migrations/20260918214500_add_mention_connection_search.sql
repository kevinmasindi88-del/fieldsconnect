begin;


-- ---------------------------------------------------------------------------
-- Search accepted connections for Timeline mentions.
-- Server-side search keeps the mention picker scalable for large networks.
-- ---------------------------------------------------------------------------

create or replace function public.search_mentionable_connections(
  search_term text default '',
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  profile_id uuid,
  display_name text,
  username text,
  field text,
  avatar_url text
)
language plpgsql
security definer
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

  normalized_search :=
    nullif(trim(search_term), '');

  safe_limit :=
    least(greatest(coalesce(result_limit, 20), 1), 50);

  safe_offset :=
    greatest(coalesce(result_offset, 0), 0);


  return query
  select
    profile.id as profile_id,
    profile.display_name,
    profile.username,
    profile.field,
    profile.avatar_url
  from public.connections connection
  join public.profiles profile
    on profile.id =
      case
        when connection.requester_id = current_profile_id
          then connection.recipient_id
        else connection.requester_id
      end
  where connection.status = 'accepted'
    and (
      connection.requester_id = current_profile_id
      or connection.recipient_id = current_profile_id
    )
    and profile.id <> current_profile_id
    and profile.deleted_at is null
    and profile.is_active = true
    and not public.has_block_between(
      current_profile_id,
      profile.id
    )
    and (
      normalized_search is null
      or profile.display_name ilike
        '%' || normalized_search || '%'
      or coalesce(profile.username, '') ilike
        '%' || normalized_search || '%'
      or coalesce(profile.field, '') ilike
        '%' || normalized_search || '%'
    )
  order by
    case
      when normalized_search is not null
        and lower(profile.display_name) =
          lower(normalized_search)
      then 0
      when normalized_search is not null
        and lower(profile.display_name) like
          lower(normalized_search) || '%'
      then 1
      when normalized_search is not null
        and lower(coalesce(profile.username, '')) like
          lower(normalized_search) || '%'
      then 2
      else 3
    end,
    profile.display_name asc,
    profile.id
  limit safe_limit
  offset safe_offset;
end;
$function$;


revoke all
on function public.search_mentionable_connections(
  text,
  integer,
  integer
)
from public, anon;


grant execute
on function public.search_mentionable_connections(
  text,
  integer,
  integer
)
to authenticated;


commit;
