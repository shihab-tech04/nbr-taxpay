import type { ChallanReceipt, PaymentLineItem, ReceiptAllocationItem } from '../types/tax';
import type { StoryPaymentInput } from './simulatedPaymentStory';

/** One immutable SQL payment and one receipt, with independently auditable allocations. */
export type CombinedOtherTaxLine = {
  sourceId: string;
  taxpayerTin: string;
  taxpayerName: string;
  assessmentYear: string;
  amountMinor: number;
  line: PaymentLineItem;
};

const validTin = (value: string) => /^\d{12,13}$/.test(value);
const MAX_LINES = 20;
export function prepareCombinedOtherTaxPayment(
  original: StoryPaymentInput,
  receipt: ChallanReceipt,
  lines: CombinedOtherTaxLine[],
): { payload: StoryPaymentInput; receipt: ChallanReceipt } {
  if (original.service !== 'OTHER_TAX_PAYMENT' || original.details.payerMode !== 'OTHER' &&
    original.details.payerMode !== 'SELF' || lines.length < 1 || lines.length > MAX_LINES ||
    receipt.isSimulatedDemo !== true || receipt.items.length !== lines.length ||
    new Set(lines.map(line => line.sourceId)).size !== lines.length)
    throw new Error('INVALID_COMBINED_PAYMENT');
  let sum = 0;
  for (let i = 0; i < lines.length; i++) {
    const allocation = lines[i];
    if (!allocation.sourceId || !validTin(allocation.taxpayerTin) ||
      !allocation.assessmentYear || !Number.isSafeInteger(allocation.amountMinor) ||
      allocation.amountMinor <= 0 || allocation.line.headId <= 0 ||
      !Number.isSafeInteger(allocation.line.headId) ||
      Math.round(allocation.line.totalAmount * 100) !== allocation.amountMinor ||
      JSON.stringify(receipt.items[i]) !== JSON.stringify(allocation.line))
      throw new Error('INVALID_COMBINED_ALLOCATION');
    sum += allocation.amountMinor;
  }
  if (!Number.isSafeInteger(sum) || sum !== original.amountMinor ||
    Math.round(receipt.totalAmount * 100) !== sum)
    throw new Error('COMBINED_TOTAL_MISMATCH');
  const tins = [...new Set(lines.map(item => item.taxpayerTin))];
  const years = [...new Set(lines.map(item => item.assessmentYear))];
  const allocationItems: ReceiptAllocationItem[] = lines.map(item => ({
    taxpayerName: item.taxpayerName.trim() || 'TIN ' + item.taxpayerTin,
    taxpayerTin: item.taxpayerTin,
    paymentServiceEn: item.line.headNameEn,
    paymentServiceBn: item.line.headNameEn,
    assessmentYear: item.assessmentYear,
    amountMinor: item.amountMinor,
    economicCode: item.line.economicCode,
  }));
  const combinedReceipt: ChallanReceipt = {
    ...receipt,
    taxpayerTin: tins.length === 1 ? tins[0] : undefined,
    assessmentYear: years.join(', '),
    allocationItems,
  };
  const payload: StoryPaymentInput = {
    ...original,
    details: {
      ...original.details,
      combinedPayment: true,
      allocationCount: lines.length,
      taxpayerCount: tins.length,
      taxpayerTin: tins.length === 1 ? tins[0] : '',
      taxpayerName: tins.length === 1 ? lines[0].taxpayerName : tins.length + ' taxpayers',
      assessmentYear: years.join(', '),
      lines: receipt.items,
      allocations: lines.map(item => ({
        taxpayerTin: item.taxpayerTin, taxpayerName: item.taxpayerName,
        headId: item.line.headId, assessmentYear: item.assessmentYear,
        amountMinor: item.amountMinor,
      })),
      totalAmount: sum / 100,
      receiptSnapshot: { ...combinedReceipt, treasuryStatus: 'GATEWAY_SUCCESS' },
    },
  };
  if (JSON.stringify({ ...payload, origin: 'TAXPAY_UI' }).length > 12000)
    throw new Error('PAYMENT_DETAILS_TOO_LONG');
  return { payload, receipt: combinedReceipt };
}
