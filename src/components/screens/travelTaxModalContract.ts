/** Consistent modal headings for the same Travel Tax journey from every entry point. */
export const travelTaxModalTitle = (language: 'en' | 'bn') =>
  language === 'bn' ? 'ভ্রমণ কর' : 'Travel tax';

export const travelTaxModalStages = (language: 'en' | 'bn') =>
  language === 'bn'
    ? ['যাত্রী ও রসিদের তথ্য', 'ভ্রমণের তথ্য', 'পর্যালোচনা ও পেমেন্ট', 'সম্মিলিত চালান']
    : ['Passengers and receipt details', 'Travel details', 'Review & payment', 'Combined challan'];
