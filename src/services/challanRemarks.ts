export const MAX_CHALLAN_REMARKS_CHARACTERS = 4000;

/**
 * Match PostgreSQL char_length() for valid Unicode text. HTML maxlength counts
 * UTF-16 code units, which would halve the supported limit for non-BMP text.
 */
export function limitChallanRemarks(value: string): string {
  return Array.from(value).slice(0, MAX_CHALLAN_REMARKS_CHARACTERS).join('');
}
