-- Connection search should include pending and accepted relationships.
-- Connect users see Request pending / Connected on search cards.
-- Mentor-specific discovery still excludes existing connection relationships.
-- Preserve the original private profile projection and blocking restriction.

CREATE OR REPLACE FUNCTION public.search_people_discoverable(search_term text DEFAULT ''::text, role_filter text DEFAULT 'all'::text, mentor_filter text DEFAULT 'all'::text, result_limit integer DEFAULT 21, result_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, display_name text, username text, role_type text, field text, bio text, mentor_available boolean, avatar_url text, profile_visibility text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  viewer_id uuid := auth.uid();
  needle text;
BEGIN
  IF viewer_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF role_filter NOT IN ('all','student','professional','institution') THEN
    RAISE EXCEPTION 'Invalid role filter';
  END IF;
  IF mentor_filter NOT IN ('all','mentors','non-mentors') THEN
    RAISE EXCEPTION 'Invalid mentor filter';
  END IF;
  needle := NULLIF(trim(pg_catalog.regexp_replace(coalesce(search_term,''),'[,%()]',' ','g')),'');
  RETURN QUERY
  SELECT p.id,
    p.display_name,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.username END,
    CASE WHEN p.profile_visibility = 'private' THEN 'private' ELSE p.role_type END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.field END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.bio END,
    CASE WHEN p.profile_visibility = 'private' THEN false ELSE p.mentor_available END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.avatar_url END,
    p.profile_visibility
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.is_active = true
    AND p.id <> viewer_id
    AND p.profile_visibility IN ('public','private')
    AND NOT public.has_block_between(viewer_id,p.id)
    -- Connect search includes existing relationships so their status can be displayed.
    -- Mentor-specific discovery still excludes active connections.
    AND (
      mentor_filter = 'all'
      OR NOT EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status IN ('pending','accepted')
          AND ((c.requester_id = viewer_id AND c.recipient_id = p.id)
            OR (c.recipient_id = viewer_id AND c.requester_id = p.id))
      )
    )
    AND (
      (p.profile_visibility = 'private' AND role_filter = 'all' AND mentor_filter = 'all'
       AND (needle IS NULL OR p.display_name ILIKE '%' || needle || '%'))
      OR
      (p.profile_visibility = 'public'
       AND (role_filter = 'all' OR p.role_type = role_filter)
       AND (mentor_filter = 'all'
         OR (mentor_filter = 'mentors' AND p.mentor_available = true)
         OR (mentor_filter = 'non-mentors' AND p.mentor_available = false))
       AND (needle IS NULL OR p.display_name ILIKE '%' || needle || '%'
         OR coalesce(p.username,'') ILIKE '%' || needle || '%'
         OR coalesce(p.field,'') ILIKE '%' || needle || '%'
         OR EXISTS (SELECT 1 FROM public.skills s
           WHERE s.profile_id = p.id AND s.deleted_at IS NULL
             AND s.is_published = true AND s.name ILIKE '%' || needle || '%')))
    )
  ORDER BY p.display_name,p.id
  LIMIT LEAST(GREATEST(coalesce(result_limit,21),1),50)
  OFFSET LEAST(GREATEST(coalesce(result_offset,0),0),10000);
END;
$function$;
