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
  Search,
  ChevronDown,
  ReceiptText
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
import { parseGuestAmount, parseGuestMinorUnits, sumGuestAmounts, sumGuestMinorUnits, normalizeGuestAmountInput } from '../../services/guestAmount';
import { paymentAmountRowColumns } from '../../services/paymentAmountLayout';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';
import { findV11GuestNotice, type V11GuestNotice } from '../../services/v11GuestInput';
import { useAccountIdentity } from '../../services/accountIdentity';
import { usePaymentAccountProfile } from '../../services/paymentAccountProfile';
import { getStorySessionId, persistSimulatedPayment, type StoryPaymentInput } from '../../services/simulatedPaymentStory';
import { clearOtherTaxBatch, confirmedBatchReceipts, createOtherTaxBatch, loadOtherTaxBatch,
  saveOtherTaxBatch, syncOtherTaxBatch, type OtherTaxBatch } from '../../services/otherTaxBatchSubmission';
import { OtherTaxTaxpayerList } from './OtherTaxTaxpayerList';
import { SavedBeneficiaryPicker } from './SavedBeneficiaryPicker';
import { SignedInTaxpayerCard, AccountPaymentSuggestions } from './SignedInPaymentEnhancements';
import { activeAuthorizedTaxpayers } from '../../services/signedInPaymentContext';
import { getHostedAuthorizations, userIdForHostedTin } from '../../services/hostedDemoAuthorizations';
import { isSupportedBeneficiaryTin } from '../../services/taxpayerTinValidation';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import type { DemoUserId } from '../../data/demoUsers';
import type {PaymentSuggestion} from '../../services/signedInPaymentContext';
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
    amountBreakdown: 'Payment Amount Breakdown (৳)', taxAmount: 'Tax Amount (৳)', penalty: 'Penalty (৳)',
    surcharge: 'Surcharge (৳)', interest: 'Interest (৳)', remarks: 'Payment Remarks / Invoice Reference (Optional)',
    remarksPlaceholder: 'e.g. Assessment order #190 / Salary withholding month Oct 2026', total: 'Total Payable Amount:',
    draft: 'Plan as a private draft', continueReview: 'Continue to Review', back: 'Back', backToHead: 'Back to Payment Head',
    reviewTitle: 'Payment summary', payer: 'Payer Name', jurisdiction: 'Jurisdiction',
    headTitle: 'Payment Head', unspecified: 'Unspecified', grandTotal: 'Total Amount (৳)',
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
// The current Story 1 endpoint accepts at most twelve digits of minor units.
const MAX_STORY_AMOUNT_MINOR = 999999999999n;
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
  INITIATED: { en: 'Payment request started', bn: 'পেমেন্টের অনুরোধ শুরু হয়েছে' },
  AUTHORIZED: { en: 'Request details prepared', bn: 'অনুরোধের তথ্য প্রস্তুত' },
  ACS_REFERENCE_CREATED: { en: 'Reference generated', bn: 'রেফারেন্স তৈরি হয়েছে' },
  PROCESSING: { en: 'Preparing payment record', bn: 'পেমেন্ট রেকর্ড প্রস্তুত হচ্ছে' },
  TREASURY_SETTLED: { en: 'Treasury settlement not verified', bn: 'ট্রেজারি নিষ্পত্তি যাচাই হয়নি' },
  NBR_LEDGER_POSTED: { en: 'Ledger entry not confirmed', bn: 'লেজার এন্ট্রি নিশ্চিত হয়নি' },
  CREDITED: { en: 'Tax credit not confirmed', bn: 'কর ক্রেডিট নিশ্চিত হয়নি' },
  FAILED: { en: 'Request declined', bn: 'অনুরোধ প্রত্যাখ্যাত' }
};

interface GuestPaymentProps {
  isWithholdingMode?: boolean;
  embedded?: boolean;
  withAccount?: boolean;
  initialCategory?: PaymentCategory;
  /** Payer relationship is chosen before service selection in the Pay Tax modal. */
  initialForSelf?: boolean;
  initialBeneficiary?: { tin: string; name: string; additional?: { tin: string; name: string }[] };
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
}

export const GuestPayment: React.FC<GuestPaymentProps> = ({ isWithholdingMode = false, embedded = false, withAccount = false, initialCategory, initialForSelf, initialBeneficiary, onBackToService, onStageChange }) => {
  const { language, navigate, addPaymentReceipt, routeParams, previewAccount, setPaymentServiceChoiceOpen } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  // The standalone guest route can also be visited from a signed-in session.
  const signedInAccount = withAccount || Boolean(authenticatedUser || previewAccount);
  const accountTaxpayer = usePaymentAccountProfile(signedInAccount ? authenticatedUser?.id ?? null : null, signedInAccount ? previewAccount : null);
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const commonCopy = UI_STRINGS[language];
  const copy = GUEST_COPY[language];

  // Wizard state steps: 1: Taxpayer & Identification, 2: Head & Amount, 3: Review & Gateway, 4: Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // Match the modal's mobile breakpoint; desktop/tablet retain the approved rail.
  const [mobilePaymentFooter, setMobilePaymentFooter] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)');
    const sync = () => setMobilePaymentFooter(query.matches);
    query.addEventListener('change', sync);
    sync();
    return () => query.removeEventListener('change', sync);
  }, []);

  // Form inputs
  const [tin, setTin] = useState(initialBeneficiary?.tin ?? '');
  const [payerName, setPayerName] = useState('');
  const [otherTaxpayerName, setOtherTaxpayerName] = useState(initialBeneficiary?.name ?? '');
  const [additionalTaxpayers, setAdditionalTaxpayers] = useState<OtherTaxTaxpayer[]>(() =>
    (initialBeneficiary?.additional ?? []).map(person => ({ ...person, id: crypto.randomUUID() }))
  );
  const [invalidBatchTaxpayerId, setInvalidBatchTaxpayerId] = useState<string | null>(null);
  const [otherTaxLines, setOtherTaxLines] = useState<OtherTaxAllocation[]>([]);
  const [summaryJump, setSummaryJump] = useState<{ lineId: string; requestId: number }>({ lineId: '', requestId: 0 });
  const [suggestedBatchYears,setSuggestedBatchYears]=useState<Record<string,string>>({});
  const [authorizedTaxpayerIds,setAuthorizedTaxpayerIds]=useState<Record<string,DemoUserId>>({});
  const [phone, setPhone] = useState('');
  const [assessmentYear, setAssessmentYear] = useState('2026-27');
  // The later approved UX supersedes v11's preselected self-tax default.
  const [forSelf, setForSelf] = useState<boolean | null>(initialForSelf ?? null);
  const ownAccountTax = signedInAccount && forSelf === true;
  const signedInBeneficiarySelection = signedInAccount && forSelf === false;
  // Only loaded owner-scoped saved beneficiaries can be included in a signed-in payment.
  const [availableSavedTins,setAvailableSavedTins] = useState<string[] | null>(null);
  const signedInProfile = signedInAccount ? accountTaxpayer.profile : null;
  const ownProfile = ownAccountTax ? signedInProfile : null;
  const accountName = ownProfile ? language === 'bn' ? ownProfile.nameBn : ownProfile.nameEn : '';
  const signedInPayerName = signedInProfile ? language === 'bn' ? signedInProfile.nameBn : signedInProfile.nameEn : '';
  // A verified Auth account can use its approved synthetic profile binding;
  // this ID is still strictly demo-only and never a real taxpayer entitlement.
  const demoConsentActor = previewAccount?.id ?? (signedInProfile ? userIdForHostedTin(signedInProfile.tin) : null);
  const allowSyntheticDemoTin = Boolean(signedInAccount && forSelf === false && demoConsentActor);
  const effectivePayerName = signedInAccount && signedInPayerName ? signedInPayerName : payerName;
  const taxpayerTin = ownAccountTax ? ownProfile?.tin ?? '' : tin;
  const receiptPhone = signedInProfile?.receiptMobile || phone;
  const [authorizedTaxpayerId, setAuthorizedTaxpayerId] = useState<DemoUserId | null>(null);
  const [authorizationChecking, setAuthorizationChecking] = useState(false);
  const suggestionUserId = ownAccountTax ? demoConsentActor : authorizedTaxpayerId;
  const taxZone = ownProfile?.taxZone ?? '—';
  const taxCircle = ownProfile?.taxCircle ?? '—';
  const [noticeReference, setNoticeReference] = useState('');
  const [lastSearchedTin, setLastSearchedTin] = useState<string | null>(null);
  const sampleTaxpayer = lastSearchedTin === taxpayerTin ? (lookupSampleTaxpayer(taxpayerTin) ?? (ownAccountTax && ownProfile ? { tin: taxpayerTin, nameEn: ownProfile.nameEn, nameBn: ownProfile.nameBn } : null)) : null;
  const tinLookupState = lastSearchedTin !== taxpayerTin ? 'idle' : sampleTaxpayer ? 'found' : 'missing';
  const searchTin = () => {
    setLastSearchedTin(taxpayerTin);
    const match = lookupSampleTaxpayer(taxpayerTin);
    if (match && forSelf === false && !otherBatch) setOtherTaxpayerName(match.nameEn);
  };
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
  // Both payer relationships use the same Other Tax selection and allocation UI.
  const otherBatch = !isWithholdingMode && forSelf !== null && category === 'OTHER_TAX_PAYMENT';
  const batchTaxpayers: OtherTaxTaxpayer[] = [{ id: 'primary', tin: taxpayerTin, name: ownAccountTax ? accountName : otherTaxpayerName }, ...additionalTaxpayers];
  const batchSuggestionTaxpayers = batchTaxpayers.flatMap(person => {
    const userId = person.id === 'primary' && ownAccountTax
      ? demoConsentActor
      : authorizedTaxpayerIds[person.tin] ?? (person.id === 'primary' ? authorizedTaxpayerId : null);
    return userId ? [{ person, userId }] : [];
  });
  const batchAmount = otherTaxAllocationTotal(otherTaxLines);
  const missingBatchTaxpayer = batchTaxpayers.find(person => !otherTaxLines.some(line => line.taxpayerId === person.id));
  const uniqueBatchAllocations = new Set(otherTaxLines.map(line =>
    `${line.taxpayerId}:${line.headId}:${line.assessmentYear}`)).size === otherTaxLines.length;
  const batchValid = uniqueBatchAllocations && otherTaxLines.length > 0 && batchAmount !== null && batchAmount > 0
    && !missingBatchTaxpayer
    && otherTaxLines.every(line => isOtherTaxHeadEligible(line.headId)
      && batchTaxpayers.some(person => person.id === line.taxpayerId)
      && OTHER_TAX_YEARS.some(year => year === line.assessmentYear));

  // Match the existing identity validator before enabling the primary action.
  // Signed-in beneficiary consent is still verified asynchronously on Continue.
  const canContinueStep1 = (() => {
    if (authorizationChecking || forSelf === null || (ownAccountTax && !ownProfile)) return false;
    if (signedInBeneficiarySelection && (!availableSavedTins ||
        !batchTaxpayers.every(person=>Boolean(person.tin)&&availableSavedTins.includes(person.tin)))) return false;


    const tinValid = ownAccountTax
      ? /^\d{12,13}$/.test(taxpayerTin)
      : isSupportedBeneficiaryTin(taxpayerTin, allowSyntheticDemoTin);
    if (!tinValid) return false;
    if (otherBatch) {
      const seenTins = new Set<string>();
      for (const person of batchTaxpayers) {
        const valid = person.id === 'primary' && ownAccountTax
          ? /^\d{12,13}$/.test(person.tin)
          : isSupportedBeneficiaryTin(person.tin, allowSyntheticDemoTin);
        if (!valid || seenTins.has(person.tin)) return false;
        seenTins.add(person.tin);
      }
    }
    if (embedded && !signedInAccount && lookupSampleTaxpayer(taxpayerTin) && lastSearchedTin !== taxpayerTin) return false;
    if (!/^01\d{9}$/.test(receiptPhone)) return false;
    if (forSelf === false && effectivePayerName.trim().length < 2) return false;
    const reference = noticeReference.trim();
    if (reference && /^\d{12}$/.test(taxpayerTin) && !isWithholdingMode && !ownAccountTax) {
      const matched = findV11GuestNotice(taxpayerTin, reference);
      if (!matched || matched.category !== category) return false;
    }
    return true;
  })();

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
  const [batchAttempt, setBatchAttempt] = useState<OtherTaxBatch | null>(null);
  const batchAttemptRef = useRef<OtherTaxBatch | null>(null);
  const batchRecoveryChecked = useRef(false);
  const [batchRecoveryError, setBatchRecoveryError] = useState(false);
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

  const rememberBatch = (batch: OtherTaxBatch | null) => {
    batchAttemptRef.current = batch;
    setBatchAttempt(batch);
  };

  // A pending request keeps its identifiers across closing the modal or reloading the tab.
  useEffect(() => {
    if (isWithholdingMode || category !== 'OTHER_TAX_PAYMENT' || batchRecoveryChecked.current) return;
    batchRecoveryChecked.current = true;
    try {
      const batch = loadOtherTaxBatch(getStorySessionId());
      if (!batch) return;
      rememberBatch(batch);
      confirmedBatchReceipts(batch).forEach(addPaymentReceipt);
      setAttemptReceipt(batch.items[0].receipt);
      setCreatedReceipt(confirmedBatchReceipts(batch)[0] ?? null);
      setPaymentChannel(batch.phase === 'PENDING_BANK' ? 'OTC' :
        batch.items[0].payload.details.paymentChannel === 'OTC' ? 'OTC' : 'NOW');
      setPaymentMethod(batch.items[0].receipt.paymentMethod);
      setLifecycleStages(batch.phase === 'COMPLETE' ? ONLINE_LIFECYCLE : batch.phase === 'PENDING_BANK'
        ? BANK_LIFECYCLE : ONLINE_LIFECYCLE.slice(0, -1));
      setPaymentPhase(batch.phase === 'COMPLETE' ? 'settled' : batch.phase === 'PENDING_BANK' ? 'pending-bank' : 'failed');
      if (batch.phase === 'READY') setErrorMessage(language === 'bn'
        ? 'কিছু পেমেন্ট রেকর্ড অপেক্ষমাণ। একই অনুরোধ আবার চেষ্টা করুন।'
        : 'Some payment records are pending. Retry the same request.');
      setStep(4);
    } catch {
      setBatchRecoveryError(true);
    }
  }, [category, isWithholdingMode]);

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
  const storyAmountMinor = sumGuestMinorUnits(otherBatch
    ? otherTaxLines.map(line => line.amount)
    : selectedHeads.map(head => amountRawForHead(head.id)));
  const storyAmountSupported = storyAmountMinor !== null && storyAmountMinor > 0n && storyAmountMinor <= MAX_STORY_AMOUNT_MINOR;
  const requiresNBRReference = resolvePaymentServiceAccess(category, 'MAKE_PAYMENT').requiresNBRReference;
  const paymentCalculation = otherBatch ? <PaymentLiveSummary language={language} hideService={embedded}
    onSelectEntry={step === 2 ? lineId => setSummaryJump(current => ({ lineId, requestId: current.requestId + 1 })) : undefined}
    category={language === 'bn' ? 'অন্যান্য কর পরিশোধ' : 'Other Tax Payment'}
    categoryCode={category} tin={batchTaxpayers.length > 1 ? undefined : taxpayerTin}
    year={otherTaxLines.length === 1 ? otherTaxLines[0].assessmentYear : undefined}
    amount={step === 1 ? null : batchAmount}
    helpText={step === 1
      ? language === 'bn' ? 'পরবর্তী ধাপে খাত ও পরিমাণ নির্বাচন করলে মোট হিসাব দেখা যাবে।' : 'Your total will appear after you choose payment heads and amounts in Step 2.'
      : !batchValid && otherTaxLines.length > 0
      ? language === 'bn' ? 'সব নির্বাচিত খাতের পরিমাণ সম্পূর্ণ হলে মোট হিসাব দেখা যাবে।' : 'Complete every selected amount to see the final total.'
      : undefined}
    groupedBreakdown={batchTaxpayers.length > 1 ? batchTaxpayers.map((person, index) => {
      const lines = otherTaxLines.filter(line => line.taxpayerId === person.id);
      return {
        id: person.id,
        label: person.name.trim() || (language === 'bn' ? `করদাতা ${index + 1}` : `Taxpayer ${index + 1}`),
        tin: person.tin,
        amount: lines.length ? otherTaxAllocationTotal(lines) : null,
        entries: lines.map(line => {
          const head = otherTaxAllocationHead(line.headId);
          return {
            id: line.id,
            label: `${head?.economicCode || ''} — ${language === 'bn' ? head?.nameBn : head?.nameEn}`,
            detail: line.assessmentYear,
            value: otherTaxAllocationTotal([line]),
          };
        }),
      };
    }) : undefined}
    breakdown={batchTaxpayers.length > 1 ? undefined : otherTaxLines.map(line => {
      const head = otherTaxAllocationHead(line.headId);
      const person = batchTaxpayers.find(t => t.id === line.taxpayerId);
      return {
        id: line.id,
        label: `${head?.economicCode || ''} — ${language === 'bn' ? head?.nameBn : head?.nameEn}`,
        detail: `${person?.name ? person.name + ' · ' : ''}${person?.tin || ''} · ${line.assessmentYear}`,
        value: otherTaxAllocationTotal([line])
      };
    })} /> : <PaymentLiveSummary language={language} hideService={embedded}
    category={language === 'bn' ? CATEGORY_LABELS[category]?.bn : CATEGORY_LABELS[category]?.en}
    categoryCode={category} tin={taxpayerTin} year={assessmentYear}
    head={category === 'TAX_WITH_RETURN'
      // The legacy v11 "74" is a historical label, not the current-law section.
      // Applicability cannot be inferred from assessment year alone: on-time §173, late §174.
      ? (language === 'bn'
        ? 'রিটার্নসহ কর — সময়মতো দাখিল: ধারা ১৭৩; বিলম্বিত দাখিল: ধারা ১৭৪'
        : 'Tax with Return — Section 173 (on-time) / 174 (late filing)')
      : selectedHeads.length === 1
        ? `${selectedHead?.economicCode} — ${language === 'bn' ? selectedHead?.nameBn : selectedHead?.nameEn}`
        : undefined}
    amount={summedAmount}
    breakdown={step >= 3 ? [
      ...(selectedHeads.length > 1 ? selectedHeads.map(head => ({ label: `${head.economicCode} — ${language === 'bn' ? head.nameBn : head.nameEn}`, value: parseGuestAmount(amountRawForHead(head.id)) })) : [{ label: language === 'bn' ? 'পরিশোধের পরিমাণ' : 'Payment amount', value: totalAmount }]),
      { label: language === 'bn' ? 'সার্ভিস চার্জ' : 'Service charge', value: 0 }
    ] : selectedHeads.length > 1 ? selectedHeads.map(head => ({ label: `${head.economicCode} — ${language === 'bn' ? head.nameBn : head.nameEn}`, value: parseGuestAmount(amountRawForHead(head.id)) })) : undefined} />;
  const inlinePaymentCalculation = embedded && mobilePaymentFooter ? null : paymentCalculation;
  const mobileSummaryTotal = otherBatch ? (step === 1 ? null : batchAmount) : summedAmount;

  const taxpayerLookupResult = (
    <div className="tin-lookup__result" role="status" aria-live="polite" data-lookup-state={tinLookupState}>
      {tinLookupState === 'idle' ? <p>{language === 'bn' ? 'টিআইএন খুঁজে নাম দেখুন।' : 'Search TIN to fill taxpayer name.'}</p>
        : sampleTaxpayer ? <p className="sr-only">{language === 'bn' ? 'করদাতার নাম পাওয়া গেছে।' : 'Taxpayer name found.'}</p>
        : <p>{language === 'bn' ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.'}</p>}
    </div>
  );

  const validateIdentity = () => {
    if (forSelf === null) {
      setValidationError(language === 'bn' ? 'কার জন্য পরিশোধ করছেন নির্বাচন করুন।' : 'Choose who you are paying for.', 'payerChoice');
      return false;
    }
    if (ownAccountTax && !ownProfile) {
      setValidationError(language === 'bn' ? 'এই অ্যাকাউন্টের সঙ্গে করদাতার তথ্য যুক্ত নেই।' : 'No taxpayer profile is linked to this account.', 'tin');
      return false;
    }
    if (!(ownAccountTax ? /^\d{12,13}$/.test(taxpayerTin) : isSupportedBeneficiaryTin(taxpayerTin, allowSyntheticDemoTin))) {
      if (otherBatch) setInvalidBatchTaxpayerId('primary');
      setValidationError(allowSyntheticDemoTin
        ? (language === 'bn' ? '১২ সংখ্যার টিআইএন বা পরিচিত ১৩ সংখ্যার টিআইএন দিন।' : 'Enter a 12-digit TIN or a recognized 13-digit TIN.')
        : copy.invalidTin, 'tin');
      return false;
    }
    if (otherBatch) {
      const seenTins = new Set<string>();
      const invalidPerson = batchTaxpayers.find(person => {
        const tinValid = person.id === 'primary' && ownAccountTax
          ? /^\d{12,13}$/.test(person.tin)
          : isSupportedBeneficiaryTin(person.tin, allowSyntheticDemoTin);
        if (!tinValid || seenTins.has(person.tin)) return true;
        seenTins.add(person.tin);
        return false;
      });
      if (invalidPerson) {
        setInvalidBatchTaxpayerId(invalidPerson.id);
        setValidationError(allowSyntheticDemoTin
          ? (language === 'bn' ? 'প্রত্যেক করদাতার জন্য পৃথক ১২ সংখ্যার টিআইএন বা পরিচিত ১৩ সংখ্যার টিআইএন দিন।' : 'Enter a unique 12-digit TIN or recognized 13-digit TIN for each taxpayer.')
          : (language === 'bn' ? 'প্রত্যেক করদাতার আলাদা ১২ সংখ্যার টিআইএন দিন। নাম ঐচ্ছিক।' : 'Enter a different 12-digit TIN for each taxpayer. Names are optional.'), 'tin');
        return false;
      }
    }
    if (embedded && !signedInAccount && lookupSampleTaxpayer(taxpayerTin) && lastSearchedTin !== taxpayerTin) {
      setValidationError(language === 'bn' ? 'এগোনোর আগে টিআইএন খুঁজুন।' : 'Search this TIN before continuing.', 'tin');
      return false;
    }
    if (!/^01\d{9}$/.test(receiptPhone)) {
      setValidationError(language === 'bn' ? 'রসিদের জন্য ১১ সংখ্যার মোবাইল নম্বর দিন।' :
        'Enter an 11-digit Bangladeshi mobile number for the receipt.', 'phone');
      return false;
    }
    if (!forSelf && effectivePayerName.trim().length < 2) {
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

  const chooseSuggestedHead = (suggestion:PaymentSuggestion) => {
    // Never apply another selected taxpayer's scenario record or a record that
    // still needs review. This source has no exact legal head/notice reference.
    const authorizedForCurrentFlow = otherBatch
      ? batchTaxpayers.some(person => {
        const authorizedId = person.id === 'primary' && ownAccountTax
          ? demoConsentActor
          : authorizedTaxpayerIds[person.tin] ?? (person.id === 'primary' ? authorizedTaxpayerId : null);
        return authorizedId === suggestion.taxpayerId && userIdForHostedTin(person.tin) === suggestion.taxpayerId;
      })
      : suggestion.taxpayerId === suggestionUserId;
    if (!authorizedForCurrentFlow || suggestion.requiresReview) return;
    const supportedYear=suggestion.assessmentYear&&OTHER_TAX_YEARS.find(year=>year===suggestion.assessmentYear);
    if(otherBatch){
      const target=batchTaxpayers.find(person=>userIdForHostedTin(person.tin)===suggestion.taxpayerId);
      if(target){
        const targetTab=[...document.querySelectorAll<HTMLButtonElement>('[data-testid="other-tax-taxpayer-tabs"] button')]
          .find(button=>button.dataset.taxpayerId===target.id);
        targetTab?.click();
        if(supportedYear)setSuggestedBatchYears(current=>({...current,[target.id]:supportedYear}));
      }
    }else if(supportedYear)setAssessmentYear(supportedYear);
    const group:Partial<Record<PaymentSuggestion['serviceCode'],string>>={
      ADVANCE_TAX:'Advance Tax',ASSESSED_DEMAND:'Tax against Demand',PENALTY:'Penalty',
      APPELLATE_TRIBUNAL:'Appellate Tribunal',OTHER_TAX_PAYMENT:'Others',
    };
    const groupName=group[suggestion.serviceCode];
    const section=groupName?[...document.querySelectorAll<HTMLDetailsElement>('details[data-head-group]')]
      .find(item=>item.dataset.headGroup===groupName):undefined;
    if(section){
      section.open=true;
      section.scrollIntoView({behavior:'smooth',block:'nearest'});
      section.querySelector('summary')?.focus({preventScroll:true});
      return;
    }
    const nextField=suggestion.serviceCode==='TAX_WITH_RETURN'
      ?document.querySelector<HTMLInputElement>('input[name="guest-income-type"]')
      :document.querySelector<HTMLInputElement>('input[name="guest-payment-head"]');
    nextField?.scrollIntoView({behavior:'smooth',block:'nearest'});
    nextField?.focus({preventScroll:true});
  };

  const handleStep1Next = async () => {
    if (signedInBeneficiarySelection && (!availableSavedTins ||
        !batchTaxpayers.every(person=>Boolean(person.tin)&&availableSavedTins.includes(person.tin)))) {
      setValidationError(language === 'bn'
        ? 'এগোনোর আগে আপনার সংরক্ষিত তালিকা থেকে উপকারভোগী নির্বাচন করুন।'
        : 'Select beneficiaries from your saved lists before continuing.', 'tin');
      return;
    }
    if (authorizationChecking || !validateIdentity()) return;
    // Guest payments remain unchanged. Signed-in, facilitated demo payments
    // require current hosted consent, including every additional taxpayer.
    if (signedInAccount && forSelf === false) {
      setAuthorizationChecking(true);
      try {
        const actor = demoConsentActor;
        if (!actor) throw new Error('An account-linked authorization is required for a facilitated payment.');
        const active = activeAuthorizedTaxpayers(await getHostedAuthorizations(actor), actor);
        const recipients = otherBatch ? batchTaxpayers : [{ id: 'primary', tin: taxpayerTin }];
        const missing = recipients.find(person => !active.some(choice => choice.tin === person.tin));
        if (missing) {
          if (missing.id !== 'primary') setInvalidBatchTaxpayerId(missing.id);
          const personNumber = recipients.findIndex(person => person.id === missing.id) + 1;
          setValidationError(language === 'bn'
            ? `করদাতা ${personNumber} (${missing.tin}) আপনার অনুমোদিত তালিকায় নেই। অনুমোদিত করদাতা নির্বাচন করুন অথবা অনুমোদনের অনুরোধ করুন।`
            : `Taxpayer ${personNumber} (${missing.tin}) is not approved for payment through your account. Choose an approved taxpayer or request access first.`, 'tin');
          return;
        }
        // Keep account payment suggestions scoped to every *verified* beneficiary.
        // Selecting a saved contact alone never grants payment authorization.
        const verifiedIds: Record<string,DemoUserId> = {};
        for (const recipient of recipients) {
          const scenarioId = userIdForHostedTin(recipient.tin);
          if (scenarioId) verifiedIds[recipient.tin] = scenarioId;
        }
        setAuthorizedTaxpayerIds(verifiedIds);
        setAuthorizedTaxpayerId(userIdForHostedTin(taxpayerTin));
      } catch {
        setValidationError(language === 'bn' ? 'অনুমোদন যাচাই করা যায়নি। আবার চেষ্টা করুন।'
          : 'Authorization could not be verified. Retry or open Manage authorization.', 'tin');
        return;
      } finally {
        setAuthorizationChecking(false);
      }
    }
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
            : missingBatchTaxpayer
              ? language === 'bn' ? `করদাতা ${batchTaxpayers.indexOf(missingBatchTaxpayer) + 1}-এর জন্য অন্তত একটি খাত নির্বাচন করুন।`
                : `Select at least one payment head for taxpayer ${batchTaxpayers.indexOf(missingBatchTaxpayer) + 1}.`
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
      if (signedInAccount && forSelf === false) {
        const actor = demoConsentActor;
        if (!actor) throw new Error('Account authorization unavailable');
        const active = activeAuthorizedTaxpayers(await getHostedAuthorizations(actor), actor);
        const recipients = otherBatch ? batchTaxpayers : [{ id: 'primary', tin: taxpayerTin }];
        if (recipients.some(person => !active.some(choice => choice.tin === person.tin))) {
          throw new Error('Authorization expired or revoked. Return to taxpayer details and select an active authorization.');
        }
      }
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

  const confirmOtherTaxBatch = async () => {
    const batch = batchAttemptRef.current;
    if (!batch || batch.phase !== 'READY') { setPaymentPhase('failed'); setIsProcessing(false); return; }
    try {
      if (signedInAccount && batch.items[0].payload.details.payerMode === 'OTHER') {
        const actor = demoConsentActor;
        if (!actor) throw new Error('Account authorization unavailable');
        const active = activeAuthorizedTaxpayers(await getHostedAuthorizations(actor), actor);
        if (batch.items.some(item => !active.some(choice => choice.tin === item.payload.details.taxpayerTin)))
          throw new Error('Authorization unavailable');
      }
      await syncOtherTaxBatch(batch, persistSimulatedPayment, progress => {
        rememberBatch(progress);
        const receipts = confirmedBatchReceipts(progress);
        receipts.forEach(addPaymentReceipt);
        if (receipts[0]) setCreatedReceipt(receipts[0]);
      });
      setLifecycleStages(previous => [...previous, 'CREDITED']);
      setPaymentPhase('settled');
      setErrorMessage('');
    } catch {
      setErrorMessage(language === 'bn'
        ? 'কিছু পেমেন্ট রেকর্ড অপেক্ষমাণ। একই অনুরোধ আবার চেষ্টা করুন।'
        : 'Some payment records are pending. Retry the same request.');
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
        if (batchAttemptRef.current) void confirmOtherTaxBatch();
        else void confirmSimulatedPayment(receipt);
      }
    }, (index + 1) * 550));
  };

  const handleExecutePayment = () => {
    if (batchRecoveryError || isProcessing || !acknowledged || !paymentChannel || !paymentMethod ||
      !(otherBatch ? batchValid : amountsValid) || !storyAmountSupported || storyAmountMinor === null) return;
    setIsProcessing(true);
    setPaymentPhase('processing');
    setLifecycleStages([]);
    setShowReceiptDetails(false);
    clearValidationError();

    try {
      // One explicitly synthetic reference is stable across retries of this attempt.
      const attemptId = crypto.randomUUID();
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
          note: `Allocation: taxpayer TIN ${taxpayer.tin}; AY ${line.assessmentYear}`
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
        taxEventId: `SIM-EVENT-${attemptId}`,
        paymentTransactionId: `SIM-PAYMENT-${attemptId}`,
        challanNo: `SIM-${attemptId}`,
        tokenNumber: `SIM-TOKEN-${attemptId}`,
        paymentCategory: category,
        assessmentYear: otherBatch && otherTaxLines.length !== 1 ? 'Multiple years' : otherBatch ? otherTaxLines[0].assessmentYear : assessmentYear,
        payerName: forSelf ? accountName || '—' : effectivePayerName.trim(),
        payerTin: signedInProfile?.tin ?? (ownAccountTax ? taxpayerTin : 'GUEST'),
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
        gatewayTransactionId: `SIM-TXN-${attemptId}`,
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
          idempotencyKey: attemptId,
          sessionId: getStorySessionId(),
          service: category,
          amountMinor: Number(storyAmountMinor),
          details: {
            receiptReference: newReceipt.challanNo,
            taxpayerTin,
            payerName: newReceipt.payerName,
            payerTin: newReceipt.payerTin,
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
                amountMinor: Number(parseGuestMinorUnits(line.amount)) };
            }) } : {}),
            totalAmount,
            taxCreditStatus: newReceipt.taxCreditStatus,
            receiptSnapshot: {...newReceipt,treasuryStatus:'GATEWAY_SUCCESS'}
          },
        },
      };
      const splitItems = otherBatch && (forSelf === false || otherTaxLines.length > 1 || batchTaxpayers.length > 1);
      if (splitItems && !(paymentChannel === 'NOW' && simulateDecline)) {
        const batch = createOtherTaxBatch(pendingStoryRef.current.payload, newReceipt, otherTaxLines.map((line, index) => {
          const taxpayer = batchTaxpayers.find(person => person.id === line.taxpayerId)!;
          return { sourceId: line.id, taxpayerTin: taxpayer.tin, taxpayerName: taxpayer.name,
            assessmentYear: line.assessmentYear, amountMinor: Number(parseGuestMinorUnits(line.amount)), line: lineItems[index] };
        }), paymentChannel === 'OTC' ? 'PENDING_BANK' : 'READY');
        saveOtherTaxBatch(batch);
        rememberBatch(batch);
        pendingStoryRef.current = null;
        setAttemptReceipt(batch.items[0].receipt);
      } else {
        rememberBatch(null);
        setAttemptReceipt(newReceipt);
      }
      setStep(4);
      runLifecycle(paymentChannel === 'OTC' ? BANK_LIFECYCLE : simulateDecline ? [...ONLINE_LIFECYCLE.slice(0, 4), 'FAILED'] : ONLINE_LIFECYCLE, newReceipt);
    } catch (error) {
      pendingStoryRef.current = null;
      rememberBatch(null);
      setIsProcessing(false);
      setPaymentPhase('review');
      setErrorMessage(error instanceof Error && error.message === 'PAYMENT_DETAILS_TOO_LONG'
        ? (language === 'bn' ? 'পেমেন্টের তথ্য অনেক দীর্ঘ। নাম বা রেফারেন্স ছোট করে আবার চেষ্টা করুন।' : 'Payment details are too long. Shorten the name or reference and try again.')
        : (language === 'bn' ? 'অনুরোধ সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করে আবার চেষ্টা করুন।'
          : 'The request could not be saved. Check browser storage and try again.'));
    }
  };

  const simulateBankSettlement = () => {
    if (paymentPhase !== 'pending-bank' || !attemptReceipt || isProcessing) return;
    if (batchAttemptRef.current) {
      try {
        const ready: OtherTaxBatch = { ...batchAttemptRef.current, phase: 'READY' };
        saveOtherTaxBatch(ready);
        rememberBatch(ready);
      } catch {
        setErrorMessage(language === 'bn' ? 'অনুরোধ সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' : 'The request could not be saved. Try again.');
        return;
      }
    }
    setIsProcessing(true);
    setPaymentPhase('processing');
    runLifecycle(BANK_SETTLEMENT, attemptReceipt);
  };

  const retryPayment = () => {
    if (paymentPhase === 'failed' && batchAttemptRef.current?.phase === 'READY') {
      setIsProcessing(true);
      setPaymentPhase('processing');
      void confirmOtherTaxBatch();
      return;
    }
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

  const startAnotherBatch = () => {
    try { clearOtherTaxBatch(); } catch {
      setErrorMessage(language === 'bn' ? 'অনুরোধ সংরক্ষণ পরিষ্কার করা যায়নি।' : 'The saved request could not be cleared.');
      return;
    }
    rememberBatch(null);
    setCreatedReceipt(null); setAttemptReceipt(null); setPaymentPhase('review'); setLifecycleStages([]);
    setAcknowledged(false); setPaymentChannel(null); setPaymentMethod(null); setMethodGroup(null);
    setOtherTaxLines([]); setAdditionalTaxpayers([]); setSuggestedBatchYears({}); setAuthorizedTaxpayerIds({});
    setAuthorizedTaxpayerId(null); setTin(''); setOtherTaxpayerName('');
    setShowReceiptDetails(false); setErrorMessage(''); setStep(1);
  };

  if (step === 4) {
    const completed = paymentPhase === 'settled';
    const bankPending = paymentPhase === 'pending-bank';
    const declined = paymentPhase === 'failed';
    const referenceReady = lifecycleStages.includes('ACS_REFERENCE_CREATED');
    const confirmedReceipts = batchAttempt ? confirmedBatchReceipts(batchAttempt) : [];
    const shownTotal = batchAttempt ? batchAttempt.amountMinor / 100 : totalAmount;
    if (showReceiptDetails && createdReceipt) return (
      <div lang={language} className={`payment-receipt-details ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''}`}>
        <ReceiptView receipt={createdReceipt} embedded={embedded} onBack={() => setShowReceiptDetails(false)} />
      </div>
    );
    return (
      <div lang={language} className={`space-y-5 ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
        <div className="payment-flow-embedded__confirmation-layout">
        <section className="payment-lifecycle" aria-labelledby="payment-lifecycle-title">
          <div className={`payment-lifecycle__heading payment-lifecycle__heading--${declined ? 'failed' : bankPending ? 'pending' : completed ? 'complete' : 'running'}`}>
            <span className="payment-lifecycle__symbol" aria-hidden="true">{isProcessing ? <LoaderCircle className="animate-spin" size={22} /> : declined ? <AlertCircle size={22} /> : bankPending ? <Building2 size={22} /> : <CheckCircle size={22} />}</span>
            <div>
              <h2 id="payment-lifecycle-title">{declined && batchAttempt ? (language === 'bn' ? 'পেমেন্ট রেকর্ড অপেক্ষমাণ' : 'Payment records pending') : declined ? (language === 'bn' ? 'পরিশোধের অনুরোধ প্রত্যাখ্যাত' : 'Payment request declined') : bankPending ? (language === 'bn' ? 'ব্যাংকের জন্য পরিশোধ-স্লিপ প্রস্তুত' : 'Bank payment slip ready') : completed ? (language === 'bn' ? 'পেমেন্ট রেকর্ড সংরক্ষিত' : 'Payment record saved') : (language === 'bn' ? 'পরিশোধ প্রক্রিয়াধীন…' : 'Processing payment…')}</h2>
            </div>
          </div>
          <div className="payment-lifecycle__overview">
            <div><span>{language === 'bn' ? 'মোট পরিশোধ' : 'Amount'}</span><strong>{formatCurrency(shownTotal, language)}</strong></div>
            {batchAttempt ? <div><p className="text-sm text-taxpay-muted">{language === 'bn' ? 'সংরক্ষিত রেকর্ড' : 'Records saved'}</p><p><strong>{confirmedReceipts.length} / {batchAttempt.items.length}</strong></p></div>
              : <div><span>{language === 'bn' ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</span><strong className="payment-lifecycle__reference-value">{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</strong></div>}
          </div>
          <details className="payment-lifecycle__progress-detail" open={!completed && !bankPending && !declined}>
            <summary>{language === 'bn' ? 'পেমেন্টের অগ্রগতি ও রেফারেন্স' : 'Payment progress and references'} <span>{lifecycleStages.length} / {ONLINE_LIFECYCLE.length}</span></summary>
          <div className="payment-lifecycle__details">
            {!batchAttempt && <dl className="payment-lifecycle__references">
              <div><dt>{language === 'bn' ? 'কর ইভেন্ট আইডি' : 'Tax event ID'}</dt><dd>{attemptReceipt?.taxEventId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'পেমেন্ট ট্রানজেকশন আইডি' : 'Payment transaction ID'}</dt><dd>{attemptReceipt?.paymentTransactionId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</dt><dd>{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</dd></div>
              <div><dt>{language === 'bn' ? 'মোট অর্থ' : 'Amount'}</dt><dd>{formatCurrency(totalAmount, language)}</dd></div>
            </dl>}
            <ol className="payment-lifecycle__timeline" aria-label={language === 'bn' ? 'পরিশোধের অবস্থা' : 'Payment lifecycle'} aria-live="polite" data-testid="payment-lifecycle">
              {lifecycleStages.map((status, index) => <li key={`${status}-${index}`} className={status === 'FAILED' ? 'payment-lifecycle__event--failed' : ''}>
                <span className="payment-lifecycle__event-dot" aria-hidden="true">{status === 'FAILED' ? '!' : '✓'}</span>
                <span>{status === 'CREDITED' && category === 'SOURCE_TAX_DEPOSIT'
                  ? (language === 'bn' ? 'eTDS বরাদ্দ বা কর ক্রেডিট নিশ্চিত হয়নি' : 'eTDS allocation and tax credit not confirmed')
                  : statusLabels[status][language]}</span>
              </li>)}
              {isProcessing && <li className="payment-lifecycle__waiting"><span className="payment-lifecycle__event-dot" aria-hidden="true">·</span>{language === 'bn' ? 'পরবর্তী নিশ্চিতকরণের অপেক্ষায়…' : 'Waiting for the next confirmation…'}</li>}
            </ol>
          </div>
          </details>
          {batchAttempt && <section aria-label={language === 'bn' ? 'পেমেন্ট রেকর্ড' : 'Payment records'} className="mt-4 space-y-3 px-4 sm:px-5" data-testid="other-tax-batch-results">
            <h3 className="font-semibold">{language === 'bn' ? 'প্রতিটি পরিশোধের বিবরণ' : 'Individual payment records'}</h3>
            <ul className="space-y-2 list-none p-0 m-0">
              {batchAttempt.items.map(item => {
                const itemReceipt = confirmedReceipts.find(record => record.paymentTransactionId === item.confirmedId);
                const head = otherTaxAllocationHead(item.receipt.items[0].headId);
                return <li key={item.sourceId} className="rounded-lg border border-taxpay-border p-3" data-testid="other-tax-batch-result">
                  <p className="font-semibold break-words">{item.receipt.taxpayerTin} · {item.receipt.assessmentYear}</p>
                  <p>{language === 'bn' ? head?.nameBn || head?.nameEn : head?.nameEn} · {formatCurrency(item.receipt.totalAmount, language)}</p>
                  <p className="break-all text-sm">{language === 'bn' ? 'রেফারেন্স' : 'Reference'}: {item.receipt.challanNo}</p>
                  <p className="text-sm">{itemReceipt ? (language === 'bn' ? 'রেকর্ড সংরক্ষিত' : 'Record saved') : (language === 'bn' ? 'অপেক্ষমাণ' : 'Pending')}</p>
                  {itemReceipt && <button type="button" className="payment-lifecycle__secondary mt-2 inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
                    aria-label={language === 'bn' ? `${item.receipt.taxpayerTin}, ${head?.nameBn || head?.nameEn}, ${item.receipt.assessmentYear}-এর রসিদ দেখুন`
                      : `View receipt for ${item.receipt.taxpayerTin}, ${head?.nameEn}, ${item.receipt.assessmentYear}`}
                    onClick={() => { setCreatedReceipt(itemReceipt); setShowReceiptDetails(true); }}>
                    {language === 'bn' ? 'রসিদ দেখুন' : 'View receipt'}
                  </button>}
                </li>;
              })}
            </ul>
          </section>}
          {bankPending && <div className="payment-lifecycle__result payment-lifecycle__result--pending">
            <FileText size={21} aria-hidden="true" />
            <div>
              <strong>{language === 'bn' ? 'এটি এখনো পরিশোধিত কর নয়' : 'This is not tax paid yet'}</strong>
              <p>{language === 'bn' ? 'ব্যাংক নিষ্পত্তি ও কর ক্রেডিট নিশ্চিত হয়নি।' : 'Bank settlement and tax credit are not confirmed.'}</p>
            </div>
          </div>}
          {bankPending && errorMessage && <p role="alert">{errorMessage}</p>}
          {declined && <div className="payment-lifecycle__result payment-lifecycle__result--failed"><AlertCircle size={20} aria-hidden="true" /><p>{errorMessage || (language === 'bn' ? 'পেমেন্ট মাধ্যমটি অনুরোধ প্রত্যাখ্যান করেছে। অন্য পদ্ধতিতে আবার চেষ্টা করুন।' : 'The payment channel declined the request. You can retry with another method.')}</p></div>}
          {completed && <div className="payment-lifecycle__result payment-lifecycle__result--complete"><CheckCircle size={20} aria-hidden="true" /><p>{language === 'bn' ? 'পেমেন্ট রেকর্ড সংরক্ষিত হয়েছে; নিষ্পত্তি যাচাই হয়নি।' : 'Payment record saved; settlement is not verified.'}</p></div>}
          <div className="payment-lifecycle__actions no-print">
            {bankPending && <><button type="button" className="payment-lifecycle__secondary" onClick={() => window.print()}><FileText size={16} />{language === 'bn' ? 'স্লিপ প্রিন্ট করুন' : 'Print payment slip'}</button>{!embedded && <button type="button" className="payment-lifecycle__primary" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'}</button>}</>}
            {declined && !embedded && <button type="button" className="payment-lifecycle__primary" onClick={retryPayment}>{batchAttempt ? (language === 'bn' ? 'অপেক্ষমাণ রেকর্ডে আবার চেষ্টা' : 'Retry pending records') : (language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা করুন' : 'Try another payment method')}</button>}
            {completed && !embedded && (batchAttempt ? <button type="button" className="payment-lifecycle__primary" onClick={startAnotherBatch}>{copy.anotherPayment}</button> : <button type="button" className="payment-lifecycle__primary" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ দেখুন' : 'View receipt details'} <ArrowRight size={17} /></button>)}
          </div>
        </section>
        </div>
        {embedded && modalFooterTarget && createPortal(
          <PaymentJourneyFooter className="payment-flow-embedded__footer-actions"
            back={<button type="button" className="tax-service-choice__cancel" onClick={onBackToService} disabled={isProcessing}><ArrowLeft size={17} />{commonCopy.btnBack}</button>}
            next={<>
              {completed && (batchAttempt ? <button type="button" className="tax-service-choice__continue" onClick={startAnotherBatch}>{copy.anotherPayment} <ArrowRight size={17} /></button> : <button type="button" className="tax-service-choice__continue" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ' : 'Receipt details'} <ArrowRight size={17} /></button>)}
              {bankPending && <button type="button" className="tax-service-choice__continue" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'} <ArrowRight size={17} /></button>}
              {declined && <button type="button" className="tax-service-choice__continue" onClick={retryPayment}>{batchAttempt ? (language === 'bn' ? 'অপেক্ষমাণ রেকর্ডে আবার চেষ্টা' : 'Retry pending records') : (language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা' : 'Try another method')} <ArrowRight size={17} /></button>}
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
                  {[{ value: true, en: isWithholdingMode ? 'I am the withholding agent' : 'My tax liability', bn: isWithholdingMode ? 'আমি উৎসে কর কর্তনকারী' : 'আমার করদায়' }, { value: false, en: isWithholdingMode ? 'Paying for the agent' : 'Facilitate another taxpayer’s payment', bn: isWithholdingMode ? 'এজেন্টের পক্ষে পরিশোধ' : 'অন্য করদাতার কর পরিশোধে সহায়তা করুন' }].map(choice =>
                    <PaymentRadioCard key={String(choice.value)} id={choice.value ? 'guest-payer-self' : 'guest-payer-other'} name="guest-payer-relationship" value={String(choice.value)} checked={forSelf === choice.value}
                      onChange={() => { clearReferenceSelection(); setForSelf(choice.value); setAdditionalTaxpayers([]); setOtherTaxLines([]); setSuggestedBatchYears({}); setAuthorizedTaxpayerIds({}); setAuthorizedTaxpayerId(null); clearValidationError(); }} title={language === 'bn' ? choice.bn : choice.en} invalid={isFieldInvalid('payerChoice')} errorId={`${ERROR_ID}-payerChoice`} />)}
                </div>
                {forSelf === null && <p className="payment-radio-card__empty">{language === 'bn' ? 'এগিয়ে যেতে একটি বিকল্প নির্বাচন করুন।' : 'No option selected. Choose one to continue.'}</p>}
                {fieldError('payerChoice')}
              </fieldset>
            </PaymentFormSection> : null}
            {forSelf !== null && <PaymentFormSection number={2} staticView={embedded} title={signedInBeneficiarySelection ? (language === 'bn' ? 'উপকারভোগী নির্বাচন' : 'Choose beneficiaries') : ownAccountTax ? (language === 'bn' ? 'অ্যাকাউন্টের তথ্য' : 'Account details') : otherBatch ? (language === 'bn' ? 'পরিশোধকারীর তথ্য' : 'Payer details') : (language === 'bn' ? 'করদাতার পরিচয়' : 'Taxpayer identification')} description={signedInBeneficiarySelection ? (language === 'bn' ? 'আপনার সংরক্ষিত তালিকা থেকে নির্বাচন করুন' : 'Select from your saved lists') : ownAccountTax ? (language === 'bn' ? 'অ্যাকাউন্ট থেকে আপনার করদাতার তথ্য দেখানো হচ্ছে' : 'Your taxpayer information is filled from your signed-in account') : otherBatch ? (language === 'bn' ? 'রসিদের জন্য আপনার নাম ও যোগাযোগের তথ্য' : 'Your name and receipt contact details') : (language === 'bn' ? 'করদাতার টিআইএন ও ঐচ্ছিক রেফারেন্স' : 'Taxpayer TIN and optional NBR reference')}>
            
            {signedInBeneficiarySelection && <SavedBeneficiaryPicker language={language} allowMultiple={otherBatch}
              selectedTins={(otherBatch ? batchTaxpayers : batchTaxpayers.slice(0,1)).map(person=>person.tin).filter(Boolean)}
              onAvailableTins={setAvailableSavedTins}
              onChoose={selected=>{
                clearReferenceSelection();
                const unique=selected.filter((person,index)=>selected.findIndex(candidate=>candidate.tin===person.tin)===index);
                const first=unique[0];
                const priorPrimaryTin=taxpayerTin;
                const additional=otherBatch ? unique.slice(1).map(person=>{
                  const previous=additionalTaxpayers.find(candidate=>candidate.tin===person.tin);
                  return {...person,id:previous?.id??crypto.randomUUID()};
                }) : [];
                setTin(first?.tin??'');
                setOtherTaxpayerName(first?.name??'');
                setAdditionalTaxpayers(additional);
                setOtherTaxLines(lines=>lines.filter(line=>line.taxpayerId==='primary'
                  ? Boolean(first&&first.tin===priorPrimaryTin)
                  : additional.some(person=>person.id===line.taxpayerId)));
                setAuthorizedTaxpayerId(null);
                setAuthorizedTaxpayerIds({});
                setSuggestedBatchYears({});
                clearValidationError();
              }} />}
            {signedInBeneficiarySelection && isFieldInvalid('tin') &&
              <p className="text-sm text-red-700" role="alert">{errorMessage}</p>}
            <div className="payment-identity__fields">
              {ownAccountTax && <SignedInTaxpayerCard profile={ownProfile} language={language} id="signed-in-account-taxpayer-card" />}
              {!ownAccountTax && <>
              {(!otherBatch || ownAccountTax) && !signedInBeneficiarySelection && <div className="payment-identity__tin">
                <label htmlFor="guest-tin" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isWithholdingMode ? (language === 'bn' ? 'উইথহোল্ডিং এজেন্টের টিআইএন' : 'Withholding agent’s TIN') : (language === 'bn' ? 'করদাতার টিআইএন' : 'Taxpayer’s TIN')} *
                </label>
                <div className="tin-lookup__row">
                <input
                  id="guest-tin"
                  type="text"
                  aria-invalid={isFieldInvalid('tin') || undefined}
                  aria-describedby={errorDescription('tin')}
                  placeholder={allowSyntheticDemoTin ? (language === 'bn' ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN') : ownAccountTax ? '—' : language === 'bn' ? '১২ সংখ্যার টিআইএন লিখুন' : 'Enter the 12-digit TIN'}
                  value={taxpayerTin}
                  inputMode="numeric" maxLength={ownAccountTax || allowSyntheticDemoTin ? 13 : 12} autoComplete="off" required
                  readOnly={ownAccountTax} aria-readonly={ownAccountTax || undefined}
                  onChange={(e) => { clearReferenceSelection(); setAuthorizedTaxpayerId(null); setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>additionalTaxpayers.some(person=>person.tin===knownTin)))); setSuggestedBatchYears({}); setTin(e.target.value.replace(/\D/g, '').slice(0, allowSyntheticDemoTin ? 13 : 12)); }}
                  className={`min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex ${ownAccountTax ? 'bg-slate-100 text-slate-800' : ''}`}
                />
                <button type="button" className="tin-lookup__search" onClick={searchTin} disabled={!/^\d{12,13}$/.test(taxpayerTin)}>
                  <Search size={17} aria-hidden="true" />{language === 'bn' ? 'খুঁজুন' : 'Search'}
                </button>
                </div>
                {fieldError('tin')}
                <div className="tin-lookup__name mt-3">
                  <label htmlFor="guest-taxpayer-name" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'করদাতার নাম (ঐচ্ছিক)' : 'Taxpayer name (optional)'}</label>
                  <input id="guest-taxpayer-name" type="text" value={sampleTaxpayer ? (language === 'bn' ? sampleTaxpayer.nameBn : sampleTaxpayer.nameEn) : ownAccountTax ? accountName : ''}
                    placeholder={language === 'bn' ? 'টিআইএন খুঁজলে নাম এখানে দেখাবে' : 'Search TIN to fill name'} readOnly aria-readonly="true"
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-100 text-slate-800" />
                </div>
                {taxpayerLookupResult}
              </div>}

              {forSelf === false && !signedInBeneficiarySelection && <div>
                <label htmlFor="guest-payer-name" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'আপনার নাম (পরিশোধকারী)' : 'Your name (payer)'} *</label>
                <input
                  id="guest-payer-name"
                  type="text"
                  aria-invalid={isFieldInvalid('payerName') || undefined}
                  aria-describedby={errorDescription('payerName')}
                  placeholder={copy.payerNamePlaceholder}
                  value={effectivePayerName}
                  readOnly={Boolean(signedInPayerName)} aria-readonly={Boolean(signedInPayerName)}
                  required autoComplete="name"
                  onChange={(e) => setPayerName(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
                {fieldError('payerName')}
              </div>}

              </>}
              {(!ownAccountTax || !isWithholdingMode) && <div className={`payment-identity__receipt-row${ownAccountTax ? " payment-identity__receipt-row--account" : ""}`}>
                {!ownAccountTax && <div>
                <label htmlFor="guest-phone" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'রসিদের জন্য মোবাইল নম্বর' : 'Mobile number for receipt'} *</label>
                <input
                  id="guest-phone"
                  type="tel"
                  placeholder={copy.mobilePlaceholder}
                  value={receiptPhone}
                  aria-invalid={isFieldInvalid('phone') || undefined}
                  aria-describedby={errorDescription('phone')}
                  inputMode="numeric" maxLength={11} autoComplete="tel-national" required
                  readOnly={Boolean(signedInProfile?.receiptMobile)} aria-readonly={Boolean(signedInProfile?.receiptMobile) || undefined}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className={`min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex ${signedInProfile?.receiptMobile ? 'bg-slate-100 text-slate-800' : ''}`}
                />
                {fieldError('phone')}
                </div>}



              {!isWithholdingMode && <div>
                <label htmlFor="guest-notice-ref" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'NBR নোটিশ বা পেমেন্ট রেফারেন্স' : 'NBR notice or payment reference'} {requiresNBRReference ? '*' : (language === 'bn' ? '(ঐচ্ছিক)' : '(optional)')}</label>
                <input id="guest-notice-ref" type="text" value={noticeReference} onChange={event => { clearReferenceSelection(); setNoticeReference(event.target.value); }} required={requiresNBRReference}
                  aria-invalid={isFieldInvalid('noticeReference') || undefined} aria-describedby={errorDescription('noticeReference')}
                  placeholder="PN-2026-000392" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
                {fieldError('noticeReference')}
                </div>}
              </div>}
            </div>
            </PaymentFormSection>}
            {otherBatch && !ownAccountTax && !signedInBeneficiarySelection && <PaymentFormSection number={3} staticView={embedded}
              title={language === 'bn' ? 'এই পেমেন্টের করদাতারা' : 'Taxpayers in this payment'}
              description={language === 'bn' ? 'প্রত্যেক করদাতার জন্য আলাদা টিআইএন দিন। নাম ঐচ্ছিক; পরের ধাপে প্রতিটি পেমেন্ট খাত একজন করদাতাকে বরাদ্দ করবেন।' : 'Enter a unique TIN for each taxpayer. Names are optional. Assign each payment head to a taxpayer in the next step.'}>
              <OtherTaxTaxpayerList language={language} primaryTin={taxpayerTin} primaryName={ownAccountTax ? accountName : otherTaxpayerName} lockedPrimary={ownAccountTax} allowAdditional={forSelf === false}
                additional={additionalTaxpayers} allocations={otherTaxLines}
                invalidId={invalidBatchTaxpayerId} tinError={isFieldInvalid('tin') ? errorMessage : undefined}
                onPrimaryTin={value => { clearReferenceSelection(); setOtherTaxpayerName(''); setAuthorizedTaxpayerId(null); setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>additionalTaxpayers.some(person=>person.tin===knownTin)))); setSuggestedBatchYears({}); setTin(value); }}
                onPrimarySearch={searchTin} onPrimaryName={setOtherTaxpayerName} allowSyntheticDemoTin={allowSyntheticDemoTin} onAdditional={people => {
                  setAdditionalTaxpayers(people);
                  setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>
                    knownTin===taxpayerTin||people.some(person=>person.tin===knownTin))));
                  setSuggestedBatchYears(current=>Object.fromEntries(Object.entries(current).filter(([personId])=>
                    personId==='primary'||people.some(person=>person.id===personId))));
                }}
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
            {inlinePaymentCalculation}
          </div>
        )}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {step === 2 && (otherBatch ? (
          <>
          {signedInAccount && (batchSuggestionTaxpayers.length > 0
            ? batchSuggestionTaxpayers.map(({ person, userId }) => <AccountPaymentSuggestions key={person.id}
              userId={userId} taxpayerLabel={person.name || person.tin} language={language}
              mode="OTHER_TAX_PAYMENT" onChoose={chooseSuggestedHead} />)
            : <AccountPaymentSuggestions userId={null} language={language} mode="OTHER_TAX_PAYMENT" onChoose={chooseSuggestedHead} />)}
          <OtherTaxBatchComposer language={language} taxpayers={batchTaxpayers} summary={inlinePaymentCalculation}
            lines={otherTaxLines} suggestedAssessmentYears={suggestedBatchYears} focusRequest={summaryJump} onChange={next => {
              setOtherTaxLines(next);
              // Keep the invalid-row indicators visible until every selected
              // head is corrected, instead of hiding them after the first edit.
              if (isFieldInvalid('headId')) {
                const sum = otherTaxAllocationTotal(next);
                const unique = new Set(next.map(line => `${line.taxpayerId}:${line.headId}:${line.assessmentYear}`)).size === next.length;
                const allValid = unique && next.length > 0 && sum !== null && sum > 0 &&
                  next.every(line => isOtherTaxHeadEligible(line.headId) &&
                    OTHER_TAX_YEARS.some(year => year === line.assessmentYear) &&
                    batchTaxpayers.some(person => person.id === line.taxpayerId));
                if (allValid) clearValidationError();
              }
            }}
            error={isFieldInvalid('headId') ? errorMessage : undefined} />
          </>
        ) : (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__payment' : ''}`}>
            <div className="payment-form-layout__sections">
            {signedInAccount && <AccountPaymentSuggestions userId={suggestionUserId} language={language}
              mode={isWithholdingMode?'SOURCE_TAX_DEPOSIT':category === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX_PAYMENT'}
              onChoose={chooseSuggestedHead} />}
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
                ? 'রিটার্ন অনুযায়ী পরিশোধের পরিমাণ লিখুন। প্রযোজ্য ধারা পেমেন্টের সারসংক্ষেপে দেখুন।'
                : 'Enter the amount from your return. See the payment summary for the applicable sections.'
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
            {inlinePaymentCalculation}
          </div>
        ))}

        {/* STEP 3: Review Challan & Execute Simulated Gateway */}
        {step === 3 && (
          <div className="payment-review" data-testid="payment-review">
            <div className="payment-review__main">
              <section className="payment-review__panel" aria-labelledby="guest-payment-channel-title">
                <div className="payment-review__section-title"><span className="payment-review__section-number">01</span><div><h2 id="guest-payment-channel-title">{language === 'bn' ? 'পেমেন্ট চ্যানেল বেছে নিন' : 'Choose payment channel'}</h2><p>{language === 'bn' ? 'অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন' : 'Choose online payment or a bank branch'}</p></div></div>
                {!storyAmountSupported && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {language === 'bn' ? `মোট পরিমাণের সর্বোচ্চ সীমা ${formatCurrency(Number(MAX_STORY_AMOUNT_MINOR) / 100, language)}।`
                    : `The maximum supported total is ${formatCurrency(Number(MAX_STORY_AMOUNT_MINOR) / 100, language)}.`}
                </p>}
                {batchRecoveryError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {language === 'bn' ? 'পূর্বের অনুরোধ উদ্ধার করা যায়নি। এই পৃষ্ঠা আবার খুলে চেষ্টা করুন।' : 'The previous request could not be recovered. Reopen this page and try again.'}
                </p>}
                {!batchRecoveryError && !errorField && errorMessage && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
                {otherBatch && (forSelf === false || otherTaxLines.length > 1 || batchTaxpayers.length > 1) && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-taxpay-dark mb-3">
                  {language === 'bn' ? 'নির্বাচিত প্রতিটি খাতের জন্য আলাদা পেমেন্ট রেকর্ড তৈরি হবে।' :
                    'A separate payment record will be created for each selected head.'}
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
              {inlinePaymentCalculation}
            </aside>
            {!embedded && <div className="payment-review__standalone-actions">
              <button type="button" className="payment-review__back" onClick={() => setStep(2)}><ArrowLeft size={17} />{commonCopy.btnBack}</button>
              <button type="button" className="payment-review__pay" onClick={handleExecutePayment} disabled={batchRecoveryError || !paymentChannel || !paymentMethod || !acknowledged || isProcessing || !storyAmountSupported || (otherBatch && !batchValid)}>{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}<ArrowRight size={17} /></button>
            </div>}
          </div>
        )}
      </div>
      {embedded && modalFooterTarget && createPortal(
        <div className="payment-flow-embedded__footer-actions">
          {mobilePaymentFooter && step <= 3 && (
            <details key={step} className="payment-flow-embedded__mobile-summary" data-testid="mobile-payment-calculation">
              <summary className="payment-flow-embedded__mobile-summary-toggle" data-testid="mobile-payment-calculation-toggle">
                <span className="payment-flow-embedded__mobile-summary-heading"><ReceiptText size={18} aria-hidden="true" />{language === 'bn' ? 'পেমেন্টের হিসাব' : 'Payment calculation'}</span>
                <strong className="payment-flow-embedded__mobile-summary-total">{mobileSummaryTotal === null ? '—' : formatCurrency(mobileSummaryTotal, language)}</strong>
                <ChevronDown size={18} className="payment-flow-embedded__mobile-summary-chevron" aria-hidden="true" />
              </summary>
              <div className="payment-flow-embedded__mobile-summary-details" data-testid="mobile-payment-calculation-details">{paymentCalculation}</div>
            </details>
          )}
          {step === 1 ? (
            <>
              <button type="button" className="tax-service-choice__cancel" onClick={onBackToService}>
                <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
              </button>
              <button type="button" className="tax-service-choice__continue" aria-label={language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount'} onClick={handleStep1Next} disabled={!canContinueStep1}>
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
            <button type="button" className="tax-service-choice__continue" onClick={handleExecutePayment} disabled={batchRecoveryError || isProcessing || !paymentChannel || !paymentMethod || !acknowledged || !storyAmountSupported || (otherBatch && !batchValid)} aria-busy={isProcessing}>
              {paymentChannel === 'OTC' ? <FileText size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}{paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip') : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}
            </button>
          </>) : null}
        </div>, modalFooterTarget
      )}
    </div>
  );
};
