import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_RECEIPTS } from '../src/data/mockData';
import { DEMO_USERS } from '../src/data/demoUsers';
import { hasVerifiedTaxLedgerSource, taxpayerPreviewReceipts } from '../src/services/taxpayerEvidence';

test('preview activity is restricted to the selected fictional payer and never asserts credit ownership', () => {
  const individual = taxpayerPreviewReceipts(INITIAL_RECEIPTS,'DEMO-TIN-001','TAXPAYER_INDIVIDUAL',null,false);
  const company = taxpayerPreviewReceipts(INITIAL_RECEIPTS,'DEMO-TIN-002','TAXPAYER_CORPORATE',null,false);
  assert.deepEqual(individual.map(receipt=>receipt.id),['rcpt-101','rcpt-102','rcpt-104']);
  assert.deepEqual(company.map(receipt=>receipt.id),['rcpt-103']);
  assert.ok(individual.every(receipt=>receipt.isSimulatedDemo && receipt.payerTin==='DEMO-TIN-001'));
  assert.ok(company.every(receipt=>receipt.isSimulatedDemo && receipt.payerTin==='DEMO-TIN-002'));
});

test('authentication, anonymous guests and URL scenario selection cannot inherit the public financial fixtures', () => {
  for (const [role,demo,authenticated] of [
    ['TAXPAYER_INDIVIDUAL',null,true],
    ['GUEST',null,false],
    ['TAXPAYER_CORPORATE',DEMO_USERS.user2,false],
    ['TAXPAYER_INDIVIDUAL',DEMO_USERS.user1,false]
  ] as const) {
    assert.deepEqual(taxpayerPreviewReceipts(INITIAL_RECEIPTS,'DEMO-TIN-001',role,demo,authenticated),[]);
  }
});

test('public sample accounting fixtures must never be treated as a connected verified tax ledger', () => {
  assert.equal(hasVerifiedTaxLedgerSource,false);
});
