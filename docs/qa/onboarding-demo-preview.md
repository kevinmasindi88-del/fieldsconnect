# Read-only onboarding preview

- QA-only URL: `/onboarding/preview` in the Vercel Preview deployment.
- The route returns notFound() on Vercel production.
- Route is allowed without an authenticated session so existing members can open it from a Preview URL without signing up again.
- Uses the real `QuickOnboarding` UI, with `previewMode` bypassing all user/profile/network reads, inserts, updates, acceptance RPCs and redirects.
- Fields and validation remain interactive. Submit displays a simulated completion message and never saves information.
- Real `/onboarding` continues to load actual agreement and profile data and navigates to `/timeline` after successfully saving.
- Verify both paths are distinct and the non-production route has a clear Preview-only banner, a descriptive button and no false saved-state claims.
- Confirm no payment flag, real account profile or legal agreement records are changed by the demonstration.
