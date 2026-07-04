# FieldsConnect MVP

FieldsConnect is a mobile-first mentorship and professional connection platform MVP built with:

- Next.js
- Vercel
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime only where required
- GitHub

## Current Stage

This repository is currently in the controlled MVP planning and foundation stage. Feature implementation should not begin until the documentation baseline is approved and committed.

## Control Documents

The key controlled documents are stored in `/docs`:

- `docs/mvp-technical-spec.md` — controlled MVP technical baseline
- `docs/implementation-roadmap.md` — build sequence and milestones
- `docs/github-implementation-tickets.md` — GitHub issue backlog source
- `docs/repository-structure.md` — intended repo structure
- `docs/operations/environments.md` — environment separation approach
- `docs/operations/backup-export-recovery.md` — backup/export/recovery runbook
- `docs/security/moderation-and-audit.md` — moderation, audit, and role-control rules

## Approved MVP Amendments

1. MVP messaging is strictly simple 1:1 messaging between accepted connections only.
2. No open inbox, group messaging, or message attachments in MVP.
3. Users must be 18+ unless a controlled minor-user policy, guardian consent model, and safeguarding workflow are implemented before launch.
4. Signup/onboarding must require acceptance of Terms of Use, Privacy Policy, Community Guidelines, and 18+ age confirmation.
5. Admin/moderator roles are not editable through profile flows.
6. Role changes only happen through protected admin actions and must write to `admin_audit_logs`.
7. `moderation_actions` records trust/safety decisions on reports, content, and user behavior.
8. `admin_audit_logs` records privileged administrative actions such as role changes, suspensions, exports, and sensitive admin operations.
9. Development, preview/staging, and production must be separated.
10. Backup/export/recovery must be documented and tested before external pilot users are invited.

## Suggested First Commit

```bash
git add .
git commit -m "docs: add controlled MVP specification and implementation roadmap"
```

## Rule Before Coding

Before implementation starts, GitHub issues should be created from `docs/github-implementation-tickets.md`. Each feature should be built ticket-by-ticket against acceptance criteria.
