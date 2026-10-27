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
import { TaxpayerLoginDialog } from './TaxpayerLoginDialog';
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
  const { language, navigate, setPaymentServiceChoiceOpen, previewAccount } = useTaxState();
  const { user: verifiedUser, loading: accountLoading } = useAccountIdentity();
  const [payerForSelf, setPayerForSelf] = useState<boolean | null>(null);
  const [topLevel, setTopLevel] = useState<TopLevelService | null>(initialService ? (initialService === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX') : null);
  // Other Tax is one entry choice. No follow-up subtype selection is collected here.
  const selected: ServiceId | null = topLevel === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : topLevel === 'OTHER_TAX' ? (initialService && initialService !== 'TAX_WITH_RETURN' ? initialService : 'OTHER_TAX_PAYMENT') : null;
  const [view, setView] = useState<'payer' | 'choice' | 'access' | 'login' | 'payment'>('payer');
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [useAccount, setUseAccount] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const payerHeadingRef = useRef<HTMLHeadingElement>(null);
  const serviceHeadingRef = useRef<HTMLHeadingElement>(null);
  const accessHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
  const stages = [tr('Taxpayer details', 'করদাতার তথ্য'), tr('Purpose & amount', 'খাত ও পরিমাণ'), tr('Payment channel', 'পেমেন্ট চ্যানেল'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const stageIcons = [UserRound, ClipboardCheck, WalletCards, ReceiptText];
  const shortStages = [tr('Identity', 'পরিচয়'), tr('Amount', 'পরিমাণ'), tr('Channel', 'চ্যানেল'), tr('Done', 'শেষ')];
  const chosenService = PAYMENT_SERVICE_CHOICES.find(choice => choice.id === selected);
  const paymentAccess = selected ? resolvePaymentServiceAccess(selected, 'MAKE_PAYMENT') : null;
  const publicPayment = paymentAccess?.kind === 'PUBLIC';
  const beginPayment = (withAccount: boolean) => { setUseAccount(withAccount); setStage(1); setView('payment'); };
  const advanceToAccess = () => {
    if (payerForSelf === null || !selected || (accountLoading && !previewAccount)) return;
    if (verifiedUser || previewAccount) beginPayment(true);
    else setView('access');
  };
  const returnToService = () => {
    setStage(1);
    // A banner/direct-service referral already selected the applicable service.
    // Back returns to payer identity rather than an unnecessary second choice.
    setView(initialService ? 'payer' : 'choice');
  };
  const reportStage = useCallback((next: 1 | 2 | 3 | 4) => setStage(next), []);
  const requestAccountAccess = () => {
    if (accountLoading && !previewAccount) return;
    if (verifiedUser || previewAccount) {
      beginPayment(true);
      return;
    }
    setView('login');
  };

  useEffect(() => {
    // Direct-service entry can mount before Supabase restores the Auth session.
    if (view === 'access' && (verifiedUser || previewAccount)) {
      setUseAccount(true);
      setStage(1);
      setView('payment');
    }
  }, [view, verifiedUser, previewAccount]);

  useEffect(() => {
    // Each stage starts at its beginning, even when the previous form was scrolled.
    const scroller = flowRef.current?.closest<HTMLElement>('.taxpay-modal__body');
    if (scroller) scroller.scrollTop = 0;
    if (view === 'payer') payerHeadingRef.current?.focus();
    if (view === 'choice') serviceHeadingRef.current?.focus();
    if (view === 'access') accessHeadingRef.current?.focus();
    if (view === 'payment') stepHeadingRef.current?.focus();
  }, [stage, view]);

  return (
    <TaxPayModal
      title={view === 'login' ? tr(`Sign In To Your ${taxpayerBrandName(language)} Account`, `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন`) : tr('Pay Tax', 'কর পরিশোধ')}
      onClose={close}
      className={view === 'access' || view === 'login' ? 'tax-service-choice-modal--access' : ''}
      service={view === 'payment' && selected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={(
        <div className="tax-service-choice__actions">
          {view === 'payer' && <button type="button" className="tax-service-choice__continue" disabled={payerForSelf === null || (Boolean(initialService) && accountLoading && !previewAccount)}
            onClick={() => initialService ? advanceToAccess() : setView('choice')}>
            {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
          </button>}
          {view === 'choice' && <>
            <button type="button" className="tax-service-choice__cancel" onClick={() => setView('payer')}><ArrowLeft size={17} aria-hidden="true" />{tr('Back', 'ফিরুন')}</button>
            <button type="button" className="tax-service-choice__continue" disabled={!selected || (accountLoading && !previewAccount)} onClick={advanceToAccess}>
              {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </>}
          {view === 'access' && <button type="button" className="tax-service-choice__cancel" onClick={() => setView(initialService ? 'payer' : 'choice')}><ArrowLeft size={17} aria-hidden="true" />{tr('Back', 'ফিরুন')}</button>}
          {view === 'login' && <>
            <button type="button" className="tax-service-choice__cancel" onClick={() => setView('access')}><ArrowLeft size={17} aria-hidden="true" />{tr('Back', 'ফিরুন')}</button>
            <button type="submit" form="taxpay-embedded-login-form" className="tax-service-choice__continue">{tr('Sign In', 'সাইন ইন')} <ArrowRight size={18} aria-hidden="true" /></button>
          </>}
        </div>
      )}
    >
      <section ref={flowRef} className={`tax-service-choice${view === 'payment' && selected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
        {view === 'payment' && <>
          <p ref={stepHeadingRef} tabIndex={-1} className="tax-service-choice__eyebrow" aria-label={tr(`Step ${stage} of 4: ${stages[stage - 1]}`, `ধাপ ${stage} / ৪: ${stages[stage - 1]}`)}>{tr(`Step ${stage} of 4`, `ধাপ ${stage} / ৪`)}</p>
          <ol className="tax-service-choice__progress" aria-label={tr('Payment progress', 'পেমেন্টের ধাপ')}>
            {stages.map((name, index) => {
              const StageIcon = stageIcons[index];
              return (
              <li key={name} className={index + 1 === stage ? 'tax-service-choice__stage--current' : index + 1 < stage ? 'tax-service-choice__stage--complete' : ''}
                aria-label={`${index + 1}. ${name}`} aria-current={index + 1 === stage ? 'step' : undefined}>
                <span className="tax-service-choice__stage-number">{index + 1 < stage ? <Check size={16} aria-hidden="true" /> : <StageIcon size={17} strokeWidth={1.9} aria-hidden="true" />}</span>
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
          <h3 ref={payerHeadingRef} tabIndex={-1} id="tax-service-choice-question">{tr('Who are you paying for?', 'কার কর পরিশোধ করছেন?')}</h3>
          <div className="tax-service-choice__grid" role="group" aria-label={tr('Taxpayer relationship', 'করদাতার সঙ্গে সম্পর্ক')}>
            {[
              { own: true, Icon: UserRound, en: 'My tax liability', bn: 'আমার করদায়', detailEn: 'You are both the payer and the taxpayer.', detailBn: 'আপনি একই সঙ্গে করদাতা ও পরিশোধকারী।', noteEn: '', noteBn: '' },
              { own: false, Icon: UsersRound, en: 'Facilitate another taxpayer’s payment', bn: 'অন্য করদাতার কর পরিশোধে সহায়তা করুন', detailEn: 'You facilitate the payment; the liability and the tax credit stay theirs.', detailBn: 'আপনি শুধু পরিশোধে সহায়তা করেন; করদায় ও কর ক্রেডিট করদাতারই থাকে।', noteEn: 'Only where the taxpayer has authorized you.', noteBn: 'শুধুমাত্র করদাতার অনুমোদন থাকলে।' }
            ].map(({ own, Icon, en, bn: bangla, detailEn, detailBn, noteEn, noteBn }) => (
              <button type="button" key={String(own)} aria-pressed={payerForSelf === own}
                data-payer-relationship={own ? 'SELF' : 'OTHER'} className="tax-service-choice__card" onClick={() => setPayerForSelf(own)}>
                <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
                <span className="tax-service-choice__copy"><strong>{tr(en, bangla)}</strong>
                  <span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span>{noteEn && <span className="tax-service-choice__description">{tr(noteEn, noteBn)}</span>}</span>
                <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
              </button>
            ))}
          </div>
        </> : view === 'choice' ? <>
        <p className="tax-service-choice__selected-service">
          <span>{tr('Paying for', 'যার জন্য পরিশোধ')}</span>
          <strong>{payerForSelf ? tr('My tax liability', 'আমার করদায়') : tr('Facilitate another taxpayer’s payment', 'অন্য করদাতার কর পরিশোধে সহায়তা করুন')}</strong>
        </p>
        <h3 ref={serviceHeadingRef} tabIndex={-1} id="tax-service-choice-question">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
        <div className="tax-service-choice__grid" role="group" aria-label={tr('Tax payment services', 'কর পরিশোধের সেবা')}>
          {TAXPAY_ENTRY_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
            <button type="button" key={id} aria-pressed={topLevel === id}
              data-payment-entry={id} className="tax-service-choice__card" onClick={() => setTopLevel(id)}>
              <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="tax-service-choice__copy">
                <strong>{tr(en, bangla)}</strong>
                <span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span>
              </span>
              <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
            </button>
          ))}
        </div>

        {verifiedUser && <button type="button" className="tax-service-choice__saved-drafts"
          onClick={() => { close(); navigate('secure_workspace'); }}>
          <FolderOpen size={17} aria-hidden="true" />
          {tr('Resume a saved payment draft', 'সংরক্ষিত পেমেন্ট খসড়া চালু করুন')}
        </button>}
        </> : view === 'access' ? <div className="tax-service-choice__access-gate">
          {chosenService && <p className="tax-service-choice__selected-service"><span>{tr('Selected payment service', 'নির্বাচিত কর পরিশোধ সেবা')}</span><strong data-payment-service={selected ?? undefined}>{tr(chosenService.en, chosenService.bn)}</strong></p>}
          <h3 ref={accessHeadingRef} tabIndex={-1}>{tr('How would you like to continue?', 'কীভাবে এগিয়ে যেতে চান?')}</h3>
          <p>{accountLoading && !previewAccount ? tr('Checking your account session…', 'আপনার অ্যাকাউন্ট সেশন যাচাই করা হচ্ছে…') : publicPayment ? tr('Choose one option to start your payment.', 'পেমেন্ট শুরু করতে একটি উপায় বেছে নিন।') : tr('Sign in to continue with this service.', 'এই সেবায় এগিয়ে যেতে সাইন ইন করুন।')}</p>
          <div className="tax-service-choice__access-options">
            {publicPayment && <button type="button" disabled={accountLoading && !previewAccount} className="tax-service-choice__access-option tax-service-choice__access-option--guest" onClick={() => beginPayment(false)}>
              <span className="tax-service-choice__access-icon"><WalletCards size={21} aria-hidden="true" /></span>
              <span className="tax-service-choice__access-copy"><strong>{tr('Continue without signing in', 'সাইন ইন ছাড়াই এগিয়ে যান')}</strong><small>{tr('Enter your details and make this payment', 'আপনার তথ্য দিয়ে এই পেমেন্ট করুন')}</small></span>
              <ArrowRight size={19} className="tax-service-choice__access-arrow" aria-hidden="true" />
            </button>}
            <button type="button" disabled={accountLoading && !previewAccount} className="tax-service-choice__access-option" onClick={requestAccountAccess}>
              <span className="tax-service-choice__access-icon"><UserRound size={21} aria-hidden="true" /></span>
              <span className="tax-service-choice__access-copy"><strong>{tr('Continue with my account', 'আমার অ্যাকাউন্ট দিয়ে এগিয়ে যান')}</strong><small>{tr('Sign in to use your account details and records', 'অ্যাকাউন্টের তথ্য ও রেকর্ড ব্যবহার করতে সাইন ইন করুন')}</small></span>
              <ArrowRight size={19} className="tax-service-choice__access-arrow" aria-hidden="true" />
            </button>
          </div>
        </div> : view === 'login' ? (
          <TaxpayerLoginDialog embedded preservePaymentJourney onClose={() => setView('access')} onSuccess={() => beginPayment(true)} />
        ) : selected === 'TRAVEL_TAX' ? (
          <TravelTax key="travel-tax-modal" embedded fourStepJourney onBackToService={returnToService} onStageChange={reportStage} />
        ) : selected ? (
          <GuestPayment key={`${selected}-${payerForSelf}`} embedded initialCategory={selected} initialForSelf={payerForSelf ?? undefined} withAccount={useAccount}
            isWithholdingMode={selected === 'SOURCE_TAX_DEPOSIT'}
            onBackToService={returnToService} onStageChange={reportStage} />
        ) : null}
      </section>
    </TaxPayModal>
  );
}
