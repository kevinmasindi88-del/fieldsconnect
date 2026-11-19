-- ============================================================
-- Fix Library RLS for externally hosted resources
-- ============================================================
-- Older policies required a non-null positive file_size_bytes
-- value. External-link resources intentionally have no file
-- payload, so publication and visibility updates were rejected.
--
-- The table-level library_documents_resource_payload_check
-- constraint continues to enforce the correct payload for both
-- uploaded_file and external_link resources.
-- ============================================================

begin;

alter table public.library_documents
enable row level security;

grant select, insert, update, delete
on public.library_documents
to authenticated;

drop policy if exists
  "library_documents_insert_own"
on public.library_documents;

create policy
  "library_documents_insert_own"
on public.library_documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (
    (
      resource_type = 'uploaded_file'
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 8388608
      and storage_bucket is not null
      and storage_path is not null
      and external_url is null
    )
    or
    (
      resource_type = 'external_link'
      and file_size_bytes is null
      and storage_bucket is null
      and storage_path is null
      and external_url is not null
      and source_title is not null
      and source_publisher is not null
      and source_accessed_on is not null
      and link_access_confirmed = true
    )
  )
);

drop policy if exists
  "library_documents_update_own"
on public.library_documents;

create policy
  "library_documents_update_own"
on public.library_documents
for update
to authenticated
using (
  owner_id = auth.uid()
  and deleted_at is null
)
with check (
  owner_id = auth.uid()
  and deleted_at is null
  and (
    (
      resource_type = 'uploaded_file'
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 8388608
      and storage_bucket is not null
      and storage_path is not null
      and external_url is null
    )
    or
    (
      resource_type = 'external_link'
      and file_size_bytes is null
      and storage_bucket is null
      and storage_path is null
      and external_url is not null
      and source_title is not null
      and source_publisher is not null
      and source_accessed_on is not null
      and link_access_confirmed = true
    )
  )
);

notify pgrst, 'reload schema';

commit;