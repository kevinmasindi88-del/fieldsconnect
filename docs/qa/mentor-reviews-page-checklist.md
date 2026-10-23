# Dedicated mentor reviews page — Preview QA (23 October 2026)

- Review count on mentor profile and Find People is a Link to /mentors/[mentorId]/reviews, not a dialog.
- Each verified completed mentee rating renders a separate card.
- Without explicit named consent, card displays only star count, generic mentorship cycle title and anonymous reviewer.
- An earlier consent to anonymously publish written feedback does not publish a reviewer name or cycle field.
- With new opt-in, display mentee name, mentorship-field-derived cycle title, original written feedback and star rating.
- New consent is reversible, mentee-only, and no ratings are automatically backfilled or altered.
- Test opted-in/out display across two users, role restrictions, RLS visibility, old anonymous-publication function, and no private profile name leaks.
- Test mobile widths, keyboard access, >20 review pagination, loading/failure states, and browser-back navigation.
- Verify Paystack live transactions stay disabled. Promote only the immutable tested Preview after owner acceptance.
