import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { PAYMENT_SERVICE_CHOICES } from './PaymentServiceChoiceDialog';

/** A directory of actual payment categories, not the retired connection-status mockup. */
export const PaymentServicesPage: React.FC = () => {
  const { language, setPaymentServiceChoiceOpen } = useTaxState();
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;

  return <div className="taxpayer-payment-services mx-auto max-w-6xl space-y-4 pb-12">
    <header className="taxpayer-service-directory__header">
      <div>
        <p className="taxpayer-service-directory__eyebrow">{tr('Payment services', 'কর পরিশোধ সেবা')}</p>
        <h1>{tr('Choose a tax payment service', 'কর পরিশোধের সেবা নির্বাচন করুন')}</h1>
        <p>{tr('Eight payment types are available in the service selector. Select the type that matches your payment purpose.', 'সেবা নির্বাচনে আট ধরনের কর পরিশোধ রয়েছে। আপনার পরিশোধের উদ্দেশ্যের সঙ্গে মিলিয়ে সেবাটি নির্বাচন করুন।')}</p>
      </div>
      <button type="button" className="taxpayer-service-directory__primary" onClick={() => setPaymentServiceChoiceOpen(true)}>
        {tr('Select a service', 'সেবা নির্বাচন করুন')} <ArrowRight size={18} aria-hidden="true" />
      </button>
    </header>
    <section className="taxpayer-service-directory__grid" aria-label={tr('Eight tax payment types', 'আট ধরনের কর পরিশোধ')}>
      {PAYMENT_SERVICE_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }, index) => (
        <article className="taxpayer-service-directory__card" key={id}>
          <div className="taxpayer-service-directory__card-top">
            <span className="taxpayer-service-directory__icon"><Icon size={22} aria-hidden="true" /></span>
            <span className="taxpayer-service-directory__number">{String(index + 1).padStart(2, '0')}</span>
          </div>
          <h2>{tr(en, bangla)}</h2>
          <p>{tr(detailEn, detailBn)}</p>
          {id === 'TRAVEL_TAX' && <p className="taxpayer-service-directory__separate">{tr('Separate from income-tax credits', 'আয়কর ক্রেডিট থেকে পৃথক')}</p>}
        </article>
      ))}
    </section>
  </div>;
};
