import React from 'react';
import { Activity, Bell, BookOpen, ChevronDown, CircleHelp, CircleUserRound, FileCheck2, FilePenLine, Home, Landmark, LogOut, ReceiptText, Settings2, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';

type RailLink = { route: string; en: string; bn: string; Icon: React.ComponentType<{size?: number; 'aria-hidden'?: boolean}> };

const links: RailLink[] = [
  { route: 'taxpayer_home', en: 'Home', bn: 'মূল পাতা', Icon: Home },
  { route: 'history', en: 'Activity', bn: 'লেনদেন', Icon: Activity },
  { route: 'ledger', en: 'Tax ledger', bn: 'কর লেজার', Icon: BookOpen },
  { route: 'certificates', en: 'Certificates', bn: 'সনদপত্র', Icon: FileCheck2 },
  { route: 'corrections', en: 'Corrections', bn: 'সংশোধন', Icon: FilePenLine },
  { route: 'account_notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি', Icon: Bell },
  { route: 'guidance', en: 'Help', bn: 'সহায়তা', Icon: CircleHelp }
];

/** Taxpayer-only desktop layout. Demo navigation is not a verified-taxpayer entitlement. */
export function TaxpayerReferenceRail() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole } = useTaxState();
  const { user } = useAccountIdentity();
  const [signOutError, setSignOutError] = React.useState('');
  const [signingOut, setSigningOut] = React.useState(false);
  const logout = async () => {
    setSignOutError('');
    if (!user) { setUserRole('GUEST'); navigate('landing'); return; }
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
        <button className="taxpayer-reference-brand" type="button" onClick={() => navigate(user || sampleProfile ? 'taxpayer_home' : 'landing')}>
          <Landmark size={23} aria-hidden={true} />
          <span><strong>TaxPay</strong><small>{bn ? 'কর পরিশোধ সেবা' : 'Tax payment services'}</small></span>
        </button>
        <nav className="taxpayer-reference-links" aria-label={bn ? 'করদাতা সেবা' : 'Taxpayer services'}>
          {links.map(({route,en,bn:bnLabel,Icon}) => (
            <button key={route} type="button" aria-current={(currentRoute === route||(route==='taxpayer_home'&&currentRoute==='dashboard')) ? 'page' : undefined}
              onClick={() => navigate(route)}>
              <Icon size={18} aria-hidden={true} />
              <span>{bn ? bnLabel : en}</span>
            </button>
          ))}
          <button type="button" onClick={() => navigate('verify')} aria-current={currentRoute==='verify'?'page':undefined}>
            <ReceiptText size={18} aria-hidden={true} /><span>{bn ? 'পেমেন্টের অবস্থা' : 'Payment status'}</span>
          </button>
          <details className="taxpayer-reference-account" key={['secure_workspace','account_profile','account_settings'].includes(currentRoute)?'account-'+currentRoute:'account-closed'}
            open={['secure_workspace','account_profile','account_settings'].includes(currentRoute)||undefined}>
            <summary><CircleUserRound size={18} aria-hidden={true}/><span>{bn?'অ্যাকাউন্ট':'Account'}</span><ChevronDown size={16} aria-hidden={true}/></summary>
            <div className="taxpayer-reference-account__links">
              {[
                {route:'account_profile',en:'Profile',bn:'প্রোফাইল',Icon:CircleUserRound},
                {route:'account_settings',en:'Profile settings',bn:'প্রোফাইল সেটিংস',Icon:Settings2},
                {route:'secure_workspace',en:'Account access',bn:'অ্যাকাউন্ট প্রবেশ',Icon:CircleUserRound}
              ].map(item=><button key={item.route} type="button" onClick={()=>navigate(item.route)}
                aria-current={currentRoute===item.route?'page':undefined}>
                <item.Icon size={17} aria-hidden={true}/><span>{bn?item.bn:item.en}</span>
              </button>)}
            </div>
          </details>
          <button type="button" onClick={() => navigate('user_guide', {category:'payments'})}>
            <WalletCards size={18} aria-hidden={true}/><span>{bn?'পেমেন্ট নির্দেশিকা':'Payment guide'}</span>
          </button>
        </nav>
      </div>
      <div className="taxpayer-reference-rail-bottom">
        {(user || sampleProfile) && <button type="button" disabled={signingOut} onClick={logout}>
          <LogOut size={17} aria-hidden={true} />
          <span>{user ? (bn ? 'সাইন আউট' : 'Sign out') : (bn ? 'ডেমো থেকে বের হন' : 'Exit demo')}</span>
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
