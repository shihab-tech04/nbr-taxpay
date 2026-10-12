import React from 'react';
import { Activity, BookOpen, CircleHelp, ClipboardList, FileCheck2, FilePenLine, Home, Landmark, ReceiptText, Settings2, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

type RailLink = { route: string; en: string; bn: string; Icon: React.ComponentType<{size?: number; 'aria-hidden'?: boolean}> };

const links: RailLink[] = [
  { route: 'taxpayer_home', en: 'Home', bn: 'মূল পাতা', Icon: Home },
  { route: 'dashboard', en: 'Tax summary', bn: 'কর সারসংক্ষেপ', Icon: ClipboardList },
  { route: 'history', en: 'Activity', bn: 'লেনদেন', Icon: Activity },
  { route: 'ledger', en: 'Tax ledger', bn: 'কর লেজার', Icon: BookOpen },
  { route: 'certificates', en: 'Certificates', bn: 'সনদপত্র', Icon: FileCheck2 },
  { route: 'corrections', en: 'Corrections', bn: 'সংশোধন', Icon: FilePenLine },
  { route: 'secure_workspace', en: 'Account access', bn: 'অ্যাকাউন্ট প্রবেশ', Icon: Settings2 },
  { route: 'guidance', en: 'Help', bn: 'সহায়তা', Icon: CircleHelp }
];

/** Taxpayer-only desktop layout. Demo navigation is not a verified-taxpayer entitlement. */
export function TaxpayerReferenceRail() {
  const { currentRoute, navigate, language, setLanguage, userRole } = useTaxState();
  const bn = language === 'bn';
  const sampleProfile = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'].includes(userRole);

  return (
    <aside className="taxpayer-reference-rail" aria-label={bn ? 'করদাতা ডেস্কটপ নেভিগেশন' : 'Taxpayer desktop navigation'}>
      <div>
        <button className="taxpayer-reference-brand" type="button" onClick={() => navigate(sampleProfile ? 'taxpayer_home' : 'landing')}>
          <Landmark size={23} aria-hidden={true} />
          <span><strong>TaxPay</strong><small>{bn ? 'স্বতন্ত্র কর পেমেন্ট প্রদর্শনী' : 'Independent tax payment demo'}</small></span>
        </button>
        <button className="taxpayer-reference-main-action" type="button" onClick={() => navigate(sampleProfile ? 'wizard' : 'landing')}>
          <WalletCards size={18} aria-hidden={true} />
          {bn ? 'পেমেন্ট শুরু করুন' : 'Start payment demo'}
        </button>
        <nav className="taxpayer-reference-links" aria-label={bn ? 'করদাতা সেবা' : 'Taxpayer services'}>
          {links.map(({route,en,bn:bnLabel,Icon}) => (
            <button key={route} type="button" aria-current={currentRoute === route ? 'page' : undefined}
              onClick={() => navigate(route)}>
              <Icon size={18} aria-hidden={true} />
              <span>{bn ? bnLabel : en}</span>
            </button>
          ))}
          <button type="button" onClick={() => navigate('verify')}>
            <ReceiptText size={18} aria-hidden={true} /><span>{bn ? 'পেমেন্টের অবস্থা' : 'Payment status'}</span>
          </button>
        </nav>
      </div>
      <div className="taxpayer-reference-rail-bottom">
        <button type="button" onClick={() => setLanguage(bn ? 'en' : 'bn')}>
          <span>{bn ? 'ভাষা' : 'Language'}</span>
          <strong>{bn ? 'English' : 'বাংলা'}</strong>
        </button>
        <p>{sampleProfile
          ? (bn ? 'নমুনা প্রোফাইল · যাচাইকৃত করদাতা নয়' : 'Sample profile · not a verified taxpayer')
          : (bn ? 'অ্যাকাউন্ট প্রবেশ · সরকারি পরিচয় নয়' : 'Account access · not official identity')}</p>
      </div>
    </aside>
  );
}
