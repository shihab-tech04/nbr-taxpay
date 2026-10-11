import React, { useEffect } from 'react';
import { TaxStateProvider, useTaxState } from './services/taxState';
import { DemoNoticeBanner } from './components/layout/DemoNoticeBanner';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { OfficeLoginPage } from './components/screens/OfficeLoginPage';
import { ParityRegisterModal } from './components/screens/ParityRegisterModal';

// Screens
import { PublicLanding } from './components/screens/PublicLanding';
import { GuestPayment } from './components/screens/GuestPayment';
import { TravelTax } from './components/screens/TravelTax';
import { ReceiptLookup } from './components/screens/ReceiptLookup';
import { IncidentReporting } from './components/screens/IncidentReporting';
import { ArchitectureView } from './components/screens/ArchitectureView';
import { TaxpayerHome } from './components/screens/TaxpayerHome';
import { TaxpayerDashboard } from './components/screens/TaxpayerDashboard';
import { PaymentWizard } from './components/screens/PaymentWizard';
import { PaymentHistory } from './components/screens/PaymentHistory';
import { PaymentDetailView } from './components/screens/PaymentDetailView';
import { TaxLedger } from './components/screens/TaxLedger';
import { TaxJourney } from './components/screens/TaxJourney';
import { CertificatesView } from './components/screens/CertificatesView';
import { CorrectionRequests } from './components/screens/CorrectionRequests';
import { NotificationsView } from './components/screens/NotificationsView';
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
  const { currentRoute, navigate } = useTaxState();

  // Listen to browser URL search params for direct action links (?action=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action && action !== currentRoute) {
      navigate(action);
    }
  }, []);

  const renderActiveScreen = () => {
    switch (currentRoute) {
      // Public Screens
      case 'landing':
        return <PublicLanding />;
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
        return <IncidentReporting />;
      case 'architecture':
        return <ArchitectureView />;

      // Taxpayer Screens
      case 'taxpayer_home':
        return <TaxpayerHome />;
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
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans text-slate-800">
      <DemoNoticeBanner />
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {renderActiveScreen()}
      </main>
      <Footer />
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
