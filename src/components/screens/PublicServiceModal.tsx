import React from 'react';
import { useTaxState } from '../../services/taxState';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptLookup } from './ReceiptLookup';
import { TravelTax } from './TravelTax';

export type PublicService = 'status' | 'travel';

export function PublicServiceModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
  const { language } = useTaxState();
  const bn = language === 'bn';
  const title = service === 'travel'
    ? (bn ? 'ভ্রমণ কর' : 'Travel tax')
    : (bn ? 'পেমেন্টের অবস্থা ও রসিদ' : 'Payment status & receipt');

  return (
    <TaxPayModal
      title={title}
      closeLabel={bn ? 'বন্ধ করুন' : 'Close'}
      closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
      service={service}
      onClose={onClose}
    >
      {service === 'travel' ? (
        <>
          <div className="public-service-dialog__notice" role="note">
            {bn
              ? 'শুধু নমুনা কার্যপ্রবাহ। সরকারি পেমেন্ট বা যাচাইকৃত রসিদ ইস্যু হয় না।'
              : 'Demonstration workflow only. No government payment or verified receipt is issued.'}
          </div>
          <TravelTax embedded />
        </>
      ) : (
        <ReceiptLookup embedded />
      )}
    </TaxPayModal>
  );
}
