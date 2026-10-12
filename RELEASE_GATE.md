# TaxPay Release Gate — Static Demonstration (2026-10-12)

## Decision

**Static citizen-facing demonstration only. NOT certified for operational NBR use.**

GitHub repository access and the GitHub Pages publication workflow have been restored. The published artifact deliberately disables hosted Supabase/Auth/backend configuration and cannot take real payments, issue government challans, certify tax liability, reconcile Treasury settlement or recognize tax credit.

## Verified GitHub publication checkpoint

- Repository: https://github.com/shihab-tech04/nbr-taxpay
- PR #8: merged into `main` (adaptive Guest/Taxpayer navigation and Government Blue tokens).
- PR #10: merged into `main` at `3e6dc11c25dd1fedae7ea4eaa463e101f55c13c8` (tested citizen/financial safety baseline).
- GitHub Actions run [#38215540503](https://github.com/shihab-tech04/nbr-taxpay/actions/runs/38215540503) completed successfully, with both **Build and verify static preview** and **Publish verified static build** jobs passing.
- The expected project-site path is `/nbr-taxpay/`. An independent HTTP/browser read-back of the public Pages URL was not available in this audit environment; the successful deploy job is the publication evidence.
- Newer commits, including the final Guest/Taxpayer UX closure work, require their own successful build and main-branch deploy evidence before being described as live.

## Verified checks and boundaries

| Gate | Current assessment |
|---|---|
| Repository access and GitHub PR workflow | VERIFIED, no longer blocked by 404 |
| TypeScript and domain test execution | PASS on the cited main CI run |
| Citizen route/browser safety checks | PASS on the cited main CI run |
| Static Pages build, `/nbr-taxpay/` asset base and backend-disabled checks | PASS on the cited main CI run |
| GitHub Pages deployment job | PASS on the cited main CI run |
| Actual public URL rendered independently | NOT VERIFIED |
| Real Supabase Auth, RLS and durable taxpayer persistence | NOT VERIFIED |
| Treasury/ACS/eTDS/eReturn/eLedger authoritative integration | NOT IMPLEMENTED/NOT VERIFIED |
| Tax-law/payment-head legal source certification | NOT VERIFIED; original 170-record catalogue remains a candidate reference |
| User-identity, taxpayer-vs-payer credit ownership, correction authorization | NOT PRODUCTION CERTIFIED |
| WCAG 2.2 AA end-to-end and complete device/AT usability certification | NOT VERIFIED (targeted automated checks only) |

## Required conditions for any future operational release

Do not enable real payment initiation, trusted receipt generation, personal credit balances, taxpayer-account access, regulated tax calculations or claims of NBR endorsement until authorized source/legal acceptance, live system integrations, identity/role security, financial reconciliation and comprehensive regression evidence are independently certified.

UI/demo success must not be presented as production readiness. Preserve officer workflows in the separate Office Management product.
