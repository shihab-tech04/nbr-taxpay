import { PaymentReviewTotal, PaymentChannelScreen, PaymentConfirmationLayout, WalkInChallanAction, WalkInResultBenefits, PaymentReviewDetails, PaymentPayerDetails, PaymentConfirmationHeading, PaymentConfirmationOverview } from '../ui/UnifiedPaymentStages';
import { maskTinForDisplay } from '../../services/tinDisplay';
import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import { TaxpayerTinLookup, TaxpayerTinSearchResultCard } from '../ui/TaxpayerTinLookup';
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
  Pencil,
  ChevronDown,
  ReceiptText
} from 'lucide-react';
import { useTaxState, type PaymentBeneficiaryPrefill } from '../../services/taxState';
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
import { AccountPaymentDraftControls } from '../ui/AccountPaymentDraftControls';
import { deletePaymentFormDraft, isPaymentDraftService, type PaymentFormDraft, type PaymentDraftActor } from '../../services/accountPaymentFormDrafts';
import { isOptionalReceiptEmailValid, normaliseReceiptEmail } from '../../services/receiptEmail';
import { usePaymentAccountProfile } from '../../services/paymentAccountProfile';
import {reuseRecordedPayment,type PaymentReuse} from '../../services/paymentReuse';
import { limitChallanRemarks } from '../../services/challanRemarks';
import {activePreviewSession} from '../../services/previewAccountSession';
import { getStorySessionId, persistSimulatedPayment, type StoryPaymentInput } from '../../services/simulatedPaymentStory';
import { prepareCombinedOtherTaxPayment, saveCombinedOtherTaxRequest, loadCombinedOtherTaxRequest, clearCombinedOtherTaxRequest, fitsCombinedAllocationCapacity, MAX_COMBINED_ALLOCATIONS } from '../../services/otherTaxCombinedPayment';
import { clearOtherTaxBatch, confirmedBatchReceipts, loadOtherTaxBatch,
  saveOtherTaxBatch, syncOtherTaxBatch, type OtherTaxBatch } from '../../services/otherTaxBatchSubmission';
import { OtherTaxTaxpayerList } from './OtherTaxTaxpayerList';
import { UnifiedTaxpayerWorkspace } from './UnifiedTaxpayerWorkspace';
import { SavedBeneficiaryPicker } from './SavedBeneficiaryPicker';
import { SignedInTaxpayerCard } from './SignedInPaymentEnhancements';
import { SuggestedAmountInfo } from '../ui/SuggestedAmountInfo';
import { paymentAmountSuggestionFor, type SuggestedAmountGroup } from '../../services/paymentAmountSuggestions';
import { loadBeneficiaries } from '../../services/beneficiaries';
import { demoIncomeTaxTypeForTin, incomeTaxEntityTypeLabel, type IncomeTaxEntityType } from '../../services/demoIncomeTaxType';
import { userIdForHostedTin } from '../../services/hostedDemoAuthorizations';
import { isSupportedBeneficiaryTin } from '../../services/taxpayerTinValidation';
import { normalizeRestoredWalkInPayerTin } from '../../services/walkInPayerTinDraft';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import { resolvePaymentPartyIdentity } from '../../services/paymentPartyIdentity';
import { RETURN_HEAD_ID, RETURN_YEARS, returnOnlyIssue, assertReturnDraftExclusive } from '../../services/taxWithReturnContract';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import type { DemoUserId } from '../../data/demoUsers';
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

type GuestErrorField = 'payerChoice' | 'tin' | 'payerName' | 'payerTin' | 'phone' | 'email' | 'noticeReference' | 'incomeTaxType' | 'headId' | 'assessmentYear' | 'taxAmount';
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
  /** Previously verified account-owned draft selected at Pay Tax entry. */
  initialDraft?: PaymentFormDraft;
  initialReuse?: PaymentReuse;
  /** Payer relationship is chosen before service selection in the Pay Tax modal. */
  initialForSelf?: boolean;
  initialBeneficiary?: PaymentBeneficiaryPrefill;
  onBackToService?: () => void;
  onManageBeneficiaries?: (mode?:'manage'|'add') => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
  onResultViewChange?: (view: 'result' | 'receipt' | 'certificate') => void;
  onCheckoutChange?: (checkout: boolean) => void;
  /** Register this step's header Back handler; unified Walk-in footer stays single-CTA. */
  registerHeaderBack?: (action: (() => void) | null) => void;
  /** New Home entry: preserve the existing payment engine but present three input steps. */
  unifiedFlow?: boolean;
}

export const GuestPayment: React.FC<GuestPaymentProps> = ({ isWithholdingMode = false, embedded = false, withAccount = false, initialCategory, initialDraft, initialReuse, initialForSelf, initialBeneficiary, onBackToService, onManageBeneficiaries, onStageChange, onResultViewChange, onCheckoutChange, registerHeaderBack, unifiedFlow = false }) => {
  const { language, navigate, addPaymentReceipt, routeParams, previewAccount, setPaymentServiceChoiceOpen, startPaymentReuse } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  // The standalone guest route can also be visited from a signed-in session.
  const signedInAccount = withAccount || Boolean(authenticatedUser || previewAccount);
  // The new parallel walk-in has no saved drafts or guest draft exit action.
  // Preserve the previously supported standalone/legacy guest draft capability
  // and all signed-in account draft controls without changing backend storage.
  const unifiedAccountSelection = unifiedFlow && withAccount && signedInAccount;
  const unsignedGuestDrafts = !signedInAccount && backendConfigured && !unifiedFlow;
  const accountTaxpayer = usePaymentAccountProfile(signedInAccount ? authenticatedUser?.id ?? null : null, signedInAccount ? previewAccount : null);
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const commonCopy = UI_STRINGS[language];
  const copy = GUEST_COPY[language];

  // Wizard state steps: 1: Taxpayer & Identification, 2: Head & Amount, 3: Review & Gateway, 4: Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [unifiedCheckout, setUnifiedCheckout] = useState(false);
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
  // Guest payer identity is independent of all recipient TINs and allocations.
  const [walkInPayerTin, setWalkInPayerTin] = useState('');
  const [walkInPayerLookup, setWalkInPayerLookup] = useState<ReturnType<typeof lookupSampleTaxpayer>>(null);
  const [walkInPayerConfirmed, setWalkInPayerConfirmed] = useState(false);
  const [walkInPayerSearchedTin, setWalkInPayerSearchedTin] = useState('');
  const confirmedWalkInPayer = walkInPayerConfirmed && walkInPayerLookup?.tin === walkInPayerTin
    ? walkInPayerLookup : null;
  const [otherTaxpayerName, setOtherTaxpayerName] = useState(initialBeneficiary?.name ?? '');
  const [additionalTaxpayers, setAdditionalTaxpayers] = useState<OtherTaxTaxpayer[]>(() =>
    (initialBeneficiary?.additional ?? []).map(person => ({ ...person,
      id: initialBeneficiary?.parallelSource ? 'parallel-' + person.tin : crypto.randomUUID() }))
  );
  // A one-time recipient belongs to this payment only; it is never written to a saved list.
  const [oneTimeTaxpayer, setOneTimeTaxpayer] = useState<OtherTaxTaxpayer | null>(null);
  const [oneTimeTinDraft, setOneTimeTinDraft] = useState('');
  const [oneTimeSearchedTin, setOneTimeSearchedTin] = useState<string | null>(null);
  const [oneTimeLookupError, setOneTimeLookupError] = useState('');
  // Keep confirmation across stage navigation, but invalidate it when a TIN changes.
  const [confirmedOtherTaxTins, setConfirmedOtherTaxTins] = useState<Record<string, string>>(() => {
    if (!initialBeneficiary?.parallelSource) return {};
    // Only a previously matched public simulation catalogue entry can be
    // preconfirmed. An account owner's saved-recipient/RLS check still runs.
    return Object.fromEntries([
      {id:'primary',tin:initialBeneficiary.tin},
      ...(initialBeneficiary.additional ?? []).map(person => ({id:'parallel-'+person.tin,tin:person.tin})),
    ].filter(person => lookupSampleTaxpayer(person.tin)?.tin === person.tin)
      .map(person => [person.id,person.tin]));
  });
  const [invalidBatchTaxpayerId, setInvalidBatchTaxpayerId] = useState<string | null>(null);
  const [otherTaxLines, setOtherTaxLines] = useState<OtherTaxAllocation[]>(() => {
    if (!initialBeneficiary?.parallelSource || !Array.isArray(initialBeneficiary.parallelAllocations) ||
      !fitsCombinedAllocationCapacity(initialBeneficiary.parallelAllocations.length)) return [];
    const allowed = new Set([initialBeneficiary.tin,...(initialBeneficiary.additional ?? []).map(p=>p.tin)]);
    const seen = new Set<string>();
    return initialBeneficiary.parallelAllocations.filter(line => {
      const key = line.taxpayerTin + ':' + line.headId + ':' + line.assessmentYear;
      if (!allowed.has(line.taxpayerTin) || seen.has(key) || !(isOtherTaxHeadEligible(line.headId) || (unifiedFlow && line.headId === RETURN_HEAD_ID)) ||
        !OTHER_TAX_YEARS.some(year => year === line.assessmentYear) ||
        (parseGuestAmount(line.amount) ?? 0) <= 0) return false;
      seen.add(key);
      return true;
    }).map(line => ({id:crypto.randomUUID(),
      taxpayerId:line.taxpayerTin===initialBeneficiary.tin?'primary':'parallel-'+line.taxpayerTin,
      headId:line.headId,assessmentYear:line.assessmentYear,amount:line.amount}));
  });
  // Self liability is one taxpayer. Beneficiaries belong to the facilitator route.
  const [summaryJump, setSummaryJump] = useState<{ lineId: string; requestId: number }>({ lineId: '', requestId: 0 });
  const [activeCalculationLineId, setActiveCalculationLineId] = useState<string | null>(null);
  const [authorizedTaxpayerIds,setAuthorizedTaxpayerIds]=useState<Record<string,DemoUserId>>({});
  const [phone, setPhone] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [assessmentYear, setAssessmentYear] = useState('2026-27');
  // The later approved UX supersedes v11's preselected self-tax default.
  const [forSelf, setForSelf] = useState<boolean | null>(initialForSelf ?? null);
  const ownAccountTax = signedInAccount && forSelf === true;
  const signedInBeneficiarySelection = signedInAccount && forSelf === false;
  const oneTimeSearchMatch = oneTimeSearchedTin === oneTimeTinDraft
    ? lookupSampleTaxpayer(oneTimeTinDraft) : null;
  // A saved TIN must be present in the current account's loaded lists; a route prefill is insufficient.
  // Saved TINs must belong to this account; one-time sample entries require a separate confirmation.
  const [availableSavedTins,setAvailableSavedTins] = useState<string[] | null>(null);
  const [oneTimeRecipient,setOneTimeRecipient]=useState<{ownerId:string;tin:string;nameEn:string;nameBn:string}|null>(null);
  const paymentOwnerId=authenticatedUser?.id??previewAccount?.id??null;
  const activeOneTimeRecipient=paymentOwnerId&&oneTimeRecipient?.ownerId===paymentOwnerId?oneTimeRecipient:null;
  const signedInProfile = signedInAccount ? accountTaxpayer.profile : null;
  const ownProfile = ownAccountTax ? signedInProfile : null;
  const accountName = ownProfile ? language === 'bn' ? ownProfile.nameBn : ownProfile.nameEn : '';
  const signedInPayerName = signedInProfile ? language === 'bn' ? signedInProfile.nameBn : signedInProfile.nameEn : '';
  // A verified Auth account can use its approved synthetic profile binding;
  // this ID is still strictly demo-only and never a real taxpayer entitlement.
  const demoConsentActor = previewAccount?.id ?? (signedInProfile ? userIdForHostedTin(signedInProfile.tin) : null);
  const allowSyntheticDemoTin = Boolean(signedInAccount && forSelf === false && demoConsentActor);
  const taxpayerTin = ownAccountTax ? ownProfile?.tin ?? '' : tin;
  const receiptPhone = signedInProfile?.receiptMobile || phone;
  const [authorizedTaxpayerId, setAuthorizedTaxpayerId] = useState<DemoUserId | null>(null);
  const [beneficiaryChecking, setBeneficiaryChecking] = useState(false);
  const [beneficiaryRefreshKey, setBeneficiaryRefreshKey] = useState(0);
  const suggestionUserId = ownAccountTax ? demoConsentActor : null;
  const taxZone = ownProfile?.taxZone ?? '—';
  const taxCircle = ownProfile?.taxCircle ?? '—';
  const [noticeReference, setNoticeReference] = useState('');
  // Optional parent-challan note, separate from structured reference and head metadata.
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [lastSearchedTin, setLastSearchedTin] = useState<string | null>(
    initialBeneficiary?.parallelSource && lookupSampleTaxpayer(initialBeneficiary.tin) ? initialBeneficiary.tin : null);
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
  const [taxpayerEntityOverrides, setTaxpayerEntityOverrides] = useState<Record<string, IncomeTaxEntityType>>({});
  const [unifiedReturnSelectionNotice, setUnifiedReturnSelectionNotice] = useState('');
  // Park the alternative Other Tax allocations while Return is active. They are
  // not part of the exclusive Return payload and can be restored on switching back.
  const [unifiedOtherTaxParkedLines, setUnifiedOtherTaxParkedLines] = useState<OtherTaxAllocation[]>([]);
  

  // Category and Head selection
  const [category, setCategory] = useState<PaymentCategory>(
    isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' :
      (initialCategory || (typeof routeParams?.initialCategory === 'string' && CATEGORY_LABELS[routeParams.initialCategory]
        ? routeParams.initialCategory as PaymentCategory : 'TAX_WITH_RETURN'))
  );
  const effectivePayerName = signedInAccount && signedInPayerName ? signedInPayerName
    : forSelf === false && category === 'OTHER_TAX_PAYMENT' && confirmedWalkInPayer
      ? (language === 'bn' ? confirmedWalkInPayer.nameBn : confirmedWalkInPayer.nameEn)
      : payerName;
  const [selectedHeadIds, setSelectedHeadIds] = useState<number[]>([]);
  // Both payer relationships use the same Other Tax selection and allocation UI.
  const otherBatch = !isWithholdingMode && forSelf !== null && category === 'OTHER_TAX_PAYMENT';
  useEffect(()=>{setOneTimeRecipient(null);},[paymentOwnerId,unifiedAccountSelection ? null : forSelf,unifiedAccountSelection ? null : category]);
  const simpleOwnOtherTax = otherBatch && forSelf === true && !signedInAccount;
  // Retain older draft data for recovery, but never submit extra recipients as SELF.
  const selfLiabilityHasAdditionalRecipients = forSelf === true &&
    (additionalTaxpayers.length > 0 || oneTimeTaxpayer !== null ||
      otherTaxLines.some(line => line.taxpayerId !== 'primary'));
  const savedBatchTaxpayers: OtherTaxTaxpayer[] = [
    { id: 'primary', tin: taxpayerTin, name: ownAccountTax ? accountName : otherTaxpayerName },
    ...(forSelf === false ? additionalTaxpayers : []),
  ];
  const batchTaxpayers: OtherTaxTaxpayer[] = forSelf === false && oneTimeTaxpayer
    ? [...savedBatchTaxpayers, oneTimeTaxpayer] : savedBatchTaxpayers;
  const entityTypeForTin = (value: string): IncomeTaxEntityType | null =>
    taxpayerEntityOverrides[value] ?? demoIncomeTaxTypeForTin(value);
  // A confirmed one-time recipient may occupy the primary slot when no saved
  // beneficiary was selected. Never silently save or duplicate that recipient.
  const primaryOneTimeRecipient: OtherTaxTaxpayer | null =
    signedInBeneficiarySelection && activeOneTimeRecipient?.tin === taxpayerTin && !oneTimeTaxpayer
      ? {id:'primary',tin:taxpayerTin,name:activeOneTimeRecipient.nameEn} : null;
  const currentOneTimeRecipient = unifiedAccountSelection && activeOneTimeRecipient ? batchTaxpayers.find(p=>p.tin===activeOneTimeRecipient.tin) ?? null : oneTimeTaxpayer ?? primaryOneTimeRecipient;
  const savedRecipientSelectionValid = Boolean(availableSavedTins) &&
    savedBatchTaxpayers.every(person=>Boolean(person.tin) &&
      (availableSavedTins!.includes(person.tin) || (unifiedAccountSelection && (person.tin===signedInProfile?.tin || person.tin===currentOneTimeRecipient?.tin)) ||
        (person.id==='primary' && primaryOneTimeRecipient?.tin===person.tin)));
  const unavailableUnifiedRecipient=unifiedAccountSelection&&availableSavedTins!==null&&savedBatchTaxpayers.some(person=>person.tin&&person.tin!==signedInProfile?.tin&&person.tin!==currentOneTimeRecipient?.tin&&!availableSavedTins.includes(person.tin));
  const batchAmount = otherTaxAllocationTotal(otherTaxLines);
  const missingBatchTaxpayer = batchTaxpayers.find(person => !otherTaxLines.some(line => line.taxpayerId === person.id));
  const uniqueBatchAllocations = new Set(otherTaxLines.map(line =>
    `${line.taxpayerId}:${line.headId}:${line.assessmentYear}`)).size === otherTaxLines.length;
  const batchValid = !selfLiabilityHasAdditionalRecipients && uniqueBatchAllocations && otherTaxLines.length > 0 && fitsCombinedAllocationCapacity(otherTaxLines.length) && batchAmount !== null && batchAmount > 0
    && !missingBatchTaxpayer
    && otherTaxLines.every(line => (isOtherTaxHeadEligible(line.headId) || (unifiedFlow && line.headId === RETURN_HEAD_ID))
      && batchTaxpayers.some(person => person.id === line.taxpayerId)
      && OTHER_TAX_YEARS.some(year => year === line.assessmentYear));

  // Match the existing identity validator before enabling the primary action.
  // Saved-beneficiary ownership is rechecked against current lists on Continue.
  const canContinueStep1 = (() => {
    if (unifiedAccountSelection && !signedInProfile) return false;
    if (beneficiaryChecking || forSelf === null || selfLiabilityHasAdditionalRecipients || (ownAccountTax && !ownProfile)) return false;
    if (signedInBeneficiarySelection && !savedRecipientSelectionValid) return false;
    if (ownAccountTax && additionalTaxpayers.length && (!availableSavedTins ||
      !additionalTaxpayers.every(person => availableSavedTins.includes(person.tin)))) return false;
    const tinValid = ownAccountTax
      ? /^\d{12,13}$/.test(taxpayerTin)
      : isSupportedBeneficiaryTin(taxpayerTin, allowSyntheticDemoTin);
    if (!tinValid) return false;
    if (otherBatch) {
      if (unifiedFlow && batchTaxpayers.some(person => !entityTypeForTin(person.tin))) return false;
      if (!signedInAccount && batchTaxpayers.some(person =>
          (forSelf === false || person.id !== 'primary') && confirmedOtherTaxTins[person.id] !== person.tin)) return false;
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
    // Payer and receipt details are collected in the final preview for this entry.
    if (!unifiedFlow) {
    if (!/^01\d{9}$/.test(receiptPhone)) return false;
    if (!isOptionalReceiptEmailValid(receiptEmail)) return false;
    if (forSelf === false && !signedInAccount && effectivePayerName.trim().length < 2) return false;
    if (otherBatch && forSelf === false && !signedInAccount && walkInPayerTin &&
      (!(unifiedFlow ? /^\d{12,13}$/ : /^\d{12}$/).test(walkInPayerTin) || !confirmedWalkInPayer)) return false;
    const reference = noticeReference.trim();
    if (reference && /^\d{12}$/.test(taxpayerTin) && !isWithholdingMode && !ownAccountTax && !signedInBeneficiarySelection) {
      const matched = findV11GuestNotice(taxpayerTin, reference);
      if (!matched || matched.category !== category) return false;
    }
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
  const [sourcePaymentId, setSourcePaymentId] = useState<string | null>(initialReuse?.sourcePaymentId ?? null);
  // Read-only historical SQL allocation references. New payment lines always
  // receive fresh IDs; these are only linked to the immutable source parent.
  const [sourceAllocationIds, setSourceAllocationIds] = useState<string[]>(
    initialReuse?.sourceAllocationIds ? [...initialReuse.sourceAllocationIds] : []);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('review');
  const [officeMirrorPending, setOfficeMirrorPending] = useState(false);
  const [paymentValidationBlocked, setPaymentValidationBlocked] = useState(false);
  const [lifecycleStages, setLifecycleStages] = useState<LifecycleStage[]>([]);
  const [attemptReceipt, setAttemptReceipt] = useState<ChallanReceipt | null>(null);
  const lifecycleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [selectedAccountDraft, setSelectedAccountDraft] = useState<PaymentFormDraft | null>(null);
  const [draftFooterTarget, setDraftFooterTarget] = useState<HTMLDivElement | null>(null);
  const pendingStoryRef = useRef<{ payload: StoryPaymentInput; receipt: ChallanReceipt } | null>(null);
  // Reconcile a source-SQL simulation while Office delivery remains pending.
  const pendingMirrorRetryCount = useRef(0);
  const pendingConfirmationRetryable = useRef(false);
  const [batchAttempt, setBatchAttempt] = useState<OtherTaxBatch | null>(null);
  const batchAttemptRef = useRef<OtherTaxBatch | null>(null);
  const batchRecoveryChecked = useRef(false);
  const [batchRecoveryError, setBatchRecoveryError] = useState(false);
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const [receiptDocument, setReceiptDocument] = useState<'receipt' | 'certificate'>('receipt');
  const [selectedWalkInReceipt, setSelectedWalkInReceipt] = useState<ChallanReceipt | null>(null);
  const [skipPostPaymentLogin, setSkipPostPaymentLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentStorageWarning, setPaymentStorageWarning] = useState(false);
  const [errorField, setErrorField] = useState<GuestErrorField | null>(null);
  const [errorHeadId, setErrorHeadId] = useState<number | null>(null);


  // Save only editable form inputs. Current permission checks, TIN lookups,
  // gateway status and payment authorizations must be re-established on resume.
  const snapshotAccountDraft = (): Record<string, unknown> => ({
    schemaVersion: 1, category, step: Math.min(step, 2),
    ...(unifiedAccountSelection ? {unifiedFlowVersion:5, taxpayerEntityOverrides} : {}),
    forSelf, tin, payerName, walkInPayerTin, otherTaxpayerName, additionalTaxpayers, oneTimeTaxpayer,
    otherTaxLines, phone, receiptEmail, assessmentYear, noticeReference, paymentRemarks,
    incomeTaxType, selectedHeadIds, amountInputs, sourcePaymentId, sourceAllocationIds,
  });
  const restoreAccountDraft = (saved: Record<string, unknown>) => {
    if (saved.schemaVersion !== 1 || saved.category !== category)
      throw new Error('Saved payment category does not match the selected service.');
    assertReturnDraftExclusive(saved);
    const stringField = (key: string) => typeof saved[key] === 'string' ? String(saved[key]) : '';
    const restoredSourcePaymentId = stringField('sourcePaymentId').trim();
    setSourcePaymentId(initialReuse?.sourcePaymentId ?? (restoredSourcePaymentId || null));
    const savedAllocationIds = Array.isArray(saved.sourceAllocationIds) &&
      saved.sourceAllocationIds.length <= MAX_COMBINED_ALLOCATIONS &&
      saved.sourceAllocationIds.every(id=>typeof id==='string' && id.length>0 && id.length<=128) &&
      new Set(saved.sourceAllocationIds).size===saved.sourceAllocationIds.length
        ? saved.sourceAllocationIds as string[] : [];
    setSourceAllocationIds((initialReuse?.sourceAllocationIds ??
      (restoredSourcePaymentId ? savedAllocationIds : [])).slice());
    if (saved.forSelf !== null && typeof saved.forSelf !== 'boolean')
      throw new Error('Saved payer relationship is invalid.');
    setForSelf(saved.forSelf === null ? null : saved.forSelf as boolean);
    setTin(stringField('tin')); setPayerName(stringField('payerName'));
    // Drafts and Pay Again may re-enter through a legacy modal even when saved
    // in the 13-digit parallel journey. Preserve the full stored identifier;
    // each journey still enforces its own payer lookup/validation on submission.
    setWalkInPayerTin(normalizeRestoredWalkInPayerTin(stringField('walkInPayerTin')));
    setWalkInPayerLookup(null); setWalkInPayerConfirmed(false); setWalkInPayerSearchedTin('');
    setOtherTaxpayerName(stringField('otherTaxpayerName')); setPhone(stringField('phone'));
    setReceiptEmail(stringField('receiptEmail')); setAssessmentYear(stringField('assessmentYear') || (initialReuse ? '' : '2026-27'));
    setNoticeReference(stringField('noticeReference'));
    setPaymentRemarks(stringField('paymentRemarks'));
    setIncomeTaxType(saved.incomeTaxType === 'COMPANY' || saved.incomeTaxType === 'NON_COMPANY'
      ? saved.incomeTaxType : null);
    const heads = Array.isArray(saved.selectedHeadIds)
      ? saved.selectedHeadIds.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id)) : [];
    setSelectedHeadIds(heads);
    const amounts = saved.amountInputs && typeof saved.amountInputs === 'object' && !Array.isArray(saved.amountInputs)
      ? saved.amountInputs as Record<number, string> : {};
    setAmountInputs(Object.fromEntries(Object.entries(amounts).filter(([key, value]) =>
      /^\d+$/.test(key) && typeof value === 'string' && value.length <= 20
    )) as Record<number, string>);
    setAdditionalTaxpayers(Array.isArray(saved.additionalTaxpayers)
      ? saved.additionalTaxpayers.filter((person): person is OtherTaxTaxpayer =>
        person && typeof person.id === 'string' && typeof person.tin === 'string' &&
        typeof person.name === 'string').slice(0,100) : []);
    const savedOneTime = saved.oneTimeTaxpayer && typeof saved.oneTimeTaxpayer === 'object' &&
      !Array.isArray(saved.oneTimeTaxpayer) ? saved.oneTimeTaxpayer as Partial<OtherTaxTaxpayer> : null;
    setOneTimeTaxpayer(savedOneTime && typeof savedOneTime.id === 'string' &&
      typeof savedOneTime.tin === 'string' && /^\d{12}$/.test(savedOneTime.tin) &&
      typeof savedOneTime.name === 'string' && savedOneTime.name.length <= 160
      ? { id: savedOneTime.id, tin: savedOneTime.tin, name: savedOneTime.name } : null);
    setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError('');
    const restoredLines = Array.isArray(saved.otherTaxLines)
      ? saved.otherTaxLines.filter((line): line is OtherTaxAllocation =>
          line && typeof line.taxpayerId === 'string' &&
          typeof line.headId === 'number' && typeof line.assessmentYear === 'string' &&
          typeof line.amount === 'string').slice(0, MAX_COMBINED_ALLOCATIONS) : [];
    // Old Pay Again drafts used non-UUID "repeat-line-N" identifiers. Repair
    // only missing/invalid/duplicate IDs on input recovery, never original
    // allocation provenance or a valid new payment line.
    const usedIds = new Set<string>(initialReuse?.sourceAllocationIds ?? savedAllocationIds);
    setOtherTaxLines(restoredLines.map(line => {
      let id = typeof line.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(line.id) &&
        !usedIds.has(line.id) ? line.id : crypto.randomUUID();
      while (usedIds.has(id)) id = crypto.randomUUID();
      usedIds.add(id);
      return { ...line, id };
    }));
    setLastSearchedTin(null); setVerifiedReference(null);
    setAuthorizedTaxpayerIds({}); setAuthorizedTaxpayerId(null); setConfirmedOtherTaxTins({});
    setPaymentChannel(null); setMethodGroup(null); setPaymentMethod(null); setAcknowledged(false);
    setPaymentPhase('review'); setAttemptReceipt(null); setCreatedReceipt(null);
    setErrorMessage(''); setErrorField(null); setErrorHeadId(null);
    // Never restore one-time authorization from a stored snapshot.
    if (unifiedAccountSelection) { setOneTimeRecipient(null); setOneTimeTaxpayer(null);
      if (savedOneTime && typeof savedOneTime.tin === 'string' && typeof savedOneTime.name === 'string' && typeof savedOneTime.id === 'string') {
        setAdditionalTaxpayers(previous => previous.some(p=>p.tin===savedOneTime.tin) ? previous : [...previous,{tin:savedOneTime.tin!,name:savedOneTime.name!,id:savedOneTime.id!}]);
      }
    }
    if (unifiedAccountSelection) {
      const overrides=saved.taxpayerEntityOverrides;
      setTaxpayerEntityOverrides(overrides && typeof overrides==='object' && !Array.isArray(overrides) ? Object.fromEntries(Object.entries(overrides).filter(([key,value])=>/^\d{12,13}$/.test(key)&&(value==='COMPANY'||value==='NON_COMPANY'))) as Record<string,IncomeTaxEntityType> : {});
    }
    setStep(unifiedAccountSelection ? 1 : saved.step === 2 ? 2 : 1);
  };
  useEffect(() => {
    if (!initialDraft) return;
    try {
      if (initialDraft.service !== category) throw new Error('Saved payment service does not match.');
      restoreAccountDraft(initialDraft.form_payload);
      setSelectedAccountDraft(initialDraft);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Saved payment could not be restored.');
      setErrorField(null);
    }
    // A different draft remounts the form. Do not reset inputs on normal renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft?.id]);
  // A history copy is an independent editable form, not a saved draft or receipt.
  useEffect(() => {
    if (!initialReuse) return;
    const verifiedOwner = authenticatedUser?.id === initialReuse.ownerUid;
    const previewOwner = !authenticatedUser && previewAccount?.id === initialReuse.ownerUid &&
      activePreviewSession()?.profileId === initialReuse.ownerUid;
    if ((!verifiedOwner && !previewOwner) || initialReuse.service !== category) {
      setErrorMessage('Your account or payment category changed. Reopen your payment history.');
      return;
    }
    try { restoreAccountDraft(initialReuse.formPayload); }
    catch (cause) { setErrorMessage(cause instanceof Error ? cause.message : 'Unable to reuse the previous payment.'); }
    // A changed source remounts the payment form; do not reset on ordinary renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReuse?.sourcePaymentId, authenticatedUser?.id]);
  // A valid older SQL payment may know the amount but not the original head.
  // Suggest that exact amount only after the user selects a new eligible head;
  // all other validation, ownership and year checks stay in the payment wizard.
  useEffect(()=>{
    const original=initialReuse?.formPayload.legacySourceAmount;
    if(typeof original!=='string'||!/^\d+\.\d{2}$/.test(original))return;
    const eligible=V11_PAYMENT_OPTIONS.filter(head=>head.category===category &&
      head.status==='ACTIVE'&&!BLOCKED_HEAD_IDS.includes(head.id));
    const selected=selectedHeadIds.length===1?selectedHeadIds[0]:
      eligible.length===1?eligible[0].id:null;
    if(selected===null || !eligible.some(head=>head.id===selected))return;
    setAmountInputs(previous=>Object.prototype.hasOwnProperty.call(previous,selected)
      ?previous:{...previous,[selected]:original});
  },[initialReuse?.sourcePaymentId,selectedHeadIds,category]);

  // A confirmed receipt is the only signal allowed to retire a draft.
  useEffect(() => {
    if (!selectedAccountDraft || !createdReceipt || paymentPhase !== 'settled') return;
    const actor: PaymentDraftActor | null = authenticatedUser
      ? {kind:'authenticated',userId:authenticatedUser.id}
      : previewAccount ? {kind:'preview',profileId:previewAccount.id}
      : unsignedGuestDrafts ? {kind:'guest'} : null;
    if (!actor) return;
    let active = true;
    void deletePaymentFormDraft(actor,selectedAccountDraft).then(() => {
      if (active) setSelectedAccountDraft(null);
    }).catch(() => { /* keep the draft available for safe manual recovery */ });
    return () => { active = false; };
  }, [createdReceipt?.id, paymentPhase, selectedAccountDraft?.id, authenticatedUser?.id, previewAccount?.id]);

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
      if (!batch) {
        const combined = loadCombinedOtherTaxRequest(getStorySessionId());
        if (!combined) return;
        pendingStoryRef.current = combined.request;
        setAttemptReceipt(combined.request.receipt);
        setPaymentChannel(combined.phase === 'PENDING_BANK' ? 'OTC' : 'NOW');
        setPaymentMethod(combined.request.receipt.paymentMethod);
        setLifecycleStages(combined.phase === 'PENDING_BANK' ? BANK_LIFECYCLE : ONLINE_LIFECYCLE.slice(0,-1));
        setPaymentPhase(combined.phase === 'PENDING_BANK' ? 'pending-bank' : 'failed');
        setErrorMessage(language === 'bn'
          ? 'একটি সম্মিলিত পেমেন্ট নিশ্চিত হওয়া বাকি। আগের রেফারেন্স দিয়েই আবার চেষ্টা করুন।'
          : 'Combined payment confirmation is pending. Retry the original reference.');
        setStep(4);
        return;
      }
      rememberBatch(batch);
      setOfficeMirrorPending(batch.items.some(item => item.officeMirrorPending === true));
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
  useEffect(() => {
    if (embedded && step === 4) onResultViewChange?.(
      !showReceiptDetails ? 'result' : receiptDocument);
  }, [embedded, onResultViewChange, step, showReceiptDetails, receiptDocument]);

  // The action is in a persistent footer; direct attention to the invalid input,
  // even when the user has scrolled well past it.
  useEffect(() => {
    if (!errorField || !errorMessage) return;
    const id: Record<GuestErrorField, string> = {
      payerChoice: 'guest-payer-self', tin: invalidBatchTaxpayerId && invalidBatchTaxpayerId !== 'primary' ? `other-tax-tin-${invalidBatchTaxpayerId}` : 'guest-tin', payerName: 'guest-payer-name', payerTin: 'guest-payer-tin', phone: 'guest-phone', email: 'guest-receipt-email',
      noticeReference: 'guest-notice-ref', incomeTaxType: 'guest-income-type-NON_COMPANY',
      headId: 'guest-head-static', assessmentYear: 'guest-assessment-year', taxAmount: errorHeadId && selectedHeadIds.length > 0 && selectedHeadIds[0] !== errorHeadId ? `guest-tax-amount-${errorHeadId}` : 'guest-tax-amount'
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
    if (isWithholdingMode && category !== 'SOURCE_TAX_DEPOSIT') {
      setCategory('SOURCE_TAX_DEPOSIT');
      setSelectedHeadIds([]);
    }
  }, [isWithholdingMode, category]);

  useEffect(() => {
    const requestedCategory = initialCategory || routeParams?.initialCategory;
    if (!isWithholdingMode && !unifiedFlow && requestedCategory && CATEGORY_LABELS[requestedCategory]) {
      const next = requestedCategory as PaymentCategory;
      if (next !== category) {
        setCategory(next);
        setSelectedHeadIds([]);
        // Changing explicitly into exclusive Return must discard hidden
        // non-Return payer allocations rather than trapping the user in a
        // form where those prohibited lines cannot be edited or removed.
        if (next === 'TAX_WITH_RETURN') {
          setOtherTaxLines([]);
          setAdditionalTaxpayers([]);
          setOneTimeTaxpayer(null);
          setAmountInputs({});
        }
      }
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
  const exclusiveReturnIssue = category === 'TAX_WITH_RETURN' ? returnOnlyIssue({
    assessmentYear, additionalTaxpayers, oneTimeTaxpayer, otherTaxLines, selectedHeadIds,
    sourceAllocationIds,
  }) : null;
  const blockInvalidReturn = () => {
    if (!exclusiveReturnIssue) return false;
    const field: GuestErrorField = exclusiveReturnIssue === 'year' ? 'assessmentYear'
      : exclusiveReturnIssue === 'recipient' ? 'tin' : 'headId';
    setValidationError(exclusiveReturnIssue === 'year'
      ? (language === 'bn' ? 'রিটার্নসহ করের জন্য একটি বৈধ করবর্ষ নির্বাচন করুন।' : 'Select one valid assessment year for Tax with Return.')
      : exclusiveReturnIssue === 'recipient'
      ? (language === 'bn' ? 'রিটার্নসহ করে একজন করদাতাই রাখা যাবে।' : 'Tax with Return allows only one taxpayer.')
      : (language === 'bn' ? 'রিটার্নসহ করের সঙ্গে অন্য খাত যোগ করা যাবে না।' : 'Tax with Return cannot contain another payment head.'), field);
    return true;
  };
  const suggestionGroup: SuggestedAmountGroup | null =
    category === 'TAX_WITH_RETURN' ? 'Tax with Return' :
    category === 'ADVANCE_TAX' ? 'Advance Tax' :
    category === 'ASSESSED_DEMAND' ? 'Tax against Demand' :
    category === 'PENALTY' ? 'Penalty' :
    category === 'APPELLATE_TRIBUNAL' ? 'Appellate Tribunal' :
    category === 'OTHER_TAX_PAYMENT' ? 'Others' : null;
  const suggestedAmount = selectedHeads.length === 1 && !verifiedReference
    ? paymentAmountSuggestionFor(suggestionUserId, suggestionGroup, assessmentYear, selectedHead?.id) : null;
  const amountRowColumns = paymentAmountRowColumns(selectedHeads.length);
  // No state write is required: the stable suggestion becomes the editable initial value,
  // and a user override (including empty string) always takes precedence.
  const amountRawForHead = (headId: number) => verifiedReference ? String(verifiedReference.amount)
    : amountInputs[headId] ?? suggestedAmount?.amount ?? '';
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
  const otherTaxSummaryLineLabel = (line: OtherTaxAllocation, head = otherTaxAllocationHead(line.headId)): string => {
    const name = language === 'bn' ? head?.nameBn : head?.nameEn;
    if (!unifiedFlow) return `${head?.economicCode || ''} — ${name}`;
    const person = batchTaxpayers.find(taxpayer => taxpayer.id === line.taxpayerId);
    const entityType = person ? entityTypeForTin(person.tin) : null;
    if (entityType !== 'COMPANY') return name || '';
    const code = governmentAccountingCode(category, entityType);
    return `${name || ''}${code ? ` · ${language === 'bn' ? 'কোড' : 'Code'} ${code}` : ''}`;
  };
  // Display only valid entered amounts during editing; financial validation
  // still uses batchAmount/storyAmountMinor and rejects ANY unfinished allocation.
  // Preserve exact-cent arithmetic and never submit the partial display total.
  const v5EnteredAmountTotal = unifiedFlow && otherBatch
    ? sumGuestAmounts(otherTaxLines.map(line => line.amount)
        .filter(raw => parseGuestAmount(raw) !== null))
    : null;
  const v5IncompleteAmounts = unifiedFlow && otherBatch &&
    otherTaxLines.some(line => parseGuestAmount(line.amount) === null);
  const paymentCalculation = otherBatch ? <PaymentLiveSummary language={language} hideService={embedded}
    compactTaxpayerView={unifiedFlow} progressiveHeads={unifiedFlow}
    activeEntryId={step === 2 && !unifiedFlow && forSelf === false ? activeCalculationLineId : undefined}
    onSelectEntry={step === 2 ? lineId => {
      if (!unifiedFlow && forSelf === false) setActiveCalculationLineId(lineId);
      setSummaryJump(current => ({ lineId, requestId: current.requestId + 1 }));
    } : undefined}
    category={language === 'bn' ? 'অন্যান্য কর পরিশোধ' : 'Other Tax Payment'}
    categoryCode={category} tin={unifiedFlow || batchTaxpayers.length > 1 ? undefined : taxpayerTin}
    year={unifiedFlow ? undefined : otherTaxLines.length === 1 ? otherTaxLines[0].assessmentYear : undefined}
    amount={step === 1 ? (unifiedFlow ? 0 : null) : unifiedFlow ? v5EnteredAmountTotal : batchAmount}
    helpText={v5IncompleteAmounts && step > 1 ? (language === 'bn'
      ? 'শুধু পূরণ করা পরিমাণ যোগ করা হয়েছে। এগোনোর আগে সব নির্বাচিত খাতের পরিমাণ দিন।'
      : 'Total includes entered amounts only. Complete every selected head before continuing.') : undefined}
    groupedBreakdown={(unifiedFlow || (step > 1 && batchTaxpayers.length > 1)) ? batchTaxpayers.map((person, index) => {
      const lines = otherTaxLines.filter(line => line.taxpayerId === person.id);
      return {
        id: person.id,
        label: person.name.trim() || (language === 'bn' ? `করদাতা ${index + 1}` : `Taxpayer ${index + 1}`),
        tin: person.tin,
        countLabel: unifiedFlow
          ? (language === 'bn' ? `${lines.length}টি পেমেন্ট লাইন` : `${lines.length} payment ${lines.length === 1 ? 'line' : 'lines'}`)
          : undefined,
        amount: unifiedFlow
          ? sumGuestAmounts(lines.map(line => line.amount).filter(raw => parseGuestAmount(raw) !== null))
          : lines.length ? otherTaxAllocationTotal(lines) : null,
        entries: lines.map(line => {
          const head = otherTaxAllocationHead(line.headId);
          return {
            id: line.id,
            label: otherTaxSummaryLineLabel(line, head),
            detail: line.assessmentYear,
            value: otherTaxAllocationTotal([line]),
          };
        }),
      };
    }) : undefined}
    breakdown={unifiedFlow || batchTaxpayers.length > 1 ? undefined : otherTaxLines.map(line => {
      const head = otherTaxAllocationHead(line.headId);
      const person = batchTaxpayers.find(t => t.id === line.taxpayerId);
      return {
        id: line.id,
        label: otherTaxSummaryLineLabel(line, head),
        detail: `${person?.name ? person.name + ' · ' : ''}${person?.tin || ''} · ${line.assessmentYear}`,
        value: otherTaxAllocationTotal([line])
      };
    })} /> : <PaymentLiveSummary language={language} hideService={embedded} compactTaxpayerView={unifiedFlow}
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
  const inlinePaymentCalculation = embedded && mobilePaymentFooter && (!unifiedFlow || step === 2) ? null : paymentCalculation;
  const mobileSummaryTotal = otherBatch
    ? (step === 1 ? (unifiedFlow ? 0 : null) : unifiedFlow ? v5EnteredAmountTotal : batchAmount)
    : summedAmount;

  const taxpayerLookupResult = (
    <div className="tin-lookup__result" role="status" aria-live="polite" data-lookup-state={tinLookupState}>
      {tinLookupState === 'idle' ? <p>{language === 'bn' ? 'টিআইএন খুঁজে নাম দেখুন।' : 'Search TIN to fill taxpayer name.'}</p>
        : sampleTaxpayer ? <TaxpayerTinSearchResultCard key={taxpayerTin} language={language}
            tin={taxpayerTin} name={language === 'bn' ? sampleTaxpayer.nameBn : sampleTaxpayer.nameEn}
            testId="searched-taxpayer-card"
            classification={entityTypeForTin(taxpayerTin) === 'COMPANY'
              ? (language === 'bn' ? 'কোম্পানি' : 'Company')
              : entityTypeForTin(taxpayerTin) === 'NON_COMPANY'
                ? (language === 'bn' ? 'ব্যক্তি' : 'Individual') : undefined}
          />
        : <p>{language === 'bn' ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.'}</p>}
    </div>
  );

  const renderOtherTaxTaxpayerList = (singleSelf: boolean) => (
    <OtherTaxTaxpayerList language={language} primaryTin={taxpayerTin} primaryName={ownAccountTax ? accountName : otherTaxpayerName} lockedPrimary={ownAccountTax} singleTaxpayerLayout={singleSelf} allowAdditional={forSelf === false}
                requireConfirmation={otherBatch && !signedInAccount}
                confirmPrimary={!singleSelf}
                confirmedTins={confirmedOtherTaxTins} onConfirmTaxpayer={(id, tin) => {
                  setConfirmedOtherTaxTins(current => ({...current, [id]: tin})); clearValidationError();
                }}
                additional={forSelf === false ? additionalTaxpayers : []} allocations={otherTaxLines}
                invalidId={invalidBatchTaxpayerId} tinError={isFieldInvalid('tin') ? errorMessage : undefined}
                onPrimaryTin={value => { clearReferenceSelection(); setLastSearchedTin(null); setOtherTaxpayerName(''); setAuthorizedTaxpayerId(null); setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>additionalTaxpayers.some(person=>person.tin===knownTin)))); setTin(value); }}
                onPrimarySearch={searchTin} onPrimaryName={setOtherTaxpayerName} allowSyntheticDemoTin={allowSyntheticDemoTin} onAdditional={people => {
                  if (forSelf !== false) return;
                  setAdditionalTaxpayers(people);
                  setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>
                    knownTin===taxpayerTin||people.some(person=>person.tin===knownTin))));
                }}
                onAllocations={setOtherTaxLines} onClearError={clearValidationError} />
  );

  // Retained allocations follow their TIN when the primary recipient changes.
  // SELF remains exclusive; mixed recipient selections use the existing OTHER contract.
  const selectedAccountRecipients = batchTaxpayers.filter(person=>person.tin);
  const replaceAccountRecipients = (requested: OtherTaxTaxpayer[]) => {
    const unique=[...new Map(requested.filter(p=>p.tin).map(p=>[p.tin,p])).values()];
    const ownTin=signedInProfile?.tin;
    const self=unique.length===1&&unique[0].tin===ownTin;
    const ordered=[...unique].sort((a,b)=>Number(b.tin===ownTin)-Number(a.tin===ownTin));
    const next=ordered.map((p,index)=>({...p,id:index===0?'primary':p.id==='primary'?crypto.randomUUID():p.id}));
    const remap=(lines:OtherTaxAllocation[])=>lines.flatMap(line=>{
      const original=selectedAccountRecipients.find(p=>p.id===line.taxpayerId);
      const target=next.find(p=>p.tin===original?.tin);
      return target?[{...line,taxpayerId:target.id}]:[];
    });
    setForSelf(next.length?self:null);
    setTin(self?'':next[0]?.tin??'');
    setOtherTaxpayerName(next[0]?.name??'');
    setAdditionalTaxpayers(next.slice(1));
    setOneTimeTaxpayer(null);
    if(activeOneTimeRecipient&&!next.some(p=>p.tin===activeOneTimeRecipient.tin))setOneTimeRecipient(null);
    setOtherTaxLines(remap);setUnifiedOtherTaxParkedLines(remap);setConfirmedOtherTaxTins({});
    clearValidationError();
  };
  const canAddAccountRecipient=(value:string)=>{
    if(!signedInProfile||!paymentOwnerId||!availableSavedTins||value===signedInProfile.tin)return false;
    const exists=selectedAccountRecipients.some(p=>p.tin===value);
    if(availableSavedTins.includes(value))return !exists;
    if(activeOneTimeRecipient&&activeOneTimeRecipient.tin!==value)return false;
    if(exists&&activeOneTimeRecipient?.tin===value)return false;
    return !selectedAccountRecipients.some(p=>p.tin!==value&&p.tin!==signedInProfile.tin&&!availableSavedTins.includes(p.tin));
  };
  const addAccountRecipient=(value:string,name:string)=>{
    if(!canAddAccountRecipient(value))return;
    const match=lookupSampleTaxpayer(value);
    if(!match||match.tin!==value||!demoIncomeTaxTypeForTin(value))return;
    if(!availableSavedTins!.includes(value))setOneTimeRecipient({ownerId:paymentOwnerId!,tin:value,nameEn:match.nameEn,nameBn:match.nameBn});
    replaceAccountRecipients([...selectedAccountRecipients.filter(p=>p.tin!==value),{id:selectedAccountRecipients.find(p=>p.tin===value)?.id??crypto.randomUUID(),tin:value,name}]);
  };
  const validateIdentity = () => {
    if(unifiedAccountSelection&&!signedInProfile){setValidationError(language==='bn'?'সংযুক্ত করদাতার তথ্য পাওয়া যায়নি।':'Linked taxpayer profile is unavailable.','tin');return false;}
    if (forSelf === null) {
      setValidationError(language === 'bn' ? 'কার জন্য পরিশোধ করছেন নির্বাচন করুন।' : 'Choose who you are paying for.', 'payerChoice');
      return false;
    }
    if (selfLiabilityHasAdditionalRecipients) {
      setValidationError(language === 'bn'
        ? 'এই খসড়ায় অন্য করদাতা রয়েছেন। তাঁদের তথ্য রাখতে ফিরে গিয়ে অন্য করদাতার কর পরিশোধ নির্বাচন করুন।'
        : 'This saved payment includes other taxpayers. Go back and choose Facilitate another taxpayer’s payment to keep their allocations.', 'tin');
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
      if (unifiedFlow && batchTaxpayers.some(person => !entityTypeForTin(person.tin))) {
        setValidationError(language === 'bn' ? 'প্রত্যেক করদাতার আয়করের ধরন নির্বাচন করুন।' : 'Select an income tax type for each taxpayer.', 'incomeTaxType');
        return false;
      }
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
      if (!signedInAccount) {
        const unconfirmed = batchTaxpayers.find(person =>
          (forSelf === false || person.id !== 'primary') && confirmedOtherTaxTins[person.id] !== person.tin);
        if (unconfirmed) {
          setInvalidBatchTaxpayerId(unconfirmed.id);
          setValidationError(language === 'bn'
            ? 'টিআইএন খুঁজে করদাতার তথ্য দেখে করদাতা যোগ করুন।'
            : 'Search the TIN, review the taxpayer details, then select Add taxpayer.', 'tin');
          return false;
        }
      }
    }
    if (embedded && !signedInAccount && lookupSampleTaxpayer(taxpayerTin) && lastSearchedTin !== taxpayerTin) {
      setValidationError(language === 'bn' ? 'এগোনোর আগে টিআইএন খুঁজুন।' : 'Search this TIN before continuing.', 'tin');
      return false;
    }
    if (!unifiedFlow) {
    if (!/^01\d{9}$/.test(receiptPhone)) {
      setValidationError(language === 'bn' ? 'রসিদের জন্য ১১ সংখ্যার মোবাইল নম্বর দিন।' :
        'Enter an 11-digit Bangladeshi mobile number for the receipt.', 'phone');
      return false;
    }
    if (otherBatch && forSelf === false && !signedInAccount && walkInPayerTin && !confirmedWalkInPayer) {
      setValidationError(language === 'bn'
        ? 'পরিশোধকারীর ১২ সংখ্যার টিআইএন খুঁজে মিল পাওয়ার পর নিশ্চিত করুন, অথবা খালি রাখুন।'
        : 'Search and confirm the payer’s matching 12-digit TIN, or leave it blank.', 'payerTin');
      return false;
    }
    if (!forSelf && !signedInAccount && effectivePayerName.trim().length < 2) {
      setValidationError(copy.requiredPayer, 'payerName');
      return false;
    }
    if (!isOptionalReceiptEmailValid(receiptEmail)) {
      setValidationError(language === 'bn' ? 'সঠিক ইমেইল ঠিকানা দিন অথবা খালি রাখুন।' : 'Enter a valid email address or leave it blank.', 'email');
      return false;
    }
    // Preserve the existing optional sample-reference behavior for the older
    // 12-digit v11 fixture tests. New 13-digit simulated payer profiles do not
    // require a reference lookup or an authenticated account.
    const reference = noticeReference.trim();
    const shouldMatchSample = !!reference && /^\d{12}$/.test(taxpayerTin) && !isWithholdingMode && !ownAccountTax && !signedInBeneficiarySelection;
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
    }
    clearValidationError();
    return true;
  };

  // Saved contacts permit the payer to choose a TIN, not to read that taxpayer's
  // private records. Re-read only the current account's lists before advancing
  // or persisting a simulated payment; never rely on a route prefill or stale UI state.
  const areCurrentSavedBeneficiaries = async (
    tins: string[], confirmedOneTime: OtherTaxTaxpayer | null = null
  ): Promise<boolean> => {
    if (!tins.length || tins.some(tin => !tin)) return false;
    // Payment validation bypasses the short navigation cache and fails closed on stale ownership.
    const saved = await loadBeneficiaries(authenticatedUser?.id ?? null,{forceFresh:true});
    const ownedListIds = new Set(saved.lists.map(list => list.id));
    const allowed = new Set(saved.people.filter(person => ownedListIds.has(person.list_id)).map(person => person.tin));
    // F-039 permits a confirmed one-time recipient without ever saving their
    // TIN or granting access to their private records. Verify the existing
    // public lookup identity again, and still recheck all saved recipients.
    if (confirmedOneTime) {
      const match = lookupSampleTaxpayer(confirmedOneTime.tin);
      if (!signedInBeneficiarySelection ||
        !match || match.tin !== confirmedOneTime.tin ||
        match.nameEn !== confirmedOneTime.name ||
        !tins.includes(confirmedOneTime.tin) ||
        allowed.has(confirmedOneTime.tin) ||
        confirmedOneTime.tin === signedInProfile?.tin) return false;
    }
    return tins.every(tin => tin === confirmedOneTime?.tin ||
      tin === signedInProfile?.tin || allowed.has(tin));
  };

  const handleStep1Next = async () => {
    if (signedInBeneficiarySelection && !savedRecipientSelectionValid) {
      setValidationError(language === 'bn'
        ? 'সংরক্ষিত উপকারভোগী নির্বাচন করুন অথবা নতুন টিআইএন খুঁজে নিশ্চিত করুন।'
        : 'Select a saved beneficiary or search and confirm a one-time TIN.', 'tin');
      return;
    }
    if (beneficiaryChecking || !validateIdentity()) return;
    if (signedInBeneficiarySelection || (ownAccountTax && additionalTaxpayers.length > 0)) {
      setBeneficiaryChecking(true);
      try {
        const tins = (otherBatch ? batchTaxpayers : batchTaxpayers.slice(0, 1)).map(person => person.tin);
        if (!(await areCurrentSavedBeneficiaries(tins,currentOneTimeRecipient))) {
          setBeneficiaryRefreshKey(key => key + 1);
          setValidationError(language === 'bn'
            ? 'নির্বাচিত উপকারভোগী আপনার সংরক্ষিত তালিকায় নেই। তালিকাটি আবার লোড করে নির্বাচন করুন।'
            : 'A selected beneficiary is no longer in your saved lists. Reload the list and select again.', 'tin');
          return;
        }
        // Saving a beneficiary does not authorize access to that person's private
        // scenario data, so do not populate consent-based suggestion identities.
        setAuthorizedTaxpayerIds({});
        setAuthorizedTaxpayerId(null);
      } catch {
        setValidationError(language === 'bn'
          ? 'সংরক্ষিত উপকারভোগীর তালিকা যাচাই করা যায়নি। আবার চেষ্টা করুন।'
          : 'Saved beneficiaries could not be verified. Try again.', 'tin');
        return;
      } finally {
        setBeneficiaryChecking(false);
      }
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    if (blockInvalidReturn()) return;
    if (otherBatch) {
      const invalid = otherTaxLines.find(line =>
        !(isOtherTaxHeadEligible(line.headId) || (unifiedFlow && line.headId === RETURN_HEAD_ID)) || !OTHER_TAX_YEARS.some(year => year === line.assessmentYear) ||
        !batchTaxpayers.some(taxpayer => taxpayer.id === line.taxpayerId) ||
        otherTaxAllocationTotal([line]) === null);
      if (!batchValid || invalid) {
        const message = otherTaxLines.length > MAX_COMBINED_ALLOCATIONS
            ? language === 'bn' ? 'একটি পেমেন্টে সর্বোচ্চ ' + MAX_COMBINED_ALLOCATIONS + 'টি বণ্টন রাখা যাবে।' : 'This payment supports up to ' + MAX_COMBINED_ALLOCATIONS + ' allocation lines.'
            : otherTaxLines.length === 0
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
      // Invalid resumed Pay Again drafts must show a field error, not a disabled
      // Continue button. Positive over-limit values can be reviewed but never paid.
      if (!storyAmountSupported && !(storyAmountMinor !== null && storyAmountMinor > MAX_STORY_AMOUNT_MINOR)) {
        setValidationError(language === 'bn'
          ? 'প্রতিটি খাতের পরিমাণ ও মোট পরিমাণের সীমা যাচাই করুন।'
          : 'Review each amount and the supported total before continuing.', 'taxAmount');
        return;
      }
      clearValidationError();
      setStep(3);
      return;
    }
    if (initialReuse && !OTHER_TAX_YEARS.some(year => year === assessmentYear)) {
      setValidationError(language === 'bn' ? 'আবার পেমেন্টের আগে করবর্ষ নির্বাচন করুন।' : 'Select an assessment year before paying again.', 'headId');
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
      if (signedInAccount && pending.payload.details.payerMode === 'OTHER') {
        const combined = pending.payload.details.combinedPayment === true;
        const allocations = pending.payload.details.allocations;
        const tins = combined
          ? Array.isArray(allocations) ? allocations.map(item =>
              item && typeof item === 'object' && !Array.isArray(item)
                ? (item as Record<string,unknown>).taxpayerTin : null) : []
          : [pending.payload.details.taxpayerTin];
        if (!tins.length || tins.some(tin => typeof tin !== 'string' || !/^\d{12,13}$/.test(tin)) ||
          !(await areCurrentSavedBeneficiaries(tins as string[], currentOneTimeRecipient)))
          throw new Error('Selected beneficiary no longer belongs to the signed-in account.');
      }
      const confirmed = await persistSimulatedPayment(pending.payload);
      const settledReceipt: ChallanReceipt = {
        ...(pending.payload.details.combinedPayment === true ? pending.receipt : receipt),
        paymentTransactionId: confirmed.id,
        allocationContractVersion: pending.payload.details.allocationContractVersion===5?5:undefined,
        treasuryStatus: 'GATEWAY_SUCCESS',
        treasuryScrollNo: undefined,
        treasuryDate: undefined,
        completedAt: new Date().toISOString()
      };
      setLifecycleStages(previous => previous.includes('CREDITED') ? previous : [...previous, 'CREDITED']);
      if (createdReceipt?.paymentTransactionId !== confirmed.id) addPaymentReceipt(settledReceipt);
      setAttemptReceipt(settledReceipt);
      setCreatedReceipt(settledReceipt);
      setOfficeMirrorPending(!confirmed.mirrored);
      if (confirmed.mirrored) setPaymentStorageWarning(false);
      pendingConfirmationRetryable.current = false;
      setPaymentValidationBlocked(false);
      setErrorMessage(confirmed.mirrored ? '' : language === 'bn'
        ? 'অফিস সমন্বয় এখনো অপেক্ষমাণ। একই অনুরোধ দিয়ে আবার চেষ্টা করুন।'
        : 'Office synchronization is still pending. Retry the same request.');
      setPaymentPhase('settled');
      // Keep the original idempotency key while Office's durable retry queue
      // is pending, so a manual retry never creates a second simulation.
      pendingStoryRef.current = confirmed.mirrored ? null : pending;
      if (confirmed.mirrored && pending.payload.details.combinedPayment === true) {
        try { clearCombinedOtherTaxRequest(getStorySessionId()); } catch { /* confirmed SQL record remains authoritative */ }
      }
    } catch (error) {
      const message=error instanceof Error?error.message:'';
      // A permanent SQL payer-validation rejection belongs at the editable
      // Final Preview field. Do not display a misleading bank failure or
      // automatically replay the same invalid combined payment request.
      if (unifiedFlow && /^(INVALID_WALKIN_PAYER_TIN|UNMATCHED_WALKIN_PAYER_TIN|UNCONFIRMED_WALKIN_PAYER)$/.test(message)) {
        pendingConfirmationRetryable.current=false;
        pendingStoryRef.current=null;
        try { clearCombinedOtherTaxRequest(getStorySessionId()); } catch { /* No valid SQL row was created. */ }
        setPaymentValidationBlocked(true);
        setPaymentPhase('review');
        setLifecycleStages([]);
        setAttemptReceipt(null);
        setUnifiedCheckout(false);
        onCheckoutChange?.(false);
        setStep(3);
        setValidationError(
          message === 'INVALID_WALKIN_PAYER_TIN'
            ? (language === 'bn'
                ? 'পরিশোধকারীর টিআইএন ১২ বা ১৩ সংখ্যার হতে হবে। সংশোধন করুন অথবা ঐচ্ছিক ঘরটি খালি রাখুন।'
                : 'Payer TIN must contain 12 or 13 digits. Correct it or leave this optional field blank.')
            : message === 'UNMATCHED_WALKIN_PAYER_TIN'
              ? (language === 'bn'
                  ? 'পরিশোধকারীর টিআইএন নমুনা তালিকায় পাওয়া যায়নি। তথ্য আবার খুঁজুন অথবা ঘরটি খালি রাখুন।'
                  : 'Payer TIN was not found in the sample list. Search again or leave this optional field blank.')
              : (language === 'bn'
                  ? 'পরিশোধকারীর নাম ও টিআইএন মিলছে না। আবার খুঁজে তথ্য নিশ্চিত করুন।'
                  : 'Payer name and TIN do not match. Search and confirm the payer again.'),
          'payerTin'
        );
        return;
      }
      const validationBlocked=/^(Choose a saved demo beneficiary|Choose a demo beneficiary|INVALID_BENEFICIARY|AUTHORIZATION_REQUIRED|PROFILE_CAPABILITY_REQUIRED|SUBMISSION_FAILED|Simulation payment details are incomplete)/.test(message);
      // Do not automatically retry a permanent SQL validation rejection.
      pendingConfirmationRetryable.current = !validationBlocked &&
        (message === 'SIMULATION_READBACK_PENDING' ||
         message === 'SIMULATION_SUBMISSION_PENDING' ||
         error instanceof TypeError);
      // Invalid beneficiary/consent is a form correction, not a bank decline
      // and not a retry of an already-saved payment.
      setPaymentValidationBlocked(validationBlocked);
      if(validationBlocked)pendingStoryRef.current=null;
      setErrorMessage(validationBlocked
        ? (language === 'bn'
            ? 'সিমুলেশন সংরক্ষণ করা যায়নি। করদাতার তথ্য ও পেমেন্টের বিবরণ যাচাই করে আবার চেষ্টা করুন।'
            : 'The simulation could not be saved. Review the taxpayer and payment details before retrying.')
        : (language === 'bn'
            ? 'সিমুলেশন সংরক্ষণের নিশ্চয়তা পাওয়া যায়নি। একই অনুরোধ আবার চেষ্টা করুন।'
            : 'Simulation confirmation is unavailable. Retry the same request.'));
      setPaymentPhase('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmOtherTaxBatch = async () => {
    const batch = batchAttemptRef.current;
    const retryingOfficeQueue = batch?.phase === 'COMPLETE' &&
      batch.items.some(item => item.officeMirrorPending === true);
    if (!batch || (batch.phase !== 'READY' && !retryingOfficeQueue)) {
      setPaymentPhase('failed'); setIsProcessing(false); return;
    }
    try {
      if (!retryingOfficeQueue && signedInAccount && batch.items[0].payload.details.payerMode === 'OTHER') {
        const tins = batch.items.map(item => item.payload.details.taxpayerTin);
        if (tins.some(tin => typeof tin !== 'string') ||
            !(await areCurrentSavedBeneficiaries(tins as string[],currentOneTimeRecipient)))
          throw new Error('A selected beneficiary no longer belongs to the signed-in account.');
      }
      const completedBatch=await syncOtherTaxBatch(batch, persistSimulatedPayment, progress => {
        rememberBatch(progress);
        const receipts = confirmedBatchReceipts(progress);
        receipts.forEach(addPaymentReceipt);
        if (receipts[0]) setCreatedReceipt(receipts[0]);
      });
      const officeMirrorPending = completedBatch.items.some(item => item.officeMirrorPending === true);
      setLifecycleStages(previous => previous.includes('CREDITED') ? previous : [...previous, 'CREDITED']);
      setOfficeMirrorPending(officeMirrorPending);
      setPaymentValidationBlocked(false);
      setPaymentPhase('settled');
      setErrorMessage(officeMirrorPending
        ? (language === 'bn'
          ? 'অফিস সমন্বয় এখনো অপেক্ষমাণ। একই অনুরোধ দিয়ে আবার চেষ্টা করুন।'
          : 'Office synchronization is still pending. Retry the same request.')
        : '');
    } catch(error) {
      const message=error instanceof Error?error.message:'';
      const validationBlocked=/^(Choose a saved demo beneficiary|A selected beneficiary|INVALID_BENEFICIARY|AUTHORIZATION_REQUIRED)/.test(message);
      setPaymentValidationBlocked(validationBlocked);
      setErrorMessage(validationBlocked
        ? (language === 'bn'
          ? 'নির্বাচিত করদাতা সংরক্ষিত তালিকায় নেই। তালিকাটি আবার লোড করে নির্বাচন করুন।'
          : 'Selected taxpayer is not in your saved list. Reload the list and select again.')
        : (language === 'bn'
          ? 'কিছু পেমেন্ট রেকর্ড অপেক্ষমাণ। একই অনুরোধ আবার চেষ্টা করুন।'
          : 'Some payment records are pending. Retry the same request.'));
      setPaymentPhase(retryingOfficeQueue ? 'settled' : 'failed');
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

  const validateFinalPayerDetails = (): boolean => {
    if (!/^01\d{9}$/.test(receiptPhone)) {
      setValidationError(language === 'bn'
        ? 'রসিদের জন্য ১১ সংখ্যার মোবাইল নম্বর দিন।'
        : 'Enter an 11-digit Bangladeshi mobile number for the receipt.', 'phone');
      return false;
    }
    if (forSelf === false && !signedInAccount && effectivePayerName.trim().length < 2) {
      setValidationError(copy.requiredPayer, 'payerName');
      return false;
    }
    if (!isOptionalReceiptEmailValid(receiptEmail)) {
      setValidationError(language === 'bn' ? 'সঠিক ইমেইল ঠিকানা দিন অথবা খালি রাখুন।'
        : 'Enter a valid email address or leave it blank.', 'email');
      return false;
    }
    if (otherBatch && forSelf === false && !signedInAccount && walkInPayerTin &&
        (!(unifiedFlow ? /^\d{12,13}$/ : /^\d{12}$/).test(walkInPayerTin) || !confirmedWalkInPayer)) {
      setValidationError(language === 'bn'
        ? 'পরিশোধকারীর টিআইএন খুঁজে নিশ্চিত করুন, অথবা খালি রাখুন।'
        : 'Search and confirm the payer TIN, or leave it blank.', 'payerTin');
      return false;
    }
    const ref = noticeReference.trim();
    if (ref && /^\d{12}$/.test(taxpayerTin) && !isWithholdingMode && !ownAccountTax && !signedInBeneficiarySelection) {
      const matched = findV11GuestNotice(taxpayerTin, ref);
      if (!matched || matched.category !== category) {
        setValidationError(language === 'bn'
          ? 'টিআইএন ও পেমেন্ট রেফারেন্স মিলিয়ে দেখুন।'
          : 'Check the taxpayer TIN and payment reference.', 'noticeReference');
        return false;
      }
    }
    clearValidationError();
    return true;
  };

  const handleExecutePayment = () => {
    if (selfLiabilityHasAdditionalRecipients) {
      setValidationError(language === 'bn'
        ? 'নিজের করদায়ের পেমেন্টে অন্য করদাতা যোগ করা যাবে না।'
        : 'My Tax Liability cannot include another taxpayer.', 'tin');
      setStep(1);
      return;
    }
    if (unifiedFlow && !validateFinalPayerDetails()) { setUnifiedCheckout(false); onCheckoutChange?.(false); return; }
    if (blockInvalidReturn()) { setUnifiedCheckout(false); onCheckoutChange?.(false); setStep(exclusiveReturnIssue === 'year' ? 2 : 1); return; }
    if (batchRecoveryError || isProcessing || !acknowledged || !paymentChannel || !paymentMethod ||
      !(otherBatch ? batchValid : amountsValid) || (initialReuse && !otherBatch && !OTHER_TAX_YEARS.some(year => year === assessmentYear)) ||
      !storyAmountSupported || storyAmountMinor === null) return;
    pendingMirrorRetryCount.current = 0;
    pendingConfirmationRetryable.current = false;
    setIsProcessing(true);
    setPaymentPhase('processing');
    setLifecycleStages([]);
    setShowReceiptDetails(false);
    setPaymentStorageWarning(false);
    clearValidationError();

    try {
      // One explicitly synthetic reference is stable across retries of this attempt.
      const attemptId = crypto.randomUUID();
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const lineItems: PaymentLineItem[] = otherBatch ? otherTaxLines.map(line => {
        const head = line.headId === RETURN_HEAD_ID && unifiedFlow
          ? V11_PAYMENT_OPTIONS.find(option => option.id === RETURN_HEAD_ID)
          : otherTaxAllocationHead(line.headId);
        if (!head) throw new Error('INVALID_COMBINED_HEAD');
        const amount = otherTaxAllocationTotal([line]) || 0;
        const taxpayer = batchTaxpayers.find(person => person.id === line.taxpayerId)!;
        return {
          headId: head.id, economicCode: head.economicCode, headNameEn: head.nameEn,
          serviceCode: head.category, isWithholding: head.isWithholding,
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

      const recipientName = ownAccountTax ? accountName
        : sampleTaxpayer ? (language === 'bn' ? sampleTaxpayer.nameBn : sampleTaxpayer.nameEn)
        : forSelf ? '' : otherTaxpayerName.trim();
      const paymentParty = resolvePaymentPartyIdentity({
        isSelf: forSelf === true,
        recipientTin: taxpayerTin,
        recipientName,
        accountName: ownAccountTax ? accountName : undefined,
        payerName: effectivePayerName,
        payerTin: otherBatch && forSelf === false && !signedInAccount && confirmedWalkInPayer
          ? confirmedWalkInPayer.tin : signedInProfile?.tin,
        combinedPayment: otherBatch,
      });
      const newReceipt: ChallanReceipt = {
        id: `rcpt-${Date.now()}`,
        taxEventId: `SIM-EVENT-${attemptId}`,
        paymentTransactionId: `SIM-PAYMENT-${attemptId}`,
        challanNo: `SIM-${attemptId}`,
        tokenNumber: `SIM-TOKEN-${attemptId}`,
        paymentCategory: category,
        assessmentYear: otherBatch && otherTaxLines.length !== 1 ? 'Multiple years' : otherBatch ? otherTaxLines[0].assessmentYear : assessmentYear,
        payerName: paymentParty.payerName,
        payerTin: paymentParty.payerTin,
        taxpayerTin,
        taxpayerName: paymentParty.taxpayerName,
        receiptMobile: receiptPhone,
        receiptEmail: normaliseReceiptEmail(receiptEmail),
        noticeReference: noticeReference.trim() || undefined,
        paymentRemarks: paymentRemarks || undefined,
        isRepresentativePayment: forSelf !== true,
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
            ...(sourcePaymentId ? { sourcePaymentId } : {}),
            ...(sourcePaymentId && sourceAllocationIds.length ? { sourceAllocationIds } : {}),
            taxpayerTin,
            payerName: newReceipt.payerName,
            payerTin: newReceipt.payerTin,
            payerMode: forSelf === true ? 'SELF' : 'OTHER',
            assessmentYear,
            ...(newReceipt.taxpayerName ? { taxpayerName: newReceipt.taxpayerName } : {}),
            taxZone, taxCircle,
            receiptMobile: receiptPhone,
            receiptEmail: normaliseReceiptEmail(receiptEmail),
            noticeReference,
            ...(newReceipt.paymentRemarks ? { paymentRemarks: newReceipt.paymentRemarks } : {}),
            ...(newReceipt.paymentRemarks ? { challanRemarks: newReceipt.paymentRemarks } : {}),
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
      if (otherBatch && !(paymentChannel === 'NOW' && simulateDecline)) {
        // One combined payment and receipt across all taxpayers, heads and years.
        // Do not create one SQL transaction per allocation.
        const request = prepareCombinedOtherTaxPayment(
          pendingStoryRef.current.payload, newReceipt,
          otherTaxLines.map((line,index) => {
            const person=batchTaxpayers.find(candidate=>candidate.id===line.taxpayerId)!;
            return {sourceId:line.id,taxpayerTin:person.tin,taxpayerName:person.name,
              assessmentYear:line.assessmentYear,amountMinor:Number(parseGuestMinorUnits(line.amount)),
              line:lineItems[index]};
          }),
          { unifiedV5: unifiedFlow },
        );
        // Storage quota/private-browsing failures must not prevent the same
        // idempotent SQL request from being submitted in the current tab.
        const durable=saveCombinedOtherTaxRequest(request,paymentChannel==='OTC'?'PENDING_BANK':'READY');
        setPaymentStorageWarning(!durable);
        pendingStoryRef.current=request;
        rememberBatch(null);
        setAttemptReceipt(request.receipt);
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
      const detail=error instanceof Error ? error.message : '';
      setErrorMessage(detail === 'PAYMENT_DETAILS_TOO_LONG'
        ? (language === 'bn' ? 'পেমেন্টের তথ্য অনেক দীর্ঘ। নাম বা রেফারেন্স ছোট করে আবার চেষ্টা করুন।' : 'Payment details are too long. Shorten the name or reference and try again.')
        : /^(INVALID_COMBINED|DUPLICATE_COMBINED|COMBINED_TOTAL_MISMATCH|INVALID_BENEFICIARY)/.test(detail)
          ? (language === 'bn' ? 'উপকারভোগী, কর খাত, করবর্ষ ও পরিমাণ যাচাই করে আবার চেষ্টা করুন।' : 'Check each beneficiary, payment head, assessment year and amount before retrying.')
          : (language === 'bn' ? 'পেমেন্টের অনুরোধ শুরু করা যায়নি। বিস্তারিত যাচাই করে আবার চেষ্টা করুন।' : 'The payment request could not start. Review the details and retry.'));
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
    if (pendingStoryRef.current?.payload.details.combinedPayment === true) {
      try { setPaymentStorageWarning(!saveCombinedOtherTaxRequest(pendingStoryRef.current,'READY')); }
      catch {
        setErrorMessage(language === 'bn' ? 'মূল পেমেন্ট অনুরোধ সংরক্ষণ করা যায়নি।' : 'Original payment request could not be saved.');
        return;
      }
    }
    setIsProcessing(true);
    setPaymentPhase('processing');
    runLifecycle(BANK_SETTLEMENT, attemptReceipt);
  };

  const openUnifiedCheckout = () => {
    if (!unifiedFlow || batchRecoveryError || isProcessing || !storyAmountSupported ||
      (otherBatch && !batchValid) ||
      (Boolean(initialReuse && !otherBatch) && !OTHER_TAX_YEARS.some(year => year === assessmentYear))) return;
    if (!validateFinalPayerDetails() || blockInvalidReturn()) return;
    clearValidationError();
    setUnifiedCheckout(true);
    onCheckoutChange?.(true);
  };
  const backToUnifiedPreview = () => {
    setUnifiedCheckout(false);
    onCheckoutChange?.(false);
  };
  useEffect(() => {
    // The read-only result documents also use header Back in legacy embedded payment.
    // Earlier non-unified input-step navigation remains unchanged.
    if (!registerHeaderBack || (!unifiedFlow && step !== 4)) return;
    const back = () => {
      if (step === 4) {
        if (!showReceiptDetails) return;
        if (receiptDocument === 'certificate') setReceiptDocument('receipt');
        else setShowReceiptDetails(false);
        return;
      }
      if (isProcessing) return;
      if (step === 1) { onBackToService?.(); return; }
      if (step === 2) { clearValidationError(); setStep(1); return; }
      if (unifiedCheckout) backToUnifiedPreview();
      else setStep(2);
    };
    registerHeaderBack(back);
    return () => registerHeaderBack(null);
  }, [unifiedFlow, registerHeaderBack, step, unifiedCheckout, isProcessing,
      showReceiptDetails, receiptDocument, onBackToService, onCheckoutChange, clearValidationError]);

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
    pendingMirrorRetryCount.current = 0;
    pendingConfirmationRetryable.current = false;
    lifecycleTimers.current.forEach(clearTimeout);
    lifecycleTimers.current = [];
    setPaymentPhase('review');
    setOfficeMirrorPending(false);
    setPaymentValidationBlocked(false);
    setLifecycleStages([]);
    setAttemptReceipt(null);
    setAcknowledged(false);
    setSimulateDecline(false);
    setPaymentChannel(null);
    setPaymentMethod(null);
    setMethodGroup(null);
    setShowReceiptDetails(false);
    backToUnifiedPreview();
    setStep(3);
  };

  // Reuse the exact original idempotency key for up to three bounded attempts.
  // Never silently claim success without TaxPay SQL readback/Office acknowledgement.
  useEffect(() => {
    if (step !== 4 || isProcessing || simulateDecline || paymentValidationBlocked || batchAttempt ||
        !pendingStoryRef.current ||
        !((paymentPhase === 'settled' && officeMirrorPending) ||
          (paymentPhase === 'failed' && pendingConfirmationRetryable.current)) ||
        pendingMirrorRetryCount.current >= 3) return;
    const attempt = ++pendingMirrorRetryCount.current;
    const timer = setTimeout(() => {
      const pending = pendingStoryRef.current;
      if (!pending) return;
      setIsProcessing(true);
      void confirmSimulatedPayment(pending.receipt);
    }, attempt === 1 ? 2500 : attempt === 2 ? 5000 : 10000);
    return () => clearTimeout(timer);
  }, [step, paymentPhase, isProcessing, officeMirrorPending, simulateDecline, paymentValidationBlocked, batchAttempt]);

  const startAnotherBatch = () => {
    // Keep a confirmed source record available until its Office mirror is acknowledged.
    if (officeMirrorPending) return;
    try { clearOtherTaxBatch(); clearCombinedOtherTaxRequest(getStorySessionId()); } catch {
      setErrorMessage(language === 'bn' ? 'অনুরোধ সংরক্ষণ পরিষ্কার করা যায়নি।' : 'The saved request could not be cleared.');
      return;
    }
    rememberBatch(null);
    setPaymentStorageWarning(false);
    setCreatedReceipt(null); setAttemptReceipt(null); setPaymentPhase('review'); setLifecycleStages([]);
    setAcknowledged(false); setPaymentChannel(null); setPaymentMethod(null); setMethodGroup(null);
    setOtherTaxLines([]); setAdditionalTaxpayers([]); setConfirmedOtherTaxTins({}); setAuthorizedTaxpayerIds({});
    // A new checkout is not a repeat payment: discard immutable source provenance.
    setSourcePaymentId(null); setSourceAllocationIds([]);
    setAuthorizedTaxpayerId(null); setTin(''); setOtherTaxpayerName('');
    setShowReceiptDetails(false); setSkipPostPaymentLogin(false); setErrorMessage(''); backToUnifiedPreview(); setStep(1);
  };

  if (step === 4) {
    const completed = paymentPhase === 'settled';
    const bankPending = paymentPhase === 'pending-bank';
    const declined = paymentPhase === 'failed';
    // An unacknowledged Office mirror is retryable, not a gateway decline.
    // The original request remains pending with its idempotency key unchanged.
    const syncPending = declined && !!pendingStoryRef.current && !simulateDecline && !batchAttempt && !paymentValidationBlocked;
    const batchOfficeRetry = batchAttemptRef.current?.phase === 'COMPLETE' &&
      batchAttemptRef.current.items.some(item => item.officeMirrorPending === true);
    const canRetryOfficeSync = !!pendingStoryRef.current || batchOfficeRetry;
    const referenceReady = lifecycleStages.includes('ACS_REFERENCE_CREATED');
    const confirmedReceipts = batchAttempt ? confirmedBatchReceipts(batchAttempt) : [];
    const shownTotal = batchAttempt ? batchAttempt.amountMinor / 100 : attemptReceipt?.totalAmount ?? totalAmount;
    const currentOwner=authenticatedUser?.id ??
      (previewAccount&&activePreviewSession()?.profileId===previewAccount.id?previewAccount.id:null);
    let repeatCopy:PaymentReuse|null=null;
    // The successful SQL acknowledgement precedes this receipt. Never offer a
    // repeated payment from a pending bank slip or an unverified guest fixture.
    if(completed&&currentOwner&&createdReceipt?.paymentTransactionId){
      const originals=batchAttempt?confirmedReceipts:[createdReceipt];
      try{
        repeatCopy=reuseRecordedPayment(originals,currentOwner,signedInProfile?.tin??null,
          createdReceipt.batchId??createdReceipt.paymentTransactionId);
      }catch{/* Incomplete or mixed original stays read-only. */}
    }
    if (showReceiptDetails && createdReceipt) return (
      <div lang={language} className={`payment-receipt-details ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''}`}>
        <ReceiptView receipt={selectedWalkInReceipt ?? createdReceipt} embedded={embedded}
          onBack={() => { setReceiptDocument('receipt'); setShowReceiptDetails(false); }}
          compactWalkInLayout={embedded} activeDocument={receiptDocument}
          onDocumentChange={setReceiptDocument}
          postReceiptInvitation={!unifiedFlow && embedded && completed && !officeMirrorPending && !signedInAccount && !skipPostPaymentLogin
            ? <aside className="walkin-postpayment-login no-print" data-testid="walkin-postpayment-login" aria-label={language === 'bn' ? 'ঐচ্ছিক সাইন ইন' : 'Optional sign in'}>
                <div className="walkin-postpayment-login__copy">
                  <strong>{language === 'bn' ? 'আপনার পেমেন্ট রেকর্ড পরে দেখতে চান?' : 'Want easier access to your payment history?'}</strong>
                  <p>{language === 'bn'
                    ? 'সাইন ইন করে পেমেন্টের ইতিহাস, সংরক্ষিত চালান, উপলব্ধ রসিদ ও আগের রেকর্ড দেখতে পারবেন। এই ওয়াক-ইন রসিদ স্বয়ংক্রিয়ভাবে কোনো অ্যাকাউন্টে যুক্ত হবে না।'
                    : 'Sign in to access payment history, saved challans, available receipts and previous records. This walk-in receipt is not automatically linked to an account.'}</p>
                </div>
                <div className="walkin-postpayment-login__actions">
                  <button type="button" className="walkin-postpayment-login__signin"
                    onClick={() => { setPaymentServiceChoiceOpen(false); navigate('taxpayer_login'); }}>
                    {language === 'bn' ? 'সাইন ইন' : 'Sign in'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="walkin-postpayment-login__skip"
                    onClick={() => setSkipPostPaymentLogin(true)}>
                    {language === 'bn' ? 'সাইন ইন ছাড়াই চালিয়ে যান' : 'Continue without signing in'}
                  </button>
                </div>
              </aside> : undefined}
          transactionActions={Boolean(completed&&currentOwner&&createdReceipt.paymentTransactionId)}
          onPayAgain={repeatCopy?()=>{setShowReceiptDetails(false);
            startPaymentReuse(repeatCopy!);}:undefined}
          onApplyForCorrection={completed&&currentOwner?()=>{
            setShowReceiptDetails(false);
            navigate('corrections',{originalReference:createdReceipt.challanNo,
              applyForCorrection:Boolean(previewAccount)});
          }:undefined}/>
      </div>
    );
    return (
      <div lang={language} className={`space-y-5 ${embedded ? 'payment-flow-embedded payment-flow-embedded--receipt' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
        <PaymentConfirmationLayout>
          <PaymentConfirmationHeading state={syncPending || bankPending ? 'pending' : declined ? 'failed' : completed ? 'complete' : 'running'} icon={isProcessing ? <LoaderCircle className="animate-spin" size={22} /> : declined ? <AlertCircle size={22} /> : bankPending ? <Building2 size={22} /> : <CheckCircle size={22} />}>
            {declined && batchAttempt ? (language === 'bn' ? 'পেমেন্ট রেকর্ড অপেক্ষমাণ' : 'Payment records pending') : syncPending ? (language === 'bn' ? 'সিমুলেশন নিশ্চিতকরণ অপেক্ষমাণ' : 'Simulation confirmation pending') : declined && paymentValidationBlocked ? (language === 'bn' ? 'পেমেন্টের তথ্য সংশোধন করুন' : 'Review payment information') : declined ? (language === 'bn' ? 'পরিশোধের অনুরোধ প্রত্যাখ্যাত' : 'Payment request declined') : bankPending ? (language === 'bn' ? 'ব্যাংকের জন্য পরিশোধ-স্লিপ প্রস্তুত' : 'Bank payment slip ready') : completed ? officeMirrorPending ? (language === 'bn' ? 'সিমুলেশন সংরক্ষিত — অফিস সমন্বয় অপেক্ষমাণ' : 'Simulation saved — Office sync pending') : (language === 'bn' ? 'পেমেন্ট রেকর্ড সংরক্ষিত' : 'Payment record saved') : (language === 'bn' ? 'পরিশোধ প্রক্রিয়াধীন…' : 'Processing payment…')}
          </PaymentConfirmationHeading>
          <PaymentConfirmationOverview language={language} amount={formatCurrency(shownTotal, language)}>
            {batchAttempt ? <div><p className="text-sm text-taxpay-muted">{language === 'bn' ? 'সংরক্ষিত রেকর্ড' : 'Records saved'}</p><p><strong>{confirmedReceipts.length} / {batchAttempt.items.length}</strong></p></div>
              : <div><span>{language === 'bn' ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</span><strong className="payment-lifecycle__reference-value">{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</strong></div>}
          </PaymentConfirmationOverview>
          <details className="payment-lifecycle__progress-detail" open={!completed && !bankPending && !declined}>
            <summary>{language === 'bn' ? 'পেমেন্টের অগ্রগতি ও রেফারেন্স' : 'Payment progress and references'} {!completed && <span>{lifecycleStages.length} / {ONLINE_LIFECYCLE.length}</span>}</summary>
          <div className="payment-lifecycle__details">
            {!batchAttempt && <dl className="payment-lifecycle__references">
              <div><dt>{language === 'bn' ? 'কর ইভেন্ট আইডি' : 'Tax event ID'}</dt><dd>{attemptReceipt?.taxEventId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'পেমেন্ট ট্রানজেকশন আইডি' : 'Payment transaction ID'}</dt><dd>{attemptReceipt?.paymentTransactionId || '—'}</dd></div>
              <div><dt>{language === 'bn' ? 'পেমেন্ট রেফারেন্স' : 'Payment reference'}</dt><dd>{referenceReady ? attemptReceipt?.challanNo : (language === 'bn' ? 'তৈরি হচ্ছে…' : 'Being generated…')}</dd></div>
              <div><dt>{language === 'bn' ? 'মোট অর্থ' : 'Amount'}</dt><dd>{formatCurrency(shownTotal, language)}</dd></div>
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
                  <p className="font-semibold break-words">{maskTinForDisplay(item.receipt.taxpayerTin)} · {item.receipt.assessmentYear}</p>
                  <p>{language === 'bn' ? head?.nameBn || head?.nameEn : head?.nameEn} · {formatCurrency(item.receipt.totalAmount, language)}</p>
                  <p className="break-all text-sm">{language === 'bn' ? 'রেফারেন্স' : 'Reference'}: {item.receipt.challanNo}</p>
                  <p className="text-sm">{itemReceipt ? (language === 'bn' ? 'রেকর্ড সংরক্ষিত' : 'Record saved') : (language === 'bn' ? 'অপেক্ষমাণ' : 'Pending')}</p>
                  {itemReceipt && <button type="button" className="payment-lifecycle__secondary mt-2 inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
                    aria-label={language === 'bn' ? `${maskTinForDisplay(item.receipt.taxpayerTin)}, ${head?.nameBn || head?.nameEn}, ${item.receipt.assessmentYear}-এর রসিদ দেখুন`
                      : `View receipt for ${maskTinForDisplay(item.receipt.taxpayerTin)}, ${head?.nameEn}, ${item.receipt.assessmentYear}`}
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
          {paymentStorageWarning && <p role="status" data-testid="payment-storage-warning" className="mx-4 my-3 rounded-lg border border-taxpay-border bg-taxpay-light p-3 text-sm text-taxpay-dark">
            {language === 'bn' ? 'ব্রাউজার স্টোরেজ ব্যবহার করা যাচ্ছে না। এই ট্যাব খোলা রাখুন; বন্ধ বা রিফ্রেশ করলে অপেক্ষমাণ অনুরোধটি আবার উদ্ধার করা যাবে না। একই রেফারেন্স দিয়ে আবার চেষ্টা করুন।' : 'Browser storage is unavailable. Keep this tab open: reloading or closing it prevents recovery of this pending request. Retry using the same reference.'}
          </p>}
          {bankPending && errorMessage && <p role="alert">{errorMessage}</p>}
          {completed && officeMirrorPending && errorMessage && <p role="alert">{errorMessage}</p>}
          {declined && <div className="payment-lifecycle__result payment-lifecycle__result--failed"><AlertCircle size={20} aria-hidden="true" /><p>{errorMessage || (language === 'bn' ? 'পেমেন্ট মাধ্যমটি অনুরোধ প্রত্যাখ্যান করেছে। অন্য পদ্ধতিতে আবার চেষ্টা করুন।' : 'The payment channel declined the request. You can retry with another method.')}</p></div>}
          {completed && <div className="payment-lifecycle__result payment-lifecycle__result--complete"><FileText size={18} aria-hidden="true" /><p>{officeMirrorPending
            ? (language === 'bn' ? 'সিমুলেশন TaxPay ডাটাবেসে সংরক্ষিত। অফিস সমন্বয় অপেক্ষমাণ; এটি প্রকৃত কর পরিশোধ নয়।' : 'Simulation saved in TaxPay SQL. Office synchronization is pending; this is not a real tax payment.')
            : (language === 'bn' ? 'পেমেন্ট রেকর্ড সংরক্ষিত হয়েছে; নিষ্পত্তি যাচাই হয়নি।' : 'Payment record saved; settlement is not verified.')}</p></div>}
          <div className="payment-lifecycle__actions no-print">
            {bankPending && <><button type="button" className="payment-lifecycle__secondary" onClick={() => window.print()}><FileText size={16} />{language === 'bn' ? 'স্লিপ প্রিন্ট করুন' : 'Print payment slip'}</button>{!embedded && <button type="button" className="payment-lifecycle__primary" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'}</button>}</>}
            {declined && !embedded && <button type="button" className="payment-lifecycle__primary" onClick={retryPayment} disabled={isProcessing}>{batchAttempt ? (language === 'bn' ? 'অপেক্ষমাণ রেকর্ডে আবার চেষ্টা' : 'Retry pending records') : syncPending ? (language === 'bn' ? 'পেমেন্ট নিশ্চিতকরণ আবার চেষ্টা' : 'Retry payment confirmation') : paymentValidationBlocked ? (batchAttemptRef.current ? (language === 'bn' ? 'তালিকা সংশোধন করে আবার চেষ্টা করুন' : 'Retry after updating the saved list') : (language === 'bn' ? 'পেমেন্টের তথ্য দেখুন' : 'Review payment details')) : (language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা করুন' : 'Try another payment method')}</button>}
            {completed && officeMirrorPending && <button type="button" className="payment-lifecycle__secondary" disabled={isProcessing || !canRetryOfficeSync} onClick={()=>{
              if (batchOfficeRetry) { setIsProcessing(true); void confirmOtherTaxBatch(); return; }
              const pending=pendingStoryRef.current;
              if(pending){setIsProcessing(true);void confirmSimulatedPayment(pending.receipt);}
            }}>{language === 'bn' ? 'অফিস সমন্বয় আবার চেষ্টা' : 'Retry Office synchronization'}</button>}
            {completed && !embedded && (batchAttempt ? <button type="button" className="payment-lifecycle__primary" onClick={startAnotherBatch} disabled={officeMirrorPending}>{copy.anotherPayment}</button> : <button type="button" className="payment-lifecycle__primary" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ দেখুন' : 'View receipt details'} <ArrowRight size={17} /></button>)}
          </div>
          {unifiedFlow && embedded && completed && !signedInAccount && createdReceipt && (
            <WalkInChallanAction language={language} onOpen={() => { setSelectedWalkInReceipt(createdReceipt); setShowReceiptDetails(true); }}>
              {confirmedReceipts.length > 1 && <div className="walkin-result-challan__batch" aria-label={language === 'bn' ? 'এই পেমেন্টের চালানসমূহ' : 'Challans from this payment'}>
                {confirmedReceipts.map((receipt, index) => <button type="button" key={receipt.id}
                  onClick={() => { setSelectedWalkInReceipt(receipt); setShowReceiptDetails(true); }}>
                  {language === 'bn' ? 'চালান ' : 'Challan '}{index + 1}: {receipt.challanNo}
                </button>)}
              </div>}
            </WalkInChallanAction>
          )}
          {unifiedFlow && embedded && completed && !officeMirrorPending && !signedInAccount && !skipPostPaymentLogin && (
            <WalkInResultBenefits language={language} onSignIn={() => { setPaymentServiceChoiceOpen(false); navigate('taxpayer_login'); }} onSkip={() => setSkipPostPaymentLogin(true)}/>
          )}
        </PaymentConfirmationLayout>
        {embedded && modalFooterTarget && createPortal(
          <PaymentJourneyFooter className="payment-flow-embedded__footer-actions"
            next={<>
              {completed && !(unifiedFlow && !signedInAccount) && (batchAttempt ? <button type="button" className="tax-service-choice__continue" onClick={startAnotherBatch} disabled={officeMirrorPending}>{copy.anotherPayment} <ArrowRight size={17} /></button> : <button type="button" className="tax-service-choice__continue" onClick={() => setShowReceiptDetails(true)}>{language === 'bn' ? 'রসিদের বিবরণ' : 'Receipt details'} <ArrowRight size={17} /></button>)}
              {bankPending && <button type="button" className="tax-service-choice__continue" onClick={simulateBankSettlement}>{language === 'bn' ? 'ব্যাংক পরিশোধের ধাপে যান' : 'Continue bank payment'} <ArrowRight size={17} /></button>}
              {declined && <button type="button" className="tax-service-choice__continue" onClick={retryPayment} disabled={isProcessing}>{batchAttempt ? (language === 'bn' ? 'অপেক্ষমাণ রেকর্ডে আবার চেষ্টা' : 'Retry pending records') : syncPending ? (language === 'bn' ? 'পেমেন্ট নিশ্চিতকরণ আবার চেষ্টা' : 'Retry payment confirmation') : paymentValidationBlocked ? (batchAttemptRef.current ? (language === 'bn' ? 'তালিকা সংশোধন করে আবার চেষ্টা করুন' : 'Retry after updating the saved list') : (language === 'bn' ? 'পেমেন্টের তথ্য দেখুন' : 'Review payment details')) : (language === 'bn' ? 'অন্য পদ্ধতিতে চেষ্টা' : 'Try another method')} <ArrowRight size={17} /></button>}
            </>} />, modalFooterTarget
        )}
      </div>
    );
  }

  const receiptEmailControl = (
    <div className={forSelf === true ? 'payment-identity__email-field--full' : undefined}>
      <label htmlFor="guest-receipt-email" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'ইমেইল ঠিকানা (ঐচ্ছিক)' : 'Email address (optional)'}</label>
      <input id="guest-receipt-email" type="email" inputMode="email" autoComplete="email"
        placeholder="name@example.com" maxLength={254} value={receiptEmail}
        aria-invalid={isFieldInvalid('email') || !isOptionalReceiptEmailValid(receiptEmail) || undefined}
        aria-describedby={errorDescription('email')}
        onChange={event => { setReceiptEmail(event.target.value); if (isFieldInvalid('email')) clearValidationError(); }}
        className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary" />
      {fieldError('email')}
    </div>
  );

  // The same validated fields render in the original Step 1 or, for the
  // consolidated Home journey, in Step 3. No duplicate payer implementation.
  const payerReceiptFields = (<>
              {(!ownAccountTax || !isWithholdingMode) && <div className={`payment-identity__receipt-row${ownAccountTax ? " payment-identity__receipt-row--account" : ""}`}>
              {forSelf === false && !signedInAccount && <div>
                <label htmlFor="guest-payer-name" className="block text-xs font-semibold text-slate-700 mb-1">{otherBatch ? (language === 'bn' ? 'আপনার নাম (পরিশোধকারী)' : 'Your name (payer)') : (language === 'bn' ? 'আপনার নাম (পরিশোধকারী)' : 'Your name (payer)')} *</label>
                <input
                  id="guest-payer-name"
                  type="text"
                  aria-invalid={isFieldInvalid('payerName') || undefined}
                  aria-describedby={errorDescription('payerName')}
                  placeholder={copy.payerNamePlaceholder}
                  value={effectivePayerName}
                  readOnly={Boolean(signedInPayerName || confirmedWalkInPayer)} aria-readonly={Boolean(signedInPayerName || confirmedWalkInPayer)}
                  required autoComplete="name"
                  onChange={(e) => setPayerName(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
                {fieldError('payerName')}
              </div>}


                {(!signedInAccount || !signedInProfile?.receiptMobile) && <div>
                <label htmlFor="guest-phone" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'রসিদের জন্য মোবাইল নম্বর' : 'Mobile number for receipt'} *</label>
                <input
                  id="guest-phone"
                  type="tel"
                  placeholder={language === 'bn' ? '০১XXXXXXXXX' : '01XXXXXXXXX'}
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



              {!ownAccountTax && forSelf !== true && receiptEmailControl}
              {!isWithholdingMode && <div>
                <label htmlFor="guest-notice-ref" className="block text-xs font-semibold text-slate-700 mb-1">{language === 'bn' ? 'NBR নোটিশ বা পেমেন্ট রেফারেন্স' : 'NBR notice or payment reference'} {requiresNBRReference ? '*' : (language === 'bn' ? '(ঐচ্ছিক)' : '(optional)')}</label>
                <input id="guest-notice-ref" type="text" value={noticeReference} onChange={event => { clearReferenceSelection(); setNoticeReference(event.target.value); }} required={requiresNBRReference}
                  aria-invalid={isFieldInvalid('noticeReference') || undefined} aria-describedby={errorDescription('noticeReference')}
                  placeholder="PN-2026-000392" className="min-h-11 w-full px-3 py-2 text-sm rounded-lg border border-slate-300" />
                {fieldError('noticeReference')}
                </div>}
              {!ownAccountTax && forSelf === true && receiptEmailControl}
              </div>}
              {otherBatch && forSelf === false && !signedInAccount && <div data-testid="walkin-payer-tin">
                <TaxpayerTinLookup
                  directDigitEdit
                  language={language} tinId="guest-payer-tin" nameId="guest-payer-tin-name"
                  tin={walkInPayerTin}
                  name={walkInPayerLookup?.tin === walkInPayerTin
                    ? (language === 'bn' ? walkInPayerLookup.nameBn : walkInPayerLookup.nameEn) : ''}
                  tinLabel={language === 'bn' ? 'পরিশোধকারীর নিজের টিআইএন (ঐচ্ছিক)' : 'Payer TIN (optional)'}
                  nameLabel={language === 'bn' ? 'মিলে যাওয়া পরিশোধকারীর নাম' : 'Matched payer name'}
                  hideNameField={unifiedFlow || walkInPayerLookup?.tin === walkInPayerTin}
                  omitNameField={unifiedFlow}
                  searchLabel={language === 'bn' ? 'পরিশোধকারীর টিআইএন খুঁজুন' : 'Search payer TIN'}
                  requiredTin={false} maxTinLength={unifiedFlow ? 13 : 12}
                  tinPlaceholder={unifiedFlow ? (language === 'bn' ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN') : undefined}
                  canSearch={(unifiedFlow ? /^\d{12,13}$/ : /^\d{12}$/).test(walkInPayerTin)}
                  invalidTin={isFieldInvalid('payerTin')} tinDescribedBy={errorDescription('payerTin')}
                  onTinChange={value => {
                    setWalkInPayerTin(value); setWalkInPayerLookup(null);
                    setWalkInPayerSearchedTin(''); setWalkInPayerConfirmed(false); clearValidationError();
                  }}
                  onClear={() => {
                    setWalkInPayerTin(''); setWalkInPayerLookup(null);
                    setWalkInPayerSearchedTin(''); setWalkInPayerConfirmed(false); clearValidationError();
                  }}
                  onSearch={() => {
                    setWalkInPayerSearchedTin(walkInPayerTin);
                    setWalkInPayerLookup((unifiedFlow ? /^\d{12,13}$/ : /^\d{12}$/).test(walkInPayerTin)
                      ? lookupSampleTaxpayer(walkInPayerTin) : null);
                    setWalkInPayerConfirmed(false);
                  }}
                  status={unifiedFlow ? (
                    walkInPayerSearchedTin === walkInPayerTin && walkInPayerTin && !walkInPayerLookup
                      ? <p role="alert" className="text-xs text-rose-700">{language === 'bn' ? 'মিলে যাওয়া পরিশোধকারীর তথ্য পাওয়া যায়নি।' : 'No matching payer information found.'}</p>
                      : null
                  ) : walkInPayerTin && /^\d{12}$/.test(walkInPayerTin) && !walkInPayerLookup
                    ? <p className="text-xs text-slate-600">{language === 'bn' ? 'করদাতার তথ্য খুঁজুন।' : 'Search taxpayer information.'}</p>
                    : walkInPayerLookup ? <p className="sr-only">{language === 'bn' ? 'টিআইএন মিলে গেছে।' : 'TIN matched.'}</p> : null}
                  error={fieldError('payerTin')}
                />
                {walkInPayerLookup?.tin === walkInPayerTin && <TaxpayerTinSearchResultCard
                  key={walkInPayerTin} testId={unifiedFlow ? 'unified-v5-payer-result' : 'walkin-payer-search-result'}
                  language={language} tin={walkInPayerTin}
                  name={language === 'bn' ? walkInPayerLookup.nameBn : walkInPayerLookup.nameEn}
                  classification={entityTypeForTin(walkInPayerTin) === 'COMPANY'
                    ? (language === 'bn' ? 'কোম্পানি' : 'Company')
                    : entityTypeForTin(walkInPayerTin) === 'NON_COMPANY'
                      ? (language === 'bn' ? 'ব্যক্তি' : 'Individual') : undefined}
                />}
                {walkInPayerLookup?.tin === walkInPayerTin && !confirmedWalkInPayer &&
                  <button type="button" className="min-h-11 rounded-lg border border-taxpay-primary px-4 py-2 text-sm text-taxpay-primary"
                    onClick={() => { setWalkInPayerConfirmed(true); clearValidationError(); }}>
                    {language === 'bn' ? 'পরিশোধকারীর তথ্য নিশ্চিত করুন' : 'Confirm payer'}
                  </button>}
                {confirmedWalkInPayer && <p className="text-xs text-slate-700" role="status">
                  {language === 'bn' ? 'বর্তমান নমুনা টিআইএন তালিকায় মিলেছে। অ্যাকাউন্টের মালিকানা যাচাই করা হয়নি।' : 'Matched the current sample TIN lookup. Account ownership is not verified.'}
                </p>}
              </div>}
  </>);

  const paymentRemarksControl = (
    <section className={unifiedFlow ? 'unified-v5-remarks-section' : 'rounded-lg border border-taxpay-border bg-white p-3 sm:p-4'}
      data-testid="challan-remarks-field">
      {unifiedFlow && <h3 className="unified-v5-remarks-heading">
        {language === 'bn' ? 'পেমেন্টের মন্তব্য / ইনভয়েস রেফারেন্স' : 'Payment Remarks / Invoice Reference'}
        <small>{language === 'bn' ? '(ঐচ্ছিক)' : '(Optional)'}</small>
      </h3>}
      <div className={unifiedFlow ? 'unified-v5-remarks-body' : undefined}>
        <label htmlFor="guest-payment-remarks"
          className={unifiedFlow ? 'sr-only' : 'mb-2 block text-sm font-semibold text-taxpay-dark'}>
          {copy.remarks}
        </label>
        <textarea id="guest-payment-remarks" rows={unifiedFlow ? 4 : 3} value={paymentRemarks}
          aria-describedby="guest-payment-remarks-limit"
          onChange={event => setPaymentRemarks(limitChallanRemarks(event.target.value))}
          placeholder={copy.remarksPlaceholder}
          className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary" />
        <p id="guest-payment-remarks-limit" className="mt-1 text-xs text-slate-600">
          {language === 'bn' ? 'সর্বোচ্চ ৪,০০০ অক্ষর' : 'Maximum 4,000 characters'}
        </p>
      </div>
    </section>
  );


  // The approved service choice is shared by the existing Other Tax composer and
  // the exclusive Return form. Never silently delete multi-taxpayer allocations.
  const selectUnifiedTaxService = (next: 'TAX_WITH_RETURN' | 'OTHER_TAX_PAYMENT') => {
    setUnifiedReturnSelectionNotice('');
    if (next === category) return;
    if (next === 'TAX_WITH_RETURN') {
      if (batchTaxpayers.length !== 1) {
        setUnifiedReturnSelectionNotice(language === 'bn'
          ? 'রিটার্নসহ করের জন্য একজন করদাতা রাখুন। প্রথম ধাপে ফিরে অতিরিক্ত করদাতা সরান।'
          : 'Tax with Return is for one taxpayer. Go Back to Taxpayer Information and remove the additional taxpayer.');
        return;
      }
      // The two service choices are separate. Retain Other Tax edits without
      // mixing those lines into the exclusive Return submission or draft.
      if (otherTaxLines.length > 0) {
        setUnifiedOtherTaxParkedLines(otherTaxLines);
        setOtherTaxLines([]);
      }
      const type = entityTypeForTin(taxpayerTin);
      if (!type) {
        setUnifiedReturnSelectionNotice(language === 'bn'
          ? 'টিআইএন তথ্য থেকে করদাতার আয়করের ধরন যাচাই করুন।'
          : 'Verify the taxpayer income-tax type from their TIN profile first.');
        return;
      }
      setIncomeTaxType(type);
      setSelectedHeadIds([]);
      setCategory('TAX_WITH_RETURN');
    } else {
      setCategory('OTHER_TAX_PAYMENT');
      setSelectedHeadIds([]);
      if (unifiedOtherTaxParkedLines.length > 0) {
        setOtherTaxLines(unifiedOtherTaxParkedLines);
        setUnifiedOtherTaxParkedLines([]);
      }
    }
    setVerifiedReference(null);
    clearValidationError();
  };

  const unifiedServiceChoice = unifiedFlow ? (
    <section className="payment-unified-service-selection" aria-labelledby="unified-service-heading">
      <h3 id="unified-service-heading" className="tax-service-choice__entry-heading">
        {language === 'bn' ? 'কোন ধরনের কর পরিশোধ করতে চান?' : 'Which tax would you like to pay?'}
      </h3>
      <div className="tax-service-choice__grid tax-service-choice__tax-grid" role="group" aria-labelledby="unified-service-heading">
        {([
          {id:'TAX_WITH_RETURN' as const, Icon:FileText, en:'Tax with Return', bn:'রিটার্নসহ কর', descriptionEn:'Section 173', descriptionBn:'ধারা ১৭৩'},
          {id:'OTHER_TAX_PAYMENT' as const, Icon:CreditCard, en:'Other Tax', bn:'অন্যান্য কর', descriptionEn:'Other tax payments.', descriptionBn:'অন্যান্য কর পরিশোধ।'},
        ]).map(({id, Icon, en, bn, descriptionEn, descriptionBn}) => (
          <button type="button" key={id} data-unified-tax-service={id}
            className="tax-service-choice__card" aria-pressed={category === id}
            onClick={() => selectUnifiedTaxService(id)}>
            <span className="tax-service-choice__icon"><Icon size={22} strokeWidth={1.9} aria-hidden="true"/></span>
            <span className="tax-service-choice__copy">
              <strong>{language === 'bn' ? bn : en}</strong>
              <span className="tax-service-choice__description">{language === 'bn' ? descriptionBn : descriptionEn}</span>
            </span>
            <span className="tax-service-choice__radio" aria-hidden="true"><span/></span>
          </button>
        ))}
      </div>
      {unifiedReturnSelectionNotice && <p role="alert" className="payment-unified-service-selection__notice" data-testid="unified-return-eligibility">
        {unifiedReturnSelectionNotice}
        {batchTaxpayers.length !== 1 && <button type="button" className="payment-unified-service-selection__edit" onClick={() => setStep(1)}>
          {language === 'bn' ? 'করদাতা সম্পাদনা করুন' : 'Edit taxpayers'}
        </button>}
      </p>}
    </section>
  ) : null;

  const legacySourceAmount = initialReuse?.formPayload.legacySourceAmount;

  return (
    <div lang={language === 'bn' ? 'bn' : 'en'} className={`${embedded ? 'payment-flow-embedded' : 'max-w-7xl mx-auto space-y-6 pb-12'} ${unifiedFlow ? 'payment-flow-embedded--unified' : ''} ${language === 'bn' ? 'font-bengali' : ''}`}>
      {sourcePaymentId && <p role="status" data-testid="pay-again-reuse-notice" className="rounded-lg border border-taxpay-border bg-taxpay-light p-3 text-sm text-taxpay-dark">
        {language==='bn'?'আগের পেমেন্ট থেকে তথ্য কপি করা হয়েছে: ':'Copied from previous payment: '}
        <strong className="break-all">{sourcePaymentId}</strong>.
        {' '}{language==='bn'?'মূল পেমেন্ট অপরিবর্তিত। প্রতিটি করবর্ষ, পরিমাণ ও তথ্য যাচাই করুন।':'Original payment unchanged. Review every year, amount and taxpayer before submitting.'}
        {typeof legacySourceAmount==='string'&&
          <span className="mt-2 block" data-testid="pay-again-legacy-note">
            {language==='bn'
              ? 'পুরোনো রেকর্ডে পেমেন্ট খাতের আইডি ও করদাতার ধরন ছিল না। এগুলো নতুন করে নির্বাচন করুন। রেকর্ডকৃত পরিমাণ ৳'+legacySourceAmount+' — খাত নির্বাচন করলে পরিমাণ প্রস্তাব করা হবে।'
              : 'This older record did not save the payment-head ID or income-tax classification. Choose them again. Original recorded amount: ৳'+legacySourceAmount+'. The amount is suggested after selecting a head.'}
          </span>}
      </p>}
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

        {(signedInAccount || unsignedGuestDrafts) && isPaymentDraftService(category) && step <= 3 &&
          <AccountPaymentDraftControls service={category} language={language} guardOnly={step === 3}
            allowGuest={unsignedGuestDrafts}
            snapshot={snapshotAccountDraft} restore={restoreAccountDraft}
            selectedDraft={selectedAccountDraft} onSelectedDraft={setSelectedAccountDraft}
            actionTarget={embedded ? draftFooterTarget : undefined} />}

        {/* STEP 1: Taxpayer Identification */}
        {step === 1 && (unifiedAccountSelection ? (
          <UnifiedTaxpayerWorkspace language={language} primaryTin={taxpayerTin} primaryName={otherTaxpayerName}
            additional={additionalTaxpayers} confirmedTins={confirmedOtherTaxTins} allocations={otherTaxLines.length ? otherTaxLines : unifiedOtherTaxParkedLines}
            error={errorField==='tin'||errorField==='incomeTaxType'?errorMessage:unavailableUnifiedRecipient?(language==='bn'?'নির্বাচিত উপকারভোগী আর সংরক্ষিত তালিকায় নেই। নির্বাচিত করদাতার তালিকা থেকে সরান অথবা টিআইএন খুঁজে আবার নিশ্চিত করুন।':'A selected beneficiary is no longer saved. Remove them from the selected taxpayers or search and confirm their TIN again.'):undefined}
            onAddPrimary={addAccountRecipient} onAddAdditional={p=>addAccountRecipient(p.tin,p.name)}
            onRemove={id=>replaceAccountRecipients(selectedAccountRecipients.filter(p=>p.id!==id))}
            account={{
              own:signedInProfile?{tin:signedInProfile.tin,name:signedInPayerName}:null,
              selected:selectedAccountRecipients,
              onToggleOwn:()=>{
                if(!signedInProfile)return;
                replaceAccountRecipients(selectedAccountRecipients.some(p=>p.tin===signedInProfile.tin)
                  ? selectedAccountRecipients.filter(p=>p.tin!==signedInProfile.tin)
                  : [{id:crypto.randomUUID(),tin:signedInProfile.tin,name:signedInPayerName},...selectedAccountRecipients]);
              },
              canAdd:canAddAccountRecipient,onAdd:addAccountRecipient,
              classification:entityTypeForTin,
              onClassification:(value,type)=>setTaxpayerEntityOverrides(previous=>({...previous,[value]:type})),
              savedBeneficiaries:<SavedBeneficiaryPicker key={beneficiaryRefreshKey} language={language} allowMultiple
                selectedTins={selectedAccountRecipients.filter(p=>p.tin!==signedInProfile?.tin).map(p=>p.tin)}
                onAvailableTins={setAvailableSavedTins} onManage={onManageBeneficiaries} showAddAction={Boolean(onManageBeneficiaries)}
                onChoose={people=>{
                  // A verified account may select its saved contacts before profile linking.
                  // Keep the linked taxpayer profile validation gate for continuation/payment.
                  if(!paymentOwnerId||!availableSavedTins)return;
                  const ownTin=signedInProfile?.tin;
                  const preserved=selectedAccountRecipients.filter(p=>p.tin===ownTin||!availableSavedTins.includes(p.tin));
                  const saved=people.filter(p=>p.tin!==ownTin&&availableSavedTins.includes(p.tin))
                    .map(p=>({...p,id:selectedAccountRecipients.find(old=>old.tin===p.tin)?.id??crypto.randomUUID()}));
                  const requested=[...preserved,...saved];
                  const removed=selectedAccountRecipients.find(p=>!requested.some(n=>n.tin===p.tin) && [...otherTaxLines,...unifiedOtherTaxParkedLines].some(l=>l.taxpayerId===p.id));
                  if(removed) { setValidationError(language==='bn'?'নির্বাচিত খাতসহ করদাতা সরাতে ডান পাশের তালিকা ব্যবহার করুন।':'To remove a taxpayer with assigned payment heads, use the selected taxpayer list.','tin'); return; }
                  replaceAccountRecipients(requested);
                }}/>
            }}/>
        ) : unifiedFlow && !signedInAccount ? (
          <UnifiedTaxpayerWorkspace
            language={language}
            primaryTin={taxpayerTin}
            primaryName={otherTaxpayerName}
            additional={additionalTaxpayers}
            confirmedTins={confirmedOtherTaxTins}
            allocations={otherTaxLines.length ? otherTaxLines : unifiedOtherTaxParkedLines}
            error={errorField === 'tin' ? errorMessage : undefined}
            onAddPrimary={(newTin, newName) => {
              setTin(newTin); setOtherTaxpayerName(newName);
              setLastSearchedTin(newTin);
              setConfirmedOtherTaxTins(current => ({ ...current, primary: newTin }));
              clearValidationError();
            }}
            onAddAdditional={person => {
              setAdditionalTaxpayers(current => [...current, person]);
              setConfirmedOtherTaxTins(current => ({ ...current, [person.id]: person.tin }));
              if (category === 'TAX_WITH_RETURN') {
                setCategory('OTHER_TAX_PAYMENT');
                if (unifiedOtherTaxParkedLines.length) {
                  setOtherTaxLines(unifiedOtherTaxParkedLines);
                  setUnifiedOtherTaxParkedLines([]);
                }
                setUnifiedReturnSelectionNotice(language === 'bn'
                  ? 'একাধিক করদাতার জন্য অন্যান্য কর নির্বাচন করা হয়েছে। রিটার্নসহ কর কেবল একজনের জন্য।'
                  : 'Other Tax is selected for multiple taxpayers. Tax with Return is available for one taxpayer only.');
              }
              clearValidationError();
            }}
            onRemove={id => {
              if (id === 'primary') {
                const [promote, ...rest] = additionalTaxpayers;
                setTin(promote?.tin ?? '');
                setOtherTaxpayerName(promote?.name ?? '');
                setLastSearchedTin(promote?.tin ?? null);
                setAdditionalTaxpayers(rest);
                setConfirmedOtherTaxTins(current => {
                  const next = { ...current }; delete next.primary;
                  if (promote) { delete next[promote.id]; next.primary = promote.tin; }
                  return next;
                });
                setOtherTaxLines(current => current.filter(line => line.taxpayerId !== 'primary')
                  .map(line => line.taxpayerId === promote?.id ? { ...line, taxpayerId: 'primary' } : line));
                setUnifiedOtherTaxParkedLines(current => current.filter(line => line.taxpayerId !== 'primary')
                  .map(line => line.taxpayerId === promote?.id ? { ...line, taxpayerId: 'primary' } : line));
              } else {
                setAdditionalTaxpayers(current => current.filter(person => person.id !== id));
                setConfirmedOtherTaxTins(current => {const next = {...current}; delete next[id]; return next;});
                setOtherTaxLines(current => current.filter(line => line.taxpayerId !== id));
                setUnifiedOtherTaxParkedLines(current => current.filter(line => line.taxpayerId !== id));
              }
              setUnifiedReturnSelectionNotice('');
              clearValidationError();
            }}
          />
        ) : (
          <div className={`payment-form-layout${embedded ? ' payment-flow-embedded__identity' : ''}`}>
            <div className="payment-form-layout__sections">
            {(!embedded || initialForSelf === undefined) ? <PaymentFormSection number={1} staticView={embedded} title={language === 'bn' ? 'কার জন্য পরিশোধ করছেন?' : 'Who are you paying for?'} description={language === 'bn' ? 'নিজের বা অন্যের হয়ে পরিশোধ নির্বাচন করুন' : 'Choose your relationship to the taxpayer'}>
              <fieldset className="payment-form-radio-fieldset" aria-invalid={isFieldInvalid('payerChoice') || undefined}>
                <legend className="sr-only">{language === 'bn' ? 'পরিশোধকারীর ধরন' : 'Payer relationship'}</legend>
                <div className="payment-radio-card-grid">
                  {[{ value: true, en: isWithholdingMode ? 'I am the withholding agent' : 'My tax liability', bn: isWithholdingMode ? 'আমি উৎসে কর কর্তনকারী' : 'আমার করদায়' }, { value: false, en: isWithholdingMode ? 'Paying for the agent' : 'Facilitate another taxpayer’s payment', bn: isWithholdingMode ? 'এজেন্টের পক্ষে পরিশোধ' : 'অন্য করদাতার কর পরিশোধে সহায়তা করুন' }].map(choice =>
                    <PaymentRadioCard key={String(choice.value)} id={choice.value ? 'guest-payer-self' : 'guest-payer-other'} name="guest-payer-relationship" value={String(choice.value)} checked={forSelf === choice.value}
                      onChange={() => { clearReferenceSelection(); setOneTimeRecipient(null); setForSelf(choice.value); setWalkInPayerTin(''); setWalkInPayerLookup(null); setWalkInPayerConfirmed(false); setOneTimeTaxpayer(null); setOneTimeRecipient(null); setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError(''); if (signedInAccount && !choice.value) { setTin(''); setOtherTaxpayerName(''); } setAdditionalTaxpayers([]); setOtherTaxLines([]); setConfirmedOtherTaxTins({}); setAuthorizedTaxpayerIds({}); setAuthorizedTaxpayerId(null); clearValidationError(); }} title={language === 'bn' ? choice.bn : choice.en} invalid={isFieldInvalid('payerChoice')} errorId={`${ERROR_ID}-payerChoice`} />)}
                </div>
                {forSelf === null && <p className="payment-radio-card__empty">{language === 'bn' ? 'এগিয়ে যেতে একটি বিকল্প নির্বাচন করুন।' : 'No option selected. Choose one to continue.'}</p>}
                {fieldError('payerChoice')}
              </fieldset>
            </PaymentFormSection> : null}
            {forSelf !== null && !(unifiedFlow && otherBatch && !signedInAccount && forSelf === false) && <PaymentFormSection number={2} staticView={embedded} hideHeading={ownAccountTax} title={simpleOwnOtherTax ? (language === 'bn' ? 'করদাতার তথ্য' : 'Taxpayer information') : signedInAccount && forSelf === false ? (language === 'bn' ? 'উপকারভোগী নির্বাচন' : 'Choose beneficiaries') : ownAccountTax ? (language === 'bn' ? 'অ্যাকাউন্টের তথ্য' : 'Account details') : otherBatch ? (language === 'bn' ? 'পরিশোধকারীর তথ্য' : 'Payer details') : (language === 'bn' ? 'করদাতার পরিচয়' : 'Taxpayer identification')} description={simpleOwnOtherTax ? '' : signedInAccount && forSelf === false ? (language === 'bn' ? 'সংরক্ষিত তালিকা থেকে উপকারভোগী নির্বাচন করুন' : 'Select beneficiaries from your saved lists') : ownAccountTax ? (language === 'bn' ? 'অ্যাকাউন্ট থেকে আপনার করদাতার তথ্য দেখানো হচ্ছে' : 'Your taxpayer information is filled from your signed-in account') : otherBatch ? '' : (language === 'bn' ? 'করদাতার টিআইএন ও ঐচ্ছিক রেফারেন্স' : 'Taxpayer TIN and optional NBR reference')}>
            
            {signedInBeneficiarySelection && <SavedBeneficiaryPicker key={beneficiaryRefreshKey} language={language} allowMultiple={otherBatch}
              selectedTins={(otherBatch ? batchTaxpayers : batchTaxpayers.slice(0,1)).map(person=>person.tin).filter(Boolean)}
              onAvailableTins={setAvailableSavedTins} onManage={onManageBeneficiaries}
allowOneTimeFallback={Boolean(paymentOwnerId)}
              fallbackSelection={activeOneTimeRecipient?{tin:activeOneTimeRecipient.tin,name:language==='bn'?activeOneTimeRecipient.nameBn:activeOneTimeRecipient.nameEn}:null}
              onFallbackClear={()=>{
                if(oneTimeTaxpayer)setOtherTaxLines(lines=>lines.filter(line=>line.taxpayerId!==oneTimeTaxpayer.id));
                if(primaryOneTimeRecipient){
                  setOtherTaxLines(lines=>lines.filter(line=>line.taxpayerId!=='primary'));
                  setTin('');setOtherTaxpayerName('');
                }
                setOneTimeTaxpayer(null);
                setOneTimeRecipient(null);
                setOneTimeTinDraft('');setOneTimeSearchedTin(null);setOneTimeLookupError('');
              }}
              onFallbackSelect={person=>{
                const ownerId=paymentOwnerId;
                const match=lookupSampleTaxpayer(person.tin);
                if(!ownerId||!signedInBeneficiarySelection||!availableSavedTins||
                  availableSavedTins.includes(person.tin)||person.tin===signedInProfile?.tin||
                  !match||match.nameEn!==person.name&&match.nameBn!==person.name)return;
                const savedPrimary=Boolean(taxpayerTin&&availableSavedTins.includes(taxpayerTin));
                if(oneTimeTaxpayer)setOtherTaxLines(lines=>lines.filter(line=>line.taxpayerId!==oneTimeTaxpayer.id));
                setOneTimeRecipient({ownerId,tin:match.tin,nameEn:match.nameEn,nameBn:match.nameBn});
                if(otherBatch && savedPrimary){
                  setOneTimeTaxpayer({id:crypto.randomUUID(),tin:match.tin,name:match.nameEn});
                }else{
                  // Only one beneficiary in this payment: allow one-time without
                  // a saved list, including Tax With Return's exclusive route.
                  setTin(match.tin);setOtherTaxpayerName(match.nameEn);
                  setOneTimeTaxpayer(null);setAdditionalTaxpayers([]);
                  setOtherTaxLines([]);setSelectedHeadIds([]);setAmountInputs({});
                }
                setOneTimeTinDraft('');setOneTimeSearchedTin(null);setOneTimeLookupError('');
              }}
                            onChoose={selected => {
                clearReferenceSelection();
                // The one-time recipient is represented by the same immutable WS1
                // payment-only entry; saved selections are still checked against
                // the active account lists and must never auto-save that TIN.
                const unique=selected.filter((person,index)=>
                  selected.findIndex(candidate=>candidate.tin===person.tin)===index)
                  .filter(person=>Boolean(availableSavedTins?.includes(person.tin)));
                const first=unique[0];
                const priorPrimaryTin=taxpayerTin;
                if(primaryOneTimeRecipient && first?.tin!==primaryOneTimeRecipient.tin) setOneTimeRecipient(null);
                if (oneTimeTaxpayer && unique.some(person => person.tin === oneTimeTaxpayer.tin)) {
                  setOneTimeLookupError(language === 'bn'
                    ? 'এই টিআইএনটি সংরক্ষিত তালিকায় আছে। পেমেন্টে সংরক্ষিত উপকারভোগী নির্বাচন করুন।'
                    : 'This TIN is already saved. Select its saved beneficiary entry for this payment.');
                  return;
                }
                const additional=otherBatch?unique.slice(1).map(person=>{
                  const previous=additionalTaxpayers.find(candidate=>candidate.tin===person.tin);
                  return {...person,id:previous?.id??crypto.randomUUID()};
                }):[];
                setTin(first?.tin??'');
                setOtherTaxpayerName(first?.name??'');
                setAdditionalTaxpayers(additional);
                setOtherTaxLines(lines=>lines.filter(line=>line.taxpayerId==='primary'
                  ? Boolean(first&&first.tin===priorPrimaryTin)
                  : additional.some(person=>person.id===line.taxpayerId) ||
                    Boolean(oneTimeTaxpayer && line.taxpayerId===oneTimeTaxpayer.id)));
                setOneTimeLookupError('');

                setAuthorizedTaxpayerId(null);
                setAuthorizedTaxpayerIds({});
                clearValidationError();
              }} />}
            {signedInBeneficiarySelection && otherBatch && !primaryOneTimeRecipient && <section className="col-span-full space-y-3 rounded-lg border border-taxpay-border p-3"
              data-testid="one-time-taxpayer-entry" aria-label={language === 'bn' ? 'একবারের করদাতা' : 'One-time taxpayer'}>
              <div>
                <h3 className="text-sm font-semibold text-taxpay-dark">
                  {language === 'bn' ? 'এই পেমেন্টের জন্য নতুন করদাতা যোগ করুন' : 'Add a one-time taxpayer for this payment'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {language === 'bn'
                    ? 'এই করদাতা শুধু এই পেমেন্টে ব্যবহার হবে এবং সংরক্ষিত উপকারভোগীর তালিকায় যোগ হবে না।'
                    : 'This taxpayer is used only for this payment and is not added to your saved beneficiary lists.'}
                </p>
              </div>
              {oneTimeTaxpayer ? <div className="space-y-3" data-testid="confirmed-one-time-taxpayer">
                <TaxpayerTinSearchResultCard key={oneTimeTaxpayer.tin} language={language}
                  tin={oneTimeTaxpayer.tin} name={oneTimeTaxpayer.name}
                  classification={entityTypeForTin(oneTimeTaxpayer.tin) === 'COMPANY'
                    ? (language === 'bn' ? 'কোম্পানি' : 'Company')
                    : entityTypeForTin(oneTimeTaxpayer.tin) === 'NON_COMPANY'
                      ? (language === 'bn' ? 'ব্যক্তি' : 'Individual') : undefined}
                />
                <button type="button" className="min-h-10 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-semibold text-taxpay-dark"
                  onClick={() => {
                    setOtherTaxLines(lines => lines.filter(line => line.taxpayerId !== oneTimeTaxpayer.id));
                    setOneTimeTaxpayer(null); setOneTimeRecipient(null); setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError('');
                  }}>
                  {language === 'bn' ? 'পেমেন্ট থেকে সরান' : 'Remove from this payment'}
                </button>
              </div> : <>
                <TaxpayerTinLookup directDigitEdit language={language} tinId="other-tax-one-time-tin" nameId="other-tax-one-time-name"
                  tin={oneTimeTinDraft} name={oneTimeSearchMatch ? (language === 'bn' ? oneTimeSearchMatch.nameBn : oneTimeSearchMatch.nameEn) : ''}
                  onTinChange={value => { setOneTimeTinDraft(value); setOneTimeSearchedTin(null); setOneTimeLookupError(''); }}
                  onSearch={() => {
                    setOneTimeSearchedTin(oneTimeTinDraft);
                    const match = lookupSampleTaxpayer(oneTimeTinDraft);
                    if (!match || match.tin !== oneTimeTinDraft) setOneTimeLookupError(language === 'bn' ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.');
                    else if (availableSavedTins?.includes(oneTimeTinDraft) || savedBatchTaxpayers.some(person => person.tin === oneTimeTinDraft))
                      setOneTimeLookupError(language === 'bn'
                        ? 'এই টিআইএনটি ইতিমধ্যে নির্বাচিত বা সংরক্ষিত। পেমেন্টের জন্য সংরক্ষিত উপকারভোগী নির্বাচন করুন।'
                        : 'This TIN is already selected or saved. Select the saved beneficiary entry for this payment.');
                    else setOneTimeLookupError('');
                  }}
                  onClear={() => { setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError(''); }}
                  canSearch={/^\d{12}$/.test(oneTimeTinDraft)} maxTinLength={12}
                  heading={language === 'bn' ? 'করদাতার টিআইএন অনুসন্ধান' : 'Search taxpayer TIN'}
                  searchLabel={language === 'bn' ? 'করদাতার টিআইএন খুঁজুন' : 'Search one-time taxpayer'}
                  hideNameField
                                    className="w-full" />
                {oneTimeLookupError && <p role="alert" className="text-sm text-red-700">{oneTimeLookupError}</p>}
                {oneTimeSearchMatch && <TaxpayerTinSearchResultCard
                  key={oneTimeTinDraft} testId="one-time-taxpayer-preview"
                  language={language} tin={oneTimeTinDraft}
                  name={language === 'bn' ? oneTimeSearchMatch.nameBn : oneTimeSearchMatch.nameEn}
                  classification={entityTypeForTin(oneTimeTinDraft) === 'COMPANY'
                    ? (language === 'bn' ? 'কোম্পানি' : 'Company')
                    : entityTypeForTin(oneTimeTinDraft) === 'NON_COMPANY'
                      ? (language === 'bn' ? 'ব্যক্তি' : 'Individual') : undefined}
                  canAdd={Boolean(availableSavedTins && paymentOwnerId && !oneTimeLookupError &&
                    oneTimeSearchMatch.tin === oneTimeTinDraft && !beneficiaryChecking &&
                    !availableSavedTins.includes(oneTimeTinDraft) &&
                    !savedBatchTaxpayers.some(person => person.tin === oneTimeTinDraft))}
                  addLabel={language === 'bn' ? 'এই পেমেন্টে যোগ করুন' : 'Add to this payment'}
                  onAdd={() => {
                    if (!oneTimeSearchMatch || oneTimeSearchMatch.tin !== oneTimeTinDraft) return;
                    if (!availableSavedTins || availableSavedTins.includes(oneTimeTinDraft) ||
                      savedBatchTaxpayers.some(person => person.tin === oneTimeTinDraft)) {
                      setOneTimeLookupError(language === 'bn'
                        ? 'এই টিআইএনটি ইতিমধ্যে নির্বাচিত বা সংরক্ষিত। পেমেন্টের জন্য সংরক্ষিত উপকারভোগী নির্বাচন করুন।'
                        : 'This TIN is already selected or saved. Select the saved beneficiary entry for this payment.');
                      return;
                    }
                    setOneTimeTaxpayer({ id: crypto.randomUUID(), tin: oneTimeSearchMatch.tin, name: oneTimeSearchMatch.nameEn });
                    if(paymentOwnerId)setOneTimeRecipient({ownerId:paymentOwnerId,tin:oneTimeSearchMatch.tin,
                      nameEn:oneTimeSearchMatch.nameEn,nameBn:oneTimeSearchMatch.nameBn});
                    setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError('');
                  }}
                />}
              </>}
            </section>}

            {signedInBeneficiarySelection && isFieldInvalid('tin') &&
              <p className="text-sm text-red-700" role="alert">{errorMessage}</p>}
            {selfLiabilityHasAdditionalRecipients && <p role="alert" data-testid="self-liability-extra-taxpayer-warning"
               className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
               {language === 'bn'
                 ? 'এই সংরক্ষিত পেমেন্টে অন্য করদাতার তথ্য আছে। তথ্য না হারিয়ে এগোতে ফিরে গিয়ে অন্য করদাতার কর পরিশোধ নির্বাচন করুন।'
                 : 'This saved payment contains other taxpayers. Go back and choose Facilitate another taxpayer’s payment to keep their allocations.'}
             </p>}
             {simpleOwnOtherTax && renderOtherTaxTaxpayerList(true)}
            <div className="payment-identity__fields">
              {ownAccountTax && <SignedInTaxpayerCard profile={ownProfile} language={language} id="signed-in-account-taxpayer-card" />}
              {/* Self-liability uses the signed-in taxpayer only. Saved beneficiary controls belong to the OTHER payer route. */}
              {!ownAccountTax && <>
              {!signedInAccount && (!otherBatch || ownAccountTax) &&
                <TaxpayerTinLookup directDigitEdit language={language} className="payment-identity__tin" card
                  tinId="guest-tin" nameId="guest-taxpayer-name"
                  tin={taxpayerTin} hideNameField={tinLookupState !== 'missing'}
                  name={sampleTaxpayer ? (language === 'bn' ? sampleTaxpayer.nameBn : sampleTaxpayer.nameEn) : ownAccountTax ? accountName : ''}
                  tinLabel={isWithholdingMode ? (language === 'bn' ? 'উইথহোল্ডিং এজেন্টের টিআইএন' : 'Withholding agent’s TIN') : undefined}
                  maxTinLength={ownAccountTax || allowSyntheticDemoTin ? 13 : 12}
                  tinPlaceholder={allowSyntheticDemoTin ? (language === 'bn' ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN') : language === 'bn' ? '১২ সংখ্যার টিআইএন লিখুন' : 'Enter the 12-digit TIN'}
                  readonlyTin={ownAccountTax} canSearch={/^\d{12,13}$/.test(taxpayerTin)}
                  invalidTin={isFieldInvalid('tin')} tinDescribedBy={errorDescription('tin')}
                  onTinChange={value => {
                    clearReferenceSelection(); setLastSearchedTin(null); setOtherTaxpayerName('');
                    setAuthorizedTaxpayerId(null);
                    setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>additionalTaxpayers.some(person=>person.tin===knownTin))));
                    setTin(value);
                  }}
                  onClear={() => {
                    clearReferenceSelection(); setLastSearchedTin(null); setOtherTaxpayerName('');
                    setAuthorizedTaxpayerId(null);
                    setAuthorizedTaxpayerIds(current=>Object.fromEntries(Object.entries(current).filter(([knownTin])=>additionalTaxpayers.some(person=>person.tin===knownTin))));
                    setTin('');
                  }}
                  onSearch={searchTin}
                  error={fieldError('tin')} status={taxpayerLookupResult} />}

              </>}
              {!unifiedFlow && payerReceiptFields}
            </div>
            {!unifiedFlow && ownAccountTax && !isWithholdingMode && receiptEmailControl}
            </PaymentFormSection>}
            {otherBatch && !ownAccountTax && !signedInAccount && !simpleOwnOtherTax && <PaymentFormSection number={3} staticView={embedded}
              title={language === 'bn' ? 'করদাতারা' : 'Taxpayers'}>
              {renderOtherTaxTaxpayerList(false)}
            </PaymentFormSection>}
            {unifiedFlow && otherBatch && batchTaxpayers.some(person => person.tin) && (
              <section className="payment-form-section payment-form-section--static" aria-label={language === 'bn' ? 'করদাতার আয়করের ধরন' : 'Taxpayer income tax types'}>
                <div className="payment-form-section__body">
                  <h3 className="text-sm font-semibold text-taxpay-dark mb-2">{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'}</h3>
                  <div className="space-y-3">
                    {batchTaxpayers.filter(person => person.tin).map((person, index) => (
                      <div key={person.id} className="rounded-lg border border-taxpay-border p-3">
                        <label htmlFor={`tax-type-${person.id}`} className="block text-sm font-medium text-taxpay-dark mb-2">
                          {person.name || (language === 'bn' ? `করদাতা ${index + 1}` : `Taxpayer ${index + 1}`)}
                          <span className="block text-xs font-normal text-taxpay-muted">{language === 'bn' ? 'আয়করের ধরন' : 'Income tax type'} *</span>
                        </label>
                        <select id={`tax-type-${person.id}`} value={entityTypeForTin(person.tin) ?? ''}
                          onChange={event => {
                            const next = event.target.value as IncomeTaxEntityType;
                            setTaxpayerEntityOverrides(previous => ({...previous, [person.tin]: next}));
                            if (isFieldInvalid('incomeTaxType')) clearValidationError();
                          }}
                          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 py-2 text-sm text-taxpay-dark">
                          <option value="" disabled>{language === 'bn' ? 'ধরন নির্বাচন করুন' : 'Select income tax type'}</option>
                          <option value="NON_COMPANY">{incomeTaxEntityTypeLabel('NON_COMPANY', language)}</option>
                          <option value="COMPANY">{incomeTaxEntityTypeLabel('COMPANY', language)}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  {isFieldInvalid('incomeTaxType') && fieldError('incomeTaxType')}
                </div>
              </section>
            )}

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
        ))}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {step === 2 && (otherBatch ? (
          <>
          <OtherTaxBatchComposer language={language} taxpayers={batchTaxpayers} summary={inlinePaymentCalculation} serviceSelection={undefined} unifiedV3={unifiedFlow} allowMixedReturn={unifiedFlow} showFrequentCategories={withAccount && signedInAccount} maskTaxpayerTin={unifiedFlow} remarks={unifiedFlow ? undefined : paymentRemarksControl}
            lines={otherTaxLines} suggestionTaxpayerIds={ownAccountTax ? { primary: demoConsentActor } : undefined}
            preserveSourcePaymentAmounts={Boolean(sourcePaymentId)} focusRequest={summaryJump}
            originalFacilitation={!unifiedFlow && forSelf === false}
            onFocusLine={!unifiedFlow && forSelf === false ? setActiveCalculationLineId : undefined} onChange={next => {
              setOtherTaxLines(next);
              // Keep the invalid-row indicators visible until every selected
              // head is corrected, instead of hiding them after the first edit.
              if (isFieldInvalid('headId')) {
                const sum = otherTaxAllocationTotal(next);
                const unique = new Set(next.map(line => `${line.taxpayerId}:${line.headId}:${line.assessmentYear}`)).size === next.length;
                const allValid = unique && next.length > 0 && sum !== null && sum > 0 &&
                  next.every(line => (isOtherTaxHeadEligible(line.headId) || (unifiedFlow && line.headId === RETURN_HEAD_ID)) &&
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
            {unifiedFlow && !otherBatch && unifiedServiceChoice}
            <PaymentFormSection number={3} staticView={embedded} title={language === 'bn' ? 'পরিশোধের উদ্দেশ্য' : 'Payment purpose'} description={embedded && category === 'TAX_WITH_RETURN' ? (language === 'bn' ? 'আয়করের ধরন নির্বাচন করুন' : 'Choose the income tax type') : (language === 'bn' ? 'করদাতার ধরন ও প্রযোজ্য পেমেন্ট খাত নির্বাচন করুন' : 'Choose the taxpayer type and applicable payment head')}>
            {verifiedReference && <p className="text-xs text-slate-600" role="status">{language === 'bn' ? `NBR রেফারেন্স ${verifiedReference.reference} থেকে করবর্ষ ও পরিমাণ পূরণ করা হয়েছে।` : `Assessment year and amount filled from NBR reference ${verifiedReference.reference}.`}</p>}
            {!isWithholdingMode && !unifiedFlow && <fieldset className="payment-form-radio-fieldset">
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
                  if (newCat !== 'OTHER_TAX_PAYMENT' && oneTimeTaxpayer) {
                    setOtherTaxLines(lines => lines.filter(line => line.taxpayerId !== oneTimeTaxpayer.id));
                    setOneTimeTaxpayer(null); setOneTimeRecipient(null); setOneTimeTinDraft(''); setOneTimeSearchedTin(null); setOneTimeLookupError('');
                  }
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
                <select id="guest-assessment-year" required disabled={!!verifiedReference} value={assessmentYear}
                  aria-invalid={isFieldInvalid('assessmentYear') || undefined}
                  aria-describedby={errorDescription('assessmentYear')}
                  onChange={event => {
                  setAssessmentYear(event.target.value);
                  if (isFieldInvalid('assessmentYear')) clearValidationError();
                  // A User1 amount belongs to its assessment year, not every year.
                  if (suggestionUserId === 'user1') setAmountInputs({});
                }} className="min-h-11 w-full px-3 py-2 rounded border border-slate-300">
                  <option value="" disabled>{language==='bn'?'করবর্ষ নির্বাচন করুন':'Select assessment year'}</option>
                  {[...RETURN_YEARS].reverse().map(year => <option value={year} key={year}>{year}</option>)}
                </select>
                {fieldError('assessmentYear')}
              </div>
            </div>
            <div className="payment-head-amount-grid">
            {selectedHeads.map((head, index) => <div className={`payment-head-amount${selectedHeads.length > 1 ? ' payment-head-amount--multi' : ''}`} data-columns={amountRowColumns[index]} key={head.id}>
              <div className="payment-head-amount__control">
              <div className="mb-1 flex items-center gap-1">
                <label htmlFor={index === 0 ? 'guest-tax-amount' : `guest-tax-amount-${head.id}`} className="text-slate-600 font-medium">{language === 'bn' ? 'পরিশোধের পরিমাণ (৳)' : 'Payment amount (৳)'} *</label>
                {suggestedAmount && amountRawForHead(head.id) === suggestedAmount.amount &&
                  <SuggestedAmountInfo suggestion={suggestedAmount} language={language} controlId={`guest-tax-amount-${head.id}`} />}
              </div>
              <input id={index === 0 ? 'guest-tax-amount' : `guest-tax-amount-${head.id}`} type="text" inputMode="decimal" required readOnly={!!verifiedReference} autoComplete="off" maxLength={17}
                placeholder="0.00" aria-invalid={isFieldInvalid('taxAmount') && errorHeadId === head.id || undefined} aria-describedby={isFieldInvalid('taxAmount') && errorHeadId === head.id ? `${ERROR_ID}-taxAmount` : undefined}
                value={amountRawForHead(head.id)} onChange={event => {
                  const next = normalizeGuestAmountInput(event.target.value);
                  if (next === null) return;
                  setAmountInputs(previous => ({ ...previous, [head.id]: next }));
                  if (errorHeadId === head.id) clearValidationError();
                }}
                className="min-h-11 w-full px-3 py-2 rounded border border-slate-300 font-mono-plex" />
              {isFieldInvalid('taxAmount') && errorHeadId === head.id && fieldError('taxAmount')}
              </div>
              {selectedHeads.length > 1 && <p className="payment-head-amount__label">{head.economicCode} — {language === 'bn' ? head.nameBn : head.nameEn}</p>}
            </div>)}
            </div>
            {isFieldInvalid('taxAmount') && errorHeadId === null && fieldError('taxAmount')}
            </PaymentFormSection>
            {!unifiedFlow && paymentRemarksControl}

            {!embedded && <div className="flex flex-wrap justify-between gap-2 pt-3">
              <button
                onClick={() => setStep(1)}
                className="min-h-11 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{commonCopy.btnBack}</span>
              </button>
              {backendConfigured && !signedInAccount && (
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
        {step === 3 && (!unifiedFlow || !unifiedCheckout) && (
          <div className={unifiedFlow ? "payment-review payment-review--unified-v5" : "payment-review"} data-testid="payment-review">
            <div className="payment-review__main">
              {unifiedFlow && <PaymentReviewDetails language={language} actions={<div className="unified-v3-review__actions">
                    <button type="button" aria-label={language === 'bn' ? 'করদাতা সম্পাদনা' : 'Edit taxpayers'} onClick={() => setStep(1)}>
                      <Pencil size={14} aria-hidden="true"/>{language === 'bn' ? 'করদাতা' : 'Taxpayers'}
                    </button>
                    <button type="button" aria-label={language === 'bn' ? 'খাত ও পরিমাণ সম্পাদনা' : 'Edit heads & amounts'} onClick={() => setStep(2)}>
                      <Pencil size={14} aria-hidden="true"/>{language === 'bn' ? 'খাত ও পরিমাণ' : 'Heads & amounts'}
                    </button>
                  </div>}>
                <div className="unified-v3-review__table-wrap">
                  <table className="unified-v3-review__table">
                    <thead><tr>
                      <th>{language === 'bn' ? 'করদাতা / খাত' : 'Taxpayer / Payment head'}</th>
                      <th>{language === 'bn' ? 'করবর্ষ' : 'Assessment year'}</th>
                      <th>{language === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                    </tr></thead>
                    <tbody>{batchTaxpayers.filter(person => Boolean(person.tin)).map(person => (
                      <React.Fragment key={person.id}>
                        <tr className="unified-v3-review__owner"><td colSpan={3}>
                          <strong>{person.name || otherTaxpayerName} · {entityTypeForTin(person.tin) === 'COMPANY'
                            ? (language === 'bn' ? 'কোম্পানি' : 'Company')
                            : entityTypeForTin(person.tin) === 'NON_COMPANY'
                              ? (language === 'bn' ? 'ব্যক্তি' : 'Individual')
                              : (language === 'bn' ? 'যাচাই হয়নি' : 'Unverified')}</strong>
                          <span>{person.tin.slice(0,3) + '*'.repeat(Math.max(0, person.tin.length - 3))}</span>
                        </td></tr>
                        {otherBatch ? otherTaxLines.filter(line => line.taxpayerId === person.id).map(line => (
                          <tr key={line.id}><td>{line.headId === RETURN_HEAD_ID
                              ? (language === 'bn' ? 'রিটার্নসহ কর' : 'Tax with Return')
                              : language === 'bn' ? otherTaxAllocationHead(line.headId)?.nameBn : otherTaxAllocationHead(line.headId)?.nameEn}</td><td data-year-prefix={language === 'bn' ? 'করবর্ষ ' : 'AY '}>{line.assessmentYear}</td><td>{formatCurrency(parseGuestAmount(line.amount) ?? 0, language)}</td></tr>
                        )) : <tr><td>{language === 'bn' ? 'রিটার্নসহ কর' : 'Tax with Return'}</td><td data-year-prefix={language === 'bn' ? 'করবর্ষ ' : 'AY '}>{assessmentYear}</td><td>{formatCurrency(summedAmount ?? 0, language)}</td></tr>}
                      </React.Fragment>
                    ))}</tbody>
                  </table>
                </div>
                <PaymentReviewTotal language={language} amount={totalAmount} formatted={formatCurrency(totalAmount, language)}/>
              </PaymentReviewDetails>}
              {unifiedFlow && <PaymentPayerDetails language={language} extra={ownAccountTax && !isWithholdingMode && receiptEmailControl}>{payerReceiptFields}</PaymentPayerDetails>}
              {!unifiedFlow && <section className="payment-review__panel" aria-labelledby="guest-payment-channel-title">
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
                  {language === 'bn' ? 'নির্বাচিত সব করদাতা ও খাতের জন্য একটি সম্মিলিত সিমুলেশন পেমেন্ট রেকর্ড ও রসিদ তৈরি হবে।' :
                    'One combined simulated payment record and receipt will cover all selected taxpayers and heads.'}
                </p>}
                {!unifiedFlow && paymentRemarks !== '' && (
                  <div className="mb-3 rounded-lg border border-taxpay-border p-3 text-sm" data-testid="payment-review-remarks">
                    <strong className="text-taxpay-dark">{copy.remarks}</strong>
                    <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{paymentRemarks}</p>
                  </div>
                )}
                <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
                  onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
                  onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
                  onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
                  simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline} />
                {paymentChannel && paymentMethod && <label className="payment-review__ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>{category === 'SOURCE_TAX_DEPOSIT' ? (language === 'bn' ? 'এজেন্টের টিআইএন, কর্তনের খাত, করবর্ষ ও পরিমাণ যাচাই করেছি। কর্তিত করদাতারা eTDS-এ বরাদ্দের পর ক্রেডিট পাবেন।' : 'I confirm the agent TIN, deduction head, year and amount. Deductee credit follows eTDS allocation.') : otherBatch ? (language === 'bn' ? 'প্রতিটি করদাতার টিআইএন, সংশ্লিষ্ট খাত, করবর্ষ ও পরিমাণ যাচাই করেছি।' : 'I confirm each taxpayer TIN and the assigned payment heads, assessment years and amounts.') : (language === 'bn' ? 'টিআইএন, খাত, আয়করের ধরন, করবর্ষ ও মোট পরিমাণ যাচাই করেছি। ক্রেডিট করদাতার হিসাবে যাবে।' : 'I confirm the TIN, payment head, income tax type, assessment year and total. Credit goes to the taxpayer.')}</span></label>}
              </section>}
              {unifiedFlow && paymentRemarksControl}
            </div>
            {!unifiedFlow && <aside className="payment-review__aside" aria-label={language === 'bn' ? 'পেমেন্টের মোট পরিমাণ' : 'Payment total'}>
              {inlinePaymentCalculation}
            </aside>}
            {!embedded && <div className="payment-review__standalone-actions">
              <button type="button" className="payment-review__back" onClick={() => setStep(2)}><ArrowLeft size={17} />{commonCopy.btnBack}</button>
              <button type="button" className="payment-review__pay" onClick={unifiedFlow ? openUnifiedCheckout : handleExecutePayment} disabled={batchRecoveryError || isProcessing || !storyAmountSupported || (otherBatch && !batchValid) || (Boolean(initialReuse && !otherBatch) && !OTHER_TAX_YEARS.some(year => year === assessmentYear)) || (!unifiedFlow && (!paymentChannel || !paymentMethod || !acknowledged))}>{paymentChannel === 'OTC'
                ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip')
                : unifiedFlow
                  ? (language === 'bn' ? 'পেমেন্ট করুন' : 'Make Payment')
                  : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}<ArrowRight size={17} /></button>
            </div>}
          </div>
        )}
        {step === 3 && unifiedFlow && unifiedCheckout && (
          <PaymentChannelScreen language={language} actions={!embedded && <div className="payment-review__standalone-actions">
                <button type="button" className="payment-review__back" onClick={backToUnifiedPreview}>
                  <ArrowLeft size={17}/>{language === 'bn' ? 'চূড়ান্ত পর্যালোচনায় ফিরুন' : 'Back to Final Preview'}
                </button>
                <button type="button" className="payment-review__pay" onClick={handleExecutePayment}
                  disabled={batchRecoveryError || isProcessing || !paymentChannel || !paymentMethod || !acknowledged || !storyAmountSupported || (otherBatch && !batchValid)}>
                  {paymentChannel === 'OTC' ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip')
                    : (language === 'bn' ? 'পরিশোধ নিশ্চিত করুন' : 'Confirm payment')}<ArrowRight size={17}/>
                </button>
              </div>}>
                {batchRecoveryError && <p role="alert" className="mb-3 text-sm text-taxpay-error">
                  {language === 'bn' ? 'সংরক্ষিত পেমেন্ট অনুরোধ পাওয়া যায়নি। আবার চেষ্টা করুন।' : 'Saved payment request is unavailable. Please retry.'}
                </p>}
                {!batchRecoveryError && errorMessage && <p role="alert" className="mb-3 text-sm text-taxpay-error">{errorMessage}</p>}
                <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
                  onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
                  onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
                  onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
                  simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline} />
                {paymentChannel && paymentMethod && <label className="payment-review__ack">
                  <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
                  <span>{language === 'bn' ? 'করদাতা, খাত, করবর্ষ ও মোট পরিমাণ যাচাই করেছি।' : 'I have checked the taxpayers, payment heads, assessment years and total amount.'}</span>
                </label>}
          </PaymentChannelScreen>
        )}
      </div>
      {embedded && modalFooterTarget && createPortal(
        <div className="payment-flow-embedded__footer-actions">
          {mobilePaymentFooter && (unifiedFlow ? step === 2 : step <= 3) && (
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
              {!unifiedFlow && <button type="button" className="tax-service-choice__cancel" onClick={onBackToService}>
                <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
              </button>}
              {(signedInAccount || unsignedGuestDrafts) && isPaymentDraftService(category) &&
                <div className="payment-flow-embedded__draft-actions" ref={setDraftFooterTarget} />}
              <button type="button" className="tax-service-choice__continue" aria-label={unifiedFlow ? (language === 'bn' ? 'পেমেন্ট খাতে এগিয়ে যান' : 'Continue to Payment Head') : (language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount')} onClick={handleStep1Next} disabled={!canContinueStep1}>
                <span className="payment-flow-embedded__action-long">{unifiedFlow ? (language === 'bn' ? 'পেমেন্ট খাতে এগিয়ে যান' : 'Continue to Payment Head') : (language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount')}</span><span className="payment-flow-embedded__action-short" aria-hidden="true">{language === 'bn' ? 'পরিমাণ' : 'Amount'}</span><ArrowRight size={18} aria-hidden="true" />
              </button>
            </>
          ) : step === 2 ? (<>
            {!unifiedFlow && <button type="button" className="tax-service-choice__cancel" onClick={() => { clearValidationError(); setStep(1); }}>
              <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
            </button>}
            {(signedInAccount || unsignedGuestDrafts) && isPaymentDraftService(category) &&
              <div className="payment-flow-embedded__draft-actions" ref={setDraftFooterTarget} />}
            <button type="button" className="tax-service-choice__continue" aria-label={unifiedFlow ? (language === 'bn' ? 'চূড়ান্ত পর্যালোচনায় যান' : 'Continue to Final Preview') : (language === 'bn' ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel')} onClick={handleStep2Next} disabled={!initialReuse && otherBatch && (!batchValid || !storyAmountSupported)}>
              <span className="payment-flow-embedded__action-long">{unifiedFlow ? (language === 'bn' ? 'চূড়ান্ত পর্যালোচনায় যান' : 'Continue to Final Preview') : (language === 'bn' ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel')}</span><span className="payment-flow-embedded__action-short" aria-hidden="true">{unifiedFlow ? (language === 'bn' ? 'পর্যালোচনা' : 'Preview') : (language === 'bn' ? 'চ্যানেল' : 'Channel')}</span><ArrowRight size={18} aria-hidden="true" />
            </button>
          </>) : step === 3 ? (<>
            {!unifiedFlow && <button type="button" className="tax-service-choice__cancel"
              onClick={() => setStep(2)} disabled={isProcessing}>
              <ArrowLeft size={17} aria-hidden="true" />{commonCopy.btnBack}
            </button>}
            <button type="button" className="tax-service-choice__continue"
              onClick={unifiedFlow && !unifiedCheckout ? openUnifiedCheckout : handleExecutePayment}
              disabled={batchRecoveryError || isProcessing || !storyAmountSupported || (otherBatch && !batchValid) ||
                (Boolean(initialReuse && !otherBatch) && !OTHER_TAX_YEARS.some(year => year === assessmentYear)) ||
                ((!unifiedFlow || unifiedCheckout) && (!paymentChannel || !paymentMethod || !acknowledged))}
              aria-busy={isProcessing}>
              {unifiedFlow && !unifiedCheckout
                ? <>{language === 'bn' ? 'পেমেন্ট করুন' : 'Make Payment'} <ArrowRight size={18} aria-hidden="true"/></>
                : <>{paymentChannel === 'OTC' ? <FileText size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}
                  {paymentChannel === 'OTC'
                    ? (language === 'bn' ? 'পেমেন্ট-স্লিপ নিন' : 'Get payment slip')
                    : unifiedFlow ? (language === 'bn' ? 'পরিশোধ নিশ্চিত করুন' : 'Confirm payment')
                    : (language === 'bn' ? `${formatCurrency(totalAmount, language)} পরিশোধ করুন` : `Pay ${formatCurrency(totalAmount, language)}`)}</>}
            </button>
          </>) : null}
        </div>, modalFooterTarget
      )}
    </div>
  );
};
