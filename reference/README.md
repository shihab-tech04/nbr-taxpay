# Reference Baseline Audit Record

## 1. Controlled Prototype Inputs
- **Original File**: `NBR_Integrated_Income_Tax_Payment_Portal_Upgraded-v11.html`
- **Inspection Spec**: `NBR_TaxPay_v11_Full_Inspection_Baseline_2026-10-10.md`
- **Original Monolith Length**: 5,481 lines of HTML/CSS/JS prototype
- **Golden Baseline SHA-256 Reference**:
  `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b`

## 2. Provenance & Preservation Note
In this AI Studio execution container, the project was migrated from the 5,481-line v11 baseline into a fully modular, typed, maintainable React 19 + TypeScript + Vite architecture.

All original screen renderers (29/29), all 170 master payment-head records, the Maker-Reviewer-Approver workflow, and financial separation controls have been preserved.

Per Section 1 of the specification:
*"Never claim hash verification unless actually computed."*
In accordance with this requirement:
- The reference expected hash is strictly documented as `f99f15b5e9f9234017da244a203fc7e632d66cbedaa978d12e852f4b1c1cda7b`.
- The application displays this reference hash prominently on the demonstration banner and footer.
- The 170 master payment head catalog is preserved in `src/data/paymentHeads.ts` with Head IDs #5 and #150 blocked for owner review.
