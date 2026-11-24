import React, {useLayoutEffect, useState} from 'react';
import {ArrowRight, ReceiptText, Search, Trash2} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {WalkInDiscardConfirmation} from '../ui/WalkInDiscardConfirmation';
import {GiftTaxPaymentResult} from './GiftTaxPaymentResult';
import {simulateGiftTaxPayment, type GiftTaxPaymentInput, type GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {persistGiftTaxSimulation,readPendingGiftTax} from '../../services/giftTaxSimulationPersistence';
import type {GiftTaxReuseDraft} from '../../services/paymentReuse';
import {PaymentMethodSelector,type PaymentChannel,type PaymentMethodGroup,type PaymentMethod} from '../ui/PaymentMethodSelector';
import {Pencil} from 'lucide-react';
import {SearchableSelect} from '../ui/SearchableSelect';
import {beneficiaryChoiceParts} from '../../services/beneficiaryClassificationChoice';
import {BENEFICIARY_RELATIONS,beneficiaryTagLabel,beneficiaryFinalTagLabel,validBeneficiaryClassification} from '../../services/beneficiaryTags';
import {SelectedIdentityRail} from '../ui/SelectedIdentityRail';
import {TaxpayerTinLookup, TaxpayerTinSearchResultCard} from '../ui/TaxpayerTinLookup';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
import {maskTinForDisplay} from '../../services/tinDisplay';
import {isOptionalReceiptEmailValid} from '../../services/receiptEmail';
import {amountInTakaWords} from '../../services/amountInWords';
import {estimateGiftTax, parseGiftValue} from '../../services/giftTaxEstimate';
import {validGiftDate} from '../../services/giftTaxDate';
import '../../styles/taxpay-unified-v3.css';
// Gift Tax can open directly from signed-in navigation, without the public chooser.
// Load the service-owned grid/control styles on every entry path.
import '../../styles/other-tax-modal.css';

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
export function GiftTaxEntryModal({onClose, onBack, signedIn = false, initialReuse}: {onClose: () => void; onBack?: () => void; signedIn?: boolean;initialReuse?:GiftTaxReuseDraft}) {
  const {language, navigate} = useTaxState();
  const bn = language === 'bn';
  const t = (en: string, bd: string) => bn ? bd : en;
  const [recovered] = useState(()=>signedIn?readPendingGiftTax():null);
  // An unresolved original submission always takes precedence over a new copy.
  const initialGift=signedIn&&!recovered?initialReuse?.giftDetails:undefined;
  const initialChoice=initialGift?(initialGift.donee.tag==='friends_family'?'friends_family:'+initialGift.donee.relationship:initialGift.donee.tag):'';
  const localizedPerson=(person:Person):Person=>{
    const found=lookupSampleTaxpayer(person.tin);
    return {tin:person.tin,name:found?(bn?found.nameBn:found.nameEn):person.name};
  };
  const [step, setStep] = useState<1 | 2 | 3 | 4>(recovered?4:1);
  const [tinInput, setTinInput] = useState<Record<Party, string>>({donor: initialGift?.donor.tin??'',donee:initialGift?.donee.tin??''});
  const [searched, setSearched] = useState<PartyMap>(emptyParties);
  const [added, setAdded] = useState<PartyMap>(()=>initialGift?{donor:localizedPerson(initialGift.donor),donee:localizedPerson(initialGift.donee)}:emptyParties());
  const [lookupError, setLookupError] = useState<Record<Party, string>>({donor: '', donee: ''});
  const [giftAmount, setGiftAmount] = useState(initialGift?String(initialGift.giftAmountMinor/100):'');
  const [description, setDescription] = useState(initialGift?.description??'');
  const [dateOfGift, setDateOfGift] = useState(initialGift?.giftDate??'');
  const [remarks, setRemarks] = useState(initialGift?.remarks??'');
  // Same walk-in payer/receipt fields as the approved Taxpayer Final Preview.
  // Signed-out previews remain local; signed-in simulations use the checked SQL path.
  const [payerName, setPayerName] = useState(initialGift?initialReuse?.payerName??'':'');
  const [receiptPhone, setReceiptPhone] = useState(initialGift?initialReuse?.phone??'':'');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [noticeReference, setNoticeReference] = useState('');
  const [payerTin, setPayerTin] = useState('');
  const [payerLookup, setPayerLookup] = useState<Person | null>(null);
  const [payerError, setPayerError] = useState<'name'|'phone'|'email'|'tin'|null>(null);
  const [formError, setFormError] = useState('');
  const [invalidGiftField, setInvalidGiftField] = useState<'amount' | 'date' | null>(null);
  const [doneeChoice, setDoneeChoice] = useState(initialChoice);
  const [doneeOther, setDoneeOther] = useState(initialGift?.donee.otherLabel??'');
  // Candidate identity/relationship is distinct from the selected, committed payment details.
  const [committedDoneeChoice, setCommittedDoneeChoice] = useState(initialChoice);
  const [committedDoneeOther, setCommittedDoneeOther] = useState(initialGift?.donee.otherLabel??'');
  const [editing, setEditing] = useState<Record<Party, boolean>>({donor: false, donee: false});
  const [lastRemoved, setLastRemoved] = useState<{
    party: Party; person: Person; doneeChoice: string; doneeOther: string;
  } | null>(null);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [paymentInput, setPaymentInput] = useState<GiftTaxPaymentInput | null>(recovered?.input??null);
  const [paymentOutcome, setPaymentOutcome] = useState<GiftTaxPaymentOutcome | null>(recovered?{kind:'SIMULATED_SYNC_PENDING',reference:'SIM-GIFT-'+recovered.input.idempotencyKey,method:recovered.method}:null);
  const [paymentAttemptKey, setPaymentAttemptKey] = useState<string | null>(recovered?.input.idempotencyKey??null);
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
  const requestClose = () => {
    if(paymentBusy)return;
    if(paymentOutcome?.kind==='SIMULATED_SYNC_PENDING'&&readPendingGiftTax()){onClose();return;}
    setExitPromptOpen(true);
  };
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
  // Complete the EXISTING sample bank journey without suggesting Treasury settlement:
  // this only advances a browser-local simulation using its unchanged SIM reference.
  const continueSimulatedBankPayment = async () => {
    if (!paymentInput || paymentOutcome?.kind!=='SIMULATED_PENDING' || paymentBusy) return;
    setPaymentBusy(true);
    try{setPaymentOutcome(signedIn?await persistGiftTaxSimulation(paymentInput,'BANK_BRANCH'):{kind:'SIMULATED_SUCCESS',reference:paymentOutcome.reference,method:'BANK_BRANCH',createdAt:new Date().toISOString()});}
    finally{setPaymentBusy(false);}
  };
  const retryGiftSync=async()=>{
    if(!paymentInput||paymentOutcome?.kind!=='SIMULATED_SYNC_PENDING'||paymentBusy)return;
    setPaymentBusy(true);
    try{setPaymentOutcome(await persistGiftTaxSimulation(paymentInput,paymentOutcome.method));}
    finally{setPaymentBusy(false);}
  };
  const proceedToApprovedChannel = () => {
    if (estimatedTax === 0) {void attemptSimulatedPayment();return;}
    if (payerName.trim().length < 2) {
      setPayerError('name');document.getElementById('gift-review-payer-name')?.focus();return;
    }
    if (!/^01[3-9]\d{8}$/.test(receiptPhone)) {
      setPayerError('phone');document.getElementById('gift-review-phone')?.focus();return;
    }
    if (!isOptionalReceiptEmailValid(receiptEmail)) {
      setPayerError('email');document.getElementById('gift-review-email')?.focus();return;
    }
    if (payerTin && !/^\d{12,13}$/.test(payerTin)) {
      setPayerError('tin');document.getElementById('gift-review-payer-tin')?.focus();return;
    }
    setPayerError(null);setFormError('');setCheckoutOpen(true);
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
      payer: {name:payerName.trim(),phone:receiptPhone,email:receiptEmail.trim(),
        noticeReference:noticeReference.trim(),tin:payerTin},
    };
    setPaymentInput(nextInput);
    if(taxMinor>0 && (!paymentChannel || !paymentMethod || !paymentAcknowledged)) {
      setFormError(t('Choose a payment channel and confirm the simulation details.', 'পেমেন্ট মাধ্যম বেছে নিয়ে সিমুলেশনের তথ্য নিশ্চিত করুন।'));
      setCheckoutOpen(true);return;
    }
    setPaymentBusy(true);
    try {
      const nextOutcome=simulateGiftTaxPayment(nextInput,paymentMethod??'SIMULATED',simulateDecline);
      setPaymentOutcome(signedIn&&nextOutcome.kind==='SIMULATED_SUCCESS'
        ?await persistGiftTaxSimulation(nextInput,nextOutcome.method):nextOutcome);
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
    <div className="gift-tax-role-group__header">
      <h3 className="gift-tax-role-group__title">{party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা')}</h3>
      <span className="gift-tax-role-group__status">{added[party] ? t('Added', 'যোগ হয়েছে') : t('Pending', 'অপেক্ষমাণ')}</span>
    </div>
    {added[party] ? partyDisplay(party,true)
      : <p className="gift-tax-role-group__empty">{party === 'donor' ? t('No donor added yet', 'এখনো দাতা যোগ করা হয়নি') : t('No donee added yet', 'এখনো গ্রহীতা যোগ করা হয়নি')}</p>}
  </section>;
  const partyLookup = (party: Party) => {
    const confirmed = added[party];
    const match = searched[party];
    const title = party === 'donor' ? t('Donor', 'দাতা') : t('Donee', 'গ্রহীতা');
    return <section className="gift-tax-person-section" data-testid={'gift-' + party + '-section'}>
      <h2 className="unified-taxpayer-workspace__heading">
        {confirmed && !editing[party]
          ? (party === 'donor' ? t('Donor added', 'দাতা যোগ হয়েছে') : t('Donee added', 'গ্রহীতা যোগ হয়েছে'))
          : editing[party]
            ? (party === 'donor' ? t('Edit donor', 'দাতা সম্পাদনা') : t('Edit donee', 'গ্রহীতা সম্পাদনা'))
            : (party === 'donor' ? t('Add donor', 'দাতা যোগ করুন') : t('Add donee', 'গ্রহীতা যোগ করুন'))}
      </h2>
      {(!confirmed || editing[party]) && <p className="unified-taxpayer-workspace__subheading">
        {editing[party]
          ? t('Search for a replacement, or cancel to keep the current person.', 'নতুন ব্যক্তি খুঁজুন, অথবা আগের ব্যক্তিকে রাখতে বাতিল করুন।')
          : t('Enter a TIN and search.', 'টিআইএন লিখে অনুসন্ধান করুন।')}
      </p>}
      {confirmed && !editing[party] ? <div className="gift-tax-confirmed-person" data-testid={'gift-confirmed-' + party}>
        <div className="gift-tax-confirmed-person__content">
          <p className="gift-tax-added-hint" role="status">
            {t('Already added. See the ', 'যোগ করা হয়েছে। ডান পাশের ')}{title}{t(' card in the payment summary.', ' কার্ডে তথ্য দেখুন।')}
          </p>
          <button type="button" className={secondaryClass} onClick={() => beginEdit(party)}>
            {t('Edit ', 'সম্পাদনা করুন: ') + title}
          </button>
        </div>
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
            {party === 'donee' && <div className="gift-tax-donee-completion" data-testid="gift-donee-classification">
              <label htmlFor="gift-donee-relationship" className="gift-tax-field-label">
                {t('Tag / Relationship', 'ট্যাগ / সম্পর্ক')} *
              </label>
              <SearchableSelect id="gift-donee-relationship" required viewportPortal
                ariaLabel={t('Donee Tag / Relationship', 'গ্রহীতার ট্যাগ / সম্পর্ক')}
                value={doneeChoice} onChange={value => {setDoneeChoice(value);setDoneeOther('');setLookupError(current => ({...current,donee:''}));}}
                options={doneeOptions} placeholder={t('Select a tag or relationship', 'ট্যাগ বা সম্পর্ক নির্বাচন করুন')}
                searchPlaceholder={t('Search relationships', 'সম্পর্ক খুঁজুন')}
                className="gift-tax-relationship-trigger" />
              {doneeChoice === 'others' && <div>
                <label htmlFor="gift-donee-other" className="gift-tax-field-label">{t('Specify relationship', 'সম্পর্ক লিখুন')} *</label>
                <input id="gift-donee-other" className={inputClass} maxLength={80} value={doneeOther}
                  required aria-invalid={doneeOther.trim().length === 0}
                  onChange={event => {setDoneeOther(event.target.value);setLookupError(current => ({...current,donee:''}));}} />
              </div>}
              <div className="gift-tax-donee-completion__footer">
                <p className="gift-tax-donee-completion__helper" role="status" data-testid="gift-donee-next-step">
                  {doneeClassValid
                    ? t('Relationship selected. Add this person to your payment.', 'সম্পর্ক নির্বাচন হয়েছে। এই ব্যক্তিকে পেমেন্টে যোগ করুন।')
                    : doneeChoice === 'others'
                      ? t('Enter the relationship above to continue.', 'এগোতে উপরে সম্পর্ক লিখুন।')
                      : t('Select a relationship above to enable Add Donee.', 'গ্রহীতা যোগ করতে উপরে সম্পর্ক নির্বাচন করুন।')}
                </p>
                <button type="button" className="gift-tax-action gift-tax-action--primary gift-tax-add-donee" disabled={!doneeClassValid}
                  onClick={() => addParty('donee')}>{t('Add Donee', 'গ্রহীতা যোগ করুন')}<ArrowRight size={16} aria-hidden="true" /></button>
              </div>
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
  return <><TaxPayModal title={step === 4 ? t('Payment result','পেমেন্টের ফলাফল')
    : step === 3 ? (checkoutOpen ? t('Payment channel','পেমেন্ট চ্যানেল')
      : t('Final Preview','চূড়ান্ত পর্যালোচনা')) : t('Gift Tax','দানকর')}
    ariaLabel={t('Gift Tax', 'দানকর')} service="gift"
    className={'gift-tax-dialog taxpay-v5-locked' + (step >= 3 ? ' gift-tax-approved-stage' : '') + (step === 4 ? ' gift-tax-result-stage' : '')}
    progress={step === 4 || (step === 3 && checkoutOpen) ? undefined : {current: step, total: 3, label: t('Steps', 'ধাপ'),
      subtitle: signedIn ? t('Gift Tax', 'দানকর') : t('Walk-in Payment', 'ওয়াক-ইন পেমেন্ট'),
      accessibilityLabel: t('Payment progress', 'পেমেন্টের অগ্রগতি'),
      accessibilityValueText: t(`Step ${step} of 3`, `৩ ধাপের ${step === 1 ? '১' : step === 2 ? '২' : '৩'} নম্বর ধাপ`)}}
    closeIconLabel={t('Close Gift Tax', 'দানকর বন্ধ করুন')}
    onClose={requestClose}
    onBack={paymentOutcome?.kind==='SIMULATED_SYNC_PENDING'||paymentBusy?undefined:step === 1 ? onBack : () => {
       if(recovered&&step===4){onClose();return;}
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
          if(!checkoutOpen){proceedToApprovedChannel();return;}
          void attemptSimulatedPayment();
        }} disabled={paymentBusy || (checkoutOpen && (estimatedTax??0)>0 && (!paymentChannel || !paymentMethod || !paymentAcknowledged))}
        aria-busy={paymentBusy}>
        {estimatedTax === 0 ? t('Finish no-tax review','করবিহীন পর্যালোচনা শেষ করুন')
          : checkoutOpen ? t('Confirm sample payment','নমুনা পেমেন্ট নিশ্চিত করুন')
          : t('Make Payment','পেমেন্ট করুন')}
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

    {step === 3 && checkoutOpen && <div className="payment-flow-embedded--unified gift-tax-approved-flow gift-tax-checkout"
      data-testid="gift-tax-checkout">
      <section className="payment-review payment-review--unified-v5 unified-v5-payment-channel"
        aria-labelledby="gift-approved-channel-heading">
        <div className="payment-review__main">
          <section className="payment-review__panel">
            <div className="payment-review__section-title"><div>
              <h2 id="gift-approved-channel-heading">{t('Choose payment channel','পেমেন্ট চ্যানেল বেছে নিন')}</h2>
              <p>{t('Choose online payment or a bank branch','অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন')}</p>
            </div></div>
            <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={paymentMethodGroup}
              method={paymentMethod}
              onChannelChange={(channel,method)=>{setPaymentChannel(channel);setPaymentMethod(method);setPaymentMethodGroup(null);setPaymentAcknowledged(false);}}
              onGroupChange={group=>{setPaymentMethodGroup(group);setPaymentMethod(null);setPaymentAcknowledged(false);}}
              onMethodChange={method=>{setPaymentMethod(method);setPaymentAcknowledged(false);}}
              simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline}/>
            {paymentChannel && paymentMethod && <label className="payment-review__ack">
              <input type="checkbox" checked={paymentAcknowledged}
                onChange={event=>setPaymentAcknowledged(event.target.checked)} />
              <span>{t('I have checked the donor, donee, gift details and estimated tax. This is a sample, not an official payment.',
                'দাতা, গ্রহীতা, দানের তথ্য ও আনুমানিক কর যাচাই করেছি। এটি নমুনা, সরকারি পেমেন্ট নয়।')}</span>
            </label>}
            <p className="gift-tax-preview-notice" role="note">
              {t('SIMULATION ONLY — no funds, official challan or donor credit are generated.',
                'শুধু সিমুলেশন — অর্থ, সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হবে না।')}
            </p>
            {formError && <p className="unified-taxpayer-workspace__error" role="alert">{formError}</p>}
          </section>
        </div>
      </section>
    </div>}
    {step === 3 && !checkoutOpen && <div className="payment-flow-embedded--unified gift-tax-approved-flow gift-tax-preview"
      data-testid="gift-tax-review">
      <section className="payment-review payment-review--unified-v5"
        aria-labelledby="gift-tax-review-heading">
        <div className="payment-review__main">
          <section className="payment-review__panel unified-v3-review"
            data-testid="unified-v3-gift-payment-details">
            <div className="payment-review__section-title unified-v3-review__heading">
              <h2 id="gift-tax-review-heading">{t('Payment details','পেমেন্টের বিবরণ')}</h2>
              <div className="unified-v3-review__actions">
                <button type="button" onClick={()=>setStep(1)}>
                  <Pencil size={14} aria-hidden="true"/>{t('Donor / Donee','দাতা / গ্রহীতা')}
                </button>
                <button type="button" aria-label={t('Edit gift information','দানের তথ্য সম্পাদনা')} onClick={()=>setStep(2)}>
                  <Pencil size={14} aria-hidden="true"/>{t('Gift & amount','দান ও পরিমাণ')}
                </button>
              </div>
            </div>
            <div className="unified-v3-review__table-wrap">
              <table className="unified-v3-review__table gift-tax-approved-table"
                aria-label={t('Gift Tax payment details','দানকরের পেমেন্টের বিবরণ')}>
                <thead><tr>
                  <th>{t('Donor / Donee / Payment head','দাতা / গ্রহীতা / পেমেন্ট খাত')}</th>
                  <th>{t('Date of gift','দানের তারিখ')}</th>
                  <th>{t('Amount','পরিমাণ')}</th>
                </tr></thead>
                <tbody>
                  <tr className="unified-v3-review__owner"><td colSpan={3}>
                    <strong>{added.donor?.name} · {t('Donor (tax-liable)','দাতা (করদায়ী)')}</strong>
                    <span>{maskTinForDisplay(added.donor?.tin)}</span>
                  </td></tr>
                  <tr><td>{t('Gift Tax — estimated only','দানকর — শুধু আনুমানিক')}</td>
                    <td>{dateOfGift}</td>
                    <td>{'৳ '+number(estimatedTax??0)}</td></tr>
                  <tr className="unified-v3-review__owner"><td colSpan={3}>
                    <strong>{added.donee?.name} · {t('Donee','গ্রহীতা')}</strong>
                    <span>{maskTinForDisplay(added.donee?.tin)} · {doneeClassLabel}</span>
                  </td></tr>
                  <tr><td>{t('Gift amount','দানের পরিমাণ')}</td><td>{dateOfGift}</td>
                    <td>{'৳ '+number(parsedAmount??0)}</td></tr>
                </tbody>
              </table>
            </div>
            <dl className="gift-tax-approved-extra">
              {line(t('Gift description','দানের বিবরণ'),description||'—')}
              {line(t('Through — challan column 2','মাধ্যম — চালানের ২য় কলাম'),added.donee?.name??'—')}
              {line(t('On Behalf Of — challan column 3','যার পক্ষে — চালানের ৩য় কলাম'),added.donor?.name??'—')}
              {line(t('Tax liability belongs to','কর দায় যাঁর'),added.donor?.name??'—')}
              {line(t('Tag / Relationship','ট্যাগ / সম্পর্ক'),doneeClassLabel)}
            </dl>
            <div className="unified-v5-review-total">
              <div className="unified-v5-review-total__row">
                <strong>{t('Estimated Gift Tax total','আনুমানিক দানকরের মোট')}</strong>
                <output>{'৳ '+number(estimatedTax??0)}</output>
              </div>
              <p>{amountInTakaWords(estimatedTax,language)??'—'}</p>
            </div>
          </section>
          <section className="payment-review__panel payment-review__payer"
            aria-labelledby="gift-approved-payer-title">
            <div className="payment-review__section-title">
              <div><h2 id="gift-approved-payer-title">
                {t('Payer and receipt details','পরিশোধকারী ও রসিদের তথ্য')}</h2></div>
            </div>
            <p className="unified-v5-payer-hint">
              {t('Payer information will appear on the sample receipt.',
                'পরিশোধকারীর তথ্য নমুনা রসিদে দেখানো হবে।')}</p>
            <div className="payment-identity__fields">
              <div className="payment-identity__receipt-row">
                <div>
                  <label htmlFor="gift-review-payer-name">{t('Your name (payer)','আপনার নাম (পরিশোধকারী)')} *</label>
                  <input id="gift-review-payer-name" className="gift-tax-field-control"
                    autoComplete="name" required placeholder={t('Your full name','আপনার পূর্ণ নাম')}
                    value={payerName} aria-invalid={payerError==='name'}
                    onChange={e=>{setPayerName(e.target.value);setPayerError(null)}}/>
                  {payerError==='name'&&<p role="alert">{t('Enter a name of at least two characters.','অন্তত দুই অক্ষরের নাম লিখুন।')}</p>}
                </div>
                <div>
                  <label htmlFor="gift-review-phone">{t('Mobile number for receipt','রসিদের জন্য মোবাইল নম্বর')} *</label>
                  <input id="gift-review-phone" className="gift-tax-field-control"
                    type="tel" inputMode="numeric" autoComplete="tel-national"
                    placeholder="01XXXXXXXXX" maxLength={11} required
                    value={receiptPhone} aria-invalid={payerError==='phone'}
                    onChange={e=>{setReceiptPhone(e.target.value.replace(/\D/g,'').slice(0,11));setPayerError(null)}}/>
                  {payerError==='phone'&&<p role="alert">{t('Enter a valid Bangladeshi mobile number.','সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।')}</p>}
                </div>
                <div>
                  <label htmlFor="gift-review-email">{t('Email address (optional)','ইমেইল ঠিকানা (ঐচ্ছিক)')}</label>
                  <input id="gift-review-email" type="email" className="gift-tax-field-control"
                    autoComplete="email" maxLength={254} placeholder="name@example.com"
                    value={receiptEmail} aria-invalid={payerError==='email'}
                    onChange={e=>{setReceiptEmail(e.target.value);setPayerError(null)}}/>
                  {payerError==='email'&&<p role="alert">{t('Enter a valid email or leave blank.','সঠিক ইমেইল দিন অথবা খালি রাখুন।')}</p>}
                </div>
                <div>
                  <label htmlFor="gift-review-reference">{t('NBR notice or payment reference (optional)',
                    'NBR নোটিশ বা পেমেন্ট রেফারেন্স (ঐচ্ছিক)')}</label>
                  <input id="gift-review-reference" className="gift-tax-field-control"
                    placeholder="PN-2026-000392" maxLength={160}
                    value={noticeReference} onChange={e=>setNoticeReference(e.target.value)}/>
                </div>
              </div>
              <div className="gift-tax-payer-tin" data-testid="gift-tax-payer-tin">
                <TaxpayerTinLookup language={language} directDigitEdit
                  tinId="gift-review-payer-tin" nameId="gift-review-payer-lookup-name"
                  tin={payerTin} name={payerLookup?.name??''}
                  onTinChange={value=>{setPayerTin(value);setPayerLookup(null);setPayerError(null)}}
                  onSearch={()=>{const found=lookupSampleTaxpayer(payerTin);
                    setPayerLookup(found?{tin:payerTin,name:bn?found.nameBn:found.nameEn}:null);}}
                  onClear={()=>{setPayerTin('');setPayerLookup(null);setPayerError(null)}}
                  omitNameField maxTinLength={13}
                  canSearch={/^\d{12,13}$/.test(payerTin)}
                  tinLabel={t('Payer TIN (optional)','পরিশোধকারীর টিআইএন (ঐচ্ছিক)')}
                  searchLabel={t('Search payer TIN','পরিশোধকারীর টিআইএন খুঁজুন')}
                  tinPlaceholder={t('12- or 13-digit TIN','১২ বা ১৩ সংখ্যার টিআইএন')}
                  invalidTin={payerError==='tin'}/>
                {payerLookup&&<p className="gift-tax-lookup-notice">
                  {payerLookup.name} · {t('Sample lookup only, not verified ownership.',
                    'শুধু নমুনা অনুসন্ধান, মালিকানা যাচাই নয়।')}</p>}
                {payerError==='tin'&&<p role="alert">{t('Use 12 or 13 digits, or leave blank.',
                  '১২ বা ১৩ সংখ্যা লিখুন, অথবা খালি রাখুন।')}</p>}
              </div>
            </div>
          </section>
          <section className="unified-v5-remarks-section" data-testid="challan-remarks-field">
            <h3 className="unified-v5-remarks-heading">
              {t('Payment Remarks / Invoice Reference','পেমেন্টের মন্তব্য / ইনভয়েস রেফারেন্স')}
              <small>{t('(Optional)','(ঐচ্ছিক)')}</small>
            </h3>
            <div className="unified-v5-remarks-body">
              <label htmlFor="gift-tax-final-remarks" className="sr-only">{t('Remarks','মন্তব্য')}</label>
              <textarea id="gift-tax-final-remarks" className="gift-tax-field-control"
                rows={4} maxLength={4000} value={remarks}
                onChange={e=>setRemarks(e.target.value)}
                placeholder={t('e.g. Gift document or payment reference','যেমন দানের দলিল বা পেমেন্ট রেফারেন্স')}/>
              <p className="gift-tax-lookup-notice">{t('Maximum 4,000 characters','সর্বোচ্চ ৪,০০০ অক্ষর')}</p>
            </div>
          </section>
          <p role="status" className="gift-tax-preview-notice" data-testid="gift-tax-review-complete">
            {t('Simulation only. No money was charged, and no official challan or donor credit has been created.',
              'শুধু সিমুলেশন। কোনো টাকা কাটা হয়নি এবং সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হয়নি।')}
          </p>
          <button type="button" className="gift-tax-close-preview"
            onClick={requestClose}>{t('Close preview','পর্যালোচনা বন্ধ করুন')}</button>
        </div>
      </section>
    </div>}
    {step === 4 && paymentInput && paymentOutcome && <div
      className="gift-tax-approved-flow gift-tax-result-workspace"
      data-testid="gift-tax-result-workspace">
      <GiftTaxPaymentResult signedIn={signedIn} language={language} input={paymentInput} outcome={paymentOutcome}
        onBack={()=>{if(recovered){onClose();return;}setCheckoutOpen(false);setStep(3);}}
        onRetry={()=>{setCheckoutOpen(true);setStep(3);setPaymentAcknowledged(false);}}
        onContinueBank={continueSimulatedBankPayment}
        onRefresh={retryGiftSync} busy={paymentBusy}
        onLogin={()=>{onClose();navigate('taxpayer_login');}}/>
    </div>}
  </TaxPayModal>
    {exitPromptOpen && <WalkInDiscardConfirmation language={language} onKeepEditing={() => setExitPromptOpen(false)} onDiscard={onClose} />}
  </>;
}
