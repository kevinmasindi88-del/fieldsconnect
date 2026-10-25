# Age self-declaration signup QA

- [x] Adult 18+ checked: signup remains on one form, without adult DOB or ID request.
- [x] Unticked: display guardian Name, Date of birth, Email and one approval checkbox inline, without additional route.
- [x] Validate that guardian name/email are present and DOB indicates an adult 18 or older.
- [x] Existing general Terms/COC checkbox is separate; name and email remain first on signup.
- [x] Capture parent/guardian declaration in a private, non-public database table via signup insert trigger. Remove contact/DOB from editable user metadata.
- [ ] Test adult signup, email verification, member profile provisioning and login end to end.
- [ ] Test younger learner/guardian declaration submitted through signup and verify private record, no public visibility, and ordinary email verification.
- [ ] Test under-18 guardian DOB, missing email, missing approval, and unauthorised table reads.
- [ ] Validate privacy disclosures and legal interpretation of self-declaration; these records do not independently establish guardianship.
- [ ] No production frontend promotion until explicit approval.
