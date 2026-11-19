-- Fix library document inserts being rejected by RLS.
-- File-size validation remains enforced by the table constraint and client-side checks.

grant insert on public.library_documents to authenticated;

alter table public.library_documents enable row level security;

drop policy if exists "library_documents_insert_own"
on public.library_documents;

create policy "library_documents_insert_own"
on public.library_documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

notify pgrst, 'reload schema';
