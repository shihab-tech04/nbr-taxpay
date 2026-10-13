import React, { useState } from 'react';
import { HelpCircle, BookOpen, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

/** UX-only guidance until controlling Bangladesh tax law is sourced and reviewed.
 * Never calculate or propose a remittance using the old prototype's guessed rates.
 */
const CONTENT = {
  en: {
    title: 'Help & FAQs',
    subtitle: 'Answers to common tax-payment questions.',
    estimatorTitle: 'Individual income tax estimator — unavailable',
    estimatorNotice: 'Tax calculations are unavailable until the applicable tax rules are verified.',
    estimatorFoot: 'A tax calculation requires controlling law, income and assessment periods, taxpayer class, exceptions, verified parameters and tested rule versions. A displayed year alone is not enough.',
    faqTitle: 'Payment safety and application guidance',
    entries: [
      { q: 'Can I pay real income tax through TaxPay today?', a: 'No. Payment processing is not enabled and previews are not official challans.' },
      { q: 'Does an example wallet debit or challan establish a Treasury deposit?', a: 'No. Treasury settlement and tax credit require official reconciliation.' },
      { q: 'Can a withholding agent claim a credit for every withholding deposit?', a: 'Not automatically. Credit depends on the correct deductee, year and verified reconciliation.' },
      { q: 'What if my actual bank or wallet payment has a problem?', a: 'Contact the bank or payment provider and check official channels.' },
      { q: 'Can I change an assessment year or official challan here?', a: 'No. Official challan changes require an authorized government process.' }
    ]
  },
  bn: {
    title: 'TaxPay নির্দেশিকা ও সচরাচর প্রশ্ন',
    subtitle: 'কর পরিশোধের সাধারণ প্রশ্নের উত্তর।',
    estimatorTitle: 'ব্যক্তিগত আয়কর হিসাব — বর্তমানে বন্ধ',
    estimatorNotice: 'প্রযোজ্য করবিধি যাচাই না হওয়া পর্যন্ত কর হিসাব চালু নেই।',
    estimatorFoot: 'কর হিসাবের জন্য প্রযোজ্য আইন, আয়বর্ষ, করবর্ষ, করদাতার ধরন, ব্যতিক্রম, যাচাইকৃত পরামিতি ও পরীক্ষিত নিয়ম প্রয়োজন। শুধু করবর্ষের নাম যথেষ্ট নয়।',
    faqTitle: 'পরিশোধের নিরাপত্তা ও অ্যাপ নির্দেশিকা',
    entries: [
      { q: 'এখন কি TaxPay দিয়ে প্রকৃত আয়কর জমা দেওয়া যায়?', a: 'না। পেমেন্ট চালু নেই এবং প্রিভিউ সরকারি চালান নয়।' },
      { q: 'নমুনা ওয়ালেট ডেবিট বা চালান কি ট্রেজারিতে জমার প্রমাণ?', a: 'না। ট্রেজারি জমা ও কর ক্রেডিটের জন্য সরকারি সমন্বয় প্রয়োজন।' },
      { q: 'উৎস কর জমা দিলেই কি জমাদানকারীর নিজের কর ক্রেডিট হয়?', a: 'সরাসরি নয়। সঠিক কর কর্তনগ্রহীতা, করবর্ষ এবং যাচাইকৃত সমন্বয় প্রয়োজন।' },
      { q: 'প্রকৃত ব্যাংক বা মোবাইল ওয়ালেট পরিশোধে সমস্যা হলে কী করব?', a: 'ব্যাংক বা পেমেন্ট সেবাদাতার সঙ্গে যোগাযোগ করুন এবং সরকারি মাধ্যমে যাচাই করুন।' },
      { q: 'এই অ্যাপ দিয়ে কি সরকারি চালানের করবর্ষ সংশোধন করা যায়?', a: 'না। সরকারি চালান সংশোধনে অনুমোদিত সরকারি প্রক্রিয়া প্রয়োজন।' }
    ]
  }
} as const;

export const GuidanceAssistant: React.FC = () => {
  const { language } = useTaxState();
  const t = CONTENT[language];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="max-w-4xl mx-auto space-y-6 pb-12" aria-label={t.title}>
      <header className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <HelpCircle aria-hidden="true" className="w-5 h-5"/>
          </div>
          <div className="space-y-1 min-w-0">
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">{t.title}</h1>
            <p className="text-xs text-slate-600">{t.subtitle}</p>
          </div>
        </div>
        <section aria-labelledby="estimator-status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3">
          <div className="flex gap-2 items-start">
            <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-800" />
            <h2 id="estimator-status" className="font-serif-fraunces text-lg font-bold text-amber-950">{t.estimatorTitle}</h2>
          </div>
          <p className="text-sm leading-6 text-amber-950">{t.estimatorNotice}</p>
        </section>
      </header>
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4" aria-labelledby="guidance-faq-title">
        <div className="flex items-center gap-2">
          <BookOpen aria-hidden="true" className="w-5 h-5 text-emerald-800" />
          <h2 id="guidance-faq-title" className="font-serif-fraunces font-bold text-xl text-slate-900">{t.faqTitle}</h2>
        </div>
        <div className="space-y-3">
          {t.entries.map((faq, idx) => {
            const expanded = openFaq === idx;
            return (
              <article key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                <h3>
                  <button type="button" aria-expanded={expanded} aria-controls={'taxpay-faq-answer-' + idx}
                    onClick={() => setOpenFaq(expanded ? null : idx)}
                    className="w-full min-h-11 p-4 text-left font-semibold text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
                    <span>{faq.q}</span>
                    {expanded ? <ChevronUp aria-hidden="true" className="w-5 h-5 shrink-0"/> : <ChevronDown aria-hidden="true" className="w-5 h-5 shrink-0"/>}
                  </button>
                </h3>
                {expanded && <div id={'taxpay-faq-answer-' + idx} className="p-4 bg-white border-t border-slate-200">
                  <p className="text-sm leading-6 text-slate-700">{faq.a}</p>
                </div>}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
};
