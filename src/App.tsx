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
import { TravelTax } from './components/screens/TravelTax';
import { ReceiptLookup } from './components/screens/ReceiptLookup';
import { IncidentReporting } from './components/screens/IncidentReporting';
import { ArchitectureView } from './components/screens/ArchitectureView';
import { TaxpayerDashboard } from './components/screens/TaxpayerDashboard';
import { User1DemoExperience, user1DemoRoutes } from './components/screens/User1DemoExperience';
import { PaymentWizard } from './components/screens/PaymentWizard';
import { PaymentHistory } from './components/screens/PaymentHistory';
import { PaymentDetailView } from './components/screens/PaymentDetailView';
import { TaxLedger } from './components/screens/TaxLedger';
import { TaxJourney } from './components/screens/TaxJourney';
import { CertificatesView } from './components/screens/CertificatesView';
import { CorrectionRequests } from './components/screens/CorrectionRequests';
import { NotificationsView } from './components/screens/NotificationsView';
import { AccountCenter } from './components/screens/AccountCenter';
import { PaymentServicesPage } from './components/screens/PaymentServicesPage';
import { OntologyView } from './components/screens/OntologyView';
import { GlossaryView } from './components/screens/GlossaryView';
import { SecureWorkspace } from './components/screens/SecureWorkspace';
import { HeadCatalogue } from './components/screens/HeadCatalogue';
import { isPrivateTaxpayerRoute, requiresTaxpayerSignIn } from './services/privateRoutePolicy';

const previewReadOnlyRoutes = new Set([
  'taxpayer_home', 'dashboard', 'history', 'ledger', 'journey', 'certificates', 'corrections',
  'notifications', 'account_notifications', 'account_profile', 'account_settings', 'services'
]);

const activitySections = [
  { route: 'history', en: 'Transactions', bn: 'লেনদেনসমূহ' },
  { route: 'verify', en: 'Track payment', bn: 'পেমেন্ট অনুসন্ধান' },
  { route: 'corrections', en: 'Issues & corrections', bn: 'সমস্যা ও সংশোধন' },
  { route: 'certificates', en: 'Receipts & certificates', bn: 'রসিদ ও সনদপত্র' }
] as const;

const MainRouter: React.FC = () => {
  const { currentRoute, routeParams, navigate, userRole, setUserRole, language, demoUser, previewAccount, clearPreviewAccount, isPaymentServiceChoiceOpen } = useTaxState();
  const {user:verifiedApplicationUser,loading:checkingIdentity}=useAccountIdentity();
  const mainContentRef = useRef<HTMLElement>(null);
  const priorCitizenRouteRef = useRef<string | null>(null);
  const privateTaxpayerRoute = isPrivateTaxpayerRoute(currentRoute, false);
  const previewAccess = Boolean(previewAccount && previewReadOnlyRoutes.has(currentRoute));
  const privateSampleGate = !previewAccess && requiresTaxpayerSignIn(currentRoute, false, Boolean(verifiedApplicationUser), sampleJourneysEnabled, userRole);
  const transactionRoute = ['guest','guestwh','travel'].includes(currentRoute);
  const loginOverlay = currentRoute === 'taxpayer_login' || currentRoute === 'office_login';
  const taxpayerSession = Boolean(verifiedApplicationUser || previewAccount ||
    (sampleJourneysEnabled && ['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole)));
  const taxpayerSupportRoute = taxpayerSession && ['verify','user_guide','guidance'].includes(currentRoute);
  const publicInformationRoute = ['landing','incident'].includes(currentRoute) ||
    (['user_guide','guidance'].includes(currentRoute) && !taxpayerSupportRoute) ||
    (currentRoute === 'secure_workspace' && !verifiedApplicationUser) || loginOverlay;
  // Drafts use the private rail only with a verified application identity.
  const taxpayerReference = (privateTaxpayerRoute && !privateSampleGate) || taxpayerSupportRoute ||
    (currentRoute === 'secure_workspace' && Boolean(verifiedApplicationUser));
  const showActivitySections = taxpayerSession && !privateSampleGate &&
    activitySections.some(section => section.route === currentRoute);

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
    // Fictional user1 has a unified read-only story across all taxpayer views.
    // Only public demoUser=user1, never a signed-in account or financial backend.
    if ((sampleJourneysEnabled || previewAccount) && demoUser?.id === 'user1' && !verifiedApplicationUser && user1DemoRoutes.includes(currentRoute)) {
      return <User1DemoExperience route={currentRoute} />;
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
        return <ReceiptLookup />;
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
        return <PaymentHistory />;
      case 'payment_details':
        return <PaymentDetailView />;
      case 'ledger':
        return <TaxLedger />;
      case 'journey':
        return <TaxJourney />;
      case 'certificates':
        return <CertificatesView />;
      case 'corrections':
        return <CorrectionRequests />;
      case 'notifications':
        return <NotificationsView />;
      case 'account_notifications':
        return <AccountCenter page="notifications" />;
      case 'account_profile':
        return <AccountCenter page="profile" />;
      case 'account_settings':
        return <AccountCenter page="settings" />;
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
      <main ref={mainContentRef} id="main-content" tabIndex={-1} className={`flex-1 ${publicInformationRoute ? 'max-w-[1360px]' : 'max-w-7xl'} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8${transactionRoute ? ' citizen-main--transaction' : ''}`}>
        {privateSampleGate ? checkingIdentity ? <p role="status">{language === 'bn' ? 'আপনার সেশন যাচাই করা হচ্ছে…' : 'Checking your session…'}</p> : (
          <section className="citizen-account-gate">
            <h1>{language === "bn" ? "করদাতার ব্যক্তিগত তথ্য" : "Private taxpayer workspace"}</h1>
            <p>{sampleJourneysEnabled ? (language === "bn" ? "করদাতার পেমেন্টের ধাপ ও লেনদেন দেখুন।" : "Explore the taxpayer payment screens and activity.") : (language === 'bn' ? 'আপনার অ্যাকাউন্টে প্রবেশ করতে সাইন ইন করুন।' : 'Sign in to access your taxpayer account.')}</p>
            {sampleJourneysEnabled && <a className="citizen-account-gate__preview" href={language === 'bn'
              ? '?action=taxpayer_home&demoUser=user1&lang=bn'
              : '?action=taxpayer_home&demoUser=user1'}>
              {language === 'bn' ? 'ইন্টারঅ্যাকটিভ ড্যাশবোর্ড দেখুন' : 'Explore interactive dashboard'}
            </a>}
            {sampleJourneysEnabled ? <button type="button" onClick={() => {setUserRole("TAXPAYER_INDIVIDUAL");navigate("taxpayer_home");}}>{language === "bn" ? "করদাতা ওয়ার্কস্পেস দেখুন" : "Explore taxpayer workspace"}</button> :
              <button type="button" onClick={() => navigate('taxpayer_login')}>{language === 'bn' ? 'সাইন ইন' : 'Sign in'}</button>}
          </section>
        ) : <>
          {showActivitySections && <nav className="taxpayer-activity-sections" aria-label={language === 'bn' ? 'লেনদেনের বিভাগ' : 'Activity sections'}>
            {activitySections.map(section => (
              <button type="button" key={section.route} onClick={() => navigate(section.route)}
                aria-current={currentRoute === section.route ? 'page' : undefined}>
                {language === 'bn' ? section.bn : section.en}
              </button>
            ))}
          </nav>}
          {renderActiveScreen()}
        </>}
      </main>
      {!taxpayerReference && <CitizenFooter />}
      {publicInformationRoute && <PublicHelpChat />}
      <ParityRegisterModal />
      {isPaymentServiceChoiceOpen && <PaymentServiceChoiceDialog />}
      {loginOverlay && <TaxpayerLoginDialog />}
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
