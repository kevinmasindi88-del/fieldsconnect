# Single agreement / two-step signup release checklist

## Only two signup steps
1. Existing signup fields (email, password, confirm password) and ONE required checkbox: "I agree to the FieldsConnect Terms & Conditions and Code of Conduct." The Read more option expands full Terms, Community Guidelines and Privacy Policy links.
2. Email verification. When a verified Supabase session is returned, route automatically to /timeline; otherwise sign in normally and go to /timeline. There is NO required profile-setup or onboarding wizard.

## Data model
- The existing versioned signup-agreement audit is immutable to normal clients and only readable by its owner; new profile creation requires an authenticated session.
- On first verified sign-in the app creates a PRIVATE minimal profile if none exists. It does not guess the user's role or field (both remain null/unselected).
- Existing profiles, display names, avatars, roles, visibility, mentor settings, bank configuration and previous policy dates remain unchanged.
- If the signup agreement exists but legacy profile acceptance dates are incomplete, fill only missing timestamps without rewriting user data.
- Historical users who lack the consolidated agreement may see a single policy-only acceptance screen; this is not a profile creation step.
- Full profile editor remains available voluntarily at /profile. It explicitly asks for role on subsequent profile edits rather than fabricating a role.
- The abandoned /onboarding/preview route and QuickOnboarding component are deleted.

## Checks
- Signup form looks familiar, including password controls and error states.
- Checkbox required; Read more expands/collapses and links open in new tabs, without checking the box.
- Supabase confirmation email sent and verified; test actual callback session recovery and automatic timeline redirect.
- New profile is private, role_type=null, no mentor available, no payment side effects.
- Existing signed-in account does not experience a new wizard.
- Test 320, 360, 390, 414, 768 px, keyboard navigation and accessible labels.
- No 18+ declaration saved by consolidated agreement; any separate legal consent required for minors is NOT fulfilled by this checkbox.
- Do not promote without actual email-confirmation and two-account QA.
