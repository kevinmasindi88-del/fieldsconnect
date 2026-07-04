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

## Environment Variable Baseline

The following variables must exist in `.env.example` and be configured separately for local, preview/staging, and production environments.

| Variable | Local Development | Preview/Staging | Production | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | FieldsConnect | FieldsConnect | FieldsConnect | Public display name. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Vercel preview URL | Production URL | Must match deployed environment. |
| `NEXT_PUBLIC_APP_ENV` | `development` | `preview` or `staging` | `production` | Used for environment-aware UI/config checks. |
| `NEXT_PUBLIC_SUPABASE_URL` | Dev Supabase URL | Staging Supabase URL | Production Supabase URL | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Staging anon key | Production anon key | Public anon key, protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Local only if needed | Server-side only | Server-side only | Never expose to browser or commit to Git. |
| `NEXT_PUBLIC_REQUIRE_AGE_CONFIRMATION` | `true` | `true` | `true` | MVP onboarding gate. |
| `NEXT_PUBLIC_MINIMUM_AGE` | `18` | `18` | `18` | Controlled MVP age baseline. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional | Support/test inbox | Production support inbox | Public support contact. |

## Required Local Files

Developers must create a local `.env.local` from `.env.example`.

`.env.local` must never be committed.

## Vercel Configuration

Vercel must define environment variables separately for:

- Development
- Preview
- Production

Production values must not be reused in preview/staging unless explicitly approved.

## Supabase Configuration

Each environment should use a separate Supabase project or isolated database configuration.

The production Supabase project must not be used for local development or uncontrolled testing.

## Validation Checklist

Before starting feature implementation:

- `.env.example` exists.
- `.env.local` is ignored by Git.
- No real secrets are committed.
- Environment naming is consistent.
- Preview/staging and production variables are separated.
