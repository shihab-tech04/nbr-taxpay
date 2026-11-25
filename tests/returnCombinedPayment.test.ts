import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCombinedOtherTaxPayment } from '../src/services/otherTaxCombinedPayment.ts';
import type { StoryPaymentInput } from '../src/services/simulatedPaymentStory.ts';
import type { ChallanReceipt } from '../src/types/tax.ts';

test('Tax with Return cannot use the combined payment composer', () => {
  const input = {
    service: 'TAX_WITH_RETURN',
    amountMinor: 3000,
    details: { payerMode: 'OTHER' },
  } as unknown as StoryPaymentInput;
  const receipt = {
    paymentCategory: 'TAX_WITH_RETURN',
    isSimulatedDemo: true,
    items: [],
    totalAmount: 30,
  } as unknown as ChallanReceipt;

  assert.throws(
    () => prepareCombinedOtherTaxPayment(input, receipt, []),
    { message: 'INVALID_COMBINED_PAYMENT' },
  );
});
