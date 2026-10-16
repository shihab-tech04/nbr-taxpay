import React, { useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarClock, Check, ClipboardList, FileText,
  Landmark, Layers3, MoreHorizontal, Plane
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { TaxPayModal } from '../ui/TaxPayModal';

/** The seven income-tax categories and separate travel-tax service in the NBR v11 HTML. */
const SERVICE_CHOICES = [
  { id: 'TAX_WITH_RETURN', Icon: FileText, en: 'Tax with Return', bn: 'রিটার্নসহ কর', detailEn: 'Tax paid with the annual income tax return.', detailBn: 'বার্ষিক আয়কর রিটার্নের সাথে পরিশোধ করা কর।' },
  { id: 'ADVANCE_TAX', Icon: CalendarClock, en: 'Advance Tax', bn: 'অগ্রিম কর', detailEn: 'Instalments paid during the income year.', detailBn: 'আয়বর্ষে কিস্তিতে অগ্রিম কর পরিশোধ।' },
  { id: 'ASSESSED_DEMAND', Icon: ClipboardList, en: 'Assessed Demand', bn: 'নির্ধারিত দাবি', detailEn: 'Payment against an assessed demand.', detailBn: 'নির্ধারিত কর দাবির বিপরীতে পরিশোধ।' },
  { id: 'PENALTY', Icon: AlertTriangle, en: 'Penalty', bn: 'জরিমানা', detailEn: 'Payment against an imposed penalty.', detailBn: 'আরোপিত জরিমানার বিপরীতে পরিশোধ।' },
  { id: 'SOURCE_TAX_DEPOSIT', Icon: Layers3, en: 'Source Tax Deposit', bn: 'উৎসে কর জমা', detailEn: 'Deposit TDS/TCS as a withholding agent.', detailBn: 'উৎসে কর্তন বা সংগ্রহকৃত কর জমা।' },
  { id: 'APPELLATE_TRIBUNAL', Icon: Landmark, en: 'Appellate Tribunal', bn: 'আপিল ট্রাইব্যুনাল', detailEn: 'Payment under the Tribunal payment head.', detailBn: 'আপিল ট্রাইব্যুনাল সংক্রান্ত কর পরিশোধ।' },
  { id: 'OTHER_TAX_PAYMENT', Icon: MoreHorizontal, en: 'Other Tax Payment', bn: 'অন্যান্য কর পরিশোধ', detailEn: 'Payment with a reference to a defined tax head.', detailBn: 'নির্ধারিত কর খাতের রেফারেন্স অনুযায়ী পরিশোধ।' },
  { id: 'TRAVEL_TAX', Icon: Plane, en: 'Travel Tax', bn: 'ভ্রমণ কর', detailEn: 'Tax based on journey and passenger details.', detailBn: 'যাত্রা ও যাত্রীর তথ্য অনুযায়ী ভ্রমণ কর।' }
] as const;

type ServiceId = typeof SERVICE_CHOICES[number]['id'];

export function PaymentServiceChoiceDialog() {
  const { language, userRole, navigate, setPaymentServiceChoiceOpen } = useTaxState();
  const { user: applicationUser } = useAccountIdentity();
  const [selected, setSelected] = useState<ServiceId | null>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const close = () => setPaymentServiceChoiceOpen(false);
  const signedIn = Boolean(applicationUser) || ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'].includes(userRole);
  const stages = [tr('Service', 'সেবা'), tr('Payment details', 'পেমেন্টের তথ্য'), tr('Review & pay', 'পর্যালোচনা ও পরিশোধ'), tr('Confirmation', 'নিশ্চিতকরণ')];

  const continueToService = () => {
    if (!selected) return;
    close();
    if (selected === 'TRAVEL_TAX') {
      navigate('travel');
    } else if (selected === 'SOURCE_TAX_DEPOSIT' && !signedIn) {
      navigate('guestwh', { initialCategory: selected });
    } else {
      navigate(signedIn ? 'wizard' : 'guest', { initialCategory: selected });
    }
  };

  return (
    <TaxPayModal
      title={tr('Pay Tax', 'কর পরিশোধ')}
      onClose={close}
      service="payment-choice"
      closeIconLabel={tr('Close payment services', 'কর পরিশোধের সেবা বন্ধ করুন')}
      footer={(
        <div className="tax-service-choice__actions">
          <button type="button" className="tax-service-choice__cancel" onClick={close}>{tr('Cancel', 'বাতিল')}</button>
          <button type="button" className="tax-service-choice__continue" disabled={!selected} onClick={continueToService}>
            {tr('Continue', 'এগিয়ে যান')} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    >
      <section className="tax-service-choice" aria-labelledby="tax-service-choice-question">
        <p className="tax-service-choice__eyebrow">{tr('Step 1 of 4 · Service', 'ধাপ ১ / ৪ · সেবা')}</p>
        <ol className="tax-service-choice__progress" aria-label={tr('Payment progress', 'পেমেন্টের ধাপ')}>
          {stages.map((stage, index) => (
            <li key={stage} className={index === 0 ? 'tax-service-choice__stage--current' : ''}
              aria-current={index === 0 ? 'step' : undefined}>
              <span>{index + 1}</span>{stage}
            </li>
          ))}
        </ol>
        <h3 id="tax-service-choice-question">{tr('Which tax would you like to pay?', 'কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
        <div className="tax-service-choice__grid" role="group" aria-label={tr('Tax payment services', 'কর পরিশোধের সেবা')}>
          {SERVICE_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }) => (
            <button type="button" key={id} aria-pressed={selected === id}
              className="tax-service-choice__card" onClick={() => setSelected(id)}>
              <span className="tax-service-choice__icon"><Icon size={22} aria-hidden="true" /></span>
              <span className="tax-service-choice__radio" aria-hidden="true">{selected === id && <Check size={14} />}</span>
              <strong>{tr(en, bangla)}</strong>
              <span className="tax-service-choice__description">{tr(detailEn, detailBn)}</span>
            </button>
          ))}
        </div>
      </section>
    </TaxPayModal>
  );
}
