import React, {useState} from 'react';
import {Trash2} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {TaxpayerTinLookup, TaxpayerTinSearchResultCard} from '../ui/TaxpayerTinLookup';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
import {maskTinForDisplay} from '../../services/tinDisplay';
import {amountInTakaWords} from '../../services/amountInWords';
import {estimateGiftTax, parseGiftValue} from '../../services/giftTaxEstimate';

type Party = 'donor' | 'donee';
type Person = {tin: string; name: string};
type PartyMap = Record<Party, Person | null>;
const emptyParties = (): PartyMap => ({donor: null, donee: null});
const localToday = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
};
const inputClass = 'gift-tax-field-control';
const primaryClass = 'gift-tax-action gift-tax-action--primary';
const secondaryClass = 'gift-tax-action gift-tax-action--secondary';

/**
 * Gift Tax V1 — approved two-screen data entry and final review.
 * The public TIN fixture is NOT NBR identity; the tax is an estimate only.
 * No authorized Gift Tax head, government payment API, or official credit-posting
 * path currently exists. Never turn this public form into a financial write.
 */
export function GiftTaxEntryModal({onClose, onBack}: {onClose: () => void; onBack?: () => void}) {
  const {language} = useTaxState();
  const bn = language === 'bn';
  const t = (en: string, bd: string) => bn ? bd : en;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tinInput, setTinInput] = useState<Record<Party, string>>({donor: '', donee: ''});
  const [searched, setSearched] = useState<PartyMap>(emptyParties);
  const [added, setAdded] = useState<PartyMap>(emptyParties);
  const [lookupError, setLookupError] = useState<Record<Party, string>>({donor: '', donee: ''});
  const [giftAmount, setGiftAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateOfGift, setDateOfGift] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const number = (value: number) => new Intl.NumberFormat(bn ? 'bn-BD' : 'en-IN', {maximumFractionDigits: 2}).format(value);
  const parsedAmount = parseGiftValue(giftAmount);
  const estimatedTax = parsedAmount === null ? null : estimateGiftTax(parsedAmount);
  const bothAdded = Boolean(added.donor && added.donee && added.donor.tin !== added.donee.tin);

  const updateTin = (party: Party, value: string) => {
    setTinInput(current => ({...current, [party]: value}));
    setSearched(current => ({...current, [party]: null}));
    setAdded(current => ({...current, [party]: null}));
    setLookupError(current => ({...current, [party]: ''}));
  };
  const searchTin = (party: Party) => {
    const tin = tinInput[party];
    if (!/^\d{12}$/.test(tin)) {
      setLookupError(current => ({...current, [party]: t('Enter a valid 12-digit TIN.', 'বৈধ ১২ সংখ্যার টিআইএন লিখুন।')}));
      return;
    }
    const found = lookupSampleTaxpayer(tin);
    setSearched(current => ({...current, [party]: found ? {tin, name: bn ? found.nameBn : found.nameEn} : null}));
    setLookupError(current => ({
      ...current,
      [party]: found ? '' : t('No available taxpayer record matches this TIN.', 'এই টিআইএনের জন্য কোনো উপলব্ধ করদাতার তথ্য পাওয়া যায়নি।'),
    }));
  };
  const addParty = (party: Party) => {
    const match = searched[party];
    if (!match || match.tin !== tinInput[party]) return;
    const opposite = party === 'donor' ? 'donee' : 'donor';
    if (added[opposite]?.tin === match.tin) {
      setLookupError(current => ({...current, [party]: t('Donor and donee must be different people.', 'দাতা ও গ্রহীতা পৃথক ব্যক্তি হতে হবে।')}));
      return;
    }
    setAdded(current => ({...current, [party]: match}));
    setLookupError(current => ({...current, [party]: ''}));
  };
  const continueToDetails = () => {
    if (!bothAdded) return;
    setFormError('');
    setStep(2);
  };
  const continueToPreview = () => {
    if (parsedAmount === null || estimatedTax === null) {
      setFormError(t('Enter a valid gift amount above zero (up to two decimals).', 'শূন্যের বেশি বৈধ দানের পরিমাণ লিখুন (সর্বোচ্চ দুই দশমিক স্থান)।'));
      return;
    }
    if (!dateOfGift || dateOfGift > localToday()) {
      setFormError(t('Select a valid gift date, not in the future.', 'ভবিষ্যতের নয়, এমন বৈধ দানের তারিখ নির্বাচন করুন।'));
      return;
    }
    if (!bothAdded) {setStep(1); return;}
    setFormError('');
    setStep(3);
  };
  const line = (label: string, value: React.ReactNode) => <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 last:border-0">
    <dt className="text-sm text-slate-600">{label}</dt>
    <dd className="min-w-0 break-words text-right text-sm font-semibold text-slate-900">{value}</dd>
  </div>;
  const partyDisplay = (party: Party, removable = false) => {
    const value = added[party];
    return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5" data-testid={'gift-added-' + party}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা')}</p>
          {value ? <><p className="break-words text-sm font-semibold text-slate-900">{value.name}</p>
            <p className="text-xs text-slate-600">{t('TIN', 'টিআইএন')}: {maskTinForDisplay(value.tin)}</p></> :
            <p className="text-sm text-slate-500">{t('Not added yet', 'এখনো যোগ করা হয়নি')}</p>}
        </div>
        {value && removable && <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('Remove ', 'সরান: ') + (party === 'donor' ? t('donor', 'দাতা') : t('donee', 'গ্রহীতা'))}
          onClick={() => updateTin(party, '')}><Trash2 size={17} aria-hidden="true" /></button>}
      </div>
    </div>;
  };
  const partyLookup = (party: Party) => {
    const confirmed = added[party];
    const match = searched[party];
    const title = party === 'donor' ? t('Donor information', 'দাতার তথ্য') : t('Donee information', 'গ্রহীতার তথ্য');
    return <section className="space-y-3 border-b border-slate-200 pb-5 last:border-0 last:pb-0" data-testid={'gift-' + party + '-section'}>
      <div><h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{t('Enter the 12-digit TIN and search.', '১২ সংখ্যার টিআইএন লিখে খুঁজুন।')}</p></div>
      {confirmed ? <>{partyDisplay(party)}
        <button type="button" className={secondaryClass} onClick={() => updateTin(party, confirmed.tin)}>
          {t('Edit ', 'সম্পাদনা করুন: ') + (party === 'donor' ? t('donor', 'দাতা') : t('donee', 'গ্রহীতা'))}
        </button></> : <>
        <TaxpayerTinLookup language={language} tinId={'gift-' + party + '-tin'} nameId={'gift-' + party + '-name'}
          tin={tinInput[party]} name={match?.name ?? ''} onTinChange={value => updateTin(party, value)}
          onClear={() => updateTin(party, '')} onSearch={() => searchTin(party)}
          canSearch={/^\d{12}$/.test(tinInput[party])} hideNameField
          tinLabel={party === 'donor' ? t('Donor TIN', 'দাতার টিআইএন') : t('Donee TIN', 'গ্রহীতার টিআইএন')}
          searchLabel={t('Search ', 'খুঁজুন: ') + title}
          inputTestId={'gift-' + party + '-tin-input'} />
        {lookupError[party] && <p className="text-sm text-red-700" role="alert">{lookupError[party]}</p>}
        {match && <><TaxpayerTinSearchResultCard language={language} tin={match.tin} name={match.name}
          testId={'gift-' + party + '-result'} onAdd={() => addParty(party)} canAdd
          addLabel={party === 'donor' ? t('Add Donor', 'দাতা যোগ করুন') : t('Add Donee', 'গ্রহীতা যোগ করুন')} />
          <p className="text-xs text-slate-600">{t('Sample lookup only — not an NBR verified identity.', 'শুধু নমুনা অনুসন্ধান — NBR যাচাইকৃত পরিচয় নয়।')}</p></>}
      </>}
    </section>;
  };
  return <TaxPayModal title={t('Gift Tax', 'দানকর')}
    ariaLabel={t('Gift Tax', 'দানকর')} service="gift" className="gift-tax-dialog"
    // The approved Taxpayer Information modal is a three-stage payment shell.
    // Reuse its width, height, header, progress and mobile fullscreen rules;
    // do not create a separate Gift Tax modal-size implementation.
    progress={{current: step, total: 3, label: t('Steps', 'ধাপ')}}
    closeIconLabel={t('Close Gift Tax', 'দানকর বন্ধ করুন')}
    onClose={onClose}
    onBack={step === 1 ? onBack : () => setStep(step === 3 ? 2 : 1)}
    backLabel={step === 1 ? t('Back to Other tax payments', 'অন্যান্য কর পরিশোধে ফিরুন') : t('Back to previous Gift Tax screen', 'আগের দানকর স্ক্রিনে ফিরুন')}
    footer={step === 1 ? <button type="button" className={primaryClass} disabled={!bothAdded} onClick={continueToDetails}>
      {t('Continue to Gift & Tax Information', 'দান ও করের তথ্যে এগিয়ে যান')}
    </button> : step === 2 ? <>
      <button type="button" className={secondaryClass} onClick={() => setStep(1)}>{t('Back', 'পেছনে')}</button>
      <button type="button" className={primaryClass} onClick={continueToPreview}>{t('Continue to Final Preview', 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান')}</button>
    </> : <>
      <button type="button" className={secondaryClass} onClick={() => setStep(2)}>{t('Back', 'পেছনে')}</button>
      <button type="button" className={primaryClass} onClick={onClose}>{t('Close preview', 'পর্যালোচনা বন্ধ করুন')}</button>
    </>}>
    {step === 1 && <div className="gift-tax-grid" data-testid="gift-tax-entry-form">
      <div className="gift-tax-main space-y-5">{partyLookup('donor')}{partyLookup('donee')}</div>
      <aside className="gift-tax-aside payment-form-summary" aria-label={t('Donor & Donee in this Payment', 'এই পেমেন্টের দাতা ও গ্রহীতা')}>
        <h3 className="gift-tax-summary-heading">{t('Donor & Donee in this Payment', 'এই পেমেন্টের দাতা ও গ্রহীতা')}</h3>
        <div className="space-y-2">{partyDisplay('donor', true)}{partyDisplay('donee', true)}</div>
      </aside>
    </div>}
    {step === 2 && <div className="gift-tax-grid" data-testid="gift-tax-details-form">
      <section className="gift-tax-main space-y-4">
        <h3 className="text-base font-semibold text-slate-900">{t('Gift & tax information', 'দান ও করের তথ্য')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label htmlFor="gift-tax-amount" className="gift-tax-field-label">{t('Gift amount (৳)', 'দানের পরিমাণ (৳)')} *</label>
            <input id="gift-tax-amount" className={inputClass} inputMode="decimal" autoComplete="off" placeholder="2500000"
              value={giftAmount} required aria-invalid={Boolean(formError && parsedAmount === null)}
              onChange={event => {setGiftAmount(event.target.value);setFormError('');}} /></div>
          <div><label htmlFor="gift-tax-description" className="gift-tax-field-label">{t('Gift description', 'দানের বিবরণ')}</label>
            <input id="gift-tax-description" className={inputClass} maxLength={500} value={description}
              onChange={event => setDescription(event.target.value)} placeholder={t('Enter gift details', 'দানের বিবরণ লিখুন')} /></div>
          <div><label htmlFor="gift-tax-date" className="gift-tax-field-label">{t('Date of gift', 'দানের তারিখ')} *</label>
            <input id="gift-tax-date" className={inputClass} type="date" max={localToday()}
              value={dateOfGift} required onChange={event => {setDateOfGift(event.target.value);setFormError('');}} /></div>
          <div><label htmlFor="gift-tax-remarks" className="gift-tax-field-label">{t('Remarks', 'মন্তব্য')}</label>
            <textarea id="gift-tax-remarks" className={inputClass} rows={2} value={remarks}
              onChange={event => setRemarks(event.target.value)} placeholder={t('Optional challan remarks', 'ঐচ্ছিক চালান মন্তব্য')} /></div>
        </div>
        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
        <p className="text-xs leading-5 text-slate-600">{t('Estimate assumes the annual ৳20,000 allowance is available. Other exemptions and earlier gifts are not checked.', 'এই হিসাবে বার্ষিক ২০,০০০ টাকার অব্যাহতি অব্যবহৃত ধরা হয়েছে। অন্যান্য অব্যাহতি ও আগের দান যাচাই করা হয়নি।')}</p>
      </section>
      <aside className="gift-tax-aside payment-form-summary" data-testid="gift-tax-payment-summary">
        <h3 className="gift-tax-summary-heading">{t('Payment summary', 'পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Estimated Gift Tax', 'আনুমানিক দানকর')}</p>
        <p className="payment-form-summary__total" data-testid="gift-tax-estimate" aria-live="polite" aria-atomic="true">{estimatedTax === null ? '—' : '৳ ' + number(estimatedTax)}</p>
        <p className="payment-form-summary__amount-words">{amountInTakaWords(estimatedTax, language) ?? '—'}</p>
        <dl className="gift-tax-summary-lines payment-form-summary__rows">{line(t('Donor', 'দাতা'), added.donor?.name ?? '—')}{line(t('Donor TIN', 'দাতার টিআইএন'), maskTinForDisplay(added.donor?.tin))}{line(t('Donee', 'গ্রহীতা'), added.donee?.name ?? '—')}{line(t('Donee TIN', 'গ্রহীতার টিআইএন'), maskTinForDisplay(added.donee?.tin))}</dl>
      </aside>
    </div>}
    {step === 3 && <div className="gift-tax-grid" data-testid="gift-tax-review">
      <section className="gift-tax-main space-y-3">
        <h3 className="text-base font-semibold text-slate-900">{t('Final Gift Tax preview', 'চূড়ান্ত দানকর পর্যালোচনা')}</h3>
        <dl className="rounded-xl border border-slate-200 bg-white px-4">
          {line(t('Gift amount', 'দানের পরিমাণ'), parsedAmount === null ? '—' : '৳ ' + number(parsedAmount))}
          {line(t('Gift description', 'দানের বিবরণ'), description || '—')}
          {line(t('Date of gift', 'দানের তারিখ'), dateOfGift)}
          {line(t('Remarks', 'মন্তব্য'), remarks || '—')}
          {line(t('Through — challan column 2', 'মাধ্যম — চালানের ২য় কলাম'), added.donee?.name ?? '—')}
          {line(t('On Behalf Of — challan column 3', 'যার পক্ষে — চালানের ৩য় কলাম'), added.donor?.name ?? '—')}
          {line(t('Tax liability belongs to', 'কর দায় যাঁর'), added.donor?.name ?? '—')}
        </dl>
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950" data-testid="gift-tax-review-complete">
          {t('Preview only. The Gift Tax payment head, authoritative identity/tax-zone lookup, statutory exemptions, gateway, and donor credit posting are not configured. No money was charged, no challan was created, and no SQL payment record was written.',
            'শুধু পর্যালোচনা। দানকরের অনুমোদিত খাত, পরিচয়/কর অঞ্চল যাচাই, আইনগত অব্যাহতি, পেমেন্ট গেটওয়ে ও দাতার কর ক্রেডিট চালু নেই। কোনো টাকা কাটা হয়নি, চালান তৈরি হয়নি বা SQL-এ পেমেন্ট রেকর্ড লেখা হয়নি।')}
        </div>
      </section>
      <aside className="gift-tax-aside payment-form-summary">
        <h3 className="gift-tax-summary-heading">{t('Payment summary', 'পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Estimated total', 'আনুমানিক মোট')}</p>
        <p className="payment-form-summary__total">{estimatedTax === null ? '—' : '৳ ' + number(estimatedTax)}</p>
        <p className="payment-form-summary__amount-words">{amountInTakaWords(estimatedTax, language) ?? '—'}</p>
        {partyDisplay('donor')}{partyDisplay('donee')}
      </aside>
    </div>}
  </TaxPayModal>;
}
