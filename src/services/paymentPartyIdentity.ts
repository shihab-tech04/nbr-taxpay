export interface PaymentPartyIdentityInput {
  /** True when the taxpayer is also the payer for this payment. */
  isSelf: boolean;
  recipientTin: string;
  recipientName?: string | null;
  accountName?: string | null;
  payerName?: string | null;
  payerTin?: string | null;
  combinedPayment?: boolean;
}

export interface PaymentPartyIdentity {
  payerName: string;
  payerTin: string;
  taxpayerName?: string;
}

const validTin = (value: string) => /^\d{12,13}$/.test(value);

/** Resolve the payer and recipient from the selected payment relationship.
 * A self-paid guest uses the entered taxpayer TIN for both roles; the TIN is
 * data already entered for this payment and does not grant history access.
 */
export function resolvePaymentPartyIdentity(input: PaymentPartyIdentityInput): PaymentPartyIdentity {
  const recipientTin = input.recipientTin.trim();
  const recipientName = input.accountName?.trim() || input.recipientName?.trim() ||
    (validTin(recipientTin) ? 'TIN ' + recipientTin : '');
  const payerName = input.isSelf ? recipientName : input.payerName?.trim() || '';
  const payerTin = input.payerTin?.trim() ||
    (input.isSelf && validTin(recipientTin) ? recipientTin : 'GUEST');

  return {
    payerName: payerName || '—',
    payerTin,
    taxpayerName: input.combinedPayment ? undefined : recipientName || undefined,
  };
}
