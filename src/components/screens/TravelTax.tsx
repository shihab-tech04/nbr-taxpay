import React, { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';
import { 
  Plane, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Info, 
  Building2,
  Calendar,
  CreditCard,
  Search,
  X
} from 'lucide-react';
import { sampleJourneysEnabled, useTaxState } from '../../services/taxState';
import { TRAVEL_TAX_RATES } from '../../data/mockData';
import { formatCurrency } from '../../services/numberFormat';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';

const COPY = {
  en: {
    title: 'Travel tax', intro: 'Enter your travel details.',
    legalTitle: 'Legal status not verified', legalBody: 'Rates and exemptions are not verified. Check the applicable rules before use.',
    destination: 'Destination and travel mode', passenger: 'Passenger name (as in passport)', passengerPlaceholder: 'Example: MOHAMMED RAHMAN', passport: 'Passport number (synthetic data only)', passportPlaceholder: 'Demo reference only',
    count: 'Outbound passenger count', countHint: 'Exemptions are not calculated.',
    mobile: 'Mobile number (optional; no SMS is sent)', phonePlaceholder: 'Contact number (demo only)',
    port: 'Departure port', date: 'Departure date', total: 'Illustrative total', perPassenger: 'per passenger',
    notice: 'Preview only. No payment or travel clearance is issued.', run: 'Run payment simulation', running: 'Running local simulation…',
    complete: 'Travel tax preview ready.', ref: 'Sample reference', noTravel: 'Not valid for travel or proof of payment.', again: 'Start another demonstration',
    requiredName: 'Enter the passenger name shown on the passport.', requiredPassport: 'Use sample passport details. Passport verification is unavailable.'
  },
  bn: {
    title: 'ভ্রমণ কর', intro: 'যাত্রার তথ্য দিন।',
    legalTitle: 'আইনি বৈধতা যাচাই হয়নি', legalBody: 'হার ও অব্যাহতি যাচাইকৃত নয়। ব্যবহারের আগে প্রযোজ্য নিয়ম যাচাই করুন।',
    destination: 'গন্তব্য ও ভ্রমণের ধরন', passenger: 'পাসপোর্ট অনুযায়ী যাত্রীর নাম', passengerPlaceholder: 'উদাহরণ: MOHAMMED RAHMAN', passport: 'পাসপোর্ট নম্বর (শুধু কৃত্রিম তথ্য)', passportPlaceholder: 'শুধু নমুনা রেফারেন্স',
    count: 'বহির্গামী যাত্রীর সংখ্যা', countHint: 'অব্যাহতি হিসাব করা হয় না।',
    mobile: 'মোবাইল নম্বর (ঐচ্ছিক; এসএমএস পাঠানো হয় না)', phonePlaceholder: 'যোগাযোগ নম্বর (শুধু নমুনা)',
    port: 'যাত্রা শুরুর বন্দর', date: 'যাত্রার তারিখ', total: 'উদাহরণমূলক মোট অর্থ', perPassenger: 'প্রতি যাত্রী',
    notice: 'শুধু প্রিভিউ। কোনো পেমেন্ট বা ভ্রমণ ছাড়পত্র ইস্যু হয় না।', run: 'পেমেন্ট সিমুলেশন চালান', running: 'স্থানীয় সিমুলেশন চলছে…',
    complete: 'ভ্রমণ করের প্রিভিউ প্রস্তুত।', ref: 'নমুনা রেফারেন্স', noTravel: 'ভ্রমণের অনুমতি বা পেমেন্টের প্রমাণ নয়।', again: 'আরেকটি নমুনা শুরু করুন',
    requiredName: 'পাসপোর্টে থাকা যাত্রীর নাম লিখুন।', requiredPassport: 'নমুনা পাসপোর্ট তথ্য দিন। যাচাই ব্যবস্থা চালু নেই।'
  }
} as const;

const DEPARTURE_PORTS = [
  { value: 'Hazrat Shahjalal International Airport (DAC)', en: "Hazrat Shahjalal Int'l Airport, Dhaka (DAC)", bn: 'হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর, ঢাকা (ডিএসি)' },
  { value: 'Shah Amanat International Airport (CGP)', en: "Shah Amanat Int'l Airport, Chattogram (CGP)", bn: 'শাহ আমানত আন্তর্জাতিক বিমানবন্দর, চট্টগ্রাম (সিজিপি)' },
  { value: 'Osmani International Airport (ZYL)', en: "Osmani Int'l Airport, Sylhet (ZYL)", bn: 'ওসমানী আন্তর্জাতিক বিমানবন্দর, সিলেট (জেডওয়াইএল)' },
  { value: 'Benapole Land Port (Jashore)', en: 'Benapole Land Port Checkpost (Jashore)', bn: 'বেনাপোল স্থলবন্দর, যশোর' },
  { value: 'Burimari Land Port (Lalmonirhat)', en: 'Burimari Land Port Checkpost', bn: 'বুড়িমারী স্থলবন্দর, লালমনিরহাট' },
  { value: 'Akhaura Land Port (Brahmanbaria)', en: 'Akhaura Land Port Checkpost', bn: 'আখাউড়া স্থলবন্দর, ব্রাহ্মণবাড়িয়া' },
  { value: 'Chattogram Sea Port', en: 'Chattogram Sea Port', bn: 'চট্টগ্রাম সমুদ্রবন্দর' }
];

export const TravelTax: React.FC<{embedded?:boolean}> = ({embedded=false}) => {
  const { language, navigate, addPaymentReceipt } = useTaxState();
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const bn = language === 'bn';
  const t = COPY[language];

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [furthestStep, setFurthestStep] = useState<0 | 1 | 2>(0);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeSearch, setRouteSearch] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengerName, setPassengerName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [departurePort, setDeparturePort] = useState('Hazrat Shahjalal International Airport (DAC)');
  const [travelDate, setTravelDate] = useState('2026-10-25');
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const route = TRAVEL_TAX_RATES[selectedRouteIdx];
  const unitRate = route.amount;
  const totalAmount = unitRate * passengerCount;

  const handlePayTravelTax = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerName.trim()) {
      setError(t.requiredName);
      return;
    }
    if (!passportNumber.trim()) {
      setError(t.requiredPassport);
      return;
    }
    setError('');
    setIsProcessing(true);

    setTimeout(() => {
      const year = new Date().getFullYear();
      const randChallan = Math.floor(10000000 + Math.random() * 90000000);
      const randToken = Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newReceipt: ChallanReceipt = {
        id: `rcpt-trv-${Date.now()}`,
        challanNo: `PREVIEW-${year}-TRV-${randChallan}`,
        tokenNumber: `PREVIEW-${randToken}`,
        paymentCategory: 'OTHER_TAX_PAYMENT',
        assessmentYear: '2025-2026',
        payerName: `${passengerName} (Passport: ${passportNumber})`,
        payerTin: 'NON-TIN-PASSENGER',
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
            note: `Port: ${departurePort} | Date: ${travelDate} | Pass: ${passportNumber}`
          }
        ],
        totalAmount,
        paymentMethod: 'BKASH',
        gatewayTransactionId: 'SIMULATION-NOT-SENT',
        treasuryScrollNo: undefined,
        treasuryDate: undefined,
        treasuryStatus: 'INITIATED',
        taxCreditStatus: 'NOT_APPLICABLE',
        createdAt: now,
        completedAt: now,
        isSimulatedDemo: true
      };

      if (!embedded) addPaymentReceipt(newReceipt);
      setCreatedReceipt(newReceipt);
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
        passenger: 'যাত্রীর তথ্য', review: 'তথ্য পর্যালোচনা', summary: 'পেমেন্ট সারাংশ',
        rate: 'নমুনা হার', people: 'যাত্রী', route: 'যাত্রাপথ', status: 'অবস্থা',
        continue: 'যাত্রীর তথ্য দিন', reviewNext: 'পর্যালোচনায় যান', back: 'পূর্ববর্তী',
        estimate: 'উদাহরণমূলক মোট অর্থ', sample: 'শুধু প্রিভিউ',
        caution: 'হার ও অব্যাহতি যাচাইকৃত নয়। এটি নমুনা হিসাব, সরকারি পেমেন্ট নয়।',
        ready: 'প্রিভিউ প্রস্তুত', newPreview: 'নতুন প্রিভিউ', noPayment: 'কোনো পেমেন্ট হয়নি',
        missing: 'যাত্রীর নমুনা নাম ও পাসপোর্ট রেফারেন্স দিন।',
        hint: 'প্রকৃত পাসপোর্ট তথ্য দেবেন না। নমুনা তথ্য ব্যবহার করুন।' }
    : { steps: ['Travel route', 'Passenger details', 'Review'], select: 'Choose destination & travel mode',
        passenger: 'Passenger information', review: 'Review travel details', summary: 'Payment summary',
        rate: 'Sample rate', people: 'Passengers', route: 'Travel route', status: 'Status',
        continue: 'Continue to passenger details', reviewNext: 'Continue to review', back: 'Back',
        estimate: 'Illustrative total', sample: 'Preview only',
        caution: 'Rates and exemptions are not verified. This is a sample estimate, not a government payment.',
        ready: 'Preview ready', newPreview: 'Start a new preview', noPayment: 'No payment processed',
        missing: 'Enter a sample passenger name and passport reference.',
        hint: 'Use fictional information, not real passport details.' };

  const goStep = (target: 0 | 1 | 2) => {
    setError('');
    setStep(target);
    setFurthestStep(previous => Math.max(previous, target) as 0 | 1 | 2);
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };
  const continueStep = () => {
    if (step === 0) { goStep(1); return; }
    if (!passengerName.trim()) { setError(t.requiredName); return; }
    if (!passportNumber.trim()) { setError(t.requiredPassport); return; }
    if (passengerCount < 1 || passengerCount > 10 || !travelDate) {
      setError(workflow.missing); return;
    }
    goStep(2);
  };
  const reset = () => {
    setCreatedReceipt(null); setStep(0); setFurthestStep(0);
    setPassengerName(''); setPassportNumber(''); setPhone('');
    setPassengerCount(1); setSelectedRouteIdx(0); setError('');
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };

  if (!sampleJourneysEnabled) {
    return (
      <section className={`travel-flow${bn ? ' font-bengali' : ''}`} lang={language}>
        {!embedded && <h1 className="travel-flow__standalone-title">{t.title}</h1>}
        <div className="travel-flow__main">
          <p>{bn
            ? 'এনবিআরের ভ্রমণ কর লিংক আপনাকে সোনালী ব্যাংকের সংগ্রহ পৃষ্ঠায় নিয়ে যাবে।'
            : "NBR's Travel Tax link opens Sonali Bank's collection page."}</p>
          <a className="travel-flow__primary" href="https://billpay.sonalibank.com.bd/nbrTravelTax/Collection/Create" target="_blank" rel="noopener noreferrer">
            {bn ? 'সোনালী ব্যাংকের ভ্রমণ কর পৃষ্ঠা খুলুন' : 'Open Sonali Bank Travel Tax'}
          </a>
        </div>
      </section>
    );
  }
  // One state-controlled action, rendered in the modal footer (or alongside
  // the summary only on the standalone Travel Tax route).
  const primaryAction = createdReceipt ? (
    <button type="button" className="travel-flow__primary" onClick={reset}>
      {workflow.newPreview}
    </button>
  ) : step === 2 ? (
    <button key="travel-generate" type="button" className="travel-flow__primary"
      onClick={() => {
        const form = document.getElementById('travel-tax-form');
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }}
      disabled={isProcessing} aria-busy={isProcessing}>
      <FileText size={17} aria-hidden="true" />{isProcessing ? t.running : t.run}
    </button>
  ) : (
    <button key="travel-advance" type="button" className="travel-flow__primary" onClick={continueStep}>
      {step === 0 ? workflow.continue : workflow.reviewNext}<ArrowRight size={17} aria-hidden="true" />
    </button>
  );
  return (
    <div className={'travel-flow' + (bn ? ' font-bengali' : '')} lang={language} data-step={step}>
      <div className="travel-flow__main">
        {!embedded && <h1 className="travel-flow__standalone-title">{t.title}</h1>}
        <nav className="travel-flow__steps" aria-label={bn ? 'ভ্রমণ করের ধাপ' : 'Travel tax steps'}>
          {workflow.steps.map((name, idx) => (
            <button key={name} type="button" disabled={!!createdReceipt || idx > furthestStep}
              aria-current={idx === step ? 'step' : undefined}
              className={'travel-flow__step' + (idx === step ? ' travel-flow__step--current' : '')}
              onClick={() => goStep(idx as 0 | 1 | 2)}>
              <span className="travel-flow__step-count" aria-hidden="true">{idx + 1}</span><span>{name}</span>
            </button>
          ))}
        </nav>
        <form id="travel-tax-form" onSubmit={handlePayTravelTax} noValidate>
          {error && <p className="travel-flow__error" id="travel-tax-error" role="alert">{error}</p>}
          {step === 0 && <section className="travel-flow__panel" aria-labelledby="travel-route-heading">
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
          </section>}

          {step === 1 && <section className="travel-flow__panel" aria-labelledby="travel-passenger-heading">
            <header className="travel-flow__section-header">
              <h3 id="travel-passenger-heading">{workflow.passenger}</h3>
              <p>{workflow.hint}</p>
            </header>
            <div className="travel-flow__fields">
              <div className="travel-flow__field">
                <label htmlFor="travel-passenger-name">{t.passenger} *</label>
                <input id="travel-passenger-name" type="text" autoComplete="off" value={passengerName}
                  placeholder={t.passengerPlaceholder} aria-describedby={error ? 'travel-tax-error' : undefined}
                  onChange={e => setPassengerName(e.target.value.toUpperCase())} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-passport">{t.passport} *</label>
                <input id="travel-passport" type="text" autoComplete="off" value={passportNumber}
                  placeholder={t.passportPlaceholder} aria-describedby={error ? 'travel-tax-error' : undefined}
                  onChange={e => setPassportNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-passenger-count">{t.count}</label>
                <input id="travel-passenger-count" type="number" min="1" max="10" value={passengerCount}
                  onChange={e => setPassengerCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
                <p className="travel-flow__field-hint">{t.countHint}</p>
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-mobile">{t.mobile}</label>
                <input id="travel-mobile" type="text" autoComplete="off" value={phone}
                  placeholder={t.phonePlaceholder} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-departure-port">{t.port}</label>
                <select id="travel-departure-port" value={departurePort}
                  onChange={e => setDeparturePort(e.target.value)}>
                  {DEPARTURE_PORTS.map(port => <option key={port.value} value={port.value}>{bn ? port.bn : port.en}</option>)}
                </select>
              </div>
              <div className="travel-flow__field">
                <label htmlFor="travel-departure-date">{t.date}</label>
                <input id="travel-departure-date" type="date" value={travelDate}
                  onChange={e => setTravelDate(e.target.value)} />
              </div>
            </div>
          </section>}

          {step === 2 && <section className="travel-flow__panel" aria-labelledby="travel-review-heading">
            <header className="travel-flow__section-header">
              <h3 id="travel-review-heading">{createdReceipt ? t.complete : workflow.review}</h3>
              <p>{createdReceipt ? t.noTravel : t.notice}</p>
            </header>
            {createdReceipt ? <div className="travel-flow__receipt">
              <p className="travel-flow__receipt-label" role="status">
                <CheckCircle size={18} aria-hidden="true" />{workflow.ready} · {t.ref}: {createdReceipt.tokenNumber}
              </p>
              <ReceiptView receipt={createdReceipt} embedded={embedded}
                onBack={() => navigate('landing')} />
            </div> : <dl className="travel-flow__review">
              <div><dt>{workflow.route}</dt><dd>{bn ? route.routeBn : route.route}</dd></div>
              <div><dt>{t.passenger}</dt><dd>{passengerName}</dd></div>
              <div><dt>{t.passport}</dt><dd>{passportNumber}</dd></div>
              <div><dt>{t.count}</dt><dd>{passengerCount}</dd></div>
              <div><dt>{t.port}</dt><dd>{DEPARTURE_PORTS.find(p => p.value === departurePort)?.[language]}</dd></div>
              <div><dt>{t.date}</dt><dd>{travelDate}</dd></div>
            </dl>}
          </section>}
          {!createdReceipt && step > 0 && <button className="travel-flow__back" type="button"
            onClick={() => goStep((step - 1) as 0 | 1 | 2)}>
            <ArrowRight className="travel-flow__back-icon" size={16} aria-hidden="true" />{workflow.back}
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
          <div><dt>{workflow.people}</dt><dd>{passengerCount}</dd></div>
          <div><dt>{workflow.route}</dt><dd>{bn ? route.routeBn : route.route}</dd></div>
          {createdReceipt && <div><dt>{t.ref}</dt><dd>{createdReceipt.tokenNumber}</dd></div>}
          <div><dt>{workflow.status}</dt><dd>{createdReceipt ? workflow.noPayment : workflow.sample}</dd></div>
        </dl>
        <p className="travel-flow__caution" role="note"><Info size={16} aria-hidden="true" />{workflow.caution}</p>
        {!embedded && primaryAction}
      </aside>
      {embedded && modalFooterTarget && createPortal(primaryAction, modalFooterTarget)}
    </div>
  );
};
