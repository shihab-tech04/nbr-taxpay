import type { BeneficiaryPaymentEntry } from './story1AccountPaymentHistory';

type ReferenceEntry = Pick<BeneficiaryPaymentEntry, 'paymentId' | 'batchId' | 'receipt'>;

/** References shown on the original receipt and permitted Payment Certificate. */
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
