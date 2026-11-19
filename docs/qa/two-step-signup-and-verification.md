# FieldsConnect two-step signup and email verification (networking-first)

## Agreed signup flow
There are **two stages**, not three.

1. Signup is one form: Name, Email, Career or educational category (Student / Learner, Professional, Institution), Field of interest, Password, Confirm password, and one Terms & Conditions / FC Code of Conduct checkbox. Read more expands links to full Terms, Privacy Policy and Community Guidelines.
2. Email verification, followed by direct access to the timeline once the user's email is confirmed and a session is established. If the confirmation link does not establish a session, the user signs in normally.

Do not add a mandatory setup screen after verification. FieldsConnect is a legitimate networking platform: name, self-declared category and field are essential to helping members connect. Profile photo, username, bio, detailed skills, mentorship preferences and visibility controls may be configured later.

## Implementation details
- The signup form requires the three networking inputs, preserves existing email/password fields and sends the fields as self-declared Supabase signup metadata.
- On verified first login, use that metadata to create a private profile with the actual name, category and field. Never invent a category or use self-edited metadata for elevated privileges, legal age status or guardian consent.
- On repeated logins existing profile, mentor settings, avatar, payment data, category and field remain unchanged.
- The versioned agreement is recorded through the server's existing signup audit trigger. Three legacy policy timestamps are synchronised after confirmed login.
- Pre-existing older users who never completed the consolidated agreement have a policy-only fallback, not another profile-setup step.
- The optional role database migration remains for legacy records; it doesn't mean new signups may omit their category.
- No live payment settings or paid mentorship functionality is changed.

## QA before release
- Signup validation: empty/spaces-only name; empty career category; empty/spaces-only field; password mismatch; agreement unchecked; malformed email; overly long text.
- Preview form displays correct signup inputs in one page and does not alter login or reset-password form.
- Submission passes trimmed profile fields and agreement version to signUp; verification email received; after verification profile created correctly with private visibility, role and field, then /timeline.
- Logging back in retains the same profile; profile-editor edits are preserved.
- Check small mobile widths 320/360/390/414, desktop, keyboard focus, expandable Read more and links.
- Test with two independent accounts to verify RLS and data isolation.
- A general user agreement is **not** proof of parental/guardian consent under POPIA. Child-access safeguards still require review before expanded rollout.
