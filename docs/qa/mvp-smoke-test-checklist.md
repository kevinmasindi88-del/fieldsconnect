# FieldsConnect MVP Smoke Test Checklist

## Purpose

This checklist confirms that the FieldsConnect MVP works end-to-end after each meaningful feature merge.

It is intended for manual QA before demo use, pilot testing, or production readiness review.

## Test Environment

Record before testing:

- Tester:
- Date:
- Branch or commit:
- Environment:
- Supabase project:
- Browser:
- Device:

## Pre-Test Requirements

- [ ] Application builds successfully with `npm.cmd run build`
- [ ] `.env.local` contains the required Supabase URL and anon key
- [ ] Supabase migrations have been applied in order
- [ ] Supabase Auth is enabled
- [ ] Supabase Storage bucket `library-documents` exists
- [ ] Test user accounts are available
- [ ] At least two test users exist for connection and messaging checks

## Route Smoke Test

Confirm each route loads without a crash.

- [ ] `/`
- [ ] `/signup`
- [ ] `/login`
- [ ] `/reset-password`
- [ ] `/onboarding`
- [ ] `/profile`
- [ ] `/connections`
- [ ] `/messages`
- [ ] `/timeline`
- [ ] `/skills`
- [ ] `/library`
- [ ] `/moderation`
- [ ] `/health`

## Auth and Onboarding

### Sign Up

- [ ] User can open `/signup`
- [ ] User can create an account
- [ ] User receives expected auth flow response
- [ ] User can log in after signup

### Login

- [ ] User can open `/login`
- [ ] User can log in with valid credentials
- [ ] Invalid credentials show a controlled error

### Password Reset

- [ ] User can open `/reset-password`
- [ ] User can submit reset request
- [ ] Reset request shows controlled response

### Onboarding Gate

- [ ] User can open `/onboarding`
- [ ] User can accept Terms
- [ ] User can accept Privacy Policy
- [ ] User can accept Community Guidelines
- [ ] User can confirm 18+ eligibility
- [ ] Acceptance timestamps save to profile record

## Profile Management

- [ ] User can open `/profile`
- [ ] User can update display name
- [ ] User can update username
- [ ] User can update role type
- [ ] User can update field
- [ ] User can update bio
- [ ] User can update profile visibility
- [ ] User can update mentor availability
- [ ] Saved profile reloads correctly

## Connections

Use two test users.

### Discovery

- [ ] User A can open `/connections`
- [ ] User A can view eligible profiles
- [ ] User A cannot connect to self

### Request Flow

- [ ] User A can send connection request to User B
- [ ] User B can see incoming request
- [ ] User B can accept request
- [ ] Accepted connection appears for both users

### Decline Flow

- [ ] User A can send request to User B
- [ ] User B can decline request
- [ ] Declined request no longer behaves as accepted connection

## Messaging

Use two accepted connection users.

- [ ] User A can open `/messages`
- [ ] User A can start or open conversation with accepted connection
- [ ] User A can send message
- [ ] User B can view message
- [ ] User B can reply
- [ ] Non-connected user is not available as open message target
- [ ] No group messaging is available
- [ ] No message attachments are available

## Timeline

- [ ] User can open `/timeline`
- [ ] User can create public text post
- [ ] User can create connections-only text post
- [ ] User can view visible posts
- [ ] User can add comment
- [ ] User can like post
- [ ] User can unlike post
- [ ] Deleted records do not display if manually soft-deleted in database

## Skills

- [ ] User can open `/skills`
- [ ] User can add skill name
- [ ] User can add skill description
- [ ] User can add rating from 1 to 5
- [ ] User can publish skill
- [ ] User can unpublish skill
- [ ] User can view own unpublished skills
- [ ] Other users only see published visible skills

## Library

Use a small test document under 8 MB.

- [ ] User can open `/library`
- [ ] User can upload allowed document type
- [ ] Upload larger than 8 MB is blocked
- [ ] User can publish document
- [ ] User can unpublish document
- [ ] User can set public visibility
- [ ] User can set connections-only visibility
- [ ] User can open document using signed link
- [ ] Other users only see documents allowed by visibility rules
- [ ] Messaging attachments remain unavailable

## Moderation Reporting

- [ ] User can open `/moderation`
- [ ] User can submit profile report
- [ ] User can submit post report
- [ ] User can submit comment report
- [ ] User can submit message report
- [ ] User can submit skill report
- [ ] User can submit library document report
- [ ] User can view own submitted reports
- [ ] User cannot view other users' submitted reports

## Navigation Shell

- [ ] Header displays on main app pages
- [ ] Header is hidden on auth pages
- [ ] Main navigation links work
- [ ] Active route state displays correctly
- [ ] Home page feature cards link to correct routes
- [ ] Layout works on desktop width
- [ ] Layout remains usable on mobile width

## Supabase Migration Validation

Apply migrations in order:

- [ ] `0001_initial_schema.sql`
- [ ] `0002_rls_baseline.sql`
- [ ] `0003_messaging_conversation_rls.sql`
- [ ] `0004_skills_owner_select_rls.sql`
- [ ] `0005_library_documents_baseline.sql`
- [ ] `0006_reports_owner_select_rls.sql`

Confirm:

- [ ] All tables exist
- [ ] RLS is enabled on protected tables
- [ ] Policies are created without duplicate-name errors
- [ ] Storage bucket exists
- [ ] Storage policies are active
- [ ] Seed/test data can be inserted where appropriate

## Known MVP Limitations

- No admin moderation decision workflow yet
- No automated moderation yet
- No image upload for posts yet
- No profile photos yet
- No message attachments
- No group messaging
- No advanced search or matching algorithm
- No production monitoring dashboard yet
- No automated test suite yet
- No email notification workflow yet
- No mobile app wrapper yet

## Smoke Test Result

- [ ] Pass
- [ ] Pass with issues
- [ ] Fail

Notes:

