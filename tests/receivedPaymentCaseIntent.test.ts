import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReceivedPaymentCaseIntent,isValidReceivedPaymentCaseIntent,receivedAllocationForReference,
} from '../src/services/receivedPaymentCaseIntent';

const paymentId='329c4d63-cc18-4f9b-9fda-e3b25ae4929c';
const notice={
  eventId:paymentId+':allocation:2',
  paymentId,
  allocationId:'source-allocation-0002',
  receiptReference:'TPAY-REF-123456',
};

test('received-payment correction and report handoffs keep exact source allocation',()=>{
  for(const kind of ['CORRECTION_REVIEW','UNSOLICITED_PAYMENT_REPORT'] as const){
    const hint=buildReceivedPaymentCaseIntent(notice,kind,100_000);
    assert.deepEqual(hint,{
      eventId:notice.eventId,
      originalReference:notice.receiptReference,
      targetAllocationId:notice.allocationId,
      caseKind:kind,
      createdAt:100_000,
    });
    assert.equal(isValidReceivedPaymentCaseIntent(hint,100_001),true);
  }
});

test('source parent is used when received challan reference is invalid',()=>{
  const hint=buildReceivedPaymentCaseIntent({...notice,receiptReference:'too short?'},'CORRECTION_REVIEW',100_000);
  assert.equal(hint.originalReference,paymentId);
  assert.equal(isValidReceivedPaymentCaseIntent(hint,100_001),true);
});

test('handoff never transports TIN, amount, contact info or bearer capabilities',()=>{
  const noisyNotice={
    ...notice,recipientTin:'123456789012',amountMinor:25000,
    capability:'placeholder',phone:'placeholder',
  };
  const hint=buildReceivedPaymentCaseIntent(noisyNotice,'UNSOLICITED_PAYMENT_REPORT',100_000);
  const serialized=JSON.stringify(hint);
  assert.equal(serialized.includes('123456789012'),false);
  assert.equal(serialized.includes('25000'),false);
  assert.equal(serialized.includes('placeholder'),false);
  assert.equal(serialized.includes('capability'),false);
});

test('invalid, stale, future and tampered client hints are rejected',()=>{
  const valid=buildReceivedPaymentCaseIntent(notice,'CORRECTION_REVIEW',100_000);
  assert.equal(isValidReceivedPaymentCaseIntent(valid,100_000+30*60*1000+1),false);
  assert.equal(isValidReceivedPaymentCaseIntent(valid,99_999),false);
  assert.equal(isValidReceivedPaymentCaseIntent({...valid,targetAllocationId:'  bad'},100_001),false);
  assert.equal(isValidReceivedPaymentCaseIntent({...valid,caseKind:'ADMIN_APPROVED'},100_001),false);
  assert.equal(isValidReceivedPaymentCaseIntent({...valid,requesterUid:'someone'},100_001),false);
  assert.throws(()=>buildReceivedPaymentCaseIntent({
    ...notice,eventId:'another-person:allocation:2',
  },'CORRECTION_REVIEW',100_000));
  assert.throws(()=>buildReceivedPaymentCaseIntent({
    ...notice,allocationId:' '.repeat(129),
  },'CORRECTION_REVIEW',100_000));
});

test('recipient-only report bypasses payer claims only for same notice reference',()=>{
  const intent=buildReceivedPaymentCaseIntent(notice,'UNSOLICITED_PAYMENT_REPORT',100_000);
  assert.equal(receivedAllocationForReference(intent,'TPAY-REF-123456'),notice.allocationId);
  assert.equal(receivedAllocationForReference(intent,'  TPAY-REF-123456  '),notice.allocationId);
  assert.equal(receivedAllocationForReference(intent,'OTHER-REF-123456'),null);
  assert.equal(receivedAllocationForReference(null,'TPAY-REF-123456'),null);
  assert.equal(receivedAllocationForReference({...intent,targetAllocationId:null},'TPAY-REF-123456'),null);
});
