-- Follow-up to timeline_lightweight_media_images_and_links: avoid regex escape ambiguity.
alter table public.posts drop constraint if exists posts_image_path_owner_check;
alter table public.posts add constraint posts_image_path_owner_check
  check (image_path is null or (image_path like author_id::text || '/%' and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]jpg$'));
