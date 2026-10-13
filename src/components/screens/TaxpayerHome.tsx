import React from 'react';
import { Activity, ArrowRight, Bell, BookOpen, FileCheck2, FileClock, FilePenLine, Landmark, Link2, LayoutDashboard, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import type { TreasuryStatus, TaxCreditStatus } from '../../types/tax';

type Destination = {
  route: string;
  en: string;
  bn: string;
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
};
const secondaryDestinations: Destination[] = [
  { route: 'dashboard', en: 'Dashboard', bn: 'কর সারসংক্ষেপ', Icon: LayoutDashboard },
  { route: 'journey', en: 'Tax journey', bn: 'করের ইতিহাস', Icon: FileClock },
  { route: 'notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি', Icon: Bell },
  { route: 'services', en: 'Connected services', bn: 'সংযুক্ত সেবা', Icon: Link2 }
];

const treasuryLabels: Record<TreasuryStatus, { en: string; bn: string }> = {
  INITIATED: { en: 'Initiated', bn: 'শুরু হয়েছে' },
  GATEWAY_PENDING: { en: 'Gateway pending', bn: 'গেটওয়েতে অপেক্ষমাণ' },
  GATEWAY_SUCCESS: { en: 'Gateway success (sample)', bn: 'গেটওয়েতে সফল (নমুনা)' },
  TREASURY_SCROLLED: { en: 'Treasury-scrolled (sample)', bn: 'ট্রেজারিতে নথিভুক্ত (নমুনা)' },
  FAILED: { en: 'Failed', bn: 'ব্যর্থ' },
  EXPIRED: { en: 'Expired', bn: 'মেয়াদ শেষ' },
  REVERSED: { en: 'Reversed', bn: 'বাতিল / প্রত্যাবর্তিত' }
};
const creditLabels: Record<TaxCreditStatus, { en: string; bn: string }> = {
  NOT_APPLICABLE: { en: 'Not applicable', bn: 'প্রযোজ্য নয়' },
  PENDING_RECONCILIATION: { en: 'Awaiting reconciliation', bn: 'সমন্বয়ের অপেক্ষায়' },
  CREDITED_TO_LEDGER: { en: 'Sample credited state (unverified)', bn: 'নমুনা ক্রেডিট অবস্থা (যাচাই হয়নি)' },
  CLAIMED_IN_RETURN: { en: 'Sample claim state (unverified)', bn: 'নমুনা দাবির অবস্থা (যাচাই হয়নি)' },
  DISPUTED: { en: 'Disputed', bn: 'বিরোধপূর্ণ' }
};

export const TaxpayerHome: React.FC = () => {
  const { taxpayerProfile, receipts, navigate, selectReceipt, language } = useTaxState();
  const bn = language === 'bn';
  // The fixture is keyed by payer TIN, not verified tax-credit ownership. It must not
  // be used to compute a personal ledger balance or imply that this is a real account.
  const initiatedExamples = receipts.filter(r => r.payerTin === taxpayerProfile.tin).slice(0, 3);
  const label = (en: string, bengali: string) => bn ? bengali : en;
  const quickDestinations: Destination[] = [
    { route: 'history', en: 'Payments & activity', bn: 'পেমেন্ট ও লেনদেন', Icon: Activity },
    { route: 'ledger', en: 'Tax ledger', bn: 'কর লেজার', Icon: BookOpen },
    { route: 'certificates', en: 'Certificates', bn: 'সনদপত্র', Icon: FileCheck2 },
    { route: 'corrections', en: 'Corrections', bn: 'সংশোধন', Icon: FilePenLine }
  ];

  return (
    <div className={`citizen-taxpayer-home mx-auto max-w-5xl space-y-5 pb-12 ${bn ? 'font-bengali' : ''}`}>
      <section className="citizen-taxpayer-hero" aria-labelledby="taxpay-home-title">
        <div>
          <p className="citizen-taxpayer-hero__eyebrow"><Landmark size={16} aria-hidden="true" />{label('Taxpayer workspace', 'করদাতা ওয়ার্কস্পেস')}</p>
          <h1 id="taxpay-home-title">{label('My Tax Payments', 'আমার কর পেমেন্ট')}</h1>
          <p>{label('Manage payment activity and access tax services.', 'পেমেন্টের তথ্য দেখুন এবং করসেবা ব্যবহার করুন।')}</p>
          <div className="citizen-taxpayer-hero__actions">
            <button type="button" className="citizen-taxpayer-primary" onClick={() => navigate('wizard')}>
              <WalletCards size={18} aria-hidden="true" />{label('Explore payment flow', 'পেমেন্টের ধাপ দেখুন')}
            </button>
            <button type="button" className="citizen-taxpayer-secondary" onClick={() => navigate('secure_workspace')}>
              {label('Secure account access', 'নিরাপদ অ্যাকাউন্ট প্রবেশ')}<ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <section className="citizen-taxpayer-summary" aria-labelledby="taxpay-summary-title">
        <div className="citizen-hub-section__heading">
          <div><p className="citizen-hub-eyebrow">{label('Account overview', 'অ্যাকাউন্টের সারসংক্ষেপ')}</p><h2 id="taxpay-summary-title">{label('Tax position', 'করের অবস্থান')}</h2></div>
        </div>
        <div className="citizen-taxpayer-summary__cards">
          <article><span>{label('Outstanding tax', 'বকেয়া কর')}</span><strong>{label('Unavailable', 'পাওয়া যাচ্ছে না')}</strong></article>
          <article><span>{label('Recognized credit', 'স্বীকৃত কর ক্রেডিট')}</span><strong>{label('Unverified', 'যাচাই হয়নি')}</strong></article>
        </div>
      </section>

      <section className="citizen-taxpayer-profile" aria-label={label('Profile', 'প্রোফাইল')}>
        <div className="citizen-taxpayer-profile__mark" aria-hidden="true"><Landmark size={20} /></div>
        <div className="min-w-0 flex-1">
          <p className="citizen-hub-eyebrow">{label('Profile', 'প্রোফাইল')}</p>
          <h2>{label('Account details', 'অ্যাকাউন্টের বিবরণ')}</h2>
          <button type="button" className="citizen-text-action" onClick={() => navigate('secure_workspace')}>
            {label('Account access', 'অ্যাকাউন্টে প্রবেশ')}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="citizen-taxpayer-quick" aria-labelledby="taxpay-quick-title">
        <div className="citizen-hub-section__heading">
          <div><p className="citizen-hub-eyebrow">{label('Your services', 'আপনার সেবা')}</p><h2 id="taxpay-quick-title">{label('Quick access', 'দ্রুত প্রবেশ')}</h2></div>
        </div>
        <div className="citizen-taxpayer-quick__grid">
          {quickDestinations.map(({ route, en, bn: bnName, Icon }) => (
            <button type="button" key={route} onClick={() => navigate(route)}>
              <span><Icon size={20} aria-hidden={true} /></span><strong>{bn ? bnName : en}</strong><ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="taxpay-recent-title" className="citizen-taxpayer-activity">
        <div className="citizen-hub-section__heading">
          <div><p className="citizen-hub-eyebrow">{label('Payments', 'পেমেন্ট')}</p><h2 id="taxpay-recent-title">{label('Recent activity', 'সাম্প্রতিক লেনদেন')}</h2></div>
          <button type="button" onClick={() => navigate('history')} className="citizen-text-action">{label('View all', 'সব দেখুন')}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {initiatedExamples.length === 0 ? (
          <p className="citizen-taxpayer-activity__empty">{label('No activity to display.', 'দেখানোর মতো কোনো লেনদেন নেই।')}</p>
        ) : (
          <div className="citizen-taxpayer-activity__list">
            {initiatedExamples.map(receipt => (
              <article key={receipt.id}>
                <div className="citizen-taxpayer-activity__row">
                  <div className="min-w-0"><p className="break-all font-mono-plex text-sm font-semibold">{receipt.challanNo}</p><p>{label('Assessment year', 'করবর্ষ')} {receipt.assessmentYear}</p></div>
                  <strong className="shrink-0 tabular-nums">{formatCurrency(receipt.totalAmount, language)}</strong>
                </div>
                <div className="citizen-taxpayer-activity__statuses">
                  <span>{label('Treasury status', 'ট্রেজারির অবস্থা')}: {bn ? treasuryLabels[receipt.treasuryStatus].bn : treasuryLabels[receipt.treasuryStatus].en}</span>
                  <span>{label('Credit status', 'ক্রেডিটের অবস্থা')}: {bn ? creditLabels[receipt.taxCreditStatus].bn : creditLabels[receipt.taxCreditStatus].en}</span>
                </div>
                <button type="button" onClick={() => selectReceipt(receipt.id)} className="citizen-text-action">{label('View details', 'বিস্তারিত দেখুন')}<ArrowRight size={15} aria-hidden="true" /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="citizen-taxpayer-more">
        <summary>{label('More taxpayer services', 'আরও করদাতা সেবা')}</summary>
        <div>
          {secondaryDestinations.map(({ route, en, bn: bnName, Icon }) => (
            <button type="button" key={route} onClick={() => navigate(route)}><Icon size={18} aria-hidden={true} /><span>{bn ? bnName : en}</span><ArrowRight size={15} aria-hidden="true" /></button>
          ))}
        </div>
      </details>
    </div>
  );
};
