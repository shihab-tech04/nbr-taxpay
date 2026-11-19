/**
 * Presentation-only TIN mask for all non-Profile taxpayer surfaces.
 * Do not use this for matching, authorization, SQL payloads, receipts or exports.
 * Profile retains its separately authorized reveal/copy behavior.
 */
export function maskTinForDisplay(tin: string | null | undefined): string {
  if (!tin) return '';
  const digits = String(tin);
  return digits.length <= 3 ? '*'.repeat(digits.length)
    : digits.slice(0, 3) + '*'.repeat(digits.length - 3);
}
