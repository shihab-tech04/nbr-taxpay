import test from 'node:test';
import assert from 'node:assert/strict';
import { groupReceiptAllocations } from '../src/services/receiptAllocationGroups';
import type { ReceiptAllocationItem } from '../src/types/tax';

const allocation = (name: string, tin: string | undefined, head: string, amountMinor: number): ReceiptAllocationItem => ({
  taxpayerName: name, ...(tin ? { taxpayerTin: tin } : {}), paymentServiceEn: head,
  paymentServiceBn: head, assessmentYear: '2026-27', amountMinor,
});

test('receipt groups non-contiguous allocations by exact TIN, preserving original amount and order', () => {
  const source = [
    allocation('First', '123456789012', 'Advance tax', 12345),
    allocation('Second', '987654321098', 'Penalty', 655),
    allocation('First (later display alias)', '123456789012', 'Demand', 3000),
  ];
  const groups = groupReceiptAllocations(source);
  assert.deepEqual(groups.map(group => [group.taxpayerTin, group.items.length, group.totalMinor]), [
    ['123456789012', 2, 15345], ['987654321098', 1, 655],
  ]);
  assert.deepEqual(groups[0].items.map(item => item.paymentServiceEn), ['Advance tax', 'Demand']);
  assert.equal(source[0].amountMinor, 12345);
  assert.equal(source[2].taxpayerName, 'First (later display alias)');
  assert.equal(groups.reduce((sum, group) => sum + group.totalMinor, 0), 16000);
});

test('TIN-less historical receipt rows are never conflated by display name', () => {
  const groups = groupReceiptAllocations([
    allocation('Unknown', undefined, 'Advance tax', 100),
    allocation('Unknown', undefined, 'Penalty', 200),
    allocation('Unknown', '123456789012', 'Advance tax', 300),
    allocation('Unknown', '123456789012', 'Penalty', 400),
  ]);
  assert.deepEqual(groups.map(group => group.items.length), [1, 1, 2]);
  assert.deepEqual(groups.map(group => group.totalMinor), [100, 200, 700]);
});
