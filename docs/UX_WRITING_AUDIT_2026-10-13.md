# TaxPay — Full UX-writing source audit and copy cleanup

**Audit date:** 2026-10-13 (UTC)  
**Controlled source:** `shihab-tech04/nbr-taxpay` `main` `a5cc77c79b169b9e46d370b6f52449f076ceb391`  
**Change branch:** `ux/copy-audit-trim-clutter-20261012`  
**Status:** IMPLEMENTED IN REVIEW — NOT CERTIFIED OR LIVE until exact-head CI and Pages read-back.

## Audit question
Remove unnecessary, repeated technical, prototype and limitation prose. Make navigation, pages, forms, cards, errors, empty states and notices short, human-readable and consistent in English and Bangla, without asserting any non-existent real payment, official taxpayer identity or government credit.

## Source-based screen inventory and action

| Surface / exact source | Source audit | Change or handling |
|---|---|---|
| `PublicLanding.tsx` | Five repeated demo/prototype explanations across hero, status panel, services and lookup | Condensed hero, one status panel, shorter steps and service/lookup copy; retained compact no-money status |
| `TaxpayerHome.tsx` | Exact long paragraph flagged by stakeholder; duplicated balance, credit and profile caveats | **Removed** the quoted paragraph, verbose balance-details section and repeat activity warning; preserved unavailable/unknown fields and sample identity |
| `TaxpayerDashboard.tsx` | Long backend inventory, legal-credit teaching details and per-quarter explanations | Condensed status fields; no fabricated official balances |
| `TaxLedger.tsx` | Five overlapping “fictional”, “sample”, “not credited” strings | Kept sample label, readable summary, clear not-an-account-statement cue; removed repeat essay |
| `TaxJourney.tsx` | **SEVERE**: hard-coded “COMPLETED”, “SCROLLED”, legal duties, date of tax payment and deadlines presented as taxpayer milestones without evidence | Replaced fabricated lifecycle timeline with available tax-service navigation; no invented dates, obligations or credit |
| `PaymentHistory.tsx` | Intro repeats example-record state and status captions | Shortened copy, retained sample identity in header and export file |
| `GuestPayment.tsx` | Repeats “simulation”/“demo” on title, steps, hints, review and success | Shortened bilingual form copy; retained explicit *no funds / no official challan* review state and simulation action |
| `PaymentWizard.tsx` | Prototype language in stepper, labels, hints and review paragraph | Shortened EN/BN; retained no-money/official-document warning and blocked-head behavior |
| `TravelTax.tsx` | Multiple long warnings, stale prototype language | Shorter EN/BN copy; kept legally necessary explicit rate/exemption unverified status and travel-clearance warning |
| `CertificatesView.tsx` | Three repeated no-issuance warnings in one document preview | Kept visible no-official-certificate issuance notice and preview title; removed duplicate notice blocks |
| `ReceiptLookup.tsx` | Long disclaimers and urgent real-world transaction instruction linked to in-app demo incident handling | Shortened English search/results; replaced misleading urgent direction with payment provider first |
| `ConnectedServices.tsx` | “Not connected” badges plus repeated absence explanations and “last sync never” | Concise capabilities and factual status fields |
| `GuidanceAssistant.tsx` | Technical paragraphs on disabled estimator and legal readiness, multi-sentence FAQs | Concise EN/BN answers; calculator remains unavailable until verified parameters, no guessed law |
| `AccountCenter.tsx` | Developer terms, multi-clause limitations repeated in profile/settings/notifications | Shorter bilingual copy, accurate email account vs eTIN boundary and no official notice inference |
| `secureWorkspaceCopy.ts` / `SecureWorkspace.tsx` | PostgreSQL/Supabase details and repeated non-payment qualifications | Rewrote copy data only; kept auth, RLS, draft owner read-back, error/fail-closed gates unchanged |
| `CitizenNavigation.tsx`, `TaxpayerReferenceRail.tsx`, `CitizenFooter.tsx` | Repeated “independent demonstration” branding and modal warning paragraphs | Shortened headings and footer; kept single visible no-real-payment statement and sample-role label |
| `ReceiptView.tsx` | Printed bank-style financial artifact with deliberate unofficial/simulated evidence marks | **KEEP** extra document-safety labels because printable receipts must not be passed off as government instruments |
| `HeadCatalogue.tsx`, `SourceChangeProposals.tsx`, `CorrectionInquiries.tsx` | Legal source control, proposed changes and financial correction review | **KEEP** essential review/approval states; technical copy may be further reduced only without altering evidence controls or approval meaning |
| `NotificationsView.tsx` | Previously embedded fictional official-demand events | Already corrected in PR #19 to owner-scoped draft activity; no further fake notices |
| `ReceiptView.tsx`, `PaymentDetailView.tsx`, `TaxpayerHome.tsx` status components | Risk that “success” or illustrative treasury/credit could imply real payment | Keep sample/unknown/unavailable status semantics, do not rename to real paid/credited |
| Officer screens `OfficerHome`, `Taxpayer360`, `PaymentSearch`, `CorrectionQueue`, `CaseManagement`, `IncidentInvestigation`, `OfflineEvidence`, `AuditTrail`, `IntelligenceScreen`, `MonitoringScreen`, office layout/auth components | Separate officer workstream; scanned for prominent prototype/disclaimer strings, source tree inspected | No unrequested Officer redesign, role change or production workflow mutation. Complete officer UX wording certification remains separately pending |
| `src/data/mockData.ts`, `src/services/taxState.tsx` | Fixture-backed sample taxpayer, ledger, receipt records | Preserved fixtures; audit prevents unverified data becoming financial entitlement |

## Copy rules enforced
1. Page header = function or task. Avoid paragraphs about the developer, platform or what is not wired up.
2. Use actions (“Review”, “Search”, “Save”, “Retry”) and predictable, useful empty states.
3. Show an unavailable state rather than fabricated balance, due date, clearance, credit or successful payment.
4. Keep one short warning where required at financial decision/preview stage and conspicuous unofficial identification on printed documents.
5. Show real error causes and retries without exposing technical implementation internals.
6. Preserve EN/BN meaning and layout; do not translate source statute or invent conditions.
7. No changes to Guest/Officer workflows, payment rules, SQL, Auth authorization, RLS, backend config, blocked head IDs 5/150 or data fixtures.

## Test map (never claim archived PASS as new results)
- Existing 51 domain tests and financial safety/navigation/Guest/Taxpayer accessibility regressions.
- `tests/e2e/ux-writing.spec.ts` expressly checks removal of flagged taxpayer copy, no fictitious legal timeline, concise empty/state labels and essential no-payment/unknown statuses in EN/BN.
- `tests/e2e/payment-review-release.spec.ts` stays intact in its behavioral and financial assertions; literal expected phrasing updated to equally truthful, shorter copy.
- `tests/e2e/public-financial-safety.spec.ts`, `taxpayer-reference-design.spec.ts`, `taxpayer-account-center.spec.ts` and real local `secure-workspace-real-local.spec.ts` updated for approved copy; original security, owner-scoped and non-payment controls still tested.
- `.github/workflows/pages.yml` now **executes** focused copy and payment-review tests on PR, not merely adding dormant tests.
- Local disposable Supabase Auth + ownership/restart tests must also pass.
- No pixel-perfect or WCAG full certification claimed from source reading.

## Remaining honest limitations / risks
- Public Pages is backend-disabled, so real account settings and private notifications cannot be claimed operational on that public host. UX writing changes are not a backend activation.
- `ReceiptLookup.tsx` and some legacy Officer screens remain predominantly English; separate complete EN/BN coverage would need execution evidence before PASS.
- Distinct externally-controlled payment processing, verified income-tax rates, real eTIN, official Treasury posting, ledger credit and certificate issuance are unavailable; do not disguise that with wording.
- The legal source catalogue and correction proposal labels require provision-specific review before changing legal-state semantics.
- No actual user-attended screen reader or screenshot-diff acceptance has been executed in this source audit.

**Release gate:** PASS only after final PR head CI succeeds, safety assertions remain at least as strong, and the exact main deployment completes with live URL read-back.
