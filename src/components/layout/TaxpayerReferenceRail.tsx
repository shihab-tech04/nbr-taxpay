import React from 'react';
import { Activity, Bell, BookOpen, ChevronDown, CirclePlus, CircleUserRound, FileCheck2, Home, LogOut, Plane, RotateCcw, UsersRound } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';
import { SiteLogo } from './SiteLogo';

type RailLink = { route: string; en: string; bn: string; Icon: React.ComponentType<{size?: number; 'aria-hidden'?: boolean}> };

const links: RailLink[] = [
  { route: 'taxpayer_home', en: 'Overview', bn: 'সংক্ষিপ্ত বিবরণ', Icon: Home },
  { route: 'beneficiaries', en: 'Beneficiaries', bn: 'উপকারভোগী', Icon: UsersRound },
  { route: 'history', en: 'Activity', bn: 'লেনদেন', Icon: Activity },
  { route: 'ledger', en: 'Tax ledger', bn: 'কর লেজার', Icon: BookOpen },
  { route: 'certificates', en: 'Tax Credit Certificates', bn: 'কর ক্রেডিট সনদপত্র', Icon: FileCheck2 },
  { route: 'corrections', en: 'Correction Requests', bn: 'সংশোধনের আবেদন', Icon: RotateCcw },
  { route: 'account_notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি', Icon: Bell }
];

const activityRoutes = new Set(['history', 'verify']);

/** Taxpayer-only desktop layout. Demo navigation is not a verified-taxpayer entitlement. */
export function TaxpayerReferenceRail() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole, previewAccount, logoutPreviewAccount, setPaymentServiceChoiceOpen, openPaymentServiceChoice } = useTaxState();
  const { user } = useAccountIdentity();
  const [signOutError, setSignOutError] = React.useState('');
  const [payMenuOpen, setPayMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const logout = async () => {
    setSignOutError('');
    if (!user) {
      if (previewAccount) {
        setSigningOut(true);
        try { await logoutPreviewAccount(); }
        catch { setSignOutError(language === 'bn'
          ? 'আপনার ভাষা বা তালিকা সংরক্ষিত হয়নি। আবার সাইন আউট করুন।'
          : 'Your language or list changes could not be saved. Retry signing out.'); }
        finally { setSigningOut(false); }
      } else { setUserRole('GUEST'); navigate('landing'); }
      return;
    }
    setSigningOut(true);
    try {
      const result = await signOutApplicationAccount();
      if (!result.ok) throw new Error(result.error);
      setUserRole('GUEST');
      // Clear in-memory account-scoped content, just as the mobile sign-out does.
      window.location.assign(import.meta.env.BASE_URL);
    } catch { setSignOutError(language === 'bn' ? 'সাইন আউট ব্যর্থ। আবার চেষ্টা করুন।' : 'Sign-out failed. Please retry.'); }
    finally { setSigningOut(false); }
  };
  const bn = language === 'bn';
  const sampleProfile = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'].includes(userRole);
  return (
    <aside className="taxpayer-reference-rail" aria-label={bn ? 'করদাতা ডেস্কটপ নেভিগেশন' : 'Taxpayer desktop navigation'}>
      <div>
        <button className="taxpayer-reference-brand" type="button" onClick={() => navigate('landing')}>
          <SiteLogo className="taxpayer-reference-wordmark" alt={bn ? 'করবৃত্ত' : 'Korbritto'} />
        </button>
        {(user || sampleProfile) && currentRoute !== 'wizard' && <div className="relative">
          <button type="button" className="taxpayer-reference-main-action" onClick={() => setPayMenuOpen(open => !open)}
            aria-label={bn ? 'কর পরিশোধের মেনু' : 'Pay Tax menu'} aria-expanded={payMenuOpen} aria-controls="taxpayer-pay-menu">
            <CirclePlus size={20} aria-hidden={true} /><span>{bn ? 'কর পরিশোধ' : 'Pay Tax'}</span><ChevronDown size={16} aria-hidden={true}/>
          </button>
          {payMenuOpen && <div id="taxpayer-pay-menu" className="rounded-lg border border-taxpay-border bg-white p-2 shadow-sm" role="group" aria-label={bn ? 'কর পরিশোধের বিকল্প' : 'Payment options'}>
            <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-50" onClick={() => {setPayMenuOpen(false);setPaymentServiceChoiceOpen(true);}}><CirclePlus size={17} aria-hidden={true}/>{bn ? 'কর পরিশোধ' : 'Pay Tax'}</button>
            <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-50" onClick={() => {setPayMenuOpen(false);openPaymentServiceChoice('TRAVEL_TAX');}}><Plane size={17} aria-hidden={true}/>{bn ? 'ভ্রমণ কর' : 'Travel Tax'}</button>
          </div>}
        </div>}
        <nav className="taxpayer-reference-links" aria-label={bn ? 'করদাতা সেবা' : 'Taxpayer services'}>
          {links.map(({route,en,bn:bnLabel,Icon}) => (
            <button key={route} type="button" aria-current={(currentRoute === route || (route === 'taxpayer_home' && currentRoute === 'dashboard') || (route === 'history' && activityRoutes.has(currentRoute))) ? 'page' : undefined}
              onClick={() => navigate(route)}>
              <Icon size={20} aria-hidden={true} />
              <span>{bn ? bnLabel : en}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="taxpayer-reference-rail-bottom">
        <button type="button" onClick={() => navigate('account_profile')}
          aria-current={currentRoute === 'account_profile' ? 'page' : undefined}>
          <CircleUserRound size={17} aria-hidden={true} />
          <span>{bn ? 'প্রোফাইল' : 'Profile'}</span>
        </button>
        <button type="button" onClick={() => setLanguage(bn ? 'en' : 'bn')}>
          <span>{bn ? 'ভাষা' : 'Language'}</span>
          <strong>{bn ? 'English' : 'বাংলা'}</strong>
        </button>
        {(user || sampleProfile) && <button type="button" disabled={signingOut} onClick={logout}>
          <LogOut size={17} aria-hidden={true} />
          <span>{previewAccount || user ? (bn ? 'সাইন আউট' : 'Sign out') : (bn ? 'ওয়ার্কস্পেস থেকে বের হন' : 'Exit workspace')}</span>
        </button>}
        {signOutError && <p role="alert">{signOutError}</p>}
      </div>
    </aside>
  );
}
