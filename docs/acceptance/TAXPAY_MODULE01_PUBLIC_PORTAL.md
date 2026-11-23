# Korbritto — Module 01 public portal and access acceptance

**Status:** IN PROGRESS / not E2E certified. **Baseline:** `21057a1bde7424854fdceddb1bcf9a3fd2365c0d` (2026-11-01).

This is a release-control record for the user's sequential Module 1–16 request, not an approval of government financial operations. Modules 17–18 feature development is out of scope; compulsory security/release checks remain.

| Feature | User entry / existing source | Current evidence | Acceptance |
|---|---|---|---|
| TPAY-PUB-001 Public landing and task entry | `PublicLanding.tsx`, `PublicHeroCarousel.tsx` | Live baseline + tests; latest approved matching-first + sample-bottom public search in PR #419 | PARTIAL / pending full browser and live readback |
| TPAY-PUB-002 Guest income-tax payment | `GuestPayment.tsx`, Pay Tax entry | Frontend simulation; official ACS settlement not connected | PARTIAL |
| TPAY-PUB-003 Source-tax distinct guest entry | `GuestPayment.tsx` withholding mode | Existing route and synthetic tests; official eTDS allocation not certified | PARTIAL |
| TPAY-PUB-004 Travel-tax public entry | `TravelTax.tsx`, banner link | UI/simulated flow; official travel rates and settlement not certified | PARTIAL |
| TPAY-PUB-005 Public payment/receipt lookup | `PublicLanding.tsx`, `ReceiptLookup.tsx` | Synthetic reference and browser-session lookup; official cross-session verification adapter absent | PARTIAL |
| TPAY-PUB-006 Report a problem | `PublicReport.tsx` | UI captures category/details, then review/edit only; connected TaxPay and Office SQL catalog searches found no complaint/incident intake table or matching Edge Function. No durable submission / Office readback | FAIL for server intake; tracked cross-module M13/M14 dependency |
| TPAY-PUB-007 Public explanations and guidance | `PublicUserGuide.tsx` | EN/BN guide; stale removed CTA corrected in PR #419 | PARTIAL / pending release |
| TPAY-PUB-008 Public/private route protection | `privateRoutePolicy.ts`, `App.tsx` | Existing route safeguards, auth/RLS isolated tests; real live account isolation not certified | UNVERIFIED E2E |

## Scope and release requirements

- Preserve user-approved public homepage/hero, current signed-in/out shell, receipt modal, EN/BN/mobile layout; no duplicate fix for concurrent CMS PR #420, login PR #415/#417/#423, shared TIN PR #410 already merged, or dashboard PR #418.
- PR #419 is the focused owner of matching-first + sample-bottom public search and guide corrections. Source backup for earlier main `b98c5aa...` exists off GitHub but current `21057a1bde7424854fdceddb1bcf9a3fd2365c0d` additionally needs exact-history backup/readback before a new merge.
- GitHub's production Pages release and test checks must PASS on applicable exact heads. Hosted official NBR/ACS/eTDS financial settlement must not be fabricated.
- TaxPay/Office public incident intake and official receipt lookups remain BLOCKED until approved real backend contracts, data security, database backup and cross-app acceptance are available.
- Do not mark the module COMPLETE until each applicable feature has explicit PASS evidence. No percentage inferred from route or prototype presence.
