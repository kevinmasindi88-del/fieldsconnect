-- FieldsConnect Skills RLS Extension
-- Scope: allow users to view their own skills whether published or unpublished.

create policy "skills_select_own"
on public.skills
for select
to authenticated
using (
  profile_id = auth.uid()
  and deleted_at is null
);
