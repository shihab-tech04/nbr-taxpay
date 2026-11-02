import {beneficiaryPaymentEntries, getAccountStoryPayments, type OwnedStoryPayment, type BeneficiaryPaymentEntry} from './story1AccountPaymentHistory';

/** Every displayed amount and recipient is projected from the already persisted,
 * owner-scoped Story1 transaction, also read by Office Taxpayer 360.
 * No taxpayer TIN is used to establish the signed-in payer's ownership. */
export type AccountSqlJourneyEvent = BeneficiaryPaymentEntry & {
  occurredAt: string;
  recordedStatus: string;
};

export function projectAccountSqlPaymentJourney(payments: OwnedStoryPayment[]): AccountSqlJourneyEvent[] {
  const byPayment = new Map<string, OwnedStoryPayment>();
  for (const payment of payments) {
    if (byPayment.has(payment.id) || !Number.isFinite(Date.parse(payment.createdAt)) ||
        payment.status !== 'SIMULATED_SUCCESS') {
      throw new Error('Invalid account payment chronology');
    }
    byPayment.set(payment.id, payment);
  }
  return beneficiaryPaymentEntries(payments).map(entry => {
    const source = byPayment.get(entry.paymentId);
    if (!source || !Number.isSafeInteger(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error('Unreconciled account payment allocation');
    }
    return {...entry, occurredAt: source.createdAt, recordedStatus: 'RECORDED'};
  }).sort((left,right) => Date.parse(right.occurredAt)-Date.parse(left.occurredAt) ||
    left.paymentId.localeCompare(right.paymentId) || left.key.localeCompare(right.key));
}

export async function loadAccountSqlPaymentJourney(ownerUid: string): Promise<AccountSqlJourneyEvent[]> {
  return projectAccountSqlPaymentJourney(await getAccountStoryPayments(ownerUid));
}
