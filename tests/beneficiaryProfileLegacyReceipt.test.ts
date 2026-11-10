import test from 'node:test';
import assert from 'node:assert/strict';
import {makeConfirmedReceipt} from '../src/services/confirmedPaymentCertificate';

const previousCombinedPayment = () => ({
  id:'11111111-2222-4333-8444-555555555555',
  service:'OTHER_TAX_PAYMENT',
  amountMinor:30000,
  status:'SIMULATED_SUCCESS',
  createdAt:'2026-11-09T10:00:00Z',
  details:{
    payerId:'user1',
    combinedPayment:true,
    // The existing historical synthetic line contract lacks taxpayerTin/headId.
    lines:[
      {beneficiary:'user2',category:'OTHER_TAX_PAYMENT',assessmentYear:'2026-27',amountMinor:10000},
      {beneficiary:'user3',category:'OTHER_TAX_PAYMENT',assessmentYear:'2025-26',amountMinor:20000},
    ],
    receiptLines:[
      {headId:5,headNameEn:'Advance tax',totalAmount:100},
      {headId:6,headNameEn:'Other tax payment',totalAmount:200},
    ],
    allocations:[
      {taxpayerTin:'222222222222',taxpayerName:'Second taxpayer',headId:5,assessmentYear:'2026-27',amountMinor:10000},
      {taxpayerTin:'333333333333',taxpayerName:'Third taxpayer',headId:6,assessmentYear:'2025-26',amountMinor:20000},
    ]
  }
});

test('saved combined beneficiary profile history retains valid legacy TIN, head, year and amount allocations',()=>{
  const receipt=makeConfirmedReceipt(previousCombinedPayment());
  assert.equal(receipt.totalAmount,300);
  assert.equal(receipt.allocationItems?.length,2);
  assert.deepEqual(receipt.allocationItems?.map(row=>[row.taxpayerTin,row.assessmentYear,row.paymentServiceEn,row.amountMinor]),[
    ['222222222222','2026-27','Advance tax',10000],
    ['333333333333','2025-26','Other tax payment',20000]
  ]);
  assert.equal(receipt.allocationItems?.reduce((sum,row)=>sum+row.amountMinor,0),30000);
  assert.equal(receipt.paymentTransactionId,previousCombinedPayment().id);
});

test('historical compatibility never allows a supplied conflicting TIN',()=>{
  const tx=previousCombinedPayment();
  tx.details.lines[0]={...tx.details.lines[0],taxpayerTin:'999999999999'} as typeof tx.details.lines[0];
  assert.throws(()=>makeConfirmedReceipt(tx),/allocations could not be reconciled/);
});

test('historical compatibility never allows a supplied conflicting head or amount',()=>{
  const tx=previousCombinedPayment();
  tx.details.lines[1]={...tx.details.lines[1],headId:999} as typeof tx.details.lines[1];
  assert.throws(()=>makeConfirmedReceipt(tx),/allocations could not be reconciled/);
  const amount=previousCombinedPayment();
  amount.details.receiptLines[0].totalAmount=101;
  assert.throws(()=>makeConfirmedReceipt(amount),/allocations could not be reconciled/);
});
