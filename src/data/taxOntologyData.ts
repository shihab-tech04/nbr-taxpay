/**
 * NBR TaxPay Concept Ontology
 * 
 * LEGAL NOTICE:
 * This ontology is a draft product model and data architecture schema,
 * NOT approved statutory law or gazetted NBR rules.
 */

export interface OntologyNode {
  id: string;
  nameEn: string;
  nameBn: string;
  category: 'LEGAL_ENTITY' | 'OBLIGATION' | 'FINANCIAL_EVENT' | 'RECONCILIATION_PRIMITIVE' | 'GOVERNANCE';
  definition: string;
  statutoryReference?: string;
  rules: string[];
  relationships: { target: string; relation: string }[];
}

export const TAX_ONTOLOGY_NODES: OntologyNode[] = [
  {
    id: 'TAXPAYER',
    nameEn: 'Taxpayer (Cor-data)',
    nameBn: 'করদাতা (ব্যক্তি / কোম্পানি / প্রতিষ্ঠান)',
    category: 'LEGAL_ENTITY',
    definition: 'A natural person or juridical entity holding a 12-digit Taxpayer Identification Number (e-TIN) who has assessable income or statutory filing obligation under the Income Tax Act 2023.',
    statutoryReference: 'Section 2(31), Income Tax Act 2023',
    rules: [
      'Must possess an authentic 12-digit e-TIN.',
      'Only the taxpayer holding the designated TIN is entitled to claim tax credits booked against that TIN.',
      'A payer who is not the taxpayer cannot claim tax credits without representative authorization.'
    ],
    relationships: [
      { target: 'OBLIGATION', relation: 'incurs' },
      { target: 'TAX_CREDIT', relation: 'holds_title_to' },
      { target: 'REPRESENTATIVE', relation: 'may_authorize' }
    ]
  },
  {
    id: 'PAYER',
    nameEn: 'Payer (Ortho-prodan-kari)',
    nameBn: 'অর্থপ্রদানকারী (প্রকৃত প্রদানকারী ব্যক্তি বা মাধ্যম)',
    category: 'LEGAL_ENTITY',
    definition: 'The individual, entity, or authorized agent who physically or electronically transmits money through the payment gateway.',
    statutoryReference: 'Payment Gateway Regulations & Treasury Rules',
    rules: [
      'The payer may be the taxpayer themselves, an authorized representative, or a withholding agent.',
      'Payer status alone does NOT confer tax credit entitlement unless the payer is the beneficiary taxpayer.'
    ],
    relationships: [
      { target: 'PAYMENT_TRANSACTION', relation: 'initiates' },
      { target: 'TAXPAYER', relation: 'acts_on_behalf_of' }
    ]
  },
  {
    id: 'WITHHOLDING_AGENT',
    nameEn: 'Withholding Deducting Authority',
    nameBn: 'উৎসে কর কর্তনকারী কর্তৃপক্ষ',
    category: 'LEGAL_ENTITY',
    definition: 'A designated person or organization mandated under Chapter VII of ITA 2023 to deduct or collect tax at source from payments to suppliers, employees, contractors, etc.',
    statutoryReference: 'Chapter VII, Income Tax Act 2023',
    rules: [
      'Withholding agent deposits MUST be attributed to the deductee (beneficiary supplier/employee).',
      'The agent is strictly a custodian of government revenue.',
      'A withholding deposit challan CANNOT be credited to the withholding agent\'s personal or corporate income tax ledger.'
    ],
    relationships: [
      { target: 'TREASURY_RECEIPT', relation: 'deposits_as_custodian' },
      { target: 'TAX_CREDIT', relation: 'generates_for_deductee' }
    ]
  },
  {
    id: 'ASSESSMENT_YEAR',
    nameEn: 'Assessment Year (AY)',
    nameBn: 'করবর্ষ (আর্থিক বছর পরবর্তী ১২ মাস)',
    category: 'OBLIGATION',
    definition: 'The statutory 12-month period commencing on the 1st of July during which income of the immediately preceding income year is assessed to tax.',
    statutoryReference: 'Section 2(9), Income Tax Act 2023',
    rules: [
      'Tax payments and advance tax must be strictly assigned to a specific assessment year.',
      'Mismatches between income year and assessment year require formal Maker-Reviewer-Approver correction.'
    ],
    relationships: [
      { target: 'OBLIGATION', relation: 'defines_scope_of' },
      { target: 'TREASURY_RECEIPT', relation: 'earmarks' }
    ]
  },
  {
    id: 'PAYMENT_HEAD',
    nameEn: 'Master Payment Head (Accounting Code)',
    nameBn: 'প্রদেয় খাত ও অর্থনৈতিক কোড',
    category: 'FINANCIAL_EVENT',
    definition: 'Standard 13-digit Treasury economic accounting code specifying the exact legal category of tax (Return tax, Advance tax, Demand, Penalty, TDS, Tribunal deposit).',
    statutoryReference: 'Treasury Code & ACS Classification',
    rules: [
      'Payment head selection is immutable once Treasury scroll is generated.',
      'Blocked heads (#5 and #150) cannot be transacted without manual commissioner override.'
    ],
    relationships: [
      { target: 'PAYMENT_TRANSACTION', relation: 'classifies' },
      { target: 'TREASURY_RECEIPT', relation: 'posts_to' }
    ]
  },
  {
    id: 'PAYMENT_TRANSACTION',
    nameEn: 'Payment Gateway Transaction',
    nameBn: 'পেমেন্ট গেটওয়ে লেনদেন',
    category: 'FINANCIAL_EVENT',
    definition: 'Electronic transaction executed through MFS (bKash/Nagad/Rocket), Sonali Bank, card switch, or RTGS/BEFTN.',
    statutoryReference: 'Bangladesh Bank PSD Directives',
    rules: [
      'Successful payment gateway debit does NOT equal official Treasury deposit until scrolled.',
      'Gateway timeout triggers automatic reconciliation job.'
    ],
    relationships: [
      { target: 'TREASURY_RECEIPT', relation: 'generates_upon_clearance' }
    ]
  },
  {
    id: 'TREASURY_RECEIPT',
    nameEn: 'Treasury A-Challan Receipt',
    nameBn: 'সরকারি এ-চালান রসিদ',
    category: 'FINANCIAL_EVENT',
    definition: 'Official Bangladesh Treasury receipt confirming remittance into Government Account (1-1141-XXXX-XXXX) verified by Sonali Bank / Bangladesh Bank scroll.',
    statutoryReference: 'Bangladesh Treasury Rules (BTR)',
    rules: [
      'Contains verified Challan Number, Token Number, date, and security watermark.',
      'A valid challan confirms Treasury deposit; however, tax credit recognition requires taxpayer TIN verification.'
    ],
    relationships: [
      { target: 'TAX_CREDIT', relation: 'underpins' },
      { target: 'AUDIT_LOG', relation: 'registers' }
    ]
  },
  {
    id: 'TAX_CREDIT',
    nameEn: 'Recognized Tax Credit',
    nameBn: 'স্বীকৃত কর জমা / রেয়াত',
    category: 'RECONCILIATION_PRIMITIVE',
    definition: 'Statutory credit posted to a specific taxpayer\'s permanent ledger that can be adjusted against income tax assessment demands or annual return liabilities.',
    statutoryReference: 'Section 173 & Section 154, Income Tax Act 2023',
    rules: [
      'Generated only when Treasury receipt is matched to a validated taxpayer TIN.',
      'Withholding receipts create credit for the DEDUCTEE, never the deducting agent.',
      'Cannot be duplicated or claimed across multiple assessment years without formal reversal.'
    ],
    relationships: [
      { target: 'TAXPAYER', relation: 'benefits' },
      { target: 'TAX_LEDGER', relation: 'recorded_in' }
    ]
  },
  {
    id: 'MAKER_REVIEWER_APPROVER',
    nameEn: 'Three-Tier Officer Governance (M-R-A)',
    nameBn: 'ত্রৈমাসিক কর্মকর্তা অনুমোদন কাঠামো (মেকার-রিভিউয়ার-অ্যাপ্রুভার)',
    category: 'GOVERNANCE',
    definition: 'Mandatory internal control workflow where an Assistant Commissioner (Maker) drafts a correction or adjustment, an Inspecting Joint/Additional Commissioner (Reviewer) verifies it, and the Commissioner of Taxes (Approver) grants final statutory sanction.',
    statutoryReference: 'Income Tax Rules & Delegation of Financial Powers',
    rules: [
      'No single officer can initiate and finalize a taxpayer ledger correction.',
      'Demonstration actions appear in an in-memory log; persistence and tamper resistance are not established.'
    ],
    relationships: [
      { target: 'CORRECTION_REQUEST', relation: 'adjudicates' },
      { target: 'AUDIT_LOG', relation: 'records_all_steps_in' }
    ]
  }
];
