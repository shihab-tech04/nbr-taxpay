import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TAXPAY_ENTRY_CHOICES } from './PaymentServiceChoiceDialog';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';

/** A directory of actual payment categories, not the retired connection-status mockup. */
export const PaymentServicesPage: React.FC = () => {
  const { language, setPaymentServiceChoiceOpen } = useTaxState();
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;

  return <div className="taxpayer-payment-services mx-auto max-w-6xl space-y-4 pb-12">
    <TaxpayerPageHeading title={tr('Choose a tax payment service', 'কর পরিশোধের সেবা নির্বাচন করুন')}
      description={tr('Choose who you are paying for, select Tax with Return or Other Tax, then follow the taxpayer details, purpose and amount steps.', 'প্রথমে কার কর পরিশোধ করছেন এবং রিটার্নসহ কর বা অন্যান্য কর বেছে নিন। এরপর করদাতার তথ্য, খাত ও পরিমাণের ধাপ অনুসরণ করুন।')}
      actions={<button type="button" className="taxpayer-service-directory__primary" onClick={() => setPaymentServiceChoiceOpen(true)}>
        {tr('Select a service', 'সেবা নির্বাচন করুন')} <ArrowRight size={18} aria-hidden="true" />
      </button>} />
    <section className="taxpayer-service-directory__grid" aria-label={tr('Two tax payment services', 'দুটি কর পরিশোধ সেবা')}>
      {TAXPAY_ENTRY_CHOICES.map(({ id, Icon, en, bn: bangla, detailEn, detailBn }, index) => (
        <article className="taxpayer-service-directory__card" data-payment-service={id} key={id}>
          <div className="taxpayer-service-directory__card-top">
            <span className="taxpayer-service-directory__icon"><Icon size={22} aria-hidden="true" /></span>
            <span className="taxpayer-service-directory__number">{String(index + 1).padStart(2, '0')}</span>
          </div>
          <h2>{tr(en, bangla)}</h2>
          <p>{tr(detailEn, detailBn)}</p>
          {id === 'OTHER_TAX' && <p className="taxpayer-service-directory__separate">{tr('Other Tax Payment uses its applicable payment heads. Travel Tax follows a separate journey from the Home banner.', 'অন্যান্য কর পরিশোধে প্রযোজ্য খাত বেছে নিতে পারবেন। ভ্রমণ করের ধাপ আলাদা, যা হোম ব্যানার থেকে খোলা যায়।')}</p>}
        </article>
      ))}
    </section>
  </div>;
};
