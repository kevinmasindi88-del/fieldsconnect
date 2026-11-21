-- The public paid mentorship checkout is paused pending provider approval.
-- Preserve the existing mentor pricing in private draft records, then hide
-- only currently active paid offers from new request creation.
-- Historical orders and accepted mentorships remain unchanged.
BEGIN;

INSERT INTO public.mentorship_payment_offer_drafts
  (mentor_id, duration, payment_mode, price_amount_minor, currency)
SELECT o.mentor_id, o.duration, o.payment_mode, o.price_amount_minor, o.currency
FROM public.mentorship_payment_offers o
WHERE o.is_active = true
  AND o.payment_mode = 'paid'
ON CONFLICT (mentor_id, duration) DO NOTHING;

-- Do not alter an offer that has an outstanding payment requiring review.
UPDATE public.mentorship_payment_offers o
SET is_active = false
WHERE o.is_active = true
  AND o.payment_mode = 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentorship_payment_orders po
    WHERE po.mentor_id = o.mentor_id
      AND po.status IN ('awaiting_payment', 'review_required')
  );

COMMIT;
