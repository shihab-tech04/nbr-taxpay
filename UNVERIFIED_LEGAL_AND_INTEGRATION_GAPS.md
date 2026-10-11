# UNVERIFIED_LEGAL_AND_INTEGRATION_GAPS.md

## Legal Verification & System Integration Gaps Register

**Notice:** This document catalogs all unverified legal provisions, external workbook dependencies, and system integration boundaries that require official certification before production deployment.

---

## 1. Master Payment-Head Source Data Gap

- **Original Reference in v11:** `ACS_Section List.xlsx` / `R_NBR_LAW`
- **Current Status:** **SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED**
- **Issue:** The original Excel workbook was not provided in the controlled project inputs. The 170-record catalogue has been faithfully reconstructed from the embedded v11 array, but the statutory accuracy of every 13-digit economic code against the Ministry of Finance chart of accounts is uncertified.
- **Required Action:** National Board of Revenue (NBR) and Controller General of Accounts (CGA) must supply the official gazetted chart of economic codes to reconcile `src/data/paymentHeads.ts`.

---

## 2. Blocked Payment Heads (#5 & #150)

In strict accordance with project directives, the following payment heads are hard-blocked:

1. **Head ID #5:**  
   - *Code:* `1-1141-0010-0105`  
   - *Description:* Tax with Return - Special Retrospective Revision Surcharge  
   - *Status:* **BLOCKED FOR OWNER LEGAL REVIEW**  
   - *Block Reason:* Disputed statutory rate matrix under Schedule 2 Part B; pending NBR gazette reconciliation.

2. **Head ID #150:**  
   - *Code:* `1-1141-0040-0702`  
   - *Description:* Environmental Surcharge on Multiple Motor Vehicle Ownership  
   - *Status:* **BLOCKED FOR OWNER LEGAL REVIEW**  
   - *Block Reason:* Tiered engine displacement surcharge rules require formal gazette clarification between BRTA renewal collections and annual income tax return declarations.

---

## 3. Statutory Transition: ITO 1984 vs ITA 2023

The portal explicitly separates legacy numbering under the **Income Tax Ordinance 1984** from the current **Income Tax Act 2023**:

| Subject | Legacy Provision (ITO 1984) | Current Provision (ITA 2023) | Verification Note |
|---|---|---|---|
| Self-Assessed Tax with Return | Section 74 | Section 173 | Preserved with dual references |
| Advance Tax Quarterly Payment | Section 64 | Section 154 | Preserved with quarterly calendar |
| Universal Self-Assessment | Section 82BB | Section 180 | Preserved in return filing flow |
| Regular Assessment Demand Notice | Section 135 | Section 214 | Preserved in demand notices |
| Penalty for Delay / Default | Section 124 / 128 | Section 266 / 269 | Preserved in penalty categories |
| Withholding at Source (TDS/TCS) | Chapter VII (Sections 50–68) | Chapter VII (Sections 84–140) | Preserved across 80 withholding heads |
| Appellate Tribunal Deposit (10%) | Section 158 | Section 300 | Preserved in tribunal fee calculator |
| Administrative Re-attribution | Section 156 / Revision | Section 296 | Governs M-R-A correction queue |

---

## 4. Illustrative Financial Calculations

The following financial calculation routines are explicitly flagged as **UNVERIFIED DEMONSTRATION MATERIAL**:

1. **Foreign Travel Tax Rates:**
   - Air (North America, Europe, Oceania, Japan): BDT 6,000
   - Air (SAARC Countries): BDT 2,000
   - Air (Other Asian/Middle Eastern Countries): BDT 4,000
   - Land Border Checkposts: BDT 1,000
   - Maritime Sea Ports: BDT 2,000  
   *Gap:* Illustrative rates from v11 prototype. Must be audited against latest Finance Act / S.R.O. amendments.

2. **Progressive Tax Estimator Slabs:**
   - Basic Threshold: BDT 3,50,000 (General) / BDT 4,00,000 (Female/Senior) / BDT 4,75,000 (Disabled).
   - Tiered rates: 5%, 10%, 15%, 20%, 25%.
   - Minimum tax floor: BDT 5,000.  
   *Gap:* Preserved for interactive taxpayer guidance; must not be treated as a definitive legal tax assessment.

---

## 5. External System Integration Boundaries

The following external interfaces operate as local simulation adapters in `src/services/adapters.ts`:

- **e-TIN Master Service:** Local 12-digit validation logic only. No live lookup to `incometax.gov.bd`.
- **e-Return API:** Simulated credit sync only. No live API connection to `etaxnbr.gov.bd`.
- **e-Ledger API:** Local state double-entry ledger only.
- **e-TDS System:** Local deductee mapping only.
- **ACS / Bangladesh Bank Treasury:** Simulated A-Challan scroll generation (`BB-SCRL-...`). No live connection to Sonali Bank or Bangladesh Bank core banking systems.
- **Commercial Payment Gateways:** Simulated transaction IDs generated locally (`BKSH-...`, `NGD-...`, `SNB-...`). No live bank or MFS account debits.

---

## 6. Pre-Certification Checklist for Production

- [ ] Complete legal audit of 170 economic codes with Ministry of Finance chart of accounts.
- [ ] Formal gazette review and sign-off on Head #5 and Head #150 unblocking.
- [ ] End-to-end integration and mutual TLS (mTLS) certification with Sonali Bank ACS gateway.
- [ ] Automated webhook synchronization with NBR e-Return and e-Ledger production endpoints.
- [ ] Government security audit and vulnerability assessment by national cybersecurity agencies.
