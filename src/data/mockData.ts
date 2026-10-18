import { 
  TaxpayerProfile, 
  ChallanReceipt, 
  TaxLedgerEntry, 
  CorrectionRequest, 
  CaseRecord, 
  IncidentReport, 
  AuditLog, 
  GatewayHealth 
} from '../types/tax';

export const ASSESSMENT_YEARS = [
  '2025-2026',
  '2024-2025',
  '2023-2024',
  '2022-2023',
  '2021-2022'
];

export const DEMO_TAXPAYERS: Record<string, TaxpayerProfile> = {
  'INDIVIDUAL_REGULAR': {
    tin: 'DEMO-TIN-001',
    nid: 'DEMO-NID-001',
    nameEn: 'Synthetic demo taxpayer',
    nameBn: "ডেমো করদাতা ক",
    type: 'INDIVIDUAL',
    taxZone: 'Taxes Zone-08, Dhaka',
    taxCircle: 'Circle-164 (Mohakhali)',
    phone: 'Not provided (demo)',
    email: 'demo@example.invalid',
    address: "Demo address 1 (synthetic)",
    isWithholdingEntity: false,
    representativeScope: {
      isAuthorized: false
    }
  },
  'CORPORATE_ENTITY': {
    tin: 'DEMO-TIN-002',
    bin: 'DEMO-BIN-001',
    nameEn: 'Synthetic demo taxpayer',
    nameBn: "ডেমো করদাতা খ",
    type: 'COMPANY',
    taxZone: 'Large Taxpayers Unit (LTU) - Income Tax, Dhaka',
    taxCircle: 'Company Circle-02',
    phone: 'Not provided (demo)',
    email: 'demo@example.invalid',
    address: "Demo address 2 (synthetic)",
    isWithholdingEntity: true,
    representativeScope: {
      isAuthorized: true,
      representativeName: 'Demo representative',
      representativeTin: 'DEMO-TIN-004',
      mandateExpiryDate: '2026-12-31'
    }
  },
  'WITHHOLDING_DEDUCTOR': {
    tin: 'DEMO-TIN-003',
    bin: 'DEMO-BIN-001',
    nameEn: 'Synthetic demo taxpayer',
    nameBn: "ডেমো করদাতা গ",
    type: 'COMPANY',
    taxZone: 'Taxes Zone-02, Dhaka',
    taxCircle: 'Salary & Withholding Circle-35',
    phone: 'Not provided (demo)',
    email: 'demo@example.invalid',
    address: "Demo address 3 (synthetic)",
    isWithholdingEntity: true
  }
};

export const INITIAL_RECEIPTS: ChallanReceipt[] = [
  {
    id: 'rcpt-101',
    challanNo: 'AC-2025-09-DEMO-REF-001',
    tokenNumber: 'TKN-882190',
    paymentCategory: 'TAX_WITH_RETURN',
    assessmentYear: '2024-2025',
    payerName: 'Synthetic demo payer',
    payerTin: 'DEMO-TIN-001',
    isRepresentativePayment: false,
    taxZone: 'Taxes Zone-08, Dhaka',
    taxCircle: 'Circle-164 (Mohakhali)',
    isWithholding: false,
    items: [
      {
        headId: 1,
        economicCode: '1-1141-0010-0101',
        headNameEn: 'Tax with Return - Individual Taxpayers (Section 173)',
        taxAmount: 75000,
        penaltyAmount: 0,
        surchargeAmount: 7500,
        interestAmount: 0,
        totalAmount: 82500,
        note: 'Annual self-assessment return payment AY 2024-2025'
      }
    ],
    totalAmount: 82500,
    paymentMethod: 'BKASH',
    gatewayTransactionId: "DEMO-TXN-001",
    treasuryScrollNo: 'BB-SCRL-2024-88910',
    treasuryDate: '2024-11-28 14:22:10',
    treasuryStatus: 'TREASURY_SCROLLED',
    taxCreditStatus: 'CREDITED_TO_LEDGER',
    createdAt: '2024-11-28 14:18:02',
    completedAt: '2024-11-28 14:22:10',
    isSimulatedDemo: true
  },
  {
    id: 'rcpt-102',
    challanNo: 'AC-2025-06-DEMO-REF-003',
    tokenNumber: 'TKN-339102',
    paymentCategory: 'ADVANCE_TAX',
    assessmentYear: '2025-2026',
    payerName: 'Synthetic demo payer',
    payerTin: 'DEMO-TIN-001',
    isRepresentativePayment: false,
    taxZone: 'Taxes Zone-08, Dhaka',
    taxCircle: 'Circle-164 (Mohakhali)',
    isWithholding: false,
    items: [
      {
        headId: 11,
        economicCode: '1-1141-0015-0201',
        headNameEn: 'Advance Tax - 1st Quarter Installment (Section 154)',
        taxAmount: 25000,
        penaltyAmount: 0,
        surchargeAmount: 0,
        interestAmount: 0,
        totalAmount: 25000,
        note: 'Q1 Advance Tax for AY 2025-2026'
      }
    ],
    totalAmount: 25000,
    paymentMethod: 'NAGAD',
    gatewayTransactionId: "DEMO-TXN-002",
    treasuryScrollNo: 'BB-SCRL-2025-10293',
    treasuryDate: '2025-09-14 11:05:43',
    treasuryStatus: 'TREASURY_SCROLLED',
    taxCreditStatus: 'CREDITED_TO_LEDGER',
    createdAt: '2025-09-14 11:02:15',
    completedAt: '2025-09-14 11:05:43',
    isSimulatedDemo: true
  },
  {
    id: 'rcpt-103',
    challanNo: 'AC-2025-09-DEMO-REF-005',
    tokenNumber: 'TKN-551920',
    paymentCategory: 'SOURCE_TAX_DEPOSIT',
    assessmentYear: '2025-2026',
    payerName: 'Synthetic demo payer',
    payerTin: 'DEMO-TIN-002',
    isRepresentativePayment: false,
    taxZone: 'Large Taxpayers Unit (LTU) - Income Tax, Dhaka',
    taxCircle: 'Company Circle-02',
    isWithholding: true,
    deducteeTin: 'DEMO-TIN-001',
    deducteeName: 'Synthetic demo payee',
    items: [
      {
        headId: 64,
        economicCode: '1-1141-0030-0509',
        headNameEn: 'TDS on Professional, Technical & Consultancy Fees (Section 94)',
        taxAmount: 12000,
        penaltyAmount: 0,
        surchargeAmount: 0,
        interestAmount: 0,
        totalAmount: 12000,
        note: 'TDS withheld from invoice #BTI-2025-091'
      }
    ],
    totalAmount: 12000,
    paymentMethod: 'SONALI_E_SHEBA',
    gatewayTransactionId: "DEMO-TXN-003",
    treasuryScrollNo: 'BB-SCRL-2025-44910',
    treasuryDate: '2025-09-20 16:30:00',
    treasuryStatus: 'TREASURY_SCROLLED',
    // CRITICAL DOMAIN DISTINCTION:
    // Withholding deposit does NOT become the withholding agent's own tax credit!
    taxCreditStatus: 'NOT_APPLICABLE',
    createdAt: '2025-09-20 16:20:10',
    completedAt: '2025-09-20 16:30:00',
    isSimulatedDemo: true
  },
  {
    id: 'rcpt-104',
    challanNo: 'AC-2025-10-DEMO-REF-006',
    tokenNumber: 'TKN-918234',
    paymentCategory: 'ASSESSED_DEMAND',
    assessmentYear: '2023-2024',
    payerName: 'Synthetic demo payer',
    payerTin: 'DEMO-TIN-001',
    isRepresentativePayment: false,
    taxZone: 'Taxes Zone-08, Dhaka',
    taxCircle: 'Circle-164 (Mohakhali)',
    isWithholding: false,
    items: [
      {
        headId: 26,
        economicCode: '1-1141-0020-0301',
        headNameEn: 'Assessed Demand under Section 214 (Regular Assessment)',
        taxAmount: 40000,
        penaltyAmount: 5000,
        surchargeAmount: 0,
        interestAmount: 2400,
        totalAmount: 47400,
        note: 'Demand Notice DN-2023-164-90'
      }
    ],
    totalAmount: 47400,
    paymentMethod: 'A_CHALLAN_CARD',
    gatewayTransactionId: "DEMO-TXN-004",
    treasuryStatus: 'GATEWAY_PENDING',
    taxCreditStatus: 'PENDING_RECONCILIATION',
    createdAt: '2026-10-09 19:15:20',
    isSimulatedDemo: true
  }
];

export const INITIAL_LEDGER_ENTRIES: TaxLedgerEntry[] = [
  {
    id: 'led-01',
    date: '2024-07-01',
    assessmentYear: '2024-2025',
    challanNo: 'N/A (Opening Liability)',
    category: 'TAX_WITH_RETURN',
    headCode: '1-1141-0010-0101',
    headName: 'Assessed Tax Liability for AY 2024-2025',
    debit: 112500,
    credit: 0,
    balance: -112500,
    status: 'CONFIRMED',
    verifiedByNbr: true
  },
  {
    id: 'led-02',
    date: '2024-09-15',
    assessmentYear: '2024-2025',
    challanNo: 'AC-2024-09-DEMO-REF-008',
    category: 'ADVANCE_TAX',
    headCode: '1-1141-0015-0201',
    headName: 'Q1 Advance Tax payment Section 154',
    debit: 0,
    credit: 30000,
    balance: -82500,
    status: 'CONFIRMED',
    verifiedByNbr: true
  },
  {
    id: 'led-03',
    date: '2024-11-28',
    assessmentYear: '2024-2025',
    challanNo: 'AC-2025-09-DEMO-REF-001',
    category: 'TAX_WITH_RETURN',
    headCode: '1-1141-0010-0101',
    headName: 'Tax with Return Section 173',
    debit: 0,
    credit: 82500,
    balance: 0,
    status: 'CONFIRMED',
    verifiedByNbr: true
  },
  {
    id: 'led-04',
    date: '2025-09-14',
    assessmentYear: '2025-2026',
    challanNo: 'AC-2025-06-DEMO-REF-003',
    category: 'ADVANCE_TAX',
    headCode: '1-1141-0015-0201',
    headName: 'Q1 Advance Tax payment Section 154',
    debit: 0,
    credit: 25000,
    balance: 25000,
    status: 'CONFIRMED',
    verifiedByNbr: true
  },
  {
    id: 'led-05',
    date: '2025-09-20',
    assessmentYear: '2025-2026',
    challanNo: 'AC-2025-09-DEMO-REF-005',
    category: 'SOURCE_TAX_DEPOSIT',
    headCode: '1-1141-0030-0509',
    headName: 'TDS on Consultancy Fees deducted by Demo Business Ltd.',
    debit: 0,
    credit: 12000,
    balance: 37000,
    status: 'CONFIRMED',
    verifiedByNbr: true
  }
];

export const INITIAL_CORRECTIONS: CorrectionRequest[] = [
  {
    id: 'corr-01',
    ticketNo: 'CORR-2026-00412',
    challanNo: 'AC-2025-06-DEMO-REF-003',
    taxpayerTin: 'DEMO-TIN-001',
    taxpayerName: 'Synthetic demo taxpayer',
    requestedBy: 'Synthetic demo requester',
    requestDate: '2026-09-18',
    currentAssessmentYear: '2024-2025',
    proposedAssessmentYear: '2025-2026',
    currentCircle: 'Circle-164 (Mohakhali)',
    proposedCircle: 'Circle-164 (Mohakhali)',
    currentHeadCode: '1-1141-0015-0201',
    proposedHeadCode: '1-1141-0015-0201',
    reason: 'Payer accidentally selected AY 2024-2025 instead of AY 2025-2026 during Q1 advance tax submission.',
    evidenceDocName: "DEMO-EVIDENCE-001.pdf",
    workflowStage: 'REVIEWER_CHECKED',
    makerRemarks: 'Verified bank debit and date of remittance. Mismatch confirmed.',
    reviewerRemarks: 'Tax liability for 2024-2025 already finalized. Safe to migrate to 2025-2026. Recommended for Approver sanction.',
    lastUpdated: '2026-10-02 11:20:00'
  },
  {
    id: 'corr-02',
    ticketNo: 'CORR-2026-00389',
    challanNo: 'AC-2024-12-DEMO-REF-009',
    taxpayerTin: 'DEMO-TIN-002',
    taxpayerName: 'Synthetic demo taxpayer',
    requestedBy: 'Synthetic demo requester',
    requestDate: '2026-08-11',
    currentAssessmentYear: '2024-2025',
    proposedAssessmentYear: '2024-2025',
    currentCircle: 'Company Circle-05 (Wrong Circle)',
    proposedCircle: 'Company Circle-02 (LTU Dhaka)',
    currentHeadCode: '1-1141-0030-0504',
    proposedHeadCode: '1-1141-0030-0504',
    reason: 'Deposit scroll assigned to Circle-05 due to legacy jurisdiction code in gateway dropdown.',
    evidenceDocName: "DEMO-EVIDENCE-002.pdf",
    workflowStage: 'APPROVER_FINALIZED',
    makerRemarks: 'Circle-05 confirmed no ongoing file. File belongs to Company Circle-02 LTU.',
    reviewerRemarks: 'Endorsed.',
    approverRemarks: 'Approved under Section 296 administrative rectification powers. Scrolled to Circle-02.',
    lastUpdated: '2026-08-25 15:40:00'
  }
];

export const INITIAL_CASES: CaseRecord[] = [
  {
    caseId: 'CASE-2026-8812',
    tin: 'DEMO-TIN-001',
    taxpayerName: 'Synthetic demo taxpayer',
    assessmentYear: '2023-2024',
    issue: 'Discrepancy between declared consultancy revenue and e-TDS statement deduction of BDT 1,20,000.',
    disputedAmount: 47400,
    stage: 'ASSESSMENT_ORDER',
    status: 'HEARING_SCHEDULED',
    assignedOfficer: 'Demo tax officer',
    openedDate: '2026-07-15',
    dueDate: '2026-10-25'
  },
  {
    caseId: 'CASE-2026-9041',
    tin: 'DEMO-TIN-002',
    taxpayerName: 'Synthetic demo taxpayer',
    assessmentYear: '2022-2023',
    issue: 'Transfer pricing benchmark audit for cross-border software export royalty charges.',
    disputedAmount: 450000,
    stage: 'TRIBUNAL',
    status: 'UNDER_REVIEW',
    assignedOfficer: 'Demo tax officer',
    openedDate: '2025-11-04',
    dueDate: '2026-11-15'
  }
];

export const INITIAL_INCIDENTS: IncidentReport[] = [
  {
    id: 'inc-01',
    incidentNumber: 'INC-2026-1092',
    reportDate: '2026-10-08 17:35:00',
    reporterName: 'Demo reporter',
    reporterContact: 'Not provided (demo)',
    category: 'PAYMENT_DEBITED_NO_CHALLAN',
    transactionReference: 'BKSH-TXN-DEMO-REF-010',
    amount: 15000,
    gateway: 'bKash MFS',
    description: 'Amount of BDT 15,000 was debited from personal bKash wallet for return tax payment, but portal timed out and displayed "Session Expired" without generating A-Challan receipt or token.',
    status: 'INVESTIGATING',
    officerFindings: 'Demonstration-only note; no external bank, Treasury, or taxpayer records were queried.'
  },
  {
    id: 'inc-02',
    incidentNumber: 'INC-2026-1085',
    reportDate: '2026-10-04 10:15:00',
    reporterName: 'Demo reporter',
    reporterContact: 'Not provided (demo)',
    category: 'WRONG_TIN_ATTRIBUTION',
    transactionReference: 'NGD-TXN-DEMO-REF-011',
    amount: 5000,
    gateway: 'Nagad Postal MFS',
    description: 'Travel tax payment was attributed to a typographical single digit mismatch in TIN input during public guest checkout.',
    status: 'RECONCILED',
    officerFindings: 'Demonstration-only note; no external bank, Treasury, or taxpayer records were queried.'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-01',
    timestamp: '2026-10-09 20:15:22',
    actor: 'Demo officer',
    actorRole: 'OFFICER_MAKER',
    action: 'INITIATE_CORRECTION_PROPOSAL',
    targetId: 'CORR-2026-00412',
    ipAddress: "192.0.2.101",
    details: 'Initiated correction proposal to re-attribute Challan AC-2025-06-DEMO-REF-003 from AY 2024-2025 to AY 2025-2026.',
    immutableHash: 'a7f9c2e0b51829d4c3a1e94819d2b7c6'
  },
  {
    id: 'aud-02',
    timestamp: '2026-10-09 19:40:11',
    actor: 'Demo officer',
    actorRole: 'OFFICER_REVIEWER',
    action: 'REVIEW_CORRECTION_SUBMISSION',
    targetId: 'CORR-2026-00412',
    ipAddress: "192.0.2.102",
    details: 'Reviewed and endorsed correction ticket CORR-2026-00412 for Approver sanction.',
    immutableHash: 'c12d48a9b703e192f8a4918230b5d8e7'
  },
  {
    id: 'aud-03',
    timestamp: '2026-10-09 18:22:05',
    actor: 'Demo officer',
    actorRole: 'OFFICER_APPROVER',
    action: 'SANCTION_JURISDICTION_TRANSFER',
    targetId: 'CORR-2026-00389',
    ipAddress: "192.0.2.103",
    details: 'Sanctioned final jurisdiction migration of Challan AC-2024-12-DEMO-REF-009 to Company Circle-02 LTU Dhaka.',
    immutableHash: 'f48209da7b1348c6910e98214b72ca31'
  }
];

export const INITIAL_GATEWAY_HEALTH: GatewayHealth[] = [
  {
    id: 'gw-01',
    gatewayName: "Demo Gateway 1",
    status: 'OPTIMAL',
    uptime24h: 99.98,
    avgLatencyMs: 240,
    successRate24h: 99.4,
    activeIncidents: 0,
    lastHeartbeat: 'Just now'
  },
  {
    id: 'gw-02',
    gatewayName: "Demo Gateway 2",
    status: 'OPTIMAL',
    uptime24h: 99.85,
    avgLatencyMs: 310,
    successRate24h: 98.7,
    activeIncidents: 1,
    lastHeartbeat: '1 min ago'
  },
  {
    id: 'gw-03',
    gatewayName: "Demo Gateway 3",
    status: 'OPTIMAL',
    uptime24h: 99.60,
    avgLatencyMs: 420,
    successRate24h: 97.9,
    activeIncidents: 0,
    lastHeartbeat: '2 mins ago'
  },
  {
    id: 'gw-04',
    gatewayName: "Demo Gateway 4",
    status: 'DEGRADED',
    uptime24h: 98.10,
    avgLatencyMs: 890,
    successRate24h: 94.2,
    activeIncidents: 2,
    lastHeartbeat: '5 mins ago'
  },
  {
    id: 'gw-05',
    gatewayName: "Demo Gateway 5",
    status: 'OPTIMAL',
    uptime24h: 99.92,
    avgLatencyMs: 350,
    successRate24h: 99.1,
    activeIncidents: 0,
    lastHeartbeat: 'Just now'
  },
  {
    id: 'gw-06',
    gatewayName: "Demo Gateway 6",
    status: 'OPTIMAL',
    uptime24h: 99.99,
    avgLatencyMs: 180,
    successRate24h: 99.8,
    activeIncidents: 0,
    lastHeartbeat: 'Just now'
  }
];

export const TRAVEL_TAX_RATES = [
  {
    route: 'By air to North America, South America, Europe, Africa, Australia, New Zealand, China, Japan, Hong Kong, North Korea, Vietnam, Laos, Cambodia or Taiwan',
    routeBn: 'আকাশ পথে উত্তর আমেরিকা, দক্ষিণ আমেরিকা, ইউরোপ, আফ্রিকা, অস্ট্রেলিয়া, নিউজিল্যান্ড, চীন, জাপান, হংকং, উত্তর কোরিয়া, ভিয়েতনাম, লাওস, কম্বোডিয়া বা তাইওয়ান',
    amount: 6000,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED (ILLUSTRATIVE DEMO)'
  },
  {
    route: 'By air to a SAARC country',
    routeBn: 'আকাশ পথে সার্কভুক্ত কোনো দেশে',
    amount: 2000,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED (ILLUSTRATIVE DEMO)'
  },
  {
    route: 'By air to any other country',
    routeBn: 'আকাশ পথে অন্য কোনো দেশে',
    amount: 4000,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED (ILLUSTRATIVE DEMO)'
  },
  {
    route: 'By air within Bangladesh',
    routeBn: 'আকাশ পথে দেশের অভ্যন্তরে',
    amount: 200,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'Simulation rate from the supplied NBR v11 HTML'
  },
  {
    route: 'By land to any country',
    routeBn: 'স্থল পথে যেকোনো দেশে',
    amount: 1000,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED (ILLUSTRATIVE DEMO)'
  },
  {
    route: 'By water to any country',
    routeBn: 'জল পথে যেকোনো দেশে',
    amount: 1000,
    statutoryRef: 'Section 3, Travel Tax Act 2003 (S.R.O. 2023)',
    statusNote: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED (ILLUSTRATIVE DEMO)'
  }
];
