# Full FieldsConnect policy suite — 24 October 2026

## Source pages

- `/terms-of-use`: complete long-form Terms with scope, acceptance, minors, accounts, profiles, mentor/mentee arrangements, published ratings, user content and licences, library, moderation, third parties, 15:85 paid allocation, cancellation and non-waivable statutory rights, liability and dispute resolution.
- `/privacy-policy`: full data categories, collection, purposes and POPIA lawful bases, mandatory/voluntary data, children, profile visibility, direct messages, reviews, Paystack, providers, international transfer, data rights, retention, breach notification, security and marketing.
- `/code-of-conduct`: Community Guidelines matching the linked signup copy, including child-safety protections, honest profiles, mentoring boundaries, financial fraud, content, reports, evidence, moderation, suspensions and appeals.

## Release validation

- The exact single-checkbox language in `LegalAgreementCheckbox.tsx` is unchanged.
- Routes remain publicly available from unauthenticated signup.
- No empty section, fake registration number, invented street address or unverified privacy email.
- Make sure headings, table of contents anchors and mobile wrapping behave at 320/360/390/414px.
- Confirm signup date/version `2026-10-24-v1` matches displayed policy versions.
- Confirm that privacy and Terms mention age/guardian consent where required, but do not falsely claim the service already has automated guardian verification.
- Verify that terms do not waive statutory cooling-off or refunds, paid mentorship does not claim to be live, and star-review publication rules match code.
- Cross-check this suite against any existing library-specific terms and future payment checkout disclosure.

## Internal verification tasks — not public policy wording

- Verify the actual CIPC legal name, enterprise registration number, registered/principal business address, telephone or other required ECTA business details, and a publicly reachable legal/privacy email or postal contact. Those exact particulars were not available and are NOT invented.
- Obtain a South African legal review of child information, guardian consent, school learner interactions, POPIA, PAIA, CPA and ECTA before offering services to minors or live paid mentorship.
- Confirm information-officer registration, operator agreements, international-transfer safeguards, retention schedules and actual third-party vendors. The full policy wording cannot replace implementing those requirements.
- Do not promote to Production on policy completeness alone. Test all links and new-user acceptance end to end, and verify policy disclosures prior to publication.

## Public-facing policy editorial rule
- Internal compliance to-dos, unresolved administrative verification statements and wording about whether policies may be 'released to Production' belong in this internal checklist, not on public Terms or Privacy pages.
- The business is already CIPC-registered; never imply otherwise. Exact published contact and registration details must come from confirmed records, not invented placeholders.
