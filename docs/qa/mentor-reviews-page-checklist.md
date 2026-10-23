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

## Review visibility options
- Three choices on the completed-cycle mentee feedback: keep comment private, publish anonymously, publish with name.
- Anonymous publication uses the legacy text-publication RPC, which removes any named consent. Written feedback appears on review cards under "Anonymous mentee" with generic cycle title, never with name or field.
- Named publication uses the explicit named-consent RPC and shows identity, field-based cycle title and comment.
- Private uses the named-consent RPC with false, clearing both forms of text publication; stars stay visible.
- Verify transitions: private → anonymous → named → anonymous → private, including reload persistence, no accidental identity leaks and no changes to rating or immutable feedback.
- Older comments previously opted into anonymous publication must remain anonymous by default.
