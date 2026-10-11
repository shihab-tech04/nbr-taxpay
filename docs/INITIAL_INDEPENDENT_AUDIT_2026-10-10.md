# NBR TaxPay — Independent Source Review (2026-10-10)

## Scope
Source-level review of Gemini-generated main commit `b64ee8a4a67c6a7e279ccbc8e72c6ba8896f5e03`, compared with the controlled v11 HTML scope. This is not a re-executed test or release certification.

## Findings
- The shared `addPaymentReceipt` routine treated newly simulated non-withholding receipts as confirmed, NBR-verified ledger credit entries solely on payer-TIN equality. No separate authoritative tax-credit verification was enforced.
- Both guest and signed-in payment wizards initialized the new demo receipt tax-credit status as `CREDITED_TO_LEDGER`.
- Receipt display fabricated a SHA-256-looking string and displayed an official electronic-signature assertion.
- Audit display described random in-memory tokens as a tamper-resistant SHA-256 audit chain.
- Ledger UI described in-memory fixture credits as NBR verified.
- Source inventory contains 29 original route renderers mapped to 29 components and the embedded payment-head catalogue. Functional parity, exact catalogue identity, build, mobile visual parity, official law and integration are NOT CERTIFIED.
- Repository lacks the byte-identical v11 source file in `reference/`; only its expected hash is documented.
- Prior `TEST_REPORT.md` and `RELEASE_GATE.md` provide PASS claims but no independently reviewed machine-generated run artifacts for this exact commit.

## Changes in this draft branch
- A newly simulated receipt can no longer automatically create a ledger credit. Credit booking must be implemented independently from verified taxpayer, year, settlement and entitlement evidence.
- Newly created non-withholding demo receipts show `PENDING_RECONCILIATION`, not `CREDITED_TO_LEDGER`. Withholding deposit does not credit the withholding agent.
- Receipt, audit and ledger display labels acknowledge simulation rather than fictitious official signatures, hashes or verification.
- The original documentation assertions are retained with an independent-review qualification.
- The design layout, sample data fixtures, 170 payment-head source records and module inventory are not altered.

## Outstanding release gates
- Run build, typecheck, source/route/interaction regression and actual desktop/mobile visual comparison for this exact branch: **NOT RUN**.
- Independently verify 170 payment-head identities, accounting codes, and applicable law: **UNVERIFIED**.
- Introduce authenticated role authorization and backend-enforced Maker/Reviewer/Approver separation: **NOT IMPLEMENTED**.
- Verify ACS settlement, gateway callback, taxpayer/AY credit entitlement, idempotency, reversal, and persistence from official sources: **NOT IMPLEMENTED**.
- Implement tamper-evident immutable audit storage and test cryptographic claims: **NOT IMPLEMENTED**.
- Real eTIN/eReturn/eLedger/eTDS integration, bank connections or production deployment: **NOT AUTHORIZED**.

## Decision
**DRAFT / PARTIAL — NOT CERTIFIED**. No merge, release, production connection or deployment is authorized by this review.
