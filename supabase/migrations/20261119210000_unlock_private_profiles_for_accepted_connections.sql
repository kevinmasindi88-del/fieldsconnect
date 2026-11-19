-- Accepted connections unlock private details while preserving content visibility.
-- This migration does not change any member's profile_visibility.
DROP POLICY IF EXISTS profiles_select_visible ON public.profiles;
CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND is_active = true AND (
    id = (SELECT auth.uid()) OR profile_visibility = 'public'
    OR (profile_visibility IN ('private','connections')
      AND public.are_accepted_connections((SELECT auth.uid()),id)
      AND NOT public.has_block_between((SELECT auth.uid()),id))
  )
);

DROP POLICY IF EXISTS skills_select_visible ON public.skills;
CREATE POLICY skills_select_visible ON public.skills FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND is_published = true
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = skills.profile_id AND p.is_active = true AND p.deleted_at IS NULL
    AND (p.profile_visibility = 'public'
      OR (p.profile_visibility IN ('private','connections')
        AND public.are_accepted_connections((SELECT auth.uid()),p.id)
        AND NOT public.has_block_between((SELECT auth.uid()),p.id))))
);

DROP POLICY IF EXISTS library_documents_select_visible ON public.library_documents;
CREATE POLICY library_documents_select_visible ON public.library_documents FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND (
    owner_id = (SELECT auth.uid())
    OR (is_published = true
      AND EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id = library_documents.owner_id
        AND p.is_active = true AND p.deleted_at IS NULL
        AND (p.profile_visibility = 'public'
          OR (p.profile_visibility IN ('private','connections')
            AND public.are_accepted_connections((SELECT auth.uid()),p.id)
            AND NOT public.has_block_between((SELECT auth.uid()),p.id))))
      AND (visibility = 'public'
        OR (visibility = 'connections'
          AND public.are_accepted_connections(owner_id,(SELECT auth.uid()))
          AND NOT public.has_block_between(owner_id,(SELECT auth.uid())))))
  )
);

DROP POLICY IF EXISTS library_storage_select_visible_documents ON storage.objects;
CREATE POLICY library_storage_select_visible_documents ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'library-documents'
  AND EXISTS (SELECT 1 FROM public.library_documents d
    WHERE d.storage_path = name AND d.deleted_at IS NULL
    AND (d.owner_id = (SELECT auth.uid())
      OR (d.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p
          WHERE p.id = d.owner_id AND p.is_active = true AND p.deleted_at IS NULL
          AND (p.profile_visibility = 'public'
            OR (p.profile_visibility IN ('private','connections')
              AND public.are_accepted_connections((SELECT auth.uid()),p.id)
              AND NOT public.has_block_between((SELECT auth.uid()),p.id))))
        AND (d.visibility = 'public'
          OR (d.visibility = 'connections'
            AND public.are_accepted_connections(d.owner_id,(SELECT auth.uid()))
            AND NOT public.has_block_between(d.owner_id,(SELECT auth.uid()))))))
  )
);

DROP POLICY IF EXISTS mentor_profiles_select_authenticated ON public.mentor_profiles;
CREATE POLICY mentor_profiles_select_authenticated ON public.mentor_profiles FOR SELECT TO authenticated USING (
  mentor_id = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = mentor_profiles.mentor_id AND p.deleted_at IS NULL AND p.is_active = true
    AND (p.profile_visibility = 'public'
      OR (p.profile_visibility IN ('private','connections')
        AND public.are_accepted_connections((SELECT auth.uid()),p.id)
        AND NOT public.has_block_between((SELECT auth.uid()),p.id))))
);
