import type { BeneficiaryPaymentEntry } from './story1AccountPaymentHistory';

type ReferenceEntry = Pick<BeneficiaryPaymentEntry, 'paymentId' | 'batchId' | 'receipt'>;

/** Original SQL-backed receipt identifiers and the permitted Payment Certificate reference.
 * Do not fabricate official challans or infer identity from a user-entered TIN.
 */
export function accountBeneficiaryPaymentReferences(entry: ReferenceEntry): string[] {
  const transactionId = entry.receipt.paymentTransactionId?.trim() ?? '';
  return [...new Set([
    entry.receipt.challanNo,
    entry.receipt.tokenNumber,
    entry.paymentId,
    entry.batchId ?? '',
    transactionId,
    entry.receipt.gatewayTransactionId ?? '',
    transactionId ? `SK-PC-${transactionId}` : '',
  ].map(value => value.trim()).filter(Boolean))];
}

export function displayAccountBeneficiaryPaymentReference(entry: ReferenceEntry): string {
  const receiptReference = entry.receipt.challanNo.trim();
  const paymentId = entry.paymentId;
  if (!receiptReference || receiptReference === paymentId) return paymentId;
  return `${receiptReference} · ${paymentId}`;
}
