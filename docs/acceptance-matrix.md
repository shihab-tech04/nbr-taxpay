# TaxPay recovery acceptance matrix

`acceptance-matrix.csv` is the executable story register for the Guest/Public and Taxpayer release. It preserves all 387 source-story IDs and the original expected behavior, and adds scope, candidate route, candidate test suite, disposition, and evidence fields.

## Source and scope

- Source tracker: `NBR_TaxPay_360_User_Story_Tracker_v1_0_2026-10-10.csv`, SHA-256 `dd12c641b5ad299b15ff02180c1f329531b5e4425d1828a0429a27a00efd08d5`.
- Source user-story JSON: `NBR_TaxPay_360_End_to_End_User_Stories_v1_0_2026-10-10.json`, SHA-256 `85062d15c50e7286a50176cddf97c126e931c638f0f641abe925174a871c2b9d`.
- Prototype: `NBR_TaxPay_Blue_Prototype.html` in the user Library; inspected source sets Poppins and blue/white tokens. The original v11 source hash is recorded in the existing v11 baseline and repository parity tests.
- Required TaxPay stories: 367. The 20 excluded rows are the 18 `OFF`-module stories plus `TPAY-US-E2E-012` and `TPAY-US-E2E-015`, which require an NBR Officer interface and belong to the separate Office Management system.
- `TPAY-US-E2E-010` and `TPAY-US-E2E-011` remain in scope for the taxpayer-facing portions. Their full journey is blocked where it requires the separate officer/investigation system.

## Status at recovery checkpoint

| Status | Count | Meaning |
|---|---:|---|
| PASS | 0 | No story is marked PASS until its mapped assertion has run and produced evidence for the deployed checkpoint. |
| FAIL | 0 | Findings are tracked in `failure-register.md`; none has been scored as a final failed acceptance result before the recovery build is retested. |
| BLOCKED | 147 | A named external service, authoritative fixture, release approval, or real production identity is required for complete acceptance. |
| UNVERIFIED | 220 | Candidate code/tests exist or are mapped, but story-level executed evidence is not yet attached. |

Out-of-scope rows are not included in these counts. A mapped test filename is a test plan only, not evidence. Fill `evidence_commit` and `test_run_url` only after the relevant run passes; use FAIL if it runs and misses the expected behavior.

## Regeneration

Run `python3 scripts/build-acceptance-matrix.py /path/to/NBR_TaxPay_360_User_Story_Tracker_v1_0_2026-10-10.csv`. The generator validates that the input has 387 unique stories and deliberately does not promote an untested story to PASS.
