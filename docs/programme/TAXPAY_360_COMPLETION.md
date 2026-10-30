# Korbritto 360° requirements traceability — 2026-10-30

> **Status: provisional and incomplete.** The exact 387-story backlog has been recovered and full-byte checksum-verified. The file now carries source rows and per-ID assessment fields, but it is not the fully reconciled, approved catalogue and does not certify implementation, testing, legal validity, or production behavior. No whole-program completion percentage is reported.

## Current repository and release checkpoints

- TaxPay `main`: `61a7fd4957d24e33790852881e937f3a402d7b0a` (ref independently refreshed for this PR).
- Office Management `main`: `ba2d0b60070d5bde1b2f598607329e10e11f3307`.
- TaxPay issue [#230](https://github.com/shihab-tech04/nbr-taxpay/issues/230) remains open; refreshed 2026-10-30T20:09:42Z (55 comments). The latest handoff is comment [#6532475742](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532475742), which still cites the previous TaxPay main `f4663ccc`; main was independently refreshed to `61a7fd4957d24e33790852881e937f3a402d7b0a`. Issue #230 remains the release controller for TaxPay ↔ SQL ↔ Office parity and production gates.
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

## Per-record assessment and status rules

Each story, feature, and semantic crosswalk row keeps its complete raw source record and has a normalized assessment object. The assessment includes approval source, latest decision, supersession, UI/route/service/API/SQL/Office mappings, current TaxPay and Office main SHAs, test evidence, production evidence, owner, regression history, and blocker references. Null values mean no per-record evidence was found; the blocker catalog names the missing evidence or mapping.

Normalized status values use only the allowed enum: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `TESTED`, `LIVE`, `BLOCKED`, `REGRESSED`, and `SUPERSEDED`. Every story and feature row is currently `BLOCKED` because per-ID approval/currentness and current implementation, test, ownership, and production mappings are not established. This does not assert that every feature is unimplemented.

The master prompt attachment `upload/Pasted text(20261030-193011).txt` §5.B (lines 244–249) names the known conflict topics: older guest-payment entry rules; Beneficiaries authentication; older logos; earlier homepage layouts; old demo-specific UI content; and older receipt implementations. Section §5.F (lines 561–566) requires one reusable receipt/certificate template, retains Download and Print, and prohibits reintroducing rejected panels, unrelated actions, redundant copy, or demo disclaimers. The approved project-memory summary supplied to WS02 contains the latest Korbritto decisions. The matrix records these decision topics as `SUPERSEDED`, but affected stable-ID lists remain empty and per-ID mapping is `BLOCKED` because the exact versioned change artifacts/crosswalk are not available. No replacement requirements are inferred.

## Acceptance and historical evidence boundaries

The 387-story requirement source is recovered; **per-story acceptance evidence is still unavailable**. The separate 150-feature source register remains a feature baseline, not a substitute for the 387 story records. The source declares every story draft and `test_status: NOT_RUN`. The 2026-10-15 audit `NBR_TaxPay_Comprehensive_Deep_Audit_2026-10-15.md` (Library ID `libfile_cbe6744b6b7c819196eafb4b8271b20c`, including its 18-master-group matrix and lines 50/270 acceptance boundary) records all 387 story acceptances unverified at that historical checkpoint. The 2026-10-14 release-truth audit (Library ID `libfile_4ed602f70b508191a3448182bdad60bb`) is also historical, not current verification.

The backlog and feature register reference legacy repository `shihab2-tech/NBR-Tax-Payment`, commit `a5584ca7b19000f5d239cf049d32a0993f5cffac`. Connected GitHub access returned HTTP 403 with a suspended-account response. Its historical source and approval/change history remain unavailable through that repository.

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
- Comments [#6532147449](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532147449) and [#6532165036](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532165036) correct the earlier “387 source missing” statement and record full-byte checksum verification.

The feature register flags the absent official workbook/legal source for the 170 payment-head records, owner review of IDs 5 and 150, and the React catalogue identity conflict (GAP-001). These remain legal/accounting blockers; a source-studied feature row is not approval to execute a payment.

## WS02 handoff

1. Recover/version the approved decisions and finish the exact stable-ID supersession crosswalk.
2. Map each still-applicable requirement to current TaxPay/Office UI, API, SQL, exact-head tests, independent acceptance, and deployed-version readback. Until evidenced, those fields remain null and the row is `BLOCKED`.
3. Keep per-story acceptance evidence, legacy repository approval history, and the official payment-head workbook/legal crosswalk as explicit blockers.
4. Do not claim a whole-program percentage or completion until the active denominator, supersessions, and per-requirement acceptance evidence are reconciled.

This PR remains draft. Changes are documentation-only: the provisional matrix and this status report. No business logic, production SQL, or WS01 Beneficiaries files were changed.

