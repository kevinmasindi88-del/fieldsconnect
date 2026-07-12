-- Refresh FieldsConnect library upload storage and RLS.
-- Idempotent repair for environments where the original library migration
-- did not fully apply.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-documents',
  'library-documents',
  false,
  8388608,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.library_documents enable row level security;

grant select, insert, update, delete
on public.library_documents
to authenticated;

drop policy if exists "library_documents_select_visible"
on public.library_documents;

create policy "library_documents_select_visible"
on public.library_documents
for select
to authenticated
using (
  deleted_at is null
  and (
    owner_id = auth.uid()
    or (is_published = true and visibility = 'public')
    or (
      is_published = true
      and visibility = 'connections'
      and public.are_accepted_connections(owner_id, auth.uid())
    )
  )
);

drop policy if exists "library_documents_insert_own"
on public.library_documents;

create policy "library_documents_insert_own"
on public.library_documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and file_size_bytes > 0
  and file_size_bytes <= 8388608
);

drop policy if exists "library_documents_update_own"
on public.library_documents;

create policy "library_documents_update_own"
on public.library_documents
for update
to authenticated
using (
  owner_id = auth.uid()
  and deleted_at is null
)
with check (
  owner_id = auth.uid()
  and file_size_bytes > 0
  and file_size_bytes <= 8388608
);

drop policy if exists "library_documents_delete_own"
on public.library_documents;

create policy "library_documents_delete_own"
on public.library_documents
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "library_storage_insert_own_folder"
on storage.objects;

create policy "library_storage_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "library_storage_select_visible_documents"
on storage.objects;

create policy "library_storage_select_visible_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'library-documents'
  and exists (
    select 1
    from public.library_documents document
    where document.storage_path = storage.objects.name
      and document.deleted_at is null
      and (
        document.owner_id = auth.uid()
        or (document.is_published = true and document.visibility = 'public')
        or (
          document.is_published = true
          and document.visibility = 'connections'
          and public.are_accepted_connections(document.owner_id, auth.uid())
        )
      )
  )
);

drop policy if exists "library_storage_update_own_folder"
on storage.objects;

create policy "library_storage_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "library_storage_delete_own_folder"
on storage.objects;

create policy "library_storage_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
