import React, { useEffect, useRef } from 'react';
import { sampleJourneysEnabled, TaxStateProvider, useTaxState } from './services/taxState';
import { CitizenNavigation } from './components/layout/CitizenNavigation';
import { PublicHomeHeader } from './components/layout/PublicHomeHeader';
import { PublicHelpChat } from './components/layout/PublicHelpChat';
import { TaxpayerReferenceRail } from './components/layout/TaxpayerReferenceRail';
import {AccountIdentityProvider,useAccountIdentity} from './services/accountIdentity';
import { CitizenFooter } from './components/layout/CitizenFooter';
import { TaxpayerLoginDialog } from './components/screens/TaxpayerLoginDialog';
import { ParityRegisterModal } from './components/screens/ParityRegisterModal';
import { PaymentServiceChoiceDialog } from './components/screens/PaymentServiceChoiceDialog';

// Screens
import { PublicLanding } from './components/screens/PublicLanding';
import { PublicUserGuide } from './components/screens/PublicUserGuide';
import { PublicReport } from './components/screens/PublicReport';
import { GuestPayment } from './components/screens/GuestPayment';
import { Beneficiaries } from './components/screens/Beneficiaries';
import { TravelTax } from './components/screens/TravelTax';
import { PublicServiceModal } from './components/screens/PublicServiceModal';
import { TaxPayModal } from './components/ui/TaxPayModal';
import { receiptReturnRoute } from './services/routeContract';
import { IncidentReporting } from './components/screens/IncidentReporting';
import { ArchitectureView } from './components/screens/ArchitectureView';
import { TaxpayerDashboard } from './components/screens/TaxpayerDashboard';
import { User1DemoExperience, user1DemoRoutes } from './components/screens/User1DemoExperience';
import { PaymentWizard } from './components/screens/PaymentWizard';
import { PaymentHistory } from './components/screens/PaymentHistory';
import { ReceiptLookup } from './components/screens/ReceiptLookup';
import { PaymentDetailView } from './components/screens/PaymentDetailView';
import { TaxLedger } from './components/screens/TaxLedger';
import { TaxJourney } from './components/screens/TaxJourney';
import { CertificatesView } from './components/screens/CertificatesView';
import { CorrectionRequests } from './components/screens/CorrectionRequests';
import { CorrectionInquiries } from './components/screens/CorrectionInquiries';
import { NotificationsView } from './components/screens/NotificationsView';
import { AccountCenter } from './components/screens/AccountCenter';
import { ManageAuthorization } from './components/screens/ManageAuthorization';
import { AuthorizationRequestPopup } from './components/screens/AuthorizationRequestPopup';
import { PaymentServicesPage } from './components/screens/PaymentServicesPage';
import { OntologyView } from './components/screens/OntologyView';
import { GlossaryView } from './components/screens/GlossaryView';
import { SecureWorkspace } from './components/screens/SecureWorkspace';
import { HeadCatalogue } from './components/screens/HeadCatalogue';
import { isPrivateTaxpayerRoute, requiresTaxpayerSignIn } from './services/privateRoutePolicy';
import { validCertificateTransactionId } from './services/confirmedPaymentCertificate';
import { safePrivateAuthReturnRoute } from './services/routeContract';

const previewReadOnlyRoutes = new Set([
  'taxpayer_home', 'dashboard', 'history', 'ledger', 'journey', 'certificates', 'corrections',
  'notifications', 'account_notifications', 'account_profile', 'account_settings', 'services', 'manage_authorization',
  'wizard', 'payment_details'
]);

const activityRoutes = new Set(['history', 'verify', 'corrections', 'certificates']);

const MainRouter: React.FC = () => {
  const { currentRoute, routeParams, navigate, userRole, setUserRole, language, demoUser, previewAccount, clearPreviewAccount, isPaymentServiceChoiceOpen, paymentServiceInitialSelection } = useTaxState();
  const {user:verifiedApplicationUser,loading:checkingIdentity}=useAccountIdentity();
  const mainContentRef = useRef<HTMLElement>(null);
  const priorCitizenRouteRef = useRef<string | null>(null);
  const privateTaxpayerRoute = isPrivateTaxpayerRoute(currentRoute, false);
  const signInReturnRoute = safePrivateAuthReturnRoute(currentRoute) ?? 'taxpayer_home';
  const previewAccess = Boolean(previewAccount && previewReadOnlyRoutes.has(currentRoute));
  // A UUID linked to a mirrored simulated transaction is a public, read-only
  // receipt view. It grants no access to the taxpayer's private workspace.
  const publicConfirmedReceipt = currentRoute==='payment_details' &&
    validCertificateTransactionId(routeParams.transactionId);
  const privateSampleGate = !publicConfirmedReceipt && !previewAccess &&
    requiresTaxpayerSignIn(currentRoute, false, Boolean(verifiedApplicationUser), sampleJourneysEnabled, userRole);
  // Receipt routes remain deep-linkable, but their UI lives in the shared modal.
  const receiptOverlayRoute = currentRoute === 'verify' || currentRoute === 'payment_details';
  const transactionRoute = ['guest','guestwh','travel'].includes(currentRoute);
  const loginOverlay = currentRoute === 'taxpayer_login' || currentRoute === 'office_login';
  const taxpayerSession = Boolean(verifiedApplicationUser || previewAccount ||
    (sampleJourneysEnabled && ['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole)));
  // The public guide retains the same public navigation for guests and signed-in visitors.
  const taxpayerSupportRoute = false; // Receipt status is now a public modal, not a taxpayer-page shell.
  const publicInformationRoute = receiptOverlayRoute || ['landing','incident'].includes(currentRoute) ||
    (['user_guide','guidance'].includes(currentRoute) && !taxpayerSupportRoute) || loginOverlay;
  // A guest draft deep link retains its existing responsive shell and sign-in gate.
  const taxpayerReference = !receiptOverlayRoute && ((privateTaxpayerRoute && !privateSampleGate) || taxpayerSupportRoute ||
    currentRoute === 'secure_workspace' || (currentRoute === 'beneficiaries' && Boolean(
      verifiedApplicationUser || (import.meta.env.DEV && taxpayerSession)
    )));
  const showActivitySections = taxpayerSession && !privateSampleGate && activityRoutes.has(currentRoute);

  // Listen to browser URL search params for direct action links (?action=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action && action !== currentRoute) {
      navigate(action);
    }
  }, []);

  // A browser-only preview identity and a real Supabase account cannot coexist.
  useEffect(() => {
    if (verifiedApplicationUser && previewAccount) clearPreviewAccount();
  }, [verifiedApplicationUser?.id, previewAccount?.id]);

  // SPA navigation should announce the new main region to keyboard users.
  useEffect(() => {
    const leavingLogin = priorCitizenRouteRef.current === 'taxpayer_login' || priorCitizenRouteRef.current === 'office_login';
    if (priorCitizenRouteRef.current !== null && priorCitizenRouteRef.current !== currentRoute &&
        currentRoute !== 'taxpayer_login' && currentRoute !== 'office_login' && !leavingLogin) {
      mainContentRef.current?.focus({ preventScroll: true });
    }
    priorCitizenRouteRef.current = currentRoute;
  }, [currentRoute]);

  const renderActiveScreen = () => {
    // Demo account notifications share the SQL authorization inbox used by the popup.
    if(previewAccount&&currentRoute==='account_notifications'&&!verifiedApplicationUser){
      return <NotificationsView />;
    }
    // Track payment uses the in-page lookup for verified accounts. Synthetic
    // preview accounts keep their established transaction workspace below.
    if (currentRoute === 'history' && Boolean(routeParams.trackPayment) && showActivitySections && verifiedApplicationUser) {
      return <ReceiptLookup activityTabs />;
    }
    // Fictional user1 has a unified read-only story across all taxpayer views.
    // Only public demoUser=user1, never a signed-in account or financial backend.
    if ((sampleJourneysEnabled || previewAccount) && demoUser?.id === 'user1' && !verifiedApplicationUser && user1DemoRoutes.includes(currentRoute)) {
      return <User1DemoExperience route={currentRoute} activityTabs={showActivitySections} />;
    }
    switch (currentRoute) {
      // Public Screens
      case 'landing':
      case 'taxpayer_login':
      case 'office_login':
        return <PublicLanding />;
      case 'user_guide':
      case 'guidance': // Legacy help bookmarks use the maintained user guide.
        return <PublicUserGuide />;
      case 'secure_workspace':
        return <SecureWorkspace />;
      case 'head_catalogue':
        return <HeadCatalogue />;
      case 'guest':
        return <GuestPayment isWithholdingMode={false} />;
      case 'guestwh':
        return <GuestPayment isWithholdingMode={true} />;
      case 'travel':
        return <TravelTax />;
      case 'verify':
        return <PublicLanding />; // Receipt lookup opens in the shared public modal.
      case 'incident':
        return <PublicReport />;
      case 'architecture':
        return <ArchitectureView />;

      // Taxpayer Screens
      case 'taxpayer_home':
        return <TaxpayerDashboard />;
      case 'dashboard':
        return <TaxpayerDashboard />;
      case 'wizard':
        return <PaymentWizard />;
      case 'history':
        return <PaymentHistory activityTabs={showActivitySections} />;
      case 'payment_details':
        return <PublicLanding />; // Receipt content opens over the public shell.
      case 'ledger':
        return <TaxLedger />;
      case 'journey':
        return <TaxJourney />;
      case 'certificates':
        return <CertificatesView activityTabs={showActivitySections} />;
      case 'corrections':
        // An authenticated account can submit an RLS-owned, non-financial
        // correction inquiry without a TIN binding. Fictional previews keep
        // their separate, local-only correction journey.
        return verifiedApplicationUser
          ? <CorrectionInquiries authenticatedUserId={verifiedApplicationUser.id} language={language} />
          : <CorrectionRequests activityTabs={showActivitySections} />;
      case 'notifications':
        return <NotificationsView />;
      case 'payment_notifications':
        // Public only for opaque browser-session simulated payment events.
        // Never open account-scoped notifications through this route.
        return verifiedApplicationUser ? <AccountCenter page="notifications" /> : <NotificationsView />;
      case 'account_notifications':
        return <AccountCenter page="notifications" />;
      case 'account_profile':
        return <AccountCenter page="profile" />;
      case 'account_settings':
        return <AccountCenter page="settings" />;
      case 'manage_authorization':
        return <ManageAuthorization />;
      case 'beneficiaries':
        return <Beneficiaries />;
      case 'services':
        return <PaymentServicesPage />;

      // Knowledge, Ontology & Guidance
      case 'ontology':
        return <OntologyView />;
      case 'glossary':
        return <GlossaryView />;

      default:
        return <PublicLanding />;
    }
  };

  return (
    <div lang={language} className={`taxpay-citizen-shell min-h-screen flex flex-col font-sans${taxpayerReference ? " taxpay-taxpayer-reference" : ""}${transactionRoute ? " taxpay-taxpayer-flow" : ""}`}>
      {publicInformationRoute ? <PublicHomeHeader /> : <CitizenNavigation />}
      {taxpayerReference && !transactionRoute && <TaxpayerReferenceRail />}
      <main ref={mainContentRef} id="main-content" tabIndex={-1} className={`flex-1 ${publicInformationRoute ? 'public-information-main' : 'max-w-7xl'} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8${transactionRoute ? ' citizen-main--transaction' : ''}${currentRoute === 'incident' ? ' public-information-main--report' : ''}`}>
        {privateSampleGate ? checkingIdentity ? <p role="status">{language === 'bn' ? 'আপনার সেশন যাচাই করা হচ্ছে…' : 'Checking your session…'}</p> : (
          <section className="citizen-account-gate">
            <h1>{language === 'bn' ? 'করদাতার ব্যক্তিগত তথ্য' : 'Private taxpayer workspace'}</h1>
            <p>{language === 'bn' ? 'আপনার করদাতা অ্যাকাউন্টে প্রবেশ করতে ইমেইলে সাইন ইন করুন।' : 'Sign in with email to access your taxpayer account.'}</p>
            <a className="citizen-account-gate__preview"
              href={`?action=secure_workspace&returnTo=${signInReturnRoute}${language === 'bn' ? '&lang=bn' : ''}`}>
              {language === 'bn' ? 'ইমেইলে সাইন ইন' : 'Sign in with email'}
            </a>
            {/* Local-only synthetic workspace links retain existing UX regression coverage.
                The production bundle removes this entire branch; private routes still require
                verified Supabase Auth. */}
            {sampleJourneysEnabled && <>
              <a className="citizen-account-gate__preview" href={language === 'bn'
                ? '?action=taxpayer_home&demoUser=user1&lang=bn'
                : '?action=taxpayer_home&demoUser=user1'}>
                {language === 'bn' ? 'ইন্টারঅ্যাকটিভ ড্যাশবোর্ড দেখুন' : 'Explore interactive dashboard'}
              </a>
              <button type="button" onClick={() => { setUserRole('TAXPAYER_INDIVIDUAL'); navigate('taxpayer_home'); }}>
                {language === 'bn' ? 'করদাতা ওয়ার্কস্পেস দেখুন' : 'Explore taxpayer workspace'}
              </button>
            </>}
            <button type="button" onClick={() => navigate('taxpayer_login')}>
              {language === 'bn' ? 'ইউজার আইডি দিয়ে নমুনা অ্যাকাউন্ট দেখুন' : 'Use User ID (sample account)'}
            </button>
          </section>
        ) : <>
          {renderActiveScreen()}
        </>}
      </main>
      {(!taxpayerReference || currentRoute === 'secure_workspace') && <CitizenFooter />}
      {publicInformationRoute && !receiptOverlayRoute && !verifiedApplicationUser && !previewAccount && <PublicHelpChat />}
      {receiptOverlayRoute && (currentRoute === 'verify'
        ? <PublicServiceModal service="status" onClose={() => navigate('landing')} />
        : <TaxPayModal title={language === 'bn' ? 'পেমেন্ট রসিদের বিবরণ' : 'Payment receipt details'}
            service="status" className="receipt-modal" footer={<></>}
            onClose={() => navigate(receiptReturnRoute(routeParams.returnTo))}>
            <PaymentDetailView embedded />
          </TaxPayModal>)}
      <ParityRegisterModal />
      {isPaymentServiceChoiceOpen && <PaymentServiceChoiceDialog initialService={paymentServiceInitialSelection} />}
      {loginOverlay && <TaxpayerLoginDialog />}
      <AuthorizationRequestPopup />
    </div>
  );
};

export default function App() {
  return (
    <AccountIdentityProvider>
      <TaxStateProvider>
        <MainRouter />
      </TaxStateProvider>
    </AccountIdentityProvider>
  );
}
