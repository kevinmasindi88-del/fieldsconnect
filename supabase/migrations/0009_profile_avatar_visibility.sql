-- FieldsConnect Profile Avatar Visibility
-- Allows authenticated users to view profile avatars on social surfaces.
-- Upload, update, and delete remain restricted to the owner's folder.

drop policy if exists "profile_avatar_storage_select_own_folder"
on storage.objects;

create policy "profile_avatar_storage_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
);
