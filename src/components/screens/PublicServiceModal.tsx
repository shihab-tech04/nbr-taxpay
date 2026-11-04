import React, { useState } from 'react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptLookup } from './ReceiptLookup';
import { TravelTax } from './TravelTax';

export type PublicService = 'status' | 'travel';

export function PublicServiceModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
  const { language } = useTaxState();
  const bn = language === 'bn';
  const [travelStage, setTravelStage] = useState<1 | 2 | 3 | 4>(1);
  const isTravel = service === 'travel';
  const travelTitle = bn ? 'ভ্রমণ কর' : 'Travel tax';
  const travelStages = bn
    ? ['যাত্রী ও রসিদের তথ্য', 'ভ্রমণের তথ্য', 'পর্যালোচনা ও পেমেন্ট', 'সম্মিলিত চালান']
    : ['Passengers and receipt details', 'Travel details', 'Review & payment', 'Combined challan'];
  const title = isTravel
    ? travelStages[travelStage - 1]
    : (bn ? 'পেমেন্টের অবস্থা ও রসিদ' : 'Payment status & receipt');

  // The top-left control owns stage navigation, exactly as it does in the
  // approved Pay Tax wizard. Stage handlers remain inside the travel form.
  const back = () => {
    if (travelStage === 1) return;
    if (travelStage === 4) {
      // Receipt Back returns to the paid journey review; the X owns dismissal.
      document.querySelector<HTMLButtonElement>(
        '.taxpay-modal[data-public-service="travel"] [data-testid="travel-receipt-back"]'
      )?.click();
      return;
    }
    if (document.querySelector('.taxpay-modal[data-public-service="travel"] .travel-flow[data-receipt-review="true"]')) {
      document.querySelector<HTMLButtonElement>(
        '.taxpay-modal[data-public-service="travel"] .travel-flow__footer-actions .travel-flow__primary'
      )?.click();
      return;
    }
    const previous = document.querySelector<HTMLButtonElement>(
      '.taxpay-modal[data-public-service="travel"] .travel-flow__footer-actions .tax-service-choice__cancel'
    );
    if (previous && !previous.disabled) previous.click();
  };

  return (
    <TaxPayModal
      title={title}
      ariaLabel={isTravel ? travelTitle : undefined}
      progress={isTravel ? { current: travelStage, total: 4, subtitle: travelTitle } : undefined}
      onBack={isTravel && travelStage > 1 ? back : undefined}
      backLabel={bn ? 'ফিরুন' : 'Back'}
      closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
      className={service === 'status' ? 'receipt-modal' : ''}
      footer={<></>}
      service={service}
      onClose={onClose}
    >
      {isTravel ? (
        <TravelTax embedded onStageChange={setTravelStage} />
      ) : (
        <ReceiptLookup embedded />
      )}
    </TaxPayModal>
  );
}
