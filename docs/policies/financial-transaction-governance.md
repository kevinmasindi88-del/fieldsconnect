# FieldsConnect — Financial Conduct and Transaction Governance

**Classification:** Internal policy and release-control standard; NOT public checkout terms and NOT authorisation to accept live payments.

## 1. Scope and authority
Applies to paid mentorship programme pricing, the 15% FieldsConnect / 85% mentor commercial allocation, payment service providers, financial records, settlement, refunds, cancellations, chargebacks, financial disputes, sponsorships and future subscriptions. It complements public Terms of Use, the Community Guidelines and South African law.

The checkout is currently subject to separate feature gates and provider approval. No internal policy, fee configuration or mentor draft listing activates paid transactions.

## 2. Price transparency and consent
- The mentee must see the applicable programme duration, total charge in ZAR, cancellation conditions, applicable fees, payment method and relevant programme expectations **before** authorising a payment.
- Mentees must not be asked to pay through direct message, public posts or an unofficial external transfer represented as a FieldsConnect transaction.
- Capture an auditable snapshot of the actual offer and agreement terms connected to each order. Do not retroactively change an accepted price.
- Disclose all mandatory charges and lawful taxes without hidden additions.

## 3. Financial allocation and settlement
- The planned platform allocation is 15% FieldsConnect / 85% mentor of the eligible transaction base, subject to disclosed tax, processing-fee, and refund treatment.
- Processing-fee responsibility must be explicitly approved and consistently implemented in code, agreements, reports and accounting. Do not imply that mentors receive net 85% of an amount from which an additional fee is taken without disclosure.
- Verify the payment service provider's settlement and payout arrangement, banking details and beneficial-ownership/KYC requirements before live enablement.
- Keep a complete reconciliation trail between order, payment provider confirmation, payout, refund and ledger entries.
- A browser checkout redirect or client-side success banner does not by itself establish settled payment.

## 4. Cancellations, refunds and chargebacks
- Mandatory consumer and electronic-commerce rights override internal commercial recovery preferences.
- The proposed fee-retention model (including retaining a 15% platform commission while requiring a further contribution from a mentor) is **not approved for application solely by this policy**. It requires legal review, transparent prior disclosure, fair allocation and compatibility with the full mentee refund.
- Review refunds using service evidence, agreed milestones, conduct findings and the rules presented at checkout. Account for partial fulfilment and responsibility of both parties.
- Disclose who bears processing and chargeback fees and how contested refunds, late reversals or payouts already settled will be reconciled.
- Do not impose an undisclosed or punitive administration fee.

## 5. Governance and duties
- Moderators assess conduct, not financial transfers.
- Support staff register payment issues and securely collect only necessary evidence.
- Finance authorisers approve lawful refunds, chargebacks and payout adjustments with conflict-of-interest safeguards.
- Reconciliation staff verify provider statements against platform records, with exception reports.
- Privileged financial actions require attributable audit records; no single role should secretly create, approve and conceal a disbursement.

## 6. Provider and security rules
- No cardholder data, PIN, OTP, account passwords or full bank credentials in chat, profiles or unprotected tickets.
- Keep payment secrets server-side and restrict webhook access; verify payment-provider event integrity and duplicates.
- Investigate failed settlement and erroneous transfers before manual fixes; preserve original records.

## 7. Future services
Sponsorships and subscriptions require distinct disclosures for eligibility, obligations, frequency, renewal, cancellation, tax, disbursement conditions and refunds. Do not re-use paid mentorship wording without product-specific review.

## 8. Live release prerequisites
Confirm payment-provider production approval, contact and disclosure compliance, transaction-specific terms, refund and dispute process, legal review, end-to-end test payments, negative cases, webhooks, settlement reconciliation and authorised production enablement. Keep any unapproved feature disabled.
