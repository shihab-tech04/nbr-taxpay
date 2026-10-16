import type { ChallanReceipt, UserRole } from '../types/tax';
import type { DemoUser } from '../data/demoUsers';

const previewRoles: ReadonlySet<UserRole> = new Set([
  'TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'
]);

/**
 * One deliberately narrow source for the uncredentialed taxpayer design preview.
 * A payer reference is sample activity, never evidence of ledger credit ownership.
 *
 * Real application accounts must read their activity from owner-bound SQL, not from
 * the public fixtures. URL-selected demo profiles also cannot read these fixtures:
 * user1 has its own isolated synthetic scenario, and other demo users must sign in
 * to the authorized simulation service for payment history.
 */
export function taxpayerPreviewReceipts(
  receipts: readonly ChallanReceipt[],
  taxpayerTin: string,
  userRole: UserRole,
  demoUser: DemoUser | null,
  authenticated: boolean
): ChallanReceipt[] {
  if (authenticated || demoUser || !previewRoles.has(userRole)) return [];
  return receipts.filter(receipt => receipt.isSimulatedDemo === true && receipt.payerTin === taxpayerTin);
}

/** Only a verified, owner-scoped source may post to a financial tax ledger.
 * The current citizen preview has no such source. Its fixture ledger must never
 * be promoted to personal balances merely because it carries a CONFIRMED flag.
 */
export const hasVerifiedTaxLedgerSource = false;
