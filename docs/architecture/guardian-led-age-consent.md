# FieldsConnect | Guardian-led admission and age assurance
**Status:** Design approved for QA implementation planning only; NOT a live consent capability or a legal certification.  
**Date:** 25 October 2026  
**Owner:** Quality, Security & Continuous Improvement, with Product and Information Officer approval.

## Why this feature exists
FieldsConnect supports legitimate educational and professional networking. A learner's self-entered age, their own signup tick, or an adult's name and date of birth do not establish the adult's legal authority to consent. South African POPIA sections 34–35 restrict processing children's personal information, subject to specified authorisations including the *prior* consent of a legally competent person. Consent must be informed and provable; written notices alone are not technical safeguards.

**Primary legal reference:** Information Regulator, *Guidance Note on Processing Personal Information of Children* (28 June 2021), https://www.inforegulator.org.za/wp-content/uploads/2020/07/GuidanceNote-Processing-PersonalInformation-Children-20210628-1.pdf .

## Non-negotiable outcomes
1. Adults keep exactly two registration stages: a single FieldsConnect signup form, then email confirmation. Date of birth or an age/eligibility check may be embedded in that first form, without a post-verification wizard.
2. A protected younger member cannot be discoverable, message, connect, upload, accept mentorship or access other authenticated services before lawful adult authorisation.
3. Guardian approval is obtained and recorded **before** creating or activating a child's networking account, except for narrowly necessary, lawful pre-consent handling that the Information Officer has approved. Prefer adult/guardian initiation over capturing the child's account data in advance.
4. User-editable Supabase `user_metadata` is never used as proof of guardian authorisation, an age-based access entitlement, or for any RLS decision.
5. Prior authorisation is specific to disclosed processing; a general Terms checkbox alone is insufficient. Guardians can withdraw and request applicable access/deletion rights.
6. Policies, database permissions, server-side checks, onboarding and actual communications agree. Do not enable admission simply because the interface displays a verification success state.

## User flow
**A. Adult (18+)**
- Signup collects Name, Email, category, Field of interest, date of birth/eligible age check, Password, Confirmation and one consolidated agreement checkbox. No additional profile step.
- The adult verifies their email and enters FieldsConnect.
- DOB should not be public. The Information Officer must approve whether full DOB is needed in long-term storage, or whether a server-side over-18 result is sufficient.

**B. Protected learner (under 18)**
- Signup distinguishes adult registration from guardian-assisted enrolment *before* capturing or publishing the learner's full account information.
- Guardian starts a separate secure request, is given a plain-language notice covering the learner's profile, search/discovery, direct messaging, mentors, file sharing, data processors and reporting.
- Guardian provides full name, DOB for age assessment where necessary, verified email, relationship/legal authority and a signed affirmative authorisation to specific processing. Collect the least sensitive proof appropriate to the level of risk.
- Guardian must control their own communication channel: send an expiring, single-use link or approved equivalent identity-verification challenge, with rate limiting and abuse protection. Access to the email alone validates an address, **not** custody or guardianship.
- For higher-risk activity, use proportionate review or a suitable verified identity/guardianship provider. Never equate entered DOB and a checkbox with independent identity verification.
- Record the specific policy/notice version, permissible purposes/features, approval type, evidence category, date/time, verification method, reviewer where applicable, withdrawal status and relevant audit references. Record no more DOB or ID information than needed.
- Once permission is approved and the learner's own email is verified, activate a child-restricted account. Store authorization in protected server-controlled data, never in mutable user metadata.
- If approval is rejected, expires or is withdrawn: stop processing beyond what must lawfully be retained, restrict the account immediately and provide an intelligible notice and review path.
- Turning 18 requires an appropriate graduation process that evaluates continued permissions and removes unnecessary guardian controls. Do not expose historical guardian data to the adult user.

## Suggested admission states
`guardian_started` → `guardian_contact_verified` → `guardian_authority_review` → `approved` → `learner_invited` → `learner_active`.
Alternate states: `declined`, `expired`, `revoked`, `suspended`.
Each transition must be authorised, recorded, idempotent and guarded against replay/expired links. `guardian_contact_verified` is **not** approval.

## Technical architecture (Supabase)
- Use a dedicated restricted schema and backend-only service functions for guardian requests and consent history. Deny direct client INSERT/UPDATE/DELETE to consent evidence; RLS and privileges are reviewed together.
- Use secure random token generation, store only a digest, bind tokens to an invite, set expiry, one-time use and retry limits. Never include child information or secrets in public URLs/logs.
- The server validates adult age and legal-authority evidence under the approved model. Only server-controlled consent status grants access.
- Place enforcement at **database RLS and privileged RPC/Edge Function boundaries** for profiles, search, posts, messages, library, connections and mentorship. A React route guard alone can be bypassed.
- Ensure no active signed-in session can continue protected actions after consent withdrawal; handle JWT lifetime and backend permission checks.
- Restrict child accounts' public discoverability and direct messaging by default. Explicitly approve appropriate, supervised mentorship options. Avoid publishing birthday, location, school schedule or guardian details.
- Define retention for rejected/expired requests, guardian identification evidence and proof of approval; lock down support and moderator access.
- Do not mutate existing accounts based on guessed ages. Historical members require a carefully designed consent/eligibility migration and outreach.

## Verification and release gates
- Risk assessment and legal sign-off on prior consent, lawful limited invitation processing and 16–17-year-old pilot scope; confirm whether any alternative section 35 authorisation is relied on.
- Document which data categories and functions each guardian authorises; publish accessible policy text before collecting new data.
- Deliver secure guardian emails through an approved provider with rate limits and bounce/abuse handling.
- Implement child state and RLS policy tests: no access pending/expired/revoked; approved invite only; guardian cannot approve unrelated child; duplicate submissions cannot bypass verification.
- Test spoofed DOB, reused links, changed email addresses, guardian/child same-email use, falsified relationship, browser/devices mismatch, blocked/expired consent, compromised account and withdrawal.
- Obtain an independent South African privacy/child-safety review before enabling under-18 public registration.

**Do not silently enable or represent this feature as complete while email verification, guardianship verification, secure records and backend enforcement are missing.**
