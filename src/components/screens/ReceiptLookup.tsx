import React, { useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';

type ReceiptLookupProps = { embedded?: boolean };

export const ReceiptLookup: React.FC<ReceiptLookupProps> = ({ embedded = false }) => {
  const { language, lookupReceipt, receipts, navigate } = useTaxState();
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const [query, setQuery] = useState('');
  const [searchedReference, setSearchedReference] = useState('');
  const [searchResult, setSearchResult] = useState<ChallanReceipt | null | 'NOT_FOUND'>(null);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = query.trim();
    if (!reference) return;
    setSearchedReference(reference);
    setSearchResult(lookupReceipt(reference) ?? 'NOT_FOUND');
  };

  return (
    <section className={embedded ? 'receipt-lookup receipt-lookup--embedded' : 'receipt-lookup receipt-lookup--page'}>
      <div className="receipt-lookup__content">
        {!embedded && (
          <header className="receipt-lookup__page-header">
            <h1>{t('Receipt lookup', 'রসিদ অনুসন্ধান')}</h1>
            <p>{t('Find a saved sample record by its reference.', 'রেফারেন্স দিয়ে সংরক্ষিত নমুনা রেকর্ড খুঁজুন।')}</p>
          </header>
        )}
        <form className="receipt-lookup__form" onSubmit={handleSearch} role="search">
          <div className="receipt-lookup__field">
            <label htmlFor="receipt-lookup-reference">
              {t('Challan, token or transaction reference', 'চালান, টোকেন বা লেনদেনের রেফারেন্স')}
            </label>
            <p id="receipt-lookup-hint" className="receipt-lookup__hint">
              {t('Enter the reference to look up a sample payment record.', 'নমুনা পেমেন্ট রেকর্ড খুঁজতে রেফারেন্স লিখুন।')}
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
                  setSearchResult(null);
                }}
                className="receipt-lookup__input font-mono-plex"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="receipt-lookup__submit"
              >
                <Search size={18} aria-hidden="true" />
                <span>{t('Search records', 'রেকর্ড খুঁজুন')}</span>
              </button>
            </div>
          </div>
          {receipts.length > 0 && (
            <div className="receipt-lookup__examples">
              <p className="receipt-lookup__examples-label">{t('Try a sample reference', 'নমুনা রেফারেন্স ব্যবহার করুন')}</p>
              <div className="receipt-lookup__example-list">
                {receipts.slice(0, 3).map(receipt => (
                  <button
                    key={receipt.id}
                    type="button"
                    className="receipt-lookup__sample font-mono-plex"
                    aria-label={t('Use sample reference', 'নমুনা রেফারেন্স ব্যবহার করুন') + ': ' + receipt.challanNo}
                    onClick={() => {
                      setQuery(receipt.challanNo);
                      setSearchedReference(receipt.challanNo);
                      setSearchResult(receipt);
                    }}
                  >
                    {receipt.challanNo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
        {searchResult === 'NOT_FOUND' && (
          <div className="receipt-lookup__result receipt-lookup__result--error" role="status" aria-live="polite">
            <AlertCircle size={20} aria-hidden="true" />
            <div className="receipt-lookup__result-copy">
              <h2>{t('No matching record', 'কোনো মিল পাওয়া যায়নি')}</h2>
              <p>{t('No sample record found for:', 'এই রেফারেন্সে কোনো নমুনা রেকর্ড পাওয়া যায়নি:')} <strong className="font-mono-plex">{searchedReference}</strong></p>
              <p>{t('If money was debited, contact your bank or payment provider.', 'অর্থ কেটে নেওয়া হলে ব্যাংক বা পেমেন্ট সেবাদাতার সঙ্গে যোগাযোগ করুন।')}</p>
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
            <ReceiptView receipt={searchResult} embedded={embedded} />
          </div>
        )}
      </div>
    </section>
  );
};
