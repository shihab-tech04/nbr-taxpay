import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePaymentPartyIdentity } from '../src/services/paymentPartyIdentity.ts';

test('guest self payment uses the taxpayer identity as payer and recipient', () => {
  assert.deepEqual(resolvePaymentPartyIdentity({
    isSelf: true,
    recipientTin: '111111111111',
    recipientName: 'User 1',
  }), {
    payerName: 'User 1',
    payerTin: '111111111111',
    taxpayerName: 'User 1',
  });
});

test('a representative keeps their own payer identity separate from the recipient', () => {
  assert.deepEqual(resolvePaymentPartyIdentity({
    isSelf: false,
    recipientTin: '111111111111',
    recipientName: 'User 1',
    payerName: 'Walk-in payer',
    payerTin: '222222222222',
  }), {
    payerName: 'Walk-in payer',
    payerTin: '222222222222',
    taxpayerName: 'User 1',
  });
});

test('signed-in self identity uses the account profile while retaining its TIN', () => {
  assert.deepEqual(resolvePaymentPartyIdentity({
    isSelf: true,
    recipientTin: '111111111111',
    recipientName: 'Old name',
    accountName: 'User 1',
    payerTin: '111111111111',
  }), {
    payerName: 'User 1',
    payerTin: '111111111111',
    taxpayerName: 'User 1',
  });
});

test('combined payments keep beneficiary names in their allocations rather than one parent recipient', () => {
  assert.deepEqual(resolvePaymentPartyIdentity({
    isSelf: true,
    recipientTin: '111111111111',
    recipientName: 'User 1',
    combinedPayment: true,
  }), {
    payerName: 'User 1',
    payerTin: '111111111111',
    taxpayerName: undefined,
  });
});

test('guest self payment retains the entered TIN when no taxpayer name is available', () => {
  assert.deepEqual(resolvePaymentPartyIdentity({
    isSelf: true,
    recipientTin: '123456789012',
  }), {
    payerName: 'TIN 123456789012',
    payerTin: '123456789012',
    taxpayerName: 'TIN 123456789012',
  });
});
