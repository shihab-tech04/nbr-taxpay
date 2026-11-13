import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER_PAYMENT_HEADS } from '../src/data/paymentHeads.ts';
import { makeConfirmedReceipt } from '../src/services/confirmedPaymentCertificate.ts';
import type { ChallanReceipt, PaymentLineItem } from '../src/types/tax.ts';

const paymentId = '00000000-0000-4000-8000-000000000779';
const lines: PaymentLineItem[] = [
  { headId: 8, economicCode: '11', headNameEn: 'Deduction from Salary', taxAmount: 12, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 12 },
  { headId: 145, economicCode: '135', headNameEn: 'Tax on notice of demand', taxAmount: 18, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 18 },
];
const allocations = [
  { allocationId: 'one', taxpayerTin: '111111111111', taxpayerName: 'First beneficiary', headId: 8, assessmentYear: '2026-27', amountMinor: 1200 },
  { allocationId: 'two', taxpayerTin: '222222222222', taxpayerName: 'Second beneficiary', headId: 145, assessmentYear: '2025-26', amountMinor: 1800 },
];
const serviceBn = (index: number) => MASTER_PAYMENT_HEADS.find(head =>
  head.id === lines[index].headId && head.nameEn === lines[index].headNameEn)?.nameBn || lines[index].headNameEn;
const savedAllocationItems = [
  { ...allocations[0], paymentServiceEn: lines[0].headNameEn, paymentServiceBn: serviceBn(0), economicCode: lines[0].economicCode },
  { ...allocations[1], paymentServiceEn: lines[1].headNameEn, paymentServiceBn: serviceBn(1), economicCode: lines[1].economicCode },
];

function details(version: 2 | 3 | undefined): Record<string, unknown> {
  const savedAllocations = allocations.map(item => ({ ...item }));
  const snapshotItems = savedAllocationItems.map(item => ({ ...item }));
  if (version !== 3) {
    savedAllocations.forEach(item => delete (item as { allocationId?: string }).allocationId);
    snapshotItems.forEach(item => delete (item as { allocationId?: string }).allocationId);
  }
  return {
    ...(version === undefined ? {} : { allocationContractVersion: version }),
    lines: structuredClone(lines),
    receiptLines: structuredClone(lines),
    allocations: savedAllocations,
    receiptSnapshot: {
      paymentCategory: 'OTHER_TAX_PAYMENT',
      totalAmount: 30,
      items: structuredClone(lines),
      allocationItems: snapshotItems,
    },
  };
}

function confirm(saved: Record<string, unknown>): ChallanReceipt {
  return makeConfirmedReceipt({
    id: paymentId,
    service: 'OTHER_TAX_PAYMENT',
    amountMinor: 3000,
    status: 'SIMULATED_SUCCESS',
    createdAt: '2026-11-13T12:00:00.000Z',
    details: saved,
  });
}

test('v3 combined receipt reconstruction preserves the original unique allocation IDs', () => {
  const receipt = confirm(details(3));
  assert.deepEqual(receipt.allocationItems?.map(item => item.allocationId), ['one', 'two']);
  assert.deepEqual(receipt.allocationItems?.map(item => [item.taxpayerTin, item.assessmentYear, item.amountMinor]), [
    ['111111111111', '2026-27', 1200],
    ['222222222222', '2025-26', 1800],
  ]);
});

test('v3 combined receipt reconstruction rejects missing, duplicate, or inconsistent IDs', () => {
  const malformed = [
    (saved: Record<string, unknown>) => delete (saved.allocations as Array<Record<string, unknown>>)[0].allocationId,
    (saved: Record<string, unknown>) => { (saved.allocations as Array<Record<string, unknown>>)[1].allocationId = 'one'; },
    (saved: Record<string, unknown>) => { (((saved.receiptSnapshot as Record<string, unknown>).allocationItems as Array<Record<string, unknown>>)[0]).allocationId = 'changed'; },
  ];
  for (const mutate of malformed) {
    const saved = details(3);
    mutate(saved);
    assert.throws(() => confirm(saved), /allocations could not be reconciled/);
  }
});

test('v2 and unversioned combined recovery never fabricates allocation IDs', () => {
  for (const version of [2, undefined] as const) {
    const receipt = confirm(details(version));
    assert.deepEqual(receipt.allocationItems?.map(item => item.allocationId), [undefined, undefined]);
    assert.deepEqual(receipt.allocationItems?.map(item => item.amountMinor), [1200, 1800]);
  }
});
