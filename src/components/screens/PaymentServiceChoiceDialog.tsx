import React, { useCallback, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Check, ClipboardList, FileText,
  Landmark, Layers3, MoreHorizontal, Plane
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { GuestPayment } from './GuestPayment';
import { TravelTax } from './TravelTax';

/** The seven income-tax categories and separate travel-tax service in the NBR v11 HTML. */
export const PAYMENT_SERVICE_CHOICES = [
  { id: 'TAX_WITH_RETURN', Icon: FileText, en: 'Tax with Return', bn: 'রিটার্নসহ কর', detailEn: 'Tax paid with the annual income tax return.', detailBn: 'বার্ষিক আয়কর রিটার্নের সাথে পরিশোধ করা কর।' },
  { id: 'ADVANCE_TAX', Icon: CalendarClock, en: 'Advance Tax', bn: 'অগ্রিম কর', detailEn: 'Instalments paid during the income year.', detailBn: 'আয়বর্ষে কিস্তিতে অগ্রিম কর পরিশোধ।' },
  { id: 'ASSESSED_DEMAND', Icon: ClipboardList, en: 'Assessed Demand', bn: 'নির্ধারিত দাবি', detailEn: 'Payment against an assessed demand.', detailBn: 'নির্ধারিত কর দাবির বিপরীতে পরিশোধ।' },
  { id: 'PENALTY', Icon: AlertTriangle, en: 'Penalty', bn: 'জরিমানা', detailEn: 'Payment against an imposed penalty.', detailBn: 'আরোপিত জরিমানার বিপরীতে পরিশোধ।' },
  { id: 'SOURCE_TAX_DEPOSIT', Icon: Layers3, en: 'Source Tax Deposit', bn: 'উৎসে কর জমা', detailEn: 'Deposit TDS/TCS as a withholding agent.', detailBn: 'উৎসে কর্তন বা সংগ্রহকৃত কর জমা।' },
  { id: 'APPELLATE_TRIBUNAL', Icon: Landmark, en: 'Appellate Tribunal', bn: 'আপিল ট্রাইব্যুনাল', detailEn: 'Payment under the Tribunal payment head.', detailBn: 'আপিল ট্রাইব্যুনাল সংক্রান্ত কর পরিশোধ।' },
  { id: 'OTHER_TAX_PAYMENT', Icon: MoreHorizontal, en: 'Other Tax Payment', bn: 'অন্যান্য কর পরিশোধ', detailEn: 'Payment with a reference to a defined tax head.', detailBn: 'নির্ধারিত কর খাতের রেফারেন্স অনুযায়ী পরিশোধ।' },
  { id: 'TRAVEL_TAX', Icon: Plane, en: 'Travel Tax', bn: 'ভ্রমণ কর', detailEn: 'Tax based on journey and passenger details.', detailBn: 'যাত্রা ও যাত্রীর তথ্য অনুযায়ী ভ্রমণ কর।' }
] as const;

type ServiceId = typeof PAYMENT_SERVICE_CHOICES[number]['id'];

export function PaymentServiceChoiceDialog() {
  const { language, setPaymentServiceChoiceOpen } = useTaxState();
  const [selected, setSelected] = useState<ServiceId | null>(null);
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
  const stages = [tr('Service', 'সেবা'), tr('Payment details', 'পেমেন্টের তথ্য'), tr('Review & pay', 'পর্যালোচনা ও পরিশোধ'), tr('Confirmation', 'নিশ্চিতকরণ')];
  const advanceToDetails = () => { if (selected) setStage(2); };
  const reportStage = useCallback((next: 2 | 3 | 4) => setStage(next), []);

  return (
    <TaxPayModal
      title={tr('Pay Tax', 'কর পরিশোধ')}
      onClose={close}
      service={stage > 1 && selected === 'TRAVEL_TAX' ? 'travel' : 'payment-choice'}
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={(
        <div className="tax-service-choice__actions">
          <button type="button" className="tax-service-choice__cancel" onClick={stage === 1 ? close : () => setStage(1)}>
            {stage === 1 ? tr('Cancel', 'বাতিল') : <><ArrowLeft size={17} aria-hidden="true" />{tr('Back to services', 'সেবা বাছাইয়ে ফিরুন')}</>}
          </button>
          {stage === 1 && <button type="button" className="tax-service-choice__continue" disabled={!selected} onClick={advanceToDetails}>
            {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
          </button>}
        </div>
      )}
    >
      <section className={`tax-service-choice${stage > 1 && selected === 'TRAVEL_TAX' ? ' tax-service-choice--travel' : ''}`} aria-label={tr('Tax payment workflow', 'কর পরিশোধের ধাপ')}>
        {!(selected === 'TRAVEL_TAX' && stage > 1) && <>
          <p className="tax-service-choice__eyebrow">{tr(`Step ${stage} of 4`, `ধাপ ${stage} / ৪`)} · {stages[stage - 1]}</p>
          <ol className="tax-service-choice__progress" aria-label={tr('Payment progress', 'পেমেন্টের ধাপ')}>
            {stages.map((name, index) => (
              <li key={name} className={index + 1 === stage ? 'tax-service-choice__stage--current' : index + 1 < stage ? 'tax-service-choice__stage--complete' : ''}
                aria-current={index + 1 === stage ? 'step' : undefined}>
                <span>{index + 1 < stage ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{name}
              </li>
            ))}
          </ol>
        </>}
        {stage === 1 ? <>
        <h3 id="tax-service-choice-question">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
        <div className="tax-service-choice__grid" role="group" aria-label={tr('Tax payment services', 'কর পরিশোধের সেবা')}>
          {PAYMENT_SERVICE_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
            <button type="button" key={id} aria-pressed={selected === id}
              className="tax-service-choice__card" onClick={() => setSelected(id)}>
              <span className="tax-service-choice__icon"><Icon size={22} aria-hidden="true" /></span>
              <span className="tax-service-choice__radio" aria-hidden="true">{selected === id && <Check size={14} />}</span>
              <strong>{tr(en, bangla)}</strong>
              <span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span>
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
    </TaxPayModal>
  );
}
