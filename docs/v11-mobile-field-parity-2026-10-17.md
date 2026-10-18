# NBR TaxPay v11 HTML field-parity audit — 17 October 2026

Reference: `NBR_Integrated_Income_Tax_Payment_Portal_Upgraded-v11(6).html`, supplied alongside this work. Scope: public guest income-tax and withholding payments, Travel Tax, and their review/payment steps. The React app remains the working simulation; this comparison does not authorize real Treasury, ACS or eTDS transactions.

## Verified direct source comparisons

| Source form / section | Source fields and choices | React result after this patch |
| --- | --- | --- |
| Guest identity, `PAGES.guestpay`, step `tin` | Own tax / someone else's tax; 12-digit taxpayer TIN; optional NBR notice or payment reference | Present. Payer relation is step 1 of the mobile modal. Reference is optional for all guest services, including Other Tax Payment. |
| Withholding identity, `G.kind === 'WH'` | Agent / paying for agent; 12-digit withholding-agent TIN | Present; corrected explicit withholding-agent TIN label in the input and review. |
| Guest payment details, step `details` | Grouped payment head; two income-tax types with their original/new codes (not for withholding); four assessment years; one positive amount for the single selected head; conditional payer name; required 11-digit receipt mobile; online or branch method | All input types present. Full income-tax-type strings and government accounting code are now shown. **Newer React main also supports multiple heads with one amount per head**, beyond this v11 guest screen. |
| NBR law master | 170 records in seven categories, with codes, English/Bangla labels, mappings and review flags | **Exact JSON equality** between the HTML's `NBR_LAW_MASTER` and `V11_SOURCE_HEADS` confirmed (170/170). |
| Guest review, step `review` | TIN/agent, purpose, head, tax type and accounting code, year, amount, method, payer, credited party, mobile, optional reference, acknowledgement | Present. Added amount and government accounting code to review. |
| Travel route | Six choices: 6000 / 2000 / 4000 / 200 / 1000 / 1000 BDT, including complete North/South America wording | All six amounts match. Corrected English and Bangla wording of first route; no route is preselected, as in HTML. |
| Travel passenger | Age bands >12, >5–12, <=5 exempt; passenger name; passport number required except domestic flight; travel date; required 11-digit receipt mobile | All present. Corrected labels; date and route now start blank and require entry. Half-rate and exemption retained. |
| Travel payment / review | Calculated read-only amount; online (bKash, Nagad, Rocket, internet banking, Visa, Mastercard) or bank branch; acknowledgement; pending bank receipt vs confirmed paid status | Added missing bank-branch choice and required confirmation to mobile flow. Branch now produces a pending slip, distinct from confirmed receipt. |

## Remaining differences — do not claim 100% certification yet

1. **Reference verification and auto-fill.** v11 checks sample TIN/reference pairs and locks the amount and year for a matching notice. The React payment form currently accepts the optional reference as data but does not validate its ownership or auto-fill its amount. The supplied HTML uses fictional in-memory records; an authoritative NBR notice API has not been supplied. Never present a free-form reference as verified.
2. **TIN identity verification.** v11's concept prototype knows six fictional TINs and rejects others. React validates a 12-digit format but deliberately has no authoritative taxpayer identity lookup. This is **not equivalent verification**.
3. **Signed-in payment drafts and eTDS allocation.** The v11 signed-in account flow contains separate authorization, rule-based draft recommendations, withholding-record allocation, and correction/ledger controls. Those journeys have not been exhaustively proven field-for-field against React by this mobile guest-form audit.
4. **Receipt lookup.** v11's guest lookup requires a payment reference paired with the receipt mobile; React supports that for guest receipts but also exposes preloaded sample receipt links from the established demo UI. It therefore is not a literal reproduction of the v11 guest lookup screen.
5. **Visual 1:1.** This is a source-field and interaction audit, not a pixel-by-pixel screenshot certificate at every viewport. The approved responsive layout remains intentionally different from the v11 standalone HTML.
6. **Payment effects.** Both are simulations. No live government payment, accounting, identity or Treasury integration is implied by UI matching.
7. **Newer multi-head enhancement.** After this audit began, main merged an approved calculation flow with more than one payment head and per-head amounts. The v11 guest form selects one head and uses one amount. This newer functionality was preserved during reconciliation; it is an intentional extension, not literal 1:1 guest-form parity.

### Verification in this work

- `npm run lint`
- `npm run test:domain` — 21/21 passing
- `npm run build`
- `git diff --check`
- Next gate: GitHub Actions responsive Playwright suite after publication. Do not mark production parity until that run and deployment are confirmed.
