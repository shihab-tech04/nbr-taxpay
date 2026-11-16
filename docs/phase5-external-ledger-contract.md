# Phase 5 — external-source taxpayer ledger contract

This is a read model for Sohojkor's authenticated taxpayer ledger, **not** an external payment connector or an automatic claim to official tax credit.

## Exact input contract

Seven supported provider codes are `BRTA`, `E_TDS` (e-TDS), `IBAS_PLUS_PLUS` (iBAS++), `NSD`, `SUB_REGISTRAR_OFFICE` (Sub-Registrar Office), `BANK`, and `SA_CODER` (SA Coder).

Each independently attested source allocation must preserve:

- Original provider transaction ID **and** allocation/line ID; never collapse different Dhara, tax heads or assessment years into one row.
- Its source code, original source status, assessment year, tax head, **Dhara as supplied**, exact paisa amount, payment date, challan number when supplied, provider reference, and source evidence reference.
- Receiving taxpayer's original TIN; payer's TIN when supplied. These are private database fields, not unmasked public UI values.
- Owner binding evidence linking the original recipient TIN to the authenticated taxpayer. A logged-in application account, guest payer TIN, or matching name alone is insufficient proof of entitlement.

Records are immutable to clients. Server import must use a verified authorized source and globally unique idempotent source-allocation keys `(source_system,source_transaction_id,source_allocation_id)` (not owner-dependent); one source allocation must not be copied across two accounts as a second credit entitlement; it must not make up missing provider data. **Missing Dhara is shown as “Not supplied,” not inferred.**

## Recorded payment vs official credit

`taxpay_external_payment_records` is source evidence only. A “PAID” status, challan, screenshot, bank transfer, or Sohojkor simulation event **never** populates the ledger's confirmed-credit column.

`taxpay_external_credit_postings` is a separate append-only evidence stream containing the official posting ID, independent verification source, credited paisa, posting timestamp and verification evidence. Its credit must match the same owner's source allocation and cannot exceed the recorded amount (database trigger + projection checks). Partial independent credit postings are allowed. The ledger does not invent a remaining official balance when liabilities or credit completeness are unverified.

The UI filters by all seven providers and Sohojkor separately, preserves Dhara and references in drill-down and CSV, and shows a visible unavailable/error state when external-source readback is not available.

## Release / data-boundary acceptance

1. WS3 confirms authenticated owner–taxpayer identity matching, source mapping, immutable/duplicate behavior, SQL RLS, independent Office readback, and real provider/official-credit provenance on a **disposable** environment.
2. **16 Nov V2 simulation-primary cutover:** Taxpayer Main `34c8ef56` now serves the approved fictional `user1`–`user30` preview experience from V2 (`gmuhitmaynfhipcvbvkh`), confirmed by a live sign-in and V2 asset URL readback. Original Taxpayer (`eyqhoavnitkrajvyqvxn`) remains intact as the historical read-only fallback; Office (`ihbtabrvmyiwikqqbhrf`) remains a distinct Auth/database boundary. This **does not** authorize managed Auth UUID migration, copying original financial rows, turning on the V2→Office outbound bridge, or claiming official credits. Both Taxpayer projects currently lack the Phase 5 tables. Apply the migration only after project-specific hosted SQL/Auth/Storage recovery proof, approved integration and protected release verification; never write invented financial fixtures to production.
3. Test both source-only and independently credited records, multi-line/AY, EN/BN, mobile/desktop, owner A/B separation, retry, and off-platform payments.
4. Provider credentials/API contracts and issuer-approved payment/credit data are **not** supplied by the repository. Until they exist, real external-source ingestion and cross-application official tax-credit verification remain **UNVERIFIED**; no mock entries or fake confirmation may stand in for them.

**Phase 5 is not LIVE or complete merely because a migration or UI builds.**

## Verified non-API state at V2 cutover (16 November 2026)

- Main commit `34c8ef56d39009d8b9f40f51abf33bf3c8167428` is merged; live public fictional preview login, Ledger and EN/BN navigation readback passed. Deployed SHA was not visible on the site, so exact Pages SHA remains unverified.
- V2: six `demo_payment.story_payments` rows (all simulated); six mirror-outbox rows marked `ACKED`; outbound `payment_sync.bridge_config.enabled=false`. The `ACKED` flag is not proof of Office receipt.
- Original: 23 simulated story-payment rows. Office: 23 matching IDs and core payment fields from Original; **none** of V2's six payment IDs are in Office. Do not replay these records or enable the outbound bridge until idempotent, owner-verified, authorized Office readback is accepted.
- V2 contains 24 preview guest beneficiaries in six lists; Original contains 27 in nine lists. Preserve both sets and original-only entries. The independently managed Auth identities must not be equated by matching email or display name.
- The Main source/Git archive `Sohojkor-34c8ef56-pre-release-Git-source-20261116.zip` is independently stored in Drive; its inner SHA256SUMS passed and the Git bundle was restored to identical HEAD with strict fsck. **Full hosted PostgreSQL/Auth/Storage restore is not yet verified.**
