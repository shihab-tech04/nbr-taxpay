import React, { useEffect, useRef, useState } from 'react';
import { FileCheck2, FilePenLine, History, Repeat2, Save, Search, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import type { PublicService } from './PublicServiceModal';
import { PublicHeroCarousel } from './PublicHeroCarousel';
import { INITIAL_RECEIPTS } from '../../data/mockData';
const Home2Layout = React.lazy(() => import('./Home2Layout').then(m => ({default:m.Home2Layout})));
const Home3Layout = React.lazy(() => import('./home3/Home3Layout').then(m => ({default:m.Home3Layout})));

// Only publicly shipped fictional fixtures may appear in public autocomplete.
// Never suggest account receipts or hosted payment records.
// The status/Travel Tax modal pulls in the checkout and receipt modules.
// Keep the public landing light until the user explicitly opens that service.
const PublicServiceModal = React.lazy(() => import('./PublicServiceModal').then(module => ({default: module.PublicServiceModal})));
const PaymentServiceChoiceDialog = React.lazy(() => import('./PaymentServiceChoiceDialog').then(module => ({default: module.PaymentServiceChoiceDialog})));

const sampleReceipts = INITIAL_RECEIPTS.filter(receipt => receipt.isSimulatedDemo && !receipt.receiptMobile).slice(0, 3);
const sampleSearchOptions = sampleReceipts.flatMap(receipt => [
  { value: receipt.challanNo, kind: 'challan' as const },
  { value: receipt.tokenNumber, kind: 'token' as const },
  { value: receipt.gatewayTransactionId, kind: 'transaction' as const },
]);

export const PublicLanding: React.FC<{home2?: boolean; home3?: boolean}> = ({home2 = false, home3 = false}) => {
  const { language, navigate, openAllTaxPayments, isPaymentServiceChoiceOpen } = useTaxState();
  const [openService, setOpenService] = useState<PublicService | null>(null);
  const [otherTaxEntryOpen, setOtherTaxEntryOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchRegionRef = useRef<HTMLDivElement>(null);
  const cleanReference = paymentReference.trim().toLowerCase();
  const matchedOptions = cleanReference
    ? sampleSearchOptions.filter(option => option.value.toLowerCase().includes(cleanReference)).slice(0, 5)
    : [];
  // Do not repeat a matching reference under Example reference numbers.
  // Keep three alternative examples available and never query account/private data.
  const matchedKeys = new Set(matchedOptions.map(option => option.kind + ':' + option.value));
  const exampleOptions = sampleSearchOptions
    .filter(option => !matchedKeys.has(option.kind + ':' + option.value)).slice(0, 3);
  const suggestions = [...matchedOptions, ...exampleOptions];
  const chooseReference = (reference: string) => {
    setSearchOpen(false);
    setActiveSuggestion(-1);
    setPaymentReference(reference);
    // Preserve existing in-memory navigation; never expose references in the URL.
    navigate('verify', { initialReference: reference, ...(home3 ? {fromHome3:true} : home2 ? {fromHome2:true} : {}) });
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

  // The banner and All Tax Payments benefit now share the approved parallel entry.
  // Preserve the original payment flow implementation without changing its behavior.
  const citizenBenefits = [
    {
      id: 'payments',
      Icon: WalletCards,
      title: t('All Tax Payments', 'সব ধরনের কর পরিশোধ'),
      detail: t('Pay taxes for yourself, family or clients.', 'নিজের, পরিবারের বা ক্লায়েন্টের কর পরিশোধ করুন।'),
    },
    {
      id: 'certificates',
      Icon: FileCheck2,
      title: t('Tax Certificates', 'কর সনদ'),
      detail: t('Find and download available tax certificates.', 'উপলব্ধ কর সনদ খুঁজুন ও ডাউনলোড করুন।'),
    },
    {
      id: 'corrections',
      Icon: FilePenLine,
      title: t('Corrections & Requests', 'সংশোধন ও আবেদন'),
      detail: t('Request corrections and follow their progress.', 'সংশোধনের আবেদন করুন ও অগ্রগতি দেখুন।'),
    },
    {
      id: 'history',
      Icon: History,
      title: t('Payment History', 'পেমেন্টের ইতিহাস'),
      detail: t('See past payments, tax years and receipts.', 'আগের পেমেন্ট, করবর্ষ ও রসিদ দেখুন।'),
    },
    {
      id: 'pay-again',
      Icon: Repeat2,
      title: t('Pay Again', 'আবার পরিশোধ'),
      detail: t('Reuse and edit a previous payment.', 'আগের পেমেন্টের তথ্য বদলে আবার পরিশোধ করুন।'),
    },
    {
      id: 'saved-drafts',
      Icon: Save,
      title: t('Saved Drafts', 'সংরক্ষিত খসড়া'),
      detail: t('Save a payment and continue it later.', 'পেমেন্ট খসড়া সংরক্ষণ করে পরে চালিয়ে যান।'),
    },
  ];

  const hero = (<PublicHeroCarousel
      language={language}
      onPayTax={() => openAllTaxPayments()}
      onOtherTax={() => setOtherTaxEntryOpen(true)}
      paused={isPaymentServiceChoiceOpen || otherTaxEntryOpen || openService !== null}
    />);
  const recordSearch = (<section className="public-record-discovery" aria-labelledby="public-record-discovery-title">
      <div className="public-record-discovery__heading">
        <h2 id="public-record-discovery-title">{t('Find a payment record', 'পেমেন্ট রেকর্ড খুঁজুন')}</h2>
        <p id="public-record-discovery-help">{t('Search by challan, token or transaction reference.', 'চালান, টোকেন বা লেনদেনের রেফারেন্স দিয়ে খুঁজুন।')}</p>
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
          {/* Native searchbox keeps its role. The status region announces matches;
              combobox-only ARIA belongs neither here nor on the input. */}
          <input
            id="public-payment-reference"
            type="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            value={paymentReference}
            aria-describedby="public-record-discovery-help"
            aria-autocomplete="list"
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
        {/* Keep the live region mounted while closed so the first update is
            announced reliably instead of appearing with pre-filled content. */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only"
          data-testid="public-search-match-status">
          {searchOpen
            ? cleanReference
              ? matchedOptions.length
                ? t(`${matchedOptions.length} matching example references. Use arrow keys to choose one, or submit your own reference.`,
                  `${new Intl.NumberFormat('bn-BD').format(matchedOptions.length)}টি নমুনা রেফারেন্স মিলেছে। বেছে নিতে তীর চিহ্নের বোতাম বা নিজের রেফারেন্স খুঁজতে অনুসন্ধান ব্যবহার করুন।`)
                : t('No example references matched. You can still check your own reference.',
                  'কোনো নমুনা রেফারেন্স মেলেনি। নিজের রেফারেন্স দিয়েও যাচাই করতে পারবেন।')
              : t('Example references available. Use the arrow keys to choose one.',
                  'নমুনা রেফারেন্স পাওয়া যাচ্ছে। বেছে নিতে তীর চিহ্নের বোতাম ব্যবহার করুন।')
            : ''}
        </p>
        {searchOpen && (
          <div className="public-record-suggestions" id="public-record-suggestions">
            {/* The persistent live region above is the only announcement source;
                duplicating it here causes two screen-reader announcements. */}
            {cleanReference && (
              <div className="public-record-suggestions__group">
                <h3>{t('Matching references', 'মিলে যাওয়া রেফারেন্স')}</h3>
                {matchedOptions.length > 0 ? (
                  <ul className="public-record-suggestions__list">
                    {matchedOptions.map((option, index) => (
                      <li key={'match-' + option.kind + option.value}>
                        <button id={`public-search-option-${index}`}
                          className={activeSuggestion === index ? 'public-record-suggestions__option is-active' : 'public-record-suggestions__option'}
                          type="button" onMouseDown={event => event.preventDefault()}
                          onClick={() => chooseReference(option.value)}>
                          <p className="public-record-suggestions__value">{option.value}</p>
                          <p className="public-record-suggestions__kind">{option.kind === 'challan' ? t('Challan', 'চালান') : option.kind === 'token' ? t('Token', 'টোকেন') : t('Transaction', 'লেনদেন')}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="public-record-suggestions__empty">{t('No matching references among the examples. You can still search using this reference.', 'নমুনার মধ্যে মিলে যাওয়া রেফারেন্স নেই। এই রেফারেন্স দিয়েও খুঁজতে পারবেন।')}</p>
                )}
              </div>
            )}
            <div className="public-record-suggestions__group public-record-suggestions__examples">
              <h3>{t('Example reference numbers', 'নমুনা রেফারেন্স নম্বর')}</h3>
              <ul className="public-record-suggestions__list">
                {exampleOptions.map((option, index) => {
                  const optionIndex = matchedOptions.length + index;
                  return (
                    <li key={'sample-' + option.kind + option.value}>
                      <button id={`public-search-option-${optionIndex}`}
                        className={activeSuggestion === optionIndex ? 'public-record-suggestions__option is-active' : 'public-record-suggestions__option'}
                        type="button" onMouseDown={event => event.preventDefault()}
                        onClick={() => chooseReference(option.value)}>
                        <p className="public-record-suggestions__value">{option.value}</p>
                        <p className="public-record-suggestions__kind">{option.kind === 'challan' ? t('Challan', 'চালান') : option.kind === 'token' ? t('Token', 'টোকেন') : t('Transaction', 'লেনদেন')}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>);
  const serviceOverlays = (<>{otherTaxEntryOpen && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'সাইন ইন লোড হচ্ছে…' : 'Loading sign in…'}</p>}>
      <PaymentServiceChoiceDialog unifiedEntryRequested onDismiss={() => setOtherTaxEntryOpen(false)}
        onPublicOtherTaxContinue={() => { setOtherTaxEntryOpen(false); setOpenService('other'); }} />
    </React.Suspense>}
    {openService && <React.Suspense fallback={<p role="status">{language === 'bn' ? 'সেবা লোড হচ্ছে…' : 'Loading service…'}</p>}><PublicServiceModal service={openService} onClose={() => setOpenService(null)} onBack={openService === 'other' ? () => { setOpenService(null); setOtherTaxEntryOpen(true); } : undefined} onChooseOther={setOpenService} /></React.Suspense>}</>);
  if (home3) return <><Home3Layout onSearch={chooseReference} onService={setOpenService} />{serviceOverlays}</>;
  if (home2) return <><Home2Layout onSearch={chooseReference} onOtherTax={()=>setOtherTaxEntryOpen(true)} sliderPaused={isPaymentServiceChoiceOpen || otherTaxEntryOpen || openService !== null} />{serviceOverlays}</>;
  return <div className={'citizen-public-hub public-information-hub public-home-sections mx-auto w-full' + (bn ? ' font-bengali' : '')}>
    {hero}
    {recordSearch}

    <section className="public-benefits" aria-labelledby="public-benefits-title">
      <div className="public-benefits__heading">
        <h2 id="public-benefits-title">{t('Why choose Sohojkor?', 'সহজকর কেন ব্যবহার করবেন?')}</h2>
        <p>{t('Pay, organize and track your taxes in one place.', 'কর পরিশোধ, তথ্য গুছিয়ে রাখা ও অগ্রগতি দেখা—সব এক জায়গায়।')}</p>
      </div>
      <div className="public-benefits__grid">
        {citizenBenefits.map(({ id, Icon, title, detail }) => {
          const contents = <>
            <span className="public-benefits__icon" aria-hidden="true"><Icon size={22} strokeWidth={1.9} /></span>
            <div className="public-benefits__copy">
              <h3>{title}</h3>
              <p id={`public-benefit-detail-${id}`}>{detail}</p>
            </div>
          </>;
          return id === 'payments'
            ? <button type="button" key={id} className="public-benefits__item public-benefits__item--action"
                data-benefit={id} onClick={openAllTaxPayments} aria-describedby={`public-benefit-detail-${id}`}>
                {contents}
              </button>
            : <article key={id} className="public-benefits__item" data-benefit={id}>{contents}</article>;
        })}
      </div>
    </section>

    {serviceOverlays}
  </div>;
};
