-- Discoverable identity is distinct from profile-content access.
-- Private members can be found by name, but their skills, bio, library and mentor details remain restricted.
-- Never change existing members' profile_visibility values.

CREATE OR REPLACE FUNCTION public.search_people_discoverable(
  search_term text DEFAULT '',
  role_filter text DEFAULT 'all',
  mentor_filter text DEFAULT 'all',
  result_limit integer DEFAULT 21,
  result_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  display_name text,
  username text,
  role_type text,
  field text,
  bio text,
  mentor_available boolean,
  avatar_url text,
  profile_visibility text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
    AND NOT EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status IN ('pending','accepted')
        AND ((c.requester_id = viewer_id AND c.recipient_id = p.id)
          OR (c.recipient_id = viewer_id AND c.requester_id = p.id))
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
$$;

REVOKE ALL ON FUNCTION public.search_people_discoverable(text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_people_discoverable(text,text,text,integer,integer) TO authenticated;

-- Return only safe search-card identity, never hidden profile fields.
CREATE OR REPLACE FUNCTION public.get_discoverable_member_cards(target_ids uuid[])
RETURNS TABLE(
  id uuid,
  display_name text,
  username text,
  role_type text,
  field text,
  bio text,
  mentor_available boolean,
  avatar_url text,
  profile_visibility text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE viewer_id uuid := auth.uid();
BEGIN
  IF viewer_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF coalesce(pg_catalog.array_length(target_ids,1),0) > 100 THEN
    RAISE EXCEPTION 'Too many member IDs';
  END IF;
  RETURN QUERY
  SELECT p.id,p.display_name,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.username END,
    CASE WHEN p.profile_visibility = 'private' THEN 'private' ELSE p.role_type END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.field END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.bio END,
    CASE WHEN p.profile_visibility = 'private' THEN false ELSE p.mentor_available END,
    CASE WHEN p.profile_visibility = 'private' THEN NULL ELSE p.avatar_url END,
    p.profile_visibility
  FROM public.profiles p
  WHERE p.id = ANY(target_ids)
    AND p.deleted_at IS NULL AND p.is_active = true
    AND p.profile_visibility IN ('public','private')
    AND (p.id = viewer_id OR NOT public.has_block_between(viewer_id,p.id));
END;
$$;

REVOKE ALL ON FUNCTION public.get_discoverable_member_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discoverable_member_cards(uuid[]) TO authenticated;

-- RLS protects actual content even if a caller bypasses the page UI.
DROP POLICY IF EXISTS skills_select_visible ON public.skills;
CREATE POLICY skills_select_visible ON public.skills FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND is_published = true
  AND EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id = profile_id AND p.profile_visibility = 'public'
                AND p.is_active = true AND p.deleted_at IS NULL)
);

DROP POLICY IF EXISTS library_documents_select_visible ON public.library_documents;
CREATE POLICY library_documents_select_visible ON public.library_documents FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    owner_id = (select auth.uid())
    OR (
      is_published = true
      AND EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id = owner_id AND p.profile_visibility = 'public'
          AND p.is_active = true AND p.deleted_at IS NULL)
      AND (
        visibility = 'public'
        OR (visibility = 'connections' AND public.are_accepted_connections(owner_id,(select auth.uid())))
      )
    )
  )
);

DROP POLICY IF EXISTS library_storage_select_visible_documents ON storage.objects;
CREATE POLICY library_storage_select_visible_documents ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'library-documents'
  AND EXISTS (
    SELECT 1 FROM public.library_documents d
    WHERE d.storage_path = name
      AND d.deleted_at IS NULL
      AND (
        d.owner_id = (select auth.uid())
        OR (
          d.is_published = true
          AND EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = d.owner_id AND p.profile_visibility = 'public'
              AND p.is_active = true AND p.deleted_at IS NULL)
          AND (d.visibility = 'public'
            OR (d.visibility = 'connections' AND public.are_accepted_connections(d.owner_id,(select auth.uid()))))
        )
      )
  )
);

DROP POLICY IF EXISTS mentor_profiles_select_authenticated ON public.mentor_profiles;
CREATE POLICY mentor_profiles_select_authenticated ON public.mentor_profiles FOR SELECT TO authenticated
USING (
  mentor_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = mentor_id AND p.profile_visibility = 'public'
      AND p.is_active = true AND p.deleted_at IS NULL)
);
