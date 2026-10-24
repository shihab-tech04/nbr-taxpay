import type { StoryPaymentNotice, StorySessionPayment } from './simulatedPaymentStory';

/** Reconcile a session-only notification against its SQL-backed simulated payment.
 * A notification without a matching safe integer paisa amount must fail closed.
 * Neither this join nor its status represents settled funds or a tax credit.
 */
export type VerifiedStoryPaymentNotice = StoryPaymentNotice & {
  amountMinor: number;
  service: string;
};

export function reconcileStoryPaymentNotices(
  notices: readonly StoryPaymentNotice[],
  payments: readonly StorySessionPayment[]
): VerifiedStoryPaymentNotice[] {
  const paymentsById = new Map(payments.map(payment => [payment.id, payment]));
  return notices.map(notice => {
    const payment = paymentsById.get(notice.paymentId);
    if (notice.type !== 'SIMULATED_PAYMENT_SUCCESS' ||
      !payment || payment.status !== 'SIMULATED_SUCCESS' ||
      typeof payment.service !== 'string' || !payment.service.trim() ||
      !Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
      throw new Error('Simulation notification has no verified session payment amount');
    }
    return { ...notice, service: payment.service, amountMinor: payment.amountMinor };
  });
}
