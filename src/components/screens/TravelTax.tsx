import React, { useState } from 'react';
import { 
  Plane, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Info, 
  Building2,
  Calendar,
  CreditCard
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
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
    title: 'ভ্রমণ করের নমুনা', intro: 'শুধু উদাহরণমূলক ফরম। যাত্রীর পরিচয় যাচাই, সরকারি ফি সংগ্রহ, লাইভ গেটওয়ে বা অভিবাসন ছাড়পত্র নেই।',
    legalTitle: 'আইনি বৈধতা যাচাই হয়নি', legalBody: 'এই নমুনার হার সরবরাহ করা রেফারেন্স ধারণা থেকে নেওয়া; বর্তমান আইনের সঙ্গে প্রত্যয়ন করা হয়নি। নির্ভর করার আগে কর্তৃত্বপূর্ণ উৎসে প্রযোজ্য হার ও অব্যাহতি যাচাই করুন।',
    destination: 'গন্তব্য ও ভ্রমণের ধরন', passenger: 'পাসপোর্ট অনুযায়ী যাত্রীর নাম', passengerPlaceholder: 'উদাহরণ: MOHAMMED RAHMAN', passport: 'পাসপোর্ট নম্বর (শুধু কৃত্রিম তথ্য)', passportPlaceholder: 'শুধু নমুনা রেফারেন্স',
    count: 'বহির্গামী যাত্রীর সংখ্যা', countHint: 'এই নমুনায় বয়স নেওয়া বা অব্যাহতি প্রয়োগ করা হয় না।',
    mobile: 'মোবাইল নম্বর (ঐচ্ছিক; এসএমএস পাঠানো হয় না)', phonePlaceholder: 'যোগাযোগ নম্বর (শুধু নমুনা)',
    port: 'যাত্রা শুরুর বন্দর', date: 'যাত্রার তারিখ', total: 'উদাহরণমূলক মোট অর্থ', perPassenger: 'প্রতি যাত্রী',
    notice: 'শুধু সিমুলেশন — অর্থ স্থানান্তর বা সরকারি চালান/ভ্রমণ ছাড়পত্র তৈরি হয় না।', run: 'পেমেন্ট সিমুলেশন চালান', running: 'স্থানীয় সিমুলেশন চলছে…',
    complete: 'ভ্রমণ করের সিমুলেশন সম্পন্ন — কোনো সরকারি চালান ইস্যু হয়নি।', ref: 'নমুনা রেফারেন্স', noTravel: 'বিমানবন্দর, সীমান্ত, ব্যাংক বা সরকারি দপ্তরে এই নমুনা দেখাবেন না। কোনো কর পরিশোধ হয়নি।', again: 'আরেকটি নমুনা শুরু করুন',
    requiredName: 'পাসপোর্টে থাকা যাত্রীর নাম লিখুন।', requiredPassport: 'শুধু কৃত্রিম পরীক্ষার তথ্য ব্যবহার করুন। এই নমুনা পাসপোর্ট যাচাই বা অভিবাসন ছাড়পত্র দিতে পারে না।'
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

export const TravelTax: React.FC = () => {
  const { language, navigate, addPaymentReceipt } = useTaxState();
  const bn = language === 'bn';
  const t = COPY[language];

  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
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
        challanNo: `AC-${year}-TRV-${randChallan}`,
        tokenNumber: `TRV-${randToken}`,
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
        gatewayTransactionId: `BKSH-TRV-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        taxCreditStatus: 'NOT_APPLICABLE',
        createdAt: now,
        completedAt: now,
        isSimulatedDemo: true
      };

      addPaymentReceipt(newReceipt);
      setCreatedReceipt(newReceipt);
      setIsProcessing(false);
    }, 1000);
  };

  if (createdReceipt) {
    return (
      <div className={`space-y-6${bn ? ' font-bengali' : ''}`} lang={language}>
        <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-taxpay-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <p className="font-bold">{t.complete}</p>
              <p className="text-xs text-emerald-800">
                {t.ref}: <strong className="font-mono">{createdReceipt.tokenNumber}</strong>. {t.noTravel}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreatedReceipt(null)}
            className="min-h-11 px-3 py-1.5 rounded bg-emerald-800 text-white text-xs font-semibold hover:bg-taxpay-primary cursor-pointer"
          >
            {t.again}
          </button>
        </div>
        <ReceiptView receipt={createdReceipt} onBack={() => navigate('landing')} />
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto space-y-6 pb-4${bn ? ' font-bengali' : ''}`} lang={language}>
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              {t.title}
            </h1>
            <p className="text-xs text-slate-500">
              {t.intro}
            </p>
          </div>
        </div>

        {/* Notice of Unverified Status */}
        <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block">{t.legalTitle}:</strong> {t.legalBody}
          </div>
        </div>

        <form onSubmit={handlePayTravelTax} className="space-y-6">
          {error && (
            <div id="travel-tax-error" role="alert" aria-live="assertive" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Route & Destination Selector */}
          <div>
            <fieldset>
              <legend className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">{t.destination}</legend>
            <div className="space-y-2" role="radiogroup" aria-label={t.destination}>
              {TRAVEL_TAX_RATES.map((item, idx) => (
                <label
                  key={idx}
                  htmlFor={`travel-tax-route-${idx}`}
                  className={`min-h-12 p-3.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-3 transition-all ${
                    selectedRouteIdx === idx
                      ? 'bg-teal-50/80 border-teal-700 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{bn ? item.routeBn : item.route}</div>
                    {!bn && <div className="text-[11px] text-slate-500 font-bengali">{item.routeBn}</div>}
                    <div className="text-[10px] text-slate-500">{bn ? 'আইনি সূত্র যাচাই হয়নি' : 'Legal source not verified'}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-plex font-bold text-sm text-teal-900">
                      {formatCurrency(item.amount, language)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{t.perPassenger}</span>
                  </div>
                  <input id={`travel-tax-route-${idx}`} className="h-5 w-5 shrink-0 accent-teal-800" type="radio" name="travel-tax-route" value={idx} checked={selectedRouteIdx === idx} onChange={() => setSelectedRouteIdx(idx)} />
                </label>
              ))}
            </div>
            </fieldset>
          </div>

          {/* Passenger Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="travel-passenger-name" className="block font-semibold text-slate-700 mb-1">{t.passenger} *</label>
              <input
                id="travel-passenger-name"
                type="text"
                required
                aria-describedby={error ? 'travel-tax-error' : undefined}
                placeholder={t.passengerPlaceholder}
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value.toUpperCase())}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
              />
            </div>

            <div>
              <label htmlFor="travel-passport" className="block font-semibold text-slate-700 mb-1">{t.passport} *</label>
              <input
                id="travel-passport"
                type="text"
                required
                aria-describedby={error ? 'travel-tax-error' : undefined}
                placeholder={t.passportPlaceholder}
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex font-bold"
              />
            </div>

            <div>
              <label htmlFor="travel-passenger-count" className="block font-semibold text-slate-700 mb-1">{t.count}</label>
              <input
                id="travel-passenger-count"
                type="number"
                min="1"
                max="10"
                value={passengerCount}
                onChange={(e) => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {t.countHint}
              </span>
            </div>

            <div>
              <label htmlFor="travel-mobile" className="block font-semibold text-slate-700 mb-1">{t.mobile}</label>
              <input
                id="travel-mobile"
                type="text"
                placeholder={t.phonePlaceholder}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
            </div>

            <div>
              <label htmlFor="travel-departure-port" className="block font-semibold text-slate-700 mb-1">{t.port}</label>
              <select
                id="travel-departure-port"
                value={departurePort}
                onChange={(e) => setDeparturePort(e.target.value)}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300"
              >
                {DEPARTURE_PORTS.map(port => <option key={port.value} value={port.value}>{bn ? port.bn : port.en}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="travel-departure-date" className="block font-semibold text-slate-700 mb-1">{t.date}</label>
              <input
                id="travel-departure-date"
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="min-h-11 w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          {/* Checkout Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-500 block">{t.total}:</span>
              <span className="font-mono-plex font-bold text-2xl text-teal-900">
                {formatCurrency(totalAmount, language)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                ({passengerCount} × {formatCurrency(unitRate, language)} / {t.perPassenger})
              </span>
              <p className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950" role="note">{t.notice}</p>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              aria-busy={isProcessing}
              className="min-h-11 w-full sm:w-auto justify-center px-6 py-3 bg-amber-400 hover:bg-amber-300 text-taxpay-dark font-bold rounded-lg text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isProcessing ? (
                <span>{t.running}</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-taxpay-dark" />
                  <span>{t.run}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
