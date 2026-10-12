import React, { useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Plane, 
  FileText, 
  ShieldCheck, 
  Clock, 
  HelpCircle, 
  Building2, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Coins
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { UI_STRINGS } from '../../services/localization';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { formatCurrency, formatNumber } from '../../services/numberFormat';

export const PublicLanding: React.FC = () => {
  const { language, navigate, lookupReceipt, selectReceipt } = useTaxState();
  const [quickSearch, setQuickSearch] = useState('');
  const [searchError, setSearchError] = useState('');

  const t = UI_STRINGS[language];
  const preview = language === 'bn' ? {
    gateway: 'স্বতন্ত্র TaxPay ওয়ার্কস্পেস',
    subtitle: 'কর পরিশোধের ধাপ, রসিদ অনুসন্ধান এবং করের খাতসমূহ এক জায়গায় দেখুন।',
    lookup: 'রসিদ ও টোকেন অনুসন্ধান',
    categories: 'কর পরিশোধের বিভাগ (যাচাই চলমান)',
    taxpayer: 'করদাতার হিসাব, রসিদ ও লেজারের কাঠামো দেখুন।',
    withholding: 'উৎসে কর কর্তনের ধাপ ও সংশ্লিষ্ট তথ্য দেখুন।',
    travel: 'ভ্রমণ করের ধাপ ও প্রয়োজনীয় বিবরণ দেখুন।'
  } : {
    gateway: 'Independent TaxPay Workspace',
    subtitle: 'Explore payment steps, receipt lookup and tax-head references in one place.',
    lookup: 'Receipt & Token Lookup',
    categories: 'Payment Categories (under review)',
    taxpayer: 'Explore account, receipt and ledger information.',
    withholding: 'Explore withholding deposit steps and supporting records.',
    travel: 'Explore the travel-tax workflow and required details.'
  };

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const found = lookupReceipt(quickSearch);
    if (found) {
      setSearchError('');
      selectReceipt(found.id);
    } else {
      setSearchError('No matching Challan No, Token, or Gateway Txn ID found.');
    }
  };

  return (
    <div className="space-y-10 pb-12">
      {/* Public-first introduction: payment services are discoverable without sign-in. */}
      <section className="citizen-overview text-white rounded-2xl p-4 sm:p-8 border relative overflow-hidden">
        <div className="max-w-3xl relative z-10 space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            {preview.gateway}
          </p>
          <h1 className="font-serif-fraunces text-[1.7rem] sm:text-4xl font-bold tracking-tight leading-tight">
            {language === 'bn' ? 'কর পরিশোধ ও পেমেন্টের অবস্থা' : 'Tax payments and payment status'}
          </h1>
          <p className="text-taxpay-light text-sm leading-relaxed">
            {language === 'bn' ? 'কর পরিশোধের ধরন বাছুন, নমুনা রসিদ খুঁজুন অথবা নির্দেশনা দেখুন। এটি প্রকৃত অর্থ জমার সেবা নয়।' : 'Choose a payment purpose, look up a sample receipt or explore guidance. This demonstration cannot collect real payments.'}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button"
              onClick={() => document.getElementById('taxpay-payment-types')?.scrollIntoView({ behavior: 'smooth' })}
              className="col-span-2 sm:col-span-1 min-h-11 px-4 py-2.5 bg-taxpay-accent text-taxpay-dark font-bold rounded-lg text-sm inline-flex items-center justify-center gap-2">
              <CreditCard size={17} aria-hidden="true"/>
              {language === 'bn' ? 'পেমেন্টের ধরন বাছুন' : 'Choose payment type'}
            </button>
            <button type="button" onClick={() => navigate('verify')}
              className="min-h-11 px-3 py-2 rounded-lg border border-white/60 text-white text-xs sm:text-sm font-semibold hover:bg-white/10">
              {language === 'bn' ? 'পেমেন্টের অবস্থা' : 'Payment status'}
            </button>
            <button type="button" onClick={() => navigate('guidance')}
              className="min-h-11 px-3 py-2 rounded-lg border border-white/60 text-white text-xs sm:text-sm font-semibold hover:bg-white/10">
              {language === 'bn' ? 'সহায়তা' : 'Help'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-white/90">
            <button onClick={() => navigate('guest')} className="min-h-11 hover:underline">
              {language === 'bn' ? 'অতিথি পেমেন্ট' : 'Guest checkout'}
            </button>
            <button onClick={() => navigate('travel')} className="min-h-11 hover:underline">
              {language === 'bn' ? 'ভ্রমণ কর' : 'Travel tax'}
            </button>
            <button onClick={() => navigate('office_login')} className="min-h-11 hover:underline">
              {language === 'bn' ? 'অফিস লগইন' : 'Office login'}
            </button>
          </div>
        </div>

        {/* Floating Quick Challan Lookup Box */}
        <div className="mt-8 pt-6 border-t border-taxpay-primary/80 max-w-2xl">
          <form onSubmit={handleQuickLookup} className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-taxpay-light">
              {preview.lookup}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Enter Challan No (AC-...), Token (TKN-...), or Txn ID"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg bg-taxpay-dark/60 border border-taxpay-primary text-white placeholder-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-taxpay-primary hover:bg-taxpay-primary text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                Verify Status
              </button>
            </div>
            {searchError && (
              <p className="text-xs text-rose-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {searchError}
              </p>
            )}
          </form>
        </div>
      </section>

      {/* 7 Core Payment Categories Grid */}
      <section id="taxpay-payment-types" className="space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              {preview.categories}
            </h2>
            <p className="text-xs text-slate-500">
              Select your payment purpose to begin the guided tax payment workflow.
            </p>
          </div>
          <button
            onClick={() => navigate('head_catalogue')}
            className="min-h-11 text-xs font-semibold text-taxpay-dark hover:text-taxpay-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 flex items-center gap-1"
          >
            <span>Browse Original Heads (170)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(CATEGORY_LABELS).map(([key, label], idx) => (
            <div key={key} className="relative bg-white border border-slate-200 hover:border-taxpay-primary rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <button type="button"
                className="absolute inset-0 z-10 rounded-xl w-full focus-visible:outline focus-visible:outline-3 focus-visible:outline-taxpay-primary"
                aria-label={(language === 'bn' ? label.bn : label.en) + (language === 'bn' ? ' পেমেন্ট শুরু করুন' : ' — start guest payment')}
                onClick={() => navigate(key === 'SOURCE_TAX_DEPOSIT' ? 'guestwh' : 'guest', { initialCategory: key })}>
              </button>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-taxpay-dark flex items-center justify-center font-bold text-xs group-hover:bg-taxpay-dark group-hover:text-amber-300 transition-colors">
                    0{idx + 1}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-serif-fraunces font-bold text-base text-slate-900 group-hover:text-taxpay-dark transition-colors">
                  {language === 'bn' ? label.bn : label.en}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {label.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-taxpay-dark group-hover:text-taxpay-dark">
                <span>Start Payment</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Highlights & Portals Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-taxpay-primary flex items-center justify-center text-amber-300">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-serif-fraunces font-bold text-lg">Taxpayer Workspace</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {preview.taxpayer}
          </p>
          <button
            onClick={() => navigate('taxpayer_home')}
            className="mt-2 text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <span>{language === 'bn' ? 'নমুনা করদাতা দেখুন' : 'View sample taxpayer workspace'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-taxpay-dark text-white rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-taxpay-primary flex items-center justify-center text-amber-300">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="font-serif-fraunces font-bold text-lg">Withholding Agent Mode</h3>
          <p className="text-xs text-taxpay-light leading-relaxed">
            {preview.withholding}
          </p>
          <button
            onClick={() => navigate('guestwh')}
            className="mt-2 text-xs font-semibold text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <span>Deposit Source Tax</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-slate-800 text-white rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-amber-400">
            <Plane className="w-5 h-5" />
          </div>
          <h3 className="font-serif-fraunces font-bold text-lg">Foreign Travel Tax</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {preview.travel}
          </p>
          <button
            onClick={() => navigate('travel')}
            className="mt-2 text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Pay Travel Tax Online</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>


    </div>
  );
};
