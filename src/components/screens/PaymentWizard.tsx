import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Lock
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { MASTER_PAYMENT_HEADS, BLOCKED_HEAD_IDS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { PaymentCategory, ChallanReceipt, PaymentLineItem } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { ReceiptView } from '../common/ReceiptView';
import { DemoPaymentActivity } from './DemoPaymentActivity';
import {useAccountIdentity} from '../../services/accountIdentity';

const COPY = {
  en: {
    title: 'Income tax payment', eyebrow: 'Payment details', taxpayer: 'Taxpayer', step: 'Step', of: 'of',
    stages: ['Category and head', 'Amount breakdown', 'Review'],
    year: 'Assessment year', category: 'Payment category', head: 'Select a payment head', search: 'Filter by code or title', review: 'Review payment details',
    blocked: 'Unavailable for review', unverified: 'Under review', act: 'Act reference', legacy: 'Legacy reference', note: 'Note',
    continueAmounts: 'Continue to amounts', continueReview: 'Continue to review', back: 'Back',
    selectedHead: 'Selected head', amountBreakdown: 'Payment amount breakdown (BDT)', tax: 'Tax amount (৳)', penalty: 'Penalty (৳)', surcharge: 'Surcharge (৳)', interest: 'Interest (৳)',
    reference: 'Payment reference or assessment note (optional)', referencePlaceholder: 'e.g. Self-assessment return deposit', total: 'Total payable amount',
    payer: 'Payer', tin: 'e-TIN', headCode: 'Head code', remittance: 'Total amount', channel: 'Payment method (preview)',
    simulationNotice: 'Demo transaction — no money moves or official challan is issued.',
    runSimulation: 'Run payment simulation', running: 'Running local simulation…',
    complete: 'Payment preview ready.', receipt: 'Simulated receipt reference:', newPayment: 'Start another payment preview',
    selectActive: 'Select an available payment head.', blockedError: (id: number) => `Head #${id} is unavailable while its source is reviewed.`,
    positive: 'Enter an amount greater than zero to continue.'
  },
  bn: {
    title: 'আয়কর পরিশোধ', eyebrow: 'পেমেন্টের তথ্য', taxpayer: 'করদাতা', step: 'ধাপ', of: '/',
    stages: ['কর পরিশোধের ধরন ও খাত', 'পরিমাণের বিবরণ', 'পর্যালোচনা'],
    year: 'করবর্ষ', category: 'কর পরিশোধের ধরন', head: 'কর পরিশোধের খাত বাছুন', search: 'কোড বা শিরোনাম দিয়ে খুঁজুন', review: 'পেমেন্টের তথ্য পর্যালোচনা',
    blocked: 'পর্যালোচনা চলায় অনুপলব্ধ', unverified: 'পর্যালোচনাধীন', act: 'আইনের ধারা', legacy: 'পুরোনো রেফারেন্স', note: 'নোট',
    continueAmounts: 'পরিমাণে এগিয়ে যান', continueReview: 'পর্যালোচনায় এগিয়ে যান', back: 'ফিরে যান',
    selectedHead: 'নির্বাচিত খাত', amountBreakdown: 'পরিশোধের পরিমাণের বিবরণ (টাকা)', tax: 'কর (৳)', penalty: 'জরিমানা (৳)', surcharge: 'সারচার্জ (৳)', interest: 'সুদ (৳)',
    reference: 'পেমেন্ট রেফারেন্স বা কর নির্ধারণের নোট (ঐচ্ছিক)', referencePlaceholder: 'যেমন, স্বনির্ধারণী রিটার্ন জমা', total: 'মোট প্রদেয় অর্থ',
    payer: 'করদাতা', tin: 'ই-টিআইএন', headCode: 'খাতের কোড', remittance: 'মোট অর্থ', channel: 'পেমেন্ট মাধ্যম (প্রিভিউ)',
    simulationNotice: 'ডেমো লেনদেন — অর্থ স্থানান্তর বা সরকারি চালান ইস্যু হয় না।',
    runSimulation: 'পেমেন্ট সিমুলেশন চালান', running: 'স্থানীয় সিমুলেশন চলছে…',
    complete: 'পেমেন্টের প্রিভিউ প্রস্তুত।', receipt: 'নমুনা রসিদ রেফারেন্স:', newPayment: 'আরেকটি পেমেন্ট প্রিভিউ দেখুন',
    selectActive: 'উপলভ্য পেমেন্ট খাত বাছুন।', blockedError: (id: number) => `খাত #${id} এর উৎস পর্যালোচনায় থাকায় এটি অনুপলভ্য।`,
    positive: 'এগিয়ে যেতে শূন্যের বেশি পরিমাণ লিখুন।'
  }
} as const;

export const PaymentWizard: React.FC = () => {
  const { taxpayerProfile, addPaymentReceipt, routeParams, language, navigate, demoUser } = useTaxState();
  const {user:authenticatedUser}=useAccountIdentity();
  const bn = language === 'bn';
  const t = COPY[language];

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Initial category from params if any
  const [category, setCategory] = useState<PaymentCategory>(
    (routeParams?.initialCategory as PaymentCategory) || 'TAX_WITH_RETURN'
  );

  const [assessmentYear, setAssessmentYear] = useState('2025-2026');
  const [selectedHeadId, setSelectedHeadId] = useState<number>(1);
  const [headSearch, setHeadSearch] = useState('');

  // Breakdown
  const [taxAmount, setTaxAmount] = useState<number>(25000);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [surchargeAmount, setSurchargeAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  // Gateway
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD' | 'BEFTN_RTGS'>('BKASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (routeParams?.initialCategory) {
      setCategory(routeParams.initialCategory as PaymentCategory);
      const first = MASTER_PAYMENT_HEADS.find(h => h.category === routeParams.initialCategory);
      if (first) setSelectedHeadId(first.id);
    }
  }, [routeParams]);

  const availableHeads = MASTER_PAYMENT_HEADS.filter(head => {
    const matchCat = head.category === category;
    const matchQuery = headSearch
      ? head.nameEn.toLowerCase().includes(headSearch.toLowerCase()) ||
        head.nameBn.includes(headSearch) ||
        head.economicCode.includes(headSearch) ||
        head.sectionAct2023.toLowerCase().includes(headSearch.toLowerCase())
      : true;
    return matchCat && matchQuery;
  });

  const selectedHead = MASTER_PAYMENT_HEADS.find(h => h.id === selectedHeadId) || availableHeads[0];

  const totalAmount = Number(taxAmount || 0) + Number(penaltyAmount || 0) + Number(surchargeAmount || 0) + Number(interestAmount || 0);

  const handleStep1Next = () => {
    if (!selectedHead) {
      setErrorMessage(t.selectActive);
      return;
    }
    if (BLOCKED_HEAD_IDS.includes(selectedHead.id)) {
      setErrorMessage(t.blockedError(selectedHead.id));
      return;
    }
    setErrorMessage('');
    setStep(2);
  };

  const handleStep2Next = () => {
    if (totalAmount <= 0) {
      setErrorMessage(t.positive);
      return;
    }
    setErrorMessage('');
    setStep(3);
  };

  const handleExecutePayment = () => {
    setIsProcessing(true);
    setErrorMessage('');

    setTimeout(() => {
      const year = new Date().getFullYear();
      const randChallan = Math.floor(10000000 + Math.random() * 90000000);
      const randToken = Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const lineItem: PaymentLineItem = {
        headId: selectedHead.id,
        economicCode: selectedHead.economicCode,
        headNameEn: selectedHead.nameEn,
        taxAmount: Number(taxAmount),
        penaltyAmount: Number(penaltyAmount),
        surchargeAmount: Number(surchargeAmount),
        interestAmount: Number(interestAmount),
        totalAmount,
        note: note || undefined
      };

      const newReceipt: ChallanReceipt = {
        id: `rcpt-wiz-${Date.now()}`,
        challanNo: `AC-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear,
        payerName: taxpayerProfile.nameEn,
        payerTin: taxpayerProfile.tin,
        isRepresentativePayment: false,
        taxZone: taxpayerProfile.taxZone,
        taxCircle: taxpayerProfile.taxCircle,
        isWithholding: category === 'SOURCE_TAX_DEPOSIT',
        items: [lineItem],
        totalAmount,
        paymentMethod,
        gatewayTransactionId: `${paymentMethod.substring(0, 4)}-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        taxCreditStatus: category === 'SOURCE_TAX_DEPOSIT' ? 'NOT_APPLICABLE' : 'PENDING_RECONCILIATION',
        createdAt: now,
        completedAt: now,
        isSimulatedDemo: true
      };

      addPaymentReceipt(newReceipt);
      setCreatedReceipt(newReceipt);
      setIsProcessing(false);
      setStep(4);
    }, 1200);
  };

  // Synthetic user1–user10 go through the real SQL transaction composer, not the old session receipt preview.
  if(demoUser||authenticatedUser) return <DemoPaymentActivity/>;

  if (step === 4 && createdReceipt) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-taxpay-dark flex flex-wrap items-center justify-between gap-3" lang={language}>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">{t.complete}</span>
              <p className="text-sm text-emerald-800">
                {t.receipt} <strong className="font-mono">{createdReceipt.challanNo}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStep(1);
              setCreatedReceipt(null);
            }}
            className="min-h-11 px-3 py-1.5 rounded bg-emerald-800 text-white text-sm font-semibold hover:bg-taxpay-primary cursor-pointer"
          >
            {t.newPayment}
          </button>
        </div>
        <ReceiptView receipt={createdReceipt} onBack={() => navigate('taxpayer_home')} />
      </div>
    );
  }

  return (
    <div className="taxpay-payment-wizard max-w-4xl mx-auto space-y-6 pb-4" lang={language}>
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-emerald-800">
              {t.eyebrow}
            </span>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              {t.title}
            </h1>
            <p className="text-sm text-slate-500">
              {t.taxpayer}: <strong className="text-slate-800">{bn ? taxpayerProfile.nameBn : taxpayerProfile.nameEn}</strong> ({t.tin}: {taxpayerProfile.tin})
            </p>
          </div>
          <span className="text-sm px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {t.step} {step} {t.of} 3
          </span>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm font-semibold text-center mb-6" aria-label={bn ? 'পেমেন্টের ধাপ' : 'Payment steps'}>
          <div aria-current={step === 1 ? 'step' : undefined} className={`p-2 rounded border ${step >= 1 ? 'bg-taxpay-primary text-white border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            1. {t.stages[0]}
          </div>
          <div aria-current={step === 2 ? 'step' : undefined} className={`p-2 rounded border ${step >= 2 ? 'bg-taxpay-primary text-white border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            2. {t.stages[1]}
          </div>
          <div aria-current={step === 3 ? 'step' : undefined} className={`p-2 rounded border ${step >= 3 ? 'bg-taxpay-primary text-white border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            3. {t.stages[2]}
          </div>
        </div>

        {errorMessage && (
          <div id="wizard-error" role="alert" aria-live="assertive" aria-atomic="true" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label htmlFor="wizard-assessment-year" className="block font-semibold text-slate-700 mb-1">
                  {t.year} *
                </label>
                <select
                  id="wizard-assessment-year" value={assessmentYear}
                  onChange={(e) => setAssessmentYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                >
                  {ASSESSMENT_YEARS.map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="wizard-payment-category" className="block font-semibold text-slate-700 mb-1">
                  {t.category} *
                </label>
                <select
                  id="wizard-payment-category" value={category}
                  onChange={(e) => {
                    const newCat = e.target.value as PaymentCategory;
                    setCategory(newCat);
                    const first = MASTER_PAYMENT_HEADS.find(h => h.category === newCat);
                    if (first) setSelectedHeadId(first.id);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {bn ? label.bn : label.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Master Heads List */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label htmlFor="wizard-head-search" className="block text-sm font-semibold text-slate-700">
                  {t.head} ({availableHeads.length})
                </label>
                <input
                  type="text"
                  id="wizard-head-search" aria-label={t.search} placeholder={t.search}
                  value={headSearch}
                  onChange={(e) => setHeadSearch(e.target.value)}
                  className="min-h-11 w-full sm:w-48 px-2.5 py-2 text-sm rounded border border-slate-300"
                />
              </div>

              <fieldset aria-label={t.head} aria-describedby={errorMessage ? 'wizard-error' : undefined} className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50 min-w-0">
                {availableHeads.map(head => {
                  const isBlocked = BLOCKED_HEAD_IDS.includes(head.id);
                  const isSelected = selectedHead?.id === head.id;
                  return (
                    <label
                      key={head.id}
                      htmlFor={`wizard-head-${head.id}`}
                      className={`min-h-12 p-3 text-sm flex items-start justify-between gap-3 ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'} transition-colors ${
                        isSelected
                          ? 'bg-emerald-100/70 border-l-4 border-taxpay-primary'
                          : isBlocked
                          ? 'bg-rose-50/60 opacity-70 cursor-not-allowed'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-plex font-bold text-taxpay-dark">
                            {head.economicCode}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {bn ? head.nameBn : head.nameEn}
                          </span>
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 text-sm font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                              <Lock className="w-3 h-3" />
                              {t.blocked}
                            </span>
                          )}
                        </div>
                        {!bn && <div className="text-sm text-slate-500 font-bengali">{head.nameBn}</div>}
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span>{t.act}: <strong>{head.sectionAct2023}</strong></span>
                          <span>{t.legacy}: {head.sectionOrdinance1984}</span>
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {t.unverified}
                          </span>
                        </div>
                        {head.rateNote && (
                          <div className="text-sm text-emerald-800 font-medium">
                            {t.note}: {head.rateNote}
                          </div>
                        )}
                      </div>
                      <input
                        id={`wizard-head-${head.id}`} name="wizard-payment-head" type="radio"
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => setSelectedHeadId(head.id)}
                        aria-label={bn ? head.nameBn : head.nameEn}
                        className="mt-1 h-5 w-5 shrink-0 accent-emerald-800"
                      />
                    </label>
                  );
                })}
              </fieldset>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={handleStep1Next}
                className="px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-white font-bold rounded-lg text-sm sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{t.continueAmounts}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              <span className="text-slate-500 block">{t.selectedHead}:</span>
              <div className="font-mono-plex font-bold text-sm tabular-nums text-taxpay-dark mt-0.5">
                {selectedHead?.economicCode} — {bn ? selectedHead?.nameBn : selectedHead?.nameEn}
              </div>
              <div className="text-sm text-emerald-800 mt-1">
                {t.act}: {selectedHead?.sectionAct2023} | {t.year}: {assessmentYear}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-taxpay-dark">
                {t.amountBreakdown}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                <div>
                  <label htmlFor="wizard-tax-amount" className="block text-slate-600 font-medium mb-1">{t.tax} *</label>
                  <input
                    id="wizard-tax-amount"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={errorMessage ? 'wizard-error' : undefined}
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-penalty" className="block text-slate-600 font-medium mb-1">{t.penalty}</label>
                  <input
                    id="wizard-penalty"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-surcharge" className="block text-slate-600 font-medium mb-1">{t.surcharge}</label>
                  <input
                    id="wizard-surcharge"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={surchargeAmount}
                    onChange={(e) => setSurchargeAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-interest" className="block text-slate-600 font-medium mb-1">{t.interest}</label>
                  <input
                    id="wizard-interest"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="wizard-payment-reference" className="block text-slate-600 text-sm font-medium mb-1">
                  {t.reference}
                </label>
                <input
                  id="wizard-payment-reference"
                  type="text"
                  placeholder={t.referencePlaceholder}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded border border-slate-300"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">
                  {t.total}:
                </span>
                <span className="font-mono-plex font-bold text-xl text-taxpay-dark">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={handleStep2Next}
                className="px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-white font-bold rounded-lg text-sm sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{t.continueReview}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-sm">
              <h3 className="font-serif-fraunces font-bold text-base text-slate-900 border-b border-slate-200 pb-2">
                {t.review}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">{t.payer}:</span>
                  <strong className="text-slate-900">{bn ? taxpayerProfile.nameBn : taxpayerProfile.nameEn}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.tin}:</span>
                  <strong className="font-mono-plex text-taxpay-dark">{taxpayerProfile.tin}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.year}:</span>
                  <strong className="text-slate-900">{assessmentYear}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.headCode}:</span>
                  <strong className="font-mono-plex text-taxpay-dark">{selectedHead?.economicCode}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">{t.remittance}:</span>
                <span className="font-mono-plex font-bold text-xl text-taxpay-dark">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            {/* Gateway choices */}
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-700">
                {t.channel}
              </label>
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2" role="group" aria-label={t.channel}>
                {[
                  { id: 'BKASH', label: 'bKash MFS' },
                  { id: 'NAGAD', label: 'Nagad MFS' },
                  { id: 'ROCKET', label: 'Rocket DBBL' },
                  { id: 'SONALI_E_SHEBA', label: 'Sonali Bank' },
                  { id: 'A_CHALLAN_CARD', label: 'Cards' },
                  { id: 'BEFTN_RTGS', label: 'BEFTN Bank' }
                ].map(gw => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setPaymentMethod(gw.id as any)}
                    aria-pressed={paymentMethod === gw.id}
                    className={`min-h-11 p-2.5 rounded-lg border text-sm font-semibold cursor-pointer text-center ${
                      paymentMethod === gw.id
                        ? 'bg-taxpay-primary text-white border-taxpay-primary'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {gw.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950" role="note">
              {t.simulationNotice}
            </p>

            <div className="flex justify-between pt-3">
              <button
                disabled={isProcessing}
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={handleExecutePayment}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-taxpay-dark font-bold rounded-lg text-sm sm:text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>{t.running}</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-taxpay-dark" />
                    <span>{t.runSimulation} · {formatCurrency(totalAmount, language)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
