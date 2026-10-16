import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Lock
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { backendConfigured } from '../../services/supabaseClient';
import { BLOCKED_HEAD_IDS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { V11_PAYMENT_OPTIONS } from '../../data/v11PaymentOptions';
import { PaymentCategory, ChallanReceipt, PaymentLineItem } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { UI_STRINGS } from '../../services/localization';
import { ReceiptView } from '../common/ReceiptView';
import { PaymentFormSection, PaymentLiveSummary } from '../ui/PaymentFormLayout';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';

const GUEST_COPY = {
  en: {
    withholdingMode: 'Withholding Agent Mode', publicPortal: 'Public Guest Portal',
    sourceTaxTitle: 'Source Tax Deposit (TDS / TCS)', paymentTitle: 'Guest Income Tax Payment',
    intro: 'Enter the details to prepare your payment.',
    selectedPurpose: 'Selected purpose', underReview: 'Under review', stepOf: (step: number) => `Step ${step} of 4`,
    steps: ['Taxpayer', 'Payment details', 'Review', 'Status'],
    tinPlaceholder: 'e-TIN', tinHint: 'At least 10 characters are required; no government identity check is performed.',
    payerName: 'Payer Legal Name', payerNamePlaceholder: 'Full name as registered on TIN certificate',
    year: 'Assessment Year', zoneCircle: 'Taxes Zone & Circle', zone: 'Taxes Zone', circle: 'Taxes Circle',
    mobile: 'Mobile number (optional)', mobilePlaceholder: 'Contact number',
    email: 'Email Address (optional)', deducteeDetails: 'Deductee (Supplier / Beneficiary) Particulars',
    deducteeTin: 'Deductee TIN', deducteeTinPlaceholder: 'Beneficiary vendor 12-digit TIN',
    deducteeName: 'Deductee Entity Name', deducteeNamePlaceholder: 'Beneficiary supplier / contractor name',
    legalNote: 'Withholding credits require deductee ownership and reconciliation.',
    representativeCheck: 'I am an authorized legal representative paying on behalf of this taxpayer',
    representativeName: 'Representative Name', representativeNamePlaceholder: 'Lawyer / CA / authorized relative',
    representativeTin: 'Representative TIN', representativeTinPlaceholder: 'Representative 12-digit TIN',
    continueHead: 'Continue to Payment Head', category: 'Payment Category',
    selectHead: (count: number) => `Select Master Payment Head (${count} available in category)`,
    searchHead: 'Filter by code or section...', blocked: 'BLOCKED', act: 'Act', legacy: 'Legacy', note: 'Note',
    amountBreakdown: 'Payment Amount Breakdown (BDT)', taxAmount: 'Tax Amount (৳)', penalty: 'Penalty (৳)',
    surcharge: 'Surcharge (৳)', interest: 'Interest (৳)', remarks: 'Payment Remarks / Invoice Reference (Optional)',
    remarksPlaceholder: 'e.g. Assessment order #190 / Salary withholding month Oct 2026', total: 'Total Payable Amount:',
    draft: 'Plan as a private draft', continueReview: 'Continue to Review', back: 'Back', backToHead: 'Back to Payment Head',
    reviewTitle: 'Payment summary', payer: 'Payer Name', jurisdiction: 'Jurisdiction',
    headTitle: 'Payment Head', unspecified: 'Unspecified', grandTotal: 'Total Amount (BDT)',
    channel: 'Payment method (preview)', noFee: 'No fee', directTreasury: 'Treasury route',
    govSwitch: 'Government switch (simulated)',
    simulationTitle: 'Payment simulation only',
    simulationNotice: 'No money is transferred and no official challan is issued.',
    runSimulation: (amount: string) => `Run payment simulation · ${amount}`,
    processing: 'Running payment simulation…',
    completionTitle: 'Payment preview ready.',
    completionBody: 'Preview reference (not proof of payment):',
    anotherPayment: 'Start another payment preview',
    invalidTin: 'Enter the taxpayer’s 12-digit TIN.',
    requiredPayer: 'Enter the payer’s full legal name.',
    requiredRepresentative: 'Enter the representative’s name and TIN to continue.',
    requiredDeductee: 'Enter the deductee (supplier or beneficiary) TIN for this source-tax payment.',
    requiredHead: 'Select an available payment head.',
    blockedHead: (id: number) => `Payment head #${id} is blocked for owner review and cannot be selected for this payment flow.`,
    positiveAmount: 'Enter a total amount greater than zero.',
  },
  bn: {
    withholdingMode: 'উৎসে কর কর্তনকারীর মোড', publicPortal: 'পাবলিক অতিথি পোর্টাল',
    sourceTaxTitle: 'উৎসে কর জমা (টিডিএস / টিসিএস)', paymentTitle: 'অতিথি আয়কর পরিশোধ',
    intro: 'পেমেন্ট প্রস্তুত করতে প্রয়োজনীয় তথ্য দিন।',
    selectedPurpose: 'নির্বাচিত উদ্দেশ্য', underReview: 'পর্যালোচনাধীন', stepOf: (step: number) => `ধাপ ${step} / ৪`,
    steps: ['করদাতা', 'পরিশোধের বিবরণ', 'পর্যালোচনা', 'অবস্থা'],
    tinPlaceholder: 'ই-টিআইএন', tinHint: 'কমপক্ষে ১০টি অক্ষর দিতে হবে; সরকারি পরিচয় যাচাই করা হয় না।',
    payerName: 'করদাতার আইনগত নাম', payerNamePlaceholder: 'টিআইএন সনদে নিবন্ধিত পূর্ণ নাম',
    year: 'করবর্ষ', zoneCircle: 'কর অঞ্চল ও সার্কেল', zone: 'কর অঞ্চল', circle: 'কর সার্কেল',
    mobile: 'মোবাইল নম্বর (ঐচ্ছিক)', mobilePlaceholder: 'যোগাযোগ নম্বর',
    email: 'ইমেইল ঠিকানা (ঐচ্ছিক)', deducteeDetails: 'কর কর্তনগ্রহীতা (সরবরাহকারী / সুবিধাভোগী) তথ্য',
    deducteeTin: 'কর কর্তনগ্রহীতার টিআইএন', deducteeTinPlaceholder: 'সুবিধাভোগী বিক্রেতার ১২ সংখ্যার টিআইএন',
    deducteeName: 'কর কর্তনগ্রহীতা প্রতিষ্ঠানের নাম', deducteeNamePlaceholder: 'সুবিধাভোগী সরবরাহকারী / ঠিকাদারের নাম',
    legalNote: 'উৎসে কর ক্রেডিটের জন্য কর কর্তনগ্রহীতার মালিকানা ও সমন্বয় যাচাই প্রয়োজন।',
    representativeCheck: 'আমি এই করদাতার পক্ষে পরিশোধকারী অনুমোদিত আইনগত প্রতিনিধি',
    representativeName: 'প্রতিনিধির নাম', representativeNamePlaceholder: 'আইনজীবী / সিএ / অনুমোদিত আত্মীয়',
    representativeTin: 'প্রতিনিধির টিআইএন', representativeTinPlaceholder: 'প্রতিনিধির ১২ সংখ্যার টিআইএন',
    continueHead: 'পেমেন্ট খাতে এগিয়ে যান', category: 'পেমেন্টের শ্রেণি',
    selectHead: (count: number) => `মাস্টার পেমেন্ট খাত নির্বাচন করুন (এই শ্রেণিতে ${count}টি)`,
    searchHead: 'কোড বা ধারা দিয়ে খুঁজুন…', blocked: 'নির্বাচনযোগ্য নয়', act: 'আইন', legacy: 'পূর্ববর্তী আইন', note: 'নোট',
    amountBreakdown: 'পেমেন্টের পরিমাণের হিসাব (টাকা)', taxAmount: 'কর (৳)', penalty: 'জরিমানা (৳)',
    surcharge: 'সারচার্জ (৳)', interest: 'সুদ (৳)', remarks: 'পেমেন্টের মন্তব্য / ইনভয়েস রেফারেন্স (ঐচ্ছিক)',
    remarksPlaceholder: 'যেমন: কর নির্ধারণ আদেশ #১৯০ / অক্টোবর ২০২৬-এর বেতন থেকে কর কর্তন', total: 'মোট প্রদেয় অর্থ:',
    draft: 'ব্যক্তিগত খসড়া হিসেবে পরিকল্পনা করুন', continueReview: 'পর্যালোচনায় এগিয়ে যান', back: 'পূর্ববর্তী ধাপ', backToHead: 'পেমেন্ট খাতে ফিরুন',
    reviewTitle: 'পেমেন্টের সারসংক্ষেপ', payer: 'করদাতার নাম', jurisdiction: 'এখতিয়ার',
    headTitle: 'পেমেন্ট খাত', unspecified: 'উল্লেখ করা হয়নি', grandTotal: 'মোট অর্থ (টাকা)',
    channel: 'পেমেন্ট মাধ্যম (প্রিভিউ)', noFee: 'কোনো ফি নেই (উদাহরণ)', directTreasury: 'ট্রেজারি রুট (সিমুলেশন)',
    govSwitch: 'সরকারি সুইচ (সিমুলেটেড)',
    simulationTitle: 'শুধু পেমেন্ট সিমুলেশন',
    simulationNotice: 'অর্থ স্থানান্তর বা সরকারি চালান ইস্যু হয় না।',
    runSimulation: (amount: string) => `পেমেন্ট সিমুলেশন চালান · ${amount}`,
    processing: 'পেমেন্ট সিমুলেশন চলছে…',
    completionTitle: 'পেমেন্টের প্রিভিউ প্রস্তুত।',
    completionBody: 'প্রিভিউ রেফারেন্স (পেমেন্টের প্রমাণ নয়):',
    anotherPayment: 'আরেকটি পেমেন্ট প্রিভিউ দেখুন',
    invalidTin: 'করদাতার ১২ সংখ্যার টিআইএন লিখুন।',
    requiredPayer: 'করদাতার পূর্ণ আইনগত নাম দিন।',
    requiredRepresentative: 'এগোতে প্রতিনিধির নাম ও টিআইএন দিন।',
    requiredDeductee: 'এই উৎসে করের প্রদর্শনীর জন্য কর কর্তনগ্রহীতা (সরবরাহকারী বা সুবিধাভোগী)-এর টিআইএন দিন।',
    requiredHead: 'নির্বাচনযোগ্য একটি পেমেন্ট খাত নির্বাচন করুন।',
    blockedHead: (id: number) => `পেমেন্ট খাত #${id} মালিকপক্ষের পর্যালোচনার জন্য অবরুদ্ধ; এই প্রদর্শনীতে এটি নির্বাচন করা যাবে না।`,
    positiveAmount: 'শূন্যের বেশি মোট অর্থ দিন।',
  },
} as const;

type GuestErrorField = 'tin' | 'payerName' | 'phone' | 'headId' | 'taxAmount';
const ERROR_ID = 'guest-payment-error';

interface GuestPaymentProps {
  isWithholdingMode?: boolean;
  embedded?: boolean;
  initialCategory?: PaymentCategory;
  onBackToService?: () => void;
  onStageChange?: (stage: 2 | 3 | 4) => void;
}

export const GuestPayment: React.FC<GuestPaymentProps> = ({ isWithholdingMode = false, embedded = false, initialCategory, onBackToService, onStageChange }) => {
  const { language, navigate, addPaymentReceipt, routeParams } = useTaxState();
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const commonCopy = UI_STRINGS[language];
  const copy = GUEST_COPY[language];

  // Wizard state steps: 1: Taxpayer & Identification, 2: Head & Amount, 3: Review & Gateway, 4: Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form inputs
  const [tin, setTin] = useState('');
  const [payerName, setPayerName] = useState('');
  const [phone, setPhone] = useState('');
  const taxZone = '—';
  const taxCircle = '—';
  const [assessmentYear, setAssessmentYear] = useState('2026-27');
  const [forSelf, setForSelf] = useState(true);
  const [noticeReference, setNoticeReference] = useState('');
  const [incomeTaxType, setIncomeTaxType] = useState<'NON_COMPANY' | 'COMPANY'>('NON_COMPANY');
  

  // Category and Head selection
  const [category, setCategory] = useState<PaymentCategory>(
    isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' :
      (initialCategory || (typeof routeParams?.initialCategory === 'string' && CATEGORY_LABELS[routeParams.initialCategory]
        ? routeParams.initialCategory as PaymentCategory : 'TAX_WITH_RETURN'))
  );
  const [selectedHeadId, setSelectedHeadId] = useState<number>(
    V11_PAYMENT_OPTIONS.find(h => h.category === (isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' : initialCategory || routeParams?.initialCategory) && h.status === 'ACTIVE')?.id || 1
  );
  const [headSearch, setHeadSearch] = useState('');

  // Amounts
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [surchargeAmount, setSurchargeAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  // Payment gateway choice
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD'>('BKASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorField, setErrorField] = useState<GuestErrorField | null>(null);

  const errorDescription = (field: GuestErrorField, hintId?: string) => {
    const ids = [hintId, errorField === field && errorMessage ? ERROR_ID : undefined].filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
  };
  const isFieldInvalid = (field: GuestErrorField) => errorField === field && Boolean(errorMessage);
  const setValidationError = (message: string, field: GuestErrorField) => {
    setErrorMessage(message);
    setErrorField(field);
  };
  const clearValidationError = () => {
    setErrorMessage('');
    setErrorField(null);
  };

  useEffect(() => {
    if (embedded) onStageChange?.(step === 4 ? 4 : step === 3 ? 3 : 2);
  }, [embedded, onStageChange, step]);

  useEffect(() => {
    if (isWithholdingMode) {
      setCategory('SOURCE_TAX_DEPOSIT');
      setSelectedHeadId(V11_PAYMENT_OPTIONS.find(h => h.category === 'SOURCE_TAX_DEPOSIT' && h.status === 'ACTIVE')?.id || 8);
    }
  }, [isWithholdingMode]);

  useEffect(() => {
    const requestedCategory = initialCategory || routeParams?.initialCategory;
    if (!isWithholdingMode && requestedCategory && CATEGORY_LABELS[requestedCategory]) {
      const next = requestedCategory as PaymentCategory;
      setCategory(next);
      const firstHead = V11_PAYMENT_OPTIONS.find(h => h.category === next && h.status === 'ACTIVE');
      if (firstHead) setSelectedHeadId(firstHead.id);
    }
  }, [routeParams, initialCategory, isWithholdingMode]);

  // Filter available heads
  const availableHeads = V11_PAYMENT_OPTIONS.filter(head => {
    const matchCat = head.category === category;
    const matchQuery = headSearch
      ? head.nameEn.toLowerCase().includes(headSearch.toLowerCase()) ||
        head.nameBn.includes(headSearch) ||
        head.economicCode.includes(headSearch) ||
        head.sectionAct2023.toLowerCase().includes(headSearch.toLowerCase())
      : true;
    return matchCat && matchQuery;
  });

  const selectedHead = availableHeads.find(h => h.id === selectedHeadId) || availableHeads[0];

  const totalAmount = Number(taxAmount || 0) + Number(penaltyAmount || 0) + Number(surchargeAmount || 0) + Number(interestAmount || 0);

  const validateIdentity = () => {
    if (!/^\d{12}$/.test(tin)) {
      setValidationError(copy.invalidTin, 'tin');
      return false;
    }
    if (!forSelf && !payerName.trim()) {
      setValidationError(copy.requiredPayer, 'payerName');
      return false;
    }
    if (!/^01\d{9}$/.test(phone.replace(/\D/g, ''))) {
      setValidationError(language === 'bn' ? 'রসিদের জন্য ১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)।' : 'Enter an 11-digit receipt mobile number (01XXXXXXXXX).', 'phone');
      return false;
    }
    clearValidationError();
    return true;
  };

  const handleStep1Next = () => {
    if (!validateIdentity()) return;
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedHead) {
      setValidationError(copy.requiredHead, 'headId');
      return;
    }
    if (selectedHead.status !== 'ACTIVE' || BLOCKED_HEAD_IDS.includes(selectedHead.id)) {
      setValidationError(copy.blockedHead(selectedHead.id), 'headId');
      return;
    }
    if (totalAmount <= 0) {
      setValidationError(copy.positiveAmount, 'taxAmount');
      return;
    }
    clearValidationError();
    setStep(3);
  };

  const handleEmbeddedDetailsNext = () => {
    if (!validateIdentity()) return;
    handleStep2Next();
  };

  const handleExecutePayment = () => {
    setIsProcessing(true);
    clearValidationError();

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
        note: [noticeReference && `NBR reference: ${noticeReference}`, !isWithholdingMode && `Income tax type: ${incomeTaxType}`, note].filter(Boolean).join(' · ') || undefined
      };

      const newReceipt: ChallanReceipt = {
        id: `rcpt-${Date.now()}`,
        challanNo: `AC-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear,
        payerName: forSelf ? (payerName.trim() || 'Taxpayer / withholding agent') : payerName,
        payerTin: tin,
        isRepresentativePayment: !forSelf,
        representativeTin: undefined,
        taxZone,
        taxCircle,
        isWithholding: isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT',
        deducteeTin: undefined,
        deducteeName: undefined,
        items: [lineItem],
        totalAmount,
        paymentMethod,
        gatewayTransactionId: `${paymentMethod.substring(0, 4)}-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        // CRITICAL DOMAIN SEPARATION:
        taxCreditStatus: (isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT') 
          ? 'NOT_APPLICABLE' 
          : 'PENDING_RECONCILIATION',
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

  if (step === 4 && createdReceipt) {
    return (
      <div lang={language === 'bn' ? 'bn' : 'en'} className={`space-y-6 ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
        <div className="no-print p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-taxpay-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">{copy.completionTitle}</span>
              <p className="text-xs text-emerald-800">
                {copy.completionBody} <strong className="font-mono">{createdReceipt.challanNo}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStep(1);
              setCreatedReceipt(null);
            }}
            className="min-h-11 px-3 py-1.5 rounded bg-emerald-800 text-white text-xs font-semibold hover:bg-taxpay-primary cursor-pointer"
          >
            {copy.anotherPayment}
          </button>
        </div>
        <div lang={language}>
          <ReceiptView receipt={createdReceipt} embedded={embedded} onBack={embedded ? onBackToService : () => navigate('landing')} />
        </div>
      </div>
    );
  }

  return (
    <div lang={language === 'bn' ? 'bn' : 'en'} className={`${embedded ? 'payment-flow-embedded' : 'max-w-7xl mx-auto space-y-6 pb-12'} ${language === 'bn' ? 'font-bengali' : ''}`}>
      {/* Title & Mode Banner */}
      <div className={embedded ? 'payment-flow-embedded__content' : 'bg-white border border-slate-200 rounded-xl p-6 shadow-sm'}>
        {!embedded && <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              {isWithholdingMode ? copy.withholdingMode : copy.publicPortal}
            </span>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              {isWithholdingMode ? copy.sourceTaxTitle : copy.paymentTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {copy.intro}
            </p>
            <p className="mt-2 text-xs font-semibold text-taxpay-dark" aria-live="polite">
              {copy.selectedPurpose}: {language === 'bn' ? CATEGORY_LABELS[category]?.bn || copy.underReview : CATEGORY_LABELS[category]?.en || copy.underReview}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {copy.stepOf(step)}
            </span>
          </div>
        </div>

        {/* Stepper Progress */}
        <ol aria-label={language === 'bn' ? 'পেমেন্ট ধাপ' : 'Payment steps'} className="list-none grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-center mb-6">
          {copy.steps.map((stepLabel, index) => (
            <li key={stepLabel} aria-current={step === index + 1 ? 'step' : undefined} className={`min-h-11 p-2 rounded border ${step >= index + 1 ? 'bg-taxpay-primary text-white border-taxpay-primary' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {index + 1}. {stepLabel}
            </li>
          ))}
        </ol>
        </>}

        {errorMessage && (
          <div id={ERROR_ID} role="alert" aria-live="assertive" aria-atomic="true" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Taxpayer Identification */}
        {step === 1 && (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__identity' : ''}`}>
            <div className="payment-form-layout__sections">
            <PaymentFormSection number={1} title={language === 'bn' ? 'কার জন্য পরিশোধ করছেন?' : 'Who are you paying for?'} description={language === 'bn' ? 'নিজের বা অন্যের হয়ে পরিশোধ নির্বাচন করুন' : 'Choose your relationship to the taxpayer'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label={language === 'bn' ? 'পরিশোধকারীর ধরন' : 'Payer relationship'}>
                {[{ value: true, en: isWithholdingMode ? 'I am the withholding agent' : 'My own tax', bn: isWithholdingMode ? 'আমি উৎসে কর কর্তনকারী' : 'আমার নিজের কর' }, { value: false, en: isWithholdingMode ? 'Paying for the agent' : "Someone else's tax", bn: isWithholdingMode ? 'এজেন্টের পক্ষে পরিশোধ' : 'অন্য কারও কর' }].map(choice => <button type="button" key={String(choice.value)} aria-pressed={forSelf === choice.value} onClick={() => setForSelf(choice.value)} className={`min-h-14 rounded-lg border-2 p-3 text-left font-semibold text-sm ${forSelf === choice.value ? 'border-taxpay-primary bg-blue-50 text-taxpay-dark' : 'border-slate-200 text-slate-700'}`}>{language === 'bn' ? choice.bn : choice.en}</button>)}
              </div>
            </PaymentFormSection>
            <PaymentFormSection number={2} title={language === 'bn' ? 'করদাতার পরিচয়' : 'Taxpayer identification'} description={language === 'bn' ? '১২ সংখ্যার টিআইএন ও ঐচ্ছিক রেফারেন্স' : '12-digit TIN and optional NBR reference'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="guest-tin" className="block text-xs font-semibold text-slate-700 mb-1">
                  {commonCopy.tin} *
                </label>
                <input
                  id="guest-tin"
                  type="text"
                  aria-invalid={isFieldInvalid('tin') || undefined}
                  aria-describedby={errorDescription('tin', 'guest-tin-hint')}
                  placeholder={copy.tinPlaceholder}
                  value={tin}
                  inputMode="numeric" maxLength={12} autoComplete="off"
                  onChange={(e) => setTin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
                <span id="guest-tin-hint" className="text-[11px] text-slate-500 mt-1 block">{language === 'bn' ? '১২ সংখ্যার টিআইএন লিখুন। এই ডেমোতে NBR পরিচয় যাচাই করা হয় না।' : 'Enter the 12-digit TIN. This demo does not verify identities with NBR.'}</span>
              </div>

              <div>
                <label htmlFor="guest-payer-name" className="block text-xs font-semibold text-slate-700 mb-1">{forSelf ? (language === 'bn' ? 'নাম (ঐচ্ছিক)' : 'Name (optional)') : (language === 'bn' ? 'আপনার নাম (পরিশোধকারী)' : 'Your name (payer)')} {!forSelf && '*'}</label>
                <input
                  id="guest-payer-name"
                  type="text"
                  aria-invalid={isFieldInvalid('payerName') || undefined}
                  aria-describedby={errorDescription('payerName')}
                  placeholder={copy.payerNamePlaceholder}
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
              </div>

              <div>
                <label htmlFor="guest-assessment-year" className="block text-xs font-semibold text-slate-700 mb-1">{commonCopy.assessmentYear} *</label>
                <select
                  id="guest-assessment-year"
                  value={assessmentYear}
                  onChange={(e) => setAssessmentYear(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                >
                  {['2027-28','2026-27','2025-26','2024-25'].map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="guest-phone" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'রসিদের জন্য মোবাইল নম্বর' : 'Mobile number for receipt'} *</label>
                <input
                  id="guest-phone"
                  type="text"
                  placeholder={copy.mobilePlaceholder}
                  value={phone}
                  aria-invalid={isFieldInvalid('phone') || undefined}
                  aria-describedby={errorDescription('phone')}
                  inputMode="numeric" maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
              </div>

              {!isWithholdingMode && <div>
                <label htmlFor="guest-notice-ref" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'NBR নোটিশ বা পেমেন্ট রেফারেন্স (ঐচ্ছিক)' : 'NBR notice or payment reference (optional)'}</label>
                <input id="guest-notice-ref" value={noticeReference} onChange={event => setNoticeReference(event.target.value)} placeholder="PN-2026-000392" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
              </div>}
            </div>
            <p className="text-xs text-slate-500">{language === 'bn' ? 'এই সিমুলেশনে টিআইএন যাচাই করা হয় না এবং অন্য করদাতার ব্যক্তিগত তথ্য দেখানো হয় না।' : 'TIN is not checked against NBR in this simulation. No other taxpayer’s private account information is shown.'}</p>
            </PaymentFormSection>

            {!embedded && <div className="flex justify-end pt-3">
              <button
                onClick={handleStep1Next}
                className="min-h-11 w-full sm:w-auto justify-center px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{copy.continueHead}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>}
            </div>
            {!embedded && <PaymentLiveSummary language={language} category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en} tin={tin} year={assessmentYear} amount={totalAmount} note={language === 'bn' ? 'পরের ধাপে খাত ও পরিমাণ ঠিক করুন। এটি সিমুলেশন মাত্র।' : 'Confirm the payment head and amount in the next section. Simulation only.'} />}
          </div>
        )}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {(step === 2 || (embedded && step === 1)) && (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__payment' : ''}`}>
            <div className="payment-form-layout__sections">
            <PaymentFormSection number={3} title={language === 'bn' ? 'কর পরিশোধের খাত' : 'Payment purpose & head'} description={language === 'bn' ? 'নির্বাচিত সেবার জন্য প্রযোজ্য খাত' : 'Select the applicable head for your chosen service'}>
            {!isWithholdingMode && <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-700">{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'} *</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[{ id: 'NON_COMPANY' as const, en: 'Person other than company', bn: 'কোম্পানি ব্যতীত ব্যক্তি' }, { id: 'COMPANY' as const, en: 'Company', bn: 'কোম্পানি' }].map(type => <label key={type.id} className={`flex gap-2 items-center border rounded-lg p-3 cursor-pointer text-xs font-semibold ${incomeTaxType === type.id ? 'border-taxpay-primary bg-blue-50' : 'border-slate-200'}`}><input type="radio" name="guest-income-type" value={type.id} checked={incomeTaxType === type.id} onChange={() => setIncomeTaxType(type.id)} />{language === 'bn' ? type.bn : type.en}</label>)}
              </div>
            </fieldset>}
            {/* Category Selector */}
            <div>
              <label htmlFor="guest-category" className="block text-xs font-semibold text-slate-700 mb-1">
                {commonCopy.category}
              </label>
              <select
                id="guest-category"
                disabled={isWithholdingMode}
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as PaymentCategory;
                  setCategory(newCat);
                  const firstInCat = V11_PAYMENT_OPTIONS.find(h => h.category === newCat && h.status === 'ACTIVE');
                  if (firstInCat) setSelectedHeadId(firstInCat.id);
                }}
                className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-medium"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {language === 'bn' ? label.bn : label.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Exact head descriptions and codes transcribed from the v11 HTML. */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-[1fr_14rem] gap-2" aria-invalid={isFieldInvalid('headId') || undefined} aria-describedby={errorDescription('headId')}>
              <legend className="block text-xs font-semibold text-slate-700 self-center">
                {copy.selectHead(availableHeads.length)}
              </legend>
                <input
                  id="guest-head-search"
                  type="text"
                  aria-label={copy.searchHead}
                  placeholder={copy.searchHead}
                  value={headSearch}
                  onChange={(e) => setHeadSearch(e.target.value)}
                  className="min-h-11 px-2.5 py-1 text-xs rounded border border-slate-300 w-full sm:w-56"
                />

              <div role="radiogroup" aria-label={language === 'bn' ? 'মাস্টার পেমেন্ট খাত' : 'Master payment head'} aria-describedby={errorDescription('headId')} className="col-span-full max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {availableHeads.map(head => {
                  const isBlocked = head.status !== 'ACTIVE';
                  const isSelected = selectedHead?.id === head.id;
                  return (
                    <label
                      key={head.id}
                      htmlFor={`guest-head-${head.id}`}
                      className={`min-h-11 p-3 text-xs flex items-start justify-between gap-3 cursor-pointer transition-colors ${
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
                          <span className="font-semibold text-slate-800" lang={language === 'bn' ? 'bn' : 'en'}>
                            {language === 'bn' ? head.nameBn : head.nameEn}
                          </span>
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                              <Lock className="w-3 h-3" />
                              {copy.blocked}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] text-slate-500 ${language === 'bn' ? '' : 'font-bengali'}`} lang={language === 'bn' ? 'en' : 'bn'}>
                          {language === 'bn' ? head.nameEn : head.nameBn}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
                          <span>{language === 'bn' ? 'মূল নথির খাত-কোড' : 'Source head code'}: <strong lang="en">{head.economicCode}</strong></span>
                        </div>
                        {head.rateNote && (
                          <div className="text-[11px] text-emerald-800 font-medium">
                            {copy.note}: <span lang="en">{head.rateNote}</span>
                          </div>
                        )}
                        {head.blockedReason && (
                          <div lang="en" className="text-[11px] text-rose-700 font-medium">
                            {head.blockedReason}
                          </div>
                        )}
                      </div>
                      <input
                        id={`guest-head-${head.id}`}
                        type="radio"
                        name="guest-payment-head"
                        value={head.id}
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => !isBlocked && setSelectedHeadId(head.id)}
                        aria-invalid={isFieldInvalid('headId') || undefined}
                        aria-describedby={errorDescription('headId')}
                        className="mt-1 min-h-11 min-w-11 shrink-0 accent-emerald-800"
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            </PaymentFormSection>

            {/* Financial Amounts Breakdown */}
            <PaymentFormSection number={4} title={language === 'bn' ? 'করবর্ষ ও পরিমাণ' : 'Assessment year & amount'} description={language === 'bn' ? 'পরিশোধের পরিমাণ লিখুন' : 'Enter the amount shown on your return, notice or order'}>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-taxpay-dark">
                {copy.amountBreakdown}
              </h3>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label htmlFor="guest-tax-amount" className="block text-slate-600 font-medium mb-1">{copy.taxAmount} *</label>
                  <input
                    id="guest-tax-amount"
                    type="number"
                    min="0"
                    aria-invalid={isFieldInvalid('taxAmount') || undefined}
                    aria-describedby={errorDescription('taxAmount')}
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="min-h-11 w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label htmlFor="guest-penalty-amount" className="block text-slate-600 font-medium mb-1">{copy.penalty}</label>
                  <input
                    id="guest-penalty-amount"
                    type="number"
                    min="0"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                    className="min-h-11 w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label htmlFor="guest-surcharge-amount" className="block text-slate-600 font-medium mb-1">{copy.surcharge}</label>
                  <input
                    id="guest-surcharge-amount"
                    type="number"
                    min="0"
                    value={surchargeAmount}
                    onChange={(e) => setSurchargeAmount(Number(e.target.value))}
                    className="min-h-11 w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label htmlFor="guest-interest-amount" className="block text-slate-600 font-medium mb-1">{copy.interest}</label>
                  <input
                    id="guest-interest-amount"
                    type="number"
                    min="0"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(Number(e.target.value))}
                    className="min-h-11 w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guest-note" className="block text-slate-600 text-xs font-medium mb-1">{copy.remarks}</label>
                <input
                  id="guest-note"
                  type="text"
                  placeholder={copy.remarksPlaceholder}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-11 w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">
                  {copy.total}
                </span>
                <span className="font-mono-plex font-bold text-lg text-taxpay-dark">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>
            </PaymentFormSection>

            {!embedded && <div className="flex flex-wrap justify-between gap-2 pt-3">
              <button
                onClick={() => setStep(1)}
                className="min-h-11 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{commonCopy.btnBack}</span>
              </button>
              {backendConfigured && (
                <button type="button" onClick={() => navigate('secure_workspace', { draftCategory: category })}
                  className="min-h-11 px-4 py-2 border border-taxpay-primary text-taxpay-primary rounded-lg text-xs sm:text-sm font-semibold focus-visible:outline focus-visible:outline-2">
                  {copy.draft}
                </button>
              )}
              <button
                onClick={handleStep2Next}
                className="min-h-11 px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{copy.continueReview}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>}
            </div>
            <PaymentLiveSummary language={language} category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en} tin={tin} year={assessmentYear} head={selectedHead ? `${selectedHead.economicCode} — ${language === 'bn' ? selectedHead.nameBn : selectedHead.nameEn}` : undefined} amount={totalAmount} breakdown={[{label:copy.taxAmount,value:taxAmount},{label:copy.penalty,value:penaltyAmount},{label:copy.surcharge,value:surchargeAmount},{label:copy.interest,value:interestAmount}]} />
          </div>
        )}

        {/* STEP 3: Review Challan & Execute Simulated Gateway */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Challan Preview Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
              <h3 className="font-serif-fraunces font-bold text-base text-slate-900 border-b border-slate-200 pb-2">
                {copy.reviewTitle}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500">{copy.payer}:</span>{' '}
                    <strong className="text-slate-900">{payerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{commonCopy.tin}:</span>{' '}
                    <strong className="font-mono-plex text-taxpay-dark">{tin}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{commonCopy.assessmentYear}:</span>{' '}
                    <strong className="text-slate-900">{assessmentYear}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{copy.jurisdiction}:</span>{' '}
                    <span className="text-slate-800">{taxZone}, {taxCircle}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500">{commonCopy.category}:</span>{' '}
                    <strong className="text-slate-900">{language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{commonCopy.headCode}:</span>{' '}
                    <strong className="font-mono-plex text-taxpay-dark">{selectedHead?.economicCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">{copy.headTitle}:</span>{' '}
                    <span className="text-slate-800">{language === 'bn' ? selectedHead?.nameBn : selectedHead?.nameEn}</span>
                  </div>
                  {isWithholdingMode && (
                    <div className="text-teal-900 font-semibold bg-teal-100/60 p-1.5 rounded">
                      {language === 'bn' ? 'এজেন্টের নামে উৎসে কর জমা হবে। eTDS-এ বরাদ্দের পর কর্তিত করদাতারা ক্রেডিট পাবেন।' : 'The withholding deposit is recorded against the agent. Deductees receive credit only after allocation in eTDS.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">{copy.grandTotal}:</span>
                <span className="font-mono-plex font-bold text-xl text-taxpay-dark">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            {/* Gateway Provider Selection */}
            <div className="space-y-3">
              <h3 id="guest-channel-heading" className="block text-xs font-bold uppercase tracking-wider text-slate-700">{copy.channel}</h3>

              <div role="group" aria-labelledby="guest-channel-heading" className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { id: 'BKASH', label: 'bKash MFS', fee: copy.noFee },
                  { id: 'NAGAD', label: 'Nagad MFS', fee: copy.noFee },
                  { id: 'ROCKET', label: 'Rocket DBBL', fee: copy.noFee },
                  { id: 'SONALI_E_SHEBA', label: 'Sonali e-Sheba', fee: copy.directTreasury },
                  { id: 'A_CHALLAN_CARD', label: 'Cards (Visa/MC)', fee: copy.govSwitch }
                ].map(gw => (
                  <button
                    key={gw.id}
                    type="button"
                    aria-pressed={paymentMethod === gw.id}
                    onClick={() => setPaymentMethod(gw.id as any)}
                    className={`min-h-14 p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      paymentMethod === gw.id
                        ? 'bg-taxpay-primary text-white border-taxpay-primary shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">{gw.label}</div>
                    <div className={`text-[10px] mt-0.5 ${paymentMethod === gw.id ? 'text-white' : 'text-slate-500'}`}>
                      {gw.fee}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation notice */}
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>{copy.simulationTitle}: </strong>{copy.simulationNotice}
              </div>
            </div>

            {!embedded && <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-between">
              <button
                disabled={isProcessing}
                onClick={() => setStep(2)}
                className="min-h-11 w-full justify-center px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5 sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{copy.backToHead}</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={handleExecutePayment}
                aria-busy={isProcessing}
                className="min-h-11 w-full justify-center px-6 py-3 bg-amber-400 hover:bg-amber-300 text-taxpay-dark font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 sm:w-auto"
              >
                {isProcessing ? (
                  <span>{copy.processing}</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-taxpay-dark" />
                    <span>{copy.runSimulation(formatCurrency(totalAmount, language))}</span>
                  </>
                )}
              </button>
            </div>}
          </div>
        )}
      </div>
      {embedded && modalFooterTarget && createPortal(
        <div className="payment-flow-embedded__footer-actions">
          {step === 1 ? (
            <button type="button" className="tax-service-choice__continue" onClick={handleEmbeddedDetailsNext}>
              {language === 'bn' ? 'পর্যালোচনা ও পরিশোধ' : 'Continue to Review & Pay'} <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : step === 3 ? (<>
            <button type="button" className="tax-service-choice__cancel" onClick={() => setStep(1)} disabled={isProcessing}>
              <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
            </button>
            <button type="button" className="tax-service-choice__continue" onClick={handleExecutePayment} disabled={isProcessing} aria-busy={isProcessing}>
              <CreditCard size={18} aria-hidden="true" />{isProcessing ? copy.processing : copy.runSimulation(formatCurrency(totalAmount, language))}
            </button>
          </>) : null}
        </div>, modalFooterTarget
      )}
    </div>
  );
};
