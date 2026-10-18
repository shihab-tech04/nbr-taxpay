import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
import { publicDemoReceiptId, receiptReturnRoute, routeContextFromUrl, validRoute, writeRouteContext } from './routeContract';
import { 
  DEMO_TAXPAYERS, 
  INITIAL_RECEIPTS, 
  INITIAL_CORRECTIONS, 
  INITIAL_CASES, 
  INITIAL_INCIDENTS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_GATEWAY_HEALTH 
} from '../data/mockData';

export type BannerPaymentService = 'TAX_WITH_RETURN' | 'ADVANCE_TAX' | 'SOURCE_TAX_DEPOSIT' | 'TRAVEL_TAX';

export interface TaxStateContextType {
  currentRoute: string;
  isPaymentServiceChoiceOpen: boolean;
  setPaymentServiceChoiceOpen: (open: boolean) => void;
  paymentServiceInitialSelection: BannerPaymentService | null;
  openPaymentServiceChoice: (service?: BannerPaymentService) => void;
  demoUser: DemoUser | null;
  previewAccount: DemoUser | null;
  loginPreviewAccount: (userId: string, password: string, options?: { preserveRoute?: boolean }) => boolean;
  clearPreviewAccount: () => void;
  logoutPreviewAccount: () => void;
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
  lookupReceipt: (query: string, mobile?: string) => ChallanReceipt | undefined;
}

const TaxStateContext = createContext<TaxStateContextType | undefined>(undefined);

// The synthetic full-workflow review is available to local developers only.
// A published build must never infer a taxpayer role from a query string or
// restored browser-history state, even when someone knows an old preview URL.
export const sampleJourneysEnabled = import.meta.env.DEV;
const permittedDemoUser = (value: unknown) => sampleJourneysEnabled ? getDemoUser(value) : null;
const previewStorageKey = 'taxpay-taxpayer-preview-user';
const storedPreviewAccount = () => getDemoUser(window.sessionStorage.getItem(previewStorageKey));

// Browser history can restore a *visual-only* taxpayer sample after refresh.
// This is never an identity, permission or tax-credit entitlement, and a newly
// opened deep link without our own history state still starts as a guest.
const sampleTaxpayerRoles: UserRole[] = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'];
const historySampleRole = (route: string, state: any): UserRole | null =>
  state?.taxpayRoute === route && sampleTaxpayerRoles.includes(state.taxpaySampleRole)
    ? state.taxpaySampleRole as UserRole : null;

export const TaxStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPaymentServiceChoiceOpen, setPaymentServiceChoiceOpenState] = useState(false);
  const [paymentServiceInitialSelection, setPaymentServiceInitialSelection] = useState<BannerPaymentService | null>(null);
  const setPaymentServiceChoiceOpen = (open: boolean) => {
    if (!open) setPaymentServiceInitialSelection(null);
    setPaymentServiceChoiceOpenState(open);
  };
  const openPaymentServiceChoice = (service?: BannerPaymentService) => {
    setPaymentServiceInitialSelection(service ?? null);
    setPaymentServiceChoiceOpenState(true);
  };
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    // Public payment discovery is the primary citizen entry. TaxPay account access remains available by explicit deep link.
    const action = new URLSearchParams(window.location.search).get('action');
    return validRoute(action);
  });
  const [routeParams, setRouteParams] = useState<Record<string, any>>(() => {
    const search = new URLSearchParams(window.location.search);
    return routeContextFromUrl(validRoute(search.get('action')), search);
  });
  const [language, setLanguage] = useState<Language>(()=>new URLSearchParams(window.location.search).get('lang')==='bn'?'bn':'en');
  const [previewAccount, setPreviewAccount] = useState<DemoUser | null>(storedPreviewAccount);
  const [legacyDemoUser, setLegacyDemoUser] = useState<DemoUser | null>(() => permittedDemoUser(new URLSearchParams(window.location.search).get('demoUser')));
  const demoUser = previewAccount ?? legacyDemoUser;
  const demoUserRef = useRef(legacyDemoUser);
  const [userRole, setUserRoleState] = useState<UserRole>(() => {
    const search = new URLSearchParams(window.location.search);
    return storedPreviewAccount()?.role
      ?? permittedDemoUser(search.get('demoUser'))?.role
      ?? (sampleJourneysEnabled ? historySampleRole(validRoute(search.get('action')), window.history.state) : null)
      ?? 'GUEST';
  });
  const userRoleRef = useRef(userRole);
  const setUserRole = (role: UserRole) => {
    userRoleRef.current = role;
    setUserRoleState(role);
  };
  
  const [receipts, setReceipts] = useState<ChallanReceipt[]>(INITIAL_RECEIPTS);
  // A public fictional journal is not a taxpayer's account-bound ledger.
  // Keep the typed state empty until an authorized verified source exists.
  const [ledgerEntries] = useState<TaxLedgerEntry[]>([]);
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
  // First-time scenarios retain empty financial records but have named test identities.
  const firstTimeDemo = Boolean(demoUser && ['user7','user8','user9','user10'].includes(demoUser.id));
  const taxpayerProfile: TaxpayerProfile = firstTimeDemo
    ? {tin:demoUser!.tin,nameEn:demoUser!.nameEn,nameBn:demoUser!.nameBn,type:'INDIVIDUAL',taxZone:'',taxCircle:demoUser!.taxCircle,
       phone:'',email:'',address:'',isWithholdingEntity:false,
       representativeScope:{isAuthorized:false}}
    : demoUser
      ? {...baseTaxpayerProfile,tin:demoUser.tin,taxCircle:demoUser.taxCircle,
          nameEn:demoUser.nameEn,nameBn:demoUser.nameBn,
          email:'demo@example.invalid',phone:'Not provided (demo)',
          representativeScope:{isAuthorized:false}}
      : baseTaxpayerProfile;

  const updateLanguage = (lang: Language) => {
    setLanguage(lang);
    const next = new URL(window.location.href);
    if (lang === 'bn') next.searchParams.set('lang', 'bn');
    else next.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', next);
  };
  const navigate = (requestedRoute: string, params: Record<string, any> = {}) => {
    setPaymentServiceChoiceOpen(false);
    const route = validRoute(requestedRoute);
    setCurrentRoute(route);
    setRouteParams(params);
    // Keep the UI route in browser history without exposing payment form details in a URL.
    const next = new URL(window.location.href);
    next.searchParams.set('action', route);
    writeRouteContext(route, params, next.searchParams);
    // Legacy sample deep-link state must not survive entry to real account access.
    if (route === 'secure_workspace' || route === 'office_login' || route === 'taxpayer_login' || route === 'landing') {
      next.searchParams.delete('demoUser');
      if (legacyDemoUser) {
        setLegacyDemoUser(null);
        demoUserRef.current = null;
        if (!previewAccount) setUserRole('GUEST');
      }
      if (route === 'secure_workspace' && previewAccount) {
        window.sessionStorage.removeItem(previewStorageKey);
        setPreviewAccount(null);
        setUserRole('GUEST');
      }
    }
    const sampleRole = sampleJourneysEnabled && !previewAccount && sampleTaxpayerRoles.includes(userRoleRef.current) && route !== 'landing' && route !== 'office_login' && route !== 'taxpayer_login' && route !== 'secure_workspace'
      ? {taxpaySampleRole: userRoleRef.current} : {};
    const historyEntry = {taxpayRoute: route, taxpayParams: params, ...sampleRole};
    if (next.href !== window.location.href) window.history.pushState(historyEntry, '', next);
    else if (window.history.state?.taxpayRoute !== route || window.history.state?.taxpaySampleRole !== sampleRole.taxpaySampleRole)
      window.history.replaceState(historyEntry, '', next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const search = new URLSearchParams(window.location.search);
      const route = validRoute(search.get('action'));
      setCurrentRoute(route);
      setRouteParams(event.state?.taxpayRoute === route
        ? event.state.taxpayParams ?? routeContextFromUrl(route, search)
        : routeContextFromUrl(route, search));
      setLanguage(search.get('lang') === 'bn' ? 'bn' : 'en');
      const previousDemo = permittedDemoUser(search.get('demoUser'));
      const leavingDemo = Boolean(demoUserRef.current && !previousDemo);
      demoUserRef.current = previousDemo;
      setLegacyDemoUser(previousDemo);
      const restoredSampleRole = sampleJourneysEnabled ? historySampleRole(route, event.state) : null;
      if (previewAccount) setUserRole(previewAccount.role);
      else if (previousDemo) setUserRole(previousDemo.role);
      else if (restoredSampleRole) setUserRole(restoredSampleRole);
      else if (leavingDemo || sampleTaxpayerRoles.includes(userRoleRef.current)) setUserRole('GUEST');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [previewAccount]);

  // Temporary matching ID/password credentials only select a browser-local UI profile.
  // This deliberately creates no Supabase Auth session or API entitlement.
  const loginPreviewAccount = (userId: string, password: string, options?: { preserveRoute?: boolean }): boolean => {
    const selected = getDemoUser(userId.trim().toLowerCase());
    if (!selected || password !== selected.id) return false;
    window.sessionStorage.setItem(previewStorageKey, selected.id);
    setPreviewAccount(selected);
    setLegacyDemoUser(null);
    demoUserRef.current = null;
    setUserRole(selected.role);
    const next = new URL(window.location.href);
    next.searchParams.delete('demoUser');
    window.history.replaceState(window.history.state, '', next);
    // A login begun inside a payment modal must not destroy its in-progress form.
    // This local profile never grants private API or taxpayer-data permissions.
    if (!options?.preserveRoute) navigate('taxpayer_home');
    return true;
  };
  const clearPreviewAccount = (): void => {
    window.sessionStorage.removeItem(previewStorageKey);
    setPreviewAccount(null);
    setLegacyDemoUser(null);
    demoUserRef.current = null;
    setUserRole('GUEST');
  };
  const logoutPreviewAccount = (): void => {
    clearPreviewAccount();
    navigate('landing');
  };

  const selectReceipt = (id: string | null) => {
    if (!id || !receipts.some(receipt => receipt.id === id)) return;
    const demoReceipt = INITIAL_RECEIPTS.some(receipt => receipt.id === id) ? publicDemoReceiptId(id) : null;
    navigate('payment_details', {
      returnTo: receiptReturnRoute(currentRoute), receiptId: id,
      ...(demoReceipt ? {demoReceipt} : {})
    });
  };

  // Recover source-linked fixture details after reload and browser history traversal.
  // Private/dynamically created records remain in memory and are never encoded in a URL.
  const receiptId = currentRoute === 'payment_details'
    ? (publicDemoReceiptId(routeParams.demoReceipt) || routeParams.receiptId)
    : null;
  const selectedReceipt = typeof receiptId === 'string'
    ? receipts.find(receipt => receipt.id === receiptId) || null : null;

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
    if (!receipts.some(receipt=>receipt.isSimulatedDemo && receipt.challanNo===corrData.challanNo && receipt.payerTin===corrData.taxpayerTin)) {
      throw new Error('This sample payment does not belong to the selected preview.');
    }
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

  const lookupReceipt = (query: string, mobile = ''): ChallanReceipt | undefined => {
    const clean = query.trim().toUpperCase();
    const cleanMobile = mobile.replace(/\D/g, '');
    return receipts.find(r =>
      (!r.receiptMobile || r.receiptMobile === cleanMobile) && (
        r.challanNo.toUpperCase() === clean ||
        r.tokenNumber.toUpperCase() === clean ||
        r.gatewayTransactionId.toUpperCase() === clean
      )
    );
  };

  return (
    <TaxStateContext.Provider
      value={{
        currentRoute,
        isPaymentServiceChoiceOpen,
        setPaymentServiceChoiceOpen,
        paymentServiceInitialSelection,
        openPaymentServiceChoice,
        demoUser,
        previewAccount,
        loginPreviewAccount,
        clearPreviewAccount,
        logoutPreviewAccount,
        routeParams,
        navigate,
        language,
        setLanguage: updateLanguage,
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
