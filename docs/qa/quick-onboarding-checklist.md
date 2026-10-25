# Quick onboarding QA — FieldsConnect

## Objective
New members should complete a small profile (display name, user journey, field of interest) and reach the timeline after email verification. Existing members should not lose their profile, mentor configuration or legal history.

## Happy paths
1. Signup requires the versioned agreement checkbox and sends email verification as configured.
2. After email verification/login, new member reaches /onboarding, sees ONE QUICK STEP (name, School or university / Professional / Institution, field).
3. Versioned signup acceptance is already recorded; no second checkbox appears.
4. Completing quick profile inserts required profile data, defaults profile_visibility to private, records three policy timestamps, redirects to /timeline.
5. Go to /profile later and complete avatar, username, bio, skills, visibility, mentor settings as desired.
6. Returning users with completed profile and agreement go straight to timeline.

## Legacy and edge cases
- User who registered before the signup agreement sees a single fallback agreement checkbox, linked to the three live policy pages.
- Accepting legacy agreement invokes accept_fc_legal_agreement_v1 and records an agreement audit without updating age_confirmed_at.
- Pre-existing incomplete profile is updated with name/role/field and policy timestamps, without resetting avatar, mentor availability, username, payment offers or profile visibility.
- Existing profile's fully accepted policy timestamps route straight to the timeline.
- Interrupted network or failed writes show an error and allow retry; no false completion.
- Missing session redirects to /login; no session-dependent queries attempt user-specific actions while unauthenticated.
- The 18+ confirmation is not recreated; child-specific lawful consent and protections require a separate approved release. A general checkbox is not evidence of guardian consent.

## Mobile and accessibility
- Test viewport widths 320/360/390/414/640/768px, touch target size, no horizontal clipping, focus rings, label associations, fieldset selection and form errors.
- Avoid step labels suggesting a full mentor profile is required before exploration.
- Verify no regression to /profile standalone full editor and no paid checkout flag is changed.
