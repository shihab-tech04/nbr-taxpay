/** Consistent modal headings for the same Travel Tax journey from every entry point. */
export const travelTaxModalTitle = (language: 'en' | 'bn') =>
  language === 'bn' ? 'ভ্রমণ কর' : 'Travel tax';

export const travelTaxModalStages = (language: 'en' | 'bn') =>
  language === 'bn'
    ? ['যাত্রীর তথ্য', 'ভ্রমণের তথ্য', 'চূড়ান্ত পর্যালোচনা']
    : ['Passenger Information', 'Travel Details', 'Final Preview'];
