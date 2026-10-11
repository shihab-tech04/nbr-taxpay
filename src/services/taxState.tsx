import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Language, 
  UserRole, 
  ChallanReceipt, 
  TaxLedgerEntry, 
  CorrectionRequest, 
  CaseRecord, 
  IncidentReport, 
  AuditLog, 
  GatewayHealth,
  TaxpayerProfile
} from '../types/tax';
import { 
  DEMO_TAXPAYERS, 
  INITIAL_RECEIPTS, 
  INITIAL_LEDGER_ENTRIES, 
  INITIAL_CORRECTIONS, 
  INITIAL_CASES, 
  INITIAL_INCIDENTS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_GATEWAY_HEALTH 
} from '../data/mockData';

export interface TaxStateContextType {
  currentRoute: string;
  routeParams: Record<string, any>;
  navigate: (route: string, params?: Record<string, any>) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  taxpayerProfile: TaxpayerProfile;
  receipts: ChallanReceipt[];
  selectedReceipt: ChallanReceipt | null;
  selectReceipt: (id: string | null) => void;
  ledgerEntries: TaxLedgerEntry[];
  corrections: CorrectionRequest[];
  cases: CaseRecord[];
  incidents: IncidentReport[];
  auditLogs: AuditLog[];
  gatewayHealth: GatewayHealth[];
  isParityModalOpen: boolean;
  setIsParityModalOpen: (open: boolean) => void;
  addPaymentReceipt: (receipt: ChallanReceipt) => void;
  addCorrectionRequest: (corr: Omit<CorrectionRequest, 'id' | 'ticketNo' | 'lastUpdated'>) => string;
  advanceCorrectionWorkflow: (id: string, stage: CorrectionRequest['workflowStage'], remarks: string) => void;
  addIncidentReport: (inc: Omit<IncidentReport, 'id' | 'incidentNumber' | 'reportDate' | 'status'>) => string;
  logAuditAction: (action: string, targetId: string, details: string) => void;
  lookupReceipt: (query: string) => ChallanReceipt | undefined;
}

const TaxStateContext = createContext<TaxStateContextType | undefined>(undefined);

export const TaxStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    // Office login is the landing entry. Explicit deep links keep their existing routes.
    const action = new URLSearchParams(window.location.search).get('action');
    return action || 'office_login';
  });
  const [routeParams, setRouteParams] = useState<Record<string, any>>({});
  const [language, setLanguage] = useState<Language>('en');
  const [userRole, setUserRole] = useState<UserRole>('GUEST');
  
  const [receipts, setReceipts] = useState<ChallanReceipt[]>(INITIAL_RECEIPTS);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [ledgerEntries] = useState<TaxLedgerEntry[]>(INITIAL_LEDGER_ENTRIES);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>(INITIAL_CORRECTIONS);
  const [cases] = useState<CaseRecord[]>(INITIAL_CASES);
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [gatewayHealth] = useState<GatewayHealth[]>(INITIAL_GATEWAY_HEALTH);
  const [isParityModalOpen, setIsParityModalOpen] = useState<boolean>(false);

  // Sync role to taxpayer profile
  const taxpayerProfile: TaxpayerProfile = 
    userRole === 'TAXPAYER_CORPORATE'
      ? DEMO_TAXPAYERS['CORPORATE_ENTITY']
      : userRole === 'WITHHOLDING_AGENT'
      ? DEMO_TAXPAYERS['WITHHOLDING_DEDUCTOR']
      : DEMO_TAXPAYERS['INDIVIDUAL_REGULAR'];

  const navigate = (route: string, params: Record<string, any> = {}) => {
    setCurrentRoute(route);
    setRouteParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectReceipt = (id: string | null) => {
    setSelectedReceiptId(id);
    if (id) {
      setCurrentRoute('payment_details');
    }
  };

  const selectedReceipt = receipts.find(r => r.id === selectedReceiptId) || receipts[0] || null;

  const logAuditAction = (action: string, targetId: string, details: string) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: userRole,
      actorRole: userRole,
      action,
      targetId,
      ipAddress: '10.24.110.88',
      details,
      immutableHash: Math.random().toString(16).substring(2, 18) + Math.random().toString(16).substring(2, 18)
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addPaymentReceipt = (receipt: ChallanReceipt) => {
    setReceipts(prev => [receipt, ...prev]);
    
    // A newly generated demonstration receipt cannot establish a tax credit.
    // A separate authoritative reconciliation and entitlement event must control ledger posting.

    logAuditAction(
      'CHALLAN_ISSUED',
      receipt.challanNo,
      `Challan generated for ${receipt.payerName} (TIN: ${receipt.payerTin}), Amount: BDT ${receipt.totalAmount}`
    );
  };

  const addCorrectionRequest = (corrData: Omit<CorrectionRequest, 'id' | 'ticketNo' | 'lastUpdated'>): string => {
    const ticketNo = `CORR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newCorr: CorrectionRequest = {
      ...corrData,
      id: `corr-${Date.now()}`,
      ticketNo,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    setCorrections(prev => [newCorr, ...prev]);
    logAuditAction('CORRECTION_INITIATED', ticketNo, `Correction request initiated for Challan ${corrData.challanNo}`);
    return ticketNo;
  };

  const advanceCorrectionWorkflow = (id: string, stage: CorrectionRequest['workflowStage'], remarks: string) => {
    setCorrections(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          workflowStage: stage,
          ...(stage === 'REVIEWER_CHECKED' ? { reviewerRemarks: remarks } : {}),
          ...(stage === 'APPROVER_FINALIZED' ? { approverRemarks: remarks } : {}),
          ...(stage === 'REJECTED' ? { approverRemarks: `Rejected: ${remarks}` } : {}),
          lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
      }
      return c;
    }));
    logAuditAction('CORRECTION_STAGE_TRANSITION', id, `Correction workflow transitioned to ${stage}. Remarks: ${remarks}`);
  };

  const addIncidentReport = (incData: Omit<IncidentReport, 'id' | 'incidentNumber' | 'reportDate' | 'status'>): string => {
    const incNumber = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInc: IncidentReport = {
      ...incData,
      id: `inc-${Date.now()}`,
      incidentNumber: incNumber,
      reportDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'SUBMITTED'
    };
    setIncidents(prev => [newInc, ...prev]);
    logAuditAction('INCIDENT_SUBMITTED', incNumber, `Incident reported by ${incData.reporterName} for Ref: ${incData.transactionReference}`);
    return incNumber;
  };

  const lookupReceipt = (query: string): ChallanReceipt | undefined => {
    const clean = query.trim().toUpperCase();
    return receipts.find(r => 
      r.challanNo.toUpperCase() === clean || 
      r.tokenNumber.toUpperCase() === clean ||
      r.gatewayTransactionId.toUpperCase() === clean
    );
  };

  return (
    <TaxStateContext.Provider
      value={{
        currentRoute,
        routeParams,
        navigate,
        language,
        setLanguage,
        userRole,
        setUserRole,
        taxpayerProfile,
        receipts,
        selectedReceipt,
        selectReceipt,
        ledgerEntries,
        corrections,
        cases,
        incidents,
        auditLogs,
        gatewayHealth,
        isParityModalOpen,
        setIsParityModalOpen,
        addPaymentReceipt,
        addCorrectionRequest,
        advanceCorrectionWorkflow,
        addIncidentReport,
        logAuditAction,
        lookupReceipt
      }}
    >
      {children}
    </TaxStateContext.Provider>
  );
};

export const useTaxState = (): TaxStateContextType => {
  const context = useContext(TaxStateContext);
  if (!context) {
    throw new Error('useTaxState must be used within a TaxStateProvider');
  }
  return context;
};
