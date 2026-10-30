import React, { useEffect, useRef, useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import { findSessionReceiptByReference } from '../../services/simulatedPaymentStory';

type ReceiptLookupProps = { embedded?: boolean; activityTabs?: boolean; hidePageHeading?: boolean };

export const ReceiptLookup: React.FC<ReceiptLookupProps> = ({ embedded = false, activityTabs = false, hidePageHeading = false }) => {
  const { language, lookupReceipt, receipts, navigate, routeParams } = useTaxState();
  // Homepage reference is kept in in-memory navigation state, never in a public URL.
  const initialReference = typeof routeParams.initialReference === 'string' ? routeParams.initialReference.trim() : '';
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const [query, setQuery] = useState(initialReference);
  const [receiptMobile, setReceiptMobile] = useState('');
  const [searchedReference, setSearchedReference] = useState('');
  const [searchResult, setSearchResult] = useState<ChallanReceipt | null | 'NOT_FOUND'>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const lookupSequence = useRef(0);
  useEffect(() => () => { lookupSequence.current += 1; }, []);
  const resetLookup = () => {
    lookupSequence.current += 1;
    setSearchResult(null);
    setLookupPending(false);
    setLookupError(false);
  };
  const sampleReceipts = receipts.filter(receipt => !receipt.receiptMobile).slice(0, 3);

  const searchReference = (reference: string, mobile: string) => {
    if (!reference) return;
    const sequence = ++lookupSequence.current;
    setSearchedReference(reference);
    setLookupError(false);
    const local = lookupReceipt(reference, mobile);
    if (local) {
      setLookupPending(false);
      setSearchResult(local);
      return;
    }

    // Cross-session lookup requires an approved authorized API. The existing
    // recovery route only reads simulated records from this browser session.
    if (!/^01\d{9}$/.test(mobile)) {
      setLookupPending(false);
      setSearchResult('NOT_FOUND');
      return;
    }
    setSearchResult(null);
    setLookupPending(true);
    void findSessionReceiptByReference(reference, mobile)
      .then(receipt => {
        if (lookupSequence.current !== sequence) return;
        setSearchResult(receipt ?? 'NOT_FOUND');
      })
      .catch(() => {
        if (lookupSequence.current !== sequence) return;
        setLookupError(true);
        setSearchResult(null);
      })
      .finally(() => {
        if (lookupSequence.current === sequence) setLookupPending(false);
      });
  };
  useEffect(() => {
    if (initialReference) searchReference(initialReference, '');
    // This initial search runs only when arriving from the homepage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchReference(query.trim(), receiptMobile);
  };

  return (
    <section className={embedded ? 'receipt-lookup receipt-lookup--embedded' : 'receipt-lookup receipt-lookup--page'}>
      {!embedded && activityTabs && <>
        <TaxpayerPageHeading title={t('Payments & activity', 'পেমেন্ট ও লেনদেন')} />
        <TaxpayerActivityTabs />
      </>}
      <div className="receipt-lookup__content">
        {!embedded && activityTabs && <header className="receipt-lookup__page-header">
          <h2>{t('Track payment', 'পেমেন্ট অনুসন্ধান')}</h2>
          <p>{t('Find a payment record by its reference.', 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন।')}</p>
        </header>}
        {!embedded && !activityTabs && !hidePageHeading && <header className="receipt-lookup__page-header">
          <h1>{t('Receipt lookup', 'রসিদ অনুসন্ধান')}</h1>
          <p>{t('Find a payment record by its reference.', 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন।')}</p>
        </header>}
        {!(searchResult && searchResult !== "NOT_FOUND") && <form className="receipt-lookup__form" onSubmit={handleSearch} role="search">
          <div className="receipt-lookup__field">
            <label htmlFor="receipt-lookup-reference">
              {t('Challan, token or transaction reference', 'চালান, টোকেন বা লেনদেনের রেফারেন্স')}
            </label>
            <p id="receipt-lookup-hint" className="receipt-lookup__hint">
              {t('Enter a payment reference to check its details.', 'বিস্তারিত জানতে পেমেন্ট রেফারেন্স লিখুন।')}
            </p>
            <div className="receipt-lookup__search-row">
              <input
                id="receipt-lookup-reference"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('Enter a reference', 'রেফারেন্স লিখুন')}
                aria-describedby="receipt-lookup-hint"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  resetLookup();
                }}
                className="receipt-lookup__input font-mono-plex"
              />
              <button
                type="submit"
                disabled={!query.trim() || lookupPending}
                className="receipt-lookup__submit"
              >
                <Search size={18} aria-hidden="true" />
                <span>{t('Search records', 'রেকর্ড খুঁজুন')}</span>
              </button>
            </div>
          </div>
          <div className="receipt-lookup__field">
            <label htmlFor="receipt-lookup-mobile">{t('Receipt mobile number', 'রসিদের মোবাইল নম্বর')}</label>
            <input id="receipt-lookup-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
              placeholder="01XXXXXXXXX" value={receiptMobile}
              onChange={event => { setReceiptMobile(event.target.value.replace(/\D/g, '').slice(0, 11)); resetLookup(); }}
              className="receipt-lookup__input font-mono-plex" />
            <p className="receipt-lookup__hint">{t('Required for receipts generated through the guest payment form.', 'অতিথি পেমেন্ট ফর্মের মাধ্যমে তৈরি রসিদের জন্য আবশ্যক।')}</p>
          </div>
          {sampleReceipts.length > 0 && (
            <div className="receipt-lookup__examples">
              <p className="receipt-lookup__examples-label">{t('Try a reference', 'রেফারেন্স ব্যবহার করুন')}</p>
              <div className="receipt-lookup__example-list">
                {sampleReceipts.map(receipt => (
                  <button
                    key={receipt.id}
                    type="button"
                    className="receipt-lookup__sample font-mono-plex"
                    aria-label={t('Use reference', 'রেফারেন্স ব্যবহার করুন') + ': ' + receipt.challanNo}
                    onClick={() => {
                      setQuery(receipt.challanNo);
                      setSearchedReference(receipt.challanNo);
                      resetLookup();
                      setSearchResult(receipt);
                    }}
                  >
                    {receipt.challanNo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>}
        {lookupPending && <p role="status" className="receipt-lookup__hint">
          {t('Checking records from this browser session…', 'এই ব্রাউজার সেশনের রেকর্ড খোঁজা হচ্ছে…')}
        </p>}
        {lookupError && <div role="alert" className="receipt-lookup__result receipt-lookup__result--error">
          <AlertCircle size={20} aria-hidden="true" />
          <p>{t('Saved session records are temporarily unavailable. Please retry; no missing-record result has been confirmed.', 'সংরক্ষিত সেশন রেকর্ড এখন পাওয়া যাচ্ছে না। আবার চেষ্টা করুন; রেকর্ড নেই বলে নিশ্চিত হওয়া যায়নি।')}</p>
        </div>}
        {searchResult === 'NOT_FOUND' && (
          <div className="receipt-lookup__result receipt-lookup__result--error" role="status" aria-live="polite">
            <AlertCircle size={20} aria-hidden="true" />
            <div className="receipt-lookup__result-copy">
              <h2>{t('No matching record', 'কোনো মিল পাওয়া যায়নি')}</h2>
              <p>{t('No record found for:', 'এই রেফারেন্সে কোনো রেকর্ড পাওয়া যায়নি:')} <strong className="font-mono-plex">{searchedReference}</strong></p>
              <button type="button" className="receipt-lookup__issue-link" onClick={() => navigate('incident')}>
                {t('Report a payment issue', 'পেমেন্টের সমস্যা জানান')}
              </button>
            </div>
          </div>
        )}
        {searchResult && searchResult !== 'NOT_FOUND' && (
          <div className="receipt-lookup__found">
            <p className="sr-only" role="status">
              {t('Receipt details loaded.', 'রসিদের তথ্য দেখানো হয়েছে।')}
            </p>
            <ReceiptView receipt={searchResult} embedded={embedded} onBack={() => {
              setSearchResult(null);
              setSearchedReference('');
            }} />
          </div>
        )}
      </div>
    </section>
  );
};
