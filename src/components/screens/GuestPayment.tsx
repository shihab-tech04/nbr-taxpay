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
  Lock,
  Search
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
import { PaymentRadioCard } from '../ui/PaymentRadioCard';
import { PaymentMethodSelector } from '../ui/PaymentMethodSelector';
import { PaymentJourneyFooter } from '../ui/PaymentJourneyFooter';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';
import { parseGuestAmount, sumGuestAmounts, normalizeGuestAmountInput } from '../../services/guestAmount';
import { paymentAmountRowColumns } from '../../services/paymentAmountLayout';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';
import { findV11GuestNotice, type V11GuestNotice } from '../../services/v11GuestInput';
import { useAccountIdentity } from '../../services/accountIdentity';
import { usePaymentAccountProfile } from '../../services/paymentAccountProfile';
import { getStorySessionId, persistSimulatedPayment, type StoryPaymentInput } from '../../services/simulatedPaymentStory';
import { OtherTaxTaxpayerList } from './OtherTaxTaxpayerList';
import { OtherTaxBatchComposer, otherTaxAllocationTotal, otherTaxAllocationHead, isOtherTaxHeadEligible, OTHER_TAX_YEARS, type OtherTaxTaxpayer, type OtherTaxAllocation } from './OtherTaxBatchComposer';

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
    positiveAmount: 'Enter an amount greater than zero for each selected payment head.',
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
    positiveAmount: 'প্রতিটি নির্বাচিত খাতের জন্য শূন্যের বেশি অর্থ দিন।',
  },
} as const;

type GuestErrorField = 'payerChoice' | 'tin' | 'payerName' | 'phone' | 'noticeReference' | 'incomeTaxType' | 'headId' | 'taxAmount';
const ERROR_ID = 'guest-payment-error';

type LifecycleStage = 'INITIATED' | 'AUTHORIZED' | 'ACS_REFERENCE_CREATED' | 'PROCESSING' | 'TREASURY_SETTLED' | 'NBR_LEDGER_POSTED' | 'CREDITED' | 'FAILED';
type PaymentPhase = 'review' | 'processing' | 'pending-bank' | 'failed' | 'settled';
const ONLINE_LIFECYCLE: LifecycleStage[] = ['INITIATED', 'AUTHORIZED', 'ACS_REFERENCE_CREATED', 'PROCESSING', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED'];
const BANK_LIFECYCLE: LifecycleStage[] = ['INITIATED', 'AUTHORIZED', 'ACS_REFERENCE_CREATED'];
const BANK_SETTLEMENT: LifecycleStage[] = ['PROCESSING', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED'];
// v11 IT_TYPES: descriptions and government accounting codes are independent
// of the legacy payment-head codes in the 170-row NBR law master.
const INCOME_TAX_TYPES = [
  {
    id: 'NON_COMPANY' as const,
    shortEn: 'Person other than company', shortBn: 'কোম্পানি ব্যতীত ব্যক্তি',
    codes: '0111 → 1111101',
    en: 'Income tax payable by persons other than companies (old code: 0111; new code: 1111101)',
    bn: 'কোম্পানি ব্যতীত অন্য ব্যক্তি (person) কর্তৃক দেয় আয়কর (পুরাতন কোড: ০১১১; নতুন কোড: ১১১১১০১)',
  },
  {
    id: 'COMPANY' as const,
    shortEn: 'Company', shortBn: 'কোম্পানি',
    codes: '0101 → 1112101',
    en: 'Income tax payable by companies (old code: 0101; new code: 1112101)',
    bn: 'কোম্পানিসমূহ কর্তৃক দেয় আয়কর (পুরাতন কোড: ০১০১; নতুন কোড: ১১১২১০১)',
  },
] as const;

const governmentAccountingCode = (category: PaymentCategory, taxType: 'NON_COMPANY' | 'COMPANY' | null) => {
  if (!taxType) return null;
  if (category === 'ADVANCE_TAX') return taxType === 'COMPANY' ? '1112102' : '1111102';
  return taxType === 'COMPANY' ? '1112101' : '1111101';
};

const statusLabels: Record<LifecycleStage, { en: string; bn: string }> = {
  INITIATED: { en: 'Payment simulation started', bn: 'পেমেন্ট সিমুলেশন শুরু হয়েছে' },
  AUTHORIZED: { en: 'Demo authorization step simulated', bn: 'ডেমো অনুমোদন ধাপ সিমুলেট করা হয়েছে' },
  ACS_REFERENCE_CREATED: { en: 'Demo reference generated — not a government challan', bn: 'ডেমো রেফারেন্স তৈরি হয়েছে — সরকারি চালান নয়' },
  PROCESSING: { en: 'Payment simulation processing', bn: 'পেমেন্ট সিমুলেশন প্রক্রিয়াধীন' },
  TREASURY_SETTLED: { en: 'Treasury step simulated — no funds received', bn: 'ট্রেজারি ধাপ সিমুলেট করা হয়েছে — কোনো অর্থ গ্রহণ করা হয়নি' },
  NBR_LEDGER_POSTED: { en: 'Ledger step simulated — no posting', bn: 'লেজার ধাপ সিমুলেট করা হয়েছে — কোনো পোস্টিং হয়নি' },
  CREDITED: { en: 'Simulated credit step — no tax credit issued', bn: 'ক্রেডিট ধাপ সিমুলেট করা হয়েছে — কর ক্রেডিট দেওয়া হয়নি' },
  FAILED: { en: 'Simulation request declined', bn: 'সিমুলেশন অনুরোধ প্রত্যাখ্যাত' }
};

interface GuestPaymentProps {
  isWithholdingMode?: boolean;
  embedded?: boolean;
  withAccount?: boolean;
  initialCategory?: PaymentCategory;
  /** Payer relationship is chosen before service selection in the Pay Tax modal. */
  initialForSelf?: boolean;
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
}

export const GuestPayment: React.FC<GuestPaymentProps> = ({ isWithholdingMode = false, embedded = false, withAccount = false, initialCategory, initialForSelf, onBackToService, onStageChange }) => {
  const { language, navigate, addPaymentReceipt, routeParams, previewAccount } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  // The standalone guest route can also be visited from a signed-in session.
  const signedInAccount = withAccount || Boolean(authenticatedUser || previewAccount);
  const accountTaxpayer = usePaymentAccountProfile(signedInAccount ? authenticatedUser?.id ?? null : null, signedInAccount ? previewAccount : null);
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const commonCopy = UI_STRINGS[language];
  const copy = GUEST_COPY[language];

  // Wizard state steps: 1: Taxpayer & Identification, 2: Head & Amount, 3: Review & Gateway, 4: Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form inputs
  const [tin, setTin] = useState('');
  const [payerName, setPayerName] = useState('');
  const [otherTaxpayerName, setOtherTaxpayerName] = useState('');
  const [additionalTaxpayers, setAdditionalTaxpayers] = useState<OtherTaxTaxpayer[]>([]);
  const [invalidBatchTaxpayerId, setInvalidBatchTaxpayerId] = useState<string | null>(null);
  const [otherTaxLines, setOtherTaxLines] = useState<OtherTaxAllocation[]>([]);
  const [phone, setPhone] = useState('');
  const [assessmentYear, setAssessmentYear] = useState('2026-27');
  // The later approved UX supersedes v11's preselected "My own tax" default.
  const [forSelf, setForSelf] = useState<boolean | null>(initialForSelf ?? null);
  const ownAccountTax = signedInAccount && forSelf === true;
  const ownProfile = ownAccountTax ? accountTaxpayer.profile : null;
  const accountName = ownProfile ? language === 'bn' ? ownProfile.nameBn : ownProfile.nameEn : '';
  const taxpayerTin = ownAccountTax ? ownProfile?.tin ?? '' : tin;
  const receiptPhone = ownProfile?.receiptMobile ?? phone;
  const taxZone = ownProfile?.taxZone ?? '—';
  const taxCircle = ownProfile?.taxCircle ?? '—';
  const [noticeReference, setNoticeReference] = useState('');
  const [verifiedReference, setVerifiedReference] = useState<V11GuestNotice | null>(null);
  const tinAttempts = useRef<number[]>([]);
  const [incomeTaxType, setIncomeTaxType] = useState<'NON_COMPANY' | 'COMPANY' | null>(null);
  

  // Category and Head selection
  const [category, setCategory] = useState<PaymentCategory>(
    isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' :
      (initialCategory || (typeof routeParams?.initialCategory === 'string' && CATEGORY_LABELS[routeParams.initialCategory]
        ? routeParams.initialCategory as PaymentCategory : 'TAX_WITH_RETURN'))
  );
  const [selectedHeadIds, setSelectedHeadIds] = useState<number[]>([]);
  const otherBatch = !isWithholdingMode && forSelf === false && category === 'OTHER_TAX_PAYMENT';
  const batchTaxpayers: OtherTaxTaxpayer[] = [{ id: 'primary', tin: taxpayerTin, name: otherTaxpayerName }, ...additionalTaxpayers];
  const batchAmount = otherTaxAllocationTotal(otherTaxLines);
  const batchValid = otherTaxLines.length > 0 && batchAmount !== null && batchAmount > 0
    && otherTaxLines.every(line => isOtherTaxHeadEligible(line.headId)
      && batchTaxpayers.some(person => person.id === line.taxpayerId)
      && OTHER_TAX_YEARS.some(year => year === line.assessmentYear));

  const [headSearch, setHeadSearch] = useState('');
  const [headSearchDraft, setHeadSearchDraft] = useState('');

  // Preserve the exact amount allocated to each selected head, including when a search hides it.
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({});

  // Payment gateway choice
  const [paymentChannel, setPaymentChannel] = useState<'NOW' | 'OTC' | null>(null);
  const [methodGroup, setMethodGroup] = useState<'mfs' | 'bank' | 'card' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ChallanReceipt['paymentMethod'] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('review');
  const [lifecycleStages, setLifecycleStages] = useState<LifecycleStage[]>([]);
  const [attemptReceipt, setAttemptReceipt] = useState<ChallanReceipt | null>(null);
  const lifecycleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const pendingStoryRef = useRef<{ payload: StoryPaymentInput; receipt: ChallanReceipt } | null>(null);
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorField, setErrorField] = useState<GuestErrorField | null>(null);
  const [errorHeadId, setErrorHeadId] = useState<number | null>(null);

  const errorDescription = (field: GuestErrorField, hintId?: string) => {
    const ids = [hintId, errorField === field && errorMessage ? `${ERROR_ID}-${field}` : undefined].filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
  };
  const isFieldInvalid = (field: GuestErrorField) => errorField === field && Boolean(errorMessage);
  const fieldError = (field: GuestErrorField) => isFieldInvalid(field) ?
    <p id={`${ERROR_ID}-${field}`} className="payment-form-field-error" role="alert">{errorMessage}</p> : null;
  const setValidationError = (message: string, field: GuestErrorField, headId: number | null = null) => {
    setErrorMessage(message);
    setErrorField(field);
    setErrorHeadId(headId);
  };
  const clearValidationError = () => {
    setErrorMessage('');
    setErrorField(null);
    setErrorHeadId(null);
    setInvalidBatchTaxpayerId(null);
  };

  const clearReferenceSelection = () => {
    if (!verifiedReference) return;
    setVerifiedReference(null);
    setSelectedHeadIds([]);
    setAmountInputs({});
  };

  useEffect(() => {
    if (embedded) onStageChange?.(step);
  }, [embedded, onStageChange, step]);

  // The action is in a persistent footer; direct attention to the invalid input,
  // even when the user has scrolled well past it.
  useEffect(() => {
    if (!errorField || !errorMessage) return;
    const id: Record<GuestErrorField, string> = {
      payerChoice: 'guest-payer-self', tin: invalidBatchTaxpayerId && invalidBatchTaxpayerId !== 'primary' ? `other-tax-tin-${invalidBatchTaxpayerId}` : 'guest-tin', payerName: 'guest-payer-name', phone: 'guest-phone',
      noticeReference: 'guest-notice-ref', incomeTaxType: 'guest-income-type-NON_COMPANY',
      headId: 'guest-head-static', taxAmount: errorHeadId && selectedHeadIds.length > 0 && selectedHeadIds[0] !== errorHeadId ? `guest-tax-amount-${errorHeadId}` : 'guest-tax-amount'
    };
    const control = document.getElementById(id[errorField]) ||
      (errorField === 'headId' ? document.querySelector<HTMLElement>('#guest-head-search, .payment-head-options input') : null);
    if (!control) return;
    const section = control.closest('details');
    if (section) section.open = true;
    control.scrollIntoView({ block: 'center', behavior: 'auto' });
    control.focus({ preventScroll: true });
  }, [errorField, errorMessage, errorHeadId, selectedHeadIds, invalidBatchTaxpayerId]);

  useEffect(() => () => {
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = [];
  }, []);

  // The status timeline can be long, especially in the modal. When settlement
  // completes, bring the newly available receipt into view for the taxpayer.
  useEffect(() => {
    if (step !== 4 || !createdReceipt || !showReceiptDetails) return;
    const frame = requestAnimationFrame(() => {
      const target = embedded
        ? document.querySelector<HTMLElement>('.payment-flow-embedded--receipt .receipt-view__header h3')
        : document.querySelector<HTMLElement>('.receipt-view--page h1');
      target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, createdReceipt, embedded, showReceiptDetails]);

  useEffect(() => {
    if (isWithholdingMode) {
      setCategory('SOURCE_TAX_DEPOSIT');
      setSelectedHeadIds([]);
    }
  }, [isWithholdingMode]);

  useEffect(() => {
    const requestedCategory = initialCategory || routeParams?.initialCategory;
    if (!isWithholdingMode && requestedCategory && CATEGORY_LABELS[requestedCategory]) {
      const next = requestedCategory as PaymentCategory;
      setCategory(next);
      setSelectedHeadIds([]);
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

  // Searching filters the list only. Each selected head remains in the payment and calculation.
  // The sole eligible head is implicit in the selected service. This keeps
  // its amount input visible even after editing a reference or taxpayer TIN.
  const selectedHeads = categoryHeads.length === 1
    ? categoryHeads.filter(head => head.status === 'ACTIVE' && !BLOCKED_HEAD_IDS.includes(head.id))
    : categoryHeads.filter(head => selectedHeadIds.includes(head.id));
  const selectedHead = selectedHeads[0];
  const amountRowColumns = paymentAmountRowColumns(selectedHeads.length);
  const amountRawForHead = (headId: number) => verifiedReference ? String(verifiedReference.amount) : amountInputs[headId] || '';
  const headAmount = (headId: number) => parseGuestAmount(amountRawForHead(headId)) ?? 0;
  const validAmountInputs = selectedHeads.map(head => amountRawForHead(head.id)).filter(raw => parseGuestAmount(raw) !== null);
  const summedAmount = verifiedReference && selectedHeads.length > 1 ? null : sumGuestAmounts(validAmountInputs);
  const amountsValid = selectedHeads.length > 0 && validAmountInputs.length === selectedHeads.length && summedAmount !== null;
  const totalAmount = otherBatch ? batchAmount ?? 0 : summedAmount ?? 0;
  const requiresNBRReference = resolvePaymentServiceAccess(category, 'MAKE_PAYMENT').requiresNBRReference;
  const paymentCalculation = otherBatch ? <PaymentLiveSummary language={language}
    category={language === 'bn' ? 'অন্যান্য কর পরিশোধ' : 'Other Tax Payment'}
    categoryCode={category} tin={batchTaxpayers.length > 1 ? undefined : taxpayerTin}
    year={otherTaxLines.length === 1 ? otherTaxLines[0].assessmentYear : undefined}
    amount={batchAmount}
    helpText={!batchValid && otherTaxLines.length > 0
      ? language === 'bn' ? 'সব নির্বাচিত খাতের পরিমাণ সম্পূর্ণ হলে মোট হিসাব দেখা যাবে।' : 'Complete every selected amount to see the final total.'
      : undefined}
    breakdown={otherTaxLines.map(line => {
      const head = otherTaxAllocationHead(line.headId);
      const person = batchTaxpayers.find(t => t.id === line.taxpayerId);
      return {
        label: `${head?.economicCode || ''} — ${language === 'bn' ? head?.nameBn : head?.nameEn}`,
        detail: `${person?.name ? person.name + ' · ' : ''}${person?.tin || ''} · ${line.assessmentYear}`,
        value: otherTaxAllocationTotal([line])
      };
    })} /> : <PaymentLiveSummary language={language}
    category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en}
    categoryCode={category} tin={taxpayerTin} year={assessmentYear}
    head={category === 'TAX_WITH_RETURN'
      // The original v11 "74" is preserved as source provenance, not presented as current law.
      // Return-tax context is displayed inline with the amount, not in a second summary row.
      ? undefined
      : selectedHeads.length === 1
        ? `${selectedHead?.economicCode} — ${language === 'bn' ? selectedHead?.nameBn : selectedHead?.nameEn}`
        : undefined}
    amount={summedAmount}
    breakdown={step >= 3 ? [
      ...(selectedHeads.length > 1 ? selectedHeads.map(head => ({ label: `${head.economicCode} — ${language === 'bn' ? head.nameBn : head.nameEn}`, value: parseGuestAmount(amountRawForHead(head.id)) })) : [{ label: language === 'bn' ? 'পরিশোধের পরিমাণ' : 'Payment amount', value: totalAmount }]),
      { label: language === 'bn' ? 'সার্ভিস চার্জ' : 'Service charge', value: 0 }
    ] : selectedHeads.length > 1 ? selectedHeads.map(head => ({ label: `${head.economicCode} — ${language === 'bn' ? head.nameBn : head.nameEn}`, value: parseGuestAmount(amountRawForHead(head.id)) })) : undefined} />;

  const validateIdentity = () => {
    if (forSelf === null) {
      setValidationError(language === 'bn' ? 'কার জন্য পরিশোধ করছেন নির্বাচন করুন।' : 'Choose who you are paying for.', 'payerChoice');
      return false;
    }
    if (ownAccountTax && !ownProfile) {
      setValidationError(language === 'bn' ? 'এই অ্যাকাউন্টের সঙ্গে করদাতার তথ্য যুক্ত নেই।' : 'No taxpayer profile is linked to this account.', 'tin');
      return false;
    }
    if (!/^\d{12,13}$/.test(taxpayerTin)) {
      setValidationError(copy.invalidTin, 'tin');
      return false;
    }
    if (otherBatch) {
      const seenTins = new Set<string>();
      const invalidPerson = batchTaxpayers.find(person => {
        if (!/^\d{12}$/.test(person.tin) || seenTins.has(person.tin)) return true;
        seenTins.add(person.tin);
        return false;
      });
      if (invalidPerson) {
        setInvalidBatchTaxpayerId(invalidPerson.id);
        setValidationError(language === 'bn' ? 'প্রত্যেক করদাতার আলাদা ১২ সংখ্যার টিআইএন দিন। নাম ঐচ্ছিক।' :
          'Enter a different 12-digit TIN for each taxpayer. Names are optional.', 'tin');
        return false;
      }
    }
    if (otherBatch && !/^01\d{9}$/.test(receiptPhone)) {
      setValidationError(language === 'bn' ? 'রসিদের জন্য ১১ সংখ্যার মোবাইল নম্বর দিন।' :
        'Enter an 11-digit Bangladeshi mobile number for the receipt.', 'phone');
      return false;
    }
    if (!forSelf && payerName.trim().length < 2) {
      setValidationError(copy.requiredPayer, 'payerName');
      return false;
    }
    // Preserve the existing optional sample-reference behavior for the older
    // 12-digit v11 fixture tests. New 13-digit simulated payer profiles do not
    // require a reference lookup or an authenticated account.
    const reference = noticeReference.trim();
    const shouldMatchSample = !!reference && /^\d{12}$/.test(taxpayerTin) && !isWithholdingMode && !ownAccountTax;
    const matched = shouldMatchSample ? findV11GuestNotice(taxpayerTin, reference) : null;
    if (shouldMatchSample && (!matched || matched.category !== category)) {
      setValidationError(language === 'bn' ? 'এই তথ্য নিশ্চিত করা যায়নি। টিআইএন ও রেফারেন্স মিলিয়ে দেখুন।' : 'We could not confirm these details. Check the TIN and reference.', 'noticeReference');
      return false;
    }
    setVerifiedReference(matched);
    if (matched) {
      setNoticeReference(matched.reference);
      setAssessmentYear(matched.assessmentYear);
      setSelectedHeadIds(matched.defaultHeadId ? [matched.defaultHeadId] : []);
      setAmountInputs({});
    }
    clearValidationError();
    return true;
  };

  const handleStep1Next = () => {
    if (!validateIdentity()) return;
    setStep(2);
  };

  const handleStep2Next = () => {
    if (otherBatch) {
      const invalid = otherTaxLines.find(line =>
        !isOtherTaxHeadEligible(line.headId) || !OTHER_TAX_YEARS.some(year => year === line.assessmentYear) ||
        !batchTaxpayers.some(taxpayer => taxpayer.id === line.taxpayerId) ||
        otherTaxAllocationTotal([line]) === null);
      if (!batchValid || invalid) {
        const message = otherTaxLines.length === 0
          ? language === 'bn' ? 'এগোনোর আগে অন্তত একটি পরিশোধের খাত নির্বাচন করুন।' : 'Select at least one payment head to continue.'
          : invalid
            ? language === 'bn' ? 'লাল রঙে চিহ্নিত খাতগুলোর করবর্ষ ও শূন্যের বেশি পরিমাণ পূরণ করুন।' : 'Correct the highlighted payment heads: each needs a valid assessment year and positive amount.'
            : language === 'bn' ? 'মোট পরিমাণ সীমার বাইরে। প্রতিটি পরিমাণ পরীক্ষা করুন।' : 'The combined amount is outside the supported limit. Review the amounts.';
        setValidationError(message, 'headId');
        return;
      }
      clearValidationError();
      setStep(3);
      return;
    }
    if (!isWithholdingMode && !incomeTaxType) {
      setValidationError(language === 'bn' ? 'আয়করের ধরন নির্বাচন করুন।' : 'Choose the income tax type.', 'incomeTaxType');
      return;
    }
    if (!selectedHeads.length) {
      setValidationError(copy.requiredHead, 'headId');
      return;
    }
    const blocked = selectedHeads.find(head => head.status !== 'ACTIVE' || BLOCKED_HEAD_IDS.includes(head.id));
    if (blocked) {
      setValidationError(copy.blockedHead(blocked.id), 'headId');
      return;
    }
    if (!amountsValid) {
      const firstInvalid = selectedHeads.find(head => parseGuestAmount(amountInputs[head.id] || '') === null);
      setValidationError(firstInvalid ? `${copy.positiveAmount} ${firstInvalid.economicCode} — ${language === 'bn' ? firstInvalid.nameBn : firstInvalid.nameEn}` : (language === 'bn' ? 'মোট পরিমাণ অনেক বেশি।' : 'The combined payment amount is too large.'), 'taxAmount', firstInvalid?.id);
      return;
    }
    clearValidationError();
    setStep(3);
  };

  const confirmSimulatedPayment = async (receipt: ChallanReceipt) => {
    const pending = pendingStoryRef.current;
    if (!pending) { setPaymentPhase('failed'); setIsProcessing(false); return; }
    try {
      const confirmed = await persistSimulatedPayment(pending.payload);
      const settledReceipt: ChallanReceipt = {
        ...receipt,
        paymentTransactionId: confirmed.id,
        treasuryStatus: 'GATEWAY_SUCCESS',
        treasuryScrollNo: undefined,
        treasuryDate: undefined,
        completedAt: new Date().toISOString()
      };
      setLifecycleStages(previous => [...previous, 'CREDITED']);
      addPaymentReceipt(settledReceipt);
      setAttemptReceipt(settledReceipt);
      setCreatedReceipt(settledReceipt);
      setPaymentPhase('settled');
      pendingStoryRef.current = null;
    } catch {
      // TaxPay SQL may already contain the idempotent record; preserve the
      // exact request so retry cannot duplicate or lose the Office mirror.
      setErrorMessage(language === 'bn' ? 'অফিসে তথ্য পৌঁছায়নি। একই পেমেন্ট আবার চেষ্টা করুন।' : 'Office synchronization is pending. Retry this payment.');
      setPaymentPhase('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const runLifecycle = (sequence: LifecycleStage[], receipt: ChallanReceipt) => {
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = sequence.map((status, index) => setTimeout(() => {
      if (status !== 'CREDITED') setLifecycleStages(previous => [...previous, status]);
      if (index !== sequence.length - 1) return;
      if (status === 'FAILED') {
        setIsProcessing(false);
        setPaymentPhase('failed');
      } else if (status === 'ACS_REFERENCE_CREATED') {
        setIsProcessing(false);
        setPaymentPhase('pending-bank');
      } else if (status === 'CREDITED') {
        void confirmSimulatedPayment(receipt);
      }
    }, (index + 1) * 550));
  };

  const handleExecutePayment = () => {
    // A batch cannot be represented as a single taxpayer challan. Keep the
    // existing payment presentation but defer batch execution to A-Challan.
    if (otherBatch) return;
    if (isProcessing || !acknowledged || !paymentChannel || !paymentMethod || !amountsValid || !(totalAmount > 0)) return;
    setIsProcessing(true);
    setPaymentPhase('processing');
    setLifecycleStages([]);
    setShowReceiptDetails(false);
    clearValidationError();

      const year = new Date().getFullYear();
      const randChallan = Math.floor(10000000 + Math.random() * 90000000);
      const randToken = Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const lineItems: PaymentLineItem[] = otherBatch ? otherTaxLines.map(line => {
        const head = otherTaxAllocationHead(line.headId)!;
        const amount = otherTaxAllocationTotal([line]) || 0;
        const taxpayer = batchTaxpayers.find(person => person.id === line.taxpayerId)!;
        return {
          headId: head.id, economicCode: head.economicCode, headNameEn: head.nameEn,
          taxAmount: head.category === 'PENALTY' ? 0 : amount,
          penaltyAmount: head.category === 'PENALTY' ? amount : 0,
          surchargeAmount: 0, interestAmount: 0, totalAmount: amount,
          note: `Preview allocation: taxpayer TIN ${taxpayer.tin}; AY ${line.assessmentYear}`
        };
      }) : selectedHeads.map(head => {
        const amount = headAmount(head.id);
        return {
          headId: head.id,
          economicCode: head.economicCode,
          headNameEn: head.nameEn,
          taxAmount: category === 'PENALTY' ? 0 : amount,
          penaltyAmount: category === 'PENALTY' ? amount : 0,
          surchargeAmount: 0,
          interestAmount: 0,
          totalAmount: amount,
          note: [noticeReference && `NBR reference: ${noticeReference.trim()}`, !isWithholdingMode && `Income tax type: ${incomeTaxType}`].filter(Boolean).join(' · ') || undefined
        };
      });

      const newReceipt: ChallanReceipt = {
        id: `rcpt-${Date.now()}`,
        taxEventId: `TE-${year}-${Math.floor(100000 + Math.random() * 900000)}`,
        paymentTransactionId: `PT-${year}-${Math.floor(100000 + Math.random() * 900000)}`,
        challanNo: `ACS-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear: otherBatch && otherTaxLines.length !== 1 ? 'Multiple years' : otherBatch ? otherTaxLines[0].assessmentYear : assessmentYear,
        payerName: forSelf ? accountName || '—' : payerName.trim(),
        payerTin: ownAccountTax ? taxpayerTin : 'GUEST',
        taxpayerTin,
        receiptMobile: receiptPhone,
        noticeReference: noticeReference.trim() || undefined,
        isRepresentativePayment: !forSelf,
        representativeTin: undefined,
        taxZone,
        taxCircle,
        isWithholding: isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT',
        deducteeTin: undefined,
        deducteeName: undefined,
        items: lineItems,
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
      pendingStoryRef.current = {
        receipt: newReceipt,
        payload: {
          idempotencyKey: crypto.randomUUID(),
          sessionId: getStorySessionId(),
          service: category,
          amountMinor: Math.round(totalAmount * 100),
          details: {
            receiptReference: newReceipt.challanNo,
            taxpayerTin,
            payerName: newReceipt.payerName,
            payerMode: forSelf ? 'SELF' : 'OTHER',
            assessmentYear,
            taxZone, taxCircle,
            receiptMobile: receiptPhone,
            noticeReference,
            incomeTaxType,
            isWithholding: isWithholdingMode,
            paymentChannel, paymentMethod,
            lines: lineItems,
            ...(otherBatch ? { allocations: otherTaxLines.map(line => {
              const taxpayer = batchTaxpayers.find(person => person.id === line.taxpayerId)!;
              return { taxpayerTin: taxpayer.tin, taxpayerName: taxpayer.name,
                headId: line.headId, assessmentYear: line.assessmentYear,
                amountMinor: Math.round((otherTaxAllocationTotal([line]) || 0) * 100) };
            }) } : {}),
            totalAmount,
            taxCreditStatus: newReceipt.taxCreditStatus,
            receiptSnapshot: {...newReceipt,treasuryStatus:'GATEWAY_SUCCESS'}
          },
        },
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
    if (paymentPhase === 'failed' && pendingStoryRef.current && !simulateDecline) {
      setIsProcessing(true);
      setPaymentPhase('processing');
      void confirmSimulatedPayment(pendingStoryRef.current.receipt);
      return;
    }
    pendingStoryRef.current = null;
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = [];
    setPaymentPhase('review');
    setLifecycleStages([]);
    setAttemptReceipt(null);
    setAcknowledged(false);
    setSimulateDecline(false);
    setPaymentChannel(null);
    setPaymentMethod(null);
    setMethodGroup(null);
    setShowReceiptDetails(false);
    setStep(3);
  };

  if (step === 4) {
    const completed = paymentPhase === 'settled';
    const bankPending = paymentPhase === 'pending-bank';
    const declined = paymentPhase === 'failed';
    const referenceReady = lifecycleStages.includes('ACS_REFERENCE_CREATED');
    if (showReceiptDetails && createdReceipt) return (
      <div lang={language} className={`payment-receipt-details ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''}`}>
        <ReceiptView receipt={createdReceipt} embedded={embedded} onBack={() => setShowReceiptDetails(false)} />
        {embedded && modalFooterTarget && createPortal(<div className="payment-flow-embedded__footer-actions">
          <button type="button" className="tax-service-choice__cancel" onClick={() => setShowReceiptDetails(false)}><ArrowLeft size={17} />{language === 'bn' ? 'নিশ্চিতকরণে ফিরুন' : 'Back to confirmation'}</button>
        </div>, modalFooterTarget)}
      </div>
    );
    return (
      <div lang={language} className={`space-y-5 ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
        <div className="payment-flow-embedded__confirmation-layout">
        <section className="payment-lifecycle" aria-labelledby="payment-lifecycle-title">
          <div className={`payment-lifecycle__heading payment-lifecycle__heading--${declined ? 'failed' : bankPending ? 'pending' : completed ? 'complete' : 'running'}`}>
            <span className="payment-lifecycle__symbol" aria-hidden="true">{isProcessing ? <LoaderCircle className="animate-spin" size={22} /> : declined ? <AlertCircle size={22} /> : bankPending ? <Building2 size={22} /> : <CheckCircle size={22} />}</span>
            <div>
              <h2 id="payment-lifecycle-title">{declined ? (language === 'bn' ? 'পরিশোধের অনুরোধ প্রত্যাখ্যাত' : 'Payment request declined') : bankPending ? (language === 'bn' ? 'ব্যাংকের জন্য পরিশোধ-স্লিপ প্রস্তুত' : 'Bank payment slip ready') : completed ? (language === 'bn' ? 'পেমেন্ট প্রক্রিয়া সম্পন্ন' : 'Payment process complete') : (language === 'bn' ? 'পরিশোধ প্রক্রিয়াধীন…' : 'Processing payment…')}</h2>
              <p>{language === 'bn' ? 'শুধু ডেমো সিমুলেশন — কোনো অর্থ স্থানান্তর, সরকারি চালান বা কর ক্রেডিট হয়নি।' : 'Demo simulation only — no money transferred, government challan or tax credit issued.'}</p>
            </div>
          </div>
          <div className="payment-lifecycle__overview">
            <div><span>{language === 'bn' ? 'মোট পরিশোধ' : 'Amount'}</span><strong>{formatCurrency(totalAmount, language)}</strong></div>
            <div><span>{language === 'bn' ? 'চালান রেফারেন্স' : 'Challan reference'}</span><strong className="payment-lifecycle__reference-value">{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</strong></div>
          </div>
          <details className="payment-lifecycle__progress-detail" open={!completed && !bankPending && !declined}>
            <summary>{language === 'bn' ? 'পেমেন্টের বিস্তারিত অগ্রগতি' : 'Payment progress details'} <span>{lifecycleStages.length} / {paymentChannel === 'OTC' ? 7 : ONLINE_LIFECYCLE.length}</span></summary>
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
                  ? (language === 'bn' ? 'উৎসে কর জমা সিমুলেট করা হয়েছে — eTDS বরাদ্দ বা কর ক্রেডিট হয়নি' : 'Withholding deposit simulated — no eTDS allocation or tax credit')
                  : statusLabels[status][language]}</span>
                <small>{status}</small>
              </li>)}
              {isProcessing && <li className="payment-lifecycle__waiting"><span className="payment-lifecycle__event-dot" aria-hidden="true">·</span>{language === 'bn' ? 'পরবর্তী নিশ্চিতকরণের অপেক্ষায়…' : 'Waiting for the next confirmation…'}</li>}
            </ol>
          </div>
          </details>
          {bankPending && <div className="payment-lifecycle__result payment-lifecycle__result--pending">
            <FileText size={21} aria-hidden="true" />
            <div>
              <strong>{language === 'bn' ? 'এটি এখনো পরিশোধিত কর নয়' : 'This is not tax paid yet'}</strong>
              <p>{language === 'bn' ? 'এটি শুধু ডেমো স্লিপ। ব্যাংকে ব্যবহারযোগ্য নয়। কোনো অর্থ জমা, ট্রেজারি নিষ্পত্তি বা কর ক্রেডিট হয়নি।' : 'Demo slip only; not valid at a bank. No money was deposited, settled by Treasury or credited.'}</p>
            </div>
          </div>}
          {declined && <div className="payment-lifecycle__result payment-lifecycle__result--failed"><AlertCircle size={20} aria-hidden="true" /><p>{errorMessage || (language === 'bn' ? 'পেমেন্ট মাধ্যমটি অনুরোধ প্রত্যাখ্যান করেছে। অন্য পদ্ধতিতে আবার চেষ্টা করুন।' : 'The payment channel declined the request. You can retry with another method.')}</p></div>}
          {completed && <div className="payment-lifecycle__result payment-lifecycle__result--complete"><CheckCircle size={20} aria-hidden="true" /><p>{language === 'bn' ? 'পেমেন্ট সিমুলেশন সংরক্ষিত হয়েছে — কোনো অর্থ স্থানান্তর হয়নি।' : 'Payment simulation recorded — no money transferred.'}</p></div>}
          <div className="payment-lifecycle__actions no-print">
            {bankPending && <><button type="button" className="payment-lifecycle__secondary" onClick={() => window.print()}><FileText size={16} />{language === 'bn' ? 'স্লিপ প্রিন্ট করুন' : 'Print payment slip'}</button>{!embedded && <button type="button" className="payment-lifecycle__primary" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'}</button>}</>}
            {declined && !embedded && <button type="button" className="payment-lifecycle__primary" onClick={retryPayment}>{language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা করুন' : 'Try another payment method'}</button>}
            {completed && !embedded && <button type="button" className="payment-lifecycle__primary" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ দেখুন' : 'View receipt details'} <ArrowRight size={17} /></button>}
          </div>
        </section>
        </div>
        {embedded && modalFooterTarget && createPortal(
          <PaymentJourneyFooter className="payment-flow-embedded__footer-actions"
            back={<button type="button" className="tax-service-choice__cancel" onClick={onBackToService} disabled={isProcessing}><ArrowLeft size={17} />{commonCopy.btnBack}</button>}
            next={<>
              {completed && <button type="button" className="tax-service-choice__continue" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ' : 'Receipt details'} <ArrowRight size={17} /></button>}
              {bankPending && <button type="button" className="tax-service-choice__continue" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'} <ArrowRight size={17} /></button>}
              {declined && <button type="button" className="tax-service-choice__continue" onClick={retryPayment}>{language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা' : 'Try another method'} <ArrowRight size={17} /></button>}
            </>} />, modalFooterTarget
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
            {(!embedded || initialForSelf === undefined) ? <PaymentFormSection number={1} staticView={embedded} title={language === 'bn' ? 'কার জন্য পরিশোধ করছেন?' : 'Who are you paying for?'} description={language === 'bn' ? 'নিজের বা অন্যের হয়ে পরিশোধ নির্বাচন করুন' : 'Choose your relationship to the taxpayer'}>
              <fieldset className="payment-form-radio-fieldset" aria-invalid={isFieldInvalid('payerChoice') || undefined}>
                <legend className="sr-only">{language === 'bn' ? 'পরিশোধকারীর ধরন' : 'Payer relationship'}</legend>
                <div className="payment-radio-card-grid">
                  {[{ value: true, en: isWithholdingMode ? 'I am the withholding agent' : 'My own tax', bn: isWithholdingMode ? 'আমি উৎসে কর কর্তনকারী' : 'আমার নিজের কর' }, { value: false, en: isWithholdingMode ? 'Paying for the agent' : "Someone else's tax", bn: isWithholdingMode ? 'এজেন্টের পক্ষে পরিশোধ' : 'অন্য কারও কর' }].map(choice =>
                    <PaymentRadioCard key={String(choice.value)} id={choice.value ? 'guest-payer-self' : 'guest-payer-other'} name="guest-payer-relationship" value={String(choice.value)} checked={forSelf === choice.value}
                      onChange={() => { clearReferenceSelection(); setForSelf(choice.value); clearValidationError(); }} title={language === 'bn' ? choice.bn : choice.en} invalid={isFieldInvalid('payerChoice')} errorId={`${ERROR_ID}-payerChoice`} />)}
                </div>
                {forSelf === null && <p className="payment-radio-card__empty">{language === 'bn' ? 'এগিয়ে যেতে একটি বিকল্প নির্বাচন করুন।' : 'No option selected. Choose one to continue.'}</p>}
                {fieldError('payerChoice')}
              </fieldset>
            </PaymentFormSection> : null}
            {forSelf !== null && <PaymentFormSection number={2} staticView={embedded} title={otherBatch ? (language === 'bn' ? 'পরিশোধকারী ও রসিদের তথ্য' : 'Payer & receipt details') : (language === 'bn' ? 'করদাতার পরিচয়' : 'Taxpayer identification')} description={otherBatch ? (language === 'bn' ? 'করদাতাদের টিআইএন নিচের তালিকায় যোগ করুন।' : 'Add taxpayer TINs in the list below.') : (language === 'bn' ? 'করদাতার টিআইএন ও ঐচ্ছিক রেফারেন্স' : 'Taxpayer TIN and optional NBR reference')}>
            {ownAccountTax && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {ownProfile
                ? language === 'bn' ? 'অ্যাকাউন্টের করদাতার তথ্য পূরণ করা হয়েছে। এই তথ্য পরিবর্তন করা যাবে না।' : 'Your account taxpayer details are prefilled and read-only.'
                : accountTaxpayer.status === 'loading'
                  ? language === 'bn' ? 'অ্যাকাউন্টের তথ্য লোড হচ্ছে…' : 'Loading your account details…'
                  : language === 'bn' ? 'এই অ্যাকাউন্টে করদাতার তথ্য যুক্ত নেই।' : 'No taxpayer profile is linked to this account.'}
            </p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownAccountTax && <div>
                <label htmlFor="guest-taxpayer-name" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'করদাতার নাম' : 'Taxpayer name'}</label>
                <input id="guest-taxpayer-name" type="text" value={accountName} readOnly aria-readonly="true" placeholder="—"
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-100 text-slate-800" />
              </div>}
              {!otherBatch && <div>
                <label htmlFor="guest-tin" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isWithholdingMode ? (language === 'bn' ? 'উইথহোল্ডিং এজেন্টের টিআইএন' : 'Withholding agent’s TIN') : (language === 'bn' ? 'করদাতার টিআইএন' : 'Taxpayer’s TIN')} *
                </label>
                <input
                  id="guest-tin"
                  type="text"
                  aria-invalid={isFieldInvalid('tin') || undefined}
                  aria-describedby={errorDescription('tin')}
                  placeholder={ownAccountTax ? '—' : language === 'bn' ? '১২ সংখ্যার টিআইএন লিখুন' : 'Enter the 12-digit TIN'}
                  value={taxpayerTin}
                  inputMode="numeric" maxLength={ownAccountTax ? 13 : 12} autoComplete="off" required
                  readOnly={ownAccountTax} aria-readonly={ownAccountTax || undefined}
                  onChange={(e) => { clearReferenceSelection(); setTin(e.target.value.replace(/\D/g, '').slice(0, 12)); }}
                  className={`min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex ${ownAccountTax ? 'bg-slate-100 text-slate-800' : ''}`}
                />
                {fieldError('tin')}
              </div>}

              {forSelf === false && <div>
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
                  value={receiptPhone}
                  aria-invalid={isFieldInvalid('phone') || undefined}
                  aria-describedby={errorDescription('phone')}
                  inputMode="numeric" maxLength={11} autoComplete="tel-national" required
                  readOnly={ownAccountTax && Boolean(ownProfile)} aria-readonly={(ownAccountTax && Boolean(ownProfile)) || undefined}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className={`min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex ${ownAccountTax && ownProfile ? 'bg-slate-100 text-slate-800' : ''}`}
                />
                {fieldError('phone')}
              </div>

              {ownProfile && <>
                <div><label htmlFor="guest-tax-zone" className="block text-xs font-semibold text-slate-700 mb-1">{copy.zone}</label>
                  <input id="guest-tax-zone" value={ownProfile.taxZone} readOnly aria-readonly="true" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-100" /></div>
                <div><label htmlFor="guest-tax-circle" className="block text-xs font-semibold text-slate-700 mb-1">{copy.circle}</label>
                  <input id="guest-tax-circle" value={ownProfile.taxCircle} readOnly aria-readonly="true" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-100" /></div>
              </>}

              {!isWithholdingMode && <div>
                <label htmlFor="guest-notice-ref" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'NBR নোটিশ বা পেমেন্ট রেফারেন্স' : 'NBR notice or payment reference'} {requiresNBRReference ? '*' : (language === 'bn' ? '(ঐচ্ছিক)' : '(optional)')}</label>
                <input id="guest-notice-ref" type="text" value={noticeReference} onChange={event => { clearReferenceSelection(); setNoticeReference(event.target.value); }} required={requiresNBRReference}
                  aria-invalid={isFieldInvalid('noticeReference') || undefined} aria-describedby={errorDescription('noticeReference')}
                  placeholder="PN-2026-000392" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
                {fieldError('noticeReference')}
              </div>}
            </div>
            </PaymentFormSection>}
            {otherBatch && <PaymentFormSection number={3} staticView={embedded}
              title={language === 'bn' ? 'এই পেমেন্টের করদাতারা' : 'Taxpayers in this payment'}
              description={language === 'bn' ? 'প্রত্যেক করদাতার জন্য আলাদা টিআইএন দিন। নাম ঐচ্ছিক; পরের ধাপে প্রতিটি পেমেন্ট খাত একজন করদাতাকে বরাদ্দ করবেন।' : 'Enter a unique TIN for each taxpayer. Names are optional. Assign each payment head to a taxpayer in the next step.'}>
              <OtherTaxTaxpayerList language={language} primaryTin={taxpayerTin} primaryName={otherTaxpayerName}
                additional={additionalTaxpayers} allocations={otherTaxLines}
                invalidId={invalidBatchTaxpayerId} tinError={isFieldInvalid('tin') ? errorMessage : undefined}
                onPrimaryTin={value => { clearReferenceSelection(); setTin(value); }}
                onPrimaryName={setOtherTaxpayerName} onAdditional={setAdditionalTaxpayers}
                onAllocations={setOtherTaxLines} onClearError={clearValidationError} />
            </PaymentFormSection>}

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
            {paymentCalculation}
          </div>
        )}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {step === 2 && (otherBatch ? (
          <OtherTaxBatchComposer language={language} taxpayers={batchTaxpayers} summary={paymentCalculation}
            lines={otherTaxLines} onChange={next => {
              setOtherTaxLines(next);
              // Keep the invalid-row indicators visible until every selected
              // head is corrected, instead of hiding them after the first edit.
              if (isFieldInvalid('headId')) {
                const sum = otherTaxAllocationTotal(next);
                const allValid = next.length > 0 && sum !== null && sum > 0 &&
                  next.every(line => isOtherTaxHeadEligible(line.headId) &&
                    OTHER_TAX_YEARS.some(year => year === line.assessmentYear) &&
                    batchTaxpayers.some(person => person.id === line.taxpayerId));
                if (allValid) clearValidationError();
              }
            }}
            error={isFieldInvalid('headId') ? errorMessage : undefined} />
        ) : (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__payment' : ''}`}>
            <div className="payment-form-layout__sections">
            <PaymentFormSection number={3} staticView={embedded} title={language === 'bn' ? 'পরিশোধের উদ্দেশ্য' : 'Payment purpose'} description={embedded && category === 'TAX_WITH_RETURN' ? (language === 'bn' ? 'আয়করের ধরন নির্বাচন করুন' : 'Choose the income tax type') : (language === 'bn' ? 'করদাতার ধরন ও প্রযোজ্য পেমেন্ট খাত নির্বাচন করুন' : 'Choose the taxpayer type and applicable payment head')}>
            {verifiedReference && <p className="text-xs text-slate-600" role="status">{language === 'bn' ? `NBR রেফারেন্স ${verifiedReference.reference} থেকে করবর্ষ ও পরিমাণ পূরণ করা হয়েছে।` : `Assessment year and amount filled from NBR reference ${verifiedReference.reference}.`}</p>}
            {!isWithholdingMode && <fieldset className="payment-form-radio-fieldset">
              <legend className="payment-form-subheading">{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'} *</legend>
              <div className="payment-radio-card-grid">
                {INCOME_TAX_TYPES.map(type => <PaymentRadioCard key={type.id} id={`guest-income-type-${type.id}`} name="guest-income-type" value={type.id} checked={incomeTaxType === type.id}
                  onChange={() => { setIncomeTaxType(type.id); clearValidationError(); }} title={language === 'bn' ? type.shortBn : type.shortEn} description={type.codes} invalid={isFieldInvalid('incomeTaxType')} errorId={`${ERROR_ID}-incomeTaxType`} />)}
              </div>
              {incomeTaxType && <p className="payment-form-accounting-code">{language === 'bn' ? 'সরকারি হিসাব কোড' : 'Government accounting code'}: <strong>{governmentAccountingCode(category, incomeTaxType)}</strong></p>}
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
                  setSelectedHeadIds([]);
                  setVerifiedReference(null);
                  setNoticeReference('');
                  setAmountInputs({});
                  setHeadSearch('');
                  setHeadSearchDraft('');
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
            {categoryHeads.length === 1 ? null : <fieldset className="payment-head-fieldset grid grid-cols-1 gap-2" aria-invalid={isFieldInvalid('headId') || undefined} aria-describedby={errorDescription('headId')}>
              <legend className="block text-xs font-semibold text-slate-700 self-center">
                {language === 'bn' ? 'পেমেন্ট খাত' : 'Payment head'}
              </legend>
              <form className="payment-head-search" role="search" onSubmit={event => { event.preventDefault(); setHeadSearch(headSearchDraft.trim()); }}>
                <label htmlFor="guest-head-search" className="sr-only">{copy.searchHead}</label>
                <input id="guest-head-search" type="search" placeholder={copy.searchHead}
                  value={headSearchDraft} onChange={event => setHeadSearchDraft(event.target.value)}
                  className="min-h-11 px-3 py-2 text-sm rounded-lg border border-slate-300 w-full" />
                <button type="submit" className="payment-head-search__button"><Search size={16} aria-hidden="true" />{language === 'bn' ? 'খুঁজুন' : 'Search'}</button>
              </form>

              <div role="group" aria-label={language === 'bn' ? 'পেমেন্ট খাত (একাধিক বাছাই করা যায়)' : 'Payment heads (select multiple)'} aria-describedby={errorDescription('headId')} className="payment-head-options col-span-full max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {availableHeads.length === 0 && <p className="p-4 text-sm text-slate-600">{language === 'bn' ? 'কোনো মিল থাকা পেমেন্ট খাত পাওয়া যায়নি।' : 'No matching payment heads. Try another search.'}</p>}
                {availableHeads.map(head => {
                  const isBlocked = head.status !== 'ACTIVE';
                  const isSelected = selectedHeadIds.includes(head.id);
                  return (
                    <label
                      key={head.id}
                      htmlFor={`guest-head-${head.id}`}
                      className={`payment-head-option min-h-11 border-l-4 p-3 text-xs flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-taxpay-primary'
                          : isBlocked
                          ? 'border-transparent bg-rose-50/60 opacity-70 cursor-not-allowed'
                          : 'border-transparent hover:bg-white'
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
                        type="checkbox"
                        name="guest-payment-head"
                        value={head.id}
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => !isBlocked && setSelectedHeadIds(previous => verifiedReference ? [head.id] : previous.includes(head.id) ? previous.filter(id => id !== head.id) : [...previous, head.id])}
                        aria-invalid={isFieldInvalid('headId') || undefined}
                        aria-describedby={errorDescription('headId')}
                        className="payment-head-option__radio mt-1 shrink-0 accent-blue-700"
                      />
                    </label>
                  );
                })}
              </div>
              <p className="payment-head-selected" role="status">{language === 'bn' ? `নির্বাচিত খাত: ${selectedHeads.length}` : `${selectedHeads.length} payment head${selectedHeads.length === 1 ? '' : 's'} selected`}</p>
            </fieldset>}
            {fieldError('headId')}
            </PaymentFormSection>

            {/* Financial Amounts Breakdown */}
            <PaymentFormSection number={4} staticView={embedded} title={language === 'bn' ? 'পরিশোধের পরিমাণ' : 'Payment amount'} description={category === 'TAX_WITH_RETURN'
              ? language === 'bn'
                ? '১৭৪ — রিটার্নের সাথে কর (বিলম্বিত রিটার্ন)। সময়মতো দাখিলে ধারা ১৭৩ প্রযোজ্য; এই ফর্ম প্রযোজ্যতা নির্ধারণ করে না।'
                : '174 — Tax with return (late filing). Section 173 applies to on-time returns; filing-date applicability is not determined here.'
              : language === 'bn' ? 'পরিশোধের পরিমাণ লিখুন' : 'Enter the amount shown on your return, notice or order'}>
            <div className="payment-amount-fields payment-amount-fields--simple">
              <div>
                <label htmlFor="guest-assessment-year" className="block text-slate-600 font-medium mb-1">{commonCopy.assessmentYear} *</label>
                <select id="guest-assessment-year" required disabled={!!verifiedReference} value={assessmentYear} onChange={event => setAssessmentYear(event.target.value)} className="min-h-11 w-full px-3 py-2 rounded border border-slate-300">
                  {['2027-28', '2026-27', '2025-26', '2024-25'].map(year => <option value={year} key={year}>{year}</option>)}
                </select>
              </div>
            </div>
            <div className="payment-head-amount-grid">
            {selectedHeads.map((head, index) => <div className="payment-head-amount" data-columns={amountRowColumns[index]} key={head.id}>
              {selectedHeads.length > 1 && <p className="payment-head-amount__label">{head.economicCode} — {language === 'bn' ? head.nameBn : head.nameEn}</p>}
              <label htmlFor={index === 0 ? 'guest-tax-amount' : `guest-tax-amount-${head.id}`} className="block text-slate-600 font-medium mb-1">{language === 'bn' ? 'পরিশোধের পরিমাণ (৳)' : 'Payment amount (৳)'} *</label>
              <input id={index === 0 ? 'guest-tax-amount' : `guest-tax-amount-${head.id}`} type="text" inputMode="decimal" required readOnly={!!verifiedReference} autoComplete="off" maxLength={17}
                placeholder="0.00" aria-invalid={isFieldInvalid('taxAmount') && errorHeadId === head.id || undefined} aria-describedby={isFieldInvalid('taxAmount') && errorHeadId === head.id ? `${ERROR_ID}-taxAmount` : undefined}
                value={verifiedReference ? String(verifiedReference.amount) : amountInputs[head.id] || ''} onChange={event => {
                  const next = normalizeGuestAmountInput(event.target.value);
                  if (next === null) return;
                  setAmountInputs(previous => ({ ...previous, [head.id]: next }));
                  if (errorHeadId === head.id) clearValidationError();
                }}
                className="min-h-11 w-full px-3 py-2 rounded border border-slate-300 font-mono-plex" />
              {isFieldInvalid('taxAmount') && errorHeadId === head.id && fieldError('taxAmount')}
            </div>)}
            </div>
            {isFieldInvalid('taxAmount') && errorHeadId === null && fieldError('taxAmount')}
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
            {paymentCalculation}
          </div>
        ))}

        {/* STEP 3: Review Challan & Execute Simulated Gateway */}
        {step === 3 && (
          <div className="payment-review" data-testid="payment-review">
            <div className="payment-review__main">
              <section className="payment-review__panel" aria-labelledby="guest-payment-channel-title">
                <div className="payment-review__section-title"><span className="payment-review__section-number">01</span><div><h2 id="guest-payment-channel-title">{language === 'bn' ? 'পেমেন্ট চ্যানেল বেছে নিন' : 'Choose payment channel'}</h2><p>{language === 'bn' ? 'অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন' : 'Choose online payment or a bank branch'}</p></div></div>
                {otherBatch && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-taxpay-dark mb-3">
                  {language === 'bn' ? 'একাধিক করদাতার খাত ও পরিমাণ দেখা যাচ্ছে। ব্যাচ পেমেন্টের বাস্তব নিষ্পত্তি ভবিষ্যতে A-Challan ইন্টিগ্রেশনে হবে।' :
                    'Taxpayer allocations are ready for review. Batch settlement is reserved for the future A-Challan integration; this screen does not submit a combined challan.'}
                </p>}
                <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
                  onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
                  onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
                  onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
                  simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline} />
                {paymentChannel && paymentMethod && <label className="payment-review__ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>{category === 'SOURCE_TAX_DEPOSIT' ? (language === 'bn' ? 'এজেন্টের টিআইএন, কর্তনের খাত, করবর্ষ ও পরিমাণ যাচাই করেছি। কর্তিত করদাতারা eTDS-এ বরাদ্দের পর ক্রেডিট পাবেন।' : 'I confirm the agent TIN, deduction head, year and amount. Deductee credit follows eTDS allocation.') : otherBatch ? (language === 'bn' ? 'প্রতিটি করদাতার টিআইএন, সংশ্লিষ্ট খাত, করবর্ষ ও পরিমাণ যাচাই করেছি।' : 'I confirm each taxpayer TIN and the assigned payment heads, assessment years and amounts.') : (language === 'bn' ? 'টিআইএন, খাত, আয়করের ধরন, করবর্ষ ও মোট পরিমাণ যাচাই করেছি। ক্রেডিট করদাতার হিসাবে যাবে।' : 'I confirm the TIN, payment head, income tax type, assessment year and total. Credit goes to the taxpayer.')}</span></label>}
              </section>
            </div>
            <aside className="payment-review__aside" aria-label={language === 'bn' ? 'পেমেন্টের মোট পরিমাণ' : 'Payment total'}>
              {paymentCalculation}
            </aside>
            {!embedded && <div className="payment-review__standalone-actions">
              <button type="button" className="payment-review__back" onClick={() => setStep(2)}><ArrowLeft size={17} />{commonCopy.btnBack}</button>
              <button type="button" className="payment-review__pay" onClick={handleExecutePayment} disabled={!paymentChannel || !paymentMethod || !acknowledged || isProcessing || otherBatch}>{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}<ArrowRight size={17} /></button>
            </div>}
          </div>
        )}
      </div>
      {embedded && modalFooterTarget && createPortal(
        <div className="payment-flow-embedded__footer-actions">
          {step === 1 ? (
            <>
              <button type="button" className="tax-service-choice__cancel" onClick={onBackToService}>
                <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
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
            <button type="button" className="tax-service-choice__continue" onClick={handleExecutePayment} disabled={isProcessing || !paymentChannel || !paymentMethod || !acknowledged || otherBatch} aria-busy={isProcessing}>
              {paymentChannel === 'OTC' ? <FileText size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}
            </button>
          </>) : null}
        </div>, modalFooterTarget
      )}
    </div>
  );
};
