# Environment Separation

## Purpose

FieldsConnect must separate development, preview/staging, and production environments to protect data, reduce deployment risk, and support controlled testing.

## Required Environments

### Development

Used for local development and early feature testing.

- Local Next.js app.
- Development Supabase project or isolated local Supabase setup.
- Test/demo data only.
- No production secrets.

### Preview/Staging

Used for Vercel preview deployments, stakeholder review, and pre-production validation.

- Separate Vercel preview environment variables.
- Separate Supabase project or isolated staging database.
- Seeded demo data.
- Used for UAT and demo script validation.

### Production

Used for real pilot users and live demos.

- Production Supabase project.
- Production Vercel deployment.
- Production secrets only in environment management.
- Database backups enabled and monitored.
- Access restricted.

## Secrets Handling

- Never commit `.env` files.
- Store secrets in Vercel and local `.env.local` only.
- Rotate secrets if accidentally exposed.
- Use separate Supabase keys per environment.

## Data Handling

- Production data must not be casually copied into development.
- Staging should use seed/demo data.
- Any production export must be authorized and logged.

## Pre-Pilot Requirement

Before external pilot users are invited:

- Production environment must be separated from development/staging.
- Backup/export/recovery process must be documented.
- Admin access must be restricted and auditable.
