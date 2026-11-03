# Korbritto — Unified citizen UI contract

Scope: TaxPay public, payment and signed-in taxpayer screens. Preserve approved responsive layouts, payment journey, receipt data and user-specific SQL behavior. Officer-only presentation remains isolated.

## Typography

- One English font owner: Poppins via `--font-text` inherited by public and authenticated citizen shells.
- Bengali: Noto Sans Bengali with Poppins fallback. Use a consistent `lang="bn"` scope.
- Base body 16px; minimum functional text 14px. Approved headings H1/H2/H3/H4 scale 32/24/20/18px, with deliberate mobile variants.
- Headings use h1–h4; paragraphs use p. Keep native semantics for buttons, links, labels, lists, tables, definitions and input options. Do not force p elements inside buttons or replace accessible labels with spans. Generic div/span may remain for structure, icons and visually hidden auxiliary content, not free-standing prose.

## Color and spacing

- Brand: `#2C5EAD` (existing primary), hover `#24549D`, active `#1B427D`.
- Source of truth: `src/index.css` tokens. Feature CSS uses semantic tokens; preserve status/service distinctions and existing values during conversion.
- Spaces: 4/8/12/16/20/24/32px, with documented optical exceptions.
- Radii: control 12px, card 16px, modal 24px, pill 9999px.
- Controls use shared focus, hover, disabled, error and loading states. Minimum interactive size 44px.
- Flat bordered cards; use shared header and content padding. No new gradients or decorative changes.

## Unified components

1. `UiButton`: primary, secondary, outline, destructive and icon action; all buttons actionable.
2. `UiInput`/`UiSelect`/`UiTextarea`: consistent labels, validation, help text and sizes.
3. Shared card, table and filter variants: numeric right-aligned, text left, searchable and keyboard operable.
4. `TaxPayModal`: single header/close/back/focus/scroll/footer behavior; mobile sheet responsive.
5. Payment stepper shared by services and embedded Travel Tax. Preserve existing stage meaning and stored payment data.
6. Payment summary: all selected heads reachable, fixed totals, mobile collapsed calculation.
7. CitizenNavigation/CitizenFooter: only registered routes, intact returnTo/deep links and browser Back.
8. Receipt/Certificate: consistent UI with print and PDF behavior intact.

## Cleanup and static analysis

- Eliminate JSX `style` props, HTML `style` attributes and embedded style blocks. Migrate genuinely dynamic charts to SVG geometry or reviewed CSS primitives, preserving behavior.
- Remove CSS only after a reference search and active-route computed-style/browser check, including dynamic and print selectors.
- No sub-14px visible text, unnecessary CSS overrides, duplicate tokens, or fake links.
- Audit every active anchor and enabled button in EN/BN. Verify route contract, keyboard, Back/Forward, login redirect, and external destination responses.
- Check at 320/375/390/768/1024/1280/1400/1600/1920/2560px, including long text and all-selected payment heads.

## Release gates

Do not declare complete based on static scanning. Require baseline visual captures, TypeScript/build, unit/domain, Auth/RLS, payments/beneficiary/receipt parity, full browser/axe checks, approved UI comparison, and independent off-GitHub source/full-history backup with checksum and restore test. Merge through protected workflow, verify production URL and version before saying LIVE.

## Status of this branch

This initial branch consolidates font ownership and several exact-value form color tokens and retires the orphaned preview HTML. This is **not** yet the complete no-inline-style/no-dead-CSS migration. See the exported file-and-line audit register for outstanding work.