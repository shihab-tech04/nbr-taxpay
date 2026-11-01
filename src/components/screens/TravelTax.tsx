import React, { useContext, useEffect, useState } from 'react';
import { getStorySessionId, persistSimulatedPayment } from '../../services/simulatedPaymentStory';
import { isOptionalReceiptEmailValid, normaliseReceiptEmail } from '../../services/receiptEmail';
import { createPortal } from 'react-dom';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';
import { 
  Plane, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Building2,
  Calendar,
  CreditCard,
  Search,
  X
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TRAVEL_TAX_RATES } from '../../data/mockData';
import { formatCurrency } from '../../services/numberFormat';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';
import { PaymentFormSection } from '../ui/PaymentFormLayout';
import { PaymentMethodSelector, paymentMethodLabel, type PaymentMethodGroup } from '../ui/PaymentMethodSelector';
import { PaymentJourneyFooter } from '../ui/PaymentJourneyFooter';

const COPY = {
  en: {
    title: 'Travel tax', intro: 'Enter your travel details.',
    destination: 'Destination and travel mode', passenger: 'Passenger name', passengerPlaceholder: 'Example: MOHAMMED RAHMAN', passport: 'Passport number', passportPlaceholder: 'Enter passport number',
    count: 'Outbound passenger count', countHint: 'Exemptions are not calculated.',
    mobile: 'Mobile number (optional)', phonePlaceholder: 'Contact number',
    port: 'Departure port', date: 'Travel date', total: 'Total', perPassenger: 'per passenger',
    run: 'Continue payment', running: 'Processing…',
    complete: 'Travel tax details ready', ref: 'Payment reference', again: 'Start another payment',
    requiredName: 'Enter the passenger name shown on the passport.', requiredPassport: 'Enter a passport number of at least 6 characters.'
  },
  bn: {
    title: 'ভ্রমণ কর', intro: 'যাত্রার তথ্য দিন।',
    destination: 'গন্তব্য ও ভ্রমণের ধরন', passenger: 'যাত্রীর নাম', passengerPlaceholder: 'উদাহরণ: MOHAMMED RAHMAN', passport: 'পাসপোর্ট নম্বর', passportPlaceholder: 'পাসপোর্ট নম্বর লিখুন',
    count: 'বহির্গামী যাত্রীর সংখ্যা', countHint: 'অব্যাহতি হিসাব করা হয় না।',
    mobile: 'মোবাইল নম্বর (ঐচ্ছিক)', phonePlaceholder: 'যোগাযোগ নম্বর',
    port: 'যাত্রা শুরুর বন্দর', date: 'ভ্রমণের তারিখ', total: 'মোট অর্থ', perPassenger: 'প্রতি যাত্রী',
    run: 'পেমেন্টে এগিয়ে যান', running: 'প্রক্রিয়াধীন…',
    complete: 'ভ্রমণ করের তথ্য প্রস্তুত', ref: 'পেমেন্ট রেফারেন্স', again: 'আরেকটি পেমেন্ট শুরু করুন',
    requiredName: 'যাত্রীর নাম লিখুন।', requiredPassport: 'কমপক্ষে ৬ অক্ষরের পাসপোর্ট নম্বর লিখুন।'
  }
} as const;

interface TravelTaxProps {
  embedded?: boolean;
  /** The service-choice modal owns the four-step progress; standalone travel entry keeps its established flow. */
  fourStepJourney?: boolean;
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
}

export const TravelTax: React.FC<TravelTaxProps> = ({embedded=false, fourStepJourney=false, onBackToService, onStageChange}) => {
  const { language, navigate, addPaymentReceipt } = useTaxState();
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const bn = language === 'bn';
  const t = COPY[language];

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [furthestStep, setFurthestStep] = useState<0 | 1 | 2 | 3>(0);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(-1);
  const [routeSearch, setRouteSearch] = useState('');
  const [ageBand, setAgeBand] = useState<'ADULT' | 'CHILD' | 'UNDER5'>('ADULT');
  const [passengerName, setPassengerName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ChallanReceipt['paymentMethod'] | null>(null);
  const [methodGroup, setMethodGroup] = useState<PaymentMethodGroup | null>(null);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [paymentChannel, setPaymentChannel] = useState<'NOW' | 'OTC' | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [bankSlipPending, setBankSlipPending] = useState(false);
  const [paymentNonce,setPaymentNonce]=useState(()=>crypto.randomUUID());

  useEffect(() => {
    if (fourStepJourney) onStageChange?.((step + 1) as 1 | 2 | 3 | 4);
  }, [fourStepJourney, onStageChange, step]);

  const route = TRAVEL_TAX_RATES[selectedRouteIdx];
  const unitRate = route?.amount ?? 0;
  const totalAmount = ageBand === 'UNDER5' ? 0 : ageBand === 'CHILD' ? unitRate / 2 : unitRate;
  const isDomestic = selectedRouteIdx === 3;

  const handlePayTravelTax = (e: React.FormEvent) => {
    e.preventDefault();
    // Submitting a field with Enter must not skip the amount or channel steps.
    if (step !== 2) return;
    if (!route) { setError(bn ? 'যাত্রাপথ নির্বাচন করুন।' : 'Choose a journey.'); return; }
    if (!paymentChannel || !paymentMethod) {
      setError(bn ? 'পেমেন্ট পদ্ধতি নির্বাচন করুন।' : 'Choose a payment method to continue.');
      return;
    }
    if (!acknowledged) {
      setError(bn ? 'ভ্রমণ, যাত্রীর তথ্য ও পরিমাণ নিশ্চিত করুন।' : 'Confirm that the journey, passenger details and amount are correct.');
      return;
    }
    if (passengerName.trim().length < 2) {
      setError(t.requiredName);
      return;
    }
    if (!isDomestic && passportNumber.trim().length < 6) {
      setError(t.requiredPassport);
      return;
    }
    if (!travelDate || !/^01\d{9}$/.test(phone)) {
      setError(workflow.missing);
      return;
    }
    if (!isOptionalReceiptEmailValid(receiptEmail)) {
      setError(bn ? 'সঠিক ইমেইল ঠিকানা দিন অথবা খালি রাখুন।' : 'Enter a valid email address or leave it blank.');
      return;
    }
    if (ageBand === 'UNDER5') {
      setError(bn ? '৫ বছর বা তার কম বয়সী যাত্রী করমুক্ত—পেমেন্টের প্রয়োজন নেই।' : 'Passengers aged 5 or under are exempt. No payment is required.');
      return;
    }
    setError('');
    setIsProcessing(true);

    setTimeout(async () => {
      if (paymentChannel === 'NOW' && simulateDecline) {
        setError(bn ? 'পেমেন্টের অনুরোধ প্রত্যাখ্যাত হয়েছে। আবার চেষ্টা করুন।' : 'Payment request declined. Please try again.');
        setIsProcessing(false);
        return;
      }
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const pendingBank = paymentChannel === 'OTC';
      // Reuse the idempotency nonce so retries keep the same synthetic reference.
      const paymentReference = `SIM-TOKEN-${paymentNonce}`;

      const newReceipt: ChallanReceipt = {
        id: `rcpt-trv-${Date.now()}`,
        taxEventId: `SIM-EVENT-${paymentNonce}`,
        paymentTransactionId: paymentReference,
        challanNo: `SIM-${paymentNonce}`,
        tokenNumber: paymentReference,
        paymentCategory: 'TRAVEL_TAX',
        assessmentYear: '2026-27',
        payerName: `${passengerName} (Passport: ${passportNumber})`,
        payerTin: 'NON-TIN-PASSENGER',
        receiptMobile: phone,
        receiptEmail: normaliseReceiptEmail(receiptEmail),
        isRepresentativePayment: false,
        taxZone: 'Customs & Travel Tax Division, Dhaka',
        taxCircle: 'Circle-Immigration Port',
        isWithholding: false,
        items: [
          {
            headId: 151 + selectedRouteIdx,
            economicCode: `1-1141-0040-070${3 + selectedRouteIdx}`,
            headNameEn: `Foreign Travel Tax - ${route.route}`,
            taxAmount: totalAmount,
            penaltyAmount: 0,
            surchargeAmount: 0,
            interestAmount: 0,
            totalAmount,
            note: `Date: ${travelDate} | Age band: ${ageBand} | Passport: ${isDomestic ? 'Not required' : passportNumber}`
          }
        ],
        totalAmount,
        paymentMethod,
        gatewayTransactionId: `SIM-TXN-${paymentNonce}`,
        treasuryStatus: pendingBank ? 'INITIATED' : 'GATEWAY_SUCCESS',
        taxCreditStatus: 'NOT_APPLICABLE',
        createdAt: now,
        completedAt: pendingBank ? undefined : now,
        isSimulatedDemo: true
      };

      // A bank slip is pending, not a successful payment. The simulated
      // settlement action below is the point where SQL records are written.
      let paymentSaved=pendingBank;
      if (!pendingBank) {
        try {
          let settled = newReceipt;
          if (import.meta.env.VITE_SUPABASE_DISABLED !== 'true') {
            const ack=await persistSimulatedPayment({
              idempotencyKey:paymentNonce,sessionId:getStorySessionId(),
              service:'TRAVEL_TAX',amountMinor:Math.round(totalAmount*100),
              details:{
                payerName:passengerName.trim(),
                assessmentYear:'2026-27',
                paymentMethod,paymentChannel,
                receiptReference:paymentReference,
                receiptMobile:phone,receiptEmail:normaliseReceiptEmail(receiptEmail),
                travelDate,travelRoute:route.route,ageBand,
                passengerName:passengerName.trim(),
                // Stored in both private SQL payment records; the public Office
                // transaction projection exposes only the masked reference.
                passportNumber:isDomestic ? null : passportNumber.trim(),
                lines:newReceipt.items,
                receiptSnapshot:newReceipt,
              }
            });
            settled={...newReceipt,paymentTransactionId:ack.id};
          }
          addPaymentReceipt(settled);
          setCreatedReceipt(settled);
          setPaymentNonce(crypto.randomUUID());
          paymentSaved=true;
        }catch {
          setError(bn?'অফিসে পেমেন্ট তথ্য পৌঁছায়নি। একই অনুরোধ আবার চেষ্টা করুন।':'Office payment synchronization pending. Retry this payment.');
        }
      } else {
        setCreatedReceipt(newReceipt);
        setBankSlipPending(true);
      }
      if (fourStepJourney && paymentSaved) goStep(3);
      setIsProcessing(false);
    }, 1000);
  };


  // Filter the existing rate options, never their underlying identities or prices.
  // Both translations are searched regardless of the current UI language.
  const normalizedRouteSearch = routeSearch.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
  const matchingRoutes = TRAVEL_TAX_RATES
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!normalizedRouteSearch) return true;
      const haystack = `${item.route} ${item.routeBn}`.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');
      return haystack.includes(normalizedRouteSearch);
    });

  const workflow = bn
    ? { steps: ['যাত্রাপথ', 'যাত্রীর তথ্য', 'পর্যালোচনা'], select: 'গন্তব্য ও যাতায়াতের ধরন নির্বাচন',
        passenger: 'যাত্রীর তথ্য', review: 'তথ্য পর্যালোচনা', summary: 'পেমেন্টের হিসাব',
        rate: 'প্রতি যাত্রীর হার', people: 'যাত্রী', route: 'যাত্রাপথ', status: 'অবস্থা',
        continue: 'যাত্রীর তথ্য দিন', reviewNext: 'পর্যালোচনায় যান', back: 'ফিরুন',
        estimate: 'মোট অর্থ', waiting: 'পর্যালোচনার অপেক্ষায়',
        ready: 'রেকর্ড প্রস্তুত', newPreview: 'নতুন পেমেন্ট',
        missing: 'যাত্রীর নাম, মোবাইল নম্বর ও পাসপোর্ট রেফারেন্স দিন।',
        hint: 'যাত্রীর নাম, পাসপোর্ট নম্বর, তারিখ ও রসিদের মোবাইল দিন।' }
    : { steps: ['Travel route', 'Passenger details', 'Review'], select: 'Choose destination & travel mode',
        passenger: 'Passenger information', review: 'Review travel details', summary: 'Payment calculation',
        rate: 'Rate per passenger', people: 'Passengers', route: 'Travel route', status: 'Status',
        continue: 'Continue to passenger details', reviewNext: 'Continue to review', back: 'Back',
        estimate: 'Total amount', waiting: 'Awaiting review',
        ready: 'Record ready', newPreview: 'Start a new payment',
        missing: 'Enter a passenger name, mobile number and passport reference.',
        hint: 'Provide the passenger name, passport number, travel date and receipt mobile.' };

  const goStep = (target: 0 | 1 | 2 | 3) => {
    setError('');
    setStep(target);
    setFurthestStep(previous => Math.max(previous, target) as 0 | 1 | 2 | 3);
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };
  const continueStep = () => {
    if (step === 0 && !fourStepJourney && !route) { setError(bn ? 'যাত্রাপথ নির্বাচন করুন।' : 'Choose a journey.'); return; }
    if (step === 0 && !fourStepJourney) { goStep(1); return; }
    if (fourStepJourney && step === 1) {
      if (!route) { setError(bn ? 'যাত্রাপথ নির্বাচন করুন।' : 'Choose a journey.'); return; }
      if (!isDomestic && passportNumber.trim().length < 6) { setError(t.requiredPassport); return; }
      goStep(2); return;
    }
    if (!passengerName.trim()) { setError(t.requiredName); return; }
    if (!fourStepJourney && !isDomestic && passportNumber.trim().length < 6) { setError(t.requiredPassport); return; }
    if (!travelDate || !/^01\d{9}$/.test(phone)) {
      setError(workflow.missing); return;
    }
    if (!isOptionalReceiptEmailValid(receiptEmail)) {
      setError(bn ? 'সঠিক ইমেইল ঠিকানা দিন অথবা খালি রাখুন।' : 'Enter a valid email address or leave it blank.');
      return;
    }
    goStep(fourStepJourney ? 1 : 2);
  };
  const reset = () => {
    setCreatedReceipt(null); setStep(0); setFurthestStep(0);
    setPassengerName(''); setPassportNumber(''); setPhone(''); setReceiptEmail(''); setTravelDate('');
    setAgeBand('ADULT'); setSelectedRouteIdx(-1); setRouteSearch(''); setError('');
    setPaymentMethod(null);
    setPaymentChannel(null);
    setMethodGroup(null);
    setSimulateDecline(false);
    setAcknowledged(false);
    setBankSlipPending(false);
    setPaymentNonce(crypto.randomUUID());
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };
  const settleBankSlip = async () => {
    if (!createdReceipt || !bankSlipPending || isProcessing) return;
    setIsProcessing(true);
    try {
      const at = new Date().toISOString();
      let receipt: ChallanReceipt = {
        ...createdReceipt,
        treasuryStatus: 'GATEWAY_SUCCESS',
        completedAt: at,
      };
      if (import.meta.env.VITE_SUPABASE_DISABLED !== 'true') {
        const ack=await persistSimulatedPayment({
          idempotencyKey:paymentNonce,sessionId:getStorySessionId(),
          service:'TRAVEL_TAX',amountMinor:Math.round(totalAmount*100),
          details:{payerName:passengerName.trim(),assessmentYear:'2026-27',
            paymentMethod,paymentChannel,receiptReference:receipt.tokenNumber,
            receiptMobile:phone,receiptEmail:normaliseReceiptEmail(receiptEmail),travelDate,travelRoute:route?.route,ageBand,
            passengerName:passengerName.trim(),
            passportNumber:isDomestic ? null : passportNumber.trim(),
            lines:receipt.items,receiptSnapshot:receipt},
        });
        receipt={...receipt,paymentTransactionId:ack.id};
      }
      addPaymentReceipt(receipt);
      setCreatedReceipt(receipt);
      setBankSlipPending(false);
      setPaymentNonce(crypto.randomUUID());
      setError('');
    }catch {setError(bn?'অফিসে পেমেন্ট তথ্য পৌঁছায়নি। একই অনুরোধ আবার চেষ্টা করুন।':'Office payment synchronization pending. Retry this payment.');}
    finally {setIsProcessing(false);}
  };
  // One state-controlled action, rendered in the modal footer (or alongside
  // the summary only on the standalone Travel Tax route).
  const readyToPay = step === 2;
  const primaryAction = !createdReceipt && readyToPay && ageBand === 'UNDER5' ? (
    <button type="button" className="travel-flow__primary" onClick={reset}>
      {bn ? 'অন্য যাত্রীর জন্য শুরু করুন' : 'Start for another passenger'}
    </button>
  ) : bankSlipPending ? (
    <button type="button" className="travel-flow__primary" onClick={settleBankSlip}>
      <Building2 size={17} aria-hidden="true" />{bn ? 'চালিয়ে যান' : 'Continue'}
    </button>
  ) : createdReceipt ? (
    <button type="button" className="travel-flow__primary" onClick={reset}>
      {workflow.newPreview}
    </button>
  ) : readyToPay ? (
    <button key="travel-generate" type="button" className="travel-flow__primary"
      onClick={() => {
        const form = document.getElementById('travel-tax-form');
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }}
      disabled={isProcessing || !paymentChannel || !paymentMethod || !acknowledged} aria-busy={isProcessing}>
      <FileText size={17} aria-hidden="true" />{isProcessing ? t.running : (fourStepJourney ? (bn ? 'পেমেন্ট নিশ্চিত করুন' : 'Confirm payment') : t.run)}
    </button>
  ) : (
    <button key="travel-advance" type="button" className="travel-flow__primary" onClick={continueStep}
      aria-label={fourStepJourney ? (step === 0 ? (bn ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount') : (bn ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel')) : (step === 0 ? workflow.continue : workflow.reviewNext)}>
      <span className="payment-flow-embedded__action-long">{fourStepJourney ? (step === 0 ? (bn ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount') : (bn ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel')) : (step === 0 ? workflow.continue : workflow.reviewNext)}</span>
      <span className="payment-flow-embedded__action-short" aria-hidden="true">{bn ? 'এগিয়ে যান' : 'Continue'}</span><ArrowRight size={17} aria-hidden="true" />
    </button>
  );
  // Once settled, leave the two-column calculation wizard: a receipt is a full-width
  // document with its own single footer action owner, not a form inside a sidebar.
  if (embedded && createdReceipt && !bankSlipPending) {
    return <ReceiptView receipt={createdReceipt} embedded onNewPayment={reset} />;
  }

  return (
    <div className={'travel-flow' + (bn ? ' font-bengali' : '')} lang={language} data-step={step}>
      <div className="travel-flow__main">
        {!embedded && <h1 className="travel-flow__standalone-title">{t.title}</h1>}
        {!fourStepJourney && <nav className="travel-flow__steps" aria-label={bn ? 'ভ্রমণ করের ধাপ' : 'Travel tax steps'}>
          {workflow.steps.map((name, idx) => (
            <button key={name} type="button" disabled={!!createdReceipt || idx > furthestStep}
              aria-current={idx === step ? 'step' : undefined}
              className={'travel-flow__step' + (idx === step ? ' travel-flow__step--current' : '')}
              onClick={() => goStep(idx as 0 | 1 | 2)}>
              <span className="travel-flow__step-count" aria-hidden="true">{idx + 1}</span><span>{name}</span>
            </button>
          ))}
        </nav>}
        <form id="travel-tax-form" onSubmit={handlePayTravelTax} noValidate>
          {error && <p className="travel-flow__error" id="travel-tax-error" role="alert">{error}</p>}
          {((step === 0 && !fourStepJourney) || (step === 1 && fourStepJourney)) && <section className="travel-flow__panel" aria-labelledby="travel-route-heading">
            <PaymentFormSection number={1} title={workflow.select}>
            <header className="travel-flow__section-header">
              <h3 id="travel-route-heading">{workflow.select}</h3>
              <p>{t.intro}</p>
            </header>
            <div className="travel-flow__search">
              <Search size={18} aria-hidden="true" className="travel-flow__search-icon" />
              <label htmlFor="travel-tax-route-search" className="sr-only">
                {bn ? 'গন্তব্য বা যাতায়াতের ধরন খুঁজুন' : 'Search destination or travel mode'}
              </label>
              <input id="travel-tax-route-search" type="search" autoComplete="off"
                value={routeSearch} onChange={event => setRouteSearch(event.target.value)}
                placeholder={bn ? 'গন্তব্য বা যাতায়াতের ধরন খুঁজুন' : 'Search destination or travel mode'}
                aria-controls="travel-tax-route-results" />
              {routeSearch && <button type="button" className="travel-flow__search-clear"
                onClick={() => setRouteSearch('')}
                aria-label={bn ? 'অনুসন্ধান মুছুন' : 'Clear route search'}>
                <X size={17} aria-hidden="true" />
              </button>}
            </div>
            <fieldset id="travel-tax-route-results" className="travel-flow__routes">
              <legend className="sr-only">{t.destination}</legend>
              {matchingRoutes.map(({ item, index: idx }) => (
                <label key={idx} htmlFor={'travel-tax-route-' + idx}
                  className={'travel-flow__route' + (idx === selectedRouteIdx ? ' travel-flow__route--selected' : '')}>
                  <span className="travel-flow__route-copy">
                    <strong>{bn ? item.routeBn : item.route}</strong>
                    {!bn && <span lang="bn">{item.routeBn}</span>}
                  </span>
                  <span className="travel-flow__route-price">
                    <strong>{formatCurrency(item.amount, language)}</strong>
                    <small>{t.perPassenger}</small>
                  </span>
                  <input id={'travel-tax-route-' + idx} type="radio" name="travel-tax-route"
                    checked={idx === selectedRouteIdx} onChange={() => setSelectedRouteIdx(idx)} />
                </label>
              ))}
              {matchingRoutes.length === 0 && (
                <div className="travel-flow__search-empty" role="status">
                  <p>{bn ? 'কোনো যাত্রাপথ পাওয়া যায়নি। অন্য শব্দ লিখুন।' : 'No matching routes. Try another destination or travel mode.'}</p>
                  <button type="button" onClick={() => setRouteSearch('')}>
                    {bn ? 'সব যাত্রাপথ দেখুন' : 'Show all routes'}
                  </button>
                </div>
              )}
            </fieldset>
            </PaymentFormSection>
          </section>}

          {((step === 1 && !fourStepJourney) || (step === 0 && fourStepJourney)) && <section className="travel-flow__panel" aria-labelledby="travel-passenger-heading">
            <PaymentFormSection number={2} title={workflow.passenger} description={workflow.hint}>
            <header className="travel-flow__section-header">
              <h3 id="travel-passenger-heading">{workflow.passenger}</h3>
              <p>{workflow.hint}</p>
            </header>
            <div className={'travel-flow__fields' + ((fourStepJourney || !isDomestic) ? ' travel-flow__fields--five' : '')}>
              <div className="travel-flow__field">
                <label htmlFor="travel-passenger-age">{bn ? 'যাত্রীর বয়স' : 'Passenger age'} *</label>
                <select id="travel-passenger-age" value={ageBand} onChange={event => setAgeBand(event.target.value as typeof ageBand)}>
                  <option value="ADULT">{bn ? '১২ বছরের বেশি — পূর্ণ হার' : 'Over 12 years — full rate'}</option>
                  <option value="CHILD">{bn ? '৫ বছরের বেশি, ১২ বছর পর্যন্ত — অর্ধেক হার' : 'Over 5 through 12 years — half rate'}</option>
                  <option value="UNDER5">{bn ? '৫ বছর বা কম — করমুক্ত' : '5 years or under — exempt'}</option>
                </select>
                {ageBand === 'UNDER5' && <p className="travel-flow__field-hint" role="status">{bn ? 'এই যাত্রীর জন্য ভ্রমণ কর প্রযোজ্য নয়।' : 'Travel tax is not payable for this passenger.'}</p>}
              </div>
              {(fourStepJourney || !isDomestic) && <div className="travel-flow__field">
                <label htmlFor="travel-passport">{t.passport}{!isDomestic && ' *'}</label>
                <input id="travel-passport" type="text" autoComplete="off" value={passportNumber}
                  placeholder={t.passportPlaceholder} aria-describedby={error ? 'travel-tax-error' : undefined}
                  onChange={e => setPassportNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
              </div>}
              <div className="travel-flow__field">
                <label htmlFor="travel-passenger-name">{t.passenger} *</label>
                <input id="travel-passenger-name" type="text" autoComplete="off" value={passengerName}
                  placeholder={t.passengerPlaceholder} aria-describedby={error ? 'travel-tax-error' : undefined}
                  onChange={e => setPassengerName(e.target.value.toUpperCase())} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-mobile">{bn ? 'রসিদের জন্য মোবাইল নম্বর' : 'Mobile number for receipt'} *</label>
                <input id="travel-mobile" type="tel" inputMode="numeric" maxLength={11} autoComplete="off" value={phone}
                  placeholder="01XXXXXXXXX" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-receipt-email">{bn ? 'ইমেইল ঠিকানা (ঐচ্ছিক)' : 'Email address (optional)'}</label>
                <input id="travel-receipt-email" type="email" inputMode="email" autoComplete="email"
                  maxLength={254} placeholder="name@example.com" value={receiptEmail}
                  aria-invalid={!isOptionalReceiptEmailValid(receiptEmail) || undefined}
                  aria-describedby={!isOptionalReceiptEmailValid(receiptEmail) ? 'travel-tax-error' : undefined}
                  onChange={event => setReceiptEmail(event.target.value)} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-departure-date">{t.date} *</label>
                <input id="travel-departure-date" type="date" value={travelDate}
                  onChange={e => setTravelDate(e.target.value)} />
              </div>
            </div>
            </PaymentFormSection>
          </section>}

          {((step === 2 && !fourStepJourney) || (step === 1 && fourStepJourney) || (step === 3 && fourStepJourney)) && <section className="travel-flow__panel" aria-labelledby="travel-review-heading">
            <header className="travel-flow__section-header">
              <h3 id="travel-review-heading">{createdReceipt ? t.complete : workflow.review}</h3>
              {ageBand === 'UNDER5' && !createdReceipt && <p>{bn ? 'এই যাত্রী করমুক্ত — কোনো পেমেন্ট প্রয়োজন নেই।' : 'This passenger is exempt — no payment is required.'}</p>}
            </header>
            {createdReceipt && bankSlipPending ? <div className="travel-flow__receipt" role="status">
              <p className="travel-flow__receipt-label"><Building2 size={18} aria-hidden="true" />{bn ? 'ব্যাংক স্লিপ প্রস্তুত — পরিশোধ নিশ্চিত হয়নি' : 'Bank slip ready — payment not confirmed'}</p>
              <dl className="travel-flow__review">
                <div><dt>{bn ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</dt><dd>{createdReceipt.paymentTransactionId}</dd></div>
                <div><dt>{bn ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</dt><dd>{createdReceipt.challanNo}</dd></div>
                <div><dt>{bn ? 'পরিমাণ' : 'Amount'}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
              </dl>
              <p>{bn ? 'ব্যাংক নিষ্পত্তি সংযুক্ত নেই; পরিশোধ ও কর ক্রেডিট নিশ্চিত হয়নি।' : 'Bank settlement is not connected; payment and tax credit are not confirmed.'}</p>
            </div> : createdReceipt ? <div className="travel-flow__receipt">
              <p className="travel-flow__receipt-label" role="status">
                <CheckCircle size={18} aria-hidden="true" />{workflow.ready} · {t.ref}: {createdReceipt.tokenNumber}
              </p>
              <ReceiptView receipt={createdReceipt} embedded={embedded}
                onBack={() => navigate('landing')} />
            </div> : <dl className="travel-flow__review">
              <div><dt>{workflow.route}</dt><dd>{route ? (bn ? route.routeBn : route.route) : '—'}</dd></div>
              <div><dt>{t.passenger}</dt><dd>{passengerName}</dd></div>
              {!isDomestic && <div><dt>{t.passport}</dt><dd>{passportNumber}</dd></div>}
              <div><dt>{bn ? 'বয়সের ধরন' : 'Age band'}</dt><dd>{ageBand === 'ADULT' ? (bn ? 'পূর্ণ হার' : 'Full rate') : ageBand === 'CHILD' ? (bn ? 'অর্ধেক হার' : 'Half rate') : (bn ? 'করমুক্ত' : 'Exempt')}</dd></div>
              <div><dt>{t.date}</dt><dd>{travelDate}</dd></div>
              {!fourStepJourney && <>
                <div><dt>{bn ? 'রসিদের মোবাইল' : 'Receipt mobile'}</dt><dd>{phone.replace(/\d(?=\d{3})/g, '•')}</dd></div>
                <div><dt>{bn ? 'পরিমাণ' : 'Amount'}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
                <div><dt>{bn ? 'পেমেন্ট পদ্ধতি' : 'Payment method'}</dt><dd>{paymentMethodLabel(paymentMethod, language)}</dd></div>
              </>}
            </dl>}
            {fourStepJourney && step === 1 && <p className="travel-flow__purpose-total">{bn ? 'পরিশোধের খাত: ভ্রমণ কর' : 'Payment purpose: Travel Tax'} · <strong>{formatCurrency(totalAmount, language)}</strong></p>}
          </section>}
          {step === 2 && <section className="travel-flow__panel travel-flow__channel" aria-labelledby="travel-channel-heading">
            <header className="travel-flow__section-header"><h3 id="travel-channel-heading">{bn ? 'পেমেন্ট চ্যানেল বেছে নিন' : 'Choose payment channel'}</h3><p>{bn ? 'পেমেন্টের পদ্ধতি নির্বাচন করুন, তারপর নিশ্চিত করুন।' : 'Select a payment method before confirming.'}</p></header>
            <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
              onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
              onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
              onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
              simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline} />
            {fourStepJourney && <dl className="travel-flow__review" aria-label={bn ? 'পেমেন্ট যাচাই' : 'Payment review'}>
              <div><dt>{bn ? 'যাত্রাপথ' : 'Journey'}</dt><dd>{route ? (bn ? route.routeBn : route.route) : '—'}</dd></div>
              <div><dt>{bn ? 'যাত্রী' : 'Passenger'}</dt><dd>{passengerName}</dd></div>
              {!isDomestic && <div><dt>{bn ? 'পাসপোর্ট নম্বর' : 'Passport number'}</dt><dd>{passportNumber.replace(/.(?=.{3})/g, '•')}</dd></div>}
              <div><dt>{bn ? 'ভ্রমণের তারিখ' : 'Travel date'}</dt><dd>{travelDate}</dd></div>
              <div><dt>{bn ? 'রসিদের মোবাইল' : 'Receipt mobile'}</dt><dd>{phone.replace(/\d(?=\d{3})/g, '•')}</dd></div>
              <div><dt>{bn ? 'পেমেন্ট পদ্ধতি' : 'Payment method'}</dt><dd>{paymentMethodLabel(paymentMethod, language)}</dd></div>
              <div><dt>{bn ? 'চার্জ' : 'Charge'}</dt><dd>{formatCurrency(0, language)}</dd></div>
            </dl>}
            <p className="travel-flow__purpose-total">{bn ? 'সর্বমোট' : 'Total payable'}: <strong>{formatCurrency(totalAmount, language)}</strong></p>
            <label className="travel-flow__channel-option"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{bn ? 'ভ্রমণ, যাত্রীর তথ্য ও পরিমাণ সঠিক।' : 'The journey, passenger details and amount are correct.'}</label>
          </section>}
          {!embedded && !createdReceipt && step > 0 && <button className="travel-flow__back" type="button"
            onClick={() => goStep((step - 1) as 0 | 1 | 2 | 3)}>
            <ArrowLeft size={16} aria-hidden="true" />{workflow.back}
          </button>}
        </form>
      </div>
      <aside className="travel-flow__summary" aria-label={workflow.summary}>
        <div className="travel-flow__summary-title">
          <CreditCard size={18} aria-hidden="true" />
          <h3>{workflow.summary}</h3>
        </div>
        <p className="travel-flow__summary-label">{workflow.estimate}</p>
        <strong className="travel-flow__total">{formatCurrency(totalAmount, language)}</strong>
        <dl className="travel-flow__summary-list">
          <div><dt>{workflow.rate}</dt><dd>{formatCurrency(unitRate, language)}</dd></div>
          <div><dt>{bn ? 'বয়স অনুযায়ী হার' : 'Age rate'}</dt><dd>{ageBand === 'CHILD' ? '50%' : ageBand === 'UNDER5' ? (bn ? 'করমুক্ত' : 'Exempt') : '100%'}</dd></div>
          <div><dt>{workflow.route}</dt><dd>{route ? (bn ? route.routeBn : route.route) : '—'}</dd></div>
          {createdReceipt && <div><dt>{t.ref}</dt><dd>{createdReceipt.tokenNumber}</dd></div>}
          <div><dt>{workflow.status}</dt><dd>{createdReceipt ? workflow.ready : workflow.waiting}</dd></div>
        </dl>
        {!embedded && primaryAction}
      </aside>
      {embedded && modalFooterTarget && createPortal(<PaymentJourneyFooter className="travel-flow__footer-actions"
        back={fourStepJourney && <button type="button" className="tax-service-choice__cancel" onClick={step === 0 || step === 3 ? onBackToService : () => goStep((step - 1) as 0 | 1 | 2 | 3)}><ArrowLeft size={16} aria-hidden="true" />{workflow.back}</button>}
        next={primaryAction} />, modalFooterTarget)}
    </div>
  );
};
