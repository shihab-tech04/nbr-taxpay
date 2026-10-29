/** Public and taxpayer-facing product identity. Keep API and repository identifiers unchanged. */
export const TAXPAYER_BRAND = {
  bn: 'করবৃত্ত',
  en: 'Korbritto',
  tagline: {
    bn: 'আপনার কর, আপনার হিসাব',
    en: 'Your tax, your records',
  },
} as const;

export const taxpayerBrandName = (language: 'en' | 'bn') => TAXPAYER_BRAND[language];
