# Guardian consent: executable acceptance tests and rollout checklist

**Release state:** Blocked until each high-priority item below is implemented and evidenced.

## Functional paths
- [x] QA frontend displays a separate adult self-declaration checkbox alongside the consolidated policy agreement.
- [x] If adult checkbox is unchecked, ordinary signup is blocked and the guardian-assisted route is offered without collecting guardian details.
- [ ] Adult (18+) completes existing name-first single signup form, adult self-declaration checkbox, one policy checkbox, email verification and direct timeline access; no routine adult DOB or ID collection.
- [x] Guardian information route is accessible without authentication; it accurately states secure approval is not yet available.
- [ ] Guardian approval system is implemented and account admission is restricted at server/database level, not merely the signup UI.
- [ ] Guardian enters full name, requested DOB/age evidence, relationship, independently reachable email and positive, specific consent.
- [ ] Guardian email verified by one-time expiring link; this alone does not promote status to legal guardian authority verified.
- [ ] Adult age and relationship authority checked under a documented proportionate risk model.
- [ ] Approved evidence recorded server-side with notice version and time; learner email verified separately.
- [ ] Child defaults to restricted visibility/contact/mentorship settings.
- [ ] Withdrawal revokes access promptly at RLS/backend boundary.
- [ ] Unapproved, rejected, expired or guardian-less requests never create fully active profiles.
- [ ] After the learner turns 18, guardian restrictions and retained details follow the approved transition and retention model.

## Security and privacy tests
- [ ] Impossible to forge guardian approval by changing `user_metadata`, `localStorage`, form values or REST requests.
- [ ] One account cannot approve or discover another guardian's request without required authorisation.
- [ ] Pending/revoked minors cannot query private member data, create posts, send DMs, connect, upload, search mentors or transact through APIs.
- [ ] One-time link cannot be reused, forwarded outside its binding, or guessed; expiry and abuse throttling tested.
- [ ] No DOB, child/guardian identifiers or token values leaked into URL query strings, event telemetry or public listings.
- [ ] Child and guardian consent records have separate retention/deletion and breach procedures.

## Required business sign-offs
- [ ] Information Officer and a South African privacy practitioner approve processing purposes and guardian verification strength.
- [ ] Public-facing privacy notice amended in advance, with change control/versioning where substantive.
- [ ] Operational case review and support/refusal procedures approved.
- [ ] Secure email and (if needed) identity-verification provider configured; costs and contracts reviewed.
- [ ] Two adult accounts, two minor/guardian families and adversarial test cases pass without production impact.
- [ ] Release go/no-go documented; deployment controls remain disabled until approval.
