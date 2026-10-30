# Korbritto 360° requirements traceability — 2026-10-30

> **Status: provisional source recovery and traceability only.** The exact 387-story backlog has been recovered and checksum-verified. This does not certify those stories as approved, implemented, tested, legally valid, or live. No whole-program completion percentage is reported.

## Current repository and release checkpoints

- TaxPay `main`: `f4663ccc241490825c69ed88ce90594111f61f45`.
- Office Management `main`: `ba2d0b60070d5bde1b2f598607329e10e11f3307`.
- TaxPay issue [#230](https://github.com/shihab-tech04/nbr-taxpay/issues/230) remains open; last refreshed 2026-10-30T19:51:49Z (54 comments). It remains the release controller for TaxPay ↔ SQL ↔ Office parity and production gates.
- Beneficiaries PR [#341](https://github.com/shihab-tech04/nbr-taxpay/pull/341) merged at the current TaxPay main SHA. PR #341's body records the original verification boundary. Later WS05 issue comment [#6531873727](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6531873727) reports a successful Pages publish/readback and live Beneficiaries entry/form check in EN/BN, with no form submission. It also says the overall Actions run remains red because `scripts/verify-live-public-auth.mjs:75` still expects the removed `Add single` control. WS02 did not re-run this check and did not edit WS01 files.
- Current repository test paths are present at the TaxPay main tree, but path presence is not test evidence. WS02 ran no tests. The checked-in `TEST_REPORT.md` blob `b89e83137fc9980a3c9266f8ef57df18d6bcf106` is dated 2026-10-11 and applies to commit `594109683220a132c997b2ea5d124a98ec6810b`, not current main. `RELEASE_GATE.md` blob `75d871ad07800fc3297a2d17f1234907e5620cce` is dated 2026-10-12, with its publication boundary updated 2026-10-16; it is historical context, not current-main proof.
- The current `FEATURE_PARITY_v11.md` (blob `93c0be6e4779e81380d8e759058dfe77011530ce`) explicitly says it is a route-to-source index and does not certify feature completion, legal correctness, integration, or production safety.

## Recovered source layers

The draft adds [`docs/programme/CANONICAL_TAXPAY_REQUIREMENTS.json`](./CANONICAL_TAXPAY_REQUIREMENTS.json) as a **provisional** matrix. It keeps these source layers separate:

| Source layer | Recovered content | Boundary |
|---|---|---|
| 387-story backlog | `NBR_TaxPay_360_End_to_End_User_Stories_v1_0_2026-10-10.json`, Library ID `libfile_8fd144ac3c8881919b4048d5c1dfa3a7`; full-byte SHA-256 `85062d15c50e7286a50176cddf97c126e931c638f0f641abe925174a871c2b9d` matches `docs/STORY_EXECUTION_OVERLAY_v1.json` at main (`f4663ccc`, blob `7ee45b671cd735dff270e6df74b740a33a81ab32)). It parses to 387 unique stable story IDs. | The source declares `DRAFT_360_USER_STORY_BACKLOG_NOT_IMPLEMENTATION_OR_LAW_CERTIFICATION`; each story is `DRAFT_NOT_IMPLEMENTATION_CERTIFIED` with `test_status: NOT_RUN`. Recovery confirms source text and IDs only. |
| 150-feature baseline | `NBR_TaxPay_Feature_Master_Register_v1_1_Source_Studied_2026-10-10.json`, Library ID `libfile_046595f225dc81918c3d613aa9ec77bf`; 150 stable feature IDs across 18 modules, plus 40 prototype-semantic crosswalk rows. | The register declares `SOURCE_STUDIED_FEATURE_BASELINE_NOT_STORIES_NOT_LEGAL_CERTIFIED`. It is separate from the 387 stories and cannot substitute for story acceptance or legal approval. |
| Story execution overlay | Current main `docs/STORY_EXECUTION_OVERLAY_v1.json`, blob `7ee45b671cd735dff270e6df74b740a33a81ab32`; 22 historical entries. | Limited overlay; its default is `DRAFT_NOT_TESTED_NOT_CERTIFIED`. Its partial statuses are retained as historical evidence, not promoted to current acceptance. |

The story and feature counts are different source layers. They must not be added together or used as a completion denominator.

## Matrix statuses and unresolved history

In the JSON matrix, **CONFIRMED** means the stable ID and exact source record were recovered. It does not mean the requirement is approved, still applicable, implemented, tested, legally validated, or live. **SUPERSEDED** is recorded only for known historical conflict topics from the approved brief; those topics have no guessed stable-ID links. Their per-ID mapping remains **BLOCKED**. **SOURCE_MISSING** marks absent acceptance evidence, the inaccessible historical source/approval trail, or a missing exact change crosswalk.

The master prompt attachment `upload/Pasted text(20261030-193011).txt` §5.B (lines 244–249) identifies the conflict topics: older guest-payment entry rules; Beneficiaries authentication; older logos; earlier homepage layouts; old demo-specific UI content; and older receipt implementations. Section §5.F (lines 561–566) requires one reusable receipt/certificate template, retains Download and Print, and prohibits reintroducing rejected panels, unrelated actions, redundant copy, or demo disclaimers. The approved project-memory summary supplied to WS02 contains the latest Korbritto decisions, but the accessible versioned sources do not provide an exact story-ID supersession crosswalk or the complete replacement specifications. The matrix records those topics as superseded at the decision level, with `affected_story_ids: []` and `mapping_status: BLOCKED`; it does not infer replacements.

The 387-story source is recovered; the separate **story-level acceptance evidence is still missing**. The 2026-10-15 audit `NBR_TaxPay_Comprehensive_Deep_Audit_2026-10-15.md` (Library ID `libfile_cbe6744b6b7c819196eafb4b8271b20c`, including its 18-master-group matrix and the lines 50/270 acceptance boundary) records all 387 story acceptances unverified at that historical checkpoint. The 2026-10-14 release-truth audit (Library ID `libfile_4ed602f70b508191a3448182bdad60bb`) is also historical.

The backlog and feature register both reference legacy repository `shihab2-tech/NBR-Tax-Payment`, commit `a5584ca7b19000f5d239cf049d32a0993f5cffac`. Connected GitHub access returned HTTP 403 with a suspended-account response. The repository's approval/change history remains unavailable through that source.

## Historical 2026-10-15 module snapshot

These are the 10/15 audit's historical statuses only; they are not current status or per-story acceptance.

| Module | Historical audit state |
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

Issue #230's current comments provide stakeholder-reported release evidence, not a WS02 re-test:

- Comment [#6531873727](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6531873727) reports the exact main SHAs above, current Pages publish/readback and Beneficiaries entry/form behavior, and states that correction migrations/readback contracts are not installed, hosted bridge functions lag current source, there are zero active Office officer roles, and correction review/notification round-trip are not live.
- Comment [#6532005116](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532005116) records verified Git/source recovery archives and restore evidence for the current TaxPay and Office main SHAs. It explicitly says those archives do not include hosted Supabase data or change release gates.
- Comments [#6532147449](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532147449) and [#6532165036](https://github.com/shihab-tech04/nbr-taxpay/issues/230#issuecomment-6532165036) correct the earlier “387 source missing” statement and record full-byte checksum verification.

The feature register separately flags the absent official workbook/legal source for the 170 payment-head records, owner review of IDs 5 and 150, and the React catalogue identity conflict (GAP-001). These remain legal/accounting blockers; a source-studied feature row is not approval to execute a payment.

## WS02 handoff

1. Review the provisional matrix and resolve the exact approved change documents and stable-ID supersession crosswalk.
2. Map each still-applicable requirement to current TaxPay/Office UI, API, SQL, exact-head tests, independent acceptance, and deployed-version readback. Until that work is evidenced, those fields remain UNKNOWN or BLOCKED in the matrix.
3. Keep the historical 387 story acceptance results, legacy repository approval history, and official payment-head workbook/legal crosswalk as explicit blockers.
4. Do not claim a whole-program percentage or completion until the active denominator, supersessions, and per-requirement acceptance evidence are reconciled.

This PR remains draft. Changes are documentation-only: the provisional matrix and this status report. No business logic, production SQL, or WS01 Beneficiaries files were changed.
