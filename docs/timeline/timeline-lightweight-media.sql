-- Lightweight timeline media: images follow post visibility, not profile visibility.
alter table public.posts
  add column if not exists image_path text,
  add column if not exists link_url text;
alter table public.posts drop constraint if exists posts_image_path_owner_check;
alter table public.posts add constraint posts_image_path_owner_check
  check (image_path is null or (
    image_path like author_id::text || '/%'
    and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.jpg$'
  ));
alter table public.posts drop constraint if exists posts_link_url_size_check;
alter table public.posts add constraint posts_link_url_size_check
  check (link_url is null or char_length(link_url) <= 2048);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('timeline-images','timeline-images',false,2097152,array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "timeline_images_upload_own_folder" on storage.objects;
create policy "timeline_images_upload_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'timeline-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_account_suspended((select auth.uid()))
  );

drop policy if exists "timeline_images_read_visible_posts" on storage.objects;
create policy "timeline_images_read_visible_posts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'timeline-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.posts p
        where p.image_path = name and p.deleted_at is null
      )
    )
  );

drop policy if exists "timeline_images_delete_own_folder" on storage.objects;
create policy "timeline_images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'timeline-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );