/**
 * NBR Integrated Income Tax Payment Portal (TaxPay)
 * Domain & Financial State Model Definitions
 */

export type Language = 'en' | 'bn';

export type UserRole = 
  | 'GUEST' 
  | 'TAXPAYER_INDIVIDUAL' 
  | 'TAXPAYER_CORPORATE' 
  | 'WITHHOLDING_AGENT' 
  | 'OFFICER_MAKER' 
  | 'OFFICER_REVIEWER' 
  | 'OFFICER_APPROVER' 
  | 'COMMISSIONER_ADMIN';

export type PaymentCategory =
  | 'TAX_WITH_RETURN'      // S.173 ITA 2023
  | 'ADVANCE_TAX'          // S.154/155 ITA 2023
  | 'ASSESSED_DEMAND'      // S.214 Demand Notice
  | 'PENALTY'              // S.266/267 Late filing / concealment
  | 'SOURCE_TAX_DEPOSIT'   // Withholding TDS / TCS (Chapter VII)
  | 'APPELLATE_TRIBUNAL'   // S.300 Dispute / appeal deposit
  | 'OTHER_TAX_PAYMENT';   // Miscellaneous / Surcharge / Environment

export interface MasterPaymentHead {
  id: number;
  economicCode: string;
  nameEn: string;
  nameBn: string;
  category: PaymentCategory;
  sectionAct2023: string;
  sectionOrdinance1984: string;
  isWithholding: boolean;
  status: 'ACTIVE' | 'BLOCKED';
  verificationStatus: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED';
  rateNote?: string;
  blockedReason?: string;
}

export type TreasuryStatus = 
  | 'INITIATED' 
  | 'GATEWAY_PENDING' 
  | 'GATEWAY_SUCCESS' 
  | 'TREASURY_SCROLLED' 
  | 'FAILED' 
  | 'EXPIRED' 
  | 'REVERSED';

export type TaxCreditStatus = 
  | 'NOT_APPLICABLE'          // e.g. Withholding deposit cannot credit agent directly
  | 'PENDING_RECONCILIATION'  // Challan scrolled, waiting for tax ledger auto-posting
  | 'CREDITED_TO_LEDGER'     // Officially booked as tax credit under taxpayer TIN
  | 'CLAIMED_IN_RETURN'       // Claimed on e-Return filing
  | 'DISPUTED';

export interface TaxpayerProfile {
  tin: string;
  nid?: string;
  bin?: string;
  nameEn: string;
  nameBn: string;
  type: 'INDIVIDUAL' | 'COMPANY' | 'FIRM' | 'AOP';
  taxZone: string;
  taxCircle: string;
  phone: string;
  email: string;
  address: string;
  isWithholdingEntity: boolean;
  representativeScope?: {
    isAuthorized: boolean;
    representativeName?: string;
    representativeTin?: string;
    mandateExpiryDate?: string;
  };
}

export interface PaymentLineItem {
  headId: number;
  economicCode: string;
  headNameEn: string;
  taxAmount: number;
  penaltyAmount: number;
  surchargeAmount: number;
  interestAmount: number;
  totalAmount: number;
  note?: string;
}

export interface ChallanReceipt {
  id: string;
  taxEventId?: string;
  paymentTransactionId?: string;
  challanNo: string;
  tokenNumber: string;
  paymentCategory: PaymentCategory;
  assessmentYear: string;
  payerName: string;
  payerTin: string;
  isRepresentativePayment: boolean;
  representativeTin?: string;
  taxZone: string;
  taxCircle: string;
  isWithholding: boolean;
  deducteeTin?: string; // If withholding deposit
  deducteeName?: string;
  items: PaymentLineItem[];
  totalAmount: number;
  paymentMethod: 'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD' | 'BEFTN_RTGS' | 'INTERNET_BANKING' | 'VISA' | 'MASTERCARD' | 'BANK_BRANCH';
  gatewayTransactionId: string;
  treasuryScrollNo?: string;
  treasuryDate?: string;
  treasuryStatus: TreasuryStatus;
  taxCreditStatus: TaxCreditStatus;
  createdAt: string;
  completedAt?: string;
  isSimulatedDemo: true;
}

export interface TaxLedgerEntry {
  id: string;
  date: string;
  assessmentYear: string;
  challanNo: string;
  category: PaymentCategory;
  headCode: string;
  headName: string;
  debit: number;   // Tax liability/demand
  credit: number;  // Paid/Adjusted tax credit
  balance: number;
  status: 'CONFIRMED' | 'PROVISIONAL' | 'REVERSED';
  verifiedByNbr: boolean;
}

export interface CorrectionRequest {
  id: string;
  ticketNo: string;
  challanNo: string;
  taxpayerTin: string;
  taxpayerName: string;
  requestedBy: string;
  requestDate: string;
  currentAssessmentYear: string;
  proposedAssessmentYear: string;
  currentCircle: string;
  proposedCircle: string;
  currentHeadCode: string;
  proposedHeadCode: string;
  reason: string;
  evidenceDocName?: string;
  workflowStage: 'MAKER_SUBMITTED' | 'REVIEWER_CHECKED' | 'APPROVER_FINALIZED' | 'REJECTED';
  makerRemarks?: string;
  reviewerRemarks?: string;
  approverRemarks?: string;
  lastUpdated: string;
}

export interface CaseRecord {
  caseId: string;
  tin: string;
  taxpayerName: string;
  assessmentYear: string;
  issue: string;
  disputedAmount: number;
  stage: 'SHOW_CAUSE' | 'ASSESSMENT_ORDER' | 'APPEAL_COMMISSIONER' | 'TRIBUNAL' | 'HIGH_COURT';
  status: 'OPEN' | 'UNDER_REVIEW' | 'HEARING_SCHEDULED' | 'RESOLVED';
  assignedOfficer: string;
  openedDate: string;
  dueDate: string;
}

export interface IncidentReport {
  id: string;
  incidentNumber: string;
  reportDate: string;
  reporterName: string;
  reporterContact: string;
  category: 'PAYMENT_DEBITED_NO_CHALLAN' | 'WRONG_TIN_ATTRIBUTION' | 'GATEWAY_TIMEOUT' | 'UNAUTHORIZED_SUBMISSION' | 'OTHER';
  transactionReference: string;
  amount: number;
  gateway: string;
  description: string;
  status: 'SUBMITTED' | 'INVESTIGATING' | 'RECONCILED' | 'CLOSED';
  officerFindings?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  targetId: string;
  ipAddress: string;
  details: string;
  immutableHash: string;
}

export interface GatewayHealth {
  id: string;
  gatewayName: string;
  status: 'OPTIMAL' | 'DEGRADED' | 'DOWN';
  uptime24h: number;
  avgLatencyMs: number;
  successRate24h: number;
  activeIncidents: number;
  lastHeartbeat: string;
}
