-- FieldsConnect Library Documents Baseline
-- Scope: document metadata, controlled visibility, and Supabase Storage policies.
-- Storage bucket: library-documents

create table if not exists public.library_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 8388608),
  mime_type text not null,
  storage_bucket text not null default 'library-documents',
  storage_path text not null unique,
  visibility text not null default 'connections' check (visibility in ('public', 'connections')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger library_documents_set_updated_at
before update on public.library_documents
for each row execute function public.set_updated_at();

create index if not exists library_documents_owner_id_idx
on public.library_documents(owner_id);

create index if not exists library_documents_visibility_idx
on public.library_documents(visibility, is_published)
where deleted_at is null;

create index if not exists library_documents_storage_path_idx
on public.library_documents(storage_path);

alter table public.library_documents enable row level security;

create policy "library_documents_select_visible"
on public.library_documents
for select
to authenticated
using (
  deleted_at is null
  and (
    owner_id = auth.uid()
    or (
      is_published = true
      and visibility = 'public'
    )
    or (
      is_published = true
      and visibility = 'connections'
      and public.are_accepted_connections(owner_id, auth.uid())
    )
  )
);

create policy "library_documents_insert_own"
on public.library_documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and file_size_bytes <= 8388608
);

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
  and file_size_bytes <= 8388608
);

create policy "library_documents_delete_own"
on public.library_documents
for delete
to authenticated
using (
  owner_id = auth.uid()
);

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

create policy "library_storage_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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
        or (
          document.is_published = true
          and document.visibility = 'public'
        )
        or (
          document.is_published = true
          and document.visibility = 'connections'
          and public.are_accepted_connections(document.owner_id, auth.uid())
        )
      )
  )
);

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

create policy "library_storage_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'library-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
