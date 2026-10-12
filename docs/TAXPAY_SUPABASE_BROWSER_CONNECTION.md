# TaxPay backend connection and Phase 02 persistence evidence

## Release boundary
The public GitHub Pages site is an **independent backend-disabled demonstration**. Its build sets `VITE_SUPABASE_DISABLED=true` with blank URL and key. It cannot authenticate an application user, submit a real payment, produce a government receipt, or recognize a tax credit. Do not enable its backend through public Pages variables.

## Connected TaxPay Supabase project — read-only inspection (2026-10-12)
Connector account: **Tax Payer Payment**. Project reference: `eyqhoavnitkrajvyqvxn` (not an authorization to treat it as a disposable dev database). PostgreSQL 17.11, default database `postgres`, schema `public`; `taxpay_payment_drafts` exists. At the time of inspection there were **zero** `auth.users` and **zero** rows in the draft table. Existing policies: `taxpay_drafts_select_own`, `taxpay_drafts_insert_own`, `taxpay_drafts_delete_own`, all restricted to `authenticated` and `auth.uid() = owner_uid`. There is **no UPDATE policy or column UPDATE privilege** in this connected project. Its schema migration ledger currently has six entries:

| Hosted version | Hosted migration name |
| --- | --- |
| 20261010061507 | taxpay_drafts_initial_20261010 |
| 20261010061612 | restrict_auto_rls_helper_execution_20261010 |
| 20261010064359 | taxpay_source_candidate_registry_20261010 |
| 20261010085807 | taxpay_unverified_head_change_proposals_20261010 |
| 20261010093744 | taxpay_correction_inquiries_pending_evidence_20261010 |
| 20261010094421 | taxpay_correction_change_proposals_pending_20261010 |

The repository names these six files `202610100001` through `202610100006`, and additionally contains `202610110001_taxpay_draft_owner_updates.sql`. The timestamps in the connected migration ledger **do not match** the filenames. Reconcile via schema/content checks and approved migration bookkeeping; do not reset, reapply blindly, or assert completion because files exist.

## Original Mac discrepancy
An earlier Mac local Supabase HTTP test reported successful Auth, PostgREST INSERT and GET, while a separately issued direct PostgreSQL query did not find the row. This is **unresolved**. The hosted TaxPay project above is distinct from the Mac loopback stack and presently contains no such synthetic users or drafts. Its empty tables cannot establish the root cause of the earlier *local* mismatch. Plausible causes to test include connecting psql to another local stack/port/project/database, a reset between observations, or a nonidentical query or transaction context; **none is confirmed**.

The amended `tests/integration/localSupabaseHttp.mjs` now **requires** a loopback `TAXPAY_LOCAL_PG_DSN`, runs `psql` against the independent PostgreSQL channel, and compares the exact inserted IDs, amounts and subsequent updates to their HTTP responses. It fails closed if that direct read is absent or targets no matching row. A successful PostgREST response is never counted as PostgreSQL persistence proof on its own. Restart/reconnection must still be demonstrated in the same disposable stack and recorded separately.

## Authorization and evidence gate
Do not write to the connected hosted project until it is explicitly designated as the isolated TaxPay development database. Do not touch NBR eReturn, HRIS or other products. Synthetic accounts only. Separate real application-account authentication from verified legal eTIN ownership; no financial operations or backend integration can be enabled by this test.

Status: **PARTIAL — code prepared, read-only hosted schema observed, local direct SQL discrepancy NOT VERIFIED, backend release BLOCKED.**
