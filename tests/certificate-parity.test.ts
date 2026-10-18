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
