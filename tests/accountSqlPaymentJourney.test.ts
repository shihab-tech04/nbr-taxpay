import assert from 'node:assert/strict';
import {test} from 'node:test';
import {projectAccountSqlPaymentJourney} from '../src/services/accountSqlPaymentJourney';
import type {OwnedStoryPayment} from '../src/services/story1AccountPaymentHistory';

const payment:OwnedStoryPayment={
  id:'00000000-0000-4000-8000-000000000911',service:'TAX_WITH_RETURN',
  amountMinor:5000,status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
  details:{
    payerName:'Payer',taxpayerTin:'MULTIPLE_BENEFICIARIES',assessmentYear:'2026-27',
    lines:[
      {headId:68,headNameEn:'Tax head 68A',economicCode:'68A'},
      {headId:69,headNameEn:'Tax head 68B',economicCode:'68B'},
    ],
    allocations:[
      {taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',headId:68,amountMinor:1500,assessmentYear:'2026-27'},
      {taxpayerTin:'012345678902',taxpayerName:'Beneficiary B',headId:69,amountMinor:3500,assessmentYear:'2025-26'},
    ],
  },
};

test('Taxpayer journey preserves per-beneficiary head, AY and amount for Office SQL transaction identity',()=>{
  const entries=projectAccountSqlPaymentJourney([payment]);
  assert.equal(entries.length,2);
  assert.deepEqual(entries.map(e=>e.amountMinor),[1500,3500]);
  assert.deepEqual(entries.map(e=>e.taxpayerTin),['012345678901','012345678902']);
  assert.deepEqual(entries.map(e=>e.assessmentYear),['2026-27','2025-26']);
  assert.deepEqual(entries.map(e=>e.paymentHead),['Tax head 68A','Tax head 68B']);
  assert.ok(entries.every(e=>e.paymentId===payment.id && e.occurredAt===payment.createdAt));
  assert.ok(entries.every(e=>e.recordedStatus==='RECORDED'));
  assert.ok(entries.every(e=>e.receipt.totalAmount===50));
  assert.ok(entries.every(e=>e.receipt.allocationItems?.length===2));
});

test('Payment journey preserves full immutable history order and single-recipient fallback',()=>{
  const earlier:OwnedStoryPayment={id:'00000000-0000-4000-8000-000000000912',service:'ADVANCE_TAX',
    amountMinor:1200,status:'SIMULATED_SUCCESS',createdAt:'2025-01-01T10:00:00Z',
    details:{taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',assessmentYear:'2024-25'}};
  const entries=projectAccountSqlPaymentJourney([earlier,payment]);
  assert.equal(entries.length,3);
  assert.equal(entries[2].paymentId,earlier.id);
  assert.equal(entries[2].amountMinor,1200);
  assert.equal(entries[2].taxpayerTin,'012345678901');
  assert.equal(entries[2].assessmentYear,'2024-25');
});

test('Invalid, duplicate and unreconciled records fail closed',()=>{
  assert.throws(()=>projectAccountSqlPaymentJourney([payment,payment]),/Invalid account payment chronology/);
  assert.throws(()=>projectAccountSqlPaymentJourney([{...payment,createdAt:'not a date'}]),/Invalid account payment chronology/);
  assert.throws(()=>projectAccountSqlPaymentJourney([{...payment,status:'PENDING'}]),/Invalid account payment chronology/);
  assert.throws(()=>projectAccountSqlPaymentJourney([{...payment,amountMinor:4900}]),/allocations could not be reconciled/i);
});
