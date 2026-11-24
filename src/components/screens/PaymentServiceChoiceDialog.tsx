import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import '../../styles/taxpay-unified-table.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarClock, Check, CircleAlert, ClipboardCheck, FileCheck2, FolderOpen,
  Plane, ReceiptText, Scale, Trash2, UserRound, UsersRound, WalletCards
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import type { BannerPaymentService } from '../../services/taxState';
import { TaxPayModal, type PaymentDraftExitAction } from '../ui/TaxPayModal';
import { WalkInDiscardConfirmation } from '../ui/WalkInDiscardConfirmation';
import { GuestPayment } from './GuestPayment';
import { TravelTax } from './TravelTax';
import {travelTaxModalTitle,travelTaxModalStages} from './travelTaxModalContract';
import { TaxpayerLoginDialog, TaxpayerLoginFooter } from './TaxpayerLoginDialog';
import { useAccountIdentity } from '../../services/accountIdentity';
import {recordAccountActivity} from '../../services/accountActivity';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';
import type {PaymentReuse} from '../../services/paymentReuse';
import { PaymentDraftEntryGate } from './PaymentDraftEntryGate';
import { paymentDraftOwnerScope, type PaymentFormDraft, type PaymentDraftActor } from '../../services/accountPaymentFormDrafts';
import { taxpayerBrandName } from '../../config/brand';

/** The seven income-tax categories and separate travel-tax service in the NBR v11 HTML. */
export const PAYMENT_SERVICE_CHOICES = [
  { id: 'TAX_WITH_RETURN', Icon: FileCheck2, en: 'Tax with Return', bn: 'রিটার্নসহ কর', detailEn: 'Tax paid with the annual income tax return.', detailBn: 'বার্ষিক আয়কর রিটার্নের সাথে পরিশোধ করা কর।' },
  { id: 'ADVANCE_TAX', Icon: CalendarClock, en: 'Advance Tax', bn: 'অগ্রিম কর', detailEn: 'Instalments paid during the income year.', detailBn: 'আয়বর্ষে কিস্তিতে অগ্রিম কর পরিশোধ।' },
  { id: 'ASSESSED_DEMAND', Icon: ClipboardCheck, en: 'Assessed Demand', bn: 'নির্ধারিত দাবি', detailEn: 'Payment against an assessed demand.', detailBn: 'নির্ধারিত কর দাবির বিপরীতে পরিশোধ।' },
  { id: 'PENALTY', Icon: CircleAlert, en: 'Penalty', bn: 'জরিমানা', detailEn: 'Payment against an imposed penalty.', detailBn: 'আরোপিত জরিমানার বিপরীতে পরিশোধ।' },
  { id: 'SOURCE_TAX_DEPOSIT', Icon: ReceiptText, en: 'Source Tax Deposit', bn: 'উৎসে কর জমা', detailEn: 'Deposit TDS/TCS as a withholding agent.', detailBn: 'উৎসে কর্তন বা সংগ্রহকৃত কর জমা।' },
  { id: 'APPELLATE_TRIBUNAL', Icon: Scale, en: 'Appellate Tribunal', bn: 'আপিল ট্রাইব্যুনাল', detailEn: 'Payment under the Tribunal payment head.', detailBn: 'আপিল ট্রাইব্যুনাল সংক্রান্ত কর পরিশোধ।' },
  { id: 'OTHER_TAX_PAYMENT', Icon: WalletCards, en: 'Other Tax Payment', bn: 'অন্যান্য কর পরিশোধ', detailEn: 'Payment with a reference to a defined tax head.', detailBn: 'নির্ধারিত কর খাতের রেফারেন্স অনুযায়ী পরিশোধ।' },
  { id: 'TRAVEL_TAX', Icon: Plane, en: 'Travel Tax', bn: 'ভ্রমণ কর', detailEn: 'Tax based on journey and passenger details.', detailBn: 'যাত্রা ও যাত্রীর তথ্য অনুযায়ী ভ্রমণ কর।' }
] as const;

type ServiceId = typeof PAYMENT_SERVICE_CHOICES[number]['id'];
type TopLevelService = 'TAX_WITH_RETURN' | 'OTHER_TAX';

/** Only two services appear at entry. The original service IDs stay intact underneath. */
export const TAXPAY_ENTRY_CHOICES = [
  { id: 'TAX_WITH_RETURN', Icon: FileCheck2, en: 'Tax with Return', bn: 'রিটার্নসহ কর', detailEn: 'Section 173', detailBn: 'ধারা ১৭৩' },
  { id: 'OTHER_TAX', Icon: WalletCards, en: 'Other Tax', bn: 'অন্যান্য কর', detailEn: 'Other tax payments.', detailBn: 'অন্যান্য কর পরিশোধ।' }
] as const;

export function PaymentServiceChoiceDialog({ initialService = null, initialDraft: suppliedInitialDraft = null, initialReuse = null, unifiedEntryRequested = false, onDismiss, onPublicOtherTaxContinue }: { initialService?: BannerPaymentService | null; initialDraft?: PaymentFormDraft | null; initialReuse?: PaymentReuse | null; unifiedEntryRequested?: boolean; onDismiss?: () => void; onPublicOtherTaxContinue?: () => void }) {
  const { language, navigate, setPaymentServiceChoiceOpen, previewAccount, paymentBeneficiaryPrefill, beneficiaryResumeDraft, startBeneficiaryPaymentManagement } = useTaxState();
  const initialDraft=suppliedInitialDraft??beneficiaryResumeDraft;
  const { user: verifiedUser, loading: accountLoading } = useAccountIdentity();
  const multiBeneficiaryPrefill = (paymentBeneficiaryPrefill?.additional?.length ?? 0) > 0;
  // A reviewed parallel selection can skip the redundant payer/service chooser,
  // but GuestPayment still enforces its own contact, consent, and SQL gates.
  const parallelEntry = Boolean(paymentBeneficiaryPrefill?.parallelSource && paymentBeneficiaryPrefill.parallelAllocations?.length);
  // A Travel Tax shortcut enters the existing passenger journey directly.
  const directTravelEntry = initialService === 'TRAVEL_TAX' && !initialDraft && !initialReuse;
  const [payerForSelf, setPayerForSelf] = useState<boolean | null>(initialDraft ? (initialDraft.service === 'TRAVEL_TAX' ? true : initialDraft.form_payload.forSelf as boolean) : initialReuse ? initialReuse.formPayload.forSelf as boolean : paymentBeneficiaryPrefill ? (paymentBeneficiaryPrefill.parallelSource ? Boolean(paymentBeneficiaryPrefill.parallelForSelf) : false) : null);
  const [topLevel, setTopLevel] = useState<TopLevelService | null>(initialDraft ? (initialDraft.service === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : initialReuse ? (initialReuse.service === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : paymentBeneficiaryPrefill ? 'OTHER_TAX' : initialService ? (initialService === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : unifiedEntryRequested ? 'OTHER_TAX' : null);
  // Other Tax is one entry choice. No follow-up subtype selection is collected here.
  const selected: ServiceId | null = topLevel === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : topLevel === 'OTHER_TAX' ? (initialService && initialService !== 'TAX_WITH_RETURN' ? initialService : 'OTHER_TAX_PAYMENT') : null;
  // Only the new Home "All Tax Payments" entry uses the consolidated three-step flow.
  // Existing drafts, Pay Again, Travel Tax and legacy payment routes retain their stages.
  const genericAccountEntry = Boolean(unifiedEntryRequested && (verifiedUser||previewAccount)&&!initialService&&!initialDraft&&!initialReuse&&!paymentBeneficiaryPrefill&&!onPublicOtherTaxContinue);
  const publicUnifiedEntry = unifiedEntryRequested && !initialService && !initialDraft && !initialReuse && !parallelEntry;
  const initialUnifiedAccount = initialDraft?.form_payload.unifiedFlowVersion===5 || initialReuse?.formPayload.unifiedFlowVersion===5;
  const [view, setView] = useState<'entry' | 'payer' | 'login' | 'payment'>(
    initialDraft || initialReuse || directTravelEntry || parallelEntry ? 'payment' : publicUnifiedEntry && !genericAccountEntry ? 'entry' : 'payer');
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [travelCheckoutOpen, setTravelCheckoutOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [useAccount, setUseAccount] = useState(Boolean(initialDraft || initialReuse || (parallelEntry && (verifiedUser || previewAccount))));
  const [entryAccess, setEntryAccess] = useState<'guest' | 'account' | null>(null);
  // An existing signed-in session must always use the account journey.
  // Only signed-out users need to choose between account sign-in and walk-in.
  const alreadySignedIn = Boolean(verifiedUser || previewAccount);
  const selectedAccess = alreadySignedIn ? 'account' : (entryAccess ?? (paymentBeneficiaryPrefill ? 'guest' : null));
  const [draftToResume, setDraftToResume] = useState<PaymentFormDraft | null>(initialDraft);
  const unifiedDraftService=(service:string)=>service==='OTHER_TAX_PAYMENT'||service==='TAX_WITH_RETURN';
  const unifiedEntry = draftToResume ? unifiedDraftService(draftToResume.service) && draftToResume.form_payload.unifiedFlowVersion===5 : initialReuse ? unifiedDraftService(initialReuse.service)&&initialUnifiedAccount : publicUnifiedEntry||genericAccountEntry||initialUnifiedAccount;
  // All signed-out Walk-in payment journeys share the ONE two-action exit;
  // account-owned payments retain the separate Save Draft policy.
  const isWalkInPayment = view === 'payment' && !useAccount && !alreadySignedIn;
  // Back from taxpayer details returns to payer choices without losing
  // the route back to the signed-in user's original saved-draft decision.
  const [draftEntryCompleted, setDraftEntryCompleted] = useState(Boolean(initialDraft || initialReuse));
  const [enteredFromDraftChoice, setEnteredFromDraftChoice] = useState(false);
  const [draftEntryMode, setDraftEntryMode] = useState<'choice' | 'list' | 'new'>('choice');
  const changeDraftEntryMode = useCallback((next: 'choice' | 'list' | 'new') => {
    if (next === 'new') setEnteredFromDraftChoice(true);
    setDraftEntryMode(next);
  }, []);
  const [draftEntryBlocking, setDraftEntryBlocking] = useState(Boolean(verifiedUser || previewAccount));
  const draftActor: PaymentDraftActor | null = verifiedUser
    ? { kind: 'authenticated', userId: verifiedUser.id }
    : previewAccount ? { kind: 'preview', profileId: previewAccount.id } : null;
  // A preview profile ID is not a session. Reuse the same verified
  // owner/capability scope as the draft service, including renewed sign-ins.
  const draftOwnerKey = paymentDraftOwnerScope(draftActor);
  // A signed-in owner can change while the modal remains mounted. Do not keep
  // displaying a previously restored private draft under a different owner.
  // Empty -> account is allowed: public walk-in journeys may sign in here.
  const originalDraftOwnerRef = useRef<string | null>(draftOwnerKey || null);
  if (!originalDraftOwnerRef.current && draftOwnerKey) originalDraftOwnerRef.current = draftOwnerKey;
  const paymentOwnerChanged = Boolean(originalDraftOwnerRef.current &&
    originalDraftOwnerRef.current !== draftOwnerKey);
  useEffect(() => {
    if (paymentOwnerChanged) setPaymentServiceChoiceOpen(false);
  }, [paymentOwnerChanged, setPaymentServiceChoiceOpen]);
  const [loginReady, setLoginReady] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  // Unified Walk-in header Back has a stage-owned handler. No hidden footer
  // button is needed to proxy navigation, and non-unified routes stay intact.
  const unifiedHeaderBackRef = useRef<(() => void) | null>(null);
  const [resultView, setResultView] = useState<'result' | 'receipt' | 'certificate'>('result');
  const travelHeaderBackRef = useRef<(() => void) | null>(null);
  const registerTravelHeaderBack = useCallback((action: (() => void) | null) => {
    travelHeaderBackRef.current = action;
  }, []);
  const registerUnifiedHeaderBack = useCallback((action: (() => void) | null) => {
    unifiedHeaderBackRef.current = action;
  }, []);
  const payerHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const manageAfterClose = useRef<'manage'|'add'|null>(null);
  const backToDraftChoice=useRef(false);
  const close = (draft?:PaymentFormDraft) => {
    const mode=manageAfterClose.current; manageAfterClose.current=null;
    if(backToDraftChoice.current&&!mode){
      backToDraftChoice.current=false;setExitPromptOpen(false);setExitError('');setDraftToResume(null);
      setDraftEntryCompleted(false);setEnteredFromDraftChoice(false);setDraftEntryMode('choice');setDraftEntryBlocking(true);
      setStage(1);setPayerForSelf(null);setTopLevel('OTHER_TAX');setUseAccount(false);setView('payer');return;
    }
    backToDraftChoice.current=false;
    if (onDismiss) onDismiss(); else setPaymentServiceChoiceOpen(false);
    if(mode)startBeneficiaryPaymentManagement(mode,draft);
  };
  const draftExitActionRef = useRef<PaymentDraftExitAction | null>(null);
  const registerDraftExit = useCallback((action: PaymentDraftExitAction | null) => {
    draftExitActionRef.current = action;
  }, []);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [exitError, setExitError] = useState('');
  const exitFirstButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (exitPromptOpen) exitFirstButtonRef.current?.focus();
  }, [exitPromptOpen]);
  const requestClose = () => {
    if (exitSaving) return;
    if (exitPromptOpen) { setExitPromptOpen(false); setExitError(''); manageAfterClose.current=null; backToDraftChoice.current=false; return; }
    if (view === 'payment' && stage !== 4 && (isWalkInPayment || draftExitActionRef.current || (useAccount&&(manageAfterClose.current||backToDraftChoice.current)))) {
      setExitPromptOpen(true);
      setExitError('');
      return;
    }
    close();
  };
  const saveDraftAndClose = async () => {
    if (exitSaving) return;
    const saveDraft = draftExitActionRef.current;
    if (!saveDraft) {
      setExitError(tr('Draft saving is unavailable. Keep editing and try again.', 'খসড়া সংরক্ষণ করা যাচ্ছে না। ফর্মে ফিরে আবার চেষ্টা করুন।'));
      return;
    }
    setExitSaving(true);
    setExitError('');
    try {
      const saved=await saveDraft();
      if(manageAfterClose.current&&!saved)throw new Error(tr('The saved draft could not be confirmed. Keep editing and retry.','খসড়া যাচাই করা যায়নি। সম্পাদনা চালিয়ে গিয়ে আবার চেষ্টা করুন।'));
      close(saved||undefined);
    } catch (cause) {
      setExitError(cause instanceof Error ? cause.message :
        tr('Draft saving failed. Your payment is still open.', 'খসড়া সংরক্ষণ ব্যর্থ হয়েছে। পেমেন্টটি এখনো খোলা আছে।'));
    } finally {
      setExitSaving(false);
    }
  };
  const requestedService = draftToResume?.service ?? initialReuse?.service ?? selected;
  // Gift Tax has a dedicated donor/donee journey; never send its receipt or draft to the generic income-tax composer.
  const effectiveSelected: ServiceId | null = requestedService === 'GIFT_TAX' ? null : requestedService;
  const travelJourney = effectiveSelected === 'TRAVEL_TAX';
  const stages = travelJourney
    ? travelTaxModalStages(language)
    : unifiedEntry
      ? [tr('Taxpayer Information', 'করদাতার তথ্য'), tr('Payment Head', 'কর পরিশোধের খাত'), tr('Final Preview', 'চূড়ান্ত পর্যালোচনা')]
      : [tr('Taxpayer details', 'করদাতার তথ্য'), tr('Purpose & amount', 'খাত ও পরিমাণ'), tr('Payment channel', 'পেমেন্ট চ্যানেল'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const shortStages = travelJourney
    ? [tr('Passenger', 'যাত্রী'), tr('Travel', 'ভ্রমণ'), tr('Preview', 'পর্যালোচনা')]
    : unifiedEntry
      ? [tr('Taxpayer', 'করদাতা'), tr('Heads', 'খাত'), tr('Review', 'পর্যালোচনা')]
      : [tr('Identity', 'পরিচয়'), tr('Amount', 'পরিমাণ'), tr('Channel', 'চ্যানেল'), tr('Done', 'শেষ')];
  const chosenService = PAYMENT_SERVICE_CHOICES.find(choice => choice.id === effectiveSelected);
  const paymentAccess = effectiveSelected ? resolvePaymentServiceAccess(effectiveSelected, 'MAKE_PAYMENT') : null;
  const publicPayment = paymentAccess?.kind === 'PUBLIC';
  const beginPayment = (withAccount: boolean) => {
    if(withAccount&&verifiedUser?.id)
      void recordAccountActivity(verifiedUser.id,'PAYMENT_STARTED','wizard').catch(()=>undefined);
    setDraftToResume(null); setDraftEntryCompleted(true); setUseAccount(withAccount); setStage(1); setCheckoutOpen(false); setView('payment');
  };
  const beginUnifiedPayment = (account: boolean) => {
    // Public Other Tax reuses this exact sign-in/walk-in entry before showing its
    // separate Travel/Gift chooser. Do not start the income-tax composer here.
    if (onPublicOtherTaxContinue) { onPublicOtherTaxContinue(); return; }
    // The new entry collects payment type in Step 2, not at the entry modal.
    // Initialize the existing Other Tax composer so the first step always
    // mounts and preserves the approved taxpayer and checkout contracts.
    setTopLevel('OTHER_TAX');
    setPayerForSelf(account ? null : false);
    setEntryAccess(account ? 'account' : 'guest');
    if (account && publicUnifiedEntry && (view === 'entry' || view === 'login')) {
      // Explicit sign-in enters the same owner-scoped start/resume gate.
      setDraftEntryCompleted(false); setDraftEntryMode('choice');
      setDraftEntryBlocking(true); setView('payer'); return;
    }
    beginPayment(account);
  };
  useEffect(()=>{
    if(genericAccountEntry && view==='payer' && draftEntryMode==='new' && !draftEntryBlocking) beginUnifiedPayment(true);
  },[genericAccountEntry,view,draftEntryMode,draftEntryBlocking]);
  const openLogin = () => { setLoginReady(false); setView('login'); };
  const advanceToPayment = () => {
    if (payerForSelf === null || !selected || (accountLoading && !previewAccount)) return;
    if (!selectedAccess) return;
    if (selectedAccess === 'guest' && publicPayment) { beginPayment(false); return; }
    if (alreadySignedIn) { beginPayment(true); return; }
    openLogin();
  };
  const returnToService = () => {
    if(unifiedEntry && useAccount && stage===1){
      backToDraftChoice.current=genericAccountEntry&&enteredFromDraftChoice;
      requestClose();return;
    }
    setDraftToResume(null);
    setStage(1);
    if(genericAccountEntry){setDraftEntryCompleted(false);setDraftEntryMode('choice');setEnteredFromDraftChoice(false);}
    setView(unifiedEntry && !genericAccountEntry ? 'entry' : 'payer');
  };
  const reportStage = useCallback((next: 1 | 2 | 3 | 4) => setStage(next), []);
  useEffect(() => {
    // Each stage starts at its beginning, even when the previous form was scrolled.
    const scroller = flowRef.current?.closest<HTMLElement>('.taxpay-modal__body');
    if (scroller) scroller.scrollTop = 0;
    if (view === 'payer') payerHeadingRef.current?.focus();
    if (view === 'payment') stepHeadingRef.current?.focus();
  }, [stage, view]);

  // Hide the prior owner's restored form synchronously; the effect above
  // closes the dialog and clears its one-shot draft/resume request.
  if (paymentOwnerChanged) return null;

  return (
    <TaxPayModal
      title={view === 'login' || view === 'entry'
        ? tr(`Sign In To Your ${taxpayerBrandName(language)} Account`, `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন`)
        : view === 'payment' && stage === 4
        ? resultView === 'certificate' ? tr('Payment record certificate', 'পেমেন্ট রেকর্ড সনদ')
          : resultView === 'receipt' ? tr('Challan details', 'চালানের বিবরণ')
          : tr('Payment result', 'পেমেন্টের ফলাফল')
        : view === 'payment' && unifiedEntry && checkoutOpen ? tr('Payment channel', 'পেমেন্ট চ্যানেল')
        : view === 'payment' && travelJourney && stage === 4 ? tr('Payment result','পেমেন্টের ফলাফল')
        : view === 'payment' && travelJourney && travelCheckoutOpen ? tr('Payment channel','পেমেন্ট চ্যানেল')
        : view === 'payment' && travelJourney ? stages[Math.min(stage - 1, stages.length - 1)]
        : view === 'payment' ? stages[Math.min(stage - 1, stages.length - 1)] : tr('Pay Tax', 'কর পরিশোধ')}
      progress={view === 'payment' && !(unifiedEntry && (stage === 4 || checkoutOpen)) && !(travelJourney && (stage === 4 || travelCheckoutOpen)) ? {
        current: stage, total: unifiedEntry || travelJourney ? 3 : 4, label: tr('Steps', 'ধাপ'),
        subtitle: unifiedEntry
          ? (useAccount ? tr('Signed-in Payment', 'সাইন-ইন পেমেন্ট') : tr('Walk-in Payment', 'ওয়াক-ইন পেমেন্ট'))
          : travelJourney ? (useAccount ? tr('Signed-in Payment','সাইন-ইন পেমেন্ট') : tr('Walk-in Payment','ওয়াক-ইন পেমেন্ট'))
          : chosenService && payerForSelf !== null
          ? `${tr(chosenService.en, chosenService.bn)} › ${payerForSelf ? tr('My Tax Liability', 'আমার করদায়') : tr('Facilitate another taxpayer’s payment', 'অন্য করদাতার কর পরিশোধে সহায়তা করুন')}`
          : undefined } : undefined}
      ariaLabel={view === 'login' ? undefined : travelJourney && view === 'payment' ? travelTaxModalTitle(language) : tr('Pay Tax', 'কর পরিশোধ')}
      onClose={requestClose}
      onBackdropClose={() => {
        // A backdrop click never discards draft-eligible payment data.
        if (exitPromptOpen) return;
        // Outside taps should never discard a walk-in payment or interrupt editing.
        if (isWalkInPayment && stage !== 4) return;
        if (view === 'payment' && draftExitActionRef.current) return;
        close();
      }}
      registerDraftExit={registerDraftExit}
      className={view === 'login' || view === 'entry' ? 'taxpayer-login-modal' : (unifiedEntry || travelJourney) && view === 'payment' ? 'taxpay-v5-locked' : ''}
      animateSize={view === 'payer' || view === 'entry'}
      // Draft choice/list/new swap content inside the same payer view.
      // Re-measure the approved modal height on every such transition so the
      // full original payer cards and footer cannot inherit the compact draft height.
      motionKey={`${view}:${view === 'payer' ? `${draftEntryMode}:${draftEntryBlocking ? 'draft' : 'original'}` : stage}`}
      onBack={view === 'payer' && enteredFromDraftChoice && draftActor &&
        !initialService && !paymentBeneficiaryPrefill
        ? () => {
          setEnteredFromDraftChoice(false);
          setDraftEntryCompleted(false);
          setDraftEntryMode('choice');
        }
        : view === 'payer' && draftEntryBlocking && draftEntryMode === 'list'
        ? () => setDraftEntryMode('choice')
        : view === 'login' ? () => setView('payer') : view === 'payment' && (travelJourney || stage !== 4 || resultView !== 'result') ? () => {
        if (travelJourney) {
          if (travelHeaderBackRef.current) travelHeaderBackRef.current();
          else if (stage === 1) (directTravelEntry ? requestClose() : returnToService());
          return;
        }
        if (stage === 4 && resultView !== 'result') {
          unifiedHeaderBackRef.current?.();
          return;
        }
        if (unifiedEntry) {
          // Back from Payment Head, Final Preview and Payment channel is a
          // direct in-memory transition; no footer control must be present.
          if (unifiedHeaderBackRef.current) unifiedHeaderBackRef.current();
          else if (stage === 1) returnToService();
          return;
        }
        const back = document.querySelector<HTMLButtonElement>(
          '.taxpay-modal[data-payment-stage="true"] .payment-flow-embedded__footer-actions .tax-service-choice__cancel, ' +
          '.taxpay-modal[data-payment-stage="true"] .travel-flow__footer-actions .tax-service-choice__cancel'
        );
        if (back && !back.disabled) back.click();
        else if (stage === 1) (directTravelEntry ? requestClose() : returnToService());
      } : undefined}
      backLabel={resultView === 'certificate' && stage === 4 ? tr('Back to receipt', 'রসিদে ফিরুন')
        : resultView === 'receipt' && stage === 4 ? tr('Back to confirmation', 'পেমেন্টের ফলাফলে ফিরুন')
        : tr('Back', 'ফিরুন')}
      hideFooter={view === 'payer' && draftEntryBlocking}
      service={view === 'login' || view === 'entry' ? 'login' : view === 'payment' && effectiveSelected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={travelJourney && view === 'payment' ? tr('Close modal', 'মডাল বন্ধ করুন') : tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={view === 'login'
        ? <TaxpayerLoginFooter formId="taxpay-embedded-login-form" disabled={!loginReady} language={language} />
        : view === 'entry' ? (
          <div className="taxpay-unified-entry__actions">
            {alreadySignedIn ? <button type="button" className="tax-service-choice__continue"
              onClick={() => beginUnifiedPayment(true)}>{tr('Continue with your account', 'আপনার অ্যাকাউন্ট দিয়ে এগিয়ে যান')} <ArrowRight size={18} /></button>
            : <TaxpayerLoginFooter formId="taxpay-embedded-login-form" disabled={!loginReady} language={language} paymentEntryLabel />}
            <div className="taxpay-unified-entry__divider" aria-hidden="true"><span />{tr('OR', 'অথবা')}<span /></div>
            <button type="button" className="taxpay-unified-entry__walkin" onClick={() => beginUnifiedPayment(false)}>
              {tr('Walk-in Payment', 'ওয়াক-ইন পেমেন্ট')} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
        <div className="tax-service-choice__actions">
          {view === 'payer' && !draftEntryBlocking && <button type="button" className="tax-service-choice__continue"
             disabled={payerForSelf === null || !selected || (multiBeneficiaryPrefill && selected !== 'OTHER_TAX_PAYMENT') || (accountLoading && !previewAccount)
               || !selectedAccess}
             onClick={advanceToPayment}>
             {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
           </button>}
        </div>
      )}
    >
      {view === 'payment' && travelJourney ? (
        <TravelTax key={draftToResume ? 'travel-draft-' + draftToResume.id : initialReuse ? 'travel-reuse-' + initialReuse.sourcePaymentId : 'travel-tax-modal'}
          embedded fourStepJourney initialDraft={draftToResume ?? undefined} initialReuse={initialReuse ?? undefined}
          onBackToService={directTravelEntry ? requestClose : returnToService} onStageChange={reportStage}
          registerHeaderBack={registerTravelHeaderBack} onCheckoutChange={setTravelCheckoutOpen} onResultViewChange={setResultView} />
      ) : <section key={view} ref={flowRef} data-view={view}
        data-banner-entry={initialService && view === 'payment' ? 'true' : undefined}
        data-payment-service={view === 'payment' && chosenService ? chosenService.id : undefined}
        className={`tax-service-choice${view === 'payment' && effectiveSelected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
        {view === 'payment' && !checkoutOpen && <>
          <p ref={stepHeadingRef} tabIndex={-1} className="sr-only" aria-label={tr(`Step ${stage} of ${stages.length}: ${stages[Math.min(stage - 1, stages.length - 1)]}`, `ধাপ ${stage} / ${stages.length}: ${stages[Math.min(stage - 1, stages.length - 1)]}`)}>
            {tr(`Step ${Math.min(stage, stages.length)} of ${stages.length}`, `ধাপ ${Math.min(stage, stages.length)} / ${stages.length}`)}
          </p>
          <ol className="tax-service-choice__progress sr-only" aria-label={tr('Payment stages', 'পেমেন্টের ধাপ')}>
            {stages.map((name, index) => {
              return (
              <li key={name} className={index + 1 === stage ? 'tax-service-choice__stage--current' : index + 1 < stage ? 'tax-service-choice__stage--complete' : 'tax-service-choice__stage--upcoming'}
                aria-label={`${index + 1}. ${name}`} data-progress-status={index + 1 < stage ? 'complete' : index + 1 === stage ? 'current' : 'upcoming'}
                aria-current={index + 1 === stage ? 'step' : undefined}>
                <span className="tax-service-choice__stage-number">{index + 1 < stage ? <Check size={16} aria-hidden="true" /> : index + 1}</span>
                <span className="tax-service-choice__stage-label tax-service-choice__stage-label--full" aria-hidden="true">{name}</span>
                <span className="tax-service-choice__stage-label tax-service-choice__stage-label--short" aria-hidden="true">{shortStages[index]}</span>
              </li>
            )})}
          </ol>
        </>}
        {view === 'entry' ? (
          alreadySignedIn
            ? <div className="taxpay-unified-entry__signed-in" role="status">{tr('Continue using your signed-in account, or choose Walk-in Payment.', 'সাইন-ইন করা অ্যাকাউন্ট অথবা ওয়াক-ইন পেমেন্ট বেছে নিন।')}</div>
            : <TaxpayerLoginDialog embedded preservePaymentJourney emailReturnTo="taxpayer_home"
                onClose={requestClose} onValidityChange={setLoginReady} onSuccess={() => beginUnifiedPayment(true)} />
        ) : view === 'payer' ? <PaymentDraftEntryGate
           actor={draftActor} ownerKey={draftOwnerKey}
           mode={draftEntryMode} onModeChange={changeDraftEntryMode} alwaysShowStart={genericAccountEntry}
           enabled={Boolean(!draftEntryCompleted && draftActor && !initialService && !paymentBeneficiaryPrefill)}
           language={language}
           serviceLabel={id => {
             const service = PAYMENT_SERVICE_CHOICES.find(item => item.id === id);
             return service ? tr(service.en, service.bn) : id;
           }}
           onBlockingChange={setDraftEntryBlocking}
           onResume={draft => {
             setTopLevel(draft.service === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX');
             setPayerForSelf(draft.service === 'TRAVEL_TAX' ? true : draft.form_payload.forSelf as boolean);
             setDraftToResume(draft);
             setEnteredFromDraftChoice(true);
             setDraftEntryCompleted(true);
             setUseAccount(true);
             setStage(1);
             setView('payment');
           }}
         >
           <h3 ref={payerHeadingRef} tabIndex={-1} id="tax-service-choice-question" className="tax-service-choice__payer-focus">{tr('Whose tax liability are you settling?', 'আপনি কার করদায় পরিশোধ করছেন?')}</h3>
           <div className="tax-service-choice__grid tax-service-choice__payer-grid" role="group" aria-label={tr('Taxpayer relationship', 'করদাতার সঙ্গে সম্পর্ক')}>
             {[
               { own: true, Icon: UserRound, en: 'My Tax Liability', bn: 'আমার করদায়', detailEn: 'Pay tax for myself.', detailBn: 'নিজের কর পরিশোধ করুন।' },
               { own: false, Icon: UsersRound, en: 'Facilitate another taxpayer’s payment', bn: 'অন্য করদাতার কর পরিশোধে সহায়তা করুন', detailEn: 'Pay on behalf of another taxpayer.', detailBn: 'অন্য করদাতার পক্ষে কর পরিশোধ করুন।' }
             ].map(({ own, Icon, en, bn: bangla, detailEn, detailBn }) => (
               <button type="button" key={String(own)} aria-pressed={payerForSelf === own}
                 data-payer-relationship={own ? 'SELF' : 'OTHER'} className="tax-service-choice__card"
                 onClick={() => setPayerForSelf(own)}>
                 <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
                 <span className="tax-service-choice__copy"><strong>{tr(en, bangla)}</strong><span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span></span>
                 <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
               </button>
             ))}
           </div>
           {payerForSelf !== null && <div className="tax-service-choice__progressive-section" data-entry-section="tax">
             <h3 id="tax-service-type-heading" className="tax-service-choice__entry-heading">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
             <div className="tax-service-choice__grid tax-service-choice__tax-grid" role="group" aria-labelledby="tax-service-type-heading">
               {TAXPAY_ENTRY_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
                 <button type="button" key={id} aria-pressed={topLevel === id} data-payment-entry={id} className="tax-service-choice__card"
                   disabled={multiBeneficiaryPrefill && id !== 'OTHER_TAX'}
                   onClick={() => { if (!multiBeneficiaryPrefill) setTopLevel(id); }}>
                   <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
                   <span className="tax-service-choice__copy"><strong>{tr(en, bangla)}</strong><span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span></span>
                   <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
                 </button>
               ))}
               {multiBeneficiaryPrefill && <p role="status" className="col-span-full rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-taxpay-dark">
                 {tr('Multiple saved taxpayers are selected. Their payment heads and amounts will be allocated separately in Other Tax.','একাধিক সংরক্ষিত করদাতা নির্বাচিত। Other Tax-এ প্রত্যেকের খাত ও পরিমাণ আলাদাভাবে নির্ধারণ করা হবে।')}
               </p>}
             </div>
           </div>}
           {payerForSelf !== null && topLevel !== null && !alreadySignedIn && !accountLoading && (
               <div className="tax-service-choice__progressive-section" data-entry-section="access">
                   <h3 id="tax-service-access-heading" className="tax-service-choice__entry-heading">{tr('How would you like to continue?', 'কীভাবে এগিয়ে যেতে চান?')}</h3>
                   <div className="tax-service-choice__access-options" role="group" aria-labelledby="tax-service-access-heading">
                     {[
                       { id: 'account' as const, Icon: UserRound, en: 'Sign-in Payment', bn: 'সাইন-ইন পেমেন্ট', detailEn: 'Use your account details and records.', detailBn: 'অ্যাকাউন্টের তথ্য ও রেকর্ড ব্যবহার করুন।' },
                       { id: 'guest' as const, Icon: WalletCards, en: 'Walk-in Payment', bn: 'ওয়াক-ইন পেমেন্ট', detailEn: 'Enter your details and make this payment.', detailBn: 'আপনার তথ্য দিয়ে এই কর পরিশোধ করুন।' },
                     ].map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
                       <button type="button" key={id} className="tax-service-choice__access-option"
                         aria-pressed={selectedAccess === id} data-payment-access={id.toUpperCase()}
                         onClick={() => setEntryAccess(id)}>
                         <span className="tax-service-choice__access-icon"><Icon size={20} aria-hidden="true" /></span>
                         <span className="tax-service-choice__access-copy"><strong>{tr(en, bangla)}</strong><small>{tr(detailEn, detailBn)}</small></span>
                         <span className="tax-service-choice__access-radio" aria-hidden="true"><span /></span>
                       </button>
                     ))}
                   </div>
                 </div>
           )}
           {payerForSelf !== null && topLevel !== null && verifiedUser && <button type="button" className="tax-service-choice__saved-drafts"
             onClick={() => { close(); navigate('secure_workspace'); }}>
             <FolderOpen size={17} aria-hidden="true" />
             {tr('Resume a saved payment draft', 'সংরক্ষিত পেমেন্ট খসড়া চালু করুন')}
           </button>}
         </PaymentDraftEntryGate> : view === 'login' ? (
           <TaxpayerLoginDialog embedded preservePaymentJourney emailReturnTo="taxpayer_home" onClose={() => setView('payer')} onValidityChange={setLoginReady} onSuccess={() => beginPayment(true)} />
         ) : effectiveSelected === 'TRAVEL_TAX' ? (
          <TravelTax key={draftToResume ? 'travel-draft-' + draftToResume.id : initialReuse ? 'travel-reuse-' + initialReuse.sourcePaymentId : 'travel-tax-modal'}
            embedded fourStepJourney initialDraft={draftToResume ?? undefined} initialReuse={initialReuse ?? undefined}
            onBackToService={directTravelEntry ? requestClose : returnToService} onStageChange={reportStage}
          registerHeaderBack={registerTravelHeaderBack} onCheckoutChange={setTravelCheckoutOpen} onResultViewChange={setResultView} />
        ) : effectiveSelected ? (
          <GuestPayment key={draftToResume ? 'payment-draft-' + draftToResume.id : initialReuse ? 'payment-reuse-' + initialReuse.sourcePaymentId : effectiveSelected + '-' + String(payerForSelf)}
            embedded unifiedFlow={unifiedEntry} initialCategory={effectiveSelected} initialForSelf={payerForSelf ?? undefined}
            initialDraft={draftToResume ?? undefined} initialReuse={initialReuse ?? undefined}
            initialBeneficiary={payerForSelf === false || parallelEntry ? paymentBeneficiaryPrefill ?? undefined : undefined} withAccount={useAccount}
            isWithholdingMode={effectiveSelected === 'SOURCE_TAX_DEPOSIT'}
            onBackToService={returnToService} onStageChange={reportStage}
            onManageBeneficiaries={(mode='manage')=>{manageAfterClose.current=mode;requestClose();}}
             onResultViewChange={setResultView} onCheckoutChange={setCheckoutOpen}
            registerHeaderBack={registerUnifiedHeaderBack} />
        ) : null}
      </section>}
      {exitPromptOpen && (isWalkInPayment ? (
        <WalkInDiscardConfirmation language={language}
          onKeepEditing={() => { setExitPromptOpen(false); setExitError(''); manageAfterClose.current=null; backToDraftChoice.current=false; }}
          onDiscard={()=>close()} />
      ) : (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
          data-testid={isWalkInPayment ? "walkin-payment-exit-overlay" : "payment-draft-exit-overlay"}
          onMouseDown={event => event.stopPropagation()}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="payment-draft-exit-title"
            aria-describedby="payment-draft-exit-description"
            className={`box-border max-h-[calc(100dvh-24px)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-taxpay-border bg-white p-5 shadow-xl sm:p-6 ${isWalkInPayment ? 'max-w-[520px]' : 'max-w-[440px]'}`}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (!exitSaving) { setExitPromptOpen(false); setExitError(''); manageAfterClose.current=null; backToDraftChoice.current=false; }
              }
              if (event.key === 'Tab') {
                const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                if (!buttons.length) { event.preventDefault(); return; }
                if (event.shiftKey && document.activeElement === buttons[0]) {
                  event.preventDefault();
                  buttons[buttons.length - 1].focus();
                } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
                  event.preventDefault();
                  buttons[0].focus();
                }
              }
            }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-taxpay-primary/10 text-taxpay-primary" aria-hidden="true">
                {isWalkInPayment ? <Trash2 size={20} strokeWidth={1.8} /> : <FileCheck2 size={20} strokeWidth={1.8} />}
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="payment-draft-exit-title" className="text-lg font-semibold leading-6 text-taxpay-dark">
                  {isWalkInPayment
                    ? tr('Discard tax payment?', 'কর পরিশোধ বাদ দেবেন?')
                    : tr('Save your tax payment?', 'কর পরিশোধের খসড়া সংরক্ষণ করবেন?')}
                </h3>
                <p id="payment-draft-exit-description" className="mt-1.5 text-sm leading-6 text-taxpay-muted">
                  {isWalkInPayment
                    ? tr('Discarding will erase the details entered for this walk-in payment. Keep editing to continue.',
                      'বাদ দিলে এই ওয়াক-ইন পেমেন্টের দেওয়া তথ্য মুছে যাবে। চালিয়ে যেতে সম্পাদনা করুন।')
                    : tr('Save a draft to continue later. Discarding will lose your unsaved changes.',
                      'পরে চালিয়ে যেতে খসড়া সংরক্ষণ করুন। বাদ দিলে অসংরক্ষিত পরিবর্তন হারিয়ে যাবে।')}
                </p>
              </div>
            </div>
            {!isWalkInPayment && exitError && <p role="alert" className="mt-4 rounded-lg border border-taxpay-border px-3 py-2 text-sm text-taxpay-error">{exitError}</p>}
            {isWalkInPayment ? (
              <div className="mt-5 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2"
                data-testid="walkin-payment-exit-cta-row">
                <button ref={exitFirstButtonRef} type="button"
                  className="min-h-11 w-full rounded-lg bg-taxpay-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-taxpay-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
                  onClick={() => { setExitPromptOpen(false); setExitError(''); manageAfterClose.current=null; backToDraftChoice.current=false; }}>
                  <span className="whitespace-nowrap">{tr('Keep editing', 'সম্পাদনা চালিয়ে যান')}</span>
                </button>
                <button type="button"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-error/40 bg-white px-4 py-2.5 text-sm font-semibold text-taxpay-error transition-colors hover:bg-taxpay-error/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
                  onClick={()=>close()}>
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span className="whitespace-nowrap">{tr('Discard tax payment', 'কর পরিশোধ বাদ দিন')}</span>
                </button>
              </div>
            ) : (
              <>
            <div className="mt-5 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2"
              data-testid="payment-draft-exit-cta-row">
              <button ref={exitFirstButtonRef} type="button" disabled={exitSaving}
                className="min-h-11 w-full rounded-lg bg-taxpay-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-taxpay-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary disabled:opacity-60"
                onClick={() => void saveDraftAndClose()}>
                {exitSaving ? tr('Saving…', 'সংরক্ষণ হচ্ছে…') : tr('Save Draft', 'খসড়া সংরক্ষণ করুন')}
              </button>
              <button type="button" disabled={exitSaving}
                className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-4 py-2.5 text-sm font-semibold text-taxpay-dark transition-colors hover:bg-taxpay-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary disabled:opacity-60"
                onClick={() => { setExitPromptOpen(false); setExitError(''); manageAfterClose.current=null; backToDraftChoice.current=false; }}>
                {tr('Keep editing', 'সম্পাদনা চালিয়ে যান')}
              </button>
            </div>
            <div className="mt-4 border-t border-taxpay-border pt-3"
              data-testid="payment-draft-exit-discard-row">
              <button type="button" disabled={exitSaving}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-taxpay-surface-subtle px-4 py-2.5 text-sm font-medium text-taxpay-error transition-colors hover:border-taxpay-error/30 hover:bg-taxpay-error/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary disabled:opacity-60"
                onClick={()=>close()}>
                <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                {tr('Discard tax payment', 'কর পরিশোধ বাদ দিন')}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      ))}
    </TaxPayModal>
  );
}
