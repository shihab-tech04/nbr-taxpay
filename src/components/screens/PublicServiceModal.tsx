import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import '../../styles/taxpay-unified-table.css';
import '../../styles/other-tax-modal.css';
import React from 'react';
import {ArrowRight, Gift, Plane} from 'lucide-react';
import {GiftTaxEntryModal} from './GiftTaxEntryModal';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptLookup } from './ReceiptLookup';
import { PaymentServiceChoiceDialog } from './PaymentServiceChoiceDialog';

export type PublicService = 'status' | 'travel' | 'gift' | 'other';

/** Both public and taxpayer Travel Tax entries use the same modal, form,
 * stage navigation and draft lifecycle; receipt lookup stays independent. */
export function PublicServiceModal({ service, onClose, onChooseOther, onBack }: { service: PublicService; onClose: () => void; onChooseOther?: (service: PublicService) => void; onBack?: () => void }) {
  const { language } = useTaxState();
  if (service === 'travel')
    return <PaymentServiceChoiceDialog initialService="TRAVEL_TAX" onDismiss={onClose} />;

  if (service === 'gift') return <GiftTaxEntryModal onClose={onClose} onBack={() => onChooseOther?.('other')} />;
  if (service === 'other') return <TaxPayModal
    title={language === 'bn' ? 'অন্যান্য কর পরিশোধ' : 'Other tax payments'}
    closeIconLabel={language === 'bn' ? 'বন্ধ করুন' : 'Close modal'}
    service="other-tax" onClose={onClose} onBack={onBack}
    backLabel={language === 'bn' ? 'পেমেন্ট পদ্ধতি নির্বাচন করতে ফিরুন' : 'Back to payment access'}
    hideFooter>
      <div className="space-y-3" data-testid="other-tax-chooser">
        <p className="mb-3 text-sm text-slate-600">{language === 'bn' ? 'পরবর্তী ধাপে যেতে করের ধরন নির্বাচন করুন।' : 'Select a tax type to continue.'}</p>
        {([
          {type: 'travel' as const, Icon: Plane, title: language === 'bn' ? 'ভ্রমণ কর' : 'Travel Tax', detail: language === 'bn' ? 'বিদ্যমান ভ্রমণ কর প্রক্রিয়ায় যান।' : 'Continue through the existing Travel Tax journey.'},
          {type: 'gift' as const, Icon: Gift, title: language === 'bn' ? 'দানকর' : 'Gift Tax', detail: language === 'bn' ? 'দানকর পরিশোধের তথ্য খুলুন।' : 'Enter Gift Tax payment details.'},
        ]).map(({type, Icon, title, detail}) => <button key={type} type="button" onClick={() => onChooseOther?.(type)}
          className={"public-service-option public-service-option--" + type}>
          <span className="public-service-option__icon"><Icon size={22} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-base text-slate-900">{title}</strong><span className="block text-sm text-slate-600">{detail}</span></span>
          <ArrowRight size={18} className="public-service-option__arrow" aria-hidden="true" />
        </button>)}
      </div>
    </TaxPayModal>;

  return <TaxPayModal
    title={language === 'bn' ? 'পেমেন্টের অবস্থা ও রসিদ' : 'Payment status & receipt'}
    closeIconLabel={language === 'bn' ? 'বন্ধ করুন' : 'Close modal'}
    className="receipt-modal"
    footer={<></>}
    service="status"
    onClose={onClose}
  >
    <ReceiptLookup embedded />
  </TaxPayModal>;
}
