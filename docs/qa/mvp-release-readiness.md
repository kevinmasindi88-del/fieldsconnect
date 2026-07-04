# FieldsConnect MVP Release Readiness

## Current MVP Coverage

The current MVP includes:

- Auth and onboarding
- Profile management
- Connection request workflow
- Accepted-connection-only 1:1 messaging
- Timeline posts, comments, and likes
- Skills showcase
- Library document upload baseline
- Moderation reporting baseline
- Shared navigation shell

## Release Readiness Gates

Before demo or pilot release, confirm:

- [ ] Local production build passes
- [ ] Supabase migrations apply cleanly
- [ ] Auth flow works with real test accounts
- [ ] Onboarding acceptance is saved
- [ ] Connection workflow works between two test users
- [ ] Messaging works only between accepted connections
- [ ] Timeline visibility works as expected
- [ ] Skills publish/unpublish works as expected
- [ ] Library upload works with Storage policies
- [ ] Moderation reports are captured
- [ ] Main routes are linked through navigation
- [ ] Known limitations are understood before demo

## Demo-Ready Definition

FieldsConnect can be considered demo-ready when a tester can complete this end-to-end flow:

1. Create account
2. Complete onboarding
3. Complete profile
4. Connect with another user
5. Send a 1:1 message
6. Create a timeline post
7. Add a skill
8. Upload a library document
9. Submit a moderation report

## Pilot-Ready Definition

FieldsConnect can be considered pilot-ready when:

- Smoke test passes on deployed environment
- RLS behaviour is validated with multiple users
- Storage upload/download is validated
- Basic privacy expectations are confirmed
- Manual moderation review process is defined
- Backup/export approach is documented
- Support contact/process is defined

## Not Yet Production-Ready Until

- Admin moderation workflow exists
- Operational monitoring exists
- Error logging exists
- Database backup/restore has been tested
- Security review has been completed
- Terms, Privacy Policy, and Community Guidelines are finalized
- Abuse response workflow is operational
- User support process is operational
