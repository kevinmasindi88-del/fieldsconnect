# Mentor ratings — Preview QA (23 October 2026)

## Source of truth
- Extend existing `mentorship_completion_feedback` with nullable `mentor_rating`. No parallel review table.
- Count only completed mentorships where the **mentee**, not the mentor, submitted a 1–5 star rating.
- Each (mentorship, author) retains one feedback submission; ratings are read-only after submission.
- Previously submitted feedback remains intact; existing unrated submissions do not receive invented scores.
- Do not expose private feedback text or reviewer IDs via the aggregate ratings function.
- Leave Paystack paid launch disabled; mentor ratings are not coupled to paid mentorship.

## Test cases
1. Complete a free mentorship using the normal two-person cycle process.
2. As mentee, open Mentorship cycle > Completion feedback. The 1–5 star picker appears, and Submit is disabled until a star and 10+ character written feedback are present.
3. As mentee, submit a 4-star review. Verify read-only “★ 4/5” above feedback; reload and confirm persistence.
4. As mentor, open the same completed cycle. Written feedback entry shows the mentee's read-only rating, but mentor's own feedback form has no star selector.
5. As mentor, submit own final reflection. Verify no rating is added for the mentor's own submission.
6. Inspect mentor's public profile. After the mentee review, see “★ 4.0 (1 review)”.
7. Use Connections > Find people to search the mentor. Verify the card shows the same score and count inline next to “Available as mentor”.
8. Search for an unrated mentor. Verify “No ratings yet” in the public profile and Find People.
9. Verify incomplete/paused/cancelled mentorship cannot be rated and nonparticipants cannot submit ratings.
10. Test 320–414 px and desktop: stars, labels, profile header and search cards wrap without overflow.
11. Verify the mentor cannot edit submitted stars, and duplicate submissions fail.
12. Confirm mobile avatar, free mentorship, and gated paid option remain unchanged.

## Launch gates
- Preview build must be Ready, and a real two-user free mentorship end-to-end test must pass.
- SQL migration `add_verified_mentor_ratings` applied to Supabase; both old and new feedback RPC signatures remain available for legacy compatibility.
- Do not assign ratings retroactively to historical text-only submissions without the mentee's explicit input.
- Promote only the exact tested immutable Preview; record production deployment ID.
