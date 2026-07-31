# FieldsConnect Controlled Library Feature Specification

## 1. Document Control

| Field | Detail |
|---|---|
| Document title | FieldsConnect Controlled Library Feature Specification |
| Version | 0.1 Draft |
| Date | July 31, 2026 |
| Prepared for | FieldsConnect |
| Status | Controlled MVP amendment pending approval |
| Purpose | Define the MVP Library feature, its compliance gate, secure document handling, moderation, auditability, and implementation acceptance criteria. |

## 2. Purpose and Scope

The FieldsConnect Library allows authenticated users to upload, discover, view metadata for, download, report, and manage permitted learning and professional documents.

The MVP Library is a controlled document-sharing feature. It is not an unrestricted public file host, cloud drive, messaging attachment system, or digital-rights marketplace.

### MVP scope

- Authenticated-user access only.
- Maximum file size of 8 MB per document.
- Supported document types limited by an explicit allow-list.
- Library-specific Terms and Conditions acceptance before first upload or download/access.
- Upload declaration confirming ownership, licence, permission, or lawful right to share.
- Document metadata, attribution, category, field, description, and visibility.
- Search and filtering by title, category, field, uploader, and tags.
- Reporting and takedown workflow.
- Soft deletion, moderation status, version/audit records, and secure storage policies.
- Administrator and moderator review tools.

### Deferred scope

- Paid document sales or royalties.
- DRM or watermark enforcement.
- In-browser collaborative editing.
- Public anonymous downloads.
- Message attachments.
- AI summarisation, semantic search, or automated copyright decisions.
- Institution-managed private repositories.
- Files larger than 8 MB.

## 3. Legal and Policy Baseline

The feature must be designed to support compliance with applicable requirements, including:

- Protection of Personal Information Act 4 of 2013 (POPIA).
- Copyright Act 98 of 1978, as amended.
- Cybercrimes Act 19 of 2020.
- FieldsConnect Terms of Use, Privacy Policy, Community Guidelines, and Library Terms and Conditions.

This document is a product-control baseline and not a substitute for legal advice. Final public policies should be reviewed before external pilot launch.

## 4. Library Acceptance Gate

A user must accept the current Library Terms and Conditions before:

- uploading a document;
- downloading a document;
- opening a protected document URL; or
- otherwise accessing shared file content.

Browsing non-sensitive document metadata may be permitted before acceptance, subject to the final product decision.

Each acceptance record must capture:

- user ID;
- Library terms version;
- acceptance timestamp;
- acceptance source or flow;
- optional policy document hash or published version identifier; and
- withdrawal or superseded status where applicable.

When a materially revised Library terms version is published, affected users must reaccept before further uploads or downloads.

## 5. Upload Declaration

Before upload completion, the user must declare that:

- they own the document or have permission/licence to share it;
- the upload does not unlawfully disclose confidential, personal, proprietary, or restricted information;
- the document does not contain malware, illegal content, or prohibited material;
- attribution and source details are accurate where applicable;
- they understand that FieldsConnect may restrict, quarantine, remove, or preserve records relating to reported content; and
- they accept responsibility for the content they upload.

Required upload fields:

- title;
- description;
- category;
- professional or academic field;
- source type;
- author or rights holder, where known;
- attribution or source reference, where applicable;
- rights basis: owner, permission, open licence, public domain, or other lawful basis;
- visibility;
- declaration checkbox;
- current Library terms acceptance.

Optional fields:

- tags;
- edition/version;
- publication date;
- licence name;
- external source link; and
- language.

## 6. Permitted and Prohibited Content

### Permitted examples

- Original notes, templates, guides, presentations, and professional resources.
- Openly licensed or public-domain material with appropriate attribution.
- Documents the uploader has written permission to share.
- Lawfully distributable educational or career-development resources.

### Prohibited examples

- Copyrighted works uploaded without permission or another lawful basis.
- Personal information shared without a lawful purpose or required consent.
- Confidential employer, client, patient, student, or institutional information.
- Examination leaks, stolen documents, credentials, or access keys.
- Malware, executable payloads, disguised files, or content intended to compromise systems.
- Illegal, exploitative, hateful, harassing, fraudulent, or otherwise prohibited content.
- Files that violate FieldsConnect policies or create an unacceptable safety or legal risk.

## 7. Functional Requirements

### Library catalogue

- Paginated catalogue of active, visible documents.
- Search by title, description, uploader, field, category, and tags.
- Filters for field, category, file type, recency, and visibility where relevant.
- Results exclude deleted, quarantined, rejected, blocked, or restricted content.

### Document detail

- Display metadata without exposing private storage paths.
- Show uploader profile according to profile visibility rules.
- Show rights basis, attribution, upload date, file type, and size.
- Provide report action and controlled download/access action.

### Upload

- Enforce authentication, Library terms acceptance, and upload declaration.
- Validate file size, extension, MIME type, and declared content type server-side.
- Generate a non-guessable storage path.
- Create the database record only through a controlled server action.
- Default new documents to `pending_scan` or `pending_review` when the selected security design requires it.
- Never trust the original filename as a storage key.

### User document management

- View own uploads and statuses.
- Edit permitted metadata.
- Soft-delete own active uploads unless preserved by a moderation or legal hold.
- Replace a document only through a controlled versioning flow; do not silently overwrite the original object.

### Download/access

- Use short-lived signed URLs or an equivalent protected delivery mechanism.
- Recheck authentication, Library terms acceptance, document status, visibility, blocking, and authorization before issuing access.
- Do not expose service-role credentials, permanent private bucket URLs, or unrestricted storage paths.

## 8. Data Model Draft

### `library_documents`

Suggested fields:

- `id` UUID primary key;
- `uploader_id` UUID;
- `title`;
- `description`;
- `category`;
- `field`;
- `tags`;
- `original_filename`;
- `storage_path`;
- `mime_type`;
- `file_extension`;
- `file_size_bytes`;
- `checksum`;
- `source_type`;
- `author_or_rights_holder`;
- `attribution`;
- `rights_basis`;
- `licence_name`;
- `source_url`;
- `visibility`;
- `status`;
- `moderation_reason`;
- `current_version_id`;
- `created_at`, `updated_at`, `deleted_at`.

Suggested statuses:

- `draft`;
- `pending_scan`;
- `pending_review`;
- `active`;
- `quarantined`;
- `restricted`;
- `removed`;
- `rejected`;
- `deleted`.

### `library_document_versions`

- document ID;
- version number;
- storage path;
- filename, MIME type, size, and checksum;
- uploader ID;
- change note;
- created timestamp;
- active/superseded status.

### `library_terms_acceptances`

- user ID;
- terms version;
- accepted timestamp;
- source;
- policy hash/version identifier;
- superseded timestamp.

### `library_reports`

- reporter ID;
- document ID;
- reason category;
- details;
- status;
- assigned moderator;
- created/resolved timestamps.

### `library_moderation_actions`

- actor ID;
- document ID;
- report ID where applicable;
- action;
- reason;
- previous status;
- new status;
- metadata;
- timestamp.

### `library_audit_logs`

Record sensitive events such as upload completion, document replacement, signed-download issuance where proportionate, takedown, restoration, legal hold, metadata changes, and administrative export.

## 9. Storage and Security Controls

- Use a private Supabase Storage bucket for Library files.
- Limit files to 8 MB at both client and server/storage-policy layers.
- Maintain an explicit allow-list of accepted extensions and MIME types.
- Reject double extensions, MIME mismatches, executable content, and unsupported archives.
- Sanitize filenames for display while retaining the original filename only as controlled metadata.
- Use UUID-based object paths partitioned by uploader and document/version ID.
- Prefer malware scanning or quarantine-before-publish. If automated scanning is unavailable for the pilot, apply a documented compensating review and restricted file-type allow-list.
- Store a checksum for integrity and duplicate/investigation support.
- Apply RLS to all Library tables from the first migration.
- Never permit clients to set moderation status, uploader ID, audit fields, or protected storage paths directly.
- Rate-limit uploads, reports, and signed-download generation.
- Avoid indexing private or removed document contents in public search engines.

## 10. RLS and Authorization Outline

- Authenticated users may read metadata only for active documents visible to them.
- Uploaders may create documents only for their own user ID through validated actions.
- Uploaders may edit permitted metadata on their own documents while active or draft.
- Uploaders may not change moderation state or audit records.
- Private storage objects are not directly publicly readable.
- Signed access is issued only after server-side authorization.
- Moderators/admins may review reports and change document status through protected actions.
- Moderator/admin actions must write immutable moderation and audit records.
- Blocked or suspended users must be excluded according to platform-wide interaction rules.

## 11. Reporting and Takedown Workflow

Suggested lifecycle:

1. Report submitted.
2. Document may remain active, become restricted, or be quarantined based on severity.
3. Moderator reviews document metadata, report, and relevant evidence.
4. Moderator dismisses, requests information, restricts, removes, or escalates.
5. Action and reason are recorded.
6. Uploader is notified where appropriate.
7. Appeal or restoration is handled through a controlled process.
8. Records required for audit, dispute handling, or legal obligations are retained according to the retention schedule.

High-risk allegations, including unlawful personal-data disclosure, malware, stolen confidential information, or credible copyright infringement, should support immediate restriction pending review.

## 12. Privacy and Retention

- Collect only metadata required to operate and moderate the Library.
- Do not expose uploader email addresses or private profile fields.
- Document retention periods for active files, deleted files, reports, moderation records, acceptance records, and audit logs.
- Soft-deleted or removed objects must not remain indefinitely without a defined retention or legal-hold reason.
- Support data-subject and account-deletion workflows without destroying records that must lawfully be preserved.
- Administrative exports must be authorized and audited.

## 13. Frontend Routes and Components

### Routes

- `/library`
- `/library/upload`
- `/library/[documentId]`
- `/library/my-documents`
- `/library/terms`
- `/admin/library`
- `/admin/library/reports`

### Components

- `LibraryTermsGate`
- `LibrarySearchFilters`
- `LibraryDocumentCard`
- `LibraryDocumentDetails`
- `LibraryUploadForm`
- `RightsDeclarationFields`
- `DocumentStatusBadge`
- `LibraryReportDialog`
- `MyDocumentsTable`
- `AdminLibraryQueue`
- `LibraryModerationPanel`

## 14. Implementation Sequence

1. Approve this controlled amendment and finalise policy wording.
2. Add Library schema and status enums.
3. Add private bucket, storage policies, and upload constraints.
4. Implement Library terms versioning and acceptance gate.
5. Implement validated upload and rights declaration.
6. Implement catalogue, detail, search, and signed access.
7. Implement own-document management and versioning.
8. Implement reports, moderation, takedown, and audit logs.
9. Add RLS, integration, abuse, upload-security, and mobile tests.
10. Complete pilot readiness review and legal/policy sign-off.

## 15. Acceptance Criteria for Pilot Readiness

- Users cannot upload or download without accepting the current Library terms.
- Every upload contains a recorded rights declaration and required metadata.
- Files larger than 8 MB or outside the allow-list are rejected server-side.
- Storage objects are private and accessed only through controlled authorization.
- Users cannot read, alter, or delete other users' protected records.
- Moderators can restrict/remove documents and every action is audited.
- Reports and takedown decisions follow defined statuses and reasons.
- Removed/quarantined documents cannot be downloaded through stale or newly issued links.
- Version replacement does not silently overwrite the historical record.
- Mobile upload, catalogue, detail, reporting, and moderation flows pass UAT.
- Backup, export, recovery, retention, and incident procedures include Library data and storage objects.
