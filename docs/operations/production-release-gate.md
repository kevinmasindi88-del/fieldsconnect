# FieldsConnect production release gate

## Canonical source and domain
- Public production domain: `https://fieldsconnect.app`. `www.fieldsconnect.app` redirects to the apex.
- The GitHub default `main` branch is historical and **must never be treated as current production**.
- Start each release branch from the **Git commit SHA currently serving `fieldsconnect.app`**, not `main` or a guessed branch.

## Safe release procedure (required)
1. Query the Vercel production alias for `fieldsconnect.app` and resolve its deployment SHA.
2. Make changes on a branch created directly from that SHA.
3. Before deployment, compare the current production SHA with the candidate SHA using GitHub compare. Require a fast-forward descendant (`behind_by === 0`, `ahead_by > 0`, and merge-base equal to the verified live SHA). **Reject divergent or older commits.**
4. Validate the candidate on Vercel preview: build succeeded, TypeScript passed, and no important errors.
5. Build the candidate with production environment and **do not let that automatically replace the custom production domain**. Vercel's `autoAssignCustomDomains` is deliberately disabled.
6. Re-read the live alias immediately before promotion. If production changed, abort and reconcile first.
7. Manually assign/promote the checked production build to the custom domain(s); verify both the apex and `www` redirect and check runtime logs. Restore `autoAssignCustomDomains: false` if a promote API call re-enables it.
8. Record the live deployment ID and SHA in the release notes / follow-up.

## Client updates
- AppShell compares its embedded build identifier against the `no-store` `/api/app-version` endpoint at startup, app resume, network reconnection, and periodically.
- A newer release triggers automatic URL-busting navigation without a prompt. If an unsent form draft exists, refresh is deferred until the draft is cleared; no draft should be lost to an automatic reload.
- Install the PWA **only from `fieldsconnect.app`**, not immutable preview/deployment `.vercel.app` URLs. A PWA installed from a specific deployment URL cannot be made evergreen by later updates to the production domain; it must be installed from the canonical domain.
- Avoid caching HTML and API version responses in service workers. The `public/sw.js` push handler currently has no fetch handler.

## Limitation
This gate prevents **automatic** alias replacement by older Git branch builds and blocks unverified releases in our managed workflow. An authorized administrator can still deliberately reassign aliases, enable auto-promotion, or roll back in the Vercel dashboard. No application-level protection can make an external administrative override impossible.
