import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import '../../styles/taxpay-unified-table.css';
import React from 'react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptLookup } from './ReceiptLookup';
import { PaymentServiceChoiceDialog } from './PaymentServiceChoiceDialog';

export type PublicService = 'status' | 'travel' | 'gift';

/** Both public and taxpayer Travel Tax entries use the same modal, form,
 * stage navigation and draft lifecycle; receipt lookup stays independent. */
export function PublicServiceModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
  const { language, navigate } = useTaxState();
  if (service === 'travel')
    return <PaymentServiceChoiceDialog initialService="TRAVEL_TAX" onDismiss={onClose} />;

  if (service === 'gift') return <TaxPayModal
    title={language === 'bn' ? 'দান কর' : 'Gift Tax'}
    closeIconLabel={language === 'bn' ? 'বন্ধ করুন' : 'Close modal'}
    service="gift" onClose={onClose} hideFooter>
      <div className="space-y-4 p-4 sm:p-5" data-testid="gift-tax-service-information">
        <p className="text-sm leading-6 text-slate-700">{language === 'bn'
          ? 'দান করের জন্য পৃথক পরিশোধের খাত বর্তমানে যাচাইকৃত আয়কর খাততালিকায় নেই। ভুল খাতে পরিশোধ বা কাল্পনিক চালান তৈরি করা হবে না।'
          : 'A separately verified Gift Tax payment head is not configured in the current income-tax catalogue. This service will not submit payments under an unrelated tax head or invent a challan.'}</p>
        <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => { onClose(); navigate('head_catalogue'); }}>
          {language === 'bn' ? 'উপলব্ধ করের খাত দেখুন' : 'View available tax heads'}
        </button>
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
