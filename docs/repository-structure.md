# Repository Structure

```text
README.md
docs/
  mvp-technical-spec.md
  implementation-roadmap.md
  github-implementation-tickets.md
  repository-structure.md
  operations/
    environments.md
    backup-export-recovery.md
  security/
    moderation-and-audit.md
.github/
  ISSUE_TEMPLATE/
    implementation-ticket.md
app/.gitkeep
components/.gitkeep
lib/.gitkeep
supabase/
  migrations/.gitkeep
  seed/.gitkeep
tests/.gitkeep
```

## Notes

- `docs/` contains controlled planning and operating documents.
- `.github/ISSUE_TEMPLATE/` contains the implementation ticket template.
- `app/`, `components/`, and `lib/` are placeholders for the future Next.js application structure.
- `supabase/migrations/` will contain database migrations.
- `supabase/seed/` will contain seed data for demo and testing.
- `tests/` will contain unit, integration, RLS/security, and UAT-related tests.
