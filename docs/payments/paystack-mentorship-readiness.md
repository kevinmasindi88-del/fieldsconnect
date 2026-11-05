# FieldsConnect — Paystack paid-mentorship implementation gates (internal)

**Status:** design and validation only. Paid checkout must remain disabled until Paystack merchant approval, policy/legal review, end-to-end sandbox tests and explicit production release.

## Financial model already approved internally

- Mentor sets the mentorship price (including free programmes); a paid mentorship has a single clear ZAR price and disclosed scope before checkout.
- For a paid transaction: **15% gross platform allocation to FieldsConnect, 85% gross mentor allocation**, before the payment processor charges.
- **FieldsConnect bears Paystack processing charges**, using the Paystack-supported main-account fee-bearer configuration. Therefore net funds received by FieldsConnect may be less than 15% of the gross amount. Do not misrepresent 15% as net profit.
- Prefer **one verified mentor Paystack subaccount** and a percentage split with the correct interpretation of Paystack's subaccount/main-account share. Validate a real R100 test transaction before enabling this configuration broadly; never assume the subaccount's configured percentage refers to the same party across all Paystack endpoints.
- Do not use the `transaction_charge` flat-fee override in place of a true percentage split unless explicitly designing a flat model.
- Avoid escrow, internal wallet, or off-processor automated distributions at initial launch.

## Preconditions and operational controls

1. Paystack business account activated for live transactions in South Africa; production credentials stored **server-side only**, never as NEXT_PUBLIC or in repository files.
2. Confirm business availability of Paystack split payments / subaccounts for FieldsConnect's actual account, supported ZAR channels and fee bearer.
3. Mentor bank/subaccount onboarding and verification completed before charging; reject missing or unverified account data.
4. Authoritative order record records mentee, mentor, mentorship cycle, agreed gross price, processor reference, proposed split, currency, consented terms version, and immutable audit timestamps.
5. Initialize transaction server-side. Validate payment via signature-verified webhook **and** server-side transaction verification and reconcile amount, currency and unique reference; never trust browser redirect alone.
6. Activation must be **idempotent**: one paid reference cannot activate a mentorship twice or be attributed to another mentorship.
7. Record processor charge, actual allocations, settlement IDs and payout events separately; reconcile against Paystack transactions and payouts.
8. Prevent user roles for moderation from directly issuing refunds. Moderator records responsibility recommendation and evidence; authorised finance operator makes a separately logged refund decision/execution.

## Refund flow: approved outcome does not equal processed refund

1. Mentee requests cancellation/refund (support or in-product case) and provides payment reference, reason, available evidence. Apply consumer rights and original mentorship-specific terms.
2. Moderation examines evidence and may determine mentor/mentee/both/neither responsibility; this finding **cannot** call the Paystack Refund API by itself.
3. Finance reviews original Paystack transaction, previous refunds, legal eligibility, amount in smallest currency unit, and available refund funding. Require privileged approval and distinct audit entries.
4. Paystack supports full or partial refunds; initiate only once with transaction reference and the approved amount; use idempotent application controls to prevent duplicates and cumulative over-refunds.
5. Observe refund status **Pending / Processing / Processed / Failed** and use verified event notifications plus periodic reconciliation. Do not tell the user the funds were returned until processed.
6. Paystack refunds are funded from pending payout or eligible Registered Business balance; insufficient funds can block the refund. Paystack transaction charges are not returned. Establish a merchant refund reserve and recovery procedure before live launch.
7. **Retained FC policy — mentor-funded refund administration contribution:** When a full refund is approved after moderation finds the mentor responsible, FC retains its original 15% platform allocation and seeks recovery from the mentor of **the original 85% mentor allocation plus an additional contribution equal to at least 15% of the mentee's original payment**, so the mentee receives a 100% refund. The additional 15% is **not extra FC revenue**: it covers the amount needed to fund the mentee's refund while FC retains its platform allocation. A full customer refund must not be conditional on an unverified automated recovery mechanism. This financial rule is subject to a signed and legally reviewed mentor agreement, enforceable collection process, authorised finance approval, and actual Paystack funding/settlement capabilities. Paystack does **not** guarantee that settled mentor proceeds can be clawed back. Do not auto-debit a mentor's account or promise automatic recovery. For partial refunds, mixed responsibility, mentee responsibility, or other outcomes, calculate and approve charges case-by-case under published customer rights and agreed mentor terms; do not apply the full-refund contribution mechanically.
8. Paystack has a 1-year technical refund eligibility window for new refund requests starting 15 October 2026, but this does not replace statutory obligations. Escalate cases that cannot be processed via Paystack to authorised finance/legal review of lawful alternatives.

## Pre-launch test matrix

- Gross ZAR 100.00 payment: expected gross split ZAR 15.00 FC, ZAR 85.00 mentor, **Paystack processing fee from FC share**, compare actual statements.
- Invalid subaccount, bank validation failure, fee borne by wrong party and amount mismatch: **payment/activation blocked**.
- Success redirect without verified webhook, duplicate webhook, delayed webhook, expired session, stolen/mismatched reference: **no unverified or duplicate cycle activation**.
- Full refund before settlement, full refund after settlement, partial refund, repeat refund, funds insufficient, refund failed, and reconciliation of statuses.
- Refusal/appeal and moderator/finance separation; audit trails for every decision.
- Do not activate the administration contribution as an automatic charge before mentor notice/contract acceptance, legality review, collection design, and Paystack reconciliation tests.
- No paid buttons/routes/API execution in production before merchant approval, documented terms sign-off, and user-authorised go-live.

## Paystack references (reviewed 5 November 2026)

- https://paystack.com/docs/payments/split-payments/
- https://paystack.com/docs/payments/multi-split-payments/
- https://paystack.com/docs/payments/refunds/
- https://support.paystack.com/en/articles/2127106
- https://support.paystack.com/en/articles/2130434
