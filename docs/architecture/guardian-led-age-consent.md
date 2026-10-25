# FieldsConnect age declaration and parent/guardian approval

## Current registration design — 25 October 2026
FieldsConnect uses the same signup form for all applicants.

- **18 or older:** select the checkbox “I confirm that I am 18 years old or older.” Continue with ordinary signup and email verification. No date of birth or identity-document collection.
- **18+ box unticked:** show three extra fields, directly on signup: **Parent/guardian name, date of birth and email or contact number**, followed by one checkbox: “I am the parent or legal guardian and approve this registration.”
- A guardian with a date of birth indicating they are under 18 cannot submit. The name, date of birth, one contact method and the approval declaration are required.
- No separate guardian information page, information-request instruction, external redirect or further wizard.
- The member still provides their own name, email, career/education category, field and password, accepts the standard policy agreement, then verifies their email.

## Private record and platform behavior
- At account creation, the database captures the parent's/guardian's declared name, date of birth, email or phone, approval and agreement version in a restricted, non-public table; guardian identifying details are removed from editable account metadata.
- The learner's ordinary profile is private by default, and guardian information is not a public profile field.
- The approval is a **self-declared parent/guardian attestation**. It does not independently verify the person entering it, their relationship, or the legal sufficiency of prior consent. Do not represent it as verified identity or automatically certified POPIA compliance.
- These fields are part of the first signup form; no extra registration step is introduced.

## Quality checks
- Adult checked -> no guardian fields; standard login and password-reset forms unchanged.
- Adult unticked -> guardian name, DOB, email-or-phone input + approval checkbox visible. Missing/malformed values and a DOB under 18 prevent submission.
- Backend retains declaration privately without direct client table permissions; neither search, directory nor profiles expose guardian data.
- Signup, confirmation email, first login and policy acceptance still work.
- Ensure the business's privacy review and access restrictions match the operational model before enabling a younger-learner rollout publicly.

## Scope
This is a practical self-declaration flow, not an identity-verification integration. Additional verification is not part of the ordinary signup experience.
