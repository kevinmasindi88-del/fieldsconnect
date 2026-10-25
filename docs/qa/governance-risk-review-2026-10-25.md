# FieldsConnect governance review | 25 October 2026

## Coverage
Reviewed the public Terms, Privacy Policy, Community Guidelines; older repository Code of Conduct; current Library Terms v1.0 and its acceptance workflow; mentorship payment/readiness documents; moderation procedure; and registration agreement.

## Implemented improvements
- The public Community Guidelines at /code-of-conduct are the canonical member-facing Code of Conduct. The old MVP-labeled internal file now links to them.
- A separate internal moderation operating standard addresses evidence, impartiality, notices, escalation, appeals and role separation.
- A financial transaction governance standard clarifies transaction transparency, 15/85 allocation, disputes, authorisation, reconciliation and provider controls, without enabling payments.
- A Library Terms acceptance-check RPC was unnecessarily callable with another account ID. It now checks only the signed-in member.

## Open decisions before production release
1. **Younger members:** the signup checkbox cannot act as legally required parental or guardian consent. Implement lawful permission and protective settings appropriate to the intended age group; obtain specialist review.
2. **Business details:** publish the accurate registered business identity and reachable privacy/legal contact as required. FieldsConnect is already registered; no invented details or internal verification notes in public pages.
3. **Live paid mentorship:** keep checkout disabled until provider approval and transaction-specific disclosures, refunds, payouts and independent approvals are tested and approved.
4. **Library Terms:** v1.0 correctly covers basic upload and privacy responsibilities. Consider prospective v1.1 alignment for lawful copyright exceptions; never silently overwrite accepted version 1.0.
5. **Operations:** verify accessible privacy enquiries, moderation notifications and appeals, retention periods, provider data flows and incident response against actual processes.
6. **Agreement versioning:** substantive changes require an appropriate new version, notice and acceptance record.

## Editorial rule
Publish user rights and member duties in clear, calm language. Store moderator procedure, legal verification, unreleased features and release controls in internal documents. No legal policy alone proves that controls are technically or operationally implemented.

## Sources for internal legal review
- POPIA: https://www.justice.gov.za/legislation/acts/2013-004.pdf
- ECTA: https://lawlibrary.org.za/akn/za/act/2002/25/eng%402021-12-01
- CPA: https://lawlibrary.org.za/akn/za/act/2008/68/eng%402015-03-13

## Age-declaration frontend update (25 October 2026)
- Adult members self-confirm being 18+ with a dedicated checkbox. No routine DOB or government ID collection for adults. The legal/COC agreement remains one separate checkbox.
- Unchecked declaration blocks the ordinary signup action and offers a guardian-assisted information route. No guardian PII is collected while secure consent approval is unavailable.
- Account authorisation remains a server-side concern. Until guardian consent and backend enforcement ship, this is a UI routing and self-attestation change, **not verified age assurance**.
