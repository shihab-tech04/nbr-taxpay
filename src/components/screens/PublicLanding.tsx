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
      {/* Hero Banner with Official Crest & Forest Green Theme */}
      <section className="citizen-overview text-white rounded-2xl p-6 sm:p-8 border relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-800/80 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-700">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{preview.gateway}</span>
          </div>

          <h1 className="font-serif-fraunces text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Seamless & Transparent Income Tax Payments for Bangladesh
          </h1>

          <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed">
            {preview.subtitle}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate('office_login')}
              className="min-h-11 px-4 py-3 border border-amber-300 text-amber-100 hover:bg-emerald-800 rounded-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
              {language === 'bn' ? 'অফিস লগইন' : 'Office Login'}
            </button>
            <button
              onClick={() => document.getElementById('taxpay-payment-types')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-lg text-sm sm:text-base flex items-center gap-2 shadow-md transition-all cursor-pointer font-serif-fraunces"
            >
              <CreditCard className="w-5 h-5 text-emerald-950" />
              <span>{language === 'bn' ? 'পেমেন্টের ধরন বাছুন' : 'Choose a payment type'}</span>
            </button>

            <button
              onClick={() => navigate('guest')}
              className="px-5 py-3 bg-emerald-800/80 hover:bg-emerald-800 text-white font-medium rounded-lg text-sm flex items-center gap-2 border border-emerald-700/80 cursor-pointer"
            >
              <span>Guest Fast Checkout</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </button>

            <button
              onClick={() => navigate('travel')}
              className="px-4 py-3 bg-teal-900/60 hover:bg-teal-900 text-teal-200 font-medium rounded-lg text-sm flex items-center gap-2 border border-teal-700/60 cursor-pointer"
            >
              <Plane className="w-4 h-4 text-teal-400" />
              <span>Pay Travel Tax</span>
            </button>
          </div>
        </div>

        {/* Floating Quick Challan Lookup Box */}
        <div className="mt-8 pt-6 border-t border-emerald-800/80 max-w-2xl">
          <form onSubmit={handleQuickLookup} className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-200">
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
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg bg-emerald-900/60 border border-emerald-700 text-white placeholder-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
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
            className="min-h-11 text-xs font-semibold text-emerald-800 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 flex items-center gap-1"
          >
            <span>Browse Original Heads (170)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(CATEGORY_LABELS).map(([key, label], idx) => (
            <div
              key={key}
              onClick={() => navigate(key === 'SOURCE_TAX_DEPOSIT' ? 'guestwh' : 'guest', { initialCategory: key })}
              className="bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-900 group-hover:text-amber-300 transition-colors">
                    0{idx + 1}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-serif-fraunces font-bold text-base text-slate-900 group-hover:text-emerald-900 transition-colors">
                  {language === 'bn' ? label.bn : label.en}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {label.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-800 group-hover:text-emerald-950">
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
          <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300">
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

        <div className="bg-emerald-900 text-white rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="font-serif-fraunces font-bold text-lg">Withholding Agent Mode</h3>
          <p className="text-xs text-emerald-100 leading-relaxed">
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
