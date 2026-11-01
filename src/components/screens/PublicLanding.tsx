import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ListChecks, ReceiptText, Search, UserRound, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { PublicServiceModal, type PublicService } from './PublicServiceModal';
import { PublicHeroCarousel } from './PublicHeroCarousel';
import { INITIAL_RECEIPTS } from '../../data/mockData';

// Only publicly shipped fictional fixtures may appear in public autocomplete.
// Never suggest account receipts or hosted payment records.
const sampleReceipts = INITIAL_RECEIPTS.filter(receipt => receipt.isSimulatedDemo && !receipt.receiptMobile).slice(0, 3);
const sampleSearchOptions = sampleReceipts.flatMap(receipt => [
  { value: receipt.challanNo, kind: 'challan' as const },
  { value: receipt.tokenNumber, kind: 'token' as const },
  { value: receipt.gatewayTransactionId, kind: 'transaction' as const },
]);

export const PublicLanding: React.FC = () => {
  const { language, navigate, openPaymentServiceChoice, isPaymentServiceChoiceOpen, previewAccount } = useTaxState();
  const { user } = useAccountIdentity();
  const signedIn = Boolean(user || previewAccount);
  const [openService, setOpenService] = useState<PublicService | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchRegionRef = useRef<HTMLDivElement>(null);
  const cleanReference = paymentReference.trim().toLowerCase();
  const matchedOptions = cleanReference
    ? sampleSearchOptions.filter(option => option.value.toLowerCase().includes(cleanReference)).slice(0, 5)
    : [];
  // The approved focus state shows only public synthetic examples; typed input filters them.
  const suggestions = cleanReference ? matchedOptions : sampleSearchOptions.slice(0, 3);
  const chooseReference = (reference: string) => {
    setSearchOpen(false);
    setActiveSuggestion(-1);
    setPaymentReference(reference);
    // Preserve existing in-memory navigation; never expose references in the URL.
    navigate('verify', { initialReference: reference });
  };
  useEffect(() => {
    const handleOutside = (event: PointerEvent) => {
      if (!searchRegionRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setActiveSuggestion(-1);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, []);
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;

  const stages = [
    {
      Icon: UserRound,
      title: t('Input taxpayer details', 'করদাতার তথ্য দিন'),
      description: t('Enter or confirm the taxpayer’s details.', 'যার কর পরিশোধ করছেন, তার তথ্য দিন বা নিশ্চিত করুন।'),
    },
    {
      Icon: ListChecks,
      title: t('Select purpose & amount', 'খাত ও পরিমাণ নির্বাচন করুন'),
      description: t('Choose the payment head and enter the amount.', 'কর পরিশোধের খাত বেছে নিয়ে পরিমাণ লিখুন।'),
    },
    {
      Icon: WalletCards,
      title: t('Choose payment method', 'পেমেন্ট পদ্ধতি বেছে নিন'),
      description: t('Choose to pay online or at a bank branch.', 'অনলাইন বা ব্যাংক শাখায় পরিশোধের পদ্ধতি বেছে নিন।'),
    },
    {
      Icon: ReceiptText,
      title: t('Review & confirm payment', 'যাচাই করে নিশ্চিত করুন'),
      description: t('Review the details and keep your payment reference.', 'পেমেন্টের তথ্য যাচাই করুন ও রেফারেন্স সংরক্ষণ করুন।'),
    },
  ];

  const questions = [
    {
      question: t('Do I need an account to pay?', 'কর পরিশোধ করতে কি অ্যাকাউন্ট লাগবে?'),
      answer: t(
        'It depends on the service. Choose the taxpayer relationship and service first. Sign-in is offered when relevant, but public payments can continue without an account.',
        'সেবার ওপর নির্ভর করে। আগে কার কর পরিশোধ করছেন ও সেবা বেছে নিন। প্রয়োজনে সাইন ইন করতে পারবেন; পাবলিক পেমেন্ট অ্যাকাউন্ট ছাড়াও চলতে পারে।',
      ),
    },
    {
      question: t('Where can I find an earlier payment?', 'আগের পেমেন্ট কোথায় খুঁজব?'),
      answer: signedIn
        ? t('Use your reference to check payment status and receipts, or open your dashboard for transaction history.', 'রেফারেন্স দিয়ে পেমেন্টের অবস্থা ও রসিদ দেখুন, অথবা লেনদেনের ইতিহাসের জন্য ড্যাশবোর্ড খুলুন।')
        : t('Use your reference to check payment status and receipts. Sign in to see your transaction workspace and payment history.', 'রেফারেন্স দিয়ে পেমেন্টের অবস্থা ও রসিদ দেখুন। নিজের লেনদেন ও ইতিহাস দেখতে লগইন করুন।'),
    },
    {
      question: t('Does a receipt automatically confirm a tax credit?', 'রসিদ থাকলেই কি কর ক্রেডিট নিশ্চিত হয়?'),
      answer: t(
        'No. A receipt records a payment. Tax credit depends on applicable rules, ownership and verification.',
        'না। রসিদ একটি পেমেন্টের রেকর্ড। কর ক্রেডিট প্রযোজ্য নিয়ম, মালিকানা ও যাচাইয়ের ওপর নির্ভর করে।',
      ),
    },
    {
      question: t('What if my payment details do not match?', 'পেমেন্টের তথ্যে অমিল থাকলে কী করব?'),
      answer: t(
        'Keep your payment reference and follow the records and corrections guidance.',
        'পেমেন্ট রেফারেন্স সংরক্ষণ করুন এবং রেকর্ড ও সংশোধনের নির্দেশনা অনুসরণ করুন।',
      ),
      guide: true,
    },
  ];

  return <div className={'citizen-public-hub public-information-hub mx-auto w-full space-y-6' + (bn ? ' font-bengali' : '')}>
    <PublicHeroCarousel
      language={language}
      onPayTax={service => service === 'TRAVEL_TAX' ? setOpenService('travel') : openPaymentServiceChoice(service)}
      paused={isPaymentServiceChoiceOpen || openService !== null}
    />


    <section className="public-record-discovery" aria-labelledby="public-record-discovery-title">
      <div className="public-record-discovery__heading">
        <h2 id="public-record-discovery-title">{t('Find a payment record', 'পেমেন্ট রেকর্ড খুঁজুন')}</h2>
        <p>{t('Search by challan, token or transaction reference.', 'চালান, টোকেন বা লেনদেনের রেফারেন্স দিয়ে খুঁজুন।')}</p>
      </div>
      <div className="public-record-discovery__interactive" ref={searchRegionRef}>
        <form
          className="public-record-search"
          role="search"
          onSubmit={event => {
            event.preventDefault();
            if (searchOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
              chooseReference(suggestions[activeSuggestion].value);
            } else if (paymentReference.trim()) {
              chooseReference(paymentReference.trim());
            }
          }}
        >
          <label className="sr-only" htmlFor="public-payment-reference">
            {t('Search payment records by reference', 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন')}
          </label>
          <input
            id="public-payment-reference"
            type="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            value={paymentReference}
            aria-controls={searchOpen ? "public-record-suggestions" : undefined}
            onFocus={() => setSearchOpen(true)}
            onClick={() => setSearchOpen(true)}
            onChange={event => { setPaymentReference(event.target.value); setSearchOpen(true); setActiveSuggestion(-1); }}
            onKeyDown={event => {
              // Disabled empty-input Submit must not prevent selecting a focused example.
              if (event.key === 'Enter' && searchOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                event.preventDefault();
                chooseReference(suggestions[activeSuggestion].value);
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setSearchOpen(false);
                setActiveSuggestion(-1);
                return;
              }
              if (event.key === 'ArrowDown' && suggestions.length) {
                event.preventDefault();
                setSearchOpen(true);
                setActiveSuggestion(index => (index + 1) % suggestions.length);
              }
              if (event.key === 'ArrowUp' && suggestions.length) {
                event.preventDefault();
                setSearchOpen(true);
                setActiveSuggestion(index => index <= 0 ? suggestions.length - 1 : index - 1);
              }
            }}
            placeholder={t('Enter challan, token or transaction reference', 'চালান, টোকেন বা লেনদেনের রেফারেন্স লিখুন')}
          />
          <button type="submit" disabled={!paymentReference.trim()} aria-label={t('Search records', 'রেকর্ড খুঁজুন')}>
            <Search size={23} aria-hidden="true" />
          </button>
        </form>
        {searchOpen && (
          <div className="public-record-suggestions" id="public-record-suggestions">
            <div className="public-record-suggestions__group">
              <h3>{cleanReference ? t('Matching references', 'মিলে যাওয়া রেফারেন্স') : t('Example references', 'নমুনা রেফারেন্স')}</h3>
              {suggestions.length > 0 ? (
                <ul className="public-record-suggestions__list">
                  {suggestions.map((option, index) => (
                    <li key={option.kind + option.value}>
                      <button
                        id={`public-search-option-${index}`}
                        className={activeSuggestion === index ? 'public-record-suggestions__option is-active' : 'public-record-suggestions__option'}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => chooseReference(option.value)}
                      >
                        <p className="public-record-suggestions__value">{option.value}</p>
                        <p className="public-record-suggestions__kind">
                          {option.kind === 'challan' ? t('Challan', 'চালান') : option.kind === 'token' ? t('Token', 'টোকেন') : t('Transaction', 'লেনদেন')}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="public-record-suggestions__empty">{t('No matching references. You can still search using this reference.', 'মিলে যাওয়া রেফারেন্স নেই। এই রেফারেন্স দিয়েও খুঁজতে পারবেন।')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>

    <section id="public-how-it-works" className="citizen-hub-section public-info-section public-payment-path" aria-labelledby="steps-title">
      <div className="citizen-hub-section__heading">
        <div>
          <h2 id="steps-title">{t('How your payment works', 'যেভাবে কর পরিশোধ করবেন')}</h2>
          <p>{t('A clear route from taxpayer details to your payment record.', 'করদাতার তথ্য থেকে পেমেন্ট রেকর্ড পর্যন্ত প্রতিটি ধাপ পরিষ্কারভাবে দেখুন।')}</p>
        </div>
      </div>
      <div className="public-payment-path__starter">
        <span className="public-payment-path__starter-label">{t('Start here', 'এখান থেকে শুরু করুন')}</span>
        <p>{t('Choose who you are paying for, then select one of two services and follow these four steps.', 'আগে কার কর পরিশোধ করছেন নির্বাচন করুন, তারপর দুটি সেবার একটি বেছে নিয়ে চারটি ধাপ অনুসরণ করুন।')}</p>
      </div>
      <ol className="public-payment-path__steps">
        {stages.map((stage, index) => <li key={stage.title}>
          <div className="public-payment-path__step-head">
            <span className="public-payment-path__symbol" aria-hidden="true"><stage.Icon size={23} strokeWidth={1.9}/></span>
            <span className="public-payment-path__step-label">{t(`Step ${index + 1}`, `ধাপ ${['১', '২', '৩', '৪'][index]}`)}</span>
          </div>
          <h3>{stage.title}</h3>
          <p>{stage.description}</p>
        </li>)}
      </ol>
    </section>

    <section id="public-faq" className="citizen-hub-section public-info-section public-faq-layout" aria-labelledby="faq-title">
      <div className="public-faq-layout__heading">
        <div>
          <h2 id="faq-title">{t('Common questions', 'সাধারণ প্রশ্ন')}</h2>
          <p>{t('The answers you may need before making a payment.', 'কর পরিশোধের আগে আপনার প্রয়োজনীয় কিছু উত্তর।')}</p>
        </div>
        <button type="button" className="public-faq-layout__all-guides" onClick={() => navigate('user_guide')}>
          <BookOpen size={18} aria-hidden="true" /> {t('Open user guide', 'ব্যবহার নির্দেশিকা দেখুন')} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="public-info-faq">
        {questions.map(item => <details key={item.question}>
          <summary><span>{item.question}</span><ChevronDown size={20} aria-hidden="true" /></summary>
          <div className="public-faq-layout__answer">
            <p>{item.answer}</p>
            {item.guide && <button type="button" className="public-faq-layout__guide-link" onClick={() => navigate('user_guide', { category: 'records' })}>
              {t('Read records & corrections guidance', 'রেকর্ড ও সংশোধনের নির্দেশনা পড়ুন')}
              <ArrowRight size={15} aria-hidden="true" />
            </button>}
          </div>
        </details>)}
      </div>
    </section>
    {openService && <PublicServiceModal service={openService} onClose={() => setOpenService(null)} />}
  </div>;
};
