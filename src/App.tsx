import React, { useEffect, useRef, useState } from 'react';
import { sampleJourneysEnabled, TaxStateProvider, useTaxState } from './services/taxState';
import { CitizenNavigation } from './components/layout/CitizenNavigation';
import { PublicHomeHeader } from './components/layout/PublicHomeHeader';
import { TaxpayerReferenceRail } from './components/layout/TaxpayerReferenceRail';
import { PublicHelpChat } from './components/layout/PublicHelpChat';
import {AccountIdentityProvider,useAccountIdentity} from './services/accountIdentity';
import { CitizenFooter } from './components/layout/CitizenFooter';
import type { PaymentFormDraft } from './services/accountPaymentFormDrafts';

// Screens
import { PublicLanding } from './components/screens/PublicLanding';
import { receiptReturnRoute } from './services/routeContract';
import { IncidentReporting } from './components/screens/IncidentReporting';
import { user1DemoRoutes } from './config/user1DemoRoutes';
import { isPrivateTaxpayerRoute, requiresTaxpayerSignIn } from './services/privateRoutePolicy';
import { validCertificateTransactionId } from './services/transactionId';
import { safePrivateAuthReturnRoute } from './services/routeContract';

// Keep modal-only and preview-only code out of the initial public JavaScript.
// These components retain their existing modal UI, permissions and routes.
const PublicUserGuide = React.lazy(() => import('./components/screens/PublicUserGuide').then(m => ({default: m.PublicUserGuide})));
const PublicReport = React.lazy(() => import('./components/screens/PublicReport').then(m => ({default: m.PublicReport})));
const TaxPayModal = React.lazy(() => import('./components/ui/TaxPayModal').then(m => ({default: m.TaxPayModal})));
const User1DemoExperience = React.lazy(() => import('./components/screens/User1DemoExperience').then(m => ({default: m.User1DemoExperience})));
const TaxpayerLoginDialog = React.lazy(() => import('./components/screens/TaxpayerLoginDialog').then(m => ({default: m.TaxpayerLoginDialog})));
const ParityRegisterModal = React.lazy(() => import('./components/screens/ParityRegisterModal').then(m => ({default: m.ParityRegisterModal})));
const PublicServiceModal = React.lazy(() => import('./components/screens/PublicServiceModal').then(m => ({default: m.PublicServiceModal})));
const PaymentDetailView = React.lazy(() => import('./components/screens/PaymentDetailView').then(m => ({default: m.PaymentDetailView})));
const AuthorizationRequestPopup = React.lazy(() => import('./components/screens/AuthorizationRequestPopup').then(m => ({default: m.AuthorizationRequestPopup})));

// Defer non-entry screens until visited, preserving the public shell and auth gates.
// Do not load the large payment forms for public visitors who have not started a payment.
const GuestPayment = React.lazy(() => import('./components/screens/GuestPayment').then(module => ({ default: module.GuestPayment })));
const TravelTax = React.lazy(() => import('./components/screens/TravelTax').then(module => ({ default: module.TravelTax })));
const GiftTaxReuseEntry = React.lazy(() => import('./components/screens/GiftTaxReuseEntry').then(module => ({default:module.GiftTaxReuseEntry})));
const PaymentServiceChoiceDialog = React.lazy(() => import('./components/screens/PaymentServiceChoiceDialog').then(module => ({ default: module.PaymentServiceChoiceDialog })));
const Beneficiaries = React.lazy(() => import('./components/screens/Beneficiaries').then(module => ({ default: module.Beneficiaries })));
const ArchitectureView = React.lazy(() => import('./components/screens/ArchitectureView').then(module => ({ default: module.ArchitectureView })));
const TaxpayerDashboard = React.lazy(() => import('./components/screens/TaxpayerDashboard').then(module => ({ default: module.TaxpayerDashboard })));
const PaymentWizard = React.lazy(() => import('./components/screens/PaymentWizard').then(module => ({ default: module.PaymentWizard })));
const PaymentHistory = React.lazy(() => import('./components/screens/PaymentHistory').then(module => ({ default: module.PaymentHistory })));
const TaxLedger = React.lazy(() => import('./components/screens/TaxLedger').then(module => ({ default: module.TaxLedger })));
const TaxJourney = React.lazy(() => import('./components/screens/TaxJourney').then(module => ({ default: module.TaxJourney })));
const CertificatesView = React.lazy(() => import('./components/screens/CertificatesView').then(module => ({ default: module.CertificatesView })));
const CorrectionRequests = React.lazy(() => import('./components/screens/CorrectionRequests').then(module => ({ default: module.CorrectionRequests })));
const CorrectionInquiries = React.lazy(() => import('./components/screens/CorrectionInquiries').then(module => ({ default: module.CorrectionInquiries })));
const NotificationsView = React.lazy(() => import('./components/screens/NotificationsView').then(module => ({ default: module.NotificationsView })));
const AccountCenter = React.lazy(() => import('./components/screens/AccountCenter').then(module => ({ default: module.AccountCenter })));
const UnifiedTaxpayerProfilePage = React.lazy(() => import('./components/screens/UnifiedTaxpayerProfilePage').then(module => ({ default: module.UnifiedTaxpayerProfilePage })));
const ManageAuthorization = React.lazy(() => import('./components/screens/ManageAuthorization').then(module => ({ default: module.ManageAuthorization })));
const PaymentServicesPage = React.lazy(() => import('./components/screens/PaymentServicesPage').then(module => ({ default: module.PaymentServicesPage })));
const OntologyView = React.lazy(() => import('./components/screens/OntologyView').then(module => ({ default: module.OntologyView })));
const GlossaryView = React.lazy(() => import('./components/screens/GlossaryView').then(module => ({ default: module.GlossaryView })));
const SecureWorkspace = React.lazy(() => import('./components/screens/SecureWorkspace').then(module => ({ default: module.SecureWorkspace })));
const HeadCatalogue = React.lazy(() => import('./components/screens/HeadCatalogue').then(module => ({ default: module.HeadCatalogue })));

const previewReadOnlyRoutes = new Set([
  'taxpayer_home', 'dashboard', 'history', 'ledger', 'journey', 'certificates', 'corrections',
  'notifications', 'account_notifications', 'account_profile', 'account_settings', 'services', 'manage_authorization',
  'wizard', 'payment_details'
]);

const activityRoutes = new Set(['history', 'journey', 'verify', 'corrections', 'certificates']);

/** Route-scoped recovery for a failed lazy import/render. Never turn a History
 * exception into a blank taxpayer page, and never read or alter another account.
 * Successful History journeys retain their exact existing UI and behavior.
 */
class HistoryRouteBoundary extends React.Component<
  {language:'en'|'bn';onBack:()=>void;children:React.ReactNode},{failed:boolean}
> {
  state={failed:false};
  static getDerivedStateFromError():{failed:boolean}{return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    const bn=this.props.language==='bn';
    return <section role="alert" data-testid="history-route-recovery"
      className="mx-auto max-w-5xl space-y-4 rounded-xl border border-taxpay-border bg-white p-5 sm:p-6">
      <h1 className="text-xl font-semibold text-taxpay-text">
        {bn?'লেনদেনের ইতিহাস লোড করা যাচ্ছে না':'Could not load transaction history'}
      </h1>
      <p className="text-sm text-taxpay-muted">
        {bn?'পেমেন্টের তথ্য পরিবর্তন করা হয়নি। পুনরায় চেষ্টা করুন অথবা সংক্ষিপ্ত বিবরণে ফিরে যান।':
          'Your payment records have not been changed. Retry loading or return to Overview.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="min-h-11 rounded-lg bg-taxpay-primary px-4 font-medium text-white"
          onClick={()=>window.location.reload()}>{bn?'আবার চেষ্টা করুন':'Retry'}</button>
        <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-4 font-medium text-taxpay-primary"
          onClick={this.props.onBack}>{bn?'সংক্ষিপ্ত বিবরণে ফিরুন':'Back to Overview'}</button>
      </div>
    </section>;
  }
}

const MainRouter: React.FC = () => {
  const { currentRoute, routeParams, navigate, userRole, setUserRole, language, demoUser, previewAccount, clearPreviewAccount, isPaymentServiceChoiceOpen, setPaymentServiceChoiceOpen, isParityModalOpen, paymentServiceInitialSelection, unifiedPaymentEntryRequested, paymentReuse } = useTaxState();
  const [dashboardPaymentDraft, setDashboardPaymentDraft] = useState<PaymentFormDraft | null>(null);
  // Close always clears the one-shot resume request. No draft IDs in URLs or storage.
  useEffect(() => {
    if (!isPaymentServiceChoiceOpen) setDashboardPaymentDraft(null);
  }, [isPaymentServiceChoiceOpen]);
  const resumeDashboardPayment = (draft: PaymentFormDraft) => {
    setDashboardPaymentDraft(draft);
    setPaymentServiceChoiceOpen(true);
  };
  const {user:verifiedApplicationUser,loading:checkingIdentity}=useAccountIdentity();
  const mainContentRef = useRef<HTMLElement>(null);
  const priorCitizenRouteRef = useRef<string | null>(null);
  const privateTaxpayerRoute = isPrivateTaxpayerRoute(currentRoute, false);
  const signInReturnRoute = safePrivateAuthReturnRoute(currentRoute) ?? 'taxpayer_home';
  // Sample accounts have an explicit browser-local login and use the same approved
  // taxpayer layout for saved lists. Anonymous visitors never pass this gate.
  const previewAccess = Boolean(previewAccount && (previewReadOnlyRoutes.has(currentRoute) || currentRoute === 'beneficiaries'))
  // A UUID linked to a mirrored simulated transaction is a public, read-only
  // receipt view. It grants no access to the taxpayer's private workspace.
  const publicConfirmedReceipt = currentRoute==='payment_details' &&
    validCertificateTransactionId(routeParams.transactionId);
  const privateSampleGate = !publicConfirmedReceipt && !previewAccess &&
    requiresTaxpayerSignIn(currentRoute, false, Boolean(verifiedApplicationUser), sampleJourneysEnabled, userRole);
  // Signed-out deep links reuse the approved login dialog. Keep the separate
  // development preview entry only where browser-fixture tests need it.
  const signedOutPrivateLogin = privateSampleGate && !checkingIdentity &&
    (!sampleJourneysEnabled || currentRoute === 'beneficiaries');
  // Receipt routes remain deep-linkable, but their UI lives in the shared modal.
  const receiptOverlayRoute = currentRoute === 'verify' || currentRoute === 'payment_details';
  const transactionRoute = ['guest','guestwh','travel'].includes(currentRoute);
  const loginOverlay = currentRoute === 'taxpayer_login' || currentRoute === 'office_login';
  const taxpayerSession = Boolean(verifiedApplicationUser || previewAccount ||
    (sampleJourneysEnabled && ['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole)));
  // The public guide retains the same public navigation for guests and signed-in visitors.
  const taxpayerSupportRoute = false; // Receipt status is now a public modal, not a taxpayer-page shell.
  const publicInformationRoute = receiptOverlayRoute || ['landing','home-2','incident'].includes(currentRoute) ||
    (['user_guide','guidance'].includes(currentRoute) && !taxpayerSupportRoute) ||
    loginOverlay || privateSampleGate;
  // A guest draft deep link retains its existing responsive shell and sign-in gate.
  // All account-only routes use the same approved taxpayer shell and sidebar.
  const taxpayerReference = !receiptOverlayRoute && ((privateTaxpayerRoute && !privateSampleGate) || taxpayerSupportRoute ||
    currentRoute === 'secure_workspace');
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
    // Fictional user1 has a unified read-only story across all taxpayer views.
    // Only public demoUser=user1, never a signed-in account or financial backend.
    if ((sampleJourneysEnabled || previewAccount) && demoUser?.id === 'user1' && !verifiedApplicationUser && (currentRoute !== 'account_profile' || !previewAccount) && user1DemoRoutes.includes(currentRoute)) {
      return <User1DemoExperience route={currentRoute} activityTabs={showActivitySections} onResumePaymentDraft={resumeDashboardPayment} />;
    }
    switch (currentRoute) {
      // Public Screens
      case 'home-2':
        return <PublicLanding key="home-2" home2 />;
      case 'landing':
      case 'taxpayer_login':
      case 'office_login':
        return routeParams.fromHome2 === true ? <PublicLanding key="home-2" home2 /> : <PublicLanding />;
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
        return routeParams.fromHome2 === true ? <PublicLanding key="home-2" home2 /> : <PublicLanding />; // Existing receipt modal.
      case 'incident':
        return <PublicReport />;
      case 'architecture':
        return <ArchitectureView />;

      // Taxpayer Screens
      case 'taxpayer_home':
        return <TaxpayerDashboard onResumePaymentDraft={resumeDashboardPayment} />;
      case 'dashboard':
        return <TaxpayerDashboard onResumePaymentDraft={resumeDashboardPayment} />;
      case 'wizard':
        return <PaymentWizard />;
      case 'history':
        return <PaymentHistory activityTabs={showActivitySections} />;
      case 'payment_details':
        return <PublicLanding />; // Receipt content opens over the public shell.
      case 'ledger':
        return <TaxLedger />;
      case 'journey':
        return <TaxJourney activityTabs={showActivitySections} />;
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
        return previewAccount && !verifiedApplicationUser ? <UnifiedTaxpayerProfilePage /> : <AccountCenter page="profile" />;
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

  const home2Shell = currentRoute === 'home-2' || (routeParams.fromHome2 === true && (loginOverlay || receiptOverlayRoute || privateSampleGate));
  return (
    <div lang={language} className={`taxpay-citizen-shell${home2Shell ? ' home2-import-shell' : ''} min-h-screen flex flex-col font-sans${taxpayerReference ? " taxpay-taxpayer-reference" : ""}${taxpayerReference && !privateSampleGate && (verifiedApplicationUser || previewAccount) ? " taxpay-authenticated-content" : ""}${transactionRoute ? " taxpay-taxpayer-flow" : ""}${!taxpayerReference ? " taxpay-public-mobile-shell" : ""}`}>
      {!home2Shell && (publicInformationRoute ? <>
        <div className="taxpay-public-desktop-navigation"><PublicHomeHeader /></div>
        <div className="taxpay-public-mobile-navigation"><CitizenNavigation /></div>
      </> : <CitizenNavigation />)}
      {taxpayerReference && !transactionRoute && <TaxpayerReferenceRail />}
      <main ref={mainContentRef} id="main-content" tabIndex={-1} className={`flex-1 ${publicInformationRoute ? 'public-information-main' : 'max-w-7xl'} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8${transactionRoute ? ' citizen-main--transaction' : ''}${currentRoute === 'incident' ? ' public-information-main--report' : ''}`}>
        {privateSampleGate ? (
          <>
            {/* A protected deep link never reveals account data to signed-out visitors.
                Render only the approved public shell while the shared login dialog
                handles access, recovery, and close. */}
            {routeParams.fromHome2 === true ? <PublicLanding key="home-2" home2 /> : <PublicLanding />}
            {checkingIdentity && <p role="status">
              {language === 'bn' ? 'আপনার সেশন যাচাই করা হচ্ছে…' : 'Checking your session…'}
            </p>}
            {sampleJourneysEnabled && !checkingIdentity && currentRoute !== 'beneficiaries' && (
              <nav aria-label="Local taxpayer UI review" className="mx-auto mt-4 flex max-w-[1100px] flex-wrap gap-2">
                <button type="button" className="min-h-11 rounded-lg border border-taxpay-primary px-4 py-2 text-sm font-medium text-taxpay-primary"
                  onClick={() => { setUserRole('TAXPAYER_INDIVIDUAL'); navigate('taxpayer_home'); }}>
                  {language === 'bn' ? 'করদাতা ওয়ার্কস্পেস দেখুন' : 'Explore taxpayer workspace'}
                </button>
                <a className="inline-flex min-h-11 items-center rounded-lg border border-taxpay-border px-4 py-2 text-sm text-taxpay-primary"
                  href={language === 'bn' ? '?action=taxpayer_home&demoUser=user1&lang=bn' : '?action=taxpayer_home&demoUser=user1'}>
                  {language === 'bn' ? 'ইন্টারঅ্যাকটিভ ড্যাশবোর্ড দেখুন' : 'Explore interactive dashboard'}
                </a>
                <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-4 py-2 text-sm text-taxpay-primary"
                  onClick={() => navigate('taxpayer_login')}>
                  {language === 'bn' ? 'ইউজার আইডি দিয়ে নমুনা অ্যাকাউন্ট দেখুন' : 'Use User ID (sample account)'}
                </button>
              </nav>
            )}
          </>
        ) : <>
          <React.Suspense fallback={<p role="status">{language === 'bn' ? 'পেজ লোড হচ্ছে…' : 'Loading page…'}</p>}>
            {currentRoute==='history'
              ? <HistoryRouteBoundary key={previewAccount?.id??verifiedApplicationUser?.id??'guest'}
                  language={language} onBack={()=>navigate('taxpayer_home')}>
                  {renderActiveScreen()}
                </HistoryRouteBoundary>
              : renderActiveScreen()}
          </React.Suspense>
        </>}
      </main>
      {!home2Shell && (!taxpayerReference || currentRoute === 'secure_workspace') && <CitizenFooter />}
      {!home2Shell && publicInformationRoute && !receiptOverlayRoute && !verifiedApplicationUser && !previewAccount && <PublicHelpChat />}
      {receiptOverlayRoute && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'রসিদ লোড হচ্ছে…' : 'Loading receipt…'}</p>}>{currentRoute === 'verify'
        ? <PublicServiceModal service="status" onClose={() => navigate(routeParams.fromHome2 === true ? 'home-2' : 'landing')} />
        : <TaxPayModal title={language === 'bn' ? 'পেমেন্ট রসিদের বিবরণ' : 'Payment receipt details'}
            service="status" className="receipt-modal" footer={<></>}
            onClose={() => navigate(receiptReturnRoute(routeParams.returnTo))}>
            <PaymentDetailView embedded />
          </TaxPayModal>}</React.Suspense>}
      {isParityModalOpen && <React.Suspense fallback={null}><ParityRegisterModal /></React.Suspense>}
      {isPaymentServiceChoiceOpen && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'পেমেন্ট সেবা লোড হচ্ছে…' : 'Loading payment service…'}</p>}>
        {paymentReuse?.service==='GIFT_TAX' ? <GiftTaxReuseEntry key={paymentReuse.sourcePaymentId} reuse={paymentReuse} /> : <PaymentServiceChoiceDialog initialService={paymentServiceInitialSelection} initialDraft={dashboardPaymentDraft} initialReuse={paymentReuse} unifiedEntryRequested={unifiedPaymentEntryRequested} />}
      </React.Suspense>}
      {loginOverlay && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'সাইন ইন লোড হচ্ছে…' : 'Loading sign in…'}</p>}><TaxpayerLoginDialog onClose={routeParams.fromHome2 === true ? ()=>navigate('home-2') : undefined} /></React.Suspense>}
      {signedOutPrivateLogin && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'সাইন ইন লোড হচ্ছে…' : 'Loading sign in…'}</p>}><TaxpayerLoginDialog
        onSuccess={() => navigate(signInReturnRoute)}
        onClose={() => navigate(routeParams.fromHome2 === true ? 'home-2' : 'landing')}
      /></React.Suspense>}
      {(previewAccount || (verifiedApplicationUser && import.meta.env.VITE_ACCOUNT_RECEIVED_NOTICES_ENABLED === 'true')) &&
        <React.Suspense fallback={null}><AuthorizationRequestPopup /></React.Suspense>}
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
