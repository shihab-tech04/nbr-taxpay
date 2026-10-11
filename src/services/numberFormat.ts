/**
 * Number & Currency Formatting Utilities for NBR TaxPay
 * English & Bengali numeral conversions
 */

const BN_NUMERALS: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
  '.': '.'
};

export const toBengaliNumeral = (num: number | string): string => {
  const str = num.toString();
  return str
    .split('')
    .map(ch => BN_NUMERALS[ch] || ch)
    .join('');
};

export const formatCurrency = (amount: number, lang: 'en' | 'bn' = 'en'): string => {
  const formattedEn = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount);

  if (lang === 'bn') {
    return `৳ ${toBengaliNumeral(formattedEn)}`;
  }
  return `BDT ${formattedEn}`;
};

export const formatNumber = (num: number, lang: 'en' | 'bn' = 'en'): string => {
  const str = num.toLocaleString('en-US');
  if (lang === 'bn') {
    return toBengaliNumeral(str);
  }
  return str;
};
