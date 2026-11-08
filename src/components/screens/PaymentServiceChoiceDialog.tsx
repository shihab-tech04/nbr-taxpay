import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarClock, Check, CircleAlert, ClipboardCheck, FileCheck2, FolderOpen,
  Plane, ReceiptText, Scale, UserRound, UsersRound, WalletCards
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import type { BannerPaymentService } from '../../services/taxState';
import { TaxPayModal, type PaymentDraftExitAction } from '../ui/TaxPayModal';
import { GuestPayment } from './GuestPayment';
import { TravelTax } from './TravelTax';
import { TaxpayerLoginDialog, TaxpayerLoginFooter } from './TaxpayerLoginDialog';
import { useAccountIdentity } from '../../services/accountIdentity';
import {recordAccountActivity} from '../../services/accountActivity';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';
import { PaymentDraftEntryGate } from './PaymentDraftEntryGate';
import type { PaymentFormDraft, PaymentDraftActor } from '../../services/accountPaymentFormDrafts';
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

export function PaymentServiceChoiceDialog({ initialService = null, initialDraft = null }: { initialService?: BannerPaymentService | null; initialDraft?: PaymentFormDraft | null }) {
  const { language, navigate, setPaymentServiceChoiceOpen, previewAccount, paymentBeneficiaryPrefill } = useTaxState();
  const { user: verifiedUser, loading: accountLoading } = useAccountIdentity();
  const multiBeneficiaryPrefill = (paymentBeneficiaryPrefill?.additional?.length ?? 0) > 0;
  const [payerForSelf, setPayerForSelf] = useState<boolean | null>(initialDraft ? (initialDraft.service === 'TRAVEL_TAX' ? true : initialDraft.form_payload.forSelf as boolean) : paymentBeneficiaryPrefill ? false : null);
  const [topLevel, setTopLevel] = useState<TopLevelService | null>(initialDraft ? (initialDraft.service === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : paymentBeneficiaryPrefill ? 'OTHER_TAX' : initialService ? (initialService === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : null);
  // Other Tax is one entry choice. No follow-up subtype selection is collected here.
  const selected: ServiceId | null = topLevel === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : topLevel === 'OTHER_TAX' ? (initialService && initialService !== 'TAX_WITH_RETURN' ? initialService : 'OTHER_TAX_PAYMENT') : null;
  const [view, setView] = useState<'payer' | 'login' | 'payment'>(initialDraft ? 'payment' : 'payer');
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [useAccount, setUseAccount] = useState(Boolean(initialDraft));
  const [entryAccess, setEntryAccess] = useState<'guest' | 'account' | null>(null);
  // An existing signed-in session must always use the account journey.
  // Only signed-out users need to choose between account sign-in and walk-in.
  const alreadySignedIn = Boolean(verifiedUser || previewAccount);
  const selectedAccess = alreadySignedIn ? 'account' : (entryAccess ?? (paymentBeneficiaryPrefill ? 'guest' : null));
  const [draftToResume, setDraftToResume] = useState<PaymentFormDraft | null>(initialDraft);
  // Back from taxpayer details returns to payer choices without losing
  // the route back to the signed-in user's original saved-draft decision.
  const [draftEntryCompleted, setDraftEntryCompleted] = useState(Boolean(initialDraft));
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
  const draftOwnerKey = draftActor ? draftActor.kind + ':' +
    (draftActor.kind === 'authenticated' ? draftActor.userId : draftActor.profileId) : '';
  const [loginReady, setLoginReady] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const payerHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
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
    if (exitPromptOpen) { setExitPromptOpen(false); setExitError(''); return; }
    if (view === 'payment' && draftExitActionRef.current) {
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
      await saveDraft();
      close();
    } catch (cause) {
      setExitError(cause instanceof Error ? cause.message :
        tr('Draft saving failed. Your payment is still open.', 'খসড়া সংরক্ষণ ব্যর্থ হয়েছে। পেমেন্টটি এখনো খোলা আছে।'));
    } finally {
      setExitSaving(false);
    }
  };
  const stages = [tr('Taxpayer details', 'করদাতার তথ্য'), tr('Purpose & amount', 'খাত ও পরিমাণ'), tr('Payment channel', 'পেমেন্ট চ্যানেল'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const shortStages = [tr('Identity', 'পরিচয়'), tr('Amount', 'পরিমাণ'), tr('Channel', 'চ্যানেল'), tr('Done', 'শেষ')];
  const effectiveSelected: ServiceId | null = draftToResume?.service ?? selected;
  const chosenService = PAYMENT_SERVICE_CHOICES.find(choice => choice.id === effectiveSelected);
  const paymentAccess = effectiveSelected ? resolvePaymentServiceAccess(effectiveSelected, 'MAKE_PAYMENT') : null;
  const publicPayment = paymentAccess?.kind === 'PUBLIC';
  const beginPayment = (withAccount: boolean) => {
    if(withAccount&&verifiedUser?.id)
      void recordAccountActivity(verifiedUser.id,'PAYMENT_STARTED','wizard').catch(()=>undefined);
    setDraftToResume(null); setDraftEntryCompleted(true); setUseAccount(withAccount); setStage(1); setView('payment');
  };
  const openLogin = () => { setLoginReady(false); setView('login'); };
  const advanceToPayment = () => {
    if (payerForSelf === null || !selected || (accountLoading && !previewAccount)) return;
    if (!selectedAccess) return;
    if (selectedAccess === 'guest' && publicPayment) { beginPayment(false); return; }
    if (alreadySignedIn) { beginPayment(true); return; }
    openLogin();
  };
  const returnToService = () => {
    setDraftToResume(null);
    setStage(1);
    setView('payer');
  };
  const reportStage = useCallback((next: 1 | 2 | 3 | 4) => setStage(next), []);
  useEffect(() => {
    // Each stage starts at its beginning, even when the previous form was scrolled.
    const scroller = flowRef.current?.closest<HTMLElement>('.taxpay-modal__body');
    if (scroller) scroller.scrollTop = 0;
    if (view === 'payer') payerHeadingRef.current?.focus();
    if (view === 'payment') stepHeadingRef.current?.focus();
  }, [stage, view]);

  return (
    <TaxPayModal
      title={view === 'login'
        ? tr(`Sign In To Your ${taxpayerBrandName(language)} Account`, `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন`)
        : view === 'payment' ? stages[stage - 1] : tr('Pay Tax', 'কর পরিশোধ')}
      progress={view === 'payment' ? { current: stage, total: 4, label: tr('Steps', 'ধাপ'),
        subtitle: chosenService && payerForSelf !== null
          ? `${tr(chosenService.en, chosenService.bn)} › ${payerForSelf ? tr('My Tax Liability', 'আমার করদায়') : tr('Facilitate another taxpayer’s payment', 'অন্য করদাতার কর পরিশোধে সহায়তা করুন')}`
          : undefined } : undefined}
      ariaLabel={view === 'login' ? undefined : tr('Pay Tax', 'কর পরিশোধ')}
      onClose={requestClose}
      onBackdropClose={() => {
        // A backdrop click never discards draft-eligible payment data.
        if (exitPromptOpen || (view === 'payment' && draftExitActionRef.current)) return;
        close();
      }}
      registerDraftExit={registerDraftExit}
      className={view === 'login' ? 'taxpayer-login-modal' : ''}
      animateSize={view === 'payer'}
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
        : view === 'login' ? () => setView('payer') : view === 'payment' && stage !== 4 ? () => {
        const back = document.querySelector<HTMLButtonElement>(
          '.taxpay-modal[data-payment-stage="true"] .payment-flow-embedded__footer-actions .tax-service-choice__cancel, ' +
          '.taxpay-modal[data-payment-stage="true"] .travel-flow__footer-actions .tax-service-choice__cancel'
        );
        if (back && !back.disabled) back.click();
        else if (stage === 1) returnToService();
      } : undefined}
      backLabel={tr('Back', 'ফিরুন')}
      hideFooter={view === 'payer' && draftEntryBlocking}
      service={view === 'login' ? 'login' : view === 'payment' && effectiveSelected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={view === 'login'
        ? <TaxpayerLoginFooter formId="taxpay-embedded-login-form" disabled={!loginReady} language={language} />
        : (
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
      <section key={view} ref={flowRef} data-view={view}
        className={`tax-service-choice${view === 'payment' && effectiveSelected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
        {view === 'payment' && <>
          <p ref={stepHeadingRef} tabIndex={-1} className="tax-service-choice__eyebrow" aria-label={tr(`Step ${stage} of 4: ${stages[stage - 1]}`, `ধাপ ${stage} / ৪: ${stages[stage - 1]}`)}>{tr(`Step ${stage} of 4`, `ধাপ ${stage} / ৪`)}</p>
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
        {view === 'payment' && chosenService && <>
          <p className="tax-service-choice__selected-service">
            <span>{tr('Selected payment service', 'নির্বাচিত কর পরিশোধ সেবা')}</span>
            <strong data-payment-service={chosenService.id}>{tr(chosenService.en, chosenService.bn)}</strong>
            <span>{payerForSelf ? tr('My tax liability', 'আমার করদায়') : tr('Facilitate another taxpayer’s payment', 'অন্য করদাতার কর পরিশোধে সহায়তা করুন')}</span>
          </p>
        </>}
        {view === 'payer' ? <PaymentDraftEntryGate
           actor={draftActor} ownerKey={draftOwnerKey}
           mode={draftEntryMode} onModeChange={changeDraftEntryMode}
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
          <TravelTax key={draftToResume ? 'travel-draft-' + draftToResume.id : 'travel-tax-modal'}
            embedded fourStepJourney initialDraft={draftToResume ?? undefined}
            onBackToService={returnToService} onStageChange={reportStage} />
        ) : effectiveSelected ? (
          <GuestPayment key={draftToResume ? 'payment-draft-' + draftToResume.id : effectiveSelected + '-' + String(payerForSelf)}
            embedded initialCategory={effectiveSelected} initialForSelf={payerForSelf ?? undefined}
            initialDraft={draftToResume ?? undefined}
            initialBeneficiary={payerForSelf === false ? paymentBeneficiaryPrefill ?? undefined : undefined} withAccount={useAccount}
            isWithholdingMode={effectiveSelected === 'SOURCE_TAX_DEPOSIT'}
            onBackToService={returnToService} onStageChange={reportStage} />
        ) : null}
      </section>
      {exitPromptOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4"
          data-testid="payment-draft-exit-overlay"
          onMouseDown={event => event.stopPropagation()}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="payment-draft-exit-title"
            aria-describedby="payment-draft-exit-description"
            className="w-full max-w-md rounded-xl border border-taxpay-border bg-white p-5 shadow-2xl"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (!exitSaving) { setExitPromptOpen(false); setExitError(''); }
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
            <h3 id="payment-draft-exit-title" className="text-lg font-semibold text-taxpay-dark">
              {tr('Save your tax payment?', 'কর পরিশোধের খসড়া সংরক্ষণ করবেন?')}
            </h3>
            <p id="payment-draft-exit-description" className="mt-2 text-sm text-taxpay-muted">
              {tr('Save this payment as a draft to continue later, or discard your unsaved changes.',
                'পরে চালিয়ে যেতে পেমেন্টটি খসড়া হিসেবে সংরক্ষণ করুন, অথবা অসংরক্ষিত পরিবর্তন বাদ দিন।')}
            </p>
            {exitError && <p role="alert" className="mt-3 text-sm text-taxpay-error">{exitError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button ref={exitFirstButtonRef} type="button" disabled={exitSaving}
                className="min-h-11 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void saveDraftAndClose()}>
                {exitSaving ? tr('Saving…', 'সংরক্ষণ হচ্ছে…') : tr('Save Draft', 'খসড়া সংরক্ষণ করুন')}
              </button>
              <button type="button" disabled={exitSaving}
                className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-dark disabled:opacity-60"
                onClick={close}>
                {tr('Discard tax payment', 'কর পরিশোধ বাদ দিন')}
              </button>
              <button type="button" disabled={exitSaving}
                className="min-h-11 px-3 text-sm font-medium text-taxpay-primary disabled:opacity-60"
                onClick={() => { setExitPromptOpen(false); setExitError(''); }}>
                {tr('Keep editing', 'সম্পাদনা চালিয়ে যান')}
              </button>
            </div>
          </div>
        </div>
      )}
    </TaxPayModal>
  );
}
