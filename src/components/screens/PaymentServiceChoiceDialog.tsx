import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, CircleAlert, ClipboardCheck, FileCheck2,
  Plane, ReceiptText, Scale, WalletCards
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { GuestPayment } from './GuestPayment';
import { TravelTax } from './TravelTax';
import { TaxpayerLoginDialog } from './TaxpayerLoginDialog';
import { useAccountIdentity } from '../../services/accountIdentity';
import { resolvePaymentServiceAccess } from '../../services/paymentServiceAccessPolicy';

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

export function PaymentServiceChoiceDialog() {
  const { language, setPaymentServiceChoiceOpen, previewAccount } = useTaxState();
  const { user: verifiedUser } = useAccountIdentity();
  const [selected, setSelected] = useState<ServiceId | null>(null);
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [accountGate, setAccountGate] = useState<'message' | 'login' | null>(null);
  const [resumedAfterLogin, setResumedAfterLogin] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
  const stages = [tr('Service', 'সেবা'), tr('Payment details', 'পেমেন্টের তথ্য'), tr('Review & pay', 'পর্যালোচনা ও পরিশোধ'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const shortStages = [tr('Service', 'সেবা'), tr('Details', 'তথ্য'), tr('Review', 'যাচাই'), tr('Done', 'শেষ')];
  const chosenService = PAYMENT_SERVICE_CHOICES.find(choice => choice.id === selected);
  const advanceToDetails = () => { if (selected) setStage(2); };
  const reportStage = useCallback((next: 2 | 3 | 4) => setStage(next), []);
  const requestAccountAccess = () => {
    if (!selected || resolvePaymentServiceAccess(selected, 'VIEW_ACCOUNT_RECORDS').kind !== 'SIGN_IN_REQUIRED') return;
    if (verifiedUser || previewAccount) {
      setResumedAfterLogin(true);
      return;
    }
    setAccountGate('message');
  };

  useEffect(() => {
    if (accountGate !== 'message') return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    gateRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setAccountGate(null); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(gateRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault(); buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault(); buttons[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [accountGate]);

  useEffect(() => {
    // Each stage starts at its beginning, even when the previous form was scrolled.
    const scroller = flowRef.current?.closest<HTMLElement>('.taxpay-modal__body');
    if (scroller) scroller.scrollTop = 0;
  }, [stage]);

  return (
    <TaxPayModal
      title={tr('Pay Tax', 'কর পরিশোধ')}
      onClose={close}
      service={stage > 1 && selected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={(
        <div className="tax-service-choice__actions">
          {stage === 1 && <button type="button" className="tax-service-choice__continue" disabled={!selected} onClick={advanceToDetails}>
            {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
          </button>}
          {stage > 1 && selected === 'TRAVEL_TAX' && <button type="button" className="tax-service-choice__cancel" onClick={() => setStage(1)}>
            <ArrowLeft size={17} aria-hidden="true" />{tr('Back to services', 'সেবা বাছাইয়ে ফিরুন')}
          </button>}
        </div>
      )}
    >
      <section ref={flowRef} className={`tax-service-choice${stage > 1 && selected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
        {!(selected === 'TRAVEL_TAX' && stage > 1) && <>
          <p className="tax-service-choice__eyebrow">{tr(`Step ${stage} of 4`, `ধাপ ${stage} / ৪`)} · {stages[stage - 1]}</p>
          <ol className="tax-service-choice__progress" aria-label={tr('Payment progress', 'পেমেন্টের ধাপ')}>
            {stages.map((name, index) => (
              <li key={name} className={index + 1 === stage ? 'tax-service-choice__stage--current' : index + 1 < stage ? 'tax-service-choice__stage--complete' : ''}
                aria-label={`${index + 1}. ${name}`} aria-current={index + 1 === stage ? 'step' : undefined}>
                <span className="tax-service-choice__stage-number">{index + 1 < stage ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                <span className="tax-service-choice__stage-label tax-service-choice__stage-label--full" aria-hidden="true">{name}</span>
                <span className="tax-service-choice__stage-label tax-service-choice__stage-label--short" aria-hidden="true">{shortStages[index]}</span>
              </li>
            ))}
          </ol>
        </>}
        {stage > 1 && selected !== 'TRAVEL_TAX' && chosenService && <>
          <p className="tax-service-choice__selected-service">
            <span>{tr('Selected payment service', 'নির্বাচিত কর পরিশোধ সেবা')}</span>
            <strong data-payment-service={chosenService.id}>{tr(chosenService.en, chosenService.bn)}</strong>
          </p>
          {stage < 4 && <div className="tax-service-choice__account-access">
            <p>{resumedAfterLogin || verifiedUser || previewAccount
              ? tr('Account selected. Your payment details are still here.', 'অ্যাকাউন্ট নির্বাচন করা হয়েছে। আপনার পরিশোধের তথ্য আগের মতোই আছে।')
              : tr('You can pay without signing in.', 'সাইন ইন ছাড়াই পরিশোধ করতে পারবেন।')}</p>
            {!resumedAfterLogin && !verifiedUser && !previewAccount && <button type="button" onClick={requestAccountAccess}>
              {tr('Continue with my account', 'আমার অ্যাকাউন্ট দিয়ে এগিয়ে যান')}
            </button>}
          </div>}
        </>}
        {stage === 1 ? <>
        <h3 id="tax-service-choice-question">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
        <div className="tax-service-choice__grid" role="group" aria-label={tr('Tax payment services', 'কর পরিশোধের সেবা')}>
          {PAYMENT_SERVICE_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
            <button type="button" key={id} aria-pressed={selected === id}
              data-payment-service={id} className="tax-service-choice__card" onClick={() => setSelected(id)}>
              <span className="tax-service-choice__icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="tax-service-choice__copy">
                <strong>{tr(en, bangla)}</strong>
                <span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span>
              </span>
              <span className="tax-service-choice__radio" aria-hidden="true"><span /></span>
            </button>
          ))}
        </div>
        </> : selected === 'TRAVEL_TAX' ? (
          <TravelTax key="travel-tax-modal" embedded />
        ) : selected ? (
          <GuestPayment key={selected} embedded initialCategory={selected}
            isWithholdingMode={selected === 'SOURCE_TAX_DEPOSIT'}
            onBackToService={() => setStage(1)} onStageChange={reportStage} />
        ) : null}
      </section>
      {accountGate === 'message' && <div className="tax-service-auth-overlay">
        <div ref={gateRef} className="tax-service-auth-message" role="alertdialog" aria-modal="true" aria-labelledby="tax-service-auth-title" aria-describedby="tax-service-auth-description">
          <h2 id="tax-service-auth-title">{tr('Sign in required', 'সাইন ইন করতে হবে')}</h2>
          <p id="tax-service-auth-description">{tr('Accessing your account records requires sign-in. Your selected service and entered payment details will be kept when you return.', 'অ্যাকাউন্টের তথ্য দেখতে সাইন ইন করতে হবে। ফিরে এলে নির্বাচিত সেবা ও দেওয়া পরিশোধের তথ্য আগের মতো থাকবে।')}</p>
          <div className="tax-service-auth-message__actions">
            <button type="button" onClick={() => setAccountGate(null)}>{tr('Continue without login', 'সাইন ইন ছাড়া এগিয়ে যান')}</button>
            <button type="button" onClick={() => setAccountGate('login')}>{tr('Go to login', 'সাইন ইন করুন')}</button>
          </div>
        </div>
      </div>}
      {accountGate === 'login' && <TaxpayerLoginDialog
        preservePaymentJourney
        onClose={() => setAccountGate(null)}
        onSuccess={() => { setResumedAfterLogin(true); setAccountGate(null); }}
      />}
    </TaxPayModal>
  );
}
