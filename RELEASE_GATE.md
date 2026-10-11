# Release gate — local status

## Decision

**Not certified for production.** The snapshot is a static demonstration frontend. It does not authorize real taxpayer use, legal tax decisions, authentication, payment, treasury receipt issuance, or production deployment.

## Evidence

| Gate | Observed result |
|---|---|
| Sanitized source snapshot and independent release history | PASS locally; see the external checkpoint and bundle manifest |
| Secret scan of release source, Git history, and built assets | 0 Gitleaks findings |
| TypeScript check | PASS |
| Domain tests | 48/48 PASS |
| Pages-mode production build | PASS; large JavaScript chunk warning remains |
| Public-backend-disabled browser smoke | 3/3 PASS at 320px, 375px, and desktop |
| Full browser suite | 77 PASS, 3 backend-dependent assertions fail closed, 16 SKIPPED |
| Auth/PostgREST persistence and full local Supabase certification | NOT VERIFIED |
| Legal/regulatory source acceptance | NOT VERIFIED |
| GitHub repository access and publication | BLOCKED: authenticated API returns 404 for the target and lists no repositories for the owner |
| Public Pages website | NOT DEPLOYED; requested URL currently returns GitHub Pages 404 |

See TEST_REPORT.md for exact commands and failure details.

## Publication and use boundary

A GitHub Pages build is configured to contain only the static frontend with hosted authentication and backend access disabled. Successful local checks do not establish an actual GitHub deployment. Any later publication requires access to the intended repository and a successful remote build/deployment read-back. Production tax, payment, legal, and backend acceptance remain separate unresolved requirements.
