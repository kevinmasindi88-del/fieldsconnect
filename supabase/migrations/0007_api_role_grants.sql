-- FieldsConnect API role grants
-- Runtime validation fix: allow Supabase Data API roles to access public schema objects.
-- RLS policies remain the primary access-control layer.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
on all tables in schema public
to authenticated;

grant usage, select
on all sequences in schema public
to authenticated;

alter default privileges in schema public
grant select, insert, update, delete
on tables to authenticated;

alter default privileges in schema public
grant usage, select
on sequences to authenticated;
