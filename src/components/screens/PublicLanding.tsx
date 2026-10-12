import React, { useState } from 'react';
import { ArrowRight, CircleHelp, FileSearch, Landmark, Search, ShieldAlert, WalletCards } from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { useTaxState } from '../../services/taxState';
import type { PaymentCategory } from '../../types/tax';

const featuredCategories: PaymentCategory[] = [
  'TAX_WITH_RETURN', 'ADVANCE_TAX', 'SOURCE_TAX_DEPOSIT', 'OTHER_TAX_PAYMENT'
];

export const PublicLanding: React.FC = () => {
  const { language, navigate, lookupReceipt, selectReceipt } = useTaxState();
  const [reference, setReference] = useState('');
  const [notFound, setNotFound] = useState(false);
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  const openCategory = (key: PaymentCategory) => {
    setNotFound(false);
    if (key === 'SOURCE_TAX_DEPOSIT') navigate('guestwh');
    else navigate('guest', { initialCategory: key });
  };
  const handleLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ref = reference.trim();
    if (!ref) { setNotFound(true); return; }
    const found = lookupReceipt(ref);
    if (found) { setNotFound(false); selectReceipt(found.id); }
    else setNotFound(true);
  };
  const focusReceiptLookup = () => {
    document.getElementById('citizen-lookup-reference')?.focus();
  };
  const remainingCategories = Object.entries(CATEGORY_LABELS)
    .filter(([key]) => !featuredCategories.includes(key as PaymentCategory));

  return (
    <div className={`citizen-public-hub mx-auto max-w-5xl space-y-5 pb-12 ${bn ? 'font-bengali' : ''}`}>
      <section className="citizen-public-hero" aria-labelledby="citizen-guest-title">
        <div className="citizen-public-hero__copy">
          <p className="citizen-public-hero__eyebrow"><Landmark size={16} aria-hidden="true" />
            {label('Public TaxPay guide', 'TaxPay জনসেবা নির্দেশিকা')}
          </p>
          <h1 id="citizen-guest-title">{label('Understand your next tax-payment step', 'আপনার পরবর্তী কর পরিশোধের ধাপ জানুন')}</h1>
          <p>{label('Explore payment journeys, check sample references and find guidance. This independent prototype is not a live NBR or Treasury service.', 'পেমেন্টের ধাপ দেখুন, নমুনা রেফারেন্স যাচাই করুন এবং নির্দেশনা খুঁজুন। এই স্বতন্ত্র প্রোটোটাইপ প্রকৃত এনবিআর বা ট্রেজারি সেবা নয়।')}</p>
          <div className="citizen-public-hero__actions">
            <a className="citizen-public-primary" href="#citizen-payment-options">
              <WalletCards size={18} aria-hidden="true" /> {label('Browse payment services', 'পেমেন্ট সেবা দেখুন')}
            </a>
            <button type="button" className="citizen-public-secondary" onClick={() => navigate('secure_workspace')}>
              {label('Secure account access', 'নিরাপদ অ্যাকাউন্ট প্রবেশ')} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="citizen-public-hero__note">{label('Explore the sample payment journeys without signing in. No money is transferred.', 'সাইন-ইন ছাড়াই নমুনা পেমেন্টের ধাপ দেখা যায়। কোনো অর্থ স্থানান্তর হয় না।')}</p>
        </div>
        <aside className="citizen-public-hero__panel" aria-label={label('Prototype status', 'নমুনা সেবার অবস্থা')}>
          <p className="citizen-public-hero__panel-label">{label('Prototype status', 'নমুনা সেবার অবস্থা')}</p>
          <strong>{label('Independent TaxPay demonstration', 'স্বতন্ত্র TaxPay প্রদর্শনী')}</strong>
          <ul>
            <li>{label('Forms and receipts use sample data.', 'ফর্ম ও রসিদে নমুনা তথ্য ব্যবহৃত হয়।')}</li>
            <li>{label('No live payment gateway or official NBR/Treasury record is connected.', 'কোনো প্রকৃত পেমেন্ট গেটওয়ে বা এনবিআর/ট্রেজারির সরকারি তথ্য সংযুক্ত নয়।')}</li>
          </ul>
        </aside>
      </section>

      <section className="citizen-hub-section" aria-labelledby="citizen-hub-quick-title">
        <div className="citizen-hub-section__heading">
          <div>
            <p className="citizen-hub-eyebrow">{label('Public services', 'জনসেবা')}</p>
            <h2 id="citizen-hub-quick-title">{label('Quick access', 'দ্রুত প্রবেশ')}</h2>
          </div>
        </div>
        <div className="citizen-hub-quick-grid">
          <button type="button" onClick={() => navigate('verify')}>
            <FileSearch aria-hidden="true" /><span>{label('Payment status', 'পেমেন্টের অবস্থা')}</span><ArrowRight aria-hidden="true" />
          </button>
          <button type="button" onClick={focusReceiptLookup}>
            <Search aria-hidden="true" /><span>{label('Find a sample receipt', 'নমুনা রসিদ খুঁজুন')}</span><ArrowRight aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('guidance')}>
            <CircleHelp aria-hidden="true" /><span>{label('Guidance & FAQs', 'নির্দেশনা ও প্রশ্নোত্তর')}</span><ArrowRight aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('incident')}>
            <ShieldAlert aria-hidden="true" /><span>{label('Report a payment issue', 'পেমেন্টের সমস্যা জানান')}</span><ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="citizen-hub-section" aria-labelledby="citizen-payment-options">
        <div className="citizen-hub-section__heading">
          <div>
            <p className="citizen-hub-eyebrow">{label('Payment services', 'পেমেন্ট সেবা')}</p>
            <h2 id="citizen-payment-options">{label('Choose a payment journey', 'পেমেন্টের ধাপ বাছুন')}</h2>
            <p>{label('These routes open a demonstration form. Rates, eligibility and government accounting codes are not legally certified.', 'এগুলো নমুনা ফর্ম খোলে। হার, যোগ্যতা ও সরকারি হিসাব কোড আইনগতভাবে প্রত্যয়ন করা হয়নি।')}</p>
          </div>
          <span className="citizen-demo-pill">{label('Prototype', 'নমুনা')}</span>
        </div>
        <div className="citizen-hub-service-grid">
          {featuredCategories.map(key => {
            const item = CATEGORY_LABELS[key];
            return (
              <button key={key} type="button" onClick={() => openCategory(key)}>
                <span className="citizen-hub-service-grid__icon"><WalletCards size={19} aria-hidden="true" /></span>
                <span className="citizen-hub-service-grid__copy"><strong>{key === 'OTHER_TAX_PAYMENT' ? label('Other tax payment', 'অন্যান্য কর পরিশোধ') : bn ? item.bn : item.en}</strong><small>{key === 'SOURCE_TAX_DEPOSIT' ? label('Withholding-agent journey', 'উৎসে কর কর্তনকারীর ধাপ') : label('Open sample journey', 'নমুনা ধাপ খুলুন')}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            );
          })}
          <button type="button" onClick={() => navigate('travel')}>
            <span className="citizen-hub-service-grid__icon"><Landmark size={19} aria-hidden="true" /></span>
            <span className="citizen-hub-service-grid__copy"><strong>{label('Travel Tax', 'ভ্রমণ কর')}</strong><small>{label('Open sample journey', 'নমুনা ধাপ খুলুন')}</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        {remainingCategories.length > 0 && (
          <details className="citizen-hub-more-services">
            <summary>{label('More payment types', 'আরও পেমেন্টের ধরন')}</summary>
            <div>
              {remainingCategories.map(([key, item]) => (
                <button key={key} type="button" onClick={() => openCategory(key as PaymentCategory)}>
                  <span>{bn ? item.bn : item.en}</span><ArrowRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </details>
        )}
        <details className="citizen-hub-more-services">
          <summary>{label('About these payment categories', 'পেমেন্টের ধরন সম্পর্কে')}</summary>
          <p className="citizen-hub-category-note">{label('The 170 source-derived payment-head records are under legal review. Selecting a category does not certify its rate, eligibility or government accounting code.', 'উৎস থেকে নেওয়া ১৭০টি করের খাতের আইনগত যাচাই চলমান। একটি খাত নির্বাচন করলেই হার, যোগ্যতা বা সরকারি হিসাব কোড যাচাইকৃত হয় না।')}</p>
          <button type="button" className="citizen-hub-catalogue-link" onClick={() => navigate('head_catalogue')}>
            {label('Browse Original Heads (170)', 'মূল করের খাত দেখুন (১৭০)')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </details>
      </section>

      <section className="citizen-hub-section citizen-hub-steps" aria-labelledby="citizen-how-title">
        <div className="citizen-hub-section__heading">
          <div>
            <p className="citizen-hub-eyebrow">{label('A simple guide', 'সহজ নির্দেশনা')}</p>
            <h2 id="citizen-how-title">{label('How a payment journey works', 'পেমেন্টের ধাপ যেভাবে চলে')}</h2>
          </div>
        </div>
        <ol>
          <li><span>1</span><div><strong>{label('Choose a service', 'সেবা বাছুন')}</strong><p>{label('Select a payment purpose or travel-tax demonstration.', 'পেমেন্টের উদ্দেশ্য বা ভ্রমণ করের নমুনা বাছুন।')}</p></div></li>
          <li><span>2</span><div><strong>{label('Enter the requested details', 'চাওয়া তথ্য লিখুন')}</strong><p>{label('Review each field and the sample payment-head information.', 'প্রতিটি ঘর ও নমুনা পেমেন্ট-খাতের তথ্য যাচাই করুন।')}</p></div></li>
          <li><span>3</span><div><strong>{label('Review the result', 'ফলাফল যাচাই করুন')}</strong><p>{label('A prototype receipt confirms only that the local demonstration ran.', 'নমুনা রসিদ শুধু স্থানীয় প্রদর্শনী সম্পন্ন হওয়ার কথা জানায়।')}</p></div></li>
        </ol>
      </section>

      <section className="citizen-hub-lookup" aria-labelledby="citizen-receipt-lookup">
        <div className="citizen-hub-lookup__intro">
          <span className="citizen-hub-lookup__icon"><Search size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="citizen-receipt-lookup">{label('Find a sample receipt', 'নমুনা রসিদ খুঁজুন')}</h2>
            <p>{label('Search a challan, token or transaction reference from this demonstration.', 'এই প্রদর্শনীর চালান, টোকেন বা লেনদেনের রেফারেন্স খুঁজুন।')}</p>
          </div>
        </div>
        <form onSubmit={handleLookup}>
          <label htmlFor="citizen-lookup-reference">{label('Challan, token or transaction reference', 'চালান, টোকেন বা লেনদেনের রেফারেন্স')}</label>
          <div className="citizen-hub-lookup__controls">
            <input id="citizen-lookup-reference" type="text" value={reference}
              onChange={event => { setReference(event.target.value); setNotFound(false); }}
              placeholder={label('Enter a sample reference', 'নমুনা রেফারেন্স লিখুন')} />
            <button type="submit"><Search size={17} aria-hidden="true" />{label('Search sample records', 'নমুনা তথ্য খুঁজুন')}</button>
          </div>
          {notFound && <p role="status" className="citizen-hub-lookup__error">{label('No matching demonstration reference. Check the number and try again.', 'কোনো নমুনা রেফারেন্স পাওয়া যায়নি। নম্বর যাচাই করে আবার চেষ্টা করুন।')}</p>}
          <p className="citizen-hub-lookup__notice">{label('This is not an official NBR or Treasury status lookup.', 'এটি এনবিআর বা ট্রেজারির সরকারি অবস্থা যাচাই নয়।')}</p>
        </form>
      </section>

    </div>
  );
};
