# Profile mobile layout and payment launch gate (23 Oct 2026)

## Decision and scope

- FieldsConnect is still in Paystack test/demo mode. Completing the code foundation does not authorize live/public paid mentorship.
- FC business bank account verification, production Paystack approval/settlement, payment terms, moderation-linked refunds/chargebacks, and controlled live QA are independent launch prerequisites.
- Both public client flag `NEXT_PUBLIC_FC_PAID_MENTORSHIPS_ENABLED` and server secret `FC_PAID_MENTORSHIPS_ENABLED` **default to disabled**. Enabling either alone is insufficient for a complete launch.
- Live Edge Functions `initialize-mentorship-payment` and `mentor-payment-settings` were updated to return `503 payment_launch_deferred` when the server flag is not explicitly `true`.
- Previously recorded test prices, mentor payout provider references, and historical orders are **preserved**, not reset and not silently converted into free programmes.
- Existing paid offers are hidden from new public mentorship request choices while public payments are disabled; existing free offers still function.
- Free mentorship uses its existing path. New paid checkout actions and acceptance of legacy paid requests are unavailable while disabled.

## Mobile regression cases

Inspect `/profile` at CSS viewports **320, 360, 390, 414, 640, and 768 px**:

- No horizontal page scrolling or clipped FieldsConnect logo/navigation.
- All mentor sections and borders fit within their parent cards without vertical lines showing behind other inputs.
- Long explanatory text wraps without forcing cards wider.
- Payout fields and programme price selectors are absent until both financial readiness and the public feature gate are explicitly approved.
- Saving an existing mentor profile with prior paid offers does not reset their amounts or silently make them free.
- Saving a new free mentor and requesting a free mentorship continue to work.

Check `/profile/[profileId]` with a free-offer mentor, a paid-only mentor, and a mentor without offer rows. Paid-only should show an appropriate explanatory message, not an empty selectable period.

Check `/connections` for old `awaiting_payment` orders: history stays visible but no payment button or new Paystack redirect appears. Accepting an old paid mentorship request must not create a new pending payment.

## Safe activation steps (not authorized by this change)

1. Verify FC business bank and Paystack **live** KYC, settlement, and key/webhook configuration.
2. Approve financial transactions policy, payment agreement/terms with versioned acceptance, commission settlement, refund/dispute/chargeback responsibilities, and role separation.
3. Test the full paid flow in an isolated, controlled release with a real settlement account, including failed and disputed payments.
4. Explicitly enable the server secret and public client flag only after written go-live approval; deploy both Edge Functions and the frontend from the reviewed branch.
5. Repeat mobile and payment regression testing, confirm test references are not live.
