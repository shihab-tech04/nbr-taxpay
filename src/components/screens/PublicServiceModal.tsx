import React from 'react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptLookup } from './ReceiptLookup';
import { PaymentServiceChoiceDialog } from './PaymentServiceChoiceDialog';

export type PublicService = 'status' | 'travel';

/** Both public and taxpayer Travel Tax entries use the same modal, form,
 * stage navigation and draft lifecycle; receipt lookup stays independent. */
export function PublicServiceModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
  const { language } = useTaxState();
  if (service === 'travel')
    return <PaymentServiceChoiceDialog initialService="TRAVEL_TAX" onDismiss={onClose} />;

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
