import React, {useState} from 'react';
import {ArrowRight, ReceiptText, Search, Trash2} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {SelectedIdentityRail} from '../ui/SelectedIdentityRail';
import {TaxpayerTinLookup, TaxpayerTinSearchResultCard} from '../ui/TaxpayerTinLookup';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
import {maskTinForDisplay} from '../../services/tinDisplay';
import {amountInTakaWords} from '../../services/amountInWords';
import {estimateGiftTax, parseGiftValue} from '../../services/giftTaxEstimate';
import '../../styles/taxpay-unified-v3.css';

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
    if (!value) return null;
    const title = party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা');
    return <div className="unified-taxpayer-workspace__person" data-testid={'gift-added-' + party}>
      <div className="unified-taxpayer-workspace__person-main">
        <span className="unified-taxpayer-workspace__avatar" aria-hidden="true">
          {party === 'donor' ? t('D', 'দ') : t('R', 'গ')}
        </span>
        <div className="unified-taxpayer-workspace__person-copy">
          <strong>{value.name} <span>· {title}</span></strong>
          <small>{maskTinForDisplay(value.tin)}</small>
        </div>
        {removable && <button type="button" className="unified-taxpayer-workspace__remove"
          aria-label={t('Remove ', 'সরান: ') + title} title={t('Remove from this payment', 'এই পেমেন্ট থেকে সরান')}
          onClick={() => updateTin(party, '')}><Trash2 size={17} aria-hidden="true" /></button>}
      </div>
    </div>;
  };
  const partyLookup = (party: Party) => {
    const confirmed = added[party];
    const match = searched[party];
    const title = party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা');
    return <section className="gift-tax-person-section" data-testid={'gift-' + party + '-section'}>
      <h2 className="unified-taxpayer-workspace__heading">
        {party === 'donor' ? t('Add donor', 'দাতা যোগ করুন') : t('Add donee', 'গ্রহীতা যোগ করুন')}
      </h2>
      <p className="unified-taxpayer-workspace__subheading">
        {t('Enter a TIN and search.', 'টিআইএন লিখে অনুসন্ধান করুন।')}
      </p>
      {confirmed ? <div className="gift-tax-confirmed-person">
        <TaxpayerTinSearchResultCard language={language} tin={confirmed.tin} name={confirmed.name}
          testId={'gift-confirmed-' + party} />
        <button type="button" className={secondaryClass} onClick={() => updateTin(party, confirmed.tin)}>
          {t('Edit ', 'সম্পাদনা করুন: ') + title}
        </button>
      </div> : <>
        <TaxpayerTinLookup language={language} tinId={'gift-' + party + '-tin'} nameId={'gift-' + party + '-name'}
          tin={tinInput[party]} name={match?.name ?? ''} onTinChange={value => updateTin(party, value)}
          onClear={() => updateTin(party, '')} onSearch={() => searchTin(party)}
          canSearch={/^\d{12}$/.test(tinInput[party])} omitNameField directDigitEdit submitOnEnter
          showClearButton={false} suggestedTins={[]}
          tinLabel={party === 'donor' ? t('Donor TIN', 'দাতার টিআইএন') : t('Donee TIN', 'গ্রহীতার টিআইএন')}
          searchLabel={t('Search ', 'খুঁজুন: ') + (party === 'donor' ? t('Donor information', 'দাতার তথ্য') : t('Donee information', 'গ্রহীতার তথ্য'))}
          inputTestId={'gift-' + party + '-tin-input'} className="unified-taxpayer-workspace__shared-lookup" />
        <div className="unified-taxpayer-workspace__result" aria-live="polite">
          {!match && !lookupError[party] && <div className="unified-taxpayer-workspace__empty">
            <Search size={24} aria-hidden="true" />
            <span>{t('Search a TIN to view taxpayer information.', 'করদাতার তথ্য দেখতে টিআইএন অনুসন্ধান করুন।')}</span>
          </div>}
          {lookupError[party] && <p className="unified-taxpayer-workspace__error" role="alert">{lookupError[party]}</p>}
          {match && <>
            <TaxpayerTinSearchResultCard language={language} tin={match.tin} name={match.name}
              testId={'gift-' + party + '-result'} onAdd={() => addParty(party)} canAdd
              addLabel={party === 'donor' ? t('Add Donor', 'দাতা যোগ করুন') : t('Add Donee', 'গ্রহীতা যোগ করুন')} />
            <p className="gift-tax-lookup-notice">
              {t('Sample lookup only — not an NBR verified identity.', 'শুধু নমুনা অনুসন্ধান — NBR যাচাইকৃত পরিচয় নয়।')}
            </p>
          </>}
        </div>
      </>}
    </section>;
  };
  // Use exactly the same payment-stage column structure as the approved
  // UnifiedTaxpayerWorkspace. The shared identity rail owns the right surface.
  const workspace = (testId: string, content: React.ReactNode, rail: React.ReactNode) =>
    <div className="payment-flow-embedded payment-flow-embedded--unified gift-tax-workspace"
      data-testid={testId}>
      <div className="payment-flow-embedded__content">
        <div className="payment-form-layout payment-flow-embedded__identity unified-taxpayer-workspace">
          <section className="payment-form-layout__sections unified-taxpayer-workspace__editor gift-tax-main">
            {content}
          </section>
          {rail}
        </div>
      </div>
    </div>;

  const selectedCount = Number(Boolean(added.donor)) + Number(Boolean(added.donee));
  return <TaxPayModal title={t('Gift Tax', 'দানকর')}
    ariaLabel={t('Gift Tax', 'দানকর')} service="gift" className="gift-tax-dialog taxpay-v5-locked"
    progress={{current: step, total: 3, label: t('Steps', 'ধাপ'),
      subtitle: t('Walk-in Payment', 'ওয়াক-ইন পেমেন্ট')}}
    closeIconLabel={t('Close Gift Tax', 'দানকর বন্ধ করুন')}
    onClose={onClose}
    onBack={step === 1 ? onBack : () => setStep(step === 3 ? 2 : 1)}
    backLabel={step === 1 ? t('Back to Other tax payments', 'অন্যান্য কর পরিশোধে ফিরুন') : t('Back to previous Gift Tax screen', 'আগের দানকর স্ক্রিনে ফিরুন')}
    footer={<div className="payment-flow-embedded__footer-actions">
      {step === 1 ? <button type="button" className="tax-service-choice__continue"
        disabled={!bothAdded} onClick={continueToDetails}>
        {t('Continue to Gift & Tax Information', 'দান ও করের তথ্যে এগিয়ে যান')}
        <ArrowRight size={18} aria-hidden="true" />
      </button> : step === 2 ? <button type="button" className="tax-service-choice__continue"
        onClick={continueToPreview}>
        {t('Continue to Final Preview', 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান')}
        <ArrowRight size={18} aria-hidden="true" />
      </button> : <button type="button" className="tax-service-choice__continue" onClick={onClose}>
        {t('Close preview', 'পর্যালোচনা বন্ধ করুন')}
      </button>}
    </div>}>
    {step === 1 && workspace('gift-tax-entry-form',
      <>{partyLookup('donor')}{partyLookup('donee')}</>,
      <SelectedIdentityRail prefix="unified-taxpayer-workspace"
        className="gift-tax-aside payment-form-summary" testId="gift-tax-identity-rail"
        label={t('Donor & Donee in this Payment', 'এই পেমেন্টের দাতা ও গ্রহীতা')}
        count={selectedCount} countTestId="gift-tax-selected-count" announceCount
        emptyLabel={t('No donor or donee added', 'কোনো দাতা বা গ্রহীতা যোগ করা হয়নি')}>
        {partyDisplay('donor', true)}{partyDisplay('donee', true)}
      </SelectedIdentityRail>
    )}
    {step === 2 && workspace('gift-tax-details-form',
      <>
        <h2 className="unified-taxpayer-workspace__heading">{t('Gift & tax information', 'দান ও করের তথ্য')}</h2>
        <p className="unified-taxpayer-workspace__subheading">{t('Enter and review the details of the gift.', 'দানের বিবরণ লিখুন ও যাচাই করুন।')}</p>
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
        {formError && <p role="alert" className="unified-taxpayer-workspace__error">{formError}</p>}
        <p className="gift-tax-lookup-notice">{t('Estimate assumes the annual ৳20,000 allowance is available. Other exemptions and earlier gifts are not checked.', 'এই হিসাবে বার্ষিক ২০,০০০ টাকার অব্যাহতি অব্যবহৃত ধরা হয়েছে। অন্যান্য অব্যাহতি ও আগের দান যাচাই করা হয়নি।')}</p>
      </>,
      <aside className="unified-taxpayer-workspace__rail gift-tax-aside payment-form-summary"
        data-testid="gift-tax-payment-summary">
        <h3 className="unified-taxpayer-workspace__rail-title"><ReceiptText size={17} aria-hidden="true"/>{t('Payment summary', 'পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Estimated Gift Tax', 'আনুমানিক দানকর')}</p>
        <p className="payment-form-summary__total" data-testid="gift-tax-estimate"
          aria-live="polite" aria-atomic="true">{estimatedTax === null ? '—' : '৳ ' + number(estimatedTax)}</p>
        <p className="payment-form-summary__amount-words">{amountInTakaWords(estimatedTax, language) ?? '—'}</p>
        <dl className="gift-tax-summary-lines payment-form-summary__rows">
          {line(t('Donor', 'দাতা'), added.donor?.name ?? '—')}
          {line(t('Donor TIN', 'দাতার টিআইএন'), maskTinForDisplay(added.donor?.tin))}
          {line(t('Donee', 'গ্রহীতা'), added.donee?.name ?? '—')}
          {line(t('Donee TIN', 'গ্রহীতার টিআইএন'), maskTinForDisplay(added.donee?.tin))}
        </dl>
      </aside>
    )}
    {step === 3 && workspace('gift-tax-review',
      <>
        <h2 className="unified-taxpayer-workspace__heading">{t('Final Gift Tax preview', 'চূড়ান্ত দানকর পর্যালোচনা')}</h2>
        <dl className="gift-tax-review-lines">
          {line(t('Gift amount', 'দানের পরিমাণ'), parsedAmount === null ? '—' : '৳ ' + number(parsedAmount))}
          {line(t('Gift description', 'দানের বিবরণ'), description || '—')}
          {line(t('Date of gift', 'দানের তারিখ'), dateOfGift)}
          {line(t('Remarks', 'মন্তব্য'), remarks || '—')}
          {line(t('Through — challan column 2', 'মাধ্যম — চালানের ২য় কলাম'), added.donee?.name ?? '—')}
          {line(t('On Behalf Of — challan column 3', 'যার পক্ষে — চালানের ৩য় কলাম'), added.donor?.name ?? '—')}
          {line(t('Tax liability belongs to', 'কর দায় যাঁর'), added.donor?.name ?? '—')}
        </dl>
        <div role="status" className="gift-tax-preview-notice" data-testid="gift-tax-review-complete">
          {t('Preview only. The Gift Tax payment head, authoritative identity/tax-zone lookup, statutory exemptions, gateway, and donor credit posting are not configured. No money was charged, no challan was created, and no SQL payment record was written.',
            'শুধু পর্যালোচনা। দানকরের অনুমোদিত খাত, পরিচয়/কর অঞ্চল যাচাই, আইনগত অব্যাহতি, পেমেন্ট গেটওয়ে ও দাতার কর ক্রেডিট চালু নেই। কোনো টাকা কাটা হয়নি, চালান তৈরি হয়নি বা SQL-এ পেমেন্ট রেকর্ড লেখা হয়নি।')}
        </div>
      </>,
      <aside className="unified-taxpayer-workspace__rail gift-tax-aside payment-form-summary">
        <h3 className="unified-taxpayer-workspace__rail-title"><ReceiptText size={17} aria-hidden="true"/>{t('Payment summary', 'পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Estimated total', 'আনুমানিক মোট')}</p>
        <p className="payment-form-summary__total">{estimatedTax === null ? '—' : '৳ ' + number(estimatedTax)}</p>
        <p className="payment-form-summary__amount-words">{amountInTakaWords(estimatedTax, language) ?? '—'}</p>
        <div className="unified-taxpayer-workspace__list">
          {partyDisplay('donor')}{partyDisplay('donee')}
        </div>
      </aside>
    )}
  </TaxPayModal>;
}
