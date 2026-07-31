# FieldsConnect Library Implementation Tickets

These tickets extend `docs/github-implementation-tickets.md` and must be created as GitHub Issues before Library feature coding begins.

---

## Library Ticket L1: Approve Library policy and compliance baseline

**Description:** Approve the controlled Library specification and finalise the Library Terms and Conditions, prohibited-content rules, retention approach, reporting/takedown procedure, and pilot compensating controls.

**Acceptance Criteria:**

- `docs/library-feature-spec.md` is approved.
- Library Terms versioning and reacceptance rules are defined.
- Prohibited content, retention, takedown, appeal, and legal-hold rules are documented.
- POPIA/privacy and copyright wording receives appropriate pre-pilot review.

**Dependencies:** Main Ticket 1  
**Labels:** docs, legal, privacy, library, P0

---

## Library Ticket L2: Create Library database schema and RLS

**Description:** Add migrations for Library documents, document versions, terms acceptances, reports, moderation actions, and audit logs.

**Acceptance Criteria:**

- Tables, status constraints, indexes, timestamps, and soft-delete fields are created.
- RLS prevents cross-user access and client-side moderation-state manipulation.
- Acceptance records retain the accepted terms version and timestamp.
- RLS/security tests cover owner, other user, suspended user, moderator, and admin scenarios.

**Dependencies:** Main Tickets 4 and 6; Library Ticket L1  
**Labels:** database, supabase, rls, library, P0

---

## Library Ticket L3: Configure private Library storage and upload security

**Description:** Configure a private Supabase Storage bucket and controlled upload pipeline with an 8 MB limit, explicit file allow-list, filename/path controls, MIME validation, checksum recording, and quarantine or compensating review.

**Acceptance Criteria:**

- Bucket is private.
- Files larger than 8 MB are rejected server-side.
- Unsupported files, double extensions, executable content, and MIME mismatches are rejected.
- Storage paths are non-guessable and cannot be freely selected by clients.
- Access uses short-lived signed URLs after authorization checks.
- Removed or quarantined documents cannot receive new valid access links.

**Dependencies:** Library Ticket L2  
**Labels:** storage, security, uploads, library, P0

---

## Library Ticket L4: Implement Library terms acceptance gate

**Description:** Require acceptance of the current Library Terms and Conditions before upload or download/access.

**Acceptance Criteria:**

- Current terms version is displayed and recorded.
- Users cannot upload or download without valid current acceptance.
- Material terms updates require reacceptance.
- Acceptance checks are enforced server-side, not only in the interface.

**Dependencies:** Library Tickets L1 and L2  
**Labels:** compliance, auth, library, P0

---

## Library Ticket L5: Build validated upload and rights declaration

**Description:** Build the upload form and server action for metadata, attribution, rights basis, ownership/permission declaration, file validation, and controlled document creation.

**Acceptance Criteria:**

- Required metadata and rights declaration are recorded.
- Users cannot set uploader, moderation, audit, or protected storage fields directly.
- Upload failures do not leave uncontrolled orphan database or storage records.
- Valid uploads enter the configured pending or active status workflow.

**Dependencies:** Library Tickets L3 and L4  
**Labels:** frontend, backend, uploads, compliance, library, P0

---

## Library Ticket L6: Build Library catalogue, search, detail, and access

**Description:** Build paginated Library discovery, filters, document details, metadata display, and controlled signed download/access.

**Acceptance Criteria:**

- Search and filters work for title, category, field, uploader, tags, file type, and recency.
- Restricted, removed, quarantined, deleted, blocked, or non-visible records are excluded.
- Private storage paths are never exposed.
- Authorization and terms acceptance are rechecked before access is issued.

**Dependencies:** Library Ticket L5  
**Labels:** frontend, search, access-control, library, P0

---

## Library Ticket L7: Build own-document management and versioning

**Description:** Allow users to view upload statuses, edit permitted metadata, soft-delete eligible documents, and replace files through a controlled version workflow.

**Acceptance Criteria:**

- Users can manage only their own documents.
- Moderation-protected or legally held records cannot be improperly deleted.
- Replacement creates a new version and does not silently overwrite the prior object.
- Version history and status changes are auditable.

**Dependencies:** Library Ticket L6  
**Labels:** versioning, audit, library, P1

---

## Library Ticket L8: Implement Library reporting, takedown, and moderation

**Description:** Add document reporting, severity-based restriction/quarantine, moderator review, takedown, dismissal, restoration, escalation, uploader notification, and appeal-ready records.

**Acceptance Criteria:**

- Users can report documents using controlled reason categories.
- High-risk reports can immediately restrict access pending review.
- Moderators/admins can action Library reports only through protected actions.
- Every decision records actor, reason, previous status, new status, target, and timestamp.
- Stale links do not continue to provide access after restriction or removal.

**Dependencies:** Main Tickets 14-16; Library Ticket L6  
**Labels:** moderation, safety, copyright, privacy, library, P0

---

## Library Ticket L9: Add Library hardening, recovery, and UAT

**Description:** Complete rate limits, upload abuse tests, backup/export/recovery coverage, retention handling, incident response, mobile QA, and pilot UAT.

**Acceptance Criteria:**

- Upload, report, and signed-access generation are rate-limited.
- RLS, file validation, authorization, takedown, and version tests pass.
- Backup and recovery cover Library rows and storage objects.
- Retention and deletion jobs are documented and tested.
- Mobile upload, catalogue, detail, reporting, and moderation flows pass.
- Safe sample documents are used for seed/demo data.

**Dependencies:** Library Tickets L1-L8; Main Tickets 17-19  
**Labels:** qa, operations, security, library, P0
