import React from 'react';
import { Activity, Bell, BookOpen, ChevronDown, CircleHelp, CirclePlus, CircleUserRound, Home, LogOut } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';
import amarKorWordmark from '../../assets/amar-kor-wordmark-flat-v2.png';

type RailLink = { route: string; en: string; bn: string; Icon: React.ComponentType<{size?: number; 'aria-hidden'?: boolean}> };

const links: RailLink[] = [
  { route: 'taxpayer_home', en: 'Home', bn: 'মূল পাতা', Icon: Home },
  { route: 'history', en: 'Activity', bn: 'লেনদেন', Icon: Activity },
  { route: 'ledger', en: 'Tax ledger', bn: 'কর লেজার', Icon: BookOpen },
  { route: 'account_notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি', Icon: Bell }
];

// Keep the fixed rail; specialist workflows live in Activity, Profile and Pay Tax.
const menuLinks: RailLink[] = [
  { route: 'account_profile', en: 'Profile', bn: 'প্রোফাইল', Icon: CircleUserRound },
  { route: 'user_guide', en: 'Help', bn: 'সহায়তা', Icon: CircleHelp }
];
const activityRoutes = new Set(['history', 'verify', 'corrections', 'certificates']);

/** Taxpayer-only desktop layout. Demo navigation is not a verified-taxpayer entitlement. */
export function TaxpayerReferenceRail() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole, previewAccount, logoutPreviewAccount, isPaymentServiceChoiceOpen, setPaymentServiceChoiceOpen } = useTaxState();
  const { user } = useAccountIdentity();
  const [signOutError, setSignOutError] = React.useState('');
  const [signingOut, setSigningOut] = React.useState(false);
  const logout = async () => {
    setSignOutError('');
    if (!user) {
      if (previewAccount) logoutPreviewAccount();
      else { setUserRole('GUEST'); navigate('landing'); }
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
  const isMenuRoute = menuLinks.some(({route}) => route === currentRoute);

  return (
    <aside className="taxpayer-reference-rail" aria-label={bn ? 'করদাতা ডেস্কটপ নেভিগেশন' : 'Taxpayer desktop navigation'}>
      <div>
        <button className="taxpayer-reference-brand" type="button" onClick={() => navigate(user || sampleProfile ? 'taxpayer_home' : 'landing')}>
          <img className="taxpayer-reference-wordmark" src={amarKorWordmark} alt={bn ? 'আমার কর' : 'Amar Kor'} />
          <span><small>{bn ? 'কর পরিশোধ সেবা' : 'Tax payment services'}</small></span>
        </button>
        {(user || sampleProfile) && currentRoute !== 'wizard' && !isPaymentServiceChoiceOpen && <button type="button" className="taxpayer-reference-main-action" onClick={() => setPaymentServiceChoiceOpen(true)}
          aria-label={bn ? 'কর পরিশোধের ধরন নির্বাচন' : 'Pay — select payment type'}>
          <CirclePlus size={20} aria-hidden={true} />
          <span>{bn ? 'কর পরিশোধ' : 'Pay Tax'}</span>
        </button>}
        <nav className="taxpayer-reference-links" aria-label={bn ? 'করদাতা সেবা' : 'Taxpayer services'}>
          {links.map(({route,en,bn:bnLabel,Icon}) => (
            <button key={route} type="button" aria-current={(currentRoute === route || (route === 'taxpayer_home' && currentRoute === 'dashboard') || (route === 'history' && activityRoutes.has(currentRoute))) ? 'page' : undefined}
              onClick={() => navigate(route)}>
              <Icon size={20} aria-hidden={true} />
              <span>{bn ? bnLabel : en}</span>
            </button>
          ))}
          <details className="taxpayer-reference-account" key={isMenuRoute ? 'menu-' + currentRoute : 'menu-closed'}
            open={isMenuRoute || undefined}>
            <summary><CircleUserRound size={20} aria-hidden={true}/><span>{bn ? 'মেনু' : 'Menu'}</span><ChevronDown size={16} aria-hidden={true}/></summary>
            <div className="taxpayer-reference-account__links">
              {menuLinks.map(({route,en,bn:bnLabel,Icon}) => (
                <button key={route} type="button" onClick={() => navigate(route)}
                  aria-current={currentRoute === route ? 'page' : undefined}>
                  <Icon size={17} aria-hidden={true}/><span>{bn ? bnLabel : en}</span>
                </button>
              ))}
            </div>
          </details>
        </nav>
      </div>
      <div className="taxpayer-reference-rail-bottom">
        {(user || sampleProfile) && <button type="button" disabled={signingOut} onClick={logout}>
          <LogOut size={17} aria-hidden={true} />
          <span>{previewAccount || user ? (bn ? 'সাইন আউট' : 'Sign out') : (bn ? 'ওয়ার্কস্পেস থেকে বের হন' : 'Exit workspace')}</span>
        </button>}
        {signOutError && <p role="alert">{signOutError}</p>}
        <button type="button" onClick={() => setLanguage(bn ? 'en' : 'bn')}>
          <span>{bn ? 'ভাষা' : 'Language'}</span>
          <strong>{bn ? 'English' : 'বাংলা'}</strong>
        </button>
      </div>
    </aside>
  );
}
