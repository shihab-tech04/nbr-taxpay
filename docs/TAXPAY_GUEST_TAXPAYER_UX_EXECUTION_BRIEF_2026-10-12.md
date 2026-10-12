# TaxPay Guest + Taxpayer UX/UI implementation brief — 2026-10-12

## Mission
Implement the approved payment-first Guest/Public and mobile-first Taxpayer UX/UI in shihab-tech04/nbr-taxpay. This is an existing product, not a rewrite. Begin with an audit; implement in bounded, tested steps; publish only the verified static demo. Use the latest adaptive-navigation HTML from the Shihab UX project conversation as visual/interaction reference, but the repository's latest source wins on implementation and protected behavior.

## Source priority and verified current state
1. Current target repository: https://github.com/shihab-tech04/nbr-taxpay (main; React 19 / TypeScript / Tailwind v4 / Vite, GitHub Pages path /nbr-taxpay/).
2. Current design reference: NBR_Integrated_Payment_v11_Adaptive_Navigation.html and the Guest/Taxpayer full and compact screenshots in the same Shihab UX project conversation; earlier v11 original remains legal/feature provenance, not a production integration.
3. Existing docs: docs/UX_AGENT_DESIGN_SYSTEM_CONSTITUTION.md, FEATURE_PARITY_v11.md, RELEASE_GATE.md, RELEASE_SECURITY.md, UNVERIFIED_LEGAL_AND_INTEGRATION_GAPS.md, TEST_REPORT.md, docs/TRANSFER_SPEC.md.
4. Theme source already present: src/components/office-ui/themes.ts (ported from NBR Office Management).
5. Material Design 2 reference: https://m2.material.io/design/color/the-color-system.html

The repo is already a substantial React app with working v11 route components, source payment-head fixtures, mock domain state, disabled hosted backend, and regression tests. Do NOT paste the 865KB HTML into index.html or replace the React application. Identify real parity gaps, then implement with existing components.

## Strict phase boundary
IN SCOPE: Guest/Public and signed-in/sample Taxpayer information architecture, navigation, home, payment-entry UI, mobile forms, status, history, ledger, related help/accessibility, bilingual UX, and shared citizen-facing design tokens/components.
OUT OF SCOPE: NBR Officer UI and permissions (the separate NBR Office Management system owns officers), actual tax-law changes, new ACS/Treasury/eTDS connections, live payments, real credentials, production tax calculations, new Supabase tables/RLS/API without explicit requirements. Preserve officer routes and the current Office login composition unless intentionally replaced behind an explicit tested citizen-first entry decision.
Static GitHub Pages must remain an independent DEMONSTRATION with hosted auth/backend disabled, no implied official NBR endorsement, no real challan or tax-credit issuance.

## Product architecture
Public/Guest: All eligible payment service choices visible on public home. Main action Pay opens the payment-option selector, not a duplicate generic wizard. Keep receipt/token lookup, travel tax, income-tax liability payment, qualified withholding deposit, incident reporting, and help. Guests may not access private taxpayer account, ledger, name, balance or return data. Guest payment policy remains provisional until formally approved.
Taxpayer: Mobile-first Home, Activity/Payment History, Tax Ledger, and More destinations; payment is a separately floating global primary action (never an ordinary navigation tab). Keep dashboard/tax position, own payment, facilitation authorization, withholding agent role, receipts and certificates, corrections, notifications, tax journey and connected-service explanations. Distinguish payer vs taxpayer and Treasury receipt vs tax credit. Do not invent delegated permissions.
Do not force guest login without a documented policy decision. Preserve selected payment option across any genuine authentication gate.

## Approved adaptive navigation behavior (derived from Sobaike Janao interaction principle)
Initial page load, top-of-page, scrolling UP: full header and meaningful navigation, clearly visible floating Pay action.
Scrolling DOWN: hide expanded chrome without abrupt jumps; four essential persistent controls only: Menu upper left, Guest receipt lookup / Taxpayer Activity upper right, Home lower left, Pay lower right.
Use existing functional routes; make icons accessible; maintain 44px minimum practical touch targets; avoid cards and form-content overlap, safe-area and mobile-keyboard obstruction.
Pay is a distinct, high-priority floating control, visually elevated but modest in size; do not span the whole page with a payment bar and do not insert Pay as a regular bottom-navigation destination.
In active transactional forms (guest, withholding, travel, signed-in payment wizard), hide floating Pay/irrelevant navigation in favor of task-specific Back, Continue, Review, Confirm, Cancel, and recovery controls.
Use modest, reduced-motion-aware transitions. Use scroll-direction thresholds/hysteresis to avoid flicker; restore expanded nav on scroll up and navigation reset, without jumping page position. Full, compact, menu, focused-input, modal and flow states must coexist correctly.
Desktop keeps its appropriate full navigation, not a giant mobile dock. Officer interface remains unchanged.

## Design system and palette
Use the verified Office Management Government Blue palette from src/components/office-ui/themes.ts as starting point:
primary #2C5EAD; primary dark #1E4484; primary light #EAF2FF; secondary #5CA8D8; accent #F4C95D; background #F6F9FE; surface #FFFFFF; border #DDE7F5; text #172033; secondary text #5F6B7A; success #238636; warning #D97706; error #C62828.
Create reusable, semantic CSS/Tailwind token mapping in the existing system, including on-primary and focus states; do not scatter hard-coded colors across screens. Material 2 guides hierarchy/contrast, not the introduction of a second UI framework. Validate AA contrast on real components. Do not use yellow for routine text or all financial statuses.
Preserve source typography unless an evidenced decision changes it: Manrope UI, Fraunces display, Noto Sans Bengali, IBM Plex Mono for identifiers. Avoid generic hero-heavy dashboards, overdecorated cards, repeated buttons and wasted vertical space. Correct mobile content density, spacing and hierarchy.

## Execution order
1. Inspect current main, GitHub Actions, tests, docs, all citizen routes, state/navigation, responsive CSS, shared components, current committed visual state; compare reference HTML and screenshots. Produce a route-feature-gap and protected-area register. Identify regressions and source-specific limitations.
2. Build/reuse a citizen shell and semantic design tokens; keep the officer shell as-is. Preserve the current Office login root tests until product entry routing is explicitly changed and equivalent coverage updated.
3. Implement guest navigation and public home first, including payment-option discovery, status lookup, account-access separation and error/recovery/empty states. No duplicate payment-choice step.
4. Implement taxpayer responsive shell and dashboard as genuine mobile-first screens. Keep the payment action distinct and persistent outside active transaction flows. Priority: position, next steps, payments, ledger.
5. Audit/fix payment journeys and related screen layouts using current domain logic; do not modify calculations or classification rules as a styling side effect. Explicitly surface legal/ACS mapping conflicts, do not silently resolve them.
6. Audit forms, cards/tables, modals, status copy, receipt detail, certificates, corrections, notifications, menus, focus trapping and EN/BN parity. No disappearing actions or unreachable last items on small screens.
7. Test at 320/360/375/390/768/1280px, English/Bangla, portrait, zoom, scroll UP/DOWN, modal, keyboard, reduced-motion, pending/success/failure, refresh/return, navigation to payment and re-entry. Run npm ci, npm run lint, npm run test:domain, relevant Playwright tests, audit with axe, inspect screenshots. Tests invalidated intentionally by approved navigation changes must be replaced with equivalent or stronger assertions; do not delete checks to turn red into green.
8. Implement through feature branch / PR. Re-read diffs, protect SQL/services/officer features, verify CI and static GitHub Pages build disabled-backend guard. Merge into main and verify deployment/readback only when gates pass. Do not publish any demonstration as an operational NBR payment service.

## Non-negotiable acceptance
Functional routes work; guest sees eligible services; taxpayer sees prioritized tax position; Pay is NOT a tab; both expanded and compact states work and the four compact controls are discoverable; task flows do not compete with global FAB; no blocked content or horizontal page overflow; accessible focus, EN/BN parity, clear disclaimer, no fake backend/credit claims, desktop and officer regressions absent, build/CI verified. Explicitly report evidence and outstanding blockers without claiming 100% certification.

## Final deliverables
Create/merge tested implementation in https://github.com/shihab-tech04/nbr-taxpay; give PR and merge commit SHA, GitHub Pages URL and confirmed status, before/after guest and taxpayer screenshots for full/compact states at mobile plus desktop, test counts, impacted-file list, unresolved payment-policy/legal issues, and explicit production-readiness boundary. Work autonomously through independent tasks; do not request files already in this Project/Library or ask the user to do routine manual setup. If source or permissions are unavailable, report the exact blocker without claiming deployment.
