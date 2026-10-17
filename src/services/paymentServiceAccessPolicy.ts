/**
 * v11 separates paying a tax from reading or changing an account's private data.
 * A portal account is optional for a payment; it is not an authorization to
 * inspect a taxpayer's balances, cases, ledger or eTDS allocations.
 *
 * This is a public capability catalogue, not a substitute for server-side
 * authentication, ownership checks or authoritative NBR reference validation.
 */
export const PAYMENT_SERVICE_IDS = [
  'TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
  'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT', 'TRAVEL_TAX'
] as const;

export type PaymentServiceId = typeof PAYMENT_SERVICE_IDS[number];
export type PaymentOperation =
  | 'MAKE_PAYMENT'
  | 'VIEW_ACCOUNT_RECORDS'
  | 'SAVE_PRIVATE_DRAFT'
  | 'ALLOCATE_ETDS_DEPOSIT';

export type ServiceAccessDecision =
  | { kind: 'PUBLIC'; requiresTin: boolean; requiresNBRReference: boolean }
  | { kind: 'SIGN_IN_REQUIRED'; requiresTin: boolean; requiresNBRReference: boolean }
  | { kind: 'NOT_APPLICABLE'; requiresTin: boolean; requiresNBRReference: boolean };

export function resolvePaymentServiceAccess(
  service: PaymentServiceId,
  operation: PaymentOperation
): ServiceAccessDecision {
  const requiresTin = service !== 'TRAVEL_TAX';
  const requiresNBRReference = service === 'OTHER_TAX_PAYMENT';
  const base = { requiresTin, requiresNBRReference };
  if (operation === 'MAKE_PAYMENT') return { kind: 'PUBLIC', ...base };
  if (operation === 'ALLOCATE_ETDS_DEPOSIT' && service !== 'SOURCE_TAX_DEPOSIT') {
    return { kind: 'NOT_APPLICABLE', ...base };
  }
  if (operation === 'SAVE_PRIVATE_DRAFT' && service === 'TRAVEL_TAX') {
    return { kind: 'NOT_APPLICABLE', ...base };
  }
  return { kind: 'SIGN_IN_REQUIRED', ...base };
}
