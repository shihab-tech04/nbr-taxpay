# Amar Kor / TaxPay — locked citizen design system

Baseline: TaxPay `7f8c4e2` (`main`, inspected 2026-10-16); source reference: `Sobaike-janao-public` `b6a66b9` (`main`). This is a scoped visual-token transfer, not a copy of Sobaike's product identity, content, flows, or categories.

## Immutable primary and typography

- **Primary:** `#2C5EAD` for both TaxPay public and authenticated taxpayer interfaces. Hover `#24549D`, active `#1B427D`, dark surface `#1E4484`, soft blue `#EAF2FF`. A service or feedback color must never replace the app primary.
- **Fonts:** Poppins for English, Noto Sans Bengali for Bangla, IBM Plex Mono for financial numerals and references. Office Management's separate typography/theme remains outside this contract.
- **Citizen type scale:** body 16px; helper/meta/action 14px; label 16px; mobile H1/H2/H3/H4 28/22/18/16px; desktop 32/24/20/18px. Existing specialized financial, table, and compact labels retain their accepted component sizes.
- **Light surfaces:** page `#F0F2F5`; subtle `#F7F9FC`; cards `#FFFFFF`; border `#E1E6EE`; text `#172033`; secondary text `#5F6B7A`.
- **Radius:** controls 12px, cards 16px, desktop modals 24px, pills full. Mobile full-screen modal geometry remains unchanged.
- **Elevation:** control `0 1px 2px rgba(23,32,51,.06)`, card `0 1px 3px rgba(23,32,51,.08)`, raised `0 8px 24px rgba(23,32,51,.10)`, modal `0 18px 48px rgba(23,32,51,.20)`. Print receipts must not acquire decorative elevation.

## Existing payment-type color families

| Existing service | Primary | Soft surface | Border | Text |
|---|---|---|---|---|
| Tax with return | `#315DAA` | `#EEF4FF` | `#C9D8F5` | `#214887` |
| Advance income tax | `#A65B19` | `#FFF6EC` | `#F3D9B8` | `#80420D` |
| Withholding tax | `#6D4BA8` | `#F6F1FC` | `#DFD2F1` | `#4E327B` |
| Other tax payments | `#0C6D8D` | `#ECF8FC` | `#BDE7F2` | `#07516B` |

These are **service-identification colors only**. They must not imply a payment is successful, a head is legally payable, a challan is issued, or tax credit is recognized. Existing status and warning semantics remain separate.

## Source-to-target mapping and regression boundary

| Sobaike pattern | TaxPay implementation | What remains preserved |
|---|---|---|
| Semantic page/surface/border palette | TaxPay citizen tokens in `src/index.css` | TaxPay blue brand, Office theme |
| Single low-elevation card pattern | Shared citizen card selectors in `taxpay-design-transfer.css` | Card content and layout |
| Section-specific primary/background/border/text sets | Four existing categories on public landing | Category order, text, routes, no new actions |
| Central type/shape hierarchy | Explicit citizen type/radius variables; Bangla font precedence | Financial numerical font, compact layouts |
| Consistent modal appearance | Existing shared modal title font/radius/shadow | Modal header/body/footer, mobile full-screen behavior |

**Negative-space checks:** no new service, menu, field, payment option, role switch, legal status, or officer route; no change to backend, identity, RLS, calculation, or stored tax records. No hard-coded Sobaike brand color is imported as the TaxPay primary.

Future UI edits should reuse these tokens and existing components. Update this register and verify the public/taxpayer surfaces at desktop and mobile sizes before changing a locked value.
