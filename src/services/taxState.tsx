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
import { getDemoUser, type DemoUser } from '../data/demoUsers';
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
  demoUser: DemoUser | null;
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
    // Public payment discovery is the primary citizen entry. The existing office-login demo remains available by explicit deep link.
    const action = new URLSearchParams(window.location.search).get('action');
    return action || 'landing';
  });
  const [routeParams, setRouteParams] = useState<Record<string, any>>({});
  const [language, setLanguage] = useState<Language>('en');
  const [demoUser] = useState<DemoUser | null>(() => getDemoUser(new URLSearchParams(window.location.search).get('demoUser')));
  const [userRole, setUserRole] = useState<UserRole>(() => getDemoUser(new URLSearchParams(window.location.search).get('demoUser'))?.role ?? 'GUEST');
  
  const [receipts, setReceipts] = useState<ChallanReceipt[]>(INITIAL_RECEIPTS);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [ledgerEntries] = useState<TaxLedgerEntry[]>(INITIAL_LEDGER_ENTRIES);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>(INITIAL_CORRECTIONS);
  const [cases] = useState<CaseRecord[]>(INITIAL_CASES);
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [gatewayHealth] = useState<GatewayHealth[]>(INITIAL_GATEWAY_HEALTH);
  const [isParityModalOpen, setIsParityModalOpen] = useState<boolean>(false);

  // Never conflate multiple fictional demo users under one taxpayer identifier.
  // URL demo slots are NOT authenticated persons or tax-credit owners.
  const baseTaxpayerProfile: TaxpayerProfile = userRole === 'TAXPAYER_CORPORATE'
      ? DEMO_TAXPAYERS['CORPORATE_ENTITY']
      : userRole === 'WITHHOLDING_AGENT'
      ? DEMO_TAXPAYERS['WITHHOLDING_DEDUCTOR']
      : DEMO_TAXPAYERS['INDIVIDUAL_REGULAR'];
  const taxpayerProfile: TaxpayerProfile = demoUser
    ? {...baseTaxpayerProfile,tin:`DEMO-TIN-${demoUser.id.slice(4).padStart(3,'0')}`,
        nameEn:demoUser.id,nameBn:`নমুনা ${demoUser.id}`,
        email:'demo@example.invalid',phone:'Not provided (demo)',
        representativeScope:{isAuthorized:false}}
    : baseTaxpayerProfile;

  const navigate = (route: string, params: Record<string, any> = {}) => {
    setCurrentRoute(route);
    setRouteParams(params);
    // Keep the UI route in browser history without exposing payment form details in a URL.
    const next = new URL(window.location.href);
    next.searchParams.set('action', route);
    if (next.href !== window.location.href) {
      window.history.pushState({ taxpayRoute: route, taxpayParams: params }, '', next);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const route = new URLSearchParams(window.location.search).get('action') || 'landing';
      setCurrentRoute(route);
      setRouteParams(event.state?.taxpayParams || {});
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectReceipt = (id: string | null) => {
    setSelectedReceiptId(id);
    if (id) {
      navigate('payment_details');
    }
  };

  const selectedReceipt = selectedReceiptId ? receipts.find(r => r.id === selectedReceiptId) || null : null;

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
      'DEMO_PAYMENT_SIMULATED',
      receipt.challanNo,
      `Simulation only for ${receipt.payerName} (sample TIN: ${receipt.payerTin}), Amount: BDT ${receipt.totalAmount}; no government challan or credit`
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
        demoUser,
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
