# Sohojkor citizen UI library — foundation

## Public entry point
Import `Button`, `Input`, `Select`, `Textarea` and their public types from `src/design-system`. Existing `components/ui/Controls` imports are compatibility re-exports of the same objects. There is one implementation, not a second visual system.

This first slice deliberately preserves the existing classes, props, ref forwarding, native semantics, variant names and current citizen CSS tokens. It does not redesign the application, change fonts, move global CSS, add dependencies or change business/API/SQL behavior. Office-owned UI and print templates remain outside this citizen scope.

## Migration registry
| Item | Source/owner | State |
| --- | --- | --- |
| Button / Input / Select / Textarea | design-system/primitives/Controls.tsx | canonical implementation; legacy shim retained |
| Palette / typography / spacing | src/index.css and citizen styles | inventory and approved visual baseline required |
| SearchableSelect / modal / data table | components/ui | retain existing implementation until overlap, visual and interaction tests pass |
| Domain payment and receipt components | feature owners | migrate after primitives; preserve payment/SQL contracts |
| Storybook, full component interaction and visual tests | future slices | not implemented |

## Acceptance
Run existing `npm run lint`, `npm run test:domain`, `npm run build`, applicable Playwright and protected release checks. The new domain tests verify public/legacy identity and native rendered attributes; they do not prove visual parity or keyboard/ref behavior. Capture approved EN/BN, mobile/desktop and supported theme states before further migration. Verify release SHA and URL, and independently retain the exact pre-release source/history with checksum and restore proof before merge. No real taxpayer data in fixtures.

## Continuation
M1/M2: inventory consumers, document approved tokens and capture baselines; do not replace Manrope or other styling without confirmed reference. M3: migrate overlay/table components only after active PRs are reconciled. M4–M6: screen adoption, Storybook/component interaction and visual tests, end-to-end verification. Track each acceptance result in the canonical project ledger; no completion claim from a PR alone.
