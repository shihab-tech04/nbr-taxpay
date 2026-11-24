# Sohojkor Taxpayer TIN Search — Single Master Component

**Release baseline:** Main `daa7c805` (19 November 2026); audit `Sohojkor_TIN_Search_Full_Implementation_Audit_2026-11-20.md`.
**Owner:** WS4 shared Taxpayer UI, subject to WS5 release gates.

## Approved visual baseline

The user's two screenshots define the approved entry/result. Use `TaxpayerTinLookup` with one controlled accessible numeric input driving **twelve digit boxes**, a consistently styled Search button, and the `TaxpayerTinSearchResultCard` for matched name, optional supported classification, length-preserving masked TIN, a Reveal/Hide eye and the caller's optional Add action.

For **320–420px**, render two rows of six usable digit cells with Search below. Through **650px**, stack Search below rather than squeeze cells. Above the phone breakpoint, render a single twelve-box row when space permits. Never add TIN copy buttons outside Profile.

The shared result is a presentation component: displaying a fictional match does not validate legal identity or grant permission.

## Coverage and deliberate business exceptions

- **All Tax Payments:** exact 12-digit sample match, supported demo income-tax classification, no duplicate, then Add.
- **Guest Pay Tax:** one shared input and the same masked name/TIN result, with the original payment validation retained.
- **Other Tax primary/additional:** the same search, preview and confirmation pattern; unmatched syntactically valid TIN remains permitted with optional name under the established legacy rule. Do not force fictional sample match.
- **Walk-in payer:** the same result card, but retain the separate **Confirm payer** action; payer identity remains distinct from beneficiary allocation.
- **One-time recipient and saved fallback:** the same result card, original saved-beneficiary owner/duplicate checks, masked passive selection entries.
- **Beneficiaries:** the same result card, optional editable name for unmatched searches, original tag/list save rules, masked passive displays.
- **Manage Authorization:** thirteen-digit account-reference variant only; filtered suggestions cannot offer twelve-digit values; no display-only match grants consent.
- **Parallel taxpayer draft:** existing supported 12/13-digit mode, the shared card and length-preserving summary mask.
- **Officer Taxpayer 360:** distinct read-only dossier/search function; not replaced by a taxpayer-add form.
- **Profile:** separately authorized TIN reveal/copy remains the only TIN copy facility.

A search result card uses its live region for screen-reader announcement without creating a second `role=status` locator in screens that already have one.

## Regression and acceptance

Required CI covers rendered mobile geometry, 12/13-digit suggestions, EN/BN, masking, disabled Search states, Search → matched/unknown/duplicate → Add/Confirm, clear focus, keyboard interaction and no modal overflow. Preserve financial calculations, drafts, correction history, existing SQL/API/RLS, receipts and the distinct Travel Tax journey. Tests use disposable/synthetic fixtures only, not live financial writes.

The code is not **LIVE** merely because PR checks pass. Require a verified pre-release independent full Git/source backup, protected merge into Main, successful exact-commit Pages workflow and deployed browser/readback evidence. Any remaining pixel mismatch or unsupported context stays listed as unverified, never silently accepted.
