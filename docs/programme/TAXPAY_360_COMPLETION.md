# Korbritto 360° requirements traceability — 2026-10-30

> **Status: provisional and incomplete.** The exact 387-story backlog has been recovered and full-byte checksum-verified. The file now carries source rows and per-ID assessment fields, but it is not the fully reconciled, approved catalogue and does not certify implementation, testing, legal validity, or production behavior. No whole-program completion percentage is reported.

## Current repository and release checkpoints

- TaxPay `main`: `61a7fd4957d24e33790852881e937f3a402d7b0a` (ref independently refreshed for this PR).
- Office Management `main`: `ba2d0b60070d5bde1b2f598607329e10e11f3307`.
- TaxPay issue [#230](https://github.com/shihab-tech04/nbr-taxpay/issues/230) remains open; refreshed 2026-10-30T20:42:37Z (61 comments). Latest comment [#6533053327](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6533053327) protects WS01-owned Beneficiaries files: stale #296/#303/#298 branches would each delete the same 16 paths, while draft replacement #345 is based on current main `61a7fd4957d24e33790852881e937f3a402d7b0a` and changes only `src/App.tsx`, `src/components/screens/ReceiptLookup.tsx`, and `tests/e2e/navigation-integrity.spec.ts` (0/16 paths). The comment reports WS05 source/test review PASS and no merge/deploy. A refreshed exact-head Actions snapshot for #345 shows Phase 02 #41124724223, source recovery #41124724347, and receipt recovery #41124724819 succeeded; Pages/browser #41124724305 remains in progress at the public-routes/disconnected-backend step. Earlier comment [#6532939973](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532939973) reports #343 checks/WS05 review PASS with hosted correction-release blockers. Comment [#6532853968](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532853968) reports Pages deployment/readback but a red main workflow from the stale WS01-owned assertion; no payment was submitted. These are checkpoint reports, not per-story acceptance or WS02 live tests. Issue #230 remains the release controller for TaxPay ↔ SQL ↔ Office parity and production gates.
- Beneficiaries PR [#341](https://github.com/shihab-tech04/nbr-taxpay/pull/341) merged at `f4663ccc241490825c69ed88ce90594111f61f45`; compare confirms current main is 4 commits ahead and 0 behind, so the merge remains an ancestor. PR #341's body records its original verification boundary. Later WS05 issue comment [#6531873727](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6531873727) reports a successful Pages publish/readback and live Beneficiaries entry/form check in EN/BN, with no form submission. It also says the overall Actions run remains red because `scripts/verify-live-public-auth.mjs:75` still expects the removed `Add single` control. WS02 did not re-run this check and did not edit WS01 files.
- The exact current-main tree at `61a7fd4957d24e33790852881e937f3a402d7b0a` has 147 paths beneath test directories; path presence is not test evidence. WS02 ran no tests. The checked-in `TEST_REPORT.md` blob `b89e83137fc9980a3c9266f8ef57df18d6bcf106` is dated 2026-10-11 and applies to commit `594109683220a132c997b2ea5d124a98ec6810b`, not current main. `RELEASE_GATE.md` blob `75d871ad07800fc3297a2d17f1234907e5620cce` is dated 2026-10-12, with its publication boundary updated 2026-10-16; it is historical context, not current-main proof.
- The current `FEATURE_PARITY_v11.md` (blob `93c0be6e4779e81380d8e759058dfe77011530ce`) explicitly says it is a route-to-source index and does not certify feature completion, legal correctness, integration, or production safety.

## Recovered source layers

The draft adds [`docs/programme/CANONICAL_TAXPAY_REQUIREMENTS.json`](./CANONICAL_TAXPAY_REQUIREMENTS.json) as a provisional source matrix. It keeps these layers separate:

| Source layer | Recovered content | Boundary |
|---|---|---|
| 387-story backlog | `NBR_TaxPay_360_End_to_End_User_Stories_v1_0_2026-10-10.json`, Library ID `libfile_8fd144ac3c8881919b4048d5c1dfa3a7`; full-byte SHA-256 `85062d15c50e7286a50176cddf97c126e931c638f0f641abe925174a871c2b9d` matches `docs/STORY_EXECUTION_OVERLAY_v1.json` at main (`61a7fd4957d24e33790852881e937f3a402d7b0a`, unchanged blob `7ee45b671cd735dff270e6df74b740a33a81ab32`). It parses to 387 unique stable story IDs. | The source declares `DRAFT_360_USER_STORY_BACKLOG_NOT_IMPLEMENTATION_OR_LAW_CERTIFICATION`; each source story is `DRAFT_NOT_IMPLEMENTATION_CERTIFIED` with `test_status: NOT_RUN`. Recovery verifies source bytes and IDs only. |
| 150-feature baseline | `NBR_TaxPay_Feature_Master_Register_v1_1_Source_Studied_2026-10-10.json`, Library ID `libfile_046595f225dc81918c3d613aa9ec77bf`; full-byte SHA-256 `e5a101a254f3a15ce110c2e555298c4d5690432e98374db88f101537c2a9d5bc`; 150 stable feature IDs across 18 modules, plus 40 prototype-semantic crosswalk rows. | The register declares `SOURCE_STUDIED_FEATURE_BASELINE_NOT_STORIES_NOT_LEGAL_CERTIFIED`. It is separate from the story backlog and cannot substitute for story acceptance or legal approval. |
| Story execution overlay | Current main `docs/STORY_EXECUTION_OVERLAY_v1.json`, blob `7ee45b671cd735dff270e6df74b740a33a81ab32`; 22 historical entries. | Limited overlay; its default is `DRAFT_NOT_TESTED_NOT_CERTIFIED`. Its statuses are retained as historical evidence, not promoted to current acceptance. |

The recovered story source links **369 story rows** to all **150 feature IDs** by exact `feature_id` equality. The other **18** are cross-role E2E stories with no `feature_id` in the source; the matrix leaves them unmapped. These are source crosswalk counts only, not acceptance counts or a completion denominator.

The feature register's raw `story_status: NOT_YET_AUTHORED` field is preserved inside its 2026-10-10 source record and repeated as `story_status_in_feature_register_as_of_2026_10_10`. It is historical baseline metadata, not a current story status; the 369 verified links come from the separately recovered story source.

## Byte-verified v11 prototype copies and source limits

Four Library copies of `NBR_Integrated_Income_Tax_Payment_Portal_Upgraded-v11.html` were materialized and full-byte SHA-256 checked by the WS02 coordinator. Each is 860,546 bytes and hashes to `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b`, matching the v11 hash already recorded in the recovered story source-control metadata.

| Capture date | Library file ID | Size | SHA-256 |
|---|---|---:|---|
| 2026-10-10 | `libfile_78ddfcb3fb9481919adb18f5467fd2a4` | 860,546 bytes | `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b` |
| 2026-10-11 | `libfile_8f7bf5933d18819187f134c8de9e7d77` | 860,546 bytes | `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b` |
| 2026-10-13 | `libfile_2c6688cf80508191a27a4022a6b3b3ce` | 860,546 bytes | `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b` |
| 2026-10-24 | `libfile_563c64b3f1d88191bdc9db3deb0bd7d8` | 860,546 bytes | `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b` |

Library text identifies the title as **Concept Prototype**. Its embedded ontology declares version `0.6.0-demo` and status `DRAFT — prototype scope only. Not an NBR-approved data standard.` The prototype's changelog says 170 active payment-head records came from an ACS section workbook, with a group-level crosswalk; it also says the screenshot-based ACS sample was removed. These are claims inside a draft demo. They do not prove that the workbook bytes or chain of custody were supplied, that the catalogue is legally valid or NBR-approved, or that original screenshots are available.

The original ACS workbook bytes/provenance, original screenshots or approved visual baselines, and legal/owner approval were not recovered or verified in this update. The existing official-accounting and per-story acceptance blockers remain. The copies add no requirement IDs, do not change the 387-story or separate 150-feature source counts, and do not create a completion percentage.

## Contemporaneous 2026-10-10 archive and design boundaries

Two Google Drive JSONL source archives were recovered and checked file by file. The LIVE_PRE_PHASE1 archive (Drive document [1fPkgxV04qJOkdJF4t_Z9hA2-QArsdf933PQs4NZHGMw](https://docs.google.com/document/d/1fPkgxV04qJOkdJF4t_Z9hA2-QArsdf933PQs4NZHGMw/edit), revision `AHj4eMT2bQhzcmBSo_bis0KkJSyNkPyzH7IetMEA-uyVoDc31mr6ArpOWvXGwp9iQmoQDsf-hDoaiYjLkeeT8LiOV8ZioL29R3oAP_5s1Uwr`) declares source commit `ddcf4bdfe892b4e9968fe5b95d18102674d229c2`, 65 files, and 531,868 source bytes. The PHASE1_CANDIDATE archive (Drive document [1aVkjaOHeJz-fIPTbgKVWukW_VVjSxTxe1WwL8Issc4o](https://docs.google.com/document/d/1aVkjaOHeJz-fIPTbgKVWukW_VVjSxTxe1WwL8Issc4o/edit), revision `AHj4eMQ85yGVgGFIlk5jPiHDSelD_lBldaZSmuyZ7QG8trsNy5lCEfm3AGBgsIUN92XYms_isvGR7VJPuKu5esZXLGP0saJoaOcRG5jJSKrl`) declares source commit `3c28a535fdbadc45cf91fbf1ecaa38db74cb45bc`, 85 files, and 869,217 source bytes. Recomputed Git blob SHA-1 checks matched all 65 and all 85 file records respectively, and the UTF-8 byte totals matched each manifest.

| Archived file | Exact archived blob SHA-1 | Recoverable boundary |
|---|---|---|
| `docs/STORY_EXECUTION_OVERLAY_v1.json` | `de9dfcfb3215ff94a0200d78eca06fe0ff6e8218` | This 14-entry historical overlay sets `status_default: DRAFT_NOT_TESTED_NOT_CERTIFIED` and `release_gate: DRAFT_PR_NO_AUTHENTICATED_E2E_NO_PRODUCTION_CERTIFICATION`. It points to the separately recovered 387-story source and its recorded SHA-256. It is not the current-main 22-entry overlay. |
| `docs/STORY_CAT002_SOURCE_INTEGRITY.md` | `d2a3d95d7dcda1da449dffde11a56b19b2feb73b` | The official `ACS_Section List.xlsx/R_NBR_LAW` workbook was not supplied; IDs 5 and 150 remain `OWNER_REVIEW`. It does not infer approval, legal validity, executable rates, payment success, Treasury confirmation, eLedger credit, or NBR authorization. |
| `docs/INITIAL_INDEPENDENT_AUDIT_2026-10-10.md` | `28d879274370c7e795acf8554d915c820f1b186d` | Source review only; concludes `DRAFT / PARTIAL — NOT CERTIFIED`, says law/integration/parity are not certified, and does not claim fresh test or release certification. |
| `RELEASE_GATE.md` | `9b740e786d794a0769ab15ff9e3bbb8f87342a0e` | Includes historical PASS and staging-approval assertions, but its independent-review notice says those claims are unverified; read together with the audit, they are not acceptance evidence. |
| `docs/UX_AGENT_DESIGN_SYSTEM_CONSTITUTION.md` | `bd20b72ddbb906fd8ff8a650d27edcde75623720` | Historical design criteria record Manrope/Fraunces/IBM Plex Mono/Noto Sans Bengali, the emerald/amber/slate palette, 320/375/768/1280 responsive gates, EN/BN parity and accessibility requirements. The file explicitly says it is a review constitution, not proof that an independent external agent ran. It is not design approval or proof that those gates passed. |

The archives’ JSONL manifests explicitly say **no Git history** is included. The verified SHA-1 values establish that each recovered payload matches the blob ID recorded in the archive; the manifest-declared commit IDs and archive authorship/ancestry were not independently authenticated. The legacy repository is still inaccessible through connected GitHub access (HTTP 403, suspended account). These archives strengthen historical source traceability but do not establish current per-story acceptance, approval, legal validity, deployment state, or production readiness.

## Per-record assessment and status rules

Each story, feature, and semantic crosswalk row keeps its complete raw source record and has a normalized assessment object. The assessment includes approval source, latest decision, supersession, UI/route/service/API/SQL/Office mappings, current TaxPay and Office main SHAs, test evidence, production evidence, owner, regression history, and blocker references. Null values mean no per-record evidence was found; the blocker catalog names the missing evidence or mapping.

Normalized status values use only the allowed enum: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `TESTED`, `LIVE`, `BLOCKED`, `REGRESSED`, and `SUPERSEDED`. Every story and feature row is currently `BLOCKED` because per-ID approval/currentness and current implementation, test, ownership, and production mappings are not established. This does not assert that every feature is unimplemented.

The master prompt attachment `upload/Pasted text(20261030-193011).txt` §5.B (lines 244–249) names the known conflict topics: older guest-payment entry rules; Beneficiaries authentication; older logos; earlier homepage layouts; old demo-specific UI content; and older receipt implementations. Section §5.F (lines 561–566) requires one reusable receipt/certificate template, retains Download and Print, and prohibits reintroducing rejected panels, unrelated actions, redundant copy, or demo disclaimers. The approved project-memory summary supplied to WS02 contains the latest Korbritto decisions. The matrix records these decision topics as `SUPERSEDED`, but affected stable-ID lists remain empty and per-ID mapping is `BLOCKED` because the exact versioned change artifacts/crosswalk are not available. No replacement requirements are inferred.

## Acceptance and historical evidence boundaries

The 387-story requirement source is recovered; **per-story acceptance evidence is still unavailable**. The separate 150-feature source register remains a feature baseline, not a substitute for the 387 story records. The source declares every story draft and `test_status: NOT_RUN`. The 2026-10-15 audit `NBR_TaxPay_Comprehensive_Deep_Audit_2026-10-15.md` (Library ID `libfile_cbe6744b6b7c819196eafb4b8271b20c`, including its 18-master-group matrix and lines 50/270 acceptance boundary) records all 387 story acceptances unverified at that historical checkpoint. The 2026-10-14 release-truth audit (Library ID `libfile_4ed602f70b508191a3448182bdad60bb`) is also historical, not current verification.

The backlog and feature register reference legacy repository `shihab2-tech/NBR-Tax-Payment`, commit `a5584ca7b19000f5d239cf049d32a0993f5cffac`. Connected GitHub access returned HTTP 403 with a suspended-account response. The two recovered Drive archives provide hash-verified historical files but no Git history; their declared commits and ancestry remain unauthenticated, and the exact prior approval/change history is still incomplete.

## Historical 2026-10-15 module snapshot

These are the 10/15 audit's historical results only; they are not current per-story acceptance.

| Module | Historical audit result |
|---|---|
| PUB, IDN, TRS, LDG, TAX, COR, KNW, UX | Partial |
| CAT | Partial; legal-source blocked |
| OBL | Blocked |
| PAY | Partial; real processing blocked |
| WHT | Partial; real deductee credits blocked |
| TVL | Partial; official rates blocked |
| RCP | Partial; official proof blocked |
| INC | Partial; officer partition required |
| OFF | Separation failed |
| PLT | Partial; production finance blocked |
| QAG | Partial; no authoritative story/visual gate |

## Current release-control evidence

Issue #230's comments provide stakeholder-reported release evidence, not a WS02 re-test:

- Comment [#6531873727](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6531873727) reported its then-current TaxPay/Office SHAs (`f4663ccc` / `ba2d0b6`), Pages publish/readback and Beneficiaries entry/form behavior, and said correction migrations/readback contracts were not installed, hosted bridge functions lagged source, there were zero active Office officer roles, and correction review/notification round-trip were not live. This is stakeholder-reported historical checkpoint evidence, not a current-main test.
- Comment [#6532005116](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532005116) records verified Git/source recovery archives and restore evidence for the SHAs current at that checkpoint. It explicitly says those archives do not include hosted Supabase data or change release gates.
- Comment [#6532506133](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532506133) confirms #334 merged to TaxPay main `61a7fd4957d24e33790852881e937f3a402d7b0a` and #343 refreshed from that base; its checks were pending at that timestamp. Later comment [#6532696472](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532696472) reports #343 source recovery run #41121203954 passed at current main and states this does not prove a hosted Supabase backup/restore. Latest comment [#6532853968](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532853968) reports Pages deploy/readback at `61a7fd4` and a red overall workflow due to the stale WS01-owned `Add single` assertion. These are stakeholder reports, not per-story acceptance or WS02 tests.
- Comments [#6532147449](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532147449) and [#6532165036](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532165036) correct the earlier “387 source missing” statement and record full-byte checksum verification.
- PR [#343](https://github.com/shihab-tech04/nbr-taxpay/pull/343) remains open/unmerged at exact head `33e6bce97738ae3dbf02bbc598264e3a56e3182e`, based on main `61a7fd4957d24e33790852881e937f3a402d7b0a`. Exact-head Actions completed successfully: Phase 02 #41121203946, Pages/browser #41121203879, and source recovery #41121203954; Pages publish was skipped on the PR run. Issue comment [#6532939973](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532939973) records WS05's independent source/CI review of the two-file diff with no concrete defect. The green branch/disposable checks do not prove hosted production or per-story acceptance.
- **Hosted release remains BLOCKED**: verified backup/restore for both hosted Supabase projects and explicit migration authorization are still required; compatible Office review/read-state and TaxPay correction-outbox/readback schemas plus matching bridge functions are not installed; authorized active Office officer identities/roles are not provisioned; caller-side authorization for the service-role RPC remains unverified; and protected live officer-to-taxpayer notice/read-state acceptance is untested. These gates are stated in issue comment [#6532939973](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532939973) and the refreshed #343 PR body. No hosted migration or production deployment was performed for this requirements update.

The feature register flags the absent official workbook/legal source for the 170 payment-head records, owner review of IDs 5 and 150, and the React catalogue identity conflict (GAP-001). These remain legal/accounting blockers; a source-studied feature row is not approval to execute a payment.

## WS02 handoff

1. Recover/version the approved decisions and finish the exact stable-ID supersession crosswalk.
2. Map each still-applicable requirement to current TaxPay/Office UI, API, SQL, exact-head tests, independent acceptance, and deployed-version readback. Until evidenced, those fields remain null and the row is `BLOCKED`.
3. Keep per-story acceptance evidence, legacy repository approval history, and the official payment-head workbook/legal crosswalk as explicit blockers.
4. Do not claim a whole-program percentage or completion until the active denominator, supersessions, and per-requirement acceptance evidence are reconciled.

This PR remains draft. Changes are documentation-only: the provisional matrix and this status report. No business logic, production SQL, or WS01 Beneficiaries files were changed.

