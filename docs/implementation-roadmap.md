# FieldsConnect MVP Implementation Roadmap

## Build Principle

Build the MVP ticket-by-ticket against approved documentation. Do not implement feature logic before the documentation baseline, environment separation, database foundation, auth, and RLS baseline are in place.

The Library feature must be implemented against `docs/library-feature-spec.md`, including the Library-specific legal acceptance gate, uploader rights declaration, private storage controls, moderation, takedown, versioning, and audit requirements.

## Phase 0: Controlled Documentation Baseline

### Goals

- Commit controlled MVP documents.
- Confirm approved amendments, including the Library feature specification.
- Create GitHub issue tickets.
- Lock MVP scope before coding.

### Exit Criteria

- Documentation committed.
- GitHub issues created.
- MVP and Library scope approved.

## Phase 1: Project Foundation

### Goals

- Initialize Next.js project shell.
- Connect Supabase.
- Configure Vercel.
- Add basic layout and health page.
- Configure environment separation.

### Exit Criteria

- App deploys to Vercel.
- Development and preview/staging environments are defined.
- Supabase environment variables are validated.

## Phase 2: Database, Auth, and RLS

### Goals

- Create initial Supabase schema migrations.
- Include the Library schema, acceptance records, document versions, reports, moderation actions, and audit records.
- Implement Supabase Auth.
- Add onboarding acceptance gate.
- Implement RLS baseline.
- Add RLS/security tests.

### Exit Criteria

- Users can sign up, verify, login, logout, and reset password.
- Users cannot access or mutate unauthorized rows.
- Users must accept required platform policies before using protected features.
- Library tables and private storage authorization are covered by the RLS/security baseline.

## Phase 3: Profiles and Discovery

### Goals

- Build onboarding.
- Build profile editing.
- Add avatar uploads.
- Build discovery search.

### Exit Criteria

- Users can complete onboarding.
- Users can edit profiles.
- Users can upload valid avatars.
- Users can discover visible active users.

## Phase 4: Social Feed

### Goals

- Build feed.
- Build post composer.
- Add comments.
- Add reactions.

### Exit Criteria

- Users can create/edit/soft-delete their own posts.
- Users can comment and react.
- Feed is paginated.
- Unsafe content is sanitized.

## Phase 5: Connections and Messaging

### Goals

- Implement connection request lifecycle.
- Implement accepted-connection-only 1:1 messaging.
- Enforce blocked-user restrictions.

### Exit Criteria

- Users can send, cancel, accept, and decline connection requests.
- Duplicate requests are prevented.
- Only accepted connections can message.
- Blocked users cannot interact.

## Phase 6: Controlled Library

### Goals

- Implement Library-specific terms versioning and acceptance.
- Create private Library storage and secure upload policies.
- Implement the 8 MB server-side file limit and explicit file-type allow-list.
- Build upload metadata and uploader ownership/permission declaration.
- Build Library catalogue, search, document details, and short-lived signed access.
- Build own-document management and controlled version replacement.
- Implement Library reporting, quarantine, takedown, restoration, moderation, and audit records.

### Exit Criteria

- Users cannot upload or download without accepting the current Library terms.
- Every upload has a recorded lawful-sharing declaration and required metadata.
- Invalid, unsupported, disguised, or oversized files are rejected server-side.
- Library files are stored privately and are not exposed through permanent public URLs.
- Users cannot access or alter another user's protected Library records.
- Removed, quarantined, restricted, or deleted documents cannot be newly accessed.
- Moderation and sensitive administrative actions are recorded in immutable audit records.
- Library upload, access, reporting, moderation, versioning, and mobile UAT pass.

## Phase 7: Trust, Safety, and Admin

### Goals

- Implement reporting.
- Implement blocking.
- Build admin moderation dashboard.
- Integrate the Library moderation queue with the protected admin experience.
- Implement protected role management.
- Write moderation actions and audit logs.

### Exit Criteria

- Reports appear in admin queues.
- Moderators/admins can action reports, including Library reports.
- Role changes are protected and audited.
- Moderation and audit records are created correctly.

## Phase 8: Hardening and Demo Readiness

### Goals

- Add validation and sanitization layer.
- Add rate limits.
- Complete backup/export/recovery runbook, including Library database and storage objects.
- Finalise retention, incident response, malware/quarantine compensating controls, and takedown procedures.
- Add seed data.
- Perform mobile QA and UAT.

### Exit Criteria

- Demo flow passes end-to-end.
- RLS/security tests pass.
- Mobile checks pass.
- Demo users and safe Library sample documents are seeded.
- Backup/export/recovery process is documented and tested.
- Library compliance and security controls pass the pre-pilot review.
