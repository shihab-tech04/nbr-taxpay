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

test('single historic synthetic payment uses its exact stored TIN, including 13 digits',()=>{
  const tx={
    id:'22222222-2222-4222-8222-222222222222',
    service:'TAX_WITH_RETURN',amountMinor:2500,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-09T10:00:00Z',
    details:{
      taxpayerTin:'1111111111111',
      lines:[{beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2025-26',amountMinor:2500}]
    }
  };
  const receipt=makeConfirmedReceipt(tx);
  assert.equal(receipt.allocationItems?.[0].taxpayerTin,'1111111111111');
  assert.equal(receipt.allocationItems?.[0].assessmentYear,'2025-26');
});

test('old multi-beneficiary synthetic lines resolve each approved illustrative TIN independently',()=>{
  const tx={
    id:'33333333-2222-4333-8333-333333333333',
    service:'TAX_WITH_RETURN',amountMinor:4500,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-09T10:00:00Z',
    details:{
      taxpayerTin:'MULTIPLE_BENEFICIARIES',
      lines:[
        {beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:3000},
        {beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2025-26',amountMinor:1500}
      ]
    }
  };
  const receipt=makeConfirmedReceipt(tx);
  assert.deepEqual(receipt.allocationItems?.map(a=>[a.taxpayerTin,a.amountMinor,a.assessmentYear]),[
    ['222222222222',3000,'2026-27'],
    ['111111111111',1500,'2025-26']
  ]);
});

test('historic saved-TIN alias resolves only a valid literal TIN',()=>{
  const base={
    id:'44444444-2222-4444-8444-444444444444',
    service:'ADVANCE_TAX',amountMinor:1500,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-09T10:00:00Z'
  };
  const receipt=makeConfirmedReceipt({...base,details:{
    lines:[{beneficiary:'SAVED_TIN:909000000013',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:1500}]
  }});
  assert.equal(receipt.allocationItems?.[0].taxpayerTin,'909000000013');
  const invalid=makeConfirmedReceipt({...base,details:{
    lines:[{beneficiary:'SAVED_TIN:invalid',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:1500}]
  }});
  assert.equal(invalid.allocationItems?.[0].taxpayerTin,undefined);
});
