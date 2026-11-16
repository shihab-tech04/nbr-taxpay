import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAccountReceivedPaymentPage} from '../src/services/verifiedAccountNoticePage';

const row={
  eventId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:allocation:1',
  paymentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  allocationId:'al-A',
  recipientTin:null,
  receiptReference:'REF-2026-001',
  serviceCode:'OTHER_TAX_PAYMENT',
  headId:'10',
  assessmentYear:'2026-27',
  amountMinor:1000,
  createdAt:'2026-11-16T00:00:00Z',
  isRead:false,
  recordState:'RECORDED_NOT_CONFIRMED_TAX_CREDIT',
};
test('accept only private, source-proven recipient notice pages',()=>{
  const page={items:[row],total:1,hasMore:false,offset:0,limit:100};
  assert.equal(validateAccountReceivedPaymentPage(page),page);
  const empty={...page,items:[]};
  assert.equal(validateAccountReceivedPaymentPage(empty),empty);
});
test('reject any disclosed TIN, missing provenance or false credit claim',()=>{
  for(const item of [
    {...row,recipientTin:'111111111111'},
    {...row,recipientTin:undefined},
    {...row,recordState:'TAX_CREDIT_CONFIRMED'},
    {...row,recordState:null},
    {...row,recordState:undefined},
  ]) assert.throws(()=>validateAccountReceivedPaymentPage({items:[item]}));
});
test('reject malformed notice payloads before showing payment details',()=>{
  for(const input of [null,[],{}, {items:null},{items:[null]},{items:['bad']}] )
    assert.throws(()=>validateAccountReceivedPaymentPage(input));
});
