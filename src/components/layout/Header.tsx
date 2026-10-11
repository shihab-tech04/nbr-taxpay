import React, { useState } from 'react';
import { 
  Building2, 
  Globe2, 
  UserCheck, 
  Menu, 
  X, 
  CreditCard, 
  ShieldAlert, 
  Search, 
  FileCheck2, 
  Landmark, 
  Users, 
  Layers, 
  Compass, 
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { UI_STRINGS } from '../../services/localization';
import { UserRole } from '../../types/tax';

export const Header: React.FC = () => {
  const { 
    currentRoute, 
    navigate, 
    language, 
    setLanguage, 
    userRole, 
    setUserRole, 
    setIsParityModalOpen 
  } = useTaxState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navDropdown, setNavDropdown] = useState<'NONE' | 'PUBLIC' | 'TAXPAYER' | 'OFFICER' | 'REFERENCE'>('NONE');

  const t = UI_STRINGS[language];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;
    setUserRole(role);
    if (role.startsWith('OFFICER') || role === 'COMMISSIONER_ADMIN') {
      navigate('officer_home');
    } else if (role.startsWith('TAXPAYER') || role === 'WITHHOLDING_AGENT') {
      navigate('taxpayer_home');
    } else {
      navigate('landing');
    }
  };

  const navItemClass = (active: boolean) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
      active
        ? 'bg-emerald-800 text-amber-300 shadow-inner'
        : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
    }`;

  return (
    <header className="no-print bg-emerald-950 text-white shadow-lg sticky top-0 z-40 border-b border-emerald-800">
      {/* Top Bar: Gov Emblem, Title & Global Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Emblem Brand */}
          <button type="button"
            onClick={() => navigate('landing')}
            aria-label={language === 'bn' ? 'TaxPay মূল পাতা' : 'TaxPay home'}
            className="flex min-h-11 items-center gap-3.5 cursor-pointer group text-left rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-emerald-600 to-emerald-800 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-emerald-950 flex items-center justify-center border border-amber-400/40">
                <Landmark className="w-6 h-6 text-amber-400 group-hover:scale-105 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-fraunces text-xl font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                  {t.portalTitle}
                </span>
                <span className="hidden md:inline-block text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30 uppercase tracking-widest font-mono">
                  v11
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium">
                {t.portalSubtitle}
              </p>
            </div>
          </button>

          {/* Right Utility: Language Switcher, Role Simulator, Parity Register */}
          <div className="flex min-w-0 max-w-full items-center flex-wrap gap-2.5">
            {/* Language Switcher */}
            <div className="flex items-center bg-emerald-900/80 rounded-md p-0.5 border border-emerald-700/60 text-xs">
              <button
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`min-h-11 px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  language === 'en' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('bn')}
                aria-pressed={language === 'bn'}
                className={`min-h-11 px-2.5 py-1 rounded font-bengali font-semibold transition-colors cursor-pointer ${
                  language === 'bn' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200 hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>

            {/* Simulated User / Officer Role Switcher */}
            <div className="flex min-w-0 max-w-full items-center gap-1.5 bg-emerald-900/90 rounded-md px-2.5 py-1 border border-emerald-700/70 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                aria-label={language === 'bn' ? 'নমুনা প্রোফাইল নির্বাচন; অ্যাকাউন্ট অ্যাক্সেস নয়' : 'Sample profile selector — not account access'}
                value={userRole}
                onChange={handleRoleChange}
                className="min-w-0 max-w-full bg-transparent text-emerald-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="GUEST" className="bg-emerald-950 text-white">Public Guest</option>
                <option value="TAXPAYER_INDIVIDUAL" className="bg-emerald-950 text-white">Individual Taxpayer (Md. Tariqul)</option>
                <option value="TAXPAYER_CORPORATE" className="bg-emerald-950 text-white">Corporate Taxpayer (Bengal Tech)</option>
                <option value="WITHHOLDING_AGENT" className="bg-emerald-950 text-white">Withholding Agent (Padma Rail)</option>
                <option value="OFFICER_MAKER" className="bg-emerald-950 text-amber-300">Example Revenue Officer (Maker - ACT)</option>
                <option value="OFFICER_REVIEWER" className="bg-emerald-950 text-amber-300">Example Inspecting Officer (Reviewer - JCT)</option>
                <option value="OFFICER_APPROVER" className="bg-emerald-950 text-amber-300">Example Commissioner (Approver)</option>
                <option value="COMMISSIONER_ADMIN" className="bg-emerald-950 text-amber-300">Example System Admin / LTU Directorate</option>
              </select>
            </div>

            <button
              onClick={() => navigate('secure_workspace')}
              className="px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-300 text-xs font-semibold hover:bg-emerald-900"
              aria-current={currentRoute === 'secure_workspace' ? 'page' : undefined}
            >
              Secure workspace
            </button>

            {/* Parity Modal Button */}
            <button
              onClick={() => setIsParityModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-400/40 text-xs font-medium cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Parity Register (29/29)</span>
            </button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={language === 'bn' ? 'মোবাইল নেভিগেশন' : 'Mobile navigation'}
              aria-expanded={mobileMenuOpen}
              aria-controls="taxpay-mobile-menu"
              className="md:hidden min-h-11 min-w-11 p-2 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar (Desktop) */}
      <div className="hidden md:block bg-emerald-900 border-t border-emerald-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between py-1.5 gap-2">
            {/* Left Nav Group */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigate('landing')}
                className={navItemClass(currentRoute === 'landing')}
              >
                {t.navPublicHome}
              </button>

              <button 
                onClick={() => navigate('guest')}
                className={navItemClass(currentRoute === 'guest')}
              >
                {t.navGuestPay}
              </button>

              <button 
                onClick={() => navigate('guestwh')}
                className={navItemClass(currentRoute === 'guestwh')}
              >
                {t.navWithholding}
              </button>

              <button 
                onClick={() => navigate('travel')}
                className={navItemClass(currentRoute === 'travel')}
              >
                {t.navTravelTax}
              </button>

              <button 
                onClick={() => navigate('verify')}
                className={navItemClass(currentRoute === 'verify')}
              >
                {t.navVerifyReceipt}
              </button>

              <button 
                onClick={() => navigate('incident')}
                className={navItemClass(currentRoute === 'incident')}
              >
                {t.navReportIncident}
              </button>

              {/* Taxpayer Dropdown/Direct */}
              <button 
                onClick={() => navigate('taxpayer_home')}
                className={navItemClass(['taxpayer_home', 'dashboard', 'wizard', 'history', 'payment_details', 'ledger', 'journey', 'certificates', 'corrections', 'notifications', 'services'].includes(currentRoute))}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.navTaxpayerPortal}</span>
              </button>

              {/* Officer Workspace */}
              <button 
                onClick={() => navigate('officer_home')}
                className={navItemClass(['officer_home', 'taxpayer_360', 'payment_search', 'correction_queue', 'case_management', 'incident_investigation', 'offline_evidence', 'audit_trail', 'intelligence', 'monitoring'].includes(currentRoute))}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.navOfficerWorkspace}</span>
              </button>

              {/* Knowledge / Architecture */}
              <button 
                onClick={() => navigate('architecture')}
                className={navItemClass(['architecture', 'ontology', 'glossary', 'guidance'].includes(currentRoute))}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-300" />
                <span>{t.navArchitecture}</span>
              </button>
            </div>

            {/* Quick Action Pay Button */}
            <div>
              <button
                onClick={() => navigate('wizard')}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold px-3.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer font-serif-fraunces"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-950" />
                <span>{t.btnPayNow}</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div id="taxpay-mobile-menu" className="md:hidden bg-emerald-900 border-t border-emerald-800 px-4 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-emerald-800">
            <button
              onClick={() => { navigate('landing'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navPublicHome}
            </button>
            <button
              onClick={() => { navigate('guest'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navGuestPay}
            </button>
            <button
              onClick={() => { navigate('guestwh'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navWithholding}
            </button>
            <button
              onClick={() => { navigate('travel'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navTravelTax}
            </button>
            <button
              onClick={() => { navigate('verify'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navVerifyReceipt}
            </button>
            <button
              onClick={() => { navigate('incident'); setMobileMenuOpen(false); }}
              className="text-left px-3 py-2 text-sm rounded bg-emerald-950/60 text-white"
            >
              {t.navReportIncident}
            </button>
          </div>

          <div className="pt-2">
            <div className="text-xs uppercase font-bold text-amber-400 mb-1">Portals & Workspaces</div>
            <div className="space-y-1">
              <button
                onClick={() => { navigate('taxpayer_home'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-emerald-800 flex items-center justify-between text-white"
              >
                <span>Taxpayer Portal Home</span>
                <span className="text-xs text-amber-300">11 Screens</span>
              </button>
              <button
                onClick={() => { navigate('officer_home'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-emerald-800 flex items-center justify-between text-white"
              >
                <span>Officer Workspace</span>
                <span className="text-xs text-amber-300">10 Screens</span>
              </button>
              <button
                onClick={() => { navigate('architecture'); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-emerald-800 flex items-center justify-between text-white"
              >
                <span>Architecture & Models</span>
                <span className="text-xs text-amber-300">4 Views</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-emerald-800">
            <button
              onClick={() => { setIsParityModalOpen(true); setMobileMenuOpen(false); }}
              className="w-full text-center py-2 bg-amber-400 text-emerald-950 font-bold rounded text-sm"
            >
              View Route Parity Register (29/29)
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
