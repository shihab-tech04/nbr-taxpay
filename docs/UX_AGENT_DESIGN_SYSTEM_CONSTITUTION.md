# TaxPay UX/UI Agent — design system and engineering constitution v1.0

## Authority and continuity
Inherited UX/UI Product Design & Design-System Guardian standard applies across this product. The agent is a design/review constitution rather than proof that an independent external agent ran. This file turns that standard into testable repository acceptance criteria.

Hierarchy for product decisions: controlling tax law and government integration evidence (for legal behavior) > accepted TaxPay v11 Golden UI and established design decisions > existing reusable app components > accessibility/WCAG 2.2 AA > platform UX patterns > external design examples. Do not silently change protected released UI. All new work is tested as a branch with evidence.

## Existing visual baseline, explicitly protected
- Body/UI: Manrope; headings: Fraunces; accounting/reference data: IBM Plex Mono; Bangla: Noto Sans Bengali.
- Existing brand language: deep emerald primary, amber accent/focus, slate surfaces; reuse the same Tailwind semantic palette, not ad hoc hex values per component.
- Existing core shared surfaces: Header, Footer, DemoNoticeBanner, ReceiptView. The source catalogue adds only a specialized screen, not a rival component framework.
- Navigation and existing prototype routes stay intact unless a tested story directly modifies them. Simulated role switcher is **not authorization**.
- English/Bangla record labels preserve source text verbatim (including source typos/omissions) and keep legal currency separate from translation.

## Shared modal pattern (implemented)
- Use `src/components/ui/TaxPayModal.tsx` for new citizen-facing modal dialogs; do not rebuild one-off headers, body scroll containers or footers.
- One left-aligned h2 title and one right-aligned 44px close icon; separate header and body with a border divider.
- Use a single contained, independently scrollable body. Footer is a separate persistent area with a top divider; provide feature actions through the footer slot, otherwise a localizable Close action is provided.
- The shared shell handles overlay dismissal, Escape, keyboard focus containment, initial close focus, focus restoration, scroll lock, mobile full-height layout and print exclusion of controls.
- Preserve feature-specific inputs, error states, consent rules and visual/functional protection. Apply gradually to relevant guest/taxpayer dialogs; do not redesign certified officer screens.

## Mobile first implementation gates
1. Baseline viewport 320px, then 375px, tablet ~768px, desktop ~1280px. Never design desktop first and rely on shrinking.
2. Content reflows without clipping or page-wide horizontal scrolling; complex financial tables adapt to cards/overflow only within their own scroll region.
3. Interactive touch controls at least 44px high where practical; adequate spacing and no destructive action adjacent to primary without safeguards.
4. Native semantic HTML: one page h1, orderly h2/h3; data labels, descriptions and errors in p/label elements. Never put semantic label text only in unlabelled div/span.
5. Keyboard order, ESC/Back, visible focus, accessible names, error summaries, aria-live status, meaningful loading/empty/error/success messages.
6. WCAG 2.2 AA baseline, contrast, 200%+ zoom/reflow, reduced-motion and screen reader validation. Automated axe PASS is not a replacement for manual checks.
7. Complete EN/BN parity for navigation, instructions, validations, focus behavior and layout. Source-missing Bangla labels explicitly show missing, never generated as legal translation.
8. Never imply government eTIN verification, official A-Challan, Treasury success, deductible tax credit or valid rates from demo data.

## Component-library architecture (progressive, reuse before create)
- Shared design-token layer in the established Tailwind/CSS system: typography, semantic colors, sizes, spacing, radii, elevation and states. No new UI framework without feature evidence.
- For each new workflow, **search and reuse** existing primitives before creating a new one; extract broadly used elements into `src/components/ui/` when their second real consumer appears.
- First reusable candidates: FormField, SelectField, Input, Button, Badge (verified/draft/warning), Notice, EmptyState, DataList/DataTable, Stepper, Drawer, ConfirmDialog, Toast and LoadingState.
- Keep feature-specific business logic out of visual primitives. Feature screen composes fields, validation and service boundaries.
- Use shared data contracts for monetary amounts (minor integer units), AY identifiers, currency display, tax-head identity and statuses. No currency float for financial posting.
- Keep source fixture, verified legal master, reconciliation rule and draft data separate. No client component can grant a role or create a Treasury/ledger credit.

## Acceptance template for every user story
Source ID → actor/scenario → actual acceptance criteria → negative/abuse test → component reuse decision → responsive layouts → EN/BN → keyboard/a11y → API/DB/RLS → integration/financial gates → direct test logs/evidence → PASS or PARTIAL/FAIL.

Current verified catalogue evidence at PR #2:
- Source: 170 original records transcribed with source metadata and fixture SHA identity tests.
- Unit: 12/12.
- Browser: 15/15 at 320/375/1280, including mobile touch targets, head search, owner-review states, EN/BN and scoped axe A/AA checks.
- **Not certified:** actual production authenticity, legal current law, OAuth/OTP two-user isolation, Treasury and ledger, all pre-existing routes across devices. This remains a draft development branch.

## Strict future gates
An updated component cannot regress legacy routes. Run visual comparison before accepting a Golden UI alteration. Don't add presentation-only labels that suggest backend success. Release via main only after corresponding story's required security, browser and integration tests have evidence. Preserve 387-story baseline.
