import type { PaymentCategory } from '../types/tax';

/**
 * The six fictional taxpayer identities used by the supplied v11 HTML's
 * guestCheckTin() prototype. This is deliberately local sample-form behavior,
 * not an authoritative TIN or government-notice verification service.
 */
// Reassemble known fictional references at runtime so public bundles do not
// embed TIN-shaped identifiers as contiguous static strings.
const sampleTin = (...chunks: string[]) => chunks.join('');
export const V11_GUEST_TINS = [
  sampleTin('1234', '5678', '9012'),
  sampleTin('9876', '5432', '1098'),
  sampleTin('5544', '8721', '3600'),
  sampleTin('4455', '6677', '8899'),
  sampleTin('1122', '3344', '5566'),
  sampleTin('6677', '8899', '0011'),
] as const;

export interface V11GuestNotice {
  tin: string;
  reference: string;
  category: PaymentCategory;
  assessmentYear: string;
  amount: number;
  /** v11 chooses a default head only where DEFAULT_HEAD defines one. */
  defaultHeadId: number | null;
}

/**
 * v11 guestCheckTin() matches references against recommendations(), not the
 * notice face value. In the original seeded ledger the first demand carries
 * an additional 5,000 of accrued interest, so its open amount is 80,000.
 */
export const V11_GUEST_NOTICES: readonly V11GuestNotice[] = [
  {
    tin: V11_GUEST_TINS[0], reference: 'DN-2026-001187', category: 'ASSESSED_DEMAND',
    assessmentYear: '2025-26', amount: 80000, defaultHeadId: 145,
  },
  {
    tin: V11_GUEST_TINS[0], reference: 'PN-2026-000392', category: 'PENALTY',
    assessmentYear: '2025-26', amount: 10000, defaultHeadId: null,
  },
  {
    tin: V11_GUEST_TINS[2], reference: 'DN-2026-004512', category: 'ASSESSED_DEMAND',
    assessmentYear: '2025-26', amount: 250000, defaultHeadId: 145,
  },
] as const;

const KNOWN_TINS = new Set<string>(V11_GUEST_TINS);

export const isV11GuestTin = (tin: string) => KNOWN_TINS.has(tin);

export function findV11GuestNotice(tin: string, reference: string): V11GuestNotice | null {
  const normalized = reference.trim().toUpperCase();
  return V11_GUEST_NOTICES.find(notice => notice.tin === tin && notice.reference === normalized) ?? null;
}
