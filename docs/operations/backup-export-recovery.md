# Backup, Export, and Recovery Runbook

## Purpose

Define the minimum backup, export, and recovery approach required before external pilot users are invited to FieldsConnect.

## Scope

This runbook covers:

- Supabase Postgres database data.
- Supabase Storage assets.
- Moderation records.
- Admin audit logs.
- Recovery testing.

## Backup Requirements

- Confirm Supabase plan backup features before production pilot.
- Document backup frequency.
- Confirm retention period.
- Confirm who has access to backups.
- Confirm recovery steps.

## Export Requirements

Exports may include:

- User profiles.
- Posts/comments/reactions.
- Connections.
- Reports.
- Moderation actions.
- Admin audit logs.

Exports must be:

- Authorized.
- Logged.
- Stored securely.
- Deleted when no longer needed.

## Recovery Requirements

Before external pilot users:

1. Perform or simulate a database recovery test.
2. Confirm Storage recovery approach.
3. Confirm that moderation and audit records are recoverable.
4. Document recovery owner.
5. Document expected recovery time.

## Minimum Recovery Test

- Create staging test data.
- Export or backup test data.
- Restore into isolated environment.
- Verify profiles, posts, reports, and audit logs.
- Record result in project notes.

## Owner

To be assigned before pilot launch.

## Review Frequency

Review before each major MVP release and before external pilot expansion.
