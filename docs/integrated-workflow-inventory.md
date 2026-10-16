# Taxpayer → SQL → Office → Taxpayer recovery inventory

Checkpoint: TaxPay recovery PR #89 and Office recovery PR #77. This inventory describes implemented code paths and their tested boundaries; it does not grant legal authority, establish an entitlement, or treat a simulated payment as a government payment.

## Source baseline

- Approved TaxPay v11 source: `NBR_Integrated_Income_Tax_Payment_Portal_Upgraded-v11(1).html`, SHA-256 `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b` (retrieved to the task workspace from the approved source set).
- The 387 source-story IDs and per-story scope, route, test, disposition, and evidence fields are preserved in [`acceptance-matrix.csv`](acceptance-matrix.csv); its status rules are documented in [`acceptance-matrix.md`](acceptance-matrix.md). There are 367 required TaxPay stories and 20 out-of-scope rows (18 Office-only stories plus `TPAY-US-E2E-012` and `TPAY-US-E2E-015`). Matrix totals are **0 deployed PASS, 147 BLOCKED, 220 UNVERIFIED**. Branch or local tests do not promote a story to deployed PASS.
- Office production baseline at recovery start: `b797d731d61dbd53bb0b44750e3a429c79a8b4a6`. Current main includes secure officer email sign-in at `00e588319e66b6c2c38ad40a162d40e4ddf55dab` (PR #78). Recovery candidate `dbd64130c1f1df528c600367ce2041192e87177a` is in draft PR #77.
- Database code references below are versioned migrations in [`supabase/migrations`](../supabase/migrations). Verification uses a disposable local Supabase instance only. The shared hosted project was inspected read-only; no production migration or taxpayer-data write was performed.

## End-to-end workflow inventory

| Workflow | Taxpayer app | SQL contract | Office app | Taxpayer return path | State |
|---|---|---|---|---|---|
| Private planning draft | Payment planning screens save and reload the authenticated owner's draft. | `202610100001_taxpay_drafts.sql` and `202610110001_taxpay_draft_owner_updates.sql`; owner-scoped RLS and restricted update columns. | Not visible to Office until the owner submits a review request. | Owner reads the draft after reload; another account must not read or change it. | Implemented; disposable Auth/RLS and browser persistence checks are in Phase 02 CI. Not deployed from the recovery PR. |
| Non-financial review request | [`SharedReviewRequests.tsx`](../src/components/screens/SharedReviewRequests.tsx) submits a saved plan, requires SQL readback, reloads status, and marks the owner's in-app notice read. | `202610130001_taxpay_nonfinancial_review_sync.sql` defines `taxpay_payment_requests`, officer roles, decisions, events, notification recipients, owner/officer RLS, constrained status transitions, and `taxpay_record_officer_review` idempotency. Receipt and credit statuses are constrained to `NOT_VERIFIED`; `processing_mode` is `NON_FINANCIAL_REVIEW`. | [`OfficeReviewQueue.tsx`](https://github.com/shihab-tech04/NBR-Officemanagment-UI-V2/blob/dbd64130c1f1df528c600367ce2041192e87177a/src/app/pages/payments/OfficeReviewQueue.tsx) requires an authenticated session and active database role, offers only valid actions, and confirms the RPC with a fresh SQL readback. | The owner reloads the request status, event-linked notices, and read marker from SQL. | Implemented for non-financial intake. Exact local Auth/PostgreSQL cross-app run `38897874522` passed owner isolation, active-role checks, idempotency, transitions, events, notification readback, reload persistence, and the real React journey at TaxPay `e441c2d` with Office `dbd6413`. Production acceptance remains unverified. |
| Fictional payment simulation and three-officer review | The taxpayer can create a clearly marked local simulation with synthetic payer/beneficiary IDs. | `202610130002_atomic_simulated_payment_ledger.sql`, `202610130003_simulated_officer_review.sql`, `202610130004_sim_private_profiles_lifecycle.sql`, `202610130005_sim_bound_account_isolation.sql`, `20261013061400_lock_legacy_anonymous_simulator.sql`, and `20261013061821_restrict_unbound_sim_readers.sql` keep simulation rows and actions under `sim_*`. The officer RPC enforces MAKER → REVIEWER → APPROVER, distinct authenticated officers, valid transitions, idempotency, audit events, and recipient notices. | [`SimulatedOfficerReview.tsx`](https://github.com/shihab-tech04/NBR-Officemanagment-UI-V2/blob/dbd64130c1f1df528c600367ce2041192e87177a/src/app/pages/payments/SimulatedOfficerReview.tsx) is explicitly a synthetic workflow; status/readback uses the simulation RPCs. | Taxpayer history and notifications read back synthetic state only. The test verifies state remains `SIMULATED`, rows remain `simulation_only`, and no statutory credit is created. | Run `38897874522` passed the real TaxPay and Office UI simulation, beneficiary notice readback, three distinct officer audits, persistence across restart, and no-entitlement assertions. This is a simulation, not financial settlement, Treasury evidence, a challan, credit, refund, or official review decision. |
| Actual payment settlement, challan, Treasury posting, or tax-credit entitlement | TaxPay public flows link to official payment/collection services where configured. | No authoritative payment gateway or Treasury posting contract is connected in this recovery. `sim_*` is not a substitute. | No Office integration may create or certify a financial entitlement through the recovered review queue. | No official settlement or credit readback exists in the recovered integration. | **Missing / blocked** on authoritative service/API access, approved integration contract, and authorized test fixtures. Do not infer law, payment, or entitlement. |
| Correction, investigation, offline evidence, and other Office modules | The v11 story set describes broader taxpayer and officer journeys. | The current `taxpay_*` review contract is explicitly non-financial and is not an investigation or correction ledger. | Most administration, PSR, returns, case/financial, and audit screens have no connected production API. The recovery audit found 30 proposed GET wrappers in five endpoint files, no authoritative OpenAPI/API contract, and zero production UI imports. | No verified SQL-backed return path for these broader modules. | **Missing / blocked** until authoritative API/schema, role, audit, and business rules are supplied and approved. The v11 cross-role stories `TPAY-US-E2E-010` and `TPAY-US-E2E-011` remain blocked for the separate Office/investigation steps; `E2E-012` and `E2E-015` are out of current TaxPay scope per the matrix. |

## Status by release environment

### Already working in the recovery candidate / disposable environment

- Private draft persistence, owner isolation, authenticated readback, and reload.
- Taxpayer submission → SQL non-financial request → authenticated Office review → SQL event and notice → taxpayer status/notification readback.
- Duplicate request protection, idempotent retries, role/state enforcement, cross-user isolation, audit history, and notification recipient isolation in the non-financial contract.
- A separate `sim_*` three-officer workflow with synthetic identities and synthetic payment data only.

These are branch-level behaviors. The source acceptance matrix remains at zero deployed PASS until the exact candidate is deployed and live acceptance is recorded.

### Broken on the currently observed production checkpoint

- Live TaxPay main still exposed demo receipt records and Treasury-style sample identifiers in the public receipt lookup; the recovery branch replaces those with non-issuance labels and official-service links.
- Live TaxPay main still exposed the old Office login action. The recovery branch removes that Office route from TaxPay; Office PR #78 supplies the current registered-email sign-in flow.
- These fixes are not live until their PRs pass gates, merge, deploy, and the deployed commit is verified.

### Missing

- Authoritative ACS/iBAS/Treasury settlement, receipt verification, and tax-credit integrations.
- Production API/schema contracts and verified persistence for the broader Office modules listed above.
- Independent business approval of any jurisdictional authority, legal rule, entitlement, or production officer assignment beyond the explicitly seeded disposable test roles.

### Unverified

- Positive authentication and end-to-end journeys using an owner-approved production test identity.
- Recovery candidate deployment, deployed-commit verification, and critical live journeys.
- Independent Register-4 information/visual acceptance, changed-path scope approval, and a browser-accessible hosted recovery preview.
- The remaining 220 story rows in the matrix, plus the 147 stories blocked by missing authority, integrations, accounts, or approvals.

## Verification references

- Cross-app test definitions: [`taxpay-office-complete-local.spec.ts`](../tests/e2e/taxpay-office-complete-local.spec.ts), [`taxpay-office-private-review-local.spec.ts`](../tests/e2e/taxpay-office-private-review-local.spec.ts), [`nonFinancialSync.mjs`](../tests/integration/nonFinancialSync.mjs), [`simOfficerReview.mjs`](../tests/integration/simOfficerReview.mjs), and [`simPrivateLifecycle.mjs`](../tests/integration/simPrivateLifecycle.mjs).
- Exact disposable Auth/PostgreSQL verification at TaxPay commit `e441c2d10805fe4494dc62be643e7c66f7b99e12`, Office commit `dbd64130c1f1df528c600367ce2041192e87177a`: [Phase 02 run 38897874522](https://github.com/shihab-tech04/nbr-taxpay/actions/runs/38897874522) passed; no hosted Supabase project was linked or changed.
- Exact workflow pin: [`.github/workflows/phase02-local-supabase.yml`](../.github/workflows/phase02-local-supabase.yml) checks out the Office candidate by immutable commit SHA and refuses hosted endpoints.
- Running test evidence and remaining defects: [`failure-register.md`](failure-register.md) and the GitHub Actions checks linked from PR #89.
