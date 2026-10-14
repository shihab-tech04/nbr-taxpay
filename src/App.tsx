import React, { useEffect, useRef } from 'react';
import { TaxStateProvider, useTaxState } from './services/taxState';
import { Header } from './components/layout/Header';
import { CitizenNavigation } from './components/layout/CitizenNavigation';
import { PublicHomeHeader } from './components/layout/PublicHomeHeader';
import { PublicHelpChat } from './components/layout/PublicHelpChat';
import { TaxpayerReferenceRail } from './components/layout/TaxpayerReferenceRail';
import {useAccountIdentity} from './services/accountIdentity';
import { Footer } from './components/layout/Footer';
import { CitizenFooter } from './components/layout/CitizenFooter';
import { OfficeLoginPage } from './components/screens/OfficeLoginPage';
import { ParityRegisterModal } from './components/screens/ParityRegisterModal';

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
import { PaymentWizard } from './components/screens/PaymentWizard';
import { PaymentHistory } from './components/screens/PaymentHistory';
import { PaymentDetailView } from './components/screens/PaymentDetailView';
import { TaxLedger } from './components/screens/TaxLedger';
import { TaxJourney } from './components/screens/TaxJourney';
import { CertificatesView } from './components/screens/CertificatesView';
import { CorrectionRequests } from './components/screens/CorrectionRequests';
import { NotificationsView } from './components/screens/NotificationsView';
import { AccountCenter } from './components/screens/AccountCenter';
import { ConnectedServices } from './components/screens/ConnectedServices';
import { OfficerHome } from './components/screens/OfficerHome';
import { Taxpayer360 } from './components/screens/Taxpayer360';
import { PaymentSearch } from './components/screens/PaymentSearch';
import { CorrectionQueue } from './components/screens/CorrectionQueue';
import { CaseManagement } from './components/screens/CaseManagement';
import { IncidentInvestigation } from './components/screens/IncidentInvestigation';
import { OfflineEvidence } from './components/screens/OfflineEvidence';
import { AuditTrail } from './components/screens/AuditTrail';
import { IntelligenceScreen } from './components/screens/IntelligenceScreen';
import { MonitoringScreen } from './components/screens/MonitoringScreen';
import { OntologyView } from './components/screens/OntologyView';
import { GlossaryView } from './components/screens/GlossaryView';
import { GuidanceAssistant } from './components/screens/GuidanceAssistant';
import { SecureWorkspace } from './components/screens/SecureWorkspace';
import { HeadCatalogue } from './components/screens/HeadCatalogue';

const MainRouter: React.FC = () => {
  const { currentRoute, navigate, userRole, setUserRole, language } = useTaxState();
  const {user:verifiedApplicationUser}=useAccountIdentity();
  const mainContentRef = useRef<HTMLElement>(null);
  const priorCitizenRouteRef = useRef<string | null>(null);
  const officerRoute = ['officer_home','taxpayer_360','payment_search','correction_queue','case_management','incident_investigation','offline_evidence','audit_trail','intelligence','monitoring'].includes(currentRoute);
  const privateTaxpayerRoute = ['taxpayer_home','dashboard','wizard','history','ledger','journey','certificates','corrections','notifications','account_notifications','account_profile','account_settings','services'].includes(currentRoute);
  const privateSampleGate = ['taxpayer_home','dashboard','wizard','history','ledger','journey','certificates','corrections','services'].includes(currentRoute) && !verifiedApplicationUser && !['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole);
  const transactionRoute = ['guest','guestwh','travel'].includes(currentRoute);
  const publicInformationRoute = ['landing','user_guide','incident'].includes(currentRoute);
  // Visual-only taxpayer scope; a sample profile is NOT an authenticated NBR identity.
  // Guest payment and Officer routes never inherit this reference palette.
  const taxpayerReference = !officerRoute && ((privateTaxpayerRoute && !privateSampleGate) || currentRoute === 'secure_workspace');

  // Listen to browser URL search params for direct action links (?action=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action && action !== currentRoute) {
      navigate(action);
    }
  }, []);

  // SPA navigation should announce the new main region to keyboard users.
  // Never intercept focus within locked Officer routes or on initial load.
  useEffect(() => {
    if (officerRoute) { priorCitizenRouteRef.current = null; return; }
    if (priorCitizenRouteRef.current !== null && priorCitizenRouteRef.current !== currentRoute) {
      mainContentRef.current?.focus({ preventScroll: true });
    }
    priorCitizenRouteRef.current = currentRoute;
  }, [currentRoute, officerRoute]);

  const renderActiveScreen = () => {
    switch (currentRoute) {
      // Public Screens
      case 'landing':
        return <PublicLanding />;
      case 'user_guide':
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
        return <ConnectedServices />;

      // Officer Screens
      case 'officer_home':
        return <OfficerHome />;
      case 'taxpayer_360':
        return <Taxpayer360 />;
      case 'payment_search':
        return <PaymentSearch />;
      case 'correction_queue':
        return <CorrectionQueue />;
      case 'case_management':
        return <CaseManagement />;
      case 'incident_investigation':
        return <IncidentInvestigation />;
      case 'offline_evidence':
        return <OfflineEvidence />;
      case 'audit_trail':
        return <AuditTrail />;
      case 'intelligence':
        return <IntelligenceScreen />;
      case 'monitoring':
        return <MonitoringScreen />;

      // Knowledge, Ontology & Guidance
      case 'ontology':
        return <OntologyView />;
      case 'glossary':
        return <GlossaryView />;
      case 'guidance':
        return <GuidanceAssistant />;

      default:
        return <PublicLanding />;
    }
  };

  if (currentRoute === 'office_login') return <OfficeLoginPage />;

  return (
    <div lang={officerRoute ? undefined : language} className={officerRoute ? "min-h-screen flex flex-col bg-slate-100 font-sans text-slate-800" : `taxpay-citizen-shell min-h-screen flex flex-col font-sans${taxpayerReference ? " taxpay-taxpayer-reference" : ""}${transactionRoute ? " taxpay-taxpayer-flow" : ""}`}>
      {officerRoute ? <Header /> : publicInformationRoute ? <PublicHomeHeader /> : <CitizenNavigation />}
      {taxpayerReference && !transactionRoute && <TaxpayerReferenceRail />}
      <main ref={officerRoute ? undefined : mainContentRef} id={officerRoute ? undefined : 'main-content'} tabIndex={officerRoute ? undefined : -1} className={`flex-1 ${publicInformationRoute ? 'max-w-[1360px]' : 'max-w-7xl'} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8${transactionRoute ? ' citizen-main--transaction' : ''}`}>
        {privateSampleGate ? (
          <section className="citizen-account-gate">
            <h1>{language === "bn" ? "করদাতার ব্যক্তিগত তথ্য" : "Private taxpayer workspace"}</h1>
            <p>{language === "bn" ? "করদাতার পেমেন্টের ধাপ দেখুন। এখানে প্রকৃত অ্যাকাউন্টের তথ্য ব্যবহার হয় না।" : "Explore the taxpayer payment screens with example data; no account is connected."}</p>
            <button type="button" onClick={() => {setUserRole("TAXPAYER_INDIVIDUAL");navigate("taxpayer_home");}}>{language === "bn" ? "করদাতা ওয়ার্কস্পেস দেখুন" : "Explore taxpayer workspace"}</button>
          </section>
        ) : renderActiveScreen()}
      </main>
      {officerRoute ? <Footer /> : <CitizenFooter />}
      {publicInformationRoute && <PublicHelpChat />}
      <ParityRegisterModal />
    </div>
  );
};

export default function App() {
  return (
    <TaxStateProvider>
      <MainRouter />
    </TaxStateProvider>
  );
}
