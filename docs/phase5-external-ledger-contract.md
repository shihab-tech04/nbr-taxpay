# Phase 5 — external-source taxpayer ledger contract

This is a read model for Sohojkor's authenticated taxpayer ledger, **not** an external payment connector or an automatic claim to official tax credit.

## Exact input contract

Seven supported provider codes are `BRTA`, `E_TDS` (e-TDS), `IBAS_PLUS_PLUS` (iBAS++), `NSD`, `SUB_REGISTRAR_OFFICE` (Sub-Registrar Office), `BANK`, and `SA_CODER` (SA Coder).

Each independently attested source allocation must preserve:

- Original provider transaction ID **and** allocation/line ID; never collapse different Dhara, tax heads or assessment years into one row.
- Its source code, original source status, assessment year, tax head, **Dhara as supplied**, exact paisa amount, payment date, challan number when supplied, provider reference, and source evidence reference.
- Receiving taxpayer's original TIN; payer's TIN when supplied. These are private database fields, not unmasked public UI values.
- Owner binding evidence linking the original recipient TIN to the authenticated taxpayer. A logged-in application account, guest payer TIN, or matching name alone is insufficient proof of entitlement.

Records are immutable to clients. Server import must use a verified authorized source and idempotent keys `(owner_uid,source_system,source_transaction_id,source_allocation_id)`; it must not make up missing provider data. **Missing Dhara is shown as “Not supplied,” not inferred.**

## Recorded payment vs official credit

`taxpay_external_payment_records` is source evidence only. A “PAID” status, challan, screenshot, bank transfer, or Sohojkor simulation event **never** populates the ledger's confirmed-credit column.

`taxpay_external_credit_postings` is a separate append-only evidence stream containing the official posting ID, independent verification source, credited paisa, posting timestamp and verification evidence. Its credit must match the same owner's source allocation and cannot exceed the recorded amount (database trigger + projection checks). Partial independent credit postings are allowed. The ledger does not invent a remaining official balance when liabilities or credit completeness are unverified.

The UI filters by all seven providers and Sohojkor separately, preserves Dhara and references in drill-down and CSV, and shows a visible unavailable/error state when external-source readback is not available.

## Release / data-boundary acceptance

1. WS3 confirms authenticated owner–taxpayer identity matching, source mapping, immutable/duplicate behavior, SQL RLS, independent Office readback, and real provider/official-credit provenance on a **disposable** environment.
2. WS5 must keep the original production Taxpayer project (`eyqhoavnitkrajvyqvxn`) authoritative until a **separately authorized and fully recovered** cutover. The V2 clone (`gmuhitmaynfhipcvbvkh`) is not production merely because it is healthy. Office (`ihbtabrvmyiwikqqbhrf`) remains a distinct authorization/database boundary. Apply the migration only to the approved project and only after hosted SQL/Auth/Storage recovery proof, review and the protected release process; do not write financial fixtures to production.
3. Test both source-only and independently credited records, multi-line/AY, EN/BN, mobile/desktop, owner A/B separation, retry, and off-platform payments.
4. Provider credentials/API contracts and issuer-approved payment/credit data are **not** supplied by the repository. Until they exist, real external-source ingestion and cross-application official tax-credit verification remain **UNVERIFIED**; no mock entries or fake confirmation may stand in for them.

**Phase 5 is not LIVE or complete merely because a migration or UI builds.**
