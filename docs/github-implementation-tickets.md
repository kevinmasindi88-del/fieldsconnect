# FieldsConnect GitHub Implementation Tickets

Each ticket should be created as a GitHub Issue before feature implementation. Labels and priorities should be adapted to the repo configuration.

---

## Ticket 1: Approve amended MVP documentation baseline

**Description:** Commit the controlled MVP documents and approved amendments as the baseline before application feature implementation.

**Acceptance Criteria:**

- README and docs are committed.
- MVP amendments are reflected in technical spec.
- Roadmap and ticket backlog are present.

**Dependencies:** None  
**Labels:** docs, planning, mvp  
**Priority:** P0

---

## Ticket 2: Initialize Next.js project shell

**Description:** Create the Next.js app scaffold, basic app shell, health page, and initial Vercel deployment.

**Acceptance Criteria:**

- App runs locally.
- App deploys to Vercel.
- Health page loads.

**Dependencies:** Ticket 1  
**Labels:** setup, frontend, vercel  
**Priority:** P0

---

## Ticket 3: Configure environment separation

**Description:** Configure development, preview/staging, and production environment separation.

**Acceptance Criteria:**

- Environment variables documented.
- Preview/staging and production separation documented.
- Secrets are not committed.

**Dependencies:** Ticket 2  
**Labels:** operations, security, vercel, supabase  
**Priority:** P0

---

## Ticket 4: Create initial Supabase schema migrations

**Description:** Add migrations for profiles, skills, interests, posts, comments, reactions, connections, conversations, messages, reports, blocks, moderation actions, and admin audit logs.

**Acceptance Criteria:**

- Migrations run cleanly.
- UUID primary keys are used.
- Timestamps, soft-delete columns, indexes, and constraints are included.

**Dependencies:** Ticket 3  
**Labels:** database, supabase, migrations  
**Priority:** P0

---

## Ticket 5: Implement Supabase Auth and policy/age acceptance gate

**Description:** Implement signup, login, logout, reset password, email verification, and required onboarding acceptance for Terms, Privacy Policy, Community Guidelines, and 18+ confirmation.

**Acceptance Criteria:**

- Auth flows work.
- Protected routes block unauthenticated users.
- Users cannot proceed to core features until required policy/age acceptance is recorded.

**Dependencies:** Ticket 4  
**Labels:** auth, onboarding, security  
**Priority:** P0

---

## Ticket 6: Implement RLS baseline and security tests

**Description:** Implement RLS policies for ownership, public reads, reporting, blocking, messaging, admin/moderator exceptions, and cross-user denial tests.

**Acceptance Criteria:**

- Users cannot access unauthorized rows.
- Users cannot mutate other users’ content.
- Blocked interactions are denied.
- Admin/moderator exceptions are controlled and tested.

**Dependencies:** Ticket 5  
**Labels:** rls, security, testing  
**Priority:** P0

---

## Ticket 7: Build onboarding and profile management

**Description:** Build onboarding, profile editing, role type selection, field, bio, interests, skills, profile visibility, and mentor availability.

**Acceptance Criteria:**

- Users can complete onboarding.
- Users can update their own profile.
- Required fields are validated server-side.

**Dependencies:** Ticket 6  
**Labels:** profiles, frontend, onboarding  
**Priority:** P0

---

## Ticket 8: Add Supabase Storage avatar uploads

**Description:** Allow users to upload and change profile avatars using Supabase Storage.

**Acceptance Criteria:**

- Valid images upload.
- Invalid files are rejected.
- Avatars render on profile cards and profile pages.
- Bucket policy is documented and enforced.

**Dependencies:** Ticket 7  
**Labels:** storage, profiles, security  
**Priority:** P1

---

## Ticket 9: Build feed and post composer

**Description:** Create paginated feed and post composer with create, edit, and soft-delete behavior.

**Acceptance Criteria:**

- Users can create posts.
- Users can edit/delete their own posts.
- Feed shows active visible posts.
- Soft-deleted posts are hidden but retained.

**Dependencies:** Ticket 7  
**Labels:** feed, posts, frontend  
**Priority:** P0

---

## Ticket 10: Implement comments and reactions

**Description:** Add comments and one reaction per user per post.

**Acceptance Criteria:**

- Users can comment on visible posts.
- Users can delete their own comments.
- Users can toggle one reaction per post.

**Dependencies:** Ticket 9  
**Labels:** comments, reactions  
**Priority:** P1

---

## Ticket 11: Build search and discovery

**Description:** Search visible active users by name, field, role, interests, and mentor availability.

**Acceptance Criteria:**

- Search returns only visible active unblocked profiles.
- Filters work for field, role, interests, and mentor availability.

**Dependencies:** Ticket 7  
**Labels:** search, discovery  
**Priority:** P0

---

## Ticket 12: Implement connection requests

**Description:** Implement send, cancel, accept, and decline connection request lifecycle.

**Acceptance Criteria:**

- Users can send/cancel requests.
- Recipients can accept/decline requests.
- Duplicate requests are blocked.
- Blocked-user restrictions are enforced.

**Dependencies:** Ticket 11  
**Labels:** connections, backend  
**Priority:** P0

---

## Ticket 13: Implement accepted-connection-only 1:1 messaging

**Description:** Implement simple 1:1 messaging only between accepted connections.

**Acceptance Criteria:**

- Only accepted connections can start/read/send messages.
- Only conversation members can read messages.
- Blocked users cannot message.
- No attachments, group messaging, or open inbox in MVP.

**Dependencies:** Ticket 12  
**Labels:** messages, realtime, safety  
**Priority:** P1

---

## Ticket 14: Implement reporting and blocking

**Description:** Users can report profiles, posts, comments, and messages; users can block/unblock other users.

**Acceptance Criteria:**

- Reports are created with target type and reason.
- Reports appear in admin queue.
- Blocks immediately prevent direct interaction.

**Dependencies:** Tickets 9, 12, 13  
**Labels:** safety, moderation  
**Priority:** P0

---

## Ticket 15: Build admin moderation dashboard

**Description:** Build admin/moderator dashboard for reviewing reports, removing content, restricting users, and recording moderation actions.

**Acceptance Criteria:**

- Admin/moderator can view report queue.
- Admin/moderator can dismiss/action reports.
- Actions update target status.
- `moderation_actions` records are created.

**Dependencies:** Ticket 14  
**Labels:** admin, moderation, audit  
**Priority:** P0

---

## Ticket 16: Implement protected role management

**Description:** Implement protected role changes for admin/moderator roles with audit logging.

**Acceptance Criteria:**

- Normal profile flows cannot edit privileged roles.
- Only protected admin actions can change roles.
- Role changes write to `admin_audit_logs`.

**Dependencies:** Ticket 15  
**Labels:** admin, security, audit  
**Priority:** P0

---

## Ticket 17: Add validation, sanitization, and rate limits

**Description:** Add shared validation schemas, sanitized rendering, and rate limits for core write actions.

**Acceptance Criteria:**

- Invalid payloads are rejected.
- Unsafe content does not render as HTML.
- Rate limits protect auth, posts, comments, messages, reports, and connections.

**Dependencies:** Tickets 5, 9, 10, 13, 14  
**Labels:** security, validation, abuse-control  
**Priority:** P0

---

## Ticket 18: Implement backup/export/recovery runbook

**Description:** Document and test backup, export, and recovery process before external pilot users are invited.

**Acceptance Criteria:**

- Backup/export/recovery process is documented.
- Recovery test is performed or simulated.
- Owner and frequency are defined.

**Dependencies:** Ticket 4  
**Labels:** operations, backup, production-readiness  
**Priority:** P0

---

## Ticket 19: Complete MVP QA, UAT, and demo readiness

**Description:** Add seed demo users, complete mobile QA, run UAT, and validate demo script.

**Acceptance Criteria:**

- Demo flow passes from signup through moderation action.
- RLS/security tests pass.
- Mobile QA passes.
- Demo seed data is ready.

**Dependencies:** All MVP tickets  
**Labels:** qa, demo, testing  
**Priority:** P0
