import React, { useState } from 'react';
import { HelpCircle, BookOpen, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

/** UX-only guidance until controlling Bangladesh tax law is sourced and reviewed.
 * Never calculate or propose a remittance using the old prototype's guessed rates.
 */
const CONTENT = {
  en: {
    title: 'TaxPay Guidance & Frequently Asked Questions',
    subtitle: 'How this development preview works; not an official NBR tax advisory service.',
    estimatorTitle: 'Individual income tax estimator — unavailable',
    estimatorNotice: 'No verified, year-specific income tax thresholds, rates, rebates, exemptions or minimum-tax parameters have been approved for execution in this application. The old prototype estimator is disabled to prevent incorrect tax calculations.',
    estimatorFoot: 'A tax calculation requires controlling law, income and assessment periods, taxpayer class, exceptions, verified parameters and tested rule versions. A displayed year alone is not enough.',
    faqTitle: 'Payment safety and application guidance',
    entries: [
      { q: 'Can I pay real income tax through TaxPay today?', a: 'No. This website is a development preview. Example checkout screens do not connect to an authorized government payment gateway or issue an official A-Challan. Do not treat demonstration receipts as proof of tax payment.' },
      { q: 'Does an example wallet debit or challan establish a Treasury deposit?', a: 'No. The prototype does not move money. Real gateway, Treasury settlement, challan ownership and taxpayer tax-credit recognition would require separate authenticated records and official reconciliation evidence.' },
      { q: 'Can a withholding agent claim a credit for every withholding deposit?', a: 'A withholding deposit is not proof of the depositing agent’s personal tax credit. Deductee ownership, relevant year, applicable law, reconciliation and duplicate-credit protections must be verified before any credit is recorded.' },
      { q: 'What if my actual bank or wallet payment has a problem?', a: 'Check the status through the authorized payment institution and official government channels. The incident form here is a prototype and does not open an official Treasury reconciliation case.' },
      { q: 'Can I change an assessment year or official challan here?', a: 'Not on the government system. The correction screens demonstrate a proposed workflow only; they cannot amend an official receipt or taxpayer ledger.' }
    ]
  },
  bn: {
    title: 'TaxPay নির্দেশিকা ও সচরাচর প্রশ্ন',
    subtitle: 'এই উন্নয়নমূলক প্রিভিউ ব্যবহারের তথ্য; এটি সরকারি NBR কর পরামর্শ সেবা নয়।',
    estimatorTitle: 'ব্যক্তিগত আয়কর হিসাব — বর্তমানে বন্ধ',
    estimatorNotice: 'এই অ্যাপে কার্যকর করার জন্য নির্দিষ্ট করবর্ষের আয়কর সীমা, হার, রেয়াত, অব্যাহতি বা ন্যূনতম করের পরামিতি অনুমোদিত ও যাচাইকৃত নয়। ভুল কর হিসাব এড়াতে পুরোনো নমুনার ক্যালকুলেটর বন্ধ রাখা হয়েছে।',
    estimatorFoot: 'কর হিসাবের জন্য প্রযোজ্য আইন, আয়বর্ষ, করবর্ষ, করদাতার ধরন, ব্যতিক্রম, যাচাইকৃত পরামিতি ও পরীক্ষিত নিয়ম প্রয়োজন। শুধু করবর্ষের নাম যথেষ্ট নয়।',
    faqTitle: 'পরিশোধের নিরাপত্তা ও অ্যাপ নির্দেশিকা',
    entries: [
      { q: 'এখন কি TaxPay দিয়ে প্রকৃত আয়কর জমা দেওয়া যায়?', a: 'না। এটি উন্নয়নমূলক প্রিভিউ। নমুনা পরিশোধের ধাপগুলো সরকারি পেমেন্ট গেটওয়ের সাথে সংযুক্ত নয় এবং সরকারি এ-চালান তৈরি করে না। নমুনা রসিদকে কর পরিশোধের প্রমাণ হিসেবে ব্যবহার করবেন না।' },
      { q: 'নমুনা ওয়ালেট ডেবিট বা চালান কি ট্রেজারিতে জমার প্রমাণ?', a: 'না। এই নমুনায় অর্থ স্থানান্তর হয় না। প্রকৃত গেটওয়ে, ট্রেজারি নিষ্পত্তি, চালানের মালিকানা ও কর ক্রেডিটের জন্য আলাদা সরকারি যাচাই প্রয়োজন।' },
      { q: 'উৎস কর জমা দিলেই কি জমাদানকারীর নিজের কর ক্রেডিট হয়?', a: 'উৎস কর জমার তথ্য থেকে জমাদানকারীর নিজের কর ক্রেডিট প্রমাণিত হয় না। সুবিধাভোগী, সংশ্লিষ্ট বর্ষ, প্রযোজ্য আইন ও পুনরাবৃত্তি প্রতিরোধ যাচাই করতে হবে।' },
      { q: 'প্রকৃত ব্যাংক বা মোবাইল ওয়ালেট পরিশোধে সমস্যা হলে কী করব?', a: 'সংশ্লিষ্ট অনুমোদিত আর্থিক প্রতিষ্ঠান ও সরকারি মাধ্যমে অবস্থা যাচাই করুন। এখানকার অভিযোগ ফর্ম সরকারি ট্রেজারি মামলা তৈরি করে না।' },
      { q: 'এই অ্যাপ দিয়ে কি সরকারি চালানের করবর্ষ সংশোধন করা যায়?', a: 'না। সংশোধন পৃষ্ঠাগুলো কেবল প্রস্তাবিত প্রক্রিয়া দেখায়; এগুলো সরকারি রসিদ বা করদাতার লেজার পরিবর্তন করে না।' }
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
          <p className="text-xs leading-5 text-amber-900">{t.estimatorFoot}</p>
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
