import React, { useState, useEffect, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  CreditCard,
  Building2,
  FileText,
  LoaderCircle,
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
import { parseGuestAmount } from '../../services/guestAmount';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';

const GUEST_COPY = {
  en: {
    withholdingMode: 'Withholding Agent Mode', publicPortal: 'Public Guest Portal',
    sourceTaxTitle: 'Source Tax Deposit (TDS / TCS)', paymentTitle: 'Guest Income Tax Payment',
    intro: 'Enter the details to prepare your payment.',
    selectedPurpose: 'Selected purpose', underReview: 'Under review', stepOf: (step: number) => `Step ${step} of 4`,
    steps: ['Taxpayer', 'Payment details', 'Review', 'Status'],
    tinPlaceholder: 'e-TIN', tinHint: 'Enter the 12-digit taxpayer identification number.',
    payerName: 'Payer Legal Name', payerNamePlaceholder: 'Your full name',
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
    searchHead: 'Search by payment head or code…', blocked: 'Unavailable', act: 'Act', legacy: 'Legacy', note: 'Note',
    amountBreakdown: 'Payment Amount Breakdown (BDT)', taxAmount: 'Tax Amount (৳)', penalty: 'Penalty (৳)',
    surcharge: 'Surcharge (৳)', interest: 'Interest (৳)', remarks: 'Payment Remarks / Invoice Reference (Optional)',
    remarksPlaceholder: 'e.g. Assessment order #190 / Salary withholding month Oct 2026', total: 'Total Payable Amount:',
    draft: 'Plan as a private draft', continueReview: 'Continue to Review', back: 'Back', backToHead: 'Back to Payment Head',
    reviewTitle: 'Payment summary', payer: 'Payer Name', jurisdiction: 'Jurisdiction',
    headTitle: 'Payment Head', unspecified: 'Unspecified', grandTotal: 'Total Amount (BDT)',
    channel: 'Payment method', noFee: 'No fee', directTreasury: 'Treasury route',
    govSwitch: 'Payment gateway',
    anotherPayment: 'Start another payment',
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
    tinPlaceholder: 'ই-টিআইএন', tinHint: '১২ সংখ্যার করদাতা শনাক্তকরণ নম্বর লিখুন।',
    payerName: 'পরিশোধকারীর নাম', payerNamePlaceholder: 'আপনার পূর্ণ নাম',
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
    searchHead: 'খাতের নাম বা কোড দিয়ে খুঁজুন…', blocked: 'নির্বাচনযোগ্য নয়', act: 'আইন', legacy: 'পূর্ববর্তী আইন', note: 'নোট',
    amountBreakdown: 'পেমেন্টের পরিমাণের হিসাব (টাকা)', taxAmount: 'কর (৳)', penalty: 'জরিমানা (৳)',
    surcharge: 'সারচার্জ (৳)', interest: 'সুদ (৳)', remarks: 'পেমেন্টের মন্তব্য / ইনভয়েস রেফারেন্স (ঐচ্ছিক)',
    remarksPlaceholder: 'যেমন: কর নির্ধারণ আদেশ #১৯০ / অক্টোবর ২০২৬-এর বেতন থেকে কর কর্তন', total: 'মোট প্রদেয় অর্থ:',
    draft: 'ব্যক্তিগত খসড়া হিসেবে পরিকল্পনা করুন', continueReview: 'পর্যালোচনায় এগিয়ে যান', back: 'পূর্ববর্তী ধাপ', backToHead: 'পেমেন্ট খাতে ফিরুন',
    reviewTitle: 'পেমেন্টের সারসংক্ষেপ', payer: 'করদাতার নাম', jurisdiction: 'এখতিয়ার',
    headTitle: 'পেমেন্ট খাত', unspecified: 'উল্লেখ করা হয়নি', grandTotal: 'মোট অর্থ (টাকা)',
    channel: 'পেমেন্ট মাধ্যম', noFee: 'কোনো ফি নেই', directTreasury: 'ট্রেজারি রুট',
    govSwitch: 'পেমেন্ট গেটওয়ে',
    anotherPayment: 'আরেকটি পেমেন্ট শুরু করুন',
    invalidTin: 'করদাতার ১২ সংখ্যার টিআইএন লিখুন।',
    requiredPayer: 'করদাতার পূর্ণ আইনগত নাম দিন।',
    requiredRepresentative: 'এগোতে প্রতিনিধির নাম ও টিআইএন দিন।',
    requiredDeductee: 'এই উৎসে কর জমার জন্য কর কর্তনগ্রহীতা (সরবরাহকারী বা সুবিধাভোগী)-এর টিআইএন দিন।',
    requiredHead: 'নির্বাচনযোগ্য একটি পেমেন্ট খাত নির্বাচন করুন।',
    blockedHead: (id: number) => `পেমেন্ট খাত #${id} পর্যালোচনাধীন; এখন এটি নির্বাচন করা যাবে না।`,
    positiveAmount: 'শূন্যের বেশি মোট অর্থ দিন।',
  },
} as const;

type GuestErrorField = 'tin' | 'payerName' | 'phone' | 'noticeReference' | 'incomeTaxType' | 'headId' | 'taxAmount';
const ERROR_ID = 'guest-payment-error';

type LifecycleStage = 'INITIATED' | 'AUTHORIZED' | 'ACS_REFERENCE_CREATED' | 'PROCESSING' | 'TREASURY_SETTLED' | 'NBR_LEDGER_POSTED' | 'CREDITED' | 'FAILED';
type PaymentPhase = 'review' | 'processing' | 'pending-bank' | 'failed' | 'settled';
const ONLINE_LIFECYCLE: LifecycleStage[] = ['INITIATED', 'AUTHORIZED', 'ACS_REFERENCE_CREATED', 'PROCESSING', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED'];
const BANK_LIFECYCLE: LifecycleStage[] = ['INITIATED', 'AUTHORIZED', 'ACS_REFERENCE_CREATED'];
const BANK_SETTLEMENT: LifecycleStage[] = ['PROCESSING', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED'];
const ONLINE_METHODS: { id: ChallanReceipt['paymentMethod']; name: string; group: string }[] = [
  { id: 'BKASH', name: 'bKash', group: 'mfs' },
  { id: 'NAGAD', name: 'Nagad', group: 'mfs' },
  { id: 'ROCKET', name: 'Rocket', group: 'mfs' },
  { id: 'INTERNET_BANKING', name: 'Internet Banking', group: 'bank' },
  { id: 'VISA', name: 'Visa', group: 'card' },
  { id: 'MASTERCARD', name: 'Mastercard', group: 'card' }
];

const statusLabels: Record<LifecycleStage, { en: string; bn: string }> = {
  INITIATED: { en: 'Payment initiated', bn: 'পরিশোধ শুরু হয়েছে' },
  AUTHORIZED: { en: 'Payment authorized', bn: 'পরিশোধ অনুমোদিত' },
  ACS_REFERENCE_CREATED: { en: 'Challan reference generated', bn: 'চালান রেফারেন্স তৈরি হয়েছে' },
  PROCESSING: { en: 'Payment processing', bn: 'পরিশোধ প্রক্রিয়াধীন' },
  TREASURY_SETTLED: { en: 'Treasury settlement received', bn: 'ট্রেজারি নিষ্পত্তি নিশ্চিত' },
  NBR_LEDGER_POSTED: { en: 'NBR ledger updated', bn: 'এনবিআর লেজার হালনাগাদ' },
  CREDITED: { en: 'Tax credit recorded', bn: 'কর ক্রেডিট লিপিবদ্ধ' },
  FAILED: { en: 'Payment declined', bn: 'পরিশোধ প্রত্যাখ্যাত' }
};

interface GuestPaymentProps {
  isWithholdingMode?: boolean;
  embedded?: boolean;
  initialCategory?: PaymentCategory;
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
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
  const [incomeTaxType, setIncomeTaxType] = useState<'NON_COMPANY' | 'COMPANY' | null>(null);
  

  // Category and Head selection
  const [category, setCategory] = useState<PaymentCategory>(
    isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' :
      (initialCategory || (typeof routeParams?.initialCategory === 'string' && CATEGORY_LABELS[routeParams.initialCategory]
        ? routeParams.initialCategory as PaymentCategory : 'TAX_WITH_RETURN'))
  );
  const [selectedHeadId, setSelectedHeadId] = useState<number>(() =>
    V11_PAYMENT_OPTIONS.find(h => h.category === category && h.status === 'ACTIVE')?.id || 1
  );
  const [headSearch, setHeadSearch] = useState('');

  // Amounts
  const [amountInput, setAmountInput] = useState('');

  // Payment gateway choice
  const [paymentChannel, setPaymentChannel] = useState<'NOW' | 'OTC' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ChallanReceipt['paymentMethod'] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('review');
  const [lifecycleStages, setLifecycleStages] = useState<LifecycleStage[]>([]);
  const [attemptReceipt, setAttemptReceipt] = useState<ChallanReceipt | null>(null);
  const lifecycleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorField, setErrorField] = useState<GuestErrorField | null>(null);

  const errorDescription = (field: GuestErrorField, hintId?: string) => {
    const ids = [hintId, errorField === field && errorMessage ? `${ERROR_ID}-${field}` : undefined].filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
  };
  const isFieldInvalid = (field: GuestErrorField) => errorField === field && Boolean(errorMessage);
  const fieldError = (field: GuestErrorField) => isFieldInvalid(field) ?
    <p id={`${ERROR_ID}-${field}`} className="payment-form-field-error" role="alert">{errorMessage}</p> : null;
  const setValidationError = (message: string, field: GuestErrorField) => {
    setErrorMessage(message);
    setErrorField(field);
  };
  const clearValidationError = () => {
    setErrorMessage('');
    setErrorField(null);
  };

  useEffect(() => {
    if (embedded) onStageChange?.(step);
  }, [embedded, onStageChange, step]);

  // The action is in a persistent footer; direct attention to the invalid input,
  // even when the user has scrolled well past it.
  useEffect(() => {
    if (!errorField || !errorMessage) return;
    const id: Record<GuestErrorField, string> = {
      tin: 'guest-tin', payerName: 'guest-payer-name', phone: 'guest-phone',
      noticeReference: 'guest-notice-ref', incomeTaxType: 'guest-income-type-NON_COMPANY',
      headId: 'guest-head-static', taxAmount: 'guest-tax-amount'
    };
    const control = document.getElementById(id[errorField]) ||
      (errorField === 'headId' ? document.querySelector<HTMLElement>('#guest-head-search, .payment-head-options input') : null);
    if (!control) return;
    const section = control.closest('details');
    if (section) section.open = true;
    control.scrollIntoView({ block: 'center', behavior: 'auto' });
    control.focus({ preventScroll: true });
  }, [errorField, errorMessage]);

  useEffect(() => () => {
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = [];
  }, []);

  // The status timeline can be long, especially in the modal. When settlement
  // completes, bring the newly available receipt into view for the taxpayer.
  useEffect(() => {
    if (step !== 4 || !createdReceipt) return;
    const frame = requestAnimationFrame(() => {
      const target = embedded
        ? document.querySelector<HTMLElement>('.payment-flow-embedded--receipt .receipt-view__header h3')
        : document.querySelector<HTMLElement>('.receipt-view--page h1');
      target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, createdReceipt, embedded]);

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
  const categoryHeads = V11_PAYMENT_OPTIONS.filter(head => head.category === category);
  const availableHeads = categoryHeads.filter(head => {
    const matchQuery = headSearch
      ? head.nameEn.toLowerCase().includes(headSearch.toLowerCase()) ||
        head.nameBn.includes(headSearch) ||
        head.economicCode.includes(headSearch) ||
        head.sectionAct2023.toLowerCase().includes(headSearch.toLowerCase())
      : true;
    return matchQuery;
  });

  // Searching only filters the displayed choices; it must not silently change the payable head.
  const selectedHead = V11_PAYMENT_OPTIONS.find(h => h.category === category && h.id === selectedHeadId);

  const parsedAmount = parseGuestAmount(amountInput);
  const totalAmount = parsedAmount ?? 0;
  const taxAmount = category === 'PENALTY' ? 0 : totalAmount;
  const penaltyAmount = category === 'PENALTY' ? totalAmount : 0;
  const surchargeAmount = 0;
  const interestAmount = 0;
  const requiresNBRReference = resolvePaymentServiceAccess(category, 'MAKE_PAYMENT').requiresNBRReference;

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
    if (requiresNBRReference && !noticeReference.trim()) {
      setValidationError(language === 'bn' ? 'এই সেবার জন্য NBR রেফারেন্স দিন।' : 'Enter the NBR reference for this payment service.', 'noticeReference');
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
    if (!isWithholdingMode && !incomeTaxType) {
      setValidationError(language === 'bn' ? 'আয়করের ধরন নির্বাচন করুন।' : 'Choose the income tax type.', 'incomeTaxType');
      return;
    }
    if (!selectedHead) {
      setValidationError(copy.requiredHead, 'headId');
      return;
    }
    if (selectedHead.status !== 'ACTIVE' || BLOCKED_HEAD_IDS.includes(selectedHead.id)) {
      setValidationError(copy.blockedHead(selectedHead.id), 'headId');
      return;
    }
    if (parsedAmount === null) {
      setValidationError(copy.positiveAmount, 'taxAmount');
      return;
    }
    clearValidationError();
    setStep(3);
  };

  const runLifecycle = (sequence: LifecycleStage[], receipt: ChallanReceipt) => {
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = sequence.map((status, index) => setTimeout(() => {
      setLifecycleStages(previous => [...previous, status]);
      if (index !== sequence.length - 1) return;
      setIsProcessing(false);
      if (status === 'FAILED') {
        setPaymentPhase('failed');
      } else if (status === 'ACS_REFERENCE_CREATED') {
        setPaymentPhase('pending-bank');
      } else if (status === 'CREDITED') {
        const settledReceipt: ChallanReceipt = {
          ...receipt,
          treasuryStatus: 'TREASURY_SCROLLED',
          treasuryScrollNo: `DEMO-SCRL-${Date.now()}`,
          treasuryDate: new Date().toISOString(),
          completedAt: new Date().toISOString()
        };
        addPaymentReceipt(settledReceipt);
        setCreatedReceipt(settledReceipt);
        setPaymentPhase('settled');
      }
    }, (index + 1) * 550));
  };

  const handleExecutePayment = () => {
    if (isProcessing || !acknowledged || !paymentChannel || !paymentMethod || !selectedHead || !(totalAmount > 0)) return;
    setIsProcessing(true);
    setPaymentPhase('processing');
    setLifecycleStages([]);
    clearValidationError();

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
        note: [noticeReference && `NBR reference: ${noticeReference.trim()}`, !isWithholdingMode && `Income tax type: ${incomeTaxType}`].filter(Boolean).join(' · ') || undefined
      };

      const newReceipt: ChallanReceipt = {
        id: `rcpt-${Date.now()}`,
        taxEventId: `TE-${year}-${Math.floor(100000 + Math.random() * 900000)}`,
        paymentTransactionId: `PT-${year}-${Math.floor(100000 + Math.random() * 900000)}`,
        challanNo: `ACS-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear,
        payerName: forSelf ? 'Taxpayer / withholding agent' : payerName.trim(),
        payerTin: 'GUEST',
        taxpayerTin: tin,
        receiptMobile: phone,
        noticeReference: noticeReference.trim() || undefined,
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
        treasuryStatus: 'INITIATED',
        // CRITICAL DOMAIN SEPARATION:
        taxCreditStatus: (isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT') 
          ? 'NOT_APPLICABLE' 
          : 'PENDING_RECONCILIATION',
        createdAt: now,
        isSimulatedDemo: true
      };
      setAttemptReceipt(newReceipt);
      setStep(4);
      runLifecycle(paymentChannel === 'OTC' ? BANK_LIFECYCLE : simulateDecline ? [...ONLINE_LIFECYCLE.slice(0, 4), 'FAILED'] : ONLINE_LIFECYCLE, newReceipt);
  };

  const simulateBankSettlement = () => {
    if (paymentPhase !== 'pending-bank' || !attemptReceipt || isProcessing) return;
    setIsProcessing(true);
    setPaymentPhase('processing');
    runLifecycle(BANK_SETTLEMENT, attemptReceipt);
  };

  const retryPayment = () => {
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = [];
    setPaymentPhase('review');
    setLifecycleStages([]);
    setAttemptReceipt(null);
    setAcknowledged(false);
    setSimulateDecline(false);
    setPaymentChannel(null);
    setPaymentMethod(null);
    setStep(3);
  };

  if (step === 4) {
    const completed = paymentPhase === 'settled';
    const bankPending = paymentPhase === 'pending-bank';
    const declined = paymentPhase === 'failed';
    const referenceReady = lifecycleStages.includes('ACS_REFERENCE_CREATED');
    return (
      <div lang={language} className={`space-y-5 ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
        <section className="payment-lifecycle" aria-labelledby="payment-lifecycle-title">
          <div className={`payment-lifecycle__heading payment-lifecycle__heading--${declined ? 'failed' : bankPending ? 'pending' : completed ? 'complete' : 'running'}`}>
            <span className="payment-lifecycle__symbol" aria-hidden="true">{isProcessing ? <LoaderCircle className="animate-spin" size={22} /> : declined ? <AlertCircle size={22} /> : bankPending ? <Building2 size={22} /> : <CheckCircle size={22} />}</span>
            <div>
              <h2 id="payment-lifecycle-title">{declined ? (language === 'bn' ? 'পরিশোধের অনুরোধ প্রত্যাখ্যাত' : 'Payment request declined') : bankPending ? (language === 'bn' ? 'ব্যাংকের জন্য পরিশোধ-স্লিপ প্রস্তুত' : 'Bank payment slip ready') : completed ? (language === 'bn' ? 'পেমেন্ট প্রক্রিয়া সম্পন্ন' : 'Payment process complete') : (language === 'bn' ? 'পরিশোধ প্রক্রিয়াধীন…' : 'Processing payment…')}</h2>
              <p>{language === 'bn' ? 'ট্যাক্স ইভেন্ট → পেমেন্ট → ACS চালান → ট্রেজারি → NBR লেজার → ক্রেডিট' : 'Tax event → payment → ACS challan → Treasury → NBR ledger → tax credit'}</p>
            </div>
          </div>
          <div className="payment-lifecycle__details">
            <dl className="payment-lifecycle__references">
              <div><dt>{language === 'bn' ? 'কর ইভেন্ট আইডি' : 'Tax event ID'}</dt><dd>{attemptReceipt?.taxEventId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'পেমেন্ট ট্রানজেকশন আইডি' : 'Payment transaction ID'}</dt><dd>{attemptReceipt?.paymentTransactionId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'ACS চালান রেফারেন্স' : 'ACS challan reference'}</dt><dd>{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</dd></div>
              <div><dt>{language === 'bn' ? 'মোট অর্থ' : 'Amount'}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
            </dl>
            <ol className="payment-lifecycle__timeline" aria-label={language === 'bn' ? 'পরিশোধের অবস্থা' : 'Payment lifecycle'} aria-live="polite" data-testid="payment-lifecycle">
              {lifecycleStages.map((status, index) => <li key={`${status}-${index}`} className={status === 'FAILED' ? 'payment-lifecycle__event--failed' : ''}>
                <span className="payment-lifecycle__event-dot" aria-hidden="true">{status === 'FAILED' ? '!' : '✓'}</span>
                <span>{status === 'CREDITED' && category === 'SOURCE_TAX_DEPOSIT'
                  ? (language === 'bn' ? 'উৎসে কর জমা নথিভুক্ত — eTDS-এ বরাদ্দ বাকি' : 'Withholding deposit recorded — eTDS allocation pending')
                  : statusLabels[status][language]}</span>
                <small>{status}</small>
              </li>)}
              {isProcessing && <li className="payment-lifecycle__waiting"><span className="payment-lifecycle__event-dot" aria-hidden="true">·</span>{language === 'bn' ? 'পরবর্তী নিশ্চিতকরণের অপেক্ষায়…' : 'Waiting for the next confirmation…'}</li>}
            </ol>
          </div>
          {bankPending && <div className="payment-lifecycle__result payment-lifecycle__result--pending">
            <FileText size={21} aria-hidden="true" />
            <div>
              <strong>{language === 'bn' ? 'এটি এখনো পরিশোধিত কর নয়' : 'This is not tax paid yet'}</strong>
              <p>{language === 'bn' ? 'স্লিপটি ১৫ দিন বৈধ। তফসিলি ব্যাংকের শাখায় রেফারেন্সটি নিয়ে যান। ব্যাংকে পরিশোধ ও ট্রেজারি নিষ্পত্তির পর কর ক্রেডিটের ধাপ আসে।' : 'The slip is valid for 15 days. Take its reference to a scheduled bank branch. Tax credit follows bank payment and Treasury settlement.'}</p>
            </div>
          </div>}
          {declined && <div className="payment-lifecycle__result payment-lifecycle__result--failed"><AlertCircle size={20} aria-hidden="true" /><p>{language === 'bn' ? 'পেমেন্ট মাধ্যমটি অনুরোধ প্রত্যাখ্যান করেছে। অন্য পদ্ধতিতে আবার চেষ্টা করুন।' : 'The payment channel declined the request. You can retry with another method.'}</p></div>}
          {completed && <div className="payment-lifecycle__result payment-lifecycle__result--complete"><CheckCircle size={20} aria-hidden="true" /><p>{language === 'bn' ? 'পেমেন্ট রেফারেন্স ও রসিদের বিবরণ নিচে দেওয়া হলো।' : 'Your payment reference and receipt details are ready below.'}</p></div>}
          <div className="payment-lifecycle__actions no-print">
            {bankPending && <><button type="button" className="payment-lifecycle__secondary" onClick={() => window.print()}><FileText size={16} />{language === 'bn' ? 'স্লিপ প্রিন্ট করুন' : 'Print payment slip'}</button>{!embedded && <button type="button" className="payment-lifecycle__primary" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'}</button>}</>}
            {declined && !embedded && <button type="button" className="payment-lifecycle__primary" onClick={retryPayment}>{language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা করুন' : 'Try another payment method'}</button>}
            {completed && <button type="button" className="payment-lifecycle__secondary" onClick={() => { setStep(1); setCreatedReceipt(null); setPaymentPhase('review'); setLifecycleStages([]); setAcknowledged(false); setPaymentChannel(null); setPaymentMethod(null); }}>{copy.anotherPayment}</button>}
          </div>
        </section>
        {createdReceipt && <div lang={language}><ReceiptView receipt={createdReceipt} embedded={embedded} onBack={embedded ? onBackToService : () => navigate('landing')} /></div>}
        {embedded && modalFooterTarget && createPortal(
          <div className="payment-flow-embedded__footer-actions">
            {bankPending && <button type="button" className="tax-service-choice__continue" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'} <ArrowRight size={17} /></button>}
            {declined && <button type="button" className="tax-service-choice__continue" onClick={retryPayment}>{language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা' : 'Try another method'} <ArrowRight size={17} /></button>}
          </div>, modalFooterTarget
        )}
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
              {copy.selectedPurpose}: <span className="taxpay-service-value" data-payment-service={category}>{language === 'bn' ? CATEGORY_LABELS[category]?.bn || copy.underReview : CATEGORY_LABELS[category]?.en || copy.underReview}</span>
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

        {/* STEP 1: Taxpayer Identification */}
        {step === 1 && (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__identity' : ''}`}>
            <div className="payment-form-layout__sections">
            <PaymentFormSection number={1} staticView={embedded} title={language === 'bn' ? 'কার জন্য পরিশোধ করছেন?' : 'Who are you paying for?'} description={language === 'bn' ? 'নিজের বা অন্যের হয়ে পরিশোধ নির্বাচন করুন' : 'Choose your relationship to the taxpayer'}>
              <div className="payment-form-choice-grid grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label={language === 'bn' ? 'পরিশোধকারীর ধরন' : 'Payer relationship'}>
                {[{ value: true, en: isWithholdingMode ? 'I am the withholding agent' : 'My own tax', bn: isWithholdingMode ? 'আমি উৎসে কর কর্তনকারী' : 'আমার নিজের কর' }, { value: false, en: isWithholdingMode ? 'Paying for the agent' : "Someone else's tax", bn: isWithholdingMode ? 'এজেন্টের পক্ষে পরিশোধ' : 'অন্য কারও কর' }].map(choice => <button type="button" key={String(choice.value)} aria-pressed={forSelf === choice.value} onClick={() => setForSelf(choice.value)} className={`min-h-14 rounded-lg border-2 p-3 text-left font-semibold text-sm ${forSelf === choice.value ? 'border-taxpay-primary bg-blue-50 text-taxpay-dark' : 'border-slate-200 text-slate-700'}`}>{language === 'bn' ? choice.bn : choice.en}</button>)}
              </div>
            </PaymentFormSection>
            <PaymentFormSection number={2} staticView={embedded} title={language === 'bn' ? 'করদাতার পরিচয়' : 'Taxpayer identification'} description={language === 'bn' ? '১২ সংখ্যার টিআইএন ও ঐচ্ছিক রেফারেন্স' : '12-digit TIN and optional NBR reference'}>
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
                  inputMode="numeric" maxLength={12} autoComplete="off" required
                  onChange={(e) => setTin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
                <span id="guest-tin-hint" className="text-[11px] text-slate-500 mt-1 block">{language === 'bn' ? '১২ সংখ্যার টিআইএন লিখুন।' : 'Enter the 12-digit TIN.'}</span>
                {fieldError('tin')}
              </div>

              {!forSelf && <div>
                <label htmlFor="guest-payer-name" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'আপনার নাম (পরিশোধকারী)' : 'Your name (payer)'} *</label>
                <input
                  id="guest-payer-name"
                  type="text"
                  aria-invalid={isFieldInvalid('payerName') || undefined}
                  aria-describedby={errorDescription('payerName')}
                  placeholder={copy.payerNamePlaceholder}
                  value={payerName}
                  required autoComplete="name"
                  onChange={(e) => setPayerName(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
                {fieldError('payerName')}
              </div>}

              <div>
                <label htmlFor="guest-phone" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'রসিদের জন্য মোবাইল নম্বর' : 'Mobile number for receipt'} *</label>
                <input
                  id="guest-phone"
                  type="tel"
                  placeholder={copy.mobilePlaceholder}
                  value={phone}
                  aria-invalid={isFieldInvalid('phone') || undefined}
                  aria-describedby={errorDescription('phone')}
                  inputMode="numeric" maxLength={11} autoComplete="tel-national" required
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
                {fieldError('phone')}
              </div>

              {!isWithholdingMode && <div>
                <label htmlFor="guest-notice-ref" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'NBR নোটিশ বা পেমেন্ট রেফারেন্স' : 'NBR notice or payment reference'} {requiresNBRReference ? '*' : (language === 'bn' ? '(ঐচ্ছিক)' : '(optional)')}</label>
                <input id="guest-notice-ref" type="text" value={noticeReference} onChange={event => setNoticeReference(event.target.value)} required={requiresNBRReference}
                  aria-invalid={isFieldInvalid('noticeReference') || undefined} aria-describedby={errorDescription('noticeReference')}
                  placeholder="PN-2026-000392" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
                {fieldError('noticeReference')}
              </div>}
            </div>
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
            {!embedded && <PaymentLiveSummary language={language} category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en} categoryCode={category} tin={tin} year={assessmentYear} amount={totalAmount} note={language === 'bn' ? 'পরের ধাপে খাত ও পরিমাণ ঠিক করুন।' : 'Confirm the payment head and amount in the next section.'} />}
          </div>
        )}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {step === 2 && (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__payment' : ''}`}>
            <div className="payment-form-layout__sections">
            <PaymentFormSection number={3} staticView={embedded} title={language === 'bn' ? 'কর পরিশোধের খাত' : 'Payment purpose & head'} description={language === 'bn' ? 'নির্বাচিত সেবার জন্য প্রযোজ্য খাত' : 'Select the applicable head for your chosen service'}>
            {!isWithholdingMode && <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-700">{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'} *</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[{ id: 'NON_COMPANY' as const, en: 'Person other than company', bn: 'কোম্পানি ব্যতীত ব্যক্তি' }, { id: 'COMPANY' as const, en: 'Company', bn: 'কোম্পানি' }].map(type => <label key={type.id} className={`flex gap-2 items-center border rounded-lg p-3 cursor-pointer text-xs font-semibold ${incomeTaxType === type.id ? 'border-taxpay-primary bg-blue-50' : 'border-slate-200'}`}><input id={`guest-income-type-${type.id}`} type="radio" name="guest-income-type" value={type.id} required checked={incomeTaxType === type.id} onChange={() => setIncomeTaxType(type.id)} aria-invalid={isFieldInvalid('incomeTaxType') || undefined} />{language === 'bn' ? type.bn : type.en}</label>)}
              </div>
              {fieldError('incomeTaxType')}
            </fieldset>}
            {/* The modal locks the category chosen in Step 1. The standalone flow retains its selector. */}
            {!embedded && <div>
              <label htmlFor="guest-category" className="block text-xs font-semibold text-slate-700 mb-1">
                {commonCopy.category}
              </label>
              <select
                id="guest-category"
                data-payment-service={category}
                disabled={isWithholdingMode}
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as PaymentCategory;
                  setCategory(newCat);
                  const firstInCat = V11_PAYMENT_OPTIONS.find(h => h.category === newCat && h.status === 'ACTIVE');
                  if (firstInCat) setSelectedHeadId(firstInCat.id);
                }}
                className="taxpay-service-select min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-medium"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {language === 'bn' ? label.bn : label.en}
                  </option>
                ))}
              </select>
            </div>}

            {/* Exact head descriptions and codes transcribed from the v11 HTML. */}
            {categoryHeads.length === 1 ? (
              <div id="guest-head-static" className="payment-head-single" tabIndex={-1}>
                <div><strong>{categoryHeads[0].economicCode} — {language === 'bn' ? categoryHeads[0].nameBn : categoryHeads[0].nameEn}</strong><small>{language === 'bn' ? 'নির্বাচিত পেমেন্ট খাত' : 'Selected payment head'}</small></div>
                <CheckCircle size={19} aria-hidden="true" />
              </div>
            ) : <fieldset className="payment-head-fieldset grid grid-cols-1 gap-2" aria-invalid={isFieldInvalid('headId') || undefined} aria-describedby={errorDescription('headId')}>
              <legend className="block text-xs font-semibold text-slate-700 self-center">
                {language === 'bn' ? 'পেমেন্ট খাত' : 'Payment head'}
              </legend>
              {categoryHeads.length > 3 && <input
                  id="guest-head-search"
                  type="text"
                  aria-label={copy.searchHead}
                  placeholder={copy.searchHead}
                  value={headSearch}
                  onChange={(e) => setHeadSearch(e.target.value)}
                  className="min-h-11 px-2.5 py-1 text-xs rounded border border-slate-300 w-full sm:w-56"
                />}

              <div role="radiogroup" aria-label={language === 'bn' ? 'মাস্টার পেমেন্ট খাত' : 'Master payment head'} aria-describedby={errorDescription('headId')} className="payment-head-options col-span-full max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {availableHeads.length === 0 && <p className="p-4 text-sm text-slate-600">{language === 'bn' ? 'কোনো মিল থাকা পেমেন্ট খাত পাওয়া যায়নি।' : 'No matching payment heads. Try another search.'}</p>}
                {availableHeads.map(head => {
                  const isBlocked = head.status !== 'ACTIVE';
                  const isSelected = selectedHead?.id === head.id;
                  return (
                    <label
                      key={head.id}
                      htmlFor={`guest-head-${head.id}`}
                      className={`payment-head-option min-h-11 p-3 text-xs flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-taxpay-primary'
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
                        className="payment-head-option__radio mt-1 shrink-0 accent-blue-700"
                      />
                    </label>
                  );
                })}
              </div>
              {categoryHeads.length > 3 && selectedHead && <p className="payment-head-selected">{language === 'bn' ? 'নির্বাচিত:' : 'Selected:'} {selectedHead.economicCode} — {language === 'bn' ? selectedHead.nameBn : selectedHead.nameEn}</p>}
            </fieldset>}
            {fieldError('headId')}
            </PaymentFormSection>

            {/* Financial Amounts Breakdown */}
            <PaymentFormSection number={4} staticView={embedded} title={language === 'bn' ? 'পরিশোধের পরিমাণ' : 'Payment amount'} description={language === 'bn' ? 'পরিশোধের পরিমাণ লিখুন' : 'Enter the amount shown on your return, notice or order'}>
            <div className="payment-amount-fields payment-amount-fields--simple">
              <div>
                <label htmlFor="guest-assessment-year" className="block text-slate-600 font-medium mb-1">{commonCopy.assessmentYear} *</label>
                <select id="guest-assessment-year" required value={assessmentYear} onChange={event => setAssessmentYear(event.target.value)} className="min-h-11 w-full px-3 py-2 rounded border border-slate-300">
                  {['2027-28', '2026-27', '2025-26', '2024-25'].map(year => <option value={year} key={year}>{year}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="guest-tax-amount" className="block text-slate-600 font-medium mb-1">{language === 'bn' ? 'পরিশোধের পরিমাণ (৳)' : 'Payment amount (৳)'} *</label>
                <input id="guest-tax-amount" type="text" inputMode="decimal" required autoComplete="off" maxLength={14}
                  placeholder="0.00" aria-invalid={isFieldInvalid('taxAmount') || undefined} aria-describedby={errorDescription('taxAmount')}
                  value={amountInput} onChange={event => setAmountInput(event.target.value)}
                  className="min-h-11 w-full px-3 py-2 rounded border border-slate-300 font-mono-plex" />
                {fieldError('taxAmount')}
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
            <PaymentLiveSummary language={language} category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en} categoryCode={category} tin={tin} year={assessmentYear} head={selectedHead ? `${selectedHead.economicCode} — ${language === 'bn' ? selectedHead.nameBn : selectedHead.nameEn}` : undefined} amount={totalAmount} />
          </div>
        )}

        {/* STEP 3: Review Challan & Execute Simulated Gateway */}
        {step === 3 && (
          <div className="payment-review" data-testid="payment-review">
            <div className="payment-review__main">
              <section className="payment-review__panel" aria-labelledby="guest-payment-channel-title">
                <div className="payment-review__section-title"><span className="payment-review__section-number">01</span><div><h2 id="guest-payment-channel-title">{language === 'bn' ? 'পেমেন্ট চ্যানেল বেছে নিন' : 'Choose payment channel'}</h2><p>{language === 'bn' ? 'অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন' : 'Choose online payment or a bank branch'}</p></div></div>
                <div className="payment-review__channels" role="group" aria-label={language === 'bn' ? 'পেমেন্ট চ্যানেল' : 'Payment channel'}>
                  <button type="button" aria-pressed={paymentChannel === 'NOW'} className={`payment-review__channel ${paymentChannel === 'NOW' ? 'payment-review__channel--selected' : ''}`} onClick={() => { setPaymentChannel('NOW'); setPaymentMethod(null); setAcknowledged(false); }}><CreditCard size={23} aria-hidden="true" /><span><strong>{language === 'bn' ? 'অনলাইনে পরিশোধ' : 'Pay online'}</strong><small>{language === 'bn' ? 'মোবাইল ব্যাংকিং, ইন্টারনেট ব্যাংকিং বা কার্ড' : 'MFS, internet banking or card'}</small></span><span className="payment-review__radio" /></button>
                  <button type="button" aria-pressed={paymentChannel === 'OTC'} className={`payment-review__channel ${paymentChannel === 'OTC' ? 'payment-review__channel--selected' : ''}`} onClick={() => { setPaymentChannel('OTC'); setPaymentMethod('BANK_BRANCH'); setAcknowledged(false); }}><Building2 size={23} aria-hidden="true" /><span><strong>{language === 'bn' ? 'ব্যাংক শাখায় পরিশোধ' : 'Pay at a bank branch'}</strong><small>{language === 'bn' ? 'আগে চালান স্লিপ, পরে ব্যাংকে পরিশোধ' : 'Generate a challan slip, then pay at the bank'}</small></span><span className="payment-review__radio" /></button>
                </div>
                {paymentChannel === 'NOW' && <div className="payment-review__methods">
                  {(['bank', 'mfs', 'card'] as const).map(group => <fieldset key={group}>
                    <legend>{group === 'bank' ? (language === 'bn' ? 'ব্যাংক' : 'Bank') : group === 'mfs' ? (language === 'bn' ? 'মোবাইল আর্থিক সেবা' : 'Mobile financial services') : (language === 'bn' ? 'কার্ড' : 'Cards')}</legend>
                    <div className="payment-review__method-list">{ONLINE_METHODS.filter(method => method.group === group).map(method => <label key={method.id} className={`payment-review__method ${paymentMethod === method.id ? 'payment-review__method--selected' : ''}`}><input type="radio" name="guest-gateway-method" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />{method.name}</label>)}</div>
                  </fieldset>)}
                  <label className="payment-review__fail-toggle"><input type="checkbox" checked={simulateDecline} onChange={e => setSimulateDecline(e.target.checked)} />{language === 'bn' ? 'প্রত্যাখ্যাত পেমেন্টের ফল দেখুন' : 'Show declined payment outcome'}</label>
                </div>}
                {paymentChannel === 'OTC' && <p className="payment-review__bank-note"><Info size={16} aria-hidden="true" />{language === 'bn' ? 'চালান তৈরি হওয়া মানেই কর পরিশোধ নয়। ব্যাংকের অর্থ ট্রেজারিতে নিষ্পন্ন হলে তবেই কর ক্রেডিট।' : 'Generating a challan does not mean tax is paid. Tax credit follows bank payment and Treasury settlement.'}</p>}
              </section>
              <section className="payment-review__panel" aria-labelledby="guest-payment-summary-title">
                <div className="payment-review__section-title"><span className="payment-review__section-number">02</span><div><h2 id="guest-payment-summary-title">{copy.reviewTitle}</h2><p>{language === 'bn' ? 'চূড়ান্ত করার আগে করদাতা, খাত ও পরিমাণ যাচাই করুন' : 'Check the taxpayer, payment head and amount before submitting'}</p></div></div>
                <dl className="payment-review__rows">
                  <div><dt>{language === 'bn' ? 'যাঁর কর পরিশোধ হচ্ছে' : 'Taxpayer TIN'}</dt><dd className="font-mono-plex">{tin}</dd></div>
                  <div><dt>{language === 'bn' ? 'পরিশোধকারী' : 'Payer'}</dt><dd>{forSelf ? (language === 'bn' ? 'করদাতা নিজে' : 'Taxpayer (self)') : (payerName || copy.unspecified)}</dd></div>
                  <div><dt>{language === 'bn' ? 'পরিশোধের উদ্দেশ্য' : 'Payment purpose'}</dt><dd className="taxpay-service-value" data-payment-service={category}>{language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en}</dd></div>
                  <div><dt>{language === 'bn' ? 'পেমেন্ট খাত' : 'Payment head'}</dt><dd>{selectedHead?.economicCode} — {language === 'bn' ? selectedHead?.nameBn : selectedHead?.nameEn}</dd></div>
                  {category !== 'SOURCE_TAX_DEPOSIT' && <div><dt>{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'}</dt><dd>{incomeTaxType === 'COMPANY' ? (language === 'bn' ? 'কোম্পানি' : 'Company') : (language === 'bn' ? 'কোম্পানি ব্যতীত ব্যক্তি' : 'Person other than company')}</dd></div>}
                  <div><dt>{commonCopy.assessmentYear}</dt><dd>{assessmentYear}</dd></div>
                  {noticeReference.trim() && <div><dt>{language === 'bn' ? 'NBR রেফারেন্স' : 'NBR reference'}</dt><dd>{noticeReference}</dd></div>}
                  <div><dt>{language === 'bn' ? 'রসিদের মোবাইল' : 'Receipt mobile'}</dt><dd className="font-mono-plex">{phone.replace(/\d(?=\d{3})/g, '•')}</dd></div>
                  <div><dt>{language === 'bn' ? 'ক্রেডিট হবে' : 'Credited to'}</dt><dd>{category === 'SOURCE_TAX_DEPOSIT' ? (language === 'bn' ? 'eTDS-এ বরাদ্দের পর কর্তিত ব্যক্তিদের, এজেন্টের নয়' : 'Deductees after allocation in eTDS, never the agent') : (language === 'bn' ? 'উল্লেখিত টিআইএন-এর করদাতার হিসাবে' : 'The taxpayer with the stated TIN, not the payer')}</dd></div>
                </dl>
              </section>
            </div>
            <aside className="payment-review__aside" aria-label={language === 'bn' ? 'মোট পেমেন্ট ও নিশ্চিতকরণ' : 'Payment total and confirmation'}>
              <div className="payment-review__total-card">
                <p className="payment-review__total-label">{language === 'bn' ? 'মোট পরিশোধের পরিমাণ' : 'Payment Amount'}</p>
                <strong className="payment-review__total-figure">{formatCurrency(totalAmount, language)}</strong>
                <dl className="payment-review__breakdown">
                  <div><dt>{language === 'bn' ? 'পরিশোধের পরিমাণ' : 'Payment amount'}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
                  <div className="payment-review__breakdown-fee"><dt>{language === 'bn' ? 'সার্ভিস চার্জ' : 'Service charge'}</dt><dd>{formatCurrency(0, language)}</dd></div>
                </dl>
              </div>
              <label className="payment-review__ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>{category === 'SOURCE_TAX_DEPOSIT' ? (language === 'bn' ? 'এজেন্টের টিআইএন, কর্তনের খাত, করবর্ষ ও পরিমাণ ঠিক আছে; eTDS-এ বরাদ্দ না হওয়া পর্যন্ত কর্তিত করদাতারা ক্রেডিট পাবেন না।' : 'I have checked the agent TIN, deduction head, year and amount. Deductees get credit only after allocation in eTDS.') : (language === 'bn' ? 'আমি টিআইএন, পরিশোধের উদ্দেশ্য ও খাত, আয়করের ধরন, করবর্ষ ও পরিমাণ যাচাই করেছি; ক্রেডিট করদাতার হিসাবে যাবে।' : 'I have checked the TIN, purpose and head, income tax type, assessment year and amount. Credit goes to the taxpayer, not the payer.')}</span></label>
            </aside>
            {!embedded && <div className="payment-review__standalone-actions">
              <button type="button" className="payment-review__back" onClick={() => setStep(2)}><ArrowLeft size={17} />{copy.backToHead}</button>
              <button type="button" className="payment-review__pay" onClick={handleExecutePayment} disabled={!paymentChannel || !paymentMethod || !acknowledged || isProcessing}>{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}<ArrowRight size={17} /></button>
            </div>}
          </div>
        )}
      </div>
      {embedded && modalFooterTarget && createPortal(
        <div className="payment-flow-embedded__footer-actions">
          {step === 1 ? (
            <>
              <button type="button" className="tax-service-choice__cancel" onClick={onBackToService} aria-label={language === 'bn' ? 'পেমেন্ট অপশনে ফিরুন' : 'Back to payment options'}>
                <ArrowLeft size={17} aria-hidden="true" /><span className="payment-flow-embedded__action-long">{language === 'bn' ? 'পেমেন্ট অপশনে ফিরুন' : 'Back to payment options'}</span><span className="payment-flow-embedded__action-short" aria-hidden="true">{commonCopy.btnBack}</span>
              </button>
              <button type="button" className="tax-service-choice__continue" aria-label={language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount'} onClick={handleStep1Next}>
                <span className="payment-flow-embedded__action-long">{language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount'}</span><span className="payment-flow-embedded__action-short" aria-hidden="true">{language === 'bn' ? 'পরিমাণ' : 'Amount'}</span><ArrowRight size={18} aria-hidden="true" />
              </button>
            </>
          ) : step === 2 ? (<>
            <button type="button" className="tax-service-choice__cancel" onClick={() => { clearValidationError(); setStep(1); }}>
              <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
            </button>
            <button type="button" className="tax-service-choice__continue" aria-label={language === 'bn' ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel'} onClick={handleStep2Next}>
              <span className="payment-flow-embedded__action-long">{language === 'bn' ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel'}</span><span className="payment-flow-embedded__action-short" aria-hidden="true">{language === 'bn' ? 'চ্যানেল' : 'Channel'}</span><ArrowRight size={18} aria-hidden="true" />
            </button>
          </>) : step === 3 ? (<>
            <button type="button" className="tax-service-choice__cancel" onClick={() => setStep(2)} disabled={isProcessing}>
              <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
            </button>
            <button type="button" className="tax-service-choice__continue" onClick={handleExecutePayment} disabled={isProcessing || !paymentChannel || !paymentMethod || !acknowledged} aria-busy={isProcessing}>
              {paymentChannel === 'OTC' ? <FileText size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}
            </button>
          </>) : null}
        </div>, modalFooterTarget
      )}
    </div>
  );
};
