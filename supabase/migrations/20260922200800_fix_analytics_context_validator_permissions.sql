-- Permit authenticated analytics inserts to evaluate the
-- privacy-safe CHECK constraint without exposing the private schema.
--
-- The private schema remains inaccessible to authenticated users.
-- RLS remains the authority for analytics event insertion.

grant execute
on function private.analytics_context_is_safe(jsonb)
to authenticated;