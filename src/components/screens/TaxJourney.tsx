import React from 'react';
import { ArrowRight, BookOpen, CircleUserRound, FileCheck2, FilePenLine, Receipt, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';

const destinations = [
  { route: 'account_profile', title: { en: 'Profile', bn: 'প্রোফাইল' }, Icon: CircleUserRound },
  { route: 'history', title: { en: 'Payment activity', bn: 'পেমেন্টের তথ্য' }, Icon: Receipt },
  { route: 'secure_workspace', title: { en: 'Saved payment drafts', bn: 'সংরক্ষিত পেমেন্ট খসড়া' }, Icon: WalletCards },
  { route: 'ledger', title: { en: 'Tax ledger', bn: 'কর লেজার' }, Icon: BookOpen },
  { route: 'certificates', title: { en: 'Certificates', bn: 'সনদপত্র' }, Icon: FileCheck2 },
  { route: 'corrections', title: { en: 'Corrections', bn: 'সংশোধন' }, Icon: FilePenLine }
] as const;

/** Navigation, not fabricated legal milestones or official taxpayer history. */
export const TaxJourney: React.FC = () => {
  const { navigate, language } = useTaxState();
  const bn = language === 'bn';

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <TaxpayerPageHeading id="taxpay-journey-title" title={bn ? 'আমার কর কার্যক্রম' : 'My tax journey'}
        description={bn ? 'আপনার করসেবাগুলো এক জায়গায় দেখুন।' : 'Access your tax services in one place.'} />
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="taxpay-journey-title">
        <nav aria-label={bn ? 'করসেবা' : 'Tax services'} className="grid gap-3 sm:grid-cols-2">
          {destinations.map(({ route, title, Icon }) => (
            <button key={route} type="button" onClick={() => navigate(route)}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-taxpay-border bg-white p-4 text-left text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
              <Icon size={19} aria-hidden={true} />
              <span className="min-w-0 flex-1">{bn ? title.bn : title.en}</span>
              <ArrowRight size={17} aria-hidden={true} />
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
};
