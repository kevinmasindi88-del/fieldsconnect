-- Temporary non-destructive freeze: 22 November 2026.
-- Existing paid requests, orders and provider records are retained for audit.
-- Free mentorship requests and their normal lifecycle remain available.
CREATE OR REPLACE FUNCTION public.pause_new_paid_mentorship_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'mentorship_payment_orders' THEN
    RAISE EXCEPTION 'Paid mentorship payments are temporarily unavailable';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_payment_mode = 'paid' THEN
      RAISE EXCEPTION 'Paid mentorship is temporarily unavailable';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'awaiting_payment'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND (
         CASE WHEN OLD.status = 'change_proposed'
           THEN COALESCE(NEW.proposed_payment_mode, NEW.requested_payment_mode)
           ELSE NEW.requested_payment_mode
         END
       ) = 'paid' THEN
      RAISE EXCEPTION 'Paid mentorship cannot be accepted while payments are paused';
    END IF;
    IF NEW.status = 'change_proposed'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.proposed_payment_mode = 'paid' THEN
      RAISE EXCEPTION 'Paid mentorship counterproposals are temporarily unavailable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER a_pause_paid_mentorship_request_writes
BEFORE INSERT OR UPDATE ON public.mentorship_requests
FOR EACH ROW EXECUTE FUNCTION public.pause_new_paid_mentorship_activity();

CREATE TRIGGER a_pause_new_mentorship_payment_orders
BEFORE INSERT ON public.mentorship_payment_orders
FOR EACH ROW EXECUTE FUNCTION public.pause_new_paid_mentorship_activity();
