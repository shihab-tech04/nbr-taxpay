import React, {useLayoutEffect, useState} from 'react';
import {ArrowRight, ReceiptText, Search, Trash2} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {WalkInDiscardConfirmation} from '../ui/WalkInDiscardConfirmation';
import {GiftTaxPaymentResult} from './GiftTaxPaymentResult';
import {simulateGiftTaxPayment, type GiftTaxPaymentInput, type GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {PaymentMethodSelector,type PaymentChannel,type PaymentMethodGroup,type PaymentMethod} from '../ui/PaymentMethodSelector';
import {Pencil} from 'lucide-react';
import {SearchableSelect} from '../ui/SearchableSelect';
import {beneficiaryChoiceParts} from '../../services/beneficiaryClassificationChoice';
import {BENEFICIARY_RELATIONS,beneficiaryTagLabel,beneficiaryFinalTagLabel,validBeneficiaryClassification} from '../../services/beneficiaryTags';
import {SelectedIdentityRail} from '../ui/SelectedIdentityRail';
import {TaxpayerTinLookup, TaxpayerTinSearchResultCard} from '../ui/TaxpayerTinLookup';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
import {maskTinForDisplay} from '../../services/tinDisplay';
import {amountInTakaWords} from '../../services/amountInWords';
import {estimateGiftTax, parseGiftValue} from '../../services/giftTaxEstimate';
import {validGiftDate} from '../../services/giftTaxDate';
import '../../styles/taxpay-unified-v3.css';

type Party = 'donor' | 'donee';
type Person = {tin: string; name: string};
type PartyMap = Record<Party, Person | null>;
const emptyParties = (): PartyMap => ({donor: null, donee: null});
const localToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Dhaka',year: 'numeric',month: '2-digit',day: '2-digit'}).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tinInput, setTinInput] = useState<Record<Party, string>>({donor: '', donee: ''});
  const [searched, setSearched] = useState<PartyMap>(emptyParties);
  const [added, setAdded] = useState<PartyMap>(emptyParties);
  const [lookupError, setLookupError] = useState<Record<Party, string>>({donor: '', donee: ''});
  const [giftAmount, setGiftAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateOfGift, setDateOfGift] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [invalidGiftField, setInvalidGiftField] = useState<'amount' | 'date' | null>(null);
  const [doneeChoice, setDoneeChoice] = useState('');
  const [doneeOther, setDoneeOther] = useState('');
  // Candidate identity/relationship is distinct from the selected, committed payment details.
  const [committedDoneeChoice, setCommittedDoneeChoice] = useState('');
  const [committedDoneeOther, setCommittedDoneeOther] = useState('');
  const [editing, setEditing] = useState<Record<Party, boolean>>({donor: false, donee: false});
  const [lastRemoved, setLastRemoved] = useState<{
    party: Party; person: Person; doneeChoice: string; doneeOther: string;
  } | null>(null);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [paymentInput, setPaymentInput] = useState<GiftTaxPaymentInput | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<GiftTaxPaymentOutcome | null>(null);
  const [paymentAttemptKey, setPaymentAttemptKey] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const [paymentChannel,setPaymentChannel]=useState<PaymentChannel|null>(null);
  const [paymentMethod,setPaymentMethod]=useState<PaymentMethod|null>(null);
  const [paymentMethodGroup,setPaymentMethodGroup]=useState<PaymentMethodGroup|null>(null);
  const [paymentAcknowledged,setPaymentAcknowledged]=useState(false);
  const [simulateDecline,setSimulateDecline]=useState(false);
  // Each stage owns its initial scroll position; never inherit the previous
  // long review/checkout scroll offset when the modal swaps content.
  useLayoutEffect(() => {
    document.querySelector<HTMLElement>('.gift-tax-dialog .taxpay-modal__body')?.scrollTo({top: 0, left: 0});
  }, [step, checkoutOpen]);
  const requestClose = () => setExitPromptOpen(true);
  const doneeClass = beneficiaryChoiceParts(doneeChoice);
  const doneeClassValid = validBeneficiaryClassification(doneeClass.tag, doneeClass.relationship, doneeOther);
  const doneeOptions = [
    {value: 'clients', label: t('Clients', 'ক্লায়েন্ট'), group: t('CLIENTS', 'ক্লায়েন্ট')},
    ...BENEFICIARY_RELATIONS.map(relation => ({
      value: 'friends_family:' + relation,
      label: beneficiaryFinalTagLabel('friends_family', relation, language) ?? relation,
      group: t('FRIENDS & FAMILY MEMBERS', 'বন্ধু ও পরিবারের সদস্য'),
    })),
    {value: 'others', label: t('Others — specify', 'অন্যান্য — লিখুন'), group: t('OTHERS', 'অন্যান্য')},
  ];
  const committedDoneeClass = beneficiaryChoiceParts(committedDoneeChoice);
  const committedDoneeValid = validBeneficiaryClassification(
    committedDoneeClass.tag, committedDoneeClass.relationship, committedDoneeOther
  );
  const doneeClassLabel = beneficiaryTagLabel(committedDoneeClass.tag || null,
    committedDoneeClass.relationship || null, language, committedDoneeOther);
  const number = (value: number) => new Intl.NumberFormat(bn ? 'bn-BD' : 'en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value);
  const parsedAmount = parseGiftValue(giftAmount);
  const estimatedTax = parsedAmount === null ? null : estimateGiftTax(parsedAmount);
  const bothAdded = Boolean(added.donor && added.donee && added.donor.tin !== added.donee.tin && !editing.donor && !editing.donee);

  const updateTin = (party: Party, value: string) => {
    setTinInput(current => ({...current, [party]: value}));
    setSearched(current => ({...current, [party]: null}));
    // Editing a candidate never destroys the already-added person.
    if (!editing[party]) setAdded(current => ({...current, [party]: null}));
    setLookupError(current => ({...current, [party]: ''}));
    if (party === 'donee') {setDoneeChoice(''); setDoneeOther('');}
  };
  const beginEdit = (party: Party) => {
    const current = added[party];
    if (!current) return;
    setEditing(states => ({...states, [party]: true}));
    setTinInput(values => ({...values, [party]: current.tin}));
    setSearched(values => ({...values, [party]: null}));
    setLookupError(values => ({...values, [party]: ''}));
    if (party === 'donee') {
      setDoneeChoice(committedDoneeChoice);
      setDoneeOther(committedDoneeOther);
    }
  };
  const cancelEdit = (party: Party) => {
    setEditing(states => ({...states, [party]: false}));
    setTinInput(values => ({...values, [party]: added[party]?.tin ?? ''}));
    setSearched(values => ({...values, [party]: null}));
    setLookupError(values => ({...values, [party]: ''}));
    if (party === 'donee') {
      setDoneeChoice(committedDoneeChoice);
      setDoneeOther(committedDoneeOther);
    }
  };
  const removeParty = (party: Party) => {
    const current = added[party];
    if (!current) return;
    setLastRemoved({party, person: current,
      doneeChoice: committedDoneeChoice, doneeOther: committedDoneeOther});
    setAdded(values => ({...values, [party]: null}));
    setEditing(values => ({...values, [party]: false}));
    setTinInput(values => ({...values, [party]: ''}));
    setSearched(values => ({...values, [party]: null}));
    setLookupError(values => ({...values, [party]: ''}));
    if (party === 'donee') {
      setDoneeChoice(''); setDoneeOther('');
      setCommittedDoneeChoice(''); setCommittedDoneeOther('');
    }
  };
  const undoRemoval = () => {
    if (!lastRemoved) return;
    const {party, person, doneeChoice: choice, doneeOther: other} = lastRemoved;
    setAdded(values => ({...values, [party]: person}));
    setTinInput(values => ({...values, [party]: person.tin}));
    setEditing(values => ({...values, [party]: false}));
    setSearched(values => ({...values, [party]: null}));
    setLookupError(values => ({...values, [party]: ''}));
    if (party === 'donee') {
      setDoneeChoice(choice); setDoneeOther(other);
      setCommittedDoneeChoice(choice); setCommittedDoneeOther(other);
    }
    setLastRemoved(null);
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
    if (party === 'donee' && !doneeClassValid) {
      setLookupError(current => ({...current, donee: t('Select Tag / Relationship, and specify Others if selected.', 'ট্যাগ / সম্পর্ক নির্বাচন করুন এবং অন্যান্য বাছলে বিবরণ লিখুন।')}));
      return;
    }
    const opposite = party === 'donor' ? 'donee' : 'donor';
    if (added[opposite]?.tin === match.tin) {
      setLookupError(current => ({...current, [party]: t('Donor and donee must be different people.', 'দাতা ও গ্রহীতা পৃথক ব্যক্তি হতে হবে।')}));
      return;
    }
    setAdded(current => ({...current, [party]: match}));
    setEditing(states => ({...states, [party]: false}));
    setLastRemoved(null);
    if (party === 'donee') {
      setCommittedDoneeChoice(doneeChoice);
      setCommittedDoneeOther(doneeOther);
    }
    setLookupError(current => ({...current, [party]: ''}));
  };
  const continueToDetails = () => {
    if (!bothAdded) return;
    setFormError('');
    setStep(2);
  };
  const continueToPreview = () => {
    if (parsedAmount === null || estimatedTax === null) {
      setInvalidGiftField('amount');
      setFormError(t('Enter a valid gift amount above zero (up to two decimals).', 'শূন্যের বেশি বৈধ দানের পরিমাণ লিখুন (সর্বোচ্চ দুই দশমিক স্থান)।'));
      document.getElementById('gift-tax-amount')?.focus();
      return;
    }
    if (!validGiftDate(dateOfGift, localToday())) {
      setInvalidGiftField('date');
      setFormError(t('Select a valid gift date, not in the future.', 'ভবিষ্যতের নয়, এমন বৈধ দানের তারিখ নির্বাচন করুন।'));
      document.getElementById('gift-tax-date')?.focus();
      return;
    }
    if (!bothAdded) {setStep(1); return;}
    setInvalidGiftField(null);
    setFormError('');
    setPaymentAttemptKey(null);
    setPaymentInput(null);
    setPaymentOutcome(null);
    setCheckoutOpen(false);
    setPaymentChannel(null);setPaymentMethod(null);setPaymentMethodGroup(null);setPaymentAcknowledged(false);
    setStep(3);
  };
  /** Use the existing payment-method journey, but never submit fictional Gift Tax through an unauthorized service head. */
  const attemptSimulatedPayment = async () => {
    if (paymentBusy || !added.donor || !added.donee || !committedDoneeValid ||
        !bothAdded || parsedAmount === null || estimatedTax === null ||
        !validGiftDate(dateOfGift, localToday())) {
      setFormError(t('Review all required Gift Tax fields before payment.', 'পরিশোধের আগে দানকরের আবশ্যিক তথ্য যাচাই করুন।'));
      setStep(3);
      return;
    }
    const giftMinor = Math.round(parsedAmount * 100);
    const taxMinor = Math.round(estimatedTax * 100);
    if (!Number.isSafeInteger(giftMinor) || !Number.isSafeInteger(taxMinor)) {
      setFormError(t('Gift amount is outside the supported range.', 'দানের পরিমাণ সমর্থিত সীমার বাইরে।'));
      return;
    }
    const key = paymentAttemptKey ?? crypto.randomUUID();
    setPaymentAttemptKey(key);
    const nextInput: GiftTaxPaymentInput = {
      donor: {tin: added.donor.tin, name: added.donor.name},
      donee: {tin: added.donee.tin, name: added.donee.name,
        tag: committedDoneeClass.tag as GiftTaxPaymentInput['donee']['tag'],
        relationship: committedDoneeClass.relationship || null,
        otherLabel: committedDoneeClass.tag === 'others' ? committedDoneeOther.trim() : null},
      giftAmountMinor: giftMinor, estimatedTaxMinor: taxMinor,
      description, giftDate: dateOfGift, remarks, idempotencyKey: key,
    };
    setPaymentInput(nextInput);
    if(taxMinor>0 && (!paymentChannel || !paymentMethod || !paymentAcknowledged)) {
      setFormError(t('Choose a payment channel and confirm the simulation details.', 'পেমেন্ট মাধ্যম বেছে নিয়ে সিমুলেশনের তথ্য নিশ্চিত করুন।'));
      setCheckoutOpen(true);return;
    }
    setPaymentBusy(true);
    try {
      const nextOutcome=simulateGiftTaxPayment(nextInput,paymentMethod??'SIMULATED',simulateDecline);
      setPaymentOutcome(nextOutcome);
    } catch {
      setPaymentOutcome({kind:'SIMULATED_FAILED',reason:t('Unable to prepare the simulation. Retry without losing your details.','সিমুলেশন প্রস্তুত হয়নি। তথ্য না হারিয়ে আবার চেষ্টা করুন।'),retryable:true});
    } finally {
      setPaymentBusy(false);
      setStep(4);
    }
  };
  const line = (label: string, value: React.ReactNode) => <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 last:border-0">
    <dt className="text-sm text-slate-600">{label}</dt>
    <dd className="min-w-0 break-words text-right text-sm font-semibold text-slate-900">{value}</dd>
  </div>;
  const partyDisplay = (party: Party, removable = false) => {
    const value = added[party];
    if (!value) return null;
    const title = party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা');
    return <div className={'unified-taxpayer-workspace__person gift-tax-identity-card gift-tax-identity-card--'+party}
      data-testid={'gift-added-'+party}>
      <div className="unified-taxpayer-workspace__person-main gift-tax-identity-card__row">
        <span className="unified-taxpayer-workspace__avatar" aria-hidden="true">
          {party === 'donor' ? t('D', 'দ') : t('R', 'গ')}
        </span>
        <div className="unified-taxpayer-workspace__person-copy gift-tax-identity-card__copy">
          <strong>{value.name}</strong>
          <small>{maskTinForDisplay(value.tin)}</small>
          {party === 'donee' && committedDoneeChoice && <span className="gift-tax-identity-card__relationship">{beneficiaryFinalTagLabel(committedDoneeClass.tag || null, committedDoneeClass.relationship || null, language, committedDoneeOther) ?? doneeClassLabel}</span>}
        </div>
        {removable && <button type="button" className="unified-taxpayer-workspace__remove gift-tax-identity-card__remove"
          aria-label={t('Remove ', 'সরান: ') + title} title={t('Remove from this payment', 'এই পেমেন্ট থেকে সরান')}
          onClick={() => removeParty(party)}><Trash2 size={17} aria-hidden="true" /></button>}
      </div>
    </div>;
  };
  const identityRole = (party: Party) => <section className={'gift-tax-role-group gift-tax-role-group--'+party}
    data-testid={'gift-rail-'+party}>
    <h3 className="gift-tax-role-group__title">{party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা')}</h3>
    {added[party] ? partyDisplay(party,true)
      : <p className="gift-tax-role-group__empty">{party === 'donor' ? t('No donor added yet', 'এখনো দাতা যোগ করা হয়নি') : t('No donee added yet', 'এখনো গ্রহীতা যোগ করা হয়নি')}</p>}
  </section>;
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
      {confirmed && !editing[party] ? <div className="gift-tax-confirmed-person" data-testid={'gift-confirmed-' + party}>
        <p className="gift-tax-added-hint" role="status">{t('Already added to this payment. See the ', 'এই পেমেন্টে যোগ করা হয়েছে। ডান পাশের ')}{title}{t(' card on the right.', ' কার্ড দেখুন।')}</p>
        <button type="button" className={secondaryClass} onClick={() => beginEdit(party)}>
          {t('Edit ', 'সম্পাদনা করুন: ') + title}
        </button>
      </div> : <>
        {editing[party] && <div className="gift-tax-editing-notice" role="status">
          <span>{t('Current selection stays in this payment until a replacement is added.',
            'নতুন ব্যক্তি যোগ না করা পর্যন্ত বর্তমান নির্বাচন এই পেমেন্টে থাকবে।')}</span>
          <button type="button" className={secondaryClass} onClick={() => cancelEdit(party)}>
            {t('Cancel editing', 'সম্পাদনা বাতিল')}
          </button>
        </div>}
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
              testId={'gift-' + party + '-result'}
              {...(party === 'donor' ? {onAdd: () => addParty(party), canAdd: true, addLabel: t('Add Donor', 'দাতা যোগ করুন')} : {})} />
            {party === 'donee' && <div className="mt-3 space-y-2" data-testid="gift-donee-classification">
              <label htmlFor="gift-donee-relationship" className="gift-tax-field-label">
                {t('Tag / Relationship', 'ট্যাগ / সম্পর্ক')} *
              </label>
              <SearchableSelect id="gift-donee-relationship" required viewportPortal
                ariaLabel={t('Donee Tag / Relationship', 'গ্রহীতার ট্যাগ / সম্পর্ক')}
                value={doneeChoice} onChange={value => {setDoneeChoice(value);setDoneeOther('');setLookupError(current => ({...current,donee:''}));}}
                options={doneeOptions} placeholder={t('Select a tag or relationship', 'ট্যাগ বা সম্পর্ক নির্বাচন করুন')}
                searchPlaceholder={t('Search relationships', 'সম্পর্ক খুঁজুন')} />
              {doneeChoice === 'others' && <div>
                <label htmlFor="gift-donee-other" className="gift-tax-field-label">{t('Specify relationship', 'সম্পর্ক লিখুন')} *</label>
                <input id="gift-donee-other" className={inputClass} maxLength={80} value={doneeOther}
                  required aria-invalid={doneeOther.trim().length === 0}
                  onChange={event => {setDoneeOther(event.target.value);setLookupError(current => ({...current,donee:''}));}} />
              </div>}
              <button type="button" className="gift-tax-action gift-tax-action--primary gift-tax-add-donee" disabled={!doneeClassValid}
                onClick={() => addParty('donee')}>{t('Add Donee', 'গ্রহীতা যোগ করুন')}</button>
            </div>}
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
  return <><TaxPayModal title={step === 4 ? t('Payment Result', 'পেমেন্টের ফলাফল') : t('Gift Tax', 'দানকর')}
    ariaLabel={t('Gift Tax', 'দানকর')} service="gift" className="gift-tax-dialog taxpay-v5-locked"
    progress={step === 4 ? undefined : {current: step, total: 3, label: t('Steps', 'ধাপ'),
      subtitle: t('Walk-in Payment', 'ওয়াক-ইন পেমেন্ট'),
      accessibilityLabel: t('Payment progress', 'পেমেন্টের অগ্রগতি'),
      accessibilityValueText: t(`Step ${step} of 3`, `৩ ধাপের ${step === 1 ? '১' : step === 2 ? '২' : '৩'} নম্বর ধাপ`)}}
    closeIconLabel={t('Close Gift Tax', 'দানকর বন্ধ করুন')}
    onClose={requestClose}
    onBack={step === 1 ? onBack : () => {
      if(step===4){setStep(3);setCheckoutOpen(false)}
      else if(step===3&&checkoutOpen)setCheckoutOpen(false);
      else setStep(step===3?2:1);
    }}
    backLabel={step === 1 ? t('Back to Other tax payments', 'অন্যান্য কর পরিশোধে ফিরুন') : t('Back to previous Gift Tax screen', 'আগের দানকর স্ক্রিনে ফিরুন')}
    hideFooter={step === 4}
    footer={<div className="payment-flow-embedded__footer-actions">
      {step === 1 ? <button type="button" className="tax-service-choice__continue"
        disabled={!bothAdded} onClick={continueToDetails}>
        {t('Continue to Gift & Tax Information', 'দান ও করের তথ্যে এগিয়ে যান')}
        <ArrowRight size={18} aria-hidden="true" />
      </button> : step === 2 ? <button type="button" className="tax-service-choice__continue"
        onClick={continueToPreview}>
        {t('Continue to Final Preview', 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান')}
        <ArrowRight size={18} aria-hidden="true" />
      </button> : step === 3 ? <button type="button" className="tax-service-choice__continue"
        onClick={() => {
          if(!checkoutOpen && (estimatedTax??0)>0){setCheckoutOpen(true);setFormError('');return;}
          void attemptSimulatedPayment();
        }} disabled={paymentBusy || (checkoutOpen && (estimatedTax??0)>0 && (!paymentChannel || !paymentMethod || !paymentAcknowledged))}
        aria-busy={paymentBusy}>
        {estimatedTax === 0 ? t('Finish no-tax review','করবিহীন পর্যালোচনা শেষ করুন')
          : checkoutOpen ? t('Simulate payment','পেমেন্ট সিমুলেশন করুন')
          : t('Confirm & Pay','নিশ্চিত করুন ও পরিশোধ করুন')}
        <ArrowRight size={18} aria-hidden="true" />
      </button> : null}
    </div>}>
    {step === 1 && workspace('gift-tax-entry-form',
      <>{partyLookup('donor')}{partyLookup('donee')}</>,
      <SelectedIdentityRail prefix="unified-taxpayer-workspace"
        className="gift-tax-aside payment-form-summary" testId="gift-tax-identity-rail"
        label={t('Donor & Donee in this Payment', 'এই পেমেন্টের দাতা ও গ্রহীতা')}
        count={selectedCount} countTestId="gift-tax-selected-count" announceCount
        emptyLabel={t('No donor or donee added', 'কোনো দাতা বা গ্রহীতা যোগ করা হয়নি')}>
        {selectedCount > 0 && <div className="gift-tax-rail-roles">
          {identityRole('donor')}{identityRole('donee')}
        </div>}
        {lastRemoved && <button type="button" className="gift-tax-undo"
          onClick={undoRemoval} data-testid="gift-tax-undo">
          {t('Undo removal of ', 'ফিরিয়ে আনুন: ')}
          {lastRemoved.party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা')}
        </button>}
      </SelectedIdentityRail>
    )}
    {step === 2 && workspace('gift-tax-details-form',
      <>
        <div className="gift-tax-details-intro"><h2 className="unified-taxpayer-workspace__heading">{t('Gift & tax information', 'দান ও করের তথ্য')}</h2>
          <p className="unified-taxpayer-workspace__subheading">{t('Enter and review the details of the gift.', 'দানের বিবরণ লিখুন ও যাচাই করুন।')}</p></div>
        <div className="gift-tax-details-grid">
          <div><label htmlFor="gift-tax-amount" className="gift-tax-field-label">{t('Gift amount (৳)', 'দানের পরিমাণ (৳)')} *</label>
            <input id="gift-tax-amount" className={inputClass} inputMode="decimal" autoComplete="off" placeholder="2500000"
              value={giftAmount} required aria-invalid={invalidGiftField === 'amount'}
              aria-describedby={invalidGiftField === 'amount' ? 'gift-tax-amount-error' : undefined}
              onChange={event => {setGiftAmount(event.target.value);setFormError('');setInvalidGiftField(null);}} />
            {invalidGiftField === 'amount' && <p id="gift-tax-amount-error" role="alert"
              className="unified-taxpayer-workspace__error">{formError}</p>}</div>
          <div><label htmlFor="gift-tax-date" className="gift-tax-field-label">{t('Date of gift', 'দানের তারিখ')} *</label>
            <input id="gift-tax-date" className={inputClass} type="date" max={localToday()}
              value={dateOfGift} required aria-invalid={invalidGiftField === 'date'}
              aria-describedby={invalidGiftField === 'date' ? 'gift-tax-date-error' : undefined}
              onChange={event => {setDateOfGift(event.target.value);setFormError('');setInvalidGiftField(null);}} />
            {invalidGiftField === 'date' && <p id="gift-tax-date-error" role="alert"
              className="unified-taxpayer-workspace__error">{formError}</p>}</div>
          <div className="gift-tax-details-grid__full"><label htmlFor="gift-tax-description" className="gift-tax-field-label">{t('Gift description', 'দানের বিবরণ')}</label>
            <input id="gift-tax-description" className={inputClass} maxLength={500} value={description}
              onChange={event => setDescription(event.target.value)} placeholder={t('Enter gift details', 'দানের বিবরণ লিখুন')} /></div>
          <div className="gift-tax-details-grid__full"><label htmlFor="gift-tax-remarks" className="gift-tax-field-label">{t('Remarks', 'মন্তব্য')}</label>
            <textarea id="gift-tax-remarks" className={inputClass} rows={2} value={remarks}
              onChange={event => setRemarks(event.target.value)} placeholder={t('Optional challan remarks', 'ঐচ্ছিক চালান মন্তব্য')} /></div>
        </div>
        {formError && !invalidGiftField && <p role="alert" className="unified-taxpayer-workspace__error">{formError}</p>}
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
          {added.donee && line(t('Tag / Relationship', 'ট্যাগ / সম্পর্ক'), doneeClassLabel)}
        </dl>
      </aside>
    )}
    {step === 3 && checkoutOpen && workspace('gift-tax-checkout',
      <section className="payment-review payment-review--unified-v5 unified-v5-payment-channel gift-tax-checkout">
        <div className="payment-review__main"><section className="payment-review__panel">
          <div className="payment-review__section-title"><div>
            <h2>{t('Choose payment channel','পেমেন্ট মাধ্যম বেছে নিন')}</h2>
            <p>{t('Use the existing simulated payment methods. No real money is charged.','বিদ্যমান সিমুলেটেড পেমেন্ট মাধ্যম ব্যবহার করুন। প্রকৃত অর্থ কাটা হবে না।')}</p>
          </div></div>
          <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={paymentMethodGroup}
            method={paymentMethod}
            onChannelChange={(channel,method)=>{setPaymentChannel(channel);setPaymentMethod(method);setPaymentMethodGroup(null);setPaymentAcknowledged(false);}}
            onGroupChange={group=>{setPaymentMethodGroup(group);setPaymentMethod(null);setPaymentAcknowledged(false);}}
            onMethodChange={method=>{setPaymentMethod(method);setPaymentAcknowledged(false);}}
            simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline}/>
          {paymentChannel && paymentMethod && <label className="payment-review__ack">
            <input type="checkbox" checked={paymentAcknowledged} onChange={event=>setPaymentAcknowledged(event.target.checked)}/>
            <span>{t('I have checked the donor, donee, gift details and estimated tax. This is a simulation, not an official payment.','দাতা, গ্রহীতা, দানের বিবরণ ও আনুমানিক কর যাচাই করেছি। এটি সিমুলেশন, সরকারি পেমেন্ট নয়।')}</span>
          </label>}
          {formError && <p className="unified-taxpayer-workspace__error" role="alert">{formError}</p>}
        </section></div>
      </section>,
      <aside className="unified-taxpayer-workspace__rail gift-tax-aside payment-form-summary">
        <h3 className="unified-taxpayer-workspace__rail-title"><ReceiptText size={17} aria-hidden="true"/>{t('Payment summary','পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Estimated Gift Tax','আনুমানিক দানকর')}</p>
        <p className="payment-form-summary__total">{'৳ '+number(estimatedTax??0)}</p>
        <p className="payment-form-summary__amount-words">{amountInTakaWords(estimatedTax,language)??'—'}</p>
      </aside>
    )}
    {step === 3 && !checkoutOpen && workspace('gift-tax-review',
      <>
        <section className="payment-review payment-review--unified-v5 gift-tax-preview" aria-labelledby="gift-tax-review-heading">
          <div className="payment-review__main">
            <section className="payment-review__panel unified-v3-review" data-testid="unified-v3-gift-payment-details">
              <div className="payment-review__section-title unified-v3-review__heading">
                <h2 id="gift-tax-review-heading">{t('Final payment details','চূড়ান্ত পেমেন্টের বিবরণ')}</h2>
                <div className="unified-v3-review__actions">
                  <button type="button" onClick={() => setStep(1)}><Pencil size={14} aria-hidden="true"/>{t('Edit donor / donee','দাতা / গ্রহীতা সম্পাদনা')}</button>
                  <button type="button" onClick={() => setStep(2)}><Pencil size={14} aria-hidden="true"/>{t('Edit gift information','দানের তথ্য সম্পাদনা')}</button>
                </div>
              </div>
              <div className="unified-v3-review__table-wrap">
                <table className="unified-v3-review__table gift-tax-preview-table" aria-label={t('Gift Tax payment information','দানকরের পেমেন্ট তথ্য')}>
                  <thead><tr><th>{t('Information','তথ্য')}</th><th>{t('Details','বিবরণ')}</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">{t('Donor','দাতা')}</th><td>{added.donor?.name??'—'}</td></tr>
                    <tr><th scope="row">{t('Donee','গ্রহীতা')}</th><td>{added.donee?.name??'—'}</td></tr>
                    <tr><th scope="row">{t('Tag / Relationship','ট্যাগ / সম্পর্ক')}</th><td>{doneeClassLabel}</td></tr>
                    <tr><th scope="row">{t('Gift amount','দানের পরিমাণ')}</th><td>{parsedAmount===null?'—':'৳ '+number(parsedAmount)}</td></tr>
                    <tr><th scope="row">{t('Gift description','দানের বিবরণ')}</th><td>{description||'—'}</td></tr>
                    <tr><th scope="row">{t('Date of gift','দানের তারিখ')}</th><td>{dateOfGift}</td></tr>
                    {remarks&&<tr><th scope="row">{t('Remarks','মন্তব্য')}</th><td>{remarks}</td></tr>}
                    <tr className="unified-v3-review__owner"><th scope="row">{t('Through — challan column 2','মাধ্যম — চালানের ২য় কলাম')}</th><td>{added.donee?.name??'—'}</td></tr>
                    <tr><th scope="row">{t('On Behalf Of — challan column 3','যার পক্ষে — চালানের ৩য় কলাম')}</th><td>{added.donor?.name??'—'}</td></tr>
                    <tr><th scope="row">{t('Tax liability belongs to','কর দায় যাঁর')}</th><td>{added.donor?.name??'—'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="unified-v5-review-total">
                <div className="unified-v5-review-total__row"><strong>{t('Estimated Gift Tax','আনুমানিক দানকর')}</strong><output>{estimatedTax===null?'—':'৳ '+number(estimatedTax)}</output></div>
                <p>{amountInTakaWords(estimatedTax,language)??'—'}</p>
              </div>
            </section>
          </div>
        </section>
        <button type="button" className={secondaryClass} onClick={requestClose}>{t('Close preview','পর্যালোচনা বন্ধ করুন')}</button>
        <p role="status" className="gift-tax-preview-notice" data-testid="gift-tax-review-complete">
          {t('Simulation only. No money was charged, and no official challan or donor credit has been created.','শুধু সিমুলেশন। কোনো টাকা কাটা হয়নি এবং সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হয়নি।')}
        </p>
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
    {step === 4 && paymentInput && paymentOutcome && workspace('gift-tax-result-workspace',
      <GiftTaxPaymentResult language={language} input={paymentInput} outcome={paymentOutcome}
        onBack={() => {setCheckoutOpen(false);setStep(3);}} onRetry={() => {setCheckoutOpen(true);setStep(3);setPaymentAcknowledged(false);}} />,
      <aside className="unified-taxpayer-workspace__rail gift-tax-aside payment-form-summary">
        <h3 className="unified-taxpayer-workspace__rail-title"><ReceiptText size={17} aria-hidden="true"/>{t('Payment summary', 'পেমেন্ট সারসংক্ষেপ')}</h3>
        <p className="payment-form-summary__eyebrow">{t('Gift Tax total', 'দানকরের মোট')}</p>
        <p className="payment-form-summary__total">{'৳ ' + number(estimatedTax ?? 0)}</p>
        <dl className="gift-tax-summary-lines payment-form-summary__rows">
          {line(t('Donor', 'দাতা'), added.donor?.name ?? '—')}
          {line(t('Donor TIN', 'দাতার টিআইএন'), maskTinForDisplay(added.donor?.tin))}
          {line(t('Donee', 'গ্রহীতা'), added.donee?.name ?? '—')}
          {line(t('Tag / Relationship', 'ট্যাগ / সম্পর্ক'), doneeClassLabel)}
        </dl>
      </aside>
    )}
  </TaxPayModal>
    {exitPromptOpen && <WalkInDiscardConfirmation language={language} onKeepEditing={() => setExitPromptOpen(false)} onDiscard={onClose} />}
  </>;
}
