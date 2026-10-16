import type { MasterPaymentHead, PaymentCategory } from '../types/tax';
import { isV11HeadReviewBlocked, V11_SOURCE_HEADS } from './v11SourceHeads';

/** Payment choices taken from the supplied v11 HTML, not the earlier illustrative catalogue.
 * The v11 `codeEn` is a source payment-head code, not an ACS economic code.
 * The legacy receipt shape calls this field `economicCode`; no Treasury call uses it.
 */
const PURPOSE_TO_CATEGORY: Record<string, PaymentCategory> = {
  return: 'TAX_WITH_RETURN',
  advance: 'ADVANCE_TAX',
  demand: 'ASSESSED_DEMAND',
  penalty: 'PENALTY',
  deduction: 'SOURCE_TAX_DEPOSIT',
  tribunal: 'APPELLATE_TRIBUNAL',
  other_head: 'OTHER_TAX_PAYMENT',
};

export const V11_PAYMENT_OPTIONS: readonly MasterPaymentHead[] = V11_SOURCE_HEADS.map(head => ({
  id: head.id,
  economicCode: head.codeEn,
  nameEn: head.en,
  nameBn: head.bn ?? head.en,
  category: PURPOSE_TO_CATEGORY[head.purpose],
  sectionAct2023: '—',
  sectionOrdinance1984: head.codeEn,
  isWithholding: head.journey === 'WITHHOLDING',
  status: isV11HeadReviewBlocked(head) ? 'BLOCKED' : 'ACTIVE',
  verificationStatus: 'SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED',
  rateNote: head.note || undefined,
}));
