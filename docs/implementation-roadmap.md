# FieldsConnect MVP Implementation Roadmap

## Build Principle

Build the MVP ticket-by-ticket against approved documentation. Do not implement feature logic before the documentation baseline, environment separation, database foundation, auth, and RLS baseline are in place.

## Phase 0: Controlled Documentation Baseline

### Goals

- Commit controlled MVP documents.
- Confirm approved amendments.
- Create GitHub issue tickets.
- Lock MVP scope before coding.

### Exit Criteria

- Documentation committed.
- GitHub issues created.
- MVP scope approved.

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
- Implement Supabase Auth.
- Add onboarding acceptance gate.
- Implement RLS baseline.
- Add RLS/security tests.

### Exit Criteria

- Users can sign up, verify, login, logout, and reset password.
- Users cannot access or mutate unauthorized rows.
- Users must accept required policies before using protected features.

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

## Phase 6: Trust, Safety, and Admin

### Goals

- Implement reporting.
- Implement blocking.
- Build admin moderation dashboard.
- Implement protected role management.
- Write moderation actions and audit logs.

### Exit Criteria

- Reports appear in admin queue.
- Moderators/admins can action reports.
- Role changes are protected and audited.
- Moderation and audit records are created correctly.

## Phase 7: Hardening and Demo Readiness

### Goals

- Add validation and sanitization layer.
- Add rate limits.
- Complete backup/export/recovery runbook.
- Add seed data.
- Perform mobile QA and UAT.

### Exit Criteria

- Demo flow passes end-to-end.
- RLS/security tests pass.
- Mobile checks pass.
- Demo users are seeded.
- Backup/export/recovery process is documented and tested.
