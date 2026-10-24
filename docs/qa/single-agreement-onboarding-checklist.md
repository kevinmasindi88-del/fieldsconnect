# FieldsConnect single-agreement signup: QA and release checklist

## Signup and navigation
- Exactly one checkbox with agreed wording. Links open Terms of Use, Privacy Policy, Community Guidelines.
- All three links reachable signed out and from a suspended account.
- Signup submission blocked until checked; login and password reset unchanged.
- Signup account creation stores immutable, versioned acceptance timestamp. Authentication email confirmation still works.
- After login, newly signed users don't see another checkbox; saving profile completes onboarding.
- Existing incomplete accounts get one fallback checkbox on onboarding, only after profile is saved.
- Existing accounts with accepted Terms/Privacy/Guidelines continue to timeline.
- Do not set `age_confirmed_at` based on an age-neutral agreement.
- Test mobile widths 320, 360, 390, 414, 640 and 768 px.

## Security and privacy
- RLS allows only user to read agreement record; no client INSERT/UPDATE/DELETE.
- Test signup audit trigger in controlled QA registration and record/review any errors.
- Preserve historical acceptance and age attestations for existing accounts.
- Versioned text in public Terms/Privacy are PROPOSED DRAFTS requiring legal and business approval before production.
- POPIA protection for children's information is separate from accepting platform terms.
- Do not enable public minors' onboarding before guardian-consent controls and messaging safeguards have been verified.
