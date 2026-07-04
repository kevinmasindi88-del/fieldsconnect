# Moderation and Audit Controls

## Purpose

Define the distinction between moderation records and admin audit logs, and establish baseline controls for trust, safety, and privileged actions.

## Moderation Actions

`moderation_actions` records trust and safety decisions related to:

- Reports.
- Content removal.
- User restrictions.
- User suspension.
- Harassment/spam/scam handling.
- Illegal content escalation.
- Minor safety escalation if a future minor-user policy is implemented.

### Minimum Fields

- `id`
- `actor_id`
- `target_type`
- `target_id`
- `action`
- `reason`
- `created_at`

## Admin Audit Logs

`admin_audit_logs` records privileged administrative actions such as:

- Role changes.
- Suspensions.
- Account status changes.
- Data exports.
- Sensitive admin operations.
- Security configuration changes.

### Minimum Fields

- `id`
- `actor_id`
- `action`
- `metadata jsonb`
- `created_at`

## Role Management Rule

Admin and moderator roles must not be editable through normal profile flows.

Role changes must:

1. Occur only through protected admin actions.
2. Be limited to authorized admin users.
3. Write to `admin_audit_logs`.
4. Be tested through RLS/security tests.

## MVP Messaging Safety Rule

Users may only message accepted connections.

MVP excludes:

- Open inbox.
- Unsolicited messaging.
- Group messaging.
- Message attachments.

## Blocking Rule

Blocking must immediately prevent:

- New connection requests.
- Messaging.
- Direct interaction.
- Profile interaction where applicable.

## Reporting Workflow

Report statuses:

1. `submitted`
2. `in_review`
3. `dismissed`
4. `actioned`

## Abuse Categories

MVP report reasons should include:

- Spam.
- Harassment.
- Scam/fraud.
- Impersonation.
- Inappropriate content.
- Illegal content.
- Minor safety concern.
- Other.
