# TaxPay Phase 02 — controlled release and verified evidence (2026-10-12)

## Public publication boundary — mandatory

**The public website is an independent, backend-disabled demonstration, NOT an operational NBR system.** The GitHub Pages workflow always uses `VITE_SUPABASE_DISABLED=true`, an empty Supabase URL and an empty browser key, and checks that no hosted Supabase project URL or synthetic taxpayer data are bundled. No hosted private accounts or payment services are enabled by source-code deployment.

Preserve Government Blue, accepted Guest payment-first and mobile Taxpayer navigation, floating Pay action, EN/BN layouts, payment-head fail-closed rules, Office Management separation and current UI. Do not publish real authentication, taxpayer records, payment processing, ACS, Treasury, official challans, eTIN ownership inference or financial credits.

## Published GitHub source and real Pages read-back

- Repository: https://github.com/shihab-tech04/nbr-taxpay
- Merged Phase 01 citizen UX: PRs #8, #9, #10 and #11.
- Phase 02 implementation: PR #12, merged as `87e557214ab2e40bfbbbed65f0b27b33191c21cb`.
- `main` GitHub Actions [run 38221709411](https://github.com/shihab-tech04/nbr-taxpay/actions/runs/38221709411): both static build and Pages deployment **SUCCESS**. Deployment log confirms HTTP read-back of HTML and `/nbr-taxpay/assets/` on https://shihab-tech04.github.io/nbr-taxpay/.
- Exact public release beyond this commit must be verified from its own merged SHA, CI and publication logs. A working PR is not proof that changes have gone live.

## Executed isolated Supabase acceptance — distinct from the public release

- [Run 38220816892](https://github.com/shihab-tech04/nbr-taxpay/actions/runs/38220816892) on PR #12 exact head `4c7ac42e07314f604b1f695fa9fc512d6e092bbc`: **SUCCESS**. Disposable local stack applied seven SQL migrations; owner UPDATE policy and five limited UPDATE columns read back. Real Supabase Auth/PostgREST requests for two synthetic application users passed ownership, RLS, status-lock, separate direct PostgreSQL read-back, UI create/edit/conflict/delete, and account isolation. Following a real stop/start, both accounts reauthenticated and exact synthetic draft IDs survived through API and independent SQL.
- [Run 38226080937](https://github.com/shihab-tech04/nbr-taxpay/actions/runs/38226080937) on Phase 02 verification PR head `8b2f9a6534c5f5eb82002e2b2095bbde08793e78`: **SUCCESS**. Real local email Auth request, disposable Mailpit delivery, single-use magic-link verification, original secure-workspace return path and Auth identity read-back passed; the local draft persistence/restart suite passed again. No hosted service was linked or changed.
- These are synthetic, isolated acceptance results. An HTTP success alone is never equivalent to persistent PostgreSQL read-back or official taxpayer identity.

## Open gates and exact limitations

| Gate | Classification | Explanation |
| --- | --- | --- |
| Approved Guest/Taxpayer public demonstration | PASS | Backend disabled; Pages publication and read-back verified |
| Disposable Auth, RLS, two-owner private draft CRUD and restart | PASS | Real local tests above; no fake financial submissions |
| Local magic-link receipt, verification, one-use replay denial | PASS | Run 38226080937 |
| Hosted Tax Payer Payment project `eyqhoavnitkrajvyqvxn` | BLOCKED | Its six remote migration identities are not reconciled to seven repository versions and the owner UPDATE policy/grants are absent. Read-only inspection does not authorize writes |
| Previous Mac HTTP versus independent PostgreSQL row discrepancy | NOT VERIFIED | New controlled local test cannot reproduce it; exact root cause on the original Mac is unknown |
| Production taxpayer identity/eTIN binding, official payment heads, ACS/Treasury, challan, tax credit | BLOCKED | Outside the approved Phase 02 release; no external authorization or authoritative integration |
| Complete human-assistive accessibility certification | NOT VERIFIED | Targeted automated responsive, focus, EN/BN checks do not establish full WCAG 2.2 AA conformance |

Source IDs 5 and 150 remain blocked and non-executable. No payment, Treasury or official ledger posting is permitted.

**Deployment decision:** publish only verified, safe Phase 02 frontend/source-test/document changes through the existing disabled-backend GitHub Pages workflow after exact-head CI. Keep actual backend activation limited to an approved isolated environment and never represent the public site as a live secure taxpayer account system.
