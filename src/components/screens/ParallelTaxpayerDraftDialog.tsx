import '../../styles/taxpay-parallel-taxpayer-draft.css';
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Eye, EyeOff, Trash2, UsersRound } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import { TaxpayerTinLookup } from '../ui/TaxpayerTinLookup';
import { TaxPayModal } from '../ui/TaxPayModal';

type DraftTaxpayer = NonNullable<ReturnType<typeof lookupSampleTaxpayer>>;

const maskedTin = (tin: string) => tin.slice(0, 3) + '****';

/**
 * Isolated first-draft entry for "All Tax Payments".
 *
 * This is deliberately NOT the approved GuestPayment wizard. No route, draft,
 * beneficiary, payment, API or SQL state is touched; a lookup only reads the
 * existing fictional TIN catalogue. The accepted taxpayer selection will be
 * handed to a separate cloned payment journey after the UX is approved.
 */
export function ParallelTaxpayerDraftDialog({ onClose }: { onClose: () => void }) {
  const { language } = useTaxState();
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const [stage, setStage] = useState<1 | 2>(1);
  const [tin, setTin] = useState('');
  const [searchedTin, setSearchedTin] = useState('');
  const [error, setError] = useState('');
  const [taxpayers, setTaxpayers] = useState<DraftTaxpayer[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState('');

  const result = searchedTin === tin ? lookupSampleTaxpayer(searchedTin) : null;
  const alreadyAdded = Boolean(result && taxpayers.some(person => person.tin === result.tin));
  const selectedCount = taxpayers.length;
  const search = () => {
    setCopyStatus('');
    setSearchedTin(tin);
    const found = /^\d{12,13}$/.test(tin) ? lookupSampleTaxpayer(tin) : null;
    setError(found ? '' : t(
      'No matching taxpayer found in the existing simulated TIN catalogue. Check the TIN and search again.',
      'বিদ্যমান নমুনা টিআইএন তালিকায় করদাতা পাওয়া যায়নি। টিআইএন পরীক্ষা করে আবার খুঁজুন।'));
  };
  const addTaxpayer = () => {
    if (!result || alreadyAdded) return;
    setTaxpayers(current => [...current, result]);
    setTin('');
    setSearchedTin('');
    setError('');
    setCopyStatus('');
  };
  const deleteTaxpayer = (selectedTin: string) => {
    setTaxpayers(current => current.filter(person => person.tin !== selectedTin));
    setRevealed(current => current.filter(value => value !== selectedTin));
    setCopyStatus('');
  };
  const toggleTin = (selectedTin: string) =>
    setRevealed(current => current.includes(selectedTin)
      ? current.filter(value => value !== selectedTin) : [...current, selectedTin]);
  const copyTin = async (selectedTin: string) => {
    try {
      await navigator.clipboard.writeText(selectedTin);
      setCopyStatus(t('TIN copied', 'টিআইএন কপি হয়েছে'));
    } catch {
      setCopyStatus(t('Copy unavailable. Use the reveal control to read the TIN.', 'কপি করা যাচ্ছে না। টিআইএন দেখতে দেখান বোতাম ব্যবহার করুন।'));
    }
  };

  return <TaxPayModal
    service="parallel-taxpayer-draft"
    className="parallel-taxpayer-draft-modal"
    title={stage === 1 ? t('Taxpayer Information', 'করদাতার তথ্য') : t('Tax Head Selection', 'কর পরিশোধের খাত নির্বাচন')}
    ariaLabel={t('All Tax Payments — parallel draft', 'সব ধরনের কর পরিশোধ — সমান্তরাল খসড়া')}
    closeIconLabel={t('Close parallel draft', 'সমান্তরাল খসড়া বন্ধ করুন')}
    initialFocusSelector={stage === 1 ? '#parallel-taxpayer-tin' : undefined}
    onClose={onClose}
    onBack={stage === 2 ? () => setStage(1) : undefined}
    backLabel={t('Back to taxpayer information', 'করদাতার তথ্যে ফিরুন')}
    footer={<div className="parallel-taxpayer-draft__footer">
      <button type="button" className="parallel-taxpayer-draft__secondary" onClick={stage === 2 ? () => setStage(1) : onClose}>
        {stage === 2 ? <ArrowLeft size={17} aria-hidden="true" /> : null}
        {stage === 2 ? t('Back to taxpayers', 'করদাতার তালিকায় ফিরুন') : t('Cancel', 'বাতিল')}
      </button>
      {stage === 1 && <button type="button" className="parallel-taxpayer-draft__primary" disabled={!selectedCount}
        onClick={() => setStage(2)} data-testid="parallel-taxpayer-continue">
        {t('Continue to Tax Heads', 'কর পরিশোধের খাতে এগিয়ে যান')} <ArrowRight size={17} aria-hidden="true" />
      </button>}
    </div>}
  >
    <div className="parallel-taxpayer-draft" data-testid="parallel-taxpayer-draft" lang={language}>
      <p className="parallel-taxpayer-draft__step">{stage === 1
        ? t('Step 1 · Taxpayer information', 'ধাপ ১ · করদাতার তথ্য')
        : t('Step 2 · Tax heads (next implementation)', 'ধাপ ২ · করের খাত (পরবর্তী বাস্তবায়ন)')}</p>
      {stage === 1 ? <>
        <p className="parallel-taxpayer-draft__intro">
          {t('Search a taxpayer by TIN, review the result, then add them to the payment list. Repeat to include others.',
            'টিআইএন দিয়ে করদাতা খুঁজুন, তথ্য যাচাই করুন এবং পেমেন্টের তালিকায় যোগ করুন। অন্য করদাতার জন্য একইভাবে যোগ করুন।')}
        </p>
        <div className="parallel-taxpayer-draft__grid">
          <section className="parallel-taxpayer-draft__panel" aria-labelledby="parallel-draft-add-title">
            <header className="parallel-taxpayer-draft__panel-heading">
              <h3 id="parallel-draft-add-title">{t('Add taxpayer', 'করদাতা যোগ করুন')}</h3>
              <p>{t('Enter one TIN at a time.', 'প্রতিবার একটি টিআইএন লিখুন।')}</p>
            </header>
            <div className="parallel-taxpayer-draft__panel-body">
              <TaxpayerTinLookup
                language={language} tinId="parallel-taxpayer-tin" nameId="parallel-taxpayer-name"
                tin={tin} name={result ? (bn ? result.nameBn : result.nameEn) : ''}
                maxTinLength={13} hideNameField
                onTinChange={value => { setTin(value); setSearchedTin(''); setError(''); }}
                onClear={() => { setTin(''); setSearchedTin(''); setError(''); }}
                canSearch={/^\d{12,13}$/.test(tin)}
                onSearch={search}
                searchLabel={t('Search taxpayer TIN', 'করদাতার টিআইএন খুঁজুন')}
                invalidTin={Boolean(error)}
                tinDescribedBy={error ? 'parallel-taxpayer-error' : undefined}
                helper={<p className="parallel-taxpayer-draft__hint">{t(
                  'Search uses the existing fictional taxpayer catalogue, not official NBR identity verification.',
                  'অনুসন্ধানে বিদ্যমান নমুনা করদাতার তালিকা ব্যবহার করা হয়; এটি সরকারি এনবিআর পরিচয় যাচাই নয়।')}</p>}
                error={error ? <p id="parallel-taxpayer-error" className="parallel-taxpayer-draft__error" role="alert">{error}</p> : null}
              />
              {result ? <div className="parallel-taxpayer-draft__result" aria-live="polite"
                data-testid="parallel-taxpayer-search-result">
                <span className="parallel-taxpayer-draft__result-label">{t('Search result', 'অনুসন্ধানের ফলাফল')}</span>
                <strong>{bn ? result.nameBn : result.nameEn}</strong>
                <span className="parallel-taxpayer-draft__result-tin">{maskedTin(result.tin)}</span>
                <p>{t('Confirm this taxpayer before adding to your payment list.',
                  'পেমেন্টের তালিকায় যোগ করার আগে করদাতার তথ্য নিশ্চিত করুন।')}</p>
                <button type="button" className="parallel-taxpayer-draft__primary" disabled={alreadyAdded}
                  onClick={addTaxpayer} data-testid="parallel-add-taxpayer">
                  {alreadyAdded ? <Check size={17} aria-hidden="true" /> : null}
                  {alreadyAdded ? t('Already added', 'আগেই যোগ করা হয়েছে') : t('+ Add Taxpayer', '+ করদাতা যোগ করুন')}
                </button>
              </div> : <div className="parallel-taxpayer-draft__search-placeholder" role="status">
                {t('Search to see the taxpayer details here, then choose Add Taxpayer.',
                  'করদাতার তথ্য এখানে দেখতে অনুসন্ধান করুন, তারপর করদাতা যোগ করুন।')}
              </div>}
            </div>
          </section>
          <section className="parallel-taxpayer-draft__panel" aria-labelledby="parallel-draft-selected-title">
            <header className="parallel-taxpayer-draft__panel-heading">
              <h3 id="parallel-draft-selected-title">{t('Taxpayers in this payment', 'এই পেমেন্টে করদাতারা')}
                <span className="parallel-taxpayer-draft__count">{selectedCount}</span>
              </h3>
              <p>{t('Review the list. Remove a taxpayer at any time.',
                'তালিকা যাচাই করুন। যেকোনো সময় করদাতা বাদ দিতে পারবেন।')}</p>
            </header>
            {!selectedCount ? <div className="parallel-taxpayer-draft__empty" data-testid="parallel-taxpayer-empty">
              <UsersRound size={32} strokeWidth={1.5} aria-hidden="true" />
              <strong>{t('No taxpayers added yet', 'এখনো কোনো করদাতা যোগ করা হয়নি')}</strong>
              <p>{t('Enter a TIN on the left, search for the taxpayer, and select Add Taxpayer to see them here.',
                'বাম পাশে টিআইএন লিখুন, করদাতা খুঁজুন এবং এখানে দেখার জন্য করদাতা যোগ করুন।')}</p>
            </div> : <div className="parallel-taxpayer-draft__table-scroll">
              <table className="parallel-taxpayer-draft__table">
                <thead><tr>
                  <th scope="col">{t('Taxpayer', 'করদাতা')}</th>
                  <th scope="col">{t('TIN', 'টিআইএন')}</th>
                  <th scope="col">{t('Action', 'পদক্ষেপ')}</th>
                </tr></thead>
                <tbody>{taxpayers.map(person => <tr key={person.tin}>
                  <td>{bn ? person.nameBn : person.nameEn}</td>
                  <td><div className="parallel-taxpayer-draft__tin-cell">
                    <span className="parallel-taxpayer-draft__mono">{revealed.includes(person.tin) ? person.tin : maskedTin(person.tin)}</span>
                    <button type="button" className="parallel-taxpayer-draft__icon-button"
                      onClick={() => toggleTin(person.tin)}
                      aria-label={revealed.includes(person.tin) ? t('Hide TIN', 'টিআইএন লুকান') : t('Reveal TIN', 'টিআইএন দেখান')}
                      title={revealed.includes(person.tin) ? t('Hide TIN', 'টিআইএন লুকান') : t('Reveal TIN', 'টিআইএন দেখান')}>
                      {revealed.includes(person.tin) ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button type="button" className="parallel-taxpayer-draft__icon-button"
                      onClick={() => void copyTin(person.tin)} aria-label={t('Copy TIN', 'টিআইএন কপি করুন')}
                      title={t('Copy TIN', 'টিআইএন কপি করুন')}><Copy size={16} /></button>
                  </div></td>
                  <td><button type="button" className="parallel-taxpayer-draft__delete"
                    onClick={() => deleteTaxpayer(person.tin)}
                    aria-label={t('Remove taxpayer', 'করদাতা বাদ দিন') + ': ' + (bn ? person.nameBn : person.nameEn)}>
                    <Trash2 size={16} aria-hidden="true" /> {t('Delete', 'বাদ দিন')}
                  </button></td>
                </tr>)}</tbody>
              </table>
            </div>}
            {copyStatus && <p className="parallel-taxpayer-draft__copy-status" role="status">{copyStatus}</p>}
          </section>
        </div>
        <p className="parallel-taxpayer-draft__disclaimer">{t(
          'Adding someone here includes them in this draft payment only. It does not save a beneficiary or create a transaction.',
          'এখানে যোগ করা করদাতা শুধু এই খসড়া পেমেন্টে থাকবে। এটি সুবিধাভোগী হিসেবে সংরক্ষণ বা লেনদেন তৈরি করে না।')}</p>
      </> : <section className="parallel-taxpayer-draft__next" data-testid="parallel-tax-head-boundary">
        <h3>{t('Tax Head Selection', 'কর পরিশোধের খাত নির্বাচন')}</h3>
        <p>{t('The taxpayer-entry draft is ready for review. The next implementation will connect this selection to a separate clone of the approved tax-head and payment screens.',
          'করদাতা যোগ করার খসড়াটি পর্যালোচনার জন্য প্রস্তুত। পরবর্তী বাস্তবায়নে এই তালিকাকে অনুমোদিত করের খাত ও পেমেন্ট স্ক্রিনের পৃথক অনুলিপির সঙ্গে যুক্ত করা হবে।')}</p>
        <div className="parallel-taxpayer-draft__review">
          <strong>{t('Selected taxpayers', 'নির্বাচিত করদাতারা')} ({selectedCount})</strong>
          <ul>{taxpayers.map(person => <li key={person.tin}>
            <span>{bn ? person.nameBn : person.nameEn}</span>
            <span className="parallel-taxpayer-draft__mono">{maskedTin(person.tin)}</span>
          </li>)}</ul>
        </div>
        <p className="parallel-taxpayer-draft__disclaimer">{t(
          'First draft only. No payment is submitted and the existing approved Pay Tax journey remains unchanged.',
          'এটি শুধু প্রথম খসড়া। কোনো পেমেন্ট জমা দেওয়া হয় না এবং বিদ্যমান অনুমোদিত কর পরিশোধের ধাপ অপরিবর্তিত থাকে।')}</p>
      </section>}
    </div>
  </TaxPayModal>;
}
