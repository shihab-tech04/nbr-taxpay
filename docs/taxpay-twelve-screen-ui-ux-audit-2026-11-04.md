# Korbritto TaxPay — 12-screen UX/UI and table acceptance audit

Baseline: the 12 screenshots supplied on 2026-11-04, the authoritative TaxPay main at `8a514061`, and Convay Board Meeting `UnifiedDataTable`, `ResponsiveTable`, `UnifiedMobileCard` and `src/styles/tables.css`. Scope excludes Nadia and official receipt/certificate print tables.

## Observed issues and specific corrections
1. **Beneficiaries** — Two low-density rows under a tall filter card, dense right-aligned actions, ambiguous legacy “Previously saved · No tag”, uneven table headings and less-readable TIN. Preserve list switching, inline rename/delete, batch selection, import preview, authorization separation and payment handoff. Fix legacy copy to **Uncategorized**, improve shared heading font and keep separate TIN/tag/action columns and mobile labels.
2. **Transactions** — Excess first-column width, cramped status/amount/action columns, four visually heavy controls, low-contrast microcopy and repeated explanatory text. Preserve filters, year/month, export and payment details. Reuse one four-column data-grid; improve 14px minimum table headers.
3. **Track payment** — Reference lookup and complete transaction table compete for attention, creating two main tasks. Preserve lookup and separate all-transaction navigation. Track screen now shows the lookup and a direct **View all transactions** action.
4. **Corrections & exceptions** — Summary counts then a long uneven list of repeated cards with status and action in different positions. Replace with four-column **Case / Recorded reason / Status / Actions** grid, with accurate explanation: record status does not establish tax credit.
5. **Receipts & certificates** — “Certificate summaries” misleadingly labels payment references; two-column cards repeat actions and leave status implicit. Rename to **Receipts & payment records** and render **Payment / Reference / Amount / Actions** with detail modal unchanged; do not manufacture issued official certificates.
6. **Ledger, All** — 10-column dense financial table and a second mobile card list simultaneously visible on desktop. Enforce desktop-mobile visibility at the CSS source, not an extra overlay. Maintain credits vs attempts distinctions.
7. **Ledger, Liabilities** — Same duplicate list, cramped amounts and inaccurate “Particulars & Economic Code” heading despite missing economic-code field. Rename to **Description / tax head**.
8. **Ledger, Credits** — Duplicate desktop cards and small labels; preserve amount and balance calculation, improve shared table heading legibility.
9. **Ledger, Payment lifecycle** — Dense source/status microcopy and duplicate mobile cards; preserve chronological order, event details, and precise credit-vs-recorded distinctions.
10. **Ledger, Corrections** — The same duplicate desktop cards with very low-data rows. Keep common table, fix duplication and provide correct empty state.
11. **Ledger, Refunds** — The same duplicated cards and opaque statuses. Preserve one data grid and accurate “no confirmed credit” explanation.
12. **Notifications** — Raw uppercase authorization states, unlabeled transaction IDs, unclear date relationships and inconsistent 44px action controls. Humanize statuses, label timestamps and references, group authorization/payment notices without changing SQL/authorization behavior.

## Convay Board Meeting design contract
- `UnifiedDataTable`: column definitions and rows, single toolbar, search, filters, applied chips, optional tabs, loading/error/retry/empty, pagination and action handling.
- `ResponsiveTable`/`UnifiedMobileCard`: readable desktop headers and mobile cards with persistent identities/actions.
- `tables.css`: typography tokens, 8–14px cells, neutral header, zebra rows, focus/hover/selection, numeric alignment.
- TaxPay's current `TaxPayDataGrid` is a partial compatible pattern: column definitions are shared for ledger, activity and beneficiaries, but filtering/actions are still owned by each domain screen. **Do not claim complete architectural equivalence.**

## Implementation decisions
- Extend the current component's known safe variants for **documents** and **exceptions**, preserving all domain-owned data and actions.
- Fix ledger duplicate desktop/mobile records by visibility CSS and actual browser regression across category tabs.
- Improve UX writing and the distinction between saved records, payment settlement, authorization and official certificates.
- Preserve 8 tax services, table exports, all beneficiary lists and tags, EN/BN, SQL/RLS, official print templates and protected roles.
- Keep notifications as a notification feed, payment lookup as a lookup form, and the tax journey as a timeline. These are **not** tables and forcing them into a table would reduce usability.

## Acceptance gates
- TypeScript, domain tests, production build; no loss of payment fields/actions.
- 1280px desktop and 375px mobile EN/BN for transaction, beneficiary, correction and document record layout.
- Ledger 1600px desktop: table visible and mobile cards hidden under **All, Liabilities, Credits, Payment lifecycle, Corrections, Refunds**; mobile vice versa.
- One accessible row/detail action per record, 44px interactive target, no page horizontal overflow.
- Independent verified full-history/source Git bundle backup **outside GitHub** before protected merge.
- PR CI successful; merge authorized; Pages deploy the exact commit and verify page/readback/browser checks. **Visual equality with the user's screenshots and full inventory of all other screens remain UNVERIFIED unless evidence is produced.**
