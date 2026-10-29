# TaxPay modal-shell audit and consolidation — 29 October 2026

## Authoritative baseline
- Main before changes: `208e70e92e2457f4308c8744da187829c4c5337b`
- Scope: TaxPay public and taxpayer-facing dialog shells, preserving existing EN/BN text, form fields, record data, payment/authorization state, API and SQL.
- Existing shared shell: `src/components/ui/TaxPayModal.tsx` (header, centered title, single top-right X, optional contextual Back, scrollable body, action footer, focus trap, Escape, focus restoration, responsive layout).
- Source inspected: the current main branch plus previous full source archive; changed files are applied to a branch from exact current main.

## Cause of inconsistent sign-in dialogs
The homepage Account Login route rendered a standalone `TaxpayerLoginDialog` backdrop/header/actions/CSS. The Pay Tax journey rendered its form inside `TaxPayModal`. This duplicated modal infrastructure, so headers, close controls and footers had different alignment and widths.

## Surface inventory and correction
| Entry point | Previous modal | Target design / status |
| --- | --- | --- |
| Homepage Login | Custom `TaxpayerLoginDialog` standalone wrapper | Shared `TaxPayModal`; only the reusable login form inside; footer Sign In |
| Pay Tax → Account | `TaxPayModal` + embedded login | Retain same shell; contextual Back remains only in journey |
| Public receipt search/status | `TaxPayModal` via `PublicServiceModal` | Already shared; unchanged |
| Guest/Travel completion receipt | Shared `ReceiptView` | Already shared; unchanged |
| Signed-in payment wizard receipt | `TaxPayModal` + `ReceiptView` | Already shared; unchanged |
| Payment history/detail/Office-linked certificate | Shared `ReceiptView` | Already shared; unchanged |
| Annual/withholding/travel certificate summaries | `TaxPayModal` | Already shared; unchanged |
| Payment service/payer selector | `TaxPayModal` | Already shared; preserves four-step navigation and selection |
| Incoming authorization | Private `taxpay-reference-dialog` backdrop/header/body/actions | `TaxPayModal` with accept/decline/consent-code action footer |
| Legacy user1 transaction details | Custom taxpayer transaction overlay | `TaxPayModal` read-only compact variant, footer omitted |
| Route parity register | Custom emerald diagnostic overlay | Shared `TaxPayModal` wide variant, content/table preserved |
| Citizen mobile menu | Navigation drawer/dialog | Deliberate exception: keep as navigation, not a financial modal |
| Embedded Office prototype `OfficeModal/OfficeDrawer` | Separate officer design system | Deliberate exception: preserve separate Office shell and permissions/navigation; not migrate to public TaxPay styling without independent office design approval |

## Shared component contract
1. `TaxPayModal` is the single TaxPay dialog shell; no feature owns a second backdrop or header.
2. Header: centered title, one top-right close; contextual Back only when the user has a previous step inside the same workflow.
3. Body: independently scrollable with consistent margins; mobile viewport and Bangla expansion supported.
4. Footer: actions aligned at the right. Read-only dialogs use `hideFooter`, never a redundant Close button.
5. Form submission stays with the feature: same `loginPreviewAccount` API, unchanged User ID/password/validation/recovery behavior. Standalone Sign In uses HTML form association.
6. Shared shell manages Escape, focus trapping/restoration and body scroll locking; `initialFocusSelector` enables meaningful first-field focus for login.
7. No API, SQL, account permissions or authentication implementation changes.

## Regression/acceptance
- Homepage Login: same modal chrome as Pay Tax account login, single X, enabled/disabled Sign In, validation/recovery, Enter submission, Escape, focus, close; user1-user10 remain intact.
- Pay Tax account login: Back to payer selection stays in header, Login returns to chosen flow, form inside one dialog, never nested.
- Authorization: request and code display retain actions and state.
- Transaction details: data and scroll restored on mobile; no empty Close footer.
- Desktop/mobile (320/375/1280) and EN/BN header/footer wrapping, keyboard behavior.
- Existing receipt, certificate, traveler, multi-beneficiary, payment, and Office-linked contracts remain untouched.

## Release
Do not classify LIVE before protected PR merge, exact-head CI, independent full history/source backup with checksum & isolated restore, verified private Drive copy, production deployment and live browser readback. Review older parallel branches (#287/#289) only for conflict; do not mix their feature changes.

## Follow-up source sweep after PR #308 (2026-10-29)

- Source baseline: `a1ce248b3e0fef1b89de3684f4e990c78a24be04`, the merged shared-login-modal release candidate.
- Inspected all 79 `src/**/*.tsx` files. Ten caller files use `TaxPayModal`, including standalone sign-in, payment-journey sign-in, payment choice, receipt/certificate views, authorization, transaction details, and route parity.
- `src/components/layout/CitizenNavigation.tsx` is a mobile navigation dialog, not a payment modal. `src/components/office-ui/OfficeControls.tsx` is an independent officer design system. Neither is migrated into the citizen TaxPay shell.
- Both sign-in entry points use the same `taxpayer-login-modal` class, the same `service="login"` variant, the same form, and the same footer action component; payment retains contextual Back only.
- Removed the duplicate login CSS definitions so a single `.taxpayer-login-modal` rule set owns width, padding and footer alignment. Kept the approved responsive values unchanged.
- Removed the generic fallback bottom **Close** button from `TaxPayModal`. No footer is rendered unless the caller supplies actual workflow actions; receipt and travel consumers continue supplying a portal footer, while read-only dialogs can remain footerless.
- Added regression assertions for one overlay and no redundant footer Close at both sign-in entry points; existing desktop/mobile, EN/BN, payment continuity and document export tests remain authoritative for functional acceptance.
- Pre-release current-main backup: [Google Drive verified archive](https://drive.google.com/file/d/1_5kymPEvrMT55VJOTNzJT6U2-kzIfYp-/view); recovered Git bundle: 339 refs, SHA `a1ce248b`, independent restore and `git fsck --full --strict` PASS, Drive ZIP SHA-256 `3d7a791530f43611d73cecc2f3fc872a7221b9a58a643ff663a1f898af8e09c1`, re-downloaded ZIP byte-for-byte PASS.
- Remaining release acceptance is based on actual new PR exact-head CI, merged SHA and deployed Pages/browser checks; do not infer a live deployment from this source audit.
