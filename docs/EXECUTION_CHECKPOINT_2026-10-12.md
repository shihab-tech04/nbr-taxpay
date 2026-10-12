# NBR TaxPay execution checkpoint — 2026-10-12

## Executive status

- **Result:** PARTIAL. The local citizen preview is ready for UX review. It is not ready for live payment operations.
- **Verified baseline:** `main` at `2f06ae9ba81acb4299fd5160a603e44b472d046a`. The latest `main` matched the prompt's baseline when fetched. Its Pages workflow run `38227225367` succeeded at that SHA.
- **Working state:** branch `fix/taxpay-certificate-preview-20261012`; changes are local and uncommitted. No push or deployment was made.
- **Elapsed time:** not reliably recoverable because the execution continued across a context compaction. The 60-minute target was treated as a work budget, not a reason to certify unverified gates.
- **Release gate:** BLOCKED for production. The hosted draft-update authorization is incomplete, real payment/NBR integrations are unavailable, and the canonical story register and historical reference package could not be recovered.

## Phase acceptance register

| Phase | Implemented and evidence | Checks | Regressions/findings | Status |
|---|---|---|---|---|
| 00 Baseline | Verified repo, commit, successful Pages workflow, clean starting worktree, offline dependency install and existing design/financial boundaries. | `npm ci --offline`; baseline lint, domain tests, build and Pages citizen browser selection. | Full 387-story source register, original v11 HTML and supplied screenshot set were not available in the project mirror or Drive search. | PARTIAL |
| 01 UX/UI | Rebuilt the certificate preview around explicit non-official status, selected document type and EN/BN copy; retained the sample-print action. Added compact-menu language access and prevented input focus scroll from collapsing the citizen header. Preserved existing navigation and officer UI. Screenshots are included under `acceptance-evidence/2026-10-12/`. | Citizen public browser suite: 123 passed, 6 skipped, 0 failed (129 total); responsive review includes 320px mobile and 1280px desktop, and the certificate test checks EN/BN. | The baseline caught a 320px certificate overflow and misleading official-looking certificate content; both were corrected. The full design-system normalization and all-screen redesign requested by the prompt were not attempted in this bounded fix. | PARTIAL; ready for UX review |
| 02 Auth/DB | No schema or hosted changes. Existing owner isolation, draft and recovery behavior were preserved. Read-only hosted inspection checked migration state, policies, grants and security advisor. | Secure-workspace mock browser suite: 15 passed, 0 failed. Domain tests include owner-only draft update assertions. | Hosted project `eyqhoavnitkrajvyqvxn` is ACTIVE_HEALTHY but has 6 remote migrations versus 7 in source. `202610110001_taxpay_draft_owner_updates.sql` is missing remotely; hosted `taxpay_payment_drafts` has no UPDATE policy or authenticated UPDATE column grants. Docker daemon was unavailable, so an isolated local Supabase database run could not be repeated. | BLOCKED for hosted readiness |
| 03 Domain rules | No new legal or financial behavior was invented. The existing 170-record source catalogue and fail-closed rules were preserved; certificate copy no longer implies official credit or clearance. | Domain suite: 51 passed, 0 failed, including source-record, eligibility and payment/credit separation checks. | Current source does not establish all legal mappings or full 387-story acceptance criteria. No statutory classifications were promoted. | PARTIAL |
| 04 Integrations | Existing public preview remains backend-disabled unless explicitly configured. The implementation makes no live payment or Treasury claim. | Public backend-disabled and financial-safety browser tests passed within the 123-test run. | No authorized gateway, NBR/ACS or Treasury contract/credentials were available. | BLOCKED for live integrations |

## Story count accounting

| Status | Count |
|---|---:|
| PASS | 0 |
| PARTIAL | 0 |
| MISSING | 0 |
| REGRESSED | 0 |
| BLOCKED | 0 |
| CONFLICT | 0 |
| UNVERIFIED | 387 |
| OUT OF CURRENT CITIZEN UI SCOPE | 0 |
| **Total declared in the available execution overlay** | **387** |

The available overlay declares 387 stories and a source-register SHA-256 of `85062d15c50e7286a50176cddf97c126e931c638f0f641abe925174a871c2b9d`, but the underlying canonical register and story acceptance criteria were not present. The overlay's 22 named entries are not a substitute for that register. All 387 are therefore UNVERIFIED for this sprint's formal story-by-story acceptance; the count reconciles to the overlay declaration, but an ID-level traceability matrix cannot honestly be produced without the source register.

## Changes

- `src/components/screens/CertificatesView.tsx`: removed the government-seal/treasury-scroll/official-clearance presentation. The view now states that no official certificate is issued, varies its non-verification summary by selected type, and localizes the experience.
- `src/components/layout/CitizenNavigation.tsx`: while an input has focus, prevent focus-driven scrolling from hiding the header. Added a language switch in the compact menu so the control remains reachable after normal scrolling.
- `src/styles/taxpay-citizen.css`: styles the compact-menu language control with the existing citizen tokens.
- `tests/e2e/citizen-closure.spec.ts`: covers certificate type, non-official status and Bengali behavior.
- `tests/e2e/secure-workspace-locale.spec.ts`: covers compact-menu locale access and guards the viewport overflow check.

The certificate's illustrative payment total remains explicitly identified as example interface data and is accompanied by copy stating that Treasury settlement, credit and eligibility are not verified.

## Verification evidence

- `npm run lint` — passed (TypeScript check).
- `npm run test:domain` — 51 passed, 0 failed.
- `npm run build` — passed. Existing advisory remains: the main minified JS chunk is about 974 kB, above the 500 kB warning threshold.
- Secure-workspace mock browser checks — 15 passed, 0 failed across 320px, 375px and 1280px projects, using synthetic credentials and a reserved `.invalid` endpoint.
- Public citizen browser checks — 123 passed, 6 skipped, 0 failed across the configured 320px, 375px and 1280px projects. Skips are existing project-conditional cases.
- `git diff --check` — passed.
- Hosted Supabase checks were read-only; no SQL migration, policy, grant, row or project setting was changed. Security advisor returned 0 lints, which does not clear the identified UPDATE authorization gap.
- Existing Pages CI was verified at the unchanged baseline SHA. This does not indicate that the local changes were deployed.

## Remaining gates

1. Recover the canonical 387-story register, original v11 HTML and screenshot evidence to build the requested ID-level traceability and historical comparison.
2. Run persistence/restart/RLS checks in an approved disposable database environment. The current host's Docker daemon was unavailable.
3. Resolve hosted migration/grant readiness through the repository's approved database change process; no hosted writes were authorized or made in this sprint.
4. Obtain approved test contracts for actual payment, NBR/ACS and Treasury integrations, and authoritative legal classification evidence.
5. Review the citizen preview UX and separately accept a demo-only release scope before any deployment. Production release remains blocked.

## Backup and publication

No GitHub commit, push or deployment was made. The verified local source archive and its SHA-256 are recorded separately after Drive read-back verification. If that verification cannot be completed, the archive remains local and backup status must be treated as incomplete.

