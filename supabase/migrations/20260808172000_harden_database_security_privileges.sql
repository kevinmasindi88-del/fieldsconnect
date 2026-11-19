-- FieldsConnect production security hardening.
--
-- Goals:
-- 1. Remove anonymous execution of exposed SECURITY DEFINER functions.
-- 2. Preserve authenticated access only for RPCs/helpers required by signed-in users.
-- 3. Prevent direct client access to internal zero-policy tables.
-- 4. Fix the mutable search_path warning on set_updated_at().
--
-- This migration does not modify existing RLS policies or application logic.

-- ---------------------------------------------------------------------------
-- Fix mutable function search_path
-- ---------------------------------------------------------------------------

alter function public.set_updated_at()
  set search_path = pg_catalog, public;


-- ---------------------------------------------------------------------------
-- Client-facing / authenticated helpers
--
-- Remove inherited PUBLIC execution, then explicitly permit authenticated
-- users. Function bodies continue to perform their existing authorization
-- checks.
-- ---------------------------------------------------------------------------

revoke execute on function public.approve_and_activate_role_nomination(uuid)
  from public, anon;

grant execute on function public.approve_and_activate_role_nomination(uuid)
  to authenticated;


revoke execute on function public.are_accepted_connections(uuid, uuid)
  from public, anon;

grant execute on function public.are_accepted_connections(uuid, uuid)
  to authenticated;


revoke execute on function public.current_platform_role()
  from public, anon;

grant execute on function public.current_platform_role()
  to authenticated;


revoke execute on function public.has_platform_role(text[])
  from public, anon;

grant execute on function public.has_platform_role(text[])
  to authenticated;


revoke execute on function public.nominate_platform_role(
  uuid,
  text,
  text,
  text,
  text,
  text
)
  from public, anon;

grant execute on function public.nominate_platform_role(
  uuid,
  text,
  text,
  text,
  text,
  text
)
  to authenticated;


revoke execute on function public.respond_to_role_nomination(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
)
  from public, anon;

grant execute on function public.respond_to_role_nomination(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
)
  to authenticated;


-- ---------------------------------------------------------------------------
-- Internal trigger / event-trigger functions
--
-- These functions are invoked by PostgreSQL infrastructure and should not
-- be callable directly through the exposed API.
-- ---------------------------------------------------------------------------

revoke execute on function public.notify_admins_of_new_report()
  from public, anon, authenticated;

revoke execute on function public.notify_comment_liked()
  from public, anon, authenticated;

revoke execute on function public.notify_reporter_of_moderation_outcome()
  from public, anon, authenticated;

revoke execute on function public.notify_senior_team_of_escalation()
  from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Internal zero-policy tables
--
-- RLS is already enabled and these tables intentionally expose no policies.
-- Remove direct client table privileges as an additional least-privilege
-- boundary. SECURITY DEFINER functions owned by postgres remain unaffected.
-- ---------------------------------------------------------------------------

revoke all privileges on table public.admin_audit_logs
  from anon, authenticated;

revoke all privileges on table public.moderation_actions
  from anon, authenticated;

revoke all privileges on table public.moderation_ticket_sequences
  from anon, authenticated;