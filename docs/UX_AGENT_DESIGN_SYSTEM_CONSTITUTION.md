# Sohojkor TaxPay UX/UI Agent — current design-system and engineering constitution v2.0

## Authority, scope and continuity
Inherited UX/UI Product Design & Design-System Guardian standards apply within Sohojkor TaxPay. This repository document is a complete agent design/review constitution and test contract; it is not proof that a separate ChatGPT/custom agent was invoked or that external agent settings were changed. Do not claim otherwise.

Decision priority: current authorized tax-law/government contract where relevant > latest user-approved Sohojkor v11 visual source/screenshots and explicit decisions > current reusable TaxPay source components and tokens > approved frontend/API/SQL integration contracts > WCAG 2.2 AA and accessibility > platform conventions > external inspiration. Existing accepted UI and solved routes remain frozen unless the user expressly changes them. Match current Main, active ownership and PRs before editing. Every changed UI needs evidenced acceptance on the actual consuming route.

## Current citizen design baseline, explicitly protected
- Current TaxPay citizen-facing typography: Poppins for EN body, headings, forms and controls; Noto Sans Bengali first for BN; IBM Plex Mono only for financial/reference/long numeric data via --font-numeric. Source of truth: src/index.css and src/styles/taxpay-responsive-typography.css. The old Manrope/Fraunces mix was the historical original baseline, not the current approved citizen typography. Do not change Office or officer type in a citizen-only scope.
- Current TaxPay citizen palette: approved primary blue (#2C5EAD in this source version), neutral surfaces/borders/text and restrained semantic error, warning and success. Read --color-taxpay-* in src/index.css and --citizen-* in src/styles/taxpay-citizen.css. The old emerald/amber palette was historical, not today's citizen palette. Never create one-off hardcoded gradients or alternating card fills.
- Current citizen type/spacing contract: 16px body, labels and inputs, responsive --taxpay-type-* hierarchy and 4px spacing rhythm (4/8/12/16/24). Shared compact metadata/official print exceptions need existing component evidence; do not shrink the whole form to 12–14px or add excessive whitespace, duplicated titles or oversized cards.
- Preserve the approved Header, Footer, DemoNoticeBanner, ReceiptView, shared TaxPayModal, PaymentCertificateDocument, table, card, form and modal systems. New screens compose shared primitives instead of inventing a parallel framework.
- Navigation, original and parallel payment routes and existing prototypes remain intact unless the user's targeted story directly changes them. A simulated role switcher is not authorization. Preserve original Return + another taxpayer's Advance combination in the separate multi-taxpayer checkout.
- EN/BN legal labels preserve the verified source (including source omissions/typos where legally required); currency display and transliteration are separate from tax-law validation.

## Shared modal system — mandatory
- Use src/components/ui/TaxPayModal.tsx for citizen-facing dialogs. Never rebuild one-off modal headers, body scroll containers or footers.
- Use one modal header with Back on top-left when there is a previous in-modal view, one left-aligned contextual h2 title, and one right-aligned 44px Close. Hide only Back when no prior view exists. The header/body boundary uses the approved border. Never put Back in the receipt body toolbar or duplicate the current title in content.
- Use one independently scrollable contained body and the existing persistent footer with divider. Approved Download/Print/document actions belong in that footer, never another sticky inner toolbar. When no action exists, a localizable Close is available. One modal shell covers all states; do not open one dialog on top of a sibling document dialog.
- Shared shell owns overlay dismissal, Escape, keyboard focus containment, initial focus and return focus, scroll lock, mobile full-height layout and exclusion of controls from print. Respect draft/discard and result recovery confirmations. Preserve input, validation, consent, error, state and visual behavior. Do not redesign certified officer screens.

## Walk-in payment result, Challan details and record certificate — acceptance contract
1. Single journey: Payment result (saved/pending/error) → Challan details (record) → optionally eligible Payment record certificate. Header title updates to the actual view. Header Back navigates certificate → Challan → result, never resubmits payment. Close follows current modal recovery rules.
2. State honesty: A saved record is NOT verified bank settlement, official Treasury scroll, government challan or taxpayer tax credit. Show only backend-supported status and authentic identifiers. The optional record certificate must say it is only a saved-payment record and not proof of bank/Treasury settlement. Eligibility comes from the existing canViewPaymentCertificate contract, never a visual bypass.
3. Result hierarchy: status/amount first, reference and concise truthful payment state second, a single primary Challan details action. Optional account sign-in is secondary and never blocks walk-in record access.
4. Challan hierarchy: document/service, amount and reference, then dense payer/taxpayer/transaction details and any real remarks/allocations. Copy/reference values must wrap or scroll safely. Do not duplicate status panels, borders and backgrounds or show blank data cards as design decoration.
5. Documents: when both views are eligible, use compact accessible tabs or the accepted in-content document switch; Back remains in the modal header. Preserve every genuine receipt/certificate field and print/export output; screen-only layout must not hide print headings or numeric fields.
6. Reuse before styling: inspect ReceiptView.tsx, PaymentCertificateDocument.tsx, GuestPayment.tsx, PaymentServiceChoiceDialog.tsx, TaxPayModal.tsx and shared tokens. Avoid CSS patch stacking, hiding shared navigation or editing unrelated API/SQL/payment calculation to solve spacing.
7. Must pass on 320px, 375px, ~768px and ~1280px plus EN/BN: contextual Back and Close, keyboard/focus/ESC, long TIN/BN expansion, copy/reference and no horizontal overflow, 44px tap areas, accessible document navigation, read-only pending/error/success, optional login, download/print, source-driven certificate availability and no duplicates. Store Playwright evidence; verify production URL, deployed SHA and actual browser interaction before reporting LIVE.

## Mobile-first implementation gates
1. Start at 320px, then 375px, tablet ~768px and desktop ~1280px. Do not design desktop-only and merely shrink it.
2. Reflow without clipping or page-wide horizontal scroll; long financial tables adapt within their OWN region.
3. Touch controls at least 44px high where practical; separate primary and destructive actions.
4. Semantic HTML: one page h1, orderly h2/h3 and labelled data, descriptions, errors and buttons; never put essential labels only in unnamed div/span containers.
5. Complete keyboard order, Escape/Back, visible focus, accessible names, error summaries, aria-live status and loading/empty/error/success/recovery states.
6. WCAG 2.2 AA minimum, adequate contrast, 200%+ zoom/reflow, reduced motion and screen-reader checks. Automated axe is supplementary, not full manual proof.
7. EN/BN parity for navigation, validation, focus and mobile layout. Source-missing Bengali legal terms stay marked as missing, never fabricated.
8. No implication that demo data verifies government eTIN, official A-Challan, Treasury settlement, deductible tax credit or tax rates.

## Shared component architecture
- Use the established Tailwind/CSS semantic tokens for fonts, spacing, colors, sizes, radii, elevation and states. No new UI framework without user-approved evidence.
- Search for existing primitives first; after the second real consumer consider shared FormField, SelectField, Input, Button, Badge, Notice, EmptyState, DataList/DataTable, Stepper, Drawer, ConfirmDialog, Toast and LoadingState.
- Keep domain calculations, payment eligibility and authorization out of display primitives. UI composes fields, validates, and calls approved services.
- Keep amounts in integer minor units; preserve AY codes, head IDs, currency format, status and API/SQL/RLS contracts; never post currency floats.
- Separate source fixtures, verified law, reconciliation, draft data and live records. A component cannot grant privilege, certify a Treasury transaction or write ledger credit from styling alone.

## Acceptance template and evidence
For each story record: source ID → actor and scenario → exact acceptance → negative/abuse case → chosen shared component → responsive EN/BN → keyboard/a11y → API/DB/RLS/Office path → financial/security controls → direct test logs → PASS/FAIL/UNVERIFIED. No invented acceptance percentage.

Historical evidence at PR #2 was 170 transcribed records with fixture SHA checks, 12/12 early unit and 15/15 early browser cases (320/375/1280). These are not 2026 release acceptance. The current v9.5.3 master scope is 168 features, 171 stories, 25 core journeys, with statuses tracked in the canonical case ledger. The historical 387-story note is not the current approved feature census. Hosted official authenticity, current tax law, OAuth/OTP isolation, Treasury and ledger credit cannot be inferred from old tests.

## Strict merge, production and documentation gates
No regression to original or parallel routes, solved modal UI, source data, EN/BN, signed-in/out, devices, print or financial contracts. Compare approved screenshots and source before accepting design changes. Verify the precise affected tests and independent safe journeys, never assume compilation means UI correctness. Independently store and restore-test a checksum-verified exact-premerge Main Git/source backup outside GitHub; merge via protected Main only after required approvals/security and passing current-head tests. Deploy and read back exact production URL/SHA/journeys before stating LIVE; PR/preview is not LIVE. After a meaningful milestone update the SAME canonical Sohojkor Library master/ledger, with evidence, failures, backup, deployed status and next steps; do not duplicate or repeatedly overwrite. Nadia-owned work is excluded without separate explicit authorization.
