import React from 'react';
import { ArrowRight, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';

/** Open the payer-first entry directly; service subtype decisions are not made here. */
export const PaymentServicesPage: React.FC = () => {
  const { language, setPaymentServiceChoiceOpen } = useTaxState();
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;

  return <div className="taxpayer-payment-services mx-auto max-w-6xl space-y-4 pb-12">
    <TaxpayerPageHeading title={tr('Pay Tax', 'কর পরিশোধ')}
      description={tr('Start by choosing whose tax you are paying.', 'প্রথমে কার কর পরিশোধ করবেন তা নির্বাচন করুন।')}
      actions={<button type="button" className="taxpayer-service-directory__primary" onClick={() => setPaymentServiceChoiceOpen(true)}>
        {tr('Start payment', 'কর পরিশোধ শুরু করুন')} <ArrowRight size={18} aria-hidden="true" />
      </button>} />
    <section className="taxpayer-service-directory__grid" aria-label={tr('Tax payment entry', 'কর পরিশোধের প্রবেশপথ')}>
      <article className="taxpayer-service-directory__card">
        <div className="taxpayer-service-directory__card-top">
          <span className="taxpayer-service-directory__icon"><WalletCards size={22} aria-hidden="true" /></span>
        </div>
        <h2>{tr('Pay Tax', 'কর পরিশোধ')}</h2>
        <p>{tr('Choose whether you are paying your own tax or for another taxpayer to continue.', 'নিজের কর অথবা অন্য করদাতার পক্ষে কর পরিশোধ করবেন কি না নির্বাচন করে এগিয়ে যান।')}</p>
      </article>
    </section>
  </div>;
};
