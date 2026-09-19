begin;


create or replace function public.create_post_with_mentions(
  post_body text,
  post_visibility text default 'public',
  mentioned_profile_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_profile_id uuid;
  created_post_id uuid;
  normalized_body text;
  mention_count integer;
  unique_mention_count integer;
begin
  current_profile_id := auth.uid();

  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;


  normalized_body := trim(post_body);

  if normalized_body is null
    or char_length(normalized_body) = 0
  then
    raise exception 'Post body is required';
  end if;


  if post_visibility not in (
    'public',
    'connections'
  ) then
    raise exception 'Invalid post visibility';
  end if;


  mention_count :=
    coalesce(
      array_length(mentioned_profile_ids, 1),
      0
    );

  if mention_count > 10 then
    raise exception
      'A post may mention at most 10 connections';
  end if;


  select count(distinct profile_id)
  into unique_mention_count
  from unnest(
    coalesce(
      mentioned_profile_ids,
      '{}'::uuid[]
    )
  ) as profile_id;


  if unique_mention_count <> mention_count then
    raise exception
      'Duplicate mentions are not allowed';
  end if;


  insert into public.posts (
    author_id,
    body,
    visibility
  )
  values (
    current_profile_id,
    normalized_body,
    post_visibility
  )
  returning id
  into created_post_id;


  if mention_count > 0 then
    insert into public.post_mentions (
      post_id,
      mentioned_profile_id,
      mentioned_by
    )
    select
      created_post_id,
      profile_id,
      current_profile_id
    from unnest(mentioned_profile_ids)
      as profile_id;
  end if;


  return created_post_id;
end;
$function$;


revoke all
on function public.create_post_with_mentions(
  text,
  text,
  uuid[]
)
from public, anon;


grant execute
on function public.create_post_with_mentions(
  text,
  text,
  uuid[]
)
to authenticated;


commit;
