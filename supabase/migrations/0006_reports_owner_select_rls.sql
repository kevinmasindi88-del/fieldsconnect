-- FieldsConnect Moderation Reporting RLS Extension
-- Scope: allow users to view reports they submitted.

create policy "reports_select_own"
on public.reports
for select
to authenticated
using (
  reporter_id = auth.uid()
);
