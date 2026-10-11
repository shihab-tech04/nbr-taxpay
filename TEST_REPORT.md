# Test report — 2026-10-11

These results apply to the sanitized release snapshot derived from verified source commit 594109683220a132c997b2ea5d124a98ec6810b6. They are local checks, not project certification.

## Passing checks

- TypeScript: PASS — npm run lint.
- Domain suite: 48/48 PASS — npm run test:domain.
- Static Pages-mode build: PASS — GITHUB_PAGES=true with VITE_SUPABASE_DISABLED=true and hosted URL/key empty. Vite emitted the /nbr-taxpay/ asset base. The main JavaScript chunk is 943.21 kB (gzip 230.96 kB), above Vite's advisory threshold.
- Backend-disabled browser smoke: 3/3 PASS at 320px, 375px, and desktop. Auth and draft flows remain disabled in the public preview.

## Full browser regression

Command used the test suite's matching reserved .invalid host and excluded only the separately executed backend-disabled case.

- 96 tests: 77 PASS, 3 FAIL, 16 SKIPPED.
- The three failures are the same positive source-provenance assertion at mobile 320px, mobile 375px, and desktop. It expects a configured backend to return the exact 170 controlled records. The test endpoint is intentionally unavailable; the application shows its explicit read-only embedded snapshot and says the database reference could not be verified. This is an unavailable integration prerequisite, not a passing assertion, and the expected result was not changed.
- Fifteen skips require a configured local Auth/PostgREST integration service. One desktop skip is the mobile-only menu case.
- No production or hosted taxpayer/payment backend was used.

## Remaining verification

Auth/PostgREST persistence remains unresolved and is not certified. The repository's local database discrepancy remains documented in UNVERIFIED_LEGAL_AND_INTEGRATION_GAPS.md and the story execution overlay. Legal source validity and original integrated acceptance are not verified.

The target GitHub Pages URL returned a GitHub Pages 404 when opened in Chrome. No GitHub push, visibility change, workflow run, or deployment was completed because the connected account cannot read the target repository (API 404).
