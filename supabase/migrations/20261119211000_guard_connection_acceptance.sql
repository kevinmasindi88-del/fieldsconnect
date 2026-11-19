-- A requester's own API credentials must never approve a request or
-- manufacture an accepted relationship to unlock somebody's private profile.
-- Keep the existing Connect/Accept/Decline/Disconnect/retry user flows.
CREATE OR REPLACE FUNCTION public.guard_connection_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $body$
DECLARE
  actor uuid := auth.uid();
BEGIN
  -- Authenticated account operations are guarded. Privileged administrative
  -- maintenance can still run using the project's trusted database roles.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF actor IS NULL OR actor NOT IN (OLD.requester_id, OLD.recipient_id) THEN
    RAISE EXCEPTION 'Not allowed to update this connection';
  END IF;

  -- Participants never change except when a cancelled/declined relationship is
  -- restarted with requester/recipient reversed to match the new initiator.
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
    OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN
    IF NOT (
      OLD.status IN ('cancelled','declined')
      AND NEW.status = 'pending'
      AND NEW.requester_id = actor
      AND NEW.requester_id = OLD.recipient_id
      AND NEW.recipient_id = OLD.requester_id
    ) THEN
      RAISE EXCEPTION 'Connection participants cannot be changed';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status IN ('accepted','declined') THEN
      IF actor <> OLD.recipient_id THEN
        RAISE EXCEPTION 'Only the recipient may respond to a connection request';
      END IF;
    ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
      NULL; -- Either member may cancel an outstanding request.
    ELSIF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
      NULL; -- Either member may disconnect.
    ELSIF OLD.status IN ('cancelled','declined') AND NEW.status = 'pending' THEN
      IF NEW.requester_id <> actor THEN
        RAISE EXCEPTION 'Only the new requester may restart a connection';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid connection status transition';
    END IF;
  END IF;

  IF NEW.status IN ('pending','accepted')
    AND public.has_block_between(NEW.requester_id, NEW.recipient_id) THEN
    RAISE EXCEPTION 'Blocked members cannot connect';
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS guard_connection_transitions_before_update ON public.connections;
CREATE TRIGGER guard_connection_transitions_before_update
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_transitions();
