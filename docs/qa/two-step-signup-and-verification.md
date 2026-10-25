# Two-step signup flow — QA criteria

## Agreed flow
1. Existing email/password/confirm-password signup form stays intact; one checkbox states “I agree to the FieldsConnect Terms & Conditions and Code of Conduct.” Read more expands links to complete Terms, FC Code of Conduct and Privacy Policy.
2. Email verification follows. After verified sign-in the user lands directly on /timeline. No mandatory display-name, educational stage, career stage or interests form.

## Implementation
- Existing versioned signup agreement is recorded on registration using the existing server trigger. The checkbox is required to submit.
- Only when a signed-in account has no profile, provision a private, minimal profile from a non-sensitive display placeholder, with role_type NULL (unselected), field NULL and no mentor availability.
- Existing profiles, avatar, username, visibility, roles, mentor payment settings and historical acceptances are never overwritten.
- First-time sign-in with valid recorded signup agreement writes the three legacy policy acceptance timestamps consistently.
- Legacy accounts without an agreement may require one policy-only acceptance (not a profile-setup stage).
- /onboarding/preview and the forced quick onboarding are removed; /onboarding is policy-only for legacy accounts.
- Profile may be completed later through /profile.

## QA before promotion
- Signed-out /signup and its Read more links; checkbox submission guard and confirmation email.
- New verified account first login automatically provisions private profile and routes to /timeline; sign out and log back in.
- Existing account login is unchanged; incomplete legacy acceptance only receives a single consent action.
- Validate 320/360/390/414/768px layouts, keyboard access, dropdown, screen reader labels.
- Check no false claim of age or guardian consent is recorded, and no live payment flags were changed.
- A terms checkbox alone is NOT guardian consent when legally required. Younger-user access remains a separate policy/security go-live decision.
