# Controlled payment-head identity review · Story TPAY-US-CAT-002-F/N

## What was done
- Read the controlled v11 `NBR_LAW_MASTER` source extract from the project's existing upload.
- Preserve **all 170** fields and identities as an independent source snapshot. Keep its original metadata, disputed flags and English/Bangla labels.
- Keep **ID 5** and **ID 150** as `OWNER_REVIEW` (unselectable for financial posting); do not invent corresponding ACS accounting codes.
- Keep Gemini's synthetic `MASTER_PAYMENT_HEADS` as an explicitly legacy demonstration implementation, not legal source data.
- Add a mobile-first, read-only searchable catalogue screen with disclosure that the missing workbook and current law are unverified.
- Add baseline hash and identity tests, positive and negative search tests, and UI build gate.
- Link the existing Public Landing "View all heads" navigation to the source-faithful reference. Payment wizard remains a separate **simulated** flow.

## Legal and integration boundaries
These records originate only from the uncontrolled legal interpretation embedded in the v11 prototype. The underlying `ACS_Section List.xlsx/R_NBR_LAW` was not supplied. Neither the source `codeEn` (e.g. 16A, 74) nor its Bangla transcription is evidence of an ACS treasury economic code or legal validity.

No approval, executable rates, payment success, government Treasury confirmations, eLedger credit or NBR authorization is inferred.

## UX Guardian review
- Preserve existing typefaces, Tailwind semantic palette and solved screens.
- 320px-first single-column screen, expanding at large breakpoints, with bounded 20-record pages.
- Every field has an explicit label; navigation and controls are native, keyboard-focusable, 44px minimum target.
- EN/BN source labels appear side by side; missing Bangla is clearly indicated; no invented translation.
- Distinct `OWNER REVIEW` warning and not-verified source disclosure, including screen reader announcement of filter counts.
- No fake "Pay" or "Apply" action for unverified heads.

## Story acceptance
- `TPAY-US-CAT-002-F` and `-N`: **code/unit/source verified** after CI; browser and authorized law mapping pending; do **not** label production PASS.
- `TPAY-US-CAT-003-F` and `-N`: search functionality with no-match cases tested in code; responsive/browser smoke still required.
- `TPAY-US-CAT-004-F` and `-N`: fail-closed review labels tested; real payment engine not connected.

The 387-story baseline and existing 366-rule NBR eReturn registry remain unchanged.
