# Sohojkor — V2 primary / original-only historical fallback (safe cutover contract)

**Status: HOLD — NOT LIVE.** This file applies only to Sohojkor Taxpayer and the distinct authorized Office integration. The already deployed Taxpayer site remains on the original project until the release gates below are met. No production migration, data write, or Office bridge activation is authorized by this document.

## Database roles

- Intended **primary**: TaxPayer-v2 (`gmuhitmaynfhipcvbvkh`). After cutover, all new allowed application writes and normal reads belong here.
- **Original legacy source**: Tax Payer Payment (`eyqhoavnitkrajvyqvxn`). Read-only **only for verifiably un-cloned records**, subject to the record's original owner/guest-capability authorization; never a general fallback when V2 returns 401, 403, 409, 5xx or a network timeout.
- **Separate Office**: `ihbtabrvmyiwikqqbhrf`. Never merge into either Taxpayer DB, swap Office Auth, or reuse Taxpayer service-role tokens for Officer access.
- Do not label synthetic/review records as confirmed government payments or tax credit.

## Precedence and safe recovery

1. For a requested record, read V2 with the authenticated V2 owner/session or existing capability. Preserve its immutable source ID, payer, beneficiary, head, AY, amount, status, and reference. **Never** merge two records that share a primary/source ID.
2. Only for an explicitly missing historical record (not a permission or service error), use a **server-side** allowlisted legacy query with a cryptographically validated original identity/guest capability and immutable provenance. The original database must authorize its own read. A taxpayer TIN, name, email, session ID alone, or arbitrary browser-supplied owner UID is never proof.
3. Return a legacy row with `source=original` and its immutable source ID; filter duplicates when also present in V2. Do not opportunistically copy financial-looking records or silently change statuses, confirmed credits, Office timelines, or original allocations.
4. If the original read is forbidden, unresolved, missing or ambiguous, show unavailable/retry or account-recovery UI; never broaden RLS, reveal another owner's data, or infer identity from TIN.
5. Once a record and owner relationship are securely reconciled into V2, stop fetching that record from original. No dual writes and no duplicate Office dispatch.
6. Preserve current guest, signed-in, admin/officer, EN/BN, desktop/mobile and all approved UI journeys. No new field or navigation redesign.

## Live evidence at 16 November 2026

- Supabase original and V2 are both `ACTIVE_HEALTHY`; **68/68 application/archive tables exist on both**, but only **61/68 table row counts match** at the current check. The differing tables are `demo_payment.story_payments`, `demo_payment.story_notifications`, `demo_payment.mirror_outbox` (each original 23 versus V2 6), `taxpay_guest_private.beneficiaries` (3/0), `taxpay_guest_private.lists` (3/0), `taxpay_guest_private.demo_payment_form_drafts` (2/1), and `public.taxpay_site_banner_history` (68/72). Equal counts alone do not establish equal content. Both have two Storage buckets; V2 has one additional branding metadata placeholder (13 banner objects and 9 branding objects versus original 13 and 8).
- The **23 active original payment rows and 6 active V2 payment rows have zero overlapping immutable payment IDs and zero overlapping idempotency keys** at this read-only checkpoint. The original rows are dated 15 November 2026; V2's active rows date from 11–12 November. All are application `SIMULATED_SUCCESS` test records, not authoritative paid-tax/treasury postings. Do not copy, deduplicate or project them into Office as real tax receipts without authenticated provenance and exact record-by-record reconciliation.
- **Auth source has 1 user and 1 identity; V2 has 2 users and 2 identities; 0 user UUIDs overlap.** This is a hard release blocker. A matching email hash is not a substitute for owner identity, confirmed login/refresh, and persistence.
- Source and V2 `demo-story1-taxpay` Edge Function source intentionally differ: V2 contains an outbound Office dispatch disablement guard. Do not replace it blindly with original source or enable duplicate delivery.
- Current V2-to-Office bridge is deliberately disabled; the deployed Office CMS and Taxpayer frontend still use original Taxpayer project. Current Office PR #270 and Taxpayer integrated PR #794 are draft/unmerged.
- This document is not evidence of a complete restorable PostgreSQL/managed Auth/Storage backup or a tested hosted migration.

## Mandatory release gates

1. **Independent recoverability**: full current ORIGINAL and V2 PostgreSQL, managed Auth, and physical Storage backups outside GitHub; checksums and isolated restore verified; no passwords or service credentials in Git or public artifacts.
2. **Real identity continuity**: supported managed Auth migration/linking, real V2 sign-in, refresh, owner UUID/permission mapping, beneficiary/draft/history isolation, logout, old-account recovery, and no account takeover.
3. **Data parity**: current table and row snapshots, source ID/provenance and owner mapping, missing-only historical exceptions classified; archive, CMS/version history, storage-object bytes, and all accepted noncloned records covered.
4. **Gateway and Office**: correct per-project Edge secrets/JWT and public key behavior, controlled Office inbound/outbound authorization, idempotent signed reconciliation and correction/readback in both directions. No duplicate payment or Office dispatch; no financial tests on live records.
5. **Production review**: exact-source CI/hosted browser acceptance for sign-in/out, guest, drafts, payments, receipt/certificate, history, corrections, Office CMS, roles, EN/BN desktop/mobile; branch protections and authorized reviewers satisfied.
6. **Paired release and rollback**: explicitly reviewed replacement of the fail-closed cutover gate, deploy exact SHA, verify actual live asset points at V2 and primary/legacy behavior, confirm Office status and monitor safe rollback. Never label PR, CI or preview as LIVE.

## Protected action taken

The existing dedicated [Taxpayer cutover PR #593](https://github.com/shihab-tech04/nbr-taxpay/pull/593) stages the V2 public build. It now contains a fail-closed production gate; a successful static build alone cannot publish V2. The gate is intentionally not bypassable with a CI variable while hosted identity and backup evidence remain missing. The existing Office and Taxpayer production apps remain unchanged.

Owner: WS5 release controller, with WS3 exclusive ownership of SQL/Office reconciliation. This contract must be integrated with approved work in PR #794 rather than overwriting its newer features.
