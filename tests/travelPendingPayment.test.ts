import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoverableTravelPayment } from '../src/services/travelPendingPayment';

const nonce = '317a85de-e1d6-41e9-bb9a-0ec040c0e17a';
const session = '165449b4-b58b-4c62-ad65-2da1226f89db';
const economicCode = '1144102';
const people = [
  {name:'Adult Traveller', passportMasked:'••••3456', nationality:'BD', country:'Bangladesh', ageBand:'ADULT', age:34, amount:1000},
  {name:'Child Traveller', passportMasked:'••••4321', nationality:'FOREIGN', country:'India', ageBand:'CHILD', age:9, amount:500},
  {name:'Exempt Traveller', passportMasked:'••••8901', nationality:'FOREIGN', country:'India', ageBand:'UNDER5', age:3, amount:0},
];
const lines = people.map((person, i) => ({headId:155 + i, economicCode,
  headNameEn:'Travel tax — ' + person.name, taxAmount:person.amount,
  penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:person.amount}));
const receipt = {
  id:'rcpt-trv-'+nonce, taxEventId:'SIM-EVENT-'+nonce,
  paymentTransactionId:'SIM-TOKEN-'+nonce,
  challanNo:'SIM-'+nonce,tokenNumber:'SIM-TOKEN-'+nonce,
  paymentCategory:'TRAVEL_TAX',gatewayTransactionId:'SIM-TXN-'+nonce,
  totalAmount:1500,items:lines,travelDetails:{
    mode:'LAND',departurePort:'Benapole',destination:'India',travelDate:'2026-11-16',economicCode,passengers:people,
  },
};
const saved = {
  idempotencyKey:nonce,sessionId:session,service:'TRAVEL_TAX',amountMinor:150000,
  details:{payerName:'Adult Traveller',paymentMethod:'BKASH',paymentChannel:'NOW',
    receiptReference:'SIM-TOKEN-'+nonce, receiptMobile:'01712345678', travelMode:'LAND',
    departurePort:'Benapole',destination:'India',travelDate:'2026-11-16',economicCode,
    passengers:people, lines, receiptSnapshot:receipt,
  },
};
const snapshot=JSON.stringify(saved);
const candidate = (mutate:(payment:typeof saved)=>void) => {
  // A browser refresh restores JSON, which breaks shared object references
  // between the UI's saved passenger arrays and receiptSnapshot.
  const payment=JSON.parse(snapshot) as typeof saved;mutate(payment);
  return parseRecoverableTravelPayment(JSON.stringify(payment),session);
};

test('M06 lost-response retry preserves exact approved request, including zero-rated child row',()=>{
  assert.deepEqual(parseRecoverableTravelPayment(snapshot,session),saved);
  assert.equal(JSON.stringify(saved),snapshot,'recovery never rewrites original idempotent payload');
  assert.equal(parseRecoverableTravelPayment(snapshot,'different-owner-session'),null);
});

test('M06 corrupted amount/head/passenger/identity retry is rejected without a new payment',()=>{
  assert.equal(candidate(payment=>{payment.details.lines[1].totalAmount=1000}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.items[0].totalAmount=1500}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.items[1].economicCode='WRONG'}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.items[1].headId=155}),null);
  assert.equal(candidate(payment=>{payment.details.passengers[1].amount=1000}),null);
  assert.equal(candidate(payment=>{payment.details.passengers[1].country='Bangladesh'}),null);
  assert.equal(candidate(payment=>{payment.details.passengers[1].age=11}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.items[0].penaltyAmount=100}),null);
  assert.equal(candidate(payment=>{payment.details.lines[0].surchargeAmount=50}),null);
  assert.equal(candidate(payment=>{payment.details.lines[1].interestAmount=1}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.travelDetails.passengers[0].passportMasked='TEST123456'}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.travelDetails.passengers[0].passportMasked='••••1\n23'}),null);
  // The current foreign-passport input permits punctuation; masking must not
  // invalidate a legitimate stored retry with a four-character suffix.
  const punctuation=candidate(payment=>{
    payment.details.receiptSnapshot.travelDetails.passengers[1].passportMasked='••••3-45';
    payment.details.passengers[1].passportMasked='••••3-45';
  });
  assert.equal(punctuation?.details.receiptSnapshot.travelDetails?.passengers[1].passportMasked,'••••3-45');
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.travelDetails.passengers.pop()}),null);
  assert.equal(candidate(payment=>{payment.amountMinor=150001}),null);
  assert.equal(candidate(payment=>{payment.idempotencyKey='wrong'}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.id='rcpt-trv-another'}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.taxEventId='SIM-EVENT-another'}),null);
  assert.equal(candidate(payment=>{payment.details.receiptSnapshot.paymentTransactionId='SIM-TOKEN-another'}),null);
  assert.equal(candidate(payment=>{payment.details.travelDate='2026-11-17'}),null);
  assert.equal(parseRecoverableTravelPayment('{invalid',session),null);
  assert.equal(parseRecoverableTravelPayment(null,session),null);
});

test('M06 original travel date may be past when response recovery occurs; no new rate or date is inferred',()=>{
  const older=candidate(payment=>{payment.details.travelDate='2026-11-10';
    payment.details.receiptSnapshot.travelDetails.travelDate='2026-11-10';});
  assert.equal(older?.details.receiptSnapshot.travelDetails?.travelDate,'2026-11-10');
});
