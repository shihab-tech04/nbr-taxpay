# TaxPay modal system audit — 2026-10-29

## Scope and source
Inspected current `main` `38106fdb0a94f7608ed8210c276bf20f285d20a5` and the shared modal, sign-in, payment-entry, public-service, receipt/certificate and authorization components. This is a source integration audit, not proof that every historical journey is visually approved.

## Root cause of sign-in inconsistency
- Homepage Login uses `TaxpayerLoginDialog` wrapping `TaxPayModal` with `className="taxpayer-login-modal"`, `data-public-service="login"`.
- Pay Tax > account login embeds the **same sign-in form** inside `PaymentServiceChoiceDialog`, but previously had `data-public-service="payment-choice"`, `className="tax-service-choice-modal--access"`, custom width and forced left-aligned footer.
- Both already shared `TaxPayModal` mechanics; CSS variant drift, not duplicate login functionality, caused the visual inconsistency.

## Shared component contract
`src/components/ui/TaxPayModal.tsx` is the authoritative modal shell: overlay and dismissal; header centered title; conditional Back at top-left; × close at top-right; scrolling body; fixed optional footer; focus management, escape, focus return; responsive layout; footer target for nested workflow actions. A feature may supply contents, title, primary/secondary actions and Back callback, **not a new shell**. Common CSS belongs to the modal design system, not per-entry duplicate overrides.

## Observed consumers and disposition
| Consumer | Use | Disposition |
|---|---|---|
| `TaxpayerLoginDialog` | Homepage standalone account login | Shared `login` variant; no Back in standalone context |
| `PaymentServiceChoiceDialog` | Payer selection, service choice, embedded login, payment workflow | Same `login` variant when login stage; only payment journey has Back |
| `PublicServiceModal` | Payment status/receipt lookup, travel tax | Already shared shell; preserve larger receipt/travel content sizing |
| `ReceiptView` | Receipts from search, history, guest, travel, wizard, Office-linked document | Already shared shell + footer actions; preserve document content |
| `CertificatesView` | Annual/withholding/travel certificate summaries | Already shared shell with print/download; preserve export contract |
| `AuthorizationRequestPopup` | Consent/authorization prompt | Already shared shell; preserve Accept/Decline decision layout |
| `ParityRegisterModal` | Route parity/explanatory modal | Already shared shell; don't change business content |
| `PaymentDetailView` | Transaction-linked certificate view | Delegates to shared `ReceiptView`; preserve linked record checks |

## Intentional variants, not duplicate shells
- Receipt and certificate documents need a larger paper layout; travel form needs larger body; payment's four-step form needs larger width. The content-specific size variants are acceptable.
- Payment-only login has a Back action to restore selected payer/account; homepage login has no prior payment step. Header position, modal width, body spacing, footer alignment and form styling must otherwise be identical.
- The rest of the codebase can have component-owned confirmation/content presentations; do not convert those blindly without verifying complete journeys, existing visual acceptance, and footer actions.
- Mobile and Bengali expansion require dedicated regression checks, not hard-coded one-off modal widths.

## Implemented minimal correction
One `taxpayer-login-modal` class and `login` service key for both sign-in entrances; obsolete payment-only login styling removed. Shared responsive modal shell and action alignment reused. Login logic, fields, validation, recovery, focus and account preservation unchanged.

## Acceptance
- Standalone vs embedded login: same variant, width and body padding; centered title and right-aligned Sign In; only payment login has Back.
- One overlay/dialog; no nested login shell.
- Password toggle, recovery link, empty-field disabled Sign In, error handling and successful sign-in unchanged.
- Back returns to the payer choice with account selection intact; closing returns to correct entry.
- EN/BN, desktop/mobile, keyboard, scroll, and all existing payment/receipt/authorization regression tests pass.
- Protected merge and production publication must verify exact commit and real live site; don't claim LIVE on PR approval alone.
