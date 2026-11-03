import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, CreditCard, FileText, Plus, Trash2 } from 'lucide-react';
import { getStorySessionId, persistSimulatedPayment } from '../../services/simulatedPaymentStory';
import { useTaxState } from '../../services/taxState';
import { TRAVEL_TAX_RATES } from '../../data/mockData';
import {
  LAND_PORT_NAMES, TRAVEL_TAX_ECONOMIC_CODE, TRAVEL_TAX_YEAR,
  makeTravelPassenger, travelPartyTotal, validateTravelParty, assessTravelPassenger,
  type TravelMode, type TravelPassenger, type TravellerNationality,
} from '../../data/travelTax2026';
import { formatCurrency } from '../../services/numberFormat';
import { amountInTakaWords } from '../../services/amountInWords';
import type { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';
import { PaymentFormSection } from '../ui/PaymentFormLayout';
import { PaymentMethodSelector, paymentMethodLabel, type PaymentMethodGroup } from '../ui/PaymentMethodSelector';
import { PaymentJourneyFooter } from '../ui/PaymentJourneyFooter';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';

interface TravelTaxProps {
  embedded?: boolean;
  fourStepJourney?: boolean;
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
}

const PASSPORT_PREVIEW = 'TEST123456';

function maskPassport(passport: string) {
  return passport.length <= 4 ? '••••' : '••••' + passport.slice(-4);
}

/**
 * Four progressive stages in the existing TaxPay modal.
 * This is a UX/reference-data preview, not a real passport verification or
 * government A-Challan integration. An API owner can replace those boundaries.
 */
export const TravelTax: React.FC<TravelTaxProps> = ({ embedded = false, onBackToService, onStageChange }) => {
  const { language, navigate, addPaymentReceipt } = useTaxState();
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [mode, setMode] = useState<TravelMode>('LAND');
  const [port, setPort] = useState('');
  const [waterPort, setWaterPort] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState<TravelPassenger[]>([makeTravelPassenger('first', 'BD')]);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'NOW' | 'OTC' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ChallanReceipt['paymentMethod'] | null>(null);
  const [methodGroup, setMethodGroup] = useState<PaymentMethodGroup | null>(null);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bankSlipPending, setBankSlipPending] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [paymentNonce, setPaymentNonce] = useState(() => crypto.randomUUID());

  useEffect(() => { onStageChange?.((step + 1) as 1 | 2 | 3 | 4); }, [step, onStageChange]);
  // The receipt takes over the wizard. Reset its scroll position when it
  // mounts so the newly created receipt heading remains visible on mobile
  // and desktop, rather than inheriting the payment form's scroll offset.
  useEffect(() => {
    if (!createdReceipt || bankSlipPending) return;
    const modalBody = document.querySelector<HTMLElement>('.taxpay-modal__body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    } else {
      document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [createdReceipt, bankSlipPending]);


  // Preserve the existing simulation-only land and water rates until verified
  // statutory rate and age tables have been approved by the client.
  const selectedRouteIdx = mode === 'LAND' ? 4 : 5;
  const route = TRAVEL_TAX_RATES[selectedRouteIdx];
  const unitRate = route.amount;
  const assessments = passengers.map(passenger => ({ passenger, assessment: assessTravelPassenger(passenger, unitRate, travelDate) }));
  const allCalculated = assessments.every(item => item.assessment !== null);
  const totalAmount = travelPartyTotal(passengers, unitRate, travelDate);
  const amountWords = allCalculated ? amountInTakaWords(totalAmount, language) : '';
  const selectedPort = mode === 'WATER' ? waterPort.trim() : port;
  const canSubmit = allCalculated && totalAmount > 0 && !processing && !!paymentMethod && !!paymentChannel && acknowledged;
  const routeOptions: { value: TravelMode; en: string; bn: string }[] = [
    { value: 'LAND', en: 'By land', bn: 'স্থলপথে' },
    { value: 'WATER', en: 'By water', bn: 'নৌপথে' },
  ];

  const changePassenger = (id: string, patch: Partial<TravelPassenger>) => {
    setPassengers(existing => existing.map(item => item.id === id ? { ...item, ...patch } : item));
    setError('');
    setAcknowledged(false);
  };
  const changePassengerType = (id: string, nationality: TravellerNationality) => {
    changePassenger(id, { nationality, passport: '', name: '', birthDate: '',
      country: nationality === 'BD' ? 'Bangladesh' : '',
      identitySource: nationality === 'BD' ? 'PENDING' : 'MANUAL' });
  };
  const ageExplanation = (age: number) => age <= 5
    ? tr('Age ' + age + ' on travel date: illustrative exemption (age 5 or younger).',
         'ভ্রমণের তারিখে বয়স ' + age + ': নমুনা অব্যাহতি (৫ বছর বা কম)।')
    : age <= 12
    ? tr('Age ' + age + ' on travel date: illustrative half rate (ages 6–12).',
         'ভ্রমণের তারিখে বয়স ' + age + ': নমুনা অর্ধেক হার (৬–১২ বছর)।')
    : tr('Age ' + age + ' on travel date: illustrative full rate (over 12).',
         'ভ্রমণের তারিখে বয়স ' + age + ': নমুনা পূর্ণ হার (১২ বছরের বেশি)।');

  const stepTo = (next: 0 | 1 | 2 | 3) => {
    setError('');
    setStep(next);
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };
  const validateTravelDetails = () => {
    if (!selectedPort) return tr('Select a departure port.', 'যাত্রা শুরুর বন্দর নির্বাচন করুন।');
    if (!destination.trim()) return tr('Select or enter a destination.', 'গন্তব্য নির্বাচন বা লিখুন।');
    if (!travelDate) return tr('Select your travel date.', 'ভ্রমণের তারিখ নির্বাচন করুন।');
    return null;
  };
  const validatePassengers = () => {
    const problem = validateTravelParty(passengers, travelDate);
    if (problem) {
      const translated = problem.includes('same passport')
        ? tr(problem, 'একটি পাসপোর্ট একাধিকবার যোগ করা যাবে না।')
        : problem.includes('Medical')
        ? tr(problem, 'চিকিৎসাজনিত কর অব্যাহতির কাগজপত্র বন্দরে সরাসরি জমা দিতে হবে।')
        : problem.includes('verification')
        ? tr(problem, 'বাংলাদেশি পাসপোর্ট যাচাই API এখনো সংযুক্ত নয়। কেবল নমুনা পরিচয় দিয়ে প্রবাহ পরীক্ষা করা যাবে।')
        : tr(problem, 'প্রত্যেক যাত্রীর নাম ও বৈধ পাসপোর্ট তথ্য দিন।');
      return translated;
    }
    if (!/^01\d{9}$/.test(phone)) return tr('Enter a valid 11-digit receipt mobile number.', 'রসিদের জন্য ১১ সংখ্যার বৈধ মোবাইল নম্বর দিন।');
    return null;
  };
  const continueStep = () => {
    const problem = step === 0
      ? validateTravelParty([passengers[0]], travelDate) ?? validateTravelDetails()
      : validatePassengers();
    if (problem) { setError(problem); return; }
    stepTo(step === 0 ? 1 : 2);
  };
  const reset = () => {
    setStep(0); setMode('LAND'); setPort(''); setWaterPort('');
    setDestination(''); setTravelDate('');
    setPassengers([makeTravelPassenger('first', 'BD')]); setPhone(''); setError('');
    setPaymentChannel(null); setPaymentMethod(null); setMethodGroup(null);
    setSimulateDecline(false); setAcknowledged(false); setBankSlipPending(false);
    setCreatedReceipt(null); setProcessing(false); setPaymentNonce(crypto.randomUUID());
  };

  const paymentReceipt = (pendingBank: boolean): ChallanReceipt => {
    const now = new Date().toISOString();
    const reference = 'SIM-TOKEN-' + paymentNonce;
    return {
      id: 'rcpt-trv-' + paymentNonce,
      taxEventId: 'SIM-EVENT-' + paymentNonce,
      paymentTransactionId: reference,
      challanNo: 'SIM-' + paymentNonce,
      tokenNumber: reference,
      paymentCategory: 'TRAVEL_TAX',
      assessmentYear: TRAVEL_TAX_YEAR,
      payerName: passengers[0].name,
      payerTin: 'NON-TIN-PASSENGER',
      receiptMobile: phone,
      isRepresentativePayment: false,
      taxZone: '',
      taxCircle: '',
      isWithholding: false,
      travelDetails: {
        mode, departurePort: selectedPort,
        destination: destination.trim(), travelDate,
        economicCode: TRAVEL_TAX_ECONOMIC_CODE,
        passengers: passengers.map(item => {
          const assessment = assessTravelPassenger(item, unitRate, travelDate);
          return { name: item.name.trim(), passportMasked: maskPassport(item.passport),
            nationality: item.nationality, country: item.country,
            ageBand: assessment?.ageBand ?? 'ADULT', age: assessment?.age,
            amount: assessment?.amount ?? 0 };
        }),
      },
      items: passengers.map((item, idx) => {
        const assessment = assessTravelPassenger(item, unitRate, travelDate);
        const amount = assessment?.amount ?? 0;
        return {
          headId: 155 + idx, economicCode: TRAVEL_TAX_ECONOMIC_CODE,
          headNameEn: 'Travel tax — ' + item.name.trim(),
          taxAmount: amount, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0,
          totalAmount: amount,
          note: mode + ' | ' + selectedPort + ' | ' + destination + ' | ' + travelDate +
            ' | age ' + (assessment?.age ?? 'unavailable') + ' | Passport ' + maskPassport(item.passport),
        };
      }),
      totalAmount,
      paymentMethod: paymentMethod ?? 'SIMULATED',
      gatewayTransactionId: 'SIM-TXN-' + paymentNonce,
      treasuryStatus: pendingBank ? 'INITIATED' : 'GATEWAY_SUCCESS',
      taxCreditStatus: 'NOT_APPLICABLE',
      createdAt: now,
      completedAt: pendingBank ? undefined : now,
      isSimulatedDemo: true,
    };
  };

  const persistPreview = async (receipt: ChallanReceipt) => {
    // Records are explicitly simulated: no real A-Challan is issued.
    let stored = receipt;
    if (import.meta.env.VITE_SUPABASE_DISABLED !== 'true') {
      const ack = await persistSimulatedPayment({
        idempotencyKey: paymentNonce,
        sessionId: getStorySessionId(),
        service: 'TRAVEL_TAX',
        amountMinor: Math.round(totalAmount * 100),
        details: {
          payerName: passengers[0].name.trim(),
          assessmentYear: TRAVEL_TAX_YEAR,
          paymentMethod, paymentChannel,
          receiptReference: receipt.tokenNumber, receiptMobile: phone,
          travelMode: mode, departurePort: selectedPort,
          destination: destination.trim(), travelDate,
          economicCode: TRAVEL_TAX_ECONOMIC_CODE,
          passengers: receipt.travelDetails?.passengers,
          lines: receipt.items, receiptSnapshot: receipt,
        },
      });
      stored = { ...receipt, paymentTransactionId: ack.id };
    }
    addPaymentReceipt(stored);
    setCreatedReceipt(stored);
    setPaymentNonce(crypto.randomUUID());
    setBankSlipPending(false);
    stepTo(3);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step !== 2 || processing) return;
    const problem = validateTravelDetails() ?? validatePassengers();
    if (problem) { setError(problem); return; }
    if (!paymentMethod || !paymentChannel || !acknowledged) {
      setError(tr('Choose a payment method and confirm the details.', 'পেমেন্ট পদ্ধতি বেছে নিয়ে তথ্য নিশ্চিত করুন।'));
      return;
    }
    if (totalAmount <= 0) {
      setError(tr('No tax is payable for this passenger group.', 'এই যাত্রীদের জন্য কর প্রদেয় নেই।'));
      return;
    }
    setError(''); setProcessing(true);
    try {
      if (paymentChannel === 'NOW' && simulateDecline) {
        setError(tr('Payment preview declined. Try again.', 'পেমেন্ট পরীক্ষাটি প্রত্যাখ্যাত হয়েছে। আবার চেষ্টা করুন।'));
      } else if (paymentChannel === 'OTC') {
        setCreatedReceipt(paymentReceipt(true));
        setBankSlipPending(true);
        stepTo(3);
      } else {
        await persistPreview(paymentReceipt(false));
      }
    } catch {
      setError(tr('Simulated payment could not be recorded. Retry with the same details.', 'নমুনা পেমেন্ট রেকর্ড করা যায়নি। একই তথ্য দিয়ে আবার চেষ্টা করুন।'));
    } finally { setProcessing(false); }
  };

  const settleBankSlip = async () => {
    if (!bankSlipPending || !createdReceipt || processing) return;
    setProcessing(true);
    try {
      await persistPreview({ ...createdReceipt, treasuryStatus: 'GATEWAY_SUCCESS', completedAt: new Date().toISOString() });
    } catch {
      setError(tr('Simulated bank settlement could not be recorded. Retry.', 'নমুনা ব্যাংক নিষ্পত্তি রেকর্ড হয়নি। আবার চেষ্টা করুন।'));
    } finally { setProcessing(false); }
  };


  /** Each passenger uses a type tab; fields from the other type never appear. */
  const renderPassengerEditor = (item: TravelPassenger, index: number) => {
    const panelId = 'travel-passenger-panel-' + item.id;
    const assessment = assessTravelPassenger(item, unitRate, travelDate);
    return <>
      <div className="travel-flow__passenger-tabs" role="tablist"
        aria-label={tr('Passenger type for passenger ', 'যাত্রীর ধরন, যাত্রী ') + (index + 1)}>
        {([
          ['BD', tr('Bangladeshi passenger','বাংলাদেশি যাত্রী')],
          ['FOREIGN', tr('Foreign passenger','বিদেশি যাত্রী')]
        ] as const).map(([nationality, label]) =>
          <button key={nationality} type="button" role="tab"
            id={'travel-passenger-tab-' + item.id + '-' + nationality}
            aria-controls={panelId} aria-selected={item.nationality === nationality}
            tabIndex={item.nationality === nationality ? 0 : -1}
            className={'travel-flow__passenger-tab' + (item.nationality === nationality ? ' travel-flow__passenger-tab--active' : '')}
            onClick={() => item.nationality !== nationality && changePassengerType(item.id, nationality)}>
            {label}
          </button>)}
      </div>
      <div id={panelId} role="tabpanel"
        aria-labelledby={'travel-passenger-tab-' + item.id + '-' + item.nationality}
        className="travel-flow__passenger-panel">
        <div className="travel-flow__fields">
          <div className="travel-flow__field">
            <label htmlFor={'travel-passport-' + item.id}>{tr('Passport number','পাসপোর্ট নম্বর')} *</label>
            <input id={'travel-passport-' + item.id} value={item.passport} maxLength={20} autoComplete="off"
              onChange={event => changePassenger(item.id, {
                passport: event.target.value.toUpperCase().replace(/\s+/g, ''),
                ...(item.nationality === 'BD' ? {name: '', birthDate: '', identitySource: 'PENDING' as const} : {}),
              })} placeholder={tr('Enter passport number','পাসপোর্ট নম্বর লিখুন')}/>
          </div>
          {item.nationality === 'BD' ? <>
            <div className="travel-flow__field travel-flow__passport-action">
              <label htmlFor={'travel-lookup-' + item.id}>{tr('Passport details','পাসপোর্টের তথ্য')}</label>
              <button id={'travel-lookup-' + item.id} type="button" onClick={() => {
                if (item.passport !== PASSPORT_PREVIEW) {
                  setError(tr('Government passport lookup is not connected. Use TEST123456 for a clearly marked sample.',
                    'সরকারি পাসপোর্ট তথ্য অনুসন্ধান সংযুক্ত নয়। নমুনা হিসেবে TEST123456 ব্যবহার করুন।'));
                } else {
                  changePassenger(item.id, {
                    name: 'SAMPLE BANGLADESHI PASSENGER', birthDate: '1992-04-18',
                    country: 'Bangladesh', identitySource: 'PASSPORT_SAMPLE'
                  });
                }
              }}>{tr('Retrieve passport details (sample)','পাসপোর্টের নমুনা তথ্য আনুন')}</button>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-name-' + item.id}>{tr('Passenger name (from passport)','যাত্রীর নাম (পাসপোর্ট থেকে)')}</label>
              <input id={'travel-name-' + item.id} value={item.name} readOnly
                placeholder={tr('Filled after lookup','অনুসন্ধানের পরে পূরণ হবে')}/>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-birth-date-' + item.id}>{tr('Date of birth (from passport)','জন্মতারিখ (পাসপোর্ট থেকে)')}</label>
              <input id={'travel-birth-date-' + item.id} type="date" value={item.birthDate} readOnly/>
            </div>
          </> : <>
            <div className="travel-flow__field">
              <label htmlFor={'travel-name-' + item.id}>{tr('Passenger name as on passport','পাসপোর্ট অনুযায়ী নাম')} *</label>
              <input id={'travel-name-' + item.id} maxLength={100} value={item.name}
                onChange={event => changePassenger(item.id, {name: event.target.value.toUpperCase()})}
                placeholder={tr('Enter full name','পূর্ণ নাম লিখুন')}/>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-birth-date-' + item.id}>{tr('Date of birth','জন্মতারিখ')} *</label>
              <input id={'travel-birth-date-' + item.id} type="date" value={item.birthDate}
                max={travelDate || undefined} onChange={event => changePassenger(item.id, {birthDate: event.target.value})}/>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-country-' + item.id}>{tr('Country of nationality','জাতীয়তার দেশ')} *</label>
              <input id={'travel-country-' + item.id} maxLength={80} value={item.country}
                onChange={event => changePassenger(item.id, {country: event.target.value})}
                placeholder={tr('Enter country','দেশ লিখুন')}/>
            </div>
          </>}
          <div className="travel-flow__field travel-flow__medical">
            <label htmlFor={'travel-medical-' + item.id}>{tr('Medical exemption','চিকিৎসাজনিত কর অব্যাহতি')}</label>
            <label className="travel-flow__check">
              <input id={'travel-medical-' + item.id} type="checkbox" checked={item.medicalPortReferral}
                onChange={event => changePassenger(item.id, {medicalPortReferral: event.target.checked})}/>
              <p>{tr('Request manual assessment at departure port','বন্দরে সরাসরি কর অব্যাহতির আবেদন করব')}</p>
            </label>
          </div>
        </div>
        {item.nationality === 'BD' && <p className="travel-flow__field-hint" role="status">
          {item.identitySource === 'PASSPORT_SAMPLE'
            ? tr('Sample identity and birth date only — not verified by passport authority.',
                 'পরিচয় ও জন্মতারিখ শুধু নমুনা; পাসপোর্ট কর্তৃপক্ষের যাচাই নয়।')
            : tr('Government passport lookup is pending. For UX review, use TEST123456.',
                 'সরকারি পাসপোর্ট সেবা সংযুক্ত নয়। শুধু UX পরীক্ষায় TEST123456 ব্যবহার করুন।')}
        </p>}
        {item.medicalPortReferral && <p role="status" className="travel-flow__medical-note">
          {tr('Medical exemption is not approved online. Bring supporting documents to the port.',
              'অনলাইনে চিকিৎসাজনিত অব্যাহতি অনুমোদিত নয়। কাগজপত্র বন্দরে আনুন।')}
        </p>}
        {assessment && <p className="travel-flow__age-reason">{ageExplanation(assessment.age)}</p>}
      </div>
    </>;
  };

  const primaryAction = createdReceipt && bankSlipPending ? (
    <button type="button" className="travel-flow__primary" onClick={settleBankSlip} disabled={processing}>
      <Building2 size={17} aria-hidden="true" />
      {tr('Confirm sample bank settlement', 'নমুনা ব্যাংক নিষ্পত্তি নিশ্চিত করুন')}
    </button>
  ) : createdReceipt ? (
    <button type="button" className="travel-flow__primary" onClick={reset}>
      {tr('Start another payment', 'আরেকটি পেমেন্ট শুরু করুন')}
    </button>
  ) : step === 2 ? (
    <button type="button" className="travel-flow__primary" disabled={!canSubmit} onClick={() => {
      const form = document.getElementById('travel-tax-form');
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }}>
      <FileText size={17} aria-hidden="true"/>
      {processing ? tr('Processing…', 'প্রক্রিয়াধীন…') : tr('Confirm preview payment', 'নমুনা পেমেন্ট নিশ্চিত করুন')}
    </button>
  ) : (
    <button type="button" className="travel-flow__primary" onClick={continueStep}>
      {step === 0 ? tr('Continue to passenger details', 'যাত্রীর তথ্যে এগিয়ে যান') : tr('Continue to review', 'পেমেন্ট পর্যালোচনায় যান')}
      <ArrowRight size={17} aria-hidden="true"/>
    </button>
  );

  // Preserve the shared receipt/modal action owner and full-width receipt.
  if (embedded && createdReceipt && !bankSlipPending) {
    return <ReceiptView receipt={createdReceipt} embedded onNewPayment={reset}/>;
  }

  return (
    <div className={'travel-flow' + (bn ? ' font-bengali' : '')} lang={language} data-step={step}>
      <div className="travel-flow__main">
        {!embedded && <h1 className="travel-flow__standalone-title">{tr('Travel tax', 'ভ্রমণ কর')}</h1>}
        {!embedded && <nav className="travel-flow__steps" aria-label={tr('Travel tax steps', 'ভ্রমণ করের ধাপ')}>
          {[
            tr('Travel details', 'ভ্রমণের তথ্য'), tr('Passengers', 'যাত্রী'),
            tr('Payment', 'পেমেন্ট'), tr('Challan', 'চালান'),
          ].map((name, idx) => (
            <button key={name} type="button" disabled={idx > step || !!createdReceipt}
              className={'travel-flow__step' + (idx === step ? ' travel-flow__step--current' : '')}
              aria-current={idx === step ? 'step' : undefined} onClick={() => stepTo(idx as 0 | 1 | 2 | 3)}>
              <span className="travel-flow__step-count">{idx + 1}</span><p>{name}</p>
            </button>
          ))}
        </nav>}
        <form id="travel-tax-form" onSubmit={submit} noValidate>
          {error && <p className="travel-flow__error" id="travel-tax-error" role="alert">{error}</p>}

          {step === 0 && !createdReceipt && <section className="travel-flow__panel" aria-label={tr('Passenger and travel details','যাত্রী ও ভ্রমণের তথ্য')}>
            <PaymentFormSection number={1} title={tr('Passenger and travel details','যাত্রী ও ভ্রমণের তথ্য')} staticView={embedded}>
              <p className="travel-flow__field-hint">{tr(
                'Select passenger type and enter passport details first. Tax is calculated from date of birth and travel date.',
                'প্রথমে যাত্রীর ধরন ও পাসপোর্টের তথ্য দিন। জন্মতারিখ ও ভ্রমণের তারিখ থেকে কর হিসাব হবে।'
              )}</p>
              {renderPassengerEditor(passengers[0], 0)}
              <div className="travel-flow__field-group">
                <p className="travel-flow__field-title">{tr('Travel mode','যাতায়াতের মাধ্যম')} *</p>
                <fieldset id="travel-tax-route-results" className="travel-flow__routes">
                  <legend className="sr-only">{tr('Travel mode','যাতায়াতের মাধ্যম')}</legend>
                  {routeOptions.map(item => {
                    const index = item.value === 'LAND' ? 0 : 1;
                    return <label key={item.value} htmlFor={'travel-tax-route-' + index}
                      className={'travel-flow__route' + (mode === item.value ? ' travel-flow__route--selected' : '')}>
                      <span className="travel-flow__route-copy">
                        <strong>{bn ? item.bn : item.en}</strong>
                        <span>{bn ? item.en : item.bn}</span>
                      </span>
                      <input id={'travel-tax-route-' + index} name="travel-tax-route" type="radio"
                        checked={mode === item.value} onChange={() => {
                          setMode(item.value); setPort(''); setWaterPort(''); setAcknowledged(false);
                        }}/>
                    </label>;
                  })}
                </fieldset>
              </div>
              <div className="travel-flow__fields travel-flow__field-group">
                {mode === 'LAND' ? <div className="travel-flow__field">
                  <label htmlFor="travel-port">{tr('Departure land port','স্থলবন্দর')} *</label>
                  <select id="travel-port" value={port} onChange={e => setPort(e.target.value)}>
                    <option value="">{tr('Select departure port','বন্দর নির্বাচন করুন')}</option>
                    {LAND_PORT_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <p className="travel-flow__field-hint">{tr('Historical reference ports; current operation must be confirmed.',
                    'ঐতিহাসিক বন্দরের তালিকা; বর্তমান কার্যক্রম যাচাই প্রয়োজন।')}</p>
                </div> : <div className="travel-flow__field">
                  <label htmlFor="travel-water-port">{tr('Departure water port','নৌবন্দর')} *</label>
                  <input id="travel-water-port" value={waterPort} onChange={e => setWaterPort(e.target.value)}
                    placeholder={tr('Enter water port','নৌবন্দর লিখুন')} list="travel-water-port-options"/>
                  <datalist id="travel-water-port-options"><option value="Chattogram"/><option value="Mongla"/><option value="Payra"/></datalist>
                  <p className="travel-flow__field-hint">{tr('Water-port catalogue pending approval.','নৌবন্দরের তালিকা অনুমোদনের অপেক্ষায়।')}</p>
                </div>}
                <div className="travel-flow__field">
                  <label htmlFor="travel-destination">{tr('Destination','গন্তব্য')} *</label>
                  <input id="travel-destination" list="travel-destinations" value={destination}
                    onChange={e => setDestination(e.target.value)} placeholder={tr('Select or enter destination','গন্তব্য নির্বাচন বা লিখুন')}/>
                  <datalist id="travel-destinations"><option value="India"/><option value="Nepal"/><option value="Bhutan"/><option value="Myanmar"/></datalist>
                </div>
                <div className="travel-flow__field">
                  <label htmlFor="travel-departure-date">{tr('Travel date','ভ্রমণের তারিখ')} *</label>
                  <input id="travel-departure-date" type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)}/>
                </div>
              </div>
            </PaymentFormSection>
          </section>}

          {step === 1 && !createdReceipt && <section className="travel-flow__panel" aria-label={tr('Passengers and receipt details','যাত্রী ও রসিদের তথ্য')}>
            <PaymentFormSection number={2} title={tr('Passengers and receipt details','যাত্রী ও রসিদের তথ্য')} staticView={embedded}>
              <div className="travel-flow__party" data-testid="travel-passenger-list">
                <div className="travel-flow__person">
                  <div className="travel-flow__person-header">
                    <h3>{tr('Passenger 1','যাত্রী ১')}</h3>
                    <button className="travel-flow__member-remove" type="button" onClick={() => stepTo(0)}>
                      {tr('Edit details','তথ্য সম্পাদনা')}
                    </button>
                  </div>
                  <p>{passengers[0].name} · {maskPassport(passengers[0].passport)}</p>
                  {assessments[0].assessment && <p className="travel-flow__age-reason">
                    {ageExplanation(assessments[0].assessment.age)}
                  </p>}
                </div>
                {passengers.slice(1).map((item, index) => <div key={item.id} className="travel-flow__person">
                  <div className="travel-flow__person-header">
                    <h3>{tr('Passenger ','যাত্রী ')}{index + 2}</h3>
                    <button type="button" className="travel-flow__member-remove"
                      aria-label={tr('Remove passenger ','যাত্রী বাদ দিন ') + (index + 2)}
                      onClick={() => {
                        setPassengers(existing => existing.filter(p => p.id !== item.id));
                        setAcknowledged(false);
                      }}><Trash2 size={16} aria-hidden="true"/>{tr('Remove','বাদ দিন')}</button>
                  </div>
                  {renderPassengerEditor(item, index + 1)}
                </div>)}
              </div>
              <button type="button" className="travel-flow__add-member" onClick={() =>
                setPassengers(existing => [...existing, makeTravelPassenger(crypto.randomUUID(), 'BD')])}>
                <Plus size={18} aria-hidden="true"/>{tr('Add New Member — family or friend','নতুন সদস্য যোগ করুন — পরিবার বা বন্ধু')}
              </button>
              <div className="travel-flow__fields travel-flow__field-group">
                <div className="travel-flow__field">
                  <label htmlFor="travel-mobile">{tr('Mobile number for receipt','রসিদের জন্য মোবাইল')} *</label>
                  <input id="travel-mobile" type="tel" inputMode="numeric" maxLength={11}
                    value={phone} placeholder="01XXXXXXXXX"
                    onChange={event => setPhone(event.target.value.replace(/\D/g,'').slice(0,11))}/>
                </div>
              </div>
            </PaymentFormSection>
          </section>}

          {step === 2 && !createdReceipt && <section className="travel-flow__panel" aria-label={tr('Review and payment','পর্যালোচনা ও পেমেন্ট')}>
            <header className="travel-flow__section-header">
              <h3>{tr('Review passengers and payment','যাত্রী ও পেমেন্ট যাচাই করুন')}</h3>
              <p>{tr('One application and one combined simulated challan for every passenger.',
                'এক আবেদনে সকল যাত্রীর জন্য একটি সম্মিলিত নমুনা চালান।')}</p>
            </header>
            <div className="travel-flow__review">
              <div><dt>{tr('Travel','ভ্রমণ')}</dt><dd>{mode === 'LAND' ? tr('By land','স্থলপথে') : tr('By water','নৌপথে')}</dd></div>
              <div><dt>{tr('Port / number','বন্দর / নম্বর')}</dt><dd>{selectedPort} / {portNumber}</dd></div>
              <div><dt>{tr('Destination / date','গন্তব্য / তারিখ')}</dt><dd>{destination} / {travelDate}</dd></div>
              <div><dt>{tr('Tax zone / org. code','কর অঞ্চল / প্রাতিষ্ঠানিক কোড')}</dt><dd>{zone?.name} / {taxZoneCode}</dd></div>
              <div><dt>{tr('Economic code','অর্থনৈতিক কোড')}</dt><dd>{TRAVEL_TAX_ECONOMIC_CODE}</dd></div>
            </div>
            <div className="travel-flow__table-wrap">
              <table className="travel-flow__passenger-table" aria-label={tr('Passenger-wise travel tax amounts','যাত্রীভিত্তিক ভ্রমণ কর')}>
                <thead><tr>
                  <th scope="col">{tr('Passenger','যাত্রী')}</th>
                  <th scope="col">{tr('Passport','পাসপোর্ট')}</th>
                  <th scope="col">{tr('Age','বয়স')}</th>
                  <th scope="col">{tr('Tax','কর')}</th>
                </tr></thead>
                <tbody>{passengers.map(item => <tr key={item.id}>
                  <td>{item.name}</td><td>{maskPassport(item.passport)}</td>
                  <td>{item.ageBand}</td>
                  <td>{formatCurrency(travelPassengerAmount(unitRate, item.ageBand), language)}</td>
                </tr>)}</tbody>
                <tfoot><tr><th scope="row" colSpan={3}>{tr('Combined payable','মোট প্রদেয়')}</th>
                  <td>{formatCurrency(totalAmount, language)}</td></tr></tfoot>
              </table>
            </div>
            <header className="travel-flow__section-header">
              <h3>{tr('Payment channel','পেমেন্ট চ্যানেল')}</h3>
              <p>{tr('A-Challan is the required government integration; this environment only records a clearly marked simulation.',
                'সরকারি A-Challan সংযোগ ডেভেলপার পর্যায়ে হবে; এখানে শুধু চিহ্নিত নমুনা লেনদেন রয়েছে।')}</p>
            </header>
            <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
              onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
              onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
              onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
              simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline}/>
            {paymentMethod && <p className="travel-flow__field-hint">{paymentMethodLabel(paymentMethod, language)}</p>}
            <label className="travel-flow__channel-option">
              <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>
              <p>{tr('I confirm the travel information, all passengers and the combined amount.',
                'ভ্রমণের তথ্য, সকল যাত্রী এবং মোট টাকার পরিমাণ নিশ্চিত করছি।')}</p>
            </label>
          </section>}

          {step === 3 && bankSlipPending && createdReceipt && <section className="travel-flow__panel" aria-label={tr('Bank slip','ব্যাংক স্লিপ')}>
            <header className="travel-flow__section-header"><h3>{tr('Sample bank slip pending','নমুনা ব্যাংক স্লিপ অপেক্ষমাণ')}</h3></header>
            <p role="status">{tr('No actual bank or Treasury settlement has occurred. You can finish the sample journey with the button below.',
              'বাস্তব ব্যাংক বা ট্রেজারি নিষ্পত্তি হয়নি। নিচের বোতামে শুধু নমুনা প্রবাহ শেষ হবে।')}</p>
            <dl className="travel-flow__review">
              <div><dt>{tr('Reference','রেফারেন্স')}</dt><dd>{createdReceipt.challanNo}</dd></div>
              <div><dt>{tr('Combined payable','মোট প্রদেয়')}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
            </dl>
          </section>}

          {step === 3 && createdReceipt && !bankSlipPending && !embedded && <ReceiptView receipt={createdReceipt} embedded onBack={() => navigate('landing')}/>}
          {!embedded && !createdReceipt && step > 0 && <button className="travel-flow__back" type="button"
            onClick={() => stepTo((step-1) as 0 | 1 | 2 | 3)}>
            <ArrowLeft size={16} aria-hidden="true"/>{tr('Back','ফিরুন')}
          </button>}
        </form>
      </div>

      <aside className="travel-flow__summary" aria-label={tr('Payment calculation','পেমেন্টের হিসাব')}>
        <div className="travel-flow__summary-title"><CreditCard size={18} aria-hidden="true"/>
          <h3>{tr('Payment calculation','পেমেন্টের হিসাব')}</h3>
        </div>
        <p className="travel-flow__summary-label">{tr('Combined amount · illustrative rates','মোট টাকা · নমুনা হার')}</p>
        <strong className="travel-flow__total travel-flow__total--with-words" data-testid="travel-payment-total">
          {formatCurrency(totalAmount, language)}
        </strong>
        <p className="travel-flow__amount-words" data-testid="travel-total-in-words">{amountWords}</p>
        <dl className="travel-flow__summary-list">
          <div><dt>{tr('Mode','মাধ্যম')}</dt><dd>{mode === 'LAND' ? tr('Land','স্থল') : tr('Water','নৌ')}</dd></div>
          <div><dt>{tr('Passengers','যাত্রী')}</dt><dd>{passengers.length}</dd></div>
          <div><dt>{tr('Base rate','মূল হার')}</dt><dd>{formatCurrency(unitRate,language)}</dd></div>
          <div><dt>{tr('Tax zone','কর অঞ্চল')}</dt><dd>{zone?.name ?? '—'}</dd></div>
          <div><dt>{tr('Economic code','অর্থনৈতিক কোড')}</dt><dd>{TRAVEL_TAX_ECONOMIC_CODE}</dd></div>
          <div><dt>{tr('Status','অবস্থা')}</dt><dd>{createdReceipt ? tr('Sample record','নমুনা রেকর্ড') : tr('Awaiting review','পর্যালোচনার অপেক্ষায়')}</dd></div>
        </dl>
        {!embedded && primaryAction}
      </aside>

      {embedded && modalFooterTarget && createPortal(
        <div className="travel-flow__footer-content">
          <details className="travel-flow__mobile-summary" data-testid="mobile-payment-calculation">
            <summary><p>{tr('Payment calculation','পেমেন্টের হিসাব')}</p>
              <strong>{formatCurrency(totalAmount,language)}</strong></summary>
            <dl>
              <div><dt>{tr('Passengers','যাত্রী')}</dt><dd>{passengers.length}</dd></div>
              <div><dt>{tr('Mode','মাধ্যম')}</dt><dd>{mode === 'LAND' ? tr('Land','স্থল') : tr('Water','নৌ')}</dd></div>
              <div><dt>{tr('Economic code','অর্থনৈতিক কোড')}</dt><dd>{TRAVEL_TAX_ECONOMIC_CODE}</dd></div>
              <div><dt>{tr('Total in words','কথায়')}</dt><dd data-testid="travel-mobile-total-in-words">{amountWords}</dd></div>
            </dl>
          </details>
          <PaymentJourneyFooter className="travel-flow__footer-actions"
            back={!createdReceipt && (step > 0 || onBackToService) && <button type="button" className="tax-service-choice__cancel"
              onClick={step === 0 ? onBackToService : () => stepTo((step-1) as 0 | 1 | 2 | 3)}>
              <ArrowLeft size={16} aria-hidden="true"/>{tr('Back','ফিরুন')}
            </button>}
            next={primaryAction}/>
        </div>, modalFooterTarget)}
    </div>
  );
};
