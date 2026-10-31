import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, CircleAlert, ClipboardCheck, FileCheck2, FolderOpen,
  Plane, ReceiptText, Scale, UserRound, UsersRound, WalletCards
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import type { BannerPaymentService } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { GuestPayment } from './GuestPayment';
import { TravelTax } from './TravelTax';
import { TaxpayerLoginDialog, TaxpayerLoginFooter } from './TaxpayerLoginDialog';
import { useAccountIdentity } from '../../services/accountIdentity';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';
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
  { id: 'TAX_WITH_RETURN', Icon: FileCheck2, en: 'Tax with Return', bn: 'রিটার্নসহ কর', detailEn: 'Pay income tax with your annual return.', detailBn: 'বার্ষিক রিটার্নের সঙ্গে আয়কর পরিশোধ করুন।' },
  { id: 'OTHER_TAX', Icon: WalletCards, en: 'Other Tax', bn: 'অন্যান্য কর', detailEn: 'Other tax payments.', detailBn: 'অন্যান্য কর পরিশোধ।' }
] as const;

export function PaymentServiceChoiceDialog({ initialService = null }: { initialService?: BannerPaymentService | null }) {
  const { language, navigate, setPaymentServiceChoiceOpen, previewAccount, paymentBeneficiaryPrefill } = useTaxState();
  const { user: verifiedUser, loading: accountLoading } = useAccountIdentity();
  const multiBeneficiaryPrefill = (paymentBeneficiaryPrefill?.additional?.length ?? 0) > 0;
  const [payerForSelf, setPayerForSelf] = useState<boolean | null>(paymentBeneficiaryPrefill ? false : null);
  const [topLevel, setTopLevel] = useState<TopLevelService | null>(multiBeneficiaryPrefill ? 'OTHER_TAX' : initialService ? (initialService === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : null);
  // Other Tax is one entry choice. No follow-up subtype selection is collected here.
  const selected: ServiceId | null = topLevel === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : topLevel === 'OTHER_TAX' ? (initialService && initialService !== 'TAX_WITH_RETURN' ? initialService : 'OTHER_TAX_PAYMENT') : null;
  const [view, setView] = useState<'payer' | 'login' | 'payment'>('payer');
  // Show one choice at a time; keep previous answers when moving backward.
  const [decisionStep, setDecisionStep] = useState<1 | 2 | 3>(1);
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [useAccount, setUseAccount] = useState(false);
  const [entryAccess, setEntryAccess] = useState<'guest' | 'account' | null>(paymentBeneficiaryPrefill ? 'guest' : null);
  const [loginReady, setLoginReady] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const payerHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
  const stages = [tr('Taxpayer details', 'করদাতার তথ্য'), tr('Purpose & amount', 'খাত ও পরিমাণ'), tr('Payment channel', 'পেমেন্ট চ্যানেল'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const shortStages = [tr('Identity', 'পরিচয়'), tr('Amount', 'পরিমাণ'), tr('Channel', 'চ্যানেল'), tr('Done', 'শেষ')];
  const chosenService = PAYMENT_SERVICE_CHOICES.find(choice => choice.id === selected);
  const paymentAccess = selected ? resolvePaymentServiceAccess(selected, 'MAKE_PAYMENT') : null;
  const publicPayment = paymentAccess?.kind === 'PUBLIC';
  const beginPayment = (withAccount: boolean) => { setUseAccount(withAccount); setStage(1); setView('payment'); };
  const openLogin = () => { setLoginReady(false); setView('login'); };
  const advanceToPayment = () => {
    if (payerForSelf === null || !selected || (accountLoading && !previewAccount)) return;
    if (verifiedUser || previewAccount) { beginPayment(true); return; }
    // Never infer access choice from the preceding selections.
    if (!entryAccess) return;
    if (entryAccess === 'guest' && publicPayment) { beginPayment(false); return; }
    openLogin();
  };
  const advanceDecision = () => {
    if (decisionStep === 1) {
      if (payerForSelf !== null) setDecisionStep(2);
      return;
    }
    if (decisionStep === 2) {
      if (!selected || (accountLoading && !previewAccount)) return;
      // A signed-in user has no separate access choice to make.
      if (verifiedUser || previewAccount) beginPayment(true);
      else setDecisionStep(3);
      return;
    }
    advanceToPayment();
  };
  const returnToService = () => {
    setStage(1);
    // Back from the payment form returns to the last applicable decision.
    setDecisionStep(verifiedUser || previewAccount ? 2 : 3);
    setView('payer');
  };
  const reportStage = useCallback((next: 1 | 2 | 3 | 4) => setStage(next), []);
  useEffect(() => {
    // Each stage starts at its beginning, even when the previous form was scrolled.
    const scroller = flowRef.current?.closest<HTMLElement>('.taxpay-modal__body');
    if (scroller) scroller.scrollTop = 0;
    if (view === 'payer') payerHeadingRef.current?.focus();
    if (view === 'payment') stepHeadingRef.current?.focus();
  }, [stage, view, decisionStep]);

  return (
    <TaxPayModal
      title={view === 'login'
        ? tr(`Sign In To Your ${taxpayerBrandName(language)} Account`, `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন`)
        : view === 'payment' ? stages[stage - 1] : tr('Pay Tax', 'কর পরিশোধ')}
      progress={view === 'payment' ? { current: stage, total: 4 } : undefined}
      ariaLabel={view === 'login' ? undefined : tr('Pay Tax', 'কর পরিশোধ')}
      onClose={close}
      className={view === 'login' ? 'taxpayer-login-modal' : ''}
      animateSize={view === 'payer'}
      motionKey={view === 'payer' ? `payer-${decisionStep}` : view}
      onBack={view === 'login' ? () => setView('payer') : view === 'payment' ? () => {
        const back = document.querySelector<HTMLButtonElement>('.taxpay-modal[data-payment-stage="true"] .payment-flow-embedded__footer-actions .tax-service-choice__cancel');
        if (back && !back.disabled) back.click();
        else if (stage === 1 || stage === 4) returnToService();
      } : undefined}
      backLabel={tr('Back', 'ফিরুন')}
      service={view === 'login' ? 'login' : view === 'payment' && selected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={view === 'login'
        ? <TaxpayerLoginFooter formId="taxpay-embedded-login-form" disabled={!loginReady} language={language} />
        : (
        <div className="tax-service-choice__actions">
          {view === 'payer' && decisionStep > 1 && <button type="button" className="tax-service-choice__cancel"
             onClick={() => setDecisionStep(current => current === 3 ? 2 : 1)}>
             <ArrowLeft size={18} aria-hidden="true" /> {tr('Back', 'ফিরুন')}
           </button>}
          {view === 'payer' && <button type="button" className="tax-service-choice__continue"
             disabled={decisionStep === 1 ? payerForSelf === null : decisionStep === 2
               ? !selected || (multiBeneficiaryPrefill && selected !== 'OTHER_TAX_PAYMENT') || (accountLoading && !previewAccount)
               : !entryAccess || (accountLoading && !previewAccount)}
             onClick={advanceDecision}>
             {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
           </button>}
        </div>
      )}
    >
      <section key={view === 'payer' ? `payer-${decisionStep}` : view} ref={flowRef} data-view={view}
        data-decision-step={view === 'payer' ? decisionStep : undefined} className={`tax-service-choice${view === 'payment' && selected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
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
          {view === 'payment' && stage < 4 && useAccount && <p className="tax-service-choice__account-access">{tr('Continuing with your account', 'আপনার অ্যাকাউন্ট দিয়ে এগিয়ে যাচ্ছেন')}</p>}
        </>}
        {view === 'payer' ? <>
           {decisionStep === 1 && <>
           <h3 ref={payerHeadingRef} tabIndex={-1} id="tax-service-choice-question" className="tax-service-choice__payer-focus">{tr('Whose tax liability are you settling?', 'আপনি কার করদায় পরিশোধ করছেন?')}</h3>
           <div className="tax-service-choice__grid tax-service-choice__payer-grid" role="group" aria-label={tr('Taxpayer relationship', 'করদাতার সঙ্গে সম্পর্ক')}>
             {[
               { own: true, Icon: UserRound, en: 'My Tax Liability', bn: 'আমার করদায়', detailEn: 'Pay tax for myself.', detailBn: 'নিজের কর পরিশোধ করুন।' },
               { own: false, Icon: UsersRound, en: 'Facilitate another taxpayer’s payment', bn: 'অন্য করদাতার কর পরিশোধে সহায়তা করুন', detailEn: 'Pay on behalf of another taxpayer.', detailBn: 'অন্য করদাতার পক্ষে কর পরিশোধ করুন।' }
             ].map(({ own, Icon, en, bn: bangla, detailEn, detailBn }) => (
               <button type="button" key={String(own)} aria-pressed={payerForSelf === own}
                 data-payer-relationship={own ? 'SELF' : 'OTHER'} className="tax-service-choice__card"
                 onClick={() => setPayerForSelf(current => current === own ? null : own)}>
                 <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
                 <span className="tax-service-choice__copy"><strong>{tr(en, bangla)}</strong><span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span></span>
                 <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
               </button>
             ))}
           </div>
           </>}
           {decisionStep === 2 && <div className="tax-service-choice__progressive-section" data-entry-section="tax">
             <h3 ref={payerHeadingRef} tabIndex={-1} id="tax-service-type-heading" className="tax-service-choice__entry-heading">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
             <div className="tax-service-choice__grid tax-service-choice__tax-grid" role="group" aria-labelledby="tax-service-type-heading">
               {TAXPAY_ENTRY_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
                 <button type="button" key={id} aria-pressed={topLevel === id} data-payment-entry={id} className="tax-service-choice__card"
                   disabled={multiBeneficiaryPrefill && id !== 'OTHER_TAX'}
                   onClick={() => { if (!multiBeneficiaryPrefill) setTopLevel(current => current === id ? null : id); }}>
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
           {decisionStep === 3 && (
             verifiedUser || previewAccount
               ? <p className="tax-service-choice__signed-in">{tr('Continue with your signed-in account', 'সাইন ইন করা অ্যাকাউন্ট দিয়ে এগিয়ে যান')}</p>
               : <div className="tax-service-choice__progressive-section" data-entry-section="access">
                   <h3 ref={payerHeadingRef} tabIndex={-1} id="tax-service-access-heading" className="tax-service-choice__entry-heading">{tr('How would you like to continue?', 'কীভাবে এগিয়ে যেতে চান?')}</h3>
                   <div className="tax-service-choice__access-options" role="group" aria-labelledby="tax-service-access-heading">
                     {[
                       { id: 'account' as const, Icon: UserRound, en: 'Sign-in Payment', bn: 'সাইন-ইন পেমেন্ট', detailEn: 'Use your account details and records.', detailBn: 'অ্যাকাউন্টের তথ্য ও রেকর্ড ব্যবহার করুন।' },
                       { id: 'guest' as const, Icon: WalletCards, en: 'Walk-in Payment', bn: 'ওয়াক-ইন পেমেন্ট', detailEn: 'Enter your details and make this payment.', detailBn: 'আপনার তথ্য দিয়ে এই কর পরিশোধ করুন।' },
                     ].map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
                       <button type="button" key={id} className="tax-service-choice__access-option"
                         aria-pressed={entryAccess === id} data-payment-access={id.toUpperCase()}
                         onClick={() => setEntryAccess(current => current === id ? null : id)}>
                         <span className="tax-service-choice__access-icon"><Icon size={20} aria-hidden="true" /></span>
                         <span className="tax-service-choice__access-copy"><strong>{tr(en, bangla)}</strong><small>{tr(detailEn, detailBn)}</small></span>
                         <span className="tax-service-choice__access-radio" aria-hidden="true"><span /></span>
                       </button>
                     ))}
                   </div>
                 </div>
           )}
           {decisionStep === 2 && verifiedUser && <button type="button" className="tax-service-choice__saved-drafts"
             onClick={() => { close(); navigate('secure_workspace'); }}>
             <FolderOpen size={17} aria-hidden="true" />
             {tr('Resume a saved payment draft', 'সংরক্ষিত পেমেন্ট খসড়া চালু করুন')}
           </button>}
         </> : view === 'login' ? (
           <TaxpayerLoginDialog embedded preservePaymentJourney onClose={() => setView('payer')} onValidityChange={setLoginReady} onSuccess={() => beginPayment(true)} />
         ) : selected === 'TRAVEL_TAX' ? (
          <TravelTax key="travel-tax-modal" embedded fourStepJourney onBackToService={returnToService} onStageChange={reportStage} />
        ) : selected ? (
          <GuestPayment key={`${selected}-${payerForSelf}`} embedded initialCategory={selected} initialForSelf={payerForSelf ?? undefined}
            initialBeneficiary={payerForSelf === false ? paymentBeneficiaryPrefill ?? undefined : undefined} withAccount={useAccount}
            isWithholdingMode={selected === 'SOURCE_TAX_DEPOSIT'}
            onBackToService={returnToService} onStageChange={reportStage} />
        ) : null}
      </section>
    </TaxPayModal>
  );
}
