# Repository Structure

```text
README.md
docs/
  mvp-technical-spec.md
  library-feature-spec.md
  implementation-roadmap.md
  github-implementation-tickets.md
  library-implementation-tickets.md
  repository-structure.md
  operations/
    environments.md
    backup-export-recovery.md
  security/
    moderation-and-audit.md
.github/
  ISSUE_TEMPLATE/
    implementation-ticket.md
app/
  library/
    page.tsx
    upload/page.tsx
    [documentId]/page.tsx
    my-documents/page.tsx
    terms/page.tsx
  admin/
    library/page.tsx
    library/reports/page.tsx
components/
  library/
    LibraryTermsGate.tsx
    LibrarySearchFilters.tsx
    LibraryDocumentCard.tsx
    LibraryDocumentDetails.tsx
    LibraryUploadForm.tsx
    RightsDeclarationFields.tsx
    DocumentStatusBadge.tsx
    LibraryReportDialog.tsx
    MyDocumentsTable.tsx
    AdminLibraryQueue.tsx
    LibraryModerationPanel.tsx
lib/
  library/
    actions.ts
    authorization.ts
    constants.ts
    schemas.ts
    storage.ts
    terms.ts
supabase/
  migrations/
  seed/
tests/
  library/
```

## Notes

- `docs/` contains controlled planning and operating documents.
- `docs/library-feature-spec.md` is the authoritative Library feature and control baseline.
- `docs/library-implementation-tickets.md` contains the issue-ready Library build sequence.
- `.github/ISSUE_TEMPLATE/` contains the implementation ticket template.
- `app/library/` contains authenticated catalogue, upload, detail, own-document, and terms routes.
- `app/admin/library/` contains protected Library moderation routes.
- `components/library/` contains reusable Library interface components.
- `lib/library/` contains server actions, authorization, validation, storage, and terms-version logic. Clients must not directly control protected upload or moderation fields.
- `supabase/migrations/` will contain Library database, RLS, function, and storage-policy migrations.
- `supabase/seed/` will contain safe demo metadata and non-sensitive sample documents only.
- `tests/library/` will contain validation, authorization, RLS, storage, reporting, versioning, takedown, mobile, and UAT-related tests.
