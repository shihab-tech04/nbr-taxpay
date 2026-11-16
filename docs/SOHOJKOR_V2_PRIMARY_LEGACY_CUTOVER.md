# Sohojkor — V2 primary / original-only historical fallback (safe cutover contract)

**Status: V2 SIMULATION SITE LIVE; REAL INTEGRATED RELEASE ON HOLD.** Taxpayer GitHub Pages successfully deployed Main `34c8ef56d39009d8b9f40f51abf33bf3c8167428` on 16 November 2026. That deployed browser bundle uses Taxpayer-v2 for fictional user1–user30 simulation only, following a successful hosted V2 capability check; it does **not** prove managed Auth migration, original-record fallback, actual tax settlement, or Office synchronization. No separate hosted SQL/Auth/Storage migration or Office bridge activation is authorized by this document.

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
- V2-to-Office bridge is deliberately disabled; the deployed **Taxpayer simulation frontend now uses V2**, while the separate deployed Office app remains on its original Office database and earlier Taxpayer peer route. Office PR #270 remains unmerged; Taxpayer integration PR #794 is not the deployed full release.
- This document is not evidence of a complete restorable PostgreSQL/managed Auth/Storage backup or a tested hosted migration.

## Database-change recheck (16 November 2026; read-only)
- Main `34c8ef56` Pages deployment confirmed the **fictional simulation** scope and hosted V2 user1/user30 capability smoke. A later Main SHA requires its own exact-head deployment verification.
- Original Taxpayer, V2 and Office each expose one managed Auth user and one identity; their **Auth user UUID fingerprints differ**, even where email fingerprints match. Never map authorization or private data by matching email/TIN alone.
- Original has 23 simulated story-payment records, V2 has 6, Office has 23; signed `payment_sync` events and outbox records remain empty in each project. V2-to-Office financial reconciliation is **NOT VERIFIED**.
- V2's `payment_sync.bridge_config` remains disabled, and Office has no active `payment_sync.officer_roles` assignments. Do not activate or assign roles from guessed identities.
- Original and V2 contain 21 and 22 Storage objects respectively; Office has 0. Object counts and equal table shapes are **not** a full byte-level backup or restore proof.
- Hosted Office still exposes seven anonymous-callable legacy `SECURITY DEFINER` RPCs. The candidate migration `20261115183000_office_private_legacy_rpc.sql` is source-only until backed up, applied and independently retested with approved Edge callers.
- The current V2 developer/simulation login success does not certify real managed-Auth continuity or original-only fallback. Original projects and financial source provenance must remain intact.

## Mandatory release gates

1. **Independent recoverability**: full current ORIGINAL and V2 PostgreSQL, managed Auth, and physical Storage backups outside GitHub; checksums and isolated restore verified; no passwords or service credentials in Git or public artifacts.
2. **Real identity continuity**: supported managed Auth migration/linking, real V2 sign-in, refresh, owner UUID/permission mapping, beneficiary/draft/history isolation, logout, old-account recovery, and no account takeover.
3. **Data parity**: current table and row snapshots, source ID/provenance and owner mapping, missing-only historical exceptions classified; archive, CMS/version history, storage-object bytes, and all accepted noncloned records covered.
4. **Gateway and Office**: correct per-project Edge secrets/JWT and public key behavior, controlled Office inbound/outbound authorization, idempotent signed reconciliation and correction/readback in both directions. No duplicate payment or Office dispatch; no financial tests on live records.
5. **Production review**: exact-source CI/hosted browser acceptance for sign-in/out, guest, drafts, payments, receipt/certificate, history, corrections, Office CMS, roles, EN/BN desktop/mobile; branch protections and authorized reviewers satisfied.
6. **Paired release and rollback**: explicitly reviewed replacement of the fail-closed cutover gate, deploy exact SHA, verify actual live asset points at V2 and primary/legacy behavior, confirm Office status and monitor safe rollback. Never label PR, CI or preview as LIVE.

## Protected action taken

The approved V2 **simulation-only** public switch was published on Main `34c8ef56` after an exact-head Pages deployment and hosted fictional account smoke (GitHub Actions run `43784433095`). All real-account, hosted data restoration and Office integration requirements remain protected by distinct fail-closed gates. The Office production app and real financial integration are not certified as upgraded by that simulation release.

Owner: WS5 release controller, with WS3 exclusive ownership of SQL/Office reconciliation. This contract must be integrated with approved work in PR #794 rather than overwriting its newer features.
