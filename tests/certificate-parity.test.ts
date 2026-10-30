import test from 'node:test';
import assert from 'node:assert/strict';
import {makeConfirmedReceipt,validCertificateTransactionId} from '../src/services/confirmedPaymentCertificate';

const id='fd718297-1e32-421c-a951-987f4e92a991';
const record={
 id,service:'PENALTY',amountMinor:260000,status:'SIMULATED_SUCCESS',
 createdAt:'2026-10-18T08:00:00.000Z',
 details:{receiptReference:'ACS-DEMO-123',payerName:'Md. Arif Rahman',
 taxpayerTin:'1111111111111',assessmentYear:'2026-27',paymentMethod:'BKASH',
 lines:[{headId:10,economicCode:'120',headNameEn:'Penalty',taxAmount:0,penaltyAmount:2600,
 surchargeAmount:0,interestAmount:0,totalAmount:2600}]}
};
test('existing SQL payment without snapshot renders actual persisted data, not invented treasury token',()=>{
 const result=makeConfirmedReceipt(record);
 assert.equal(result.paymentTransactionId,id);
 assert.equal(result.paymentCategory,'PENALTY');
 assert.equal(result.totalAmount,2600);
 assert.equal(result.challanNo,'ACS-DEMO-123');
 assert.equal(result.payerName,'Md. Arif Rahman');
 assert.equal(result.tokenNumber,'—');
 assert.equal(result.items[0].penaltyAmount,2600);
 assert.equal(result.taxCreditStatus,'PENDING_RECONCILIATION');
});
test('new TaxPay receipt snapshot retains same head/item/reference from both SQL stores',()=>{
 const snapshot=makeConfirmedReceipt(record);
 const result=makeConfirmedReceipt({...record,details:{...record.details,receiptSnapshot:snapshot}});
 assert.equal(result.paymentTransactionId,id);
 assert.deepEqual(result.items,snapshot.items);
 assert.equal(result.challanNo,snapshot.challanNo);
 assert.equal(result.totalAmount,snapshot.totalAmount);
});
test('tampered or mismatched snapshot cannot override persisted transaction amount or category',()=>{
 const x=makeConfirmedReceipt({...record,details:{...record.details,receiptSnapshot:{
 ...makeConfirmedReceipt(record),totalAmount:1234,paymentCategory:'TRAVEL_TAX'}}});
 assert.equal(x.paymentCategory,'PENALTY');
 assert.equal(x.totalAmount,2600);
});
test('invalid SQL status and malformed id fail closed',()=>{
 assert.equal(validCertificateTransactionId(id),true);
 assert.equal(validCertificateTransactionId('sample-fixture'),false);
 assert.throws(()=>makeConfirmedReceipt({...record,status:'FAILED'}),/cannot be certified/);
});


const allocationRecord={
 ...record,service:'OTHER_TAX_PAYMENT',amountMinor:13000,
 details:{...record.details,lines:[
  {beneficiary:'user8',taxpayerTin:'1111111111111',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:12345},
  {beneficiary:'user9',taxpayerTin:'9999999999999',category:'PENALTY',assessmentYear:'2026-27',amountMinor:655},
 ]}
};
test('combined SQL allocation rows render as taxpayer and service allocations with reconciled minor units',()=>{
 const result=makeConfirmedReceipt(allocationRecord);
 assert.equal(result.totalAmount,130);
 assert.equal(result.assessmentYear,'2026-27');
 assert.deepEqual(result.items,[]);
 assert.deepEqual(result.allocationItems?.map(({taxpayerName,taxpayerTin,assessmentYear,amountMinor})=>({
  taxpayerName,taxpayerTin,assessmentYear,amountMinor
 })),[
  {taxpayerName:'user8',taxpayerTin:'1111111111111',assessmentYear:'2026-27',amountMinor:12345},
  {taxpayerName:'user9',taxpayerTin:'9999999999999',assessmentYear:'2026-27',amountMinor:655},
 ]);
});
test('explicit taxpayer allocation rows are linked to their payment head and assessment year',()=>{
 const result=makeConfirmedReceipt({...allocationRecord,details:{
  ...allocationRecord.details,
  lines:[
   {headId:10,category:'TAX_WITH_RETURN',economicCode:'1-1001-0000-0000',headNameEn:'Income tax',taxAmount:123.45,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:123.45},
   {headId:11,category:'PENALTY',economicCode:'1-2001-0000-0000',headNameEn:'Penalty',taxAmount:0,penaltyAmount:6.55,surchargeAmount:0,interestAmount:0,totalAmount:6.55},
  ],
  allocations:[
   {taxpayerName:'user8',taxpayerTin:'1111111111111',headId:10,assessmentYear:'2026-27',amountMinor:12345},
   {taxpayerName:'user9',taxpayerTin:'9999999999999',headId:11,assessmentYear:'2026-27',amountMinor:655},
  ]
 }});
 assert.equal(result.allocationItems?.[0].paymentServiceEn,'Income tax');
 assert.equal(result.allocationItems?.[1].paymentServiceEn,'Penalty');
 assert.deepEqual(result.items,[]);
});
test('allocation rows with an aggregate mismatch are not shown as reconciled allocations',()=>{
 const result=makeConfirmedReceipt({...allocationRecord,amountMinor:13001});
 assert.equal(result.allocationItems,undefined);
 assert.deepEqual(result.items,[]);
});
test('empty zero-value standard rows do not create false receipt lines',()=>{
 const result=makeConfirmedReceipt({...record,details:{
  ...record.details,
  lines:[...record.details.lines,{headId:0,economicCode:'',headNameEn:'',taxAmount:0,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:0},{headId:12,economicCode:'',headNameEn:'',taxAmount:12,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:12}]
 }});
 assert.equal(result.items.length,2);
 assert.equal(result.items[1].totalAmount,12);
});
