/** Exact 2-decimal BDT draft display from integer minor units.
 * All finance calculations remain integer-based; does not assert a tax due.
 */
export function formatBdtMinorUnits(minor: number, locale: 'en' | 'bn' = 'en'): string {
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > 99999999999999) {
    throw new Error('Invalid integer BDT minor-unit amount');
  }
  const whole = BigInt(minor) / 100n;
  const fraction = String(BigInt(minor) % 100n).padStart(2, '0');
  const en = whole.toLocaleString('en-BD') + '.' + fraction;
  return locale === 'bn' ? en.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : en;
}
