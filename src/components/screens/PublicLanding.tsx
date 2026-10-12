import React, { useState } from 'react';
import { ArrowRight, CircleHelp, FileSearch, Landmark, Search, ShieldAlert } from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { useTaxState } from '../../services/taxState';
import type { PaymentCategory } from '../../types/tax';

export const PublicLanding: React.FC = () => {
  const { language, navigate, lookupReceipt, selectReceipt } = useTaxState();
  const [reference, setReference] = useState('');
  const [notFound, setNotFound] = useState(false);
  const bn = language === 'bn';
  const label = (en:string,bengali:string)=>bn?bengali:en;

  const openCategory=(key:PaymentCategory)=>{
    setNotFound(false);
    if(key==='SOURCE_TAX_DEPOSIT') navigate('guestwh');
    else navigate('guest',{initialCategory:key});
  };
  const handleLookup=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const ref=reference.trim();
    if(!ref){setNotFound(true);return;}
    const found=lookupReceipt(ref);
    if(found) {setNotFound(false);selectReceipt(found.id);}
    else setNotFound(true);
  };

  return (
    <div className={`mx-auto max-w-5xl space-y-5 pb-12 ${bn?'font-bengali':''}`}>
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-7" aria-labelledby="citizen-guest-title">
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-taxpay-dark">
          <Landmark size={16} aria-hidden="true"/>
          {label('Independent TaxPay Workspace','স্বতন্ত্র TaxPay ওয়ার্কস্পেস')}
        </p>
        <h1 id="citizen-guest-title" className="max-w-3xl text-2xl font-bold leading-snug text-taxpay-text sm:text-3xl">
          {label('Select a payment service','পেমেন্ট সেবা নির্বাচন করুন')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-taxpay-muted">
          {label('Browse income-tax and travel-tax payment journeys. This is a demonstration, not a live payment service.','আয়কর ও ভ্রমণ কর পরিশোধের ধাপ দেখুন। এটি নমুনা প্রদর্শনী, প্রকৃত পেমেন্ট সেবা নয়।')}
        </p>
      </section>

      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="citizen-payment-options">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="citizen-payment-options" className="text-lg font-bold text-taxpay-text">{label('Payment options','পেমেন্টের ধরন')}</h2>
            <p className="mt-1 text-xs text-taxpay-muted">{label('Choose a purpose to view its required information.','প্রয়োজনীয় তথ্য দেখতে পেমেন্টের ধরন নির্বাচন করুন।')}</p>
          </div>
          <span className="inline-flex shrink-0 rounded-md bg-taxpay-light px-2.5 py-1.5 text-xs font-semibold text-taxpay-dark">
            {label('Demo','নমুনা')}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(CATEGORY_LABELS).map(([key,item])=>(
            <button key={key} type="button" onClick={()=>openCategory(key as PaymentCategory)}
              className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-3 text-left hover:border-taxpay-primary hover:bg-taxpay-light">
              <span className="min-w-0 flex-1 text-sm font-semibold text-taxpay-text">{bn?item.bn:item.en}</span>
              <ArrowRight size={17} className="shrink-0 text-taxpay-dark" aria-hidden="true"/>
            </button>
          ))}
          <button type="button" onClick={()=>navigate('travel')}
            className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-3 text-left hover:border-taxpay-primary hover:bg-taxpay-light">
            <span className="min-w-0 flex-1 text-sm font-semibold text-taxpay-text">{label('Travel Tax','ভ্রমণ কর')}</span>
            <ArrowRight size={17} className="shrink-0 text-taxpay-dark" aria-hidden="true"/>
          </button>
        </div>
        <details className="mt-3 rounded-lg bg-taxpay-background p-3 text-sm text-taxpay-muted">
          <summary className="cursor-pointer font-semibold text-taxpay-dark">{label('About these payment categories','পেমেন্টের ধরন সম্পর্কে')}</summary>
          <p className="mt-2 leading-relaxed">{label('The 170 source-derived payment-head records are under legal review. Selecting a category does not certify its rate, eligibility or government accounting code.','উৎস থেকে নেওয়া ১৭০টি করের খাতের আইনগত যাচাই চলমান। একটি খাত নির্বাচন করলেই হার, যোগ্যতা বা সরকারি হিসাব কোড যাচাইকৃত হয় না।')}</p>
          <button type="button" onClick={()=>navigate('head_catalogue')}
            className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold text-taxpay-dark hover:underline">
            {label('Browse Original Heads (170)','মূল করের খাত দেখুন (১৭০)')} <ArrowRight size={16} aria-hidden="true"/>
          </button>
        </details>
      </section>

      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="citizen-receipt-lookup">
        <div className="mb-3 flex items-center gap-2">
          <FileSearch size={19} className="text-taxpay-dark" aria-hidden="true"/>
          <h2 id="citizen-receipt-lookup" className="text-lg font-bold text-taxpay-text">{label('Find a sample receipt','নমুনা রসিদ খুঁজুন')}</h2>
        </div>
        <form onSubmit={handleLookup}>
          <label htmlFor="citizen-lookup-reference" className="mb-1 block text-sm font-semibold text-taxpay-text">
            {label('Challan, token or transaction reference','চালান, টোকেন বা লেনদেনের রেফারেন্স')}
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input id="citizen-lookup-reference" type="text" value={reference}
              onChange={event=>{setReference(event.target.value);setNotFound(false);}}
              placeholder={label('Enter a sample reference','নমুনা রেফারেন্স লিখুন')}
              className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text"/>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white hover:bg-taxpay-dark">
              <Search size={17} aria-hidden="true"/> {label('Search','খুঁজুন')}
            </button>
          </div>
          {notFound && <p role="status" className="mt-2 text-sm text-taxpay-error">{label('No matching demonstration reference. Check the number and try again.','কোনো নমুনা রেফারেন্স পাওয়া যায়নি। নম্বর যাচাই করে আবার চেষ্টা করুন।')}</p>}
          <p className="mt-2 text-xs text-taxpay-muted">{label('Search checks sample data only, not Treasury or official NBR records.','অনুসন্ধান শুধু নমুনা তথ্যে হয়, ট্রেজারি বা এনবিআরের সরকারি তথ্যে নয়।')}</p>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label={label('Other services','অন্যান্য সেবা')}>
        <button type="button" onClick={()=>navigate('verify')}
          className="flex min-h-14 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-4 text-left text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light">
          <FileSearch size={19} aria-hidden="true"/><span className="flex-1">{label('Payment status','পেমেন্টের অবস্থা')}</span><ArrowRight size={16} aria-hidden="true"/>
        </button>
        <button type="button" onClick={()=>navigate('incident')}
          className="flex min-h-14 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-4 text-left text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light">
          <ShieldAlert size={19} aria-hidden="true"/><span className="flex-1">{label('Report a payment problem','পেমেন্টের সমস্যা জানান')}</span><ArrowRight size={16} aria-hidden="true"/>
        </button>
      </section>
    </div>
  );
};
