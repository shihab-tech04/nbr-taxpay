import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceivedPaymentNotice} from '../src/services/demoReceivedPaymentNotices';

const valid={
  eventId:'parent:allocation:1',
  paymentId:'77777777-7777-4777-8777-777777777777',
  allocationId:'allocation-1',recipientTin:'222222222222',
  headId:'121',serviceCode:'ADVANCE_TAX',assessmentYear:'2026-27',
  amountMinor:1500,receiptReference:'SIM-123',createdAt:'2026-11-13T18:00:00Z',
  isRead:false,
};

test('recipient notice retains only own allocation/year and no foreign source details',()=>{
  const parsed=parseReceivedPaymentNotice({...valid,payerTin:'PRIVATE-FOREIGN-TIN',
    allocations:[{taxpayerTin:'333333333333'}]});
  assert.equal(parsed.eventId,valid.eventId);
  assert.equal(parsed.recipientTin,'222222222222');
  assert.equal(parsed.amountMinor,1500);
  assert.equal(parsed.assessmentYear,'2026-27');
  assert.equal(parsed.receiptReference,'SIM-123');
  assert.equal(Object.hasOwn(parsed,'payerTin'),false);
  assert.equal(Object.hasOwn(parsed,'allocations'),false);
});

test('recipient notice rejects unsafe amounts, malformed and already-read events',()=>{
  for(const changes of [{amountMinor:Number.MAX_SAFE_INTEGER+1},{amountMinor:0},
    {amountMinor:-1},{amountMinor:1.5},{isRead:true},
    {eventId:''},{paymentId:'wrong-id'},{createdAt:'not-a-date'}]){
    assert.throws(()=>parseReceivedPaymentNotice({...valid,...changes}));
  }
});
