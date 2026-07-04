# FieldsConnect Controlled MVP Technical Specification

## 1. Document Control

| Field | Detail |
|---|---|
| Document title | FieldsConnect Controlled MVP Technical Specification |
| Version | 0.2 Draft |
| Date | July 1, 2026 |
| Prepared for | FieldsConnect |
| Purpose | Define a controlled, demo-ready MVP using Next.js, Vercel, Supabase Auth, Supabase Postgres, Supabase Storage, and limited Supabase Realtime. |
| Scope | Production-foundation MVP for onboarding, profiles, feed, discovery, connection requests, accepted-connection-only 1:1 messaging, reporting, blocking, and admin moderation. |
| Assumptions | MVP is a web app first, mobile-first responsive, single-region initially, English-only, and optimized for demo validation rather than scale. |
| Constraints | Low startup cost, minimal custom backend, no advanced AI, no payment layer, no native mobile app, no complex institution verification in MVP. |

## 2. MVP Scope

### Must-Have Features

- Supabase Auth signup, login, logout, email verification, and password reset.
- Role-aware onboarding: standard user, mentor, mentee/student, institution.
- Mandatory acceptance of Terms of Use, Privacy Policy, Community Guidelines, and 18+ age confirmation.
- Editable profiles with avatar upload.
- Feed with create, edit, and soft-delete posts.
- Comments and basic reactions.
- Search/discovery by field, role, interests, and mentor availability.
- Connection requests with send, cancel, accept, decline, and block.
- Simple 1:1 messaging between accepted connections only.
- Report user/content and block user.
- Admin/moderator dashboard for reports, users, role management, and content removal.
- RLS-backed authorization and audit logs.
- Environment separation for development, preview/staging, and production.
- Backup/export/recovery runbook before external pilot users.

### Deferred Features

- AI matching/copilot.
- Group messaging.
- Open inbox/unrestricted messaging.
- Message attachments.
- Advanced mentorship scheduling.
- Payments/subscriptions.
- Native iOS/Android.
- Institution verification workflow.
- Guardian role unless a controlled minor-user policy is implemented.
- Advanced recommendation engine.
- Full-text/semantic search beyond simple indexed filters.
- Email notification campaigns.

## 3. User Roles

- **Standard user:** Can create profile, post, comment, react, search, connect, report, and block.
- **Mentor:** Standard user with mentor availability and mentorship tags.
- **Mentee/student:** Standard user seeking mentorship. MVP users must be 18+ unless minor-user controls are implemented.
- **Institution:** Profile type for schools, organizations, or programs. Limited MVP functionality.
- **Moderator:** Can review reports, hide/remove content, restrict users, and create moderation records.
- **Admin:** Full platform management, protected role management, audit access, and sensitive admin operations.
- **Guardian:** Deferred unless required by a later minor-user policy.

## 4. Functional Requirements

### Authentication

- Email/password signup.
- Email verification.
- Login/logout.
- Reset password.
- Protected routes.
- Acceptance gate for legal/community policies and 18+ confirmation.

### Onboarding

Capture:

- Display name.
- Role type.
- Field.
- Interests.
- Skills.
- Mentorship intent.
- Profile visibility.
- 18+ age confirmation.
- Terms, Privacy Policy, and Community Guidelines acceptance.

### Profiles

- Public profile.
- Editable private profile.
- Avatar.
- Bio/prompt.
- Skills.
- Interests.
- Field.
- Optional location.
- Mentor availability.

### Feed and Posts

- Create text posts.
- Categorize posts as idea, collaboration, showcase, or mentorship.
- Edit/delete own posts.
- Soft delete rather than hard delete.
- Paginated feed.

### Comments and Reactions

- Comment on visible posts.
- Delete own comments.
- One reaction per user per post.

### Search and Discovery

Search users by:

- Name.
- Field.
- Interests.
- Role type.
- Mentor availability.

Results must exclude blocked, suspended, deleted, or non-visible profiles.

### Connection Requests

- Send connection request.
- Cancel pending request.
- Accept request.
- Decline request.
- Prevent duplicate requests.
- Prevent blocked-user interactions.

### Messaging

MVP messaging is limited to simple 1:1 messaging between accepted connections only.

Excluded from MVP messaging:

- Open inbox.
- Unsolicited messaging.
- Group messaging.
- Attachments.

Supabase Realtime may be used only for active conversation updates if feasible.

### Reporting and Blocking

- Report posts, comments, profiles, or messages.
- Block users.
- Blocking immediately prevents direct interaction.

### Admin and Moderation

- View report queue.
- Inspect reported content.
- Dismiss report.
- Remove content.
- Restrict/suspend user.
- Manage roles through protected admin action only.
- Record moderation actions and admin audit logs.

## 5. Non-Functional Requirements

- **Security:** RLS on all user data, server-side validation, protected admin routes, secure upload policies.
- **Privacy:** Users control profile visibility; private fields are not publicly exposed.
- **Performance:** Mobile-first pages load quickly; feed/search are paginated; images are optimized.
- **Accessibility:** Semantic HTML, form labels, keyboard navigation, focus states, contrast checks.
- **Mobile responsiveness:** Designed for 360px+ widths, then tablet/desktop expansion.
- **Maintainability:** Feature folders, typed models, reusable components, migrations.
- **Auditability:** Admin/moderator actions recorded with actor, target, action, reason, and timestamp.

## 6. Database Schema Draft

### Core Tables

- `profiles`
- `skills`
- `interests`
- `profile_skills`
- `profile_interests`
- `posts`
- `comments`
- `reactions`
- `connections`
- `conversations`
- `conversation_members`
- `messages`
- `reports`
- `blocks`
- `moderation_actions`
- `admin_audit_logs`

### Important Rules

- UUID primary keys.
- Created/updated/deleted timestamps.
- Soft deletes for user-generated content.
- Indexes for feed, search, conversations, and moderation queues.
- RLS enabled from the beginning.
- Migrations used from day one.

## 7. Supabase RLS Outline

- Public profiles readable by authenticated users unless blocked, suspended, or deleted.
- Users can create and update only their own profile.
- Users can create posts only under their own account.
- Users can update/delete only their own posts/comments.
- Users can only message accepted connections.
- Only conversation members can read messages.
- Blocked users cannot connect, message, or interact.
- Reports can be created by users and read/actioned by moderators/admins.
- Admin/moderator exceptions must be enforced through protected server actions and role checks.
- Admin/moderator roles must not be editable through normal profile flows.

## 8. Frontend Structure

### Routes

- `/`
- `/login`
- `/signup`
- `/reset-password`
- `/onboarding`
- `/feed`
- `/discover`
- `/profile/[id]`
- `/profile/edit`
- `/connections`
- `/messages`
- `/messages/[conversationId]`
- `/admin`
- `/admin/reports`
- `/admin/users`
- `/admin/content`

### Main Components

- `AppShell`
- `BottomNav`
- `TopBar`
- `AuthForm`
- `OnboardingForm`
- `ProfileCard`
- `ProfileEditor`
- `PostComposer`
- `PostCard`
- `CommentList`
- `SearchFilters`
- `ConnectionButton`
- `ReportDialog`
- `BlockButton`
- `AdminReportTable`

## 9. Backend/API/Server Action Structure

- Auth flows.
- Profile actions.
- Avatar upload actions.
- Post actions.
- Comment/reaction actions.
- Connection actions.
- Accepted-connection-only message actions.
- Report/block actions.
- Protected admin role-management actions.
- Admin moderation actions.
- Audit-log writes.

## 10. Security and Abuse Controls

- Rate limits on auth, posts, comments, messages, reports, and connection requests.
- Shared validation schemas.
- Server-side validation on all writes.
- File upload MIME/type/size validation.
- Storage bucket policies.
- Sanitized rendering of user-generated text.
- Reporting workflow: submitted → in review → dismissed/actioned.
- Blocking workflow with immediate interaction prevention.
- Admin audit logs for privileged actions.
- Abuse categories: spam, harassment, scams, minor safety, impersonation, illegal content.

## 11. Environment and Operations

- Development, preview/staging, and production must be separated.
- Secrets must be stored in environment variables only.
- Production data must not be used casually in development.
- Backup/export/recovery approach must be documented and tested before external pilot users.

## 12. Build Milestones

1. Project foundation.
2. Documentation baseline approval.
3. Supabase schema migrations.
4. Supabase Auth and policy/age acceptance gate.
5. RLS baseline and security tests.
6. Onboarding and profile management.
7. Avatar uploads.
8. Feed and post composer.
9. Comments and reactions.
10. Search and discovery.
11. Connection requests.
12. Accepted-connection-only 1:1 messaging.
13. Reporting and blocking.
14. Admin moderation dashboard.
15. Protected role management.
16. Validation, sanitization, and rate limits.
17. Backup/export/recovery runbook.
18. MVP QA, UAT, and demo readiness.

## 13. Testing and Validation Plan

- Unit tests for validation schemas, permission helpers, and status transitions.
- Integration tests for auth, onboarding, post CRUD, comments, reactions, connections, reports, and messaging.
- RLS/security tests for cross-user denial, blocked interaction denial, and admin exceptions.
- Mobile checks at 360px, 390px, 430px, tablet, and desktop.
- UAT with demo mentor, mentee, institution, moderator, and admin users.
- Demo checklist from signup through moderation action and audit log creation.
