import test from 'node:test';
import assert from 'node:assert/strict';
import {activityPaymentBeneficiaries} from '../src/services/activityPaymentBeneficiaries';
import type {Beneficiary} from '../src/services/beneficiaries';
import type {ChallanReceipt,ReceiptAllocationItem} from '../src/types/tax';

const person=(tin:string,name:string,tag:Beneficiary['tag'],relationship:Beneficiary['relationship']=null):Beneficiary=>({
  id:tin,list_id:'list-1',tin,display_name:name,tag,relationship,other_label:null,
  created_at:'2026-11-10T10:00:00Z',updated_at:'2026-11-10T10:00:00Z'
});
const receipt=(allocationItems:ReceiptAllocationItem[],extra:Record<string,unknown>={}):ChallanReceipt=>({
  allocationItems, taxpayerTin:'MULTIPLE_BENEFICIARIES',payerName:'Payer One',
  ...extra
} as unknown as ChallanReceipt);

test('combined multi-beneficiary multi-head multi-year payment shows each person once, own allocated amount and tag',()=>{
  const allocations:ReceiptAllocationItem[]=[
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Advance Tax',paymentServiceBn:'অগ্রিম কর',assessmentYear:'2026-27',amountMinor:10000},
    {taxpayerName:'Three',taxpayerTin:'333333333333',paymentServiceEn:'Penalty',paymentServiceBn:'জরিমানা',assessmentYear:'2025-26',amountMinor:20000},
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Source Tax Deposit',paymentServiceBn:'উৎসে কর',assessmentYear:'2024-25',amountMinor:30000}
  ];
  const rows=activityPaymentBeneficiaries({sql:{receipts:[receipt(allocations)]}},[
    person('222222222222','Saved Two','clients'),
    person('333333333333','Saved Three','friends_family','mother')
  ],'en');
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>[r.name,r.tag,r.amountMinor]),[
    ['Saved Two','Clients',40000],
    ['Saved Three','Mother',20000]
  ]);
  assert.deepEqual(rows[0].assessmentYears,['2026-27','2024-25']);
  assert.deepEqual(rows[0].heads,['Advance Tax','Source Tax Deposit']);
  assert.ok(rows.every(row=>row.saved));
  assert.equal(rows.reduce((sum,row)=>sum+(row.amountMinor??0),0),60000);
});

test('unmatched and unverified beneficiaries do not receive other account tags or profile links',()=>{
  const rows=activityPaymentBeneficiaries({sql:{receipts:[receipt([
    {taxpayerName:'Not saved',taxpayerTin:'444444444444',paymentServiceEn:'Penalty',paymentServiceBn:'জরিমানা',assessmentYear:'2026-27',amountMinor:7000}
  ])]}},[person('222222222222','Private Other','clients')],'en');
  assert.equal(rows.length,1);
  assert.equal(rows[0].saved,false);
  assert.equal(rows[0].tag,null);
  assert.equal(rows[0].tin,'444444444444');
  assert.equal(activityPaymentBeneficiaries({sql:{receipts:[receipt([],{batchId:'batch'})]}},[],'en').length,0);
  assert.equal(activityPaymentBeneficiaries({},[],'en').length,0);
});

test('explicit fictional TIN can link saved profile; conflicting list tags are never chosen arbitrarily',()=>{
  const shared=[
    person('222222222222','Saved','clients'),
    {...person('222222222222','Saved','others'),id:'saved-two',other_label:'Vendor'}
  ];
  const rows=activityPaymentBeneficiaries({beneficiaryTin:'222222222222'},shared,'en');
  assert.equal(rows.length,1);
  assert.equal(rows[0].saved,true);
  assert.equal(rows[0].tag,null);
  assert.equal(rows[0].amountMinor,null);
  assert.equal(activityPaymentBeneficiaries({beneficiaryTin:'invalid'},shared,'en').length,0);
});

test('fallback legacy single-recipient receipt has no invented head allocations or amount',()=>{
  const rows=activityPaymentBeneficiaries({sql:{receipts:[receipt([],{
    taxpayerTin:'909000000013',payerName:'Legacy taxpayer',batchId:undefined,assessmentYear:'2025-26'
  })]}},[],'bn');
  assert.equal(rows.length,1);
  assert.equal(rows[0].tin,'909000000013');
  assert.equal(rows[0].amountMinor,null);
  assert.equal(rows[0].name,'909000000013','never show the payer name as a beneficiary');
  assert.deepEqual(rows[0].heads,[]);
});

test('replayed SQL receipt cannot double beneficiary allocation; distinct batch items remain counted',()=>{
  const first=receipt([
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Advance Tax',paymentServiceBn:'অগ্রিম কর',assessmentYear:'2026-27',amountMinor:10000}
  ],{id:'head-1',paymentTransactionId:'payment-1',batchId:'batch-1',batchItemIndex:1,batchItemCount:2,assessmentYear:'2026-27'});
  const second=receipt([
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Penalty',paymentServiceBn:'জরিমানা',assessmentYear:'2025-26',amountMinor:5000},
    {taxpayerName:'Three',taxpayerTin:'333333333333',paymentServiceEn:'Penalty',paymentServiceBn:'জরিমানা',assessmentYear:'2025-26',amountMinor:20000}
  ],{id:'head-2',paymentTransactionId:'payment-2',batchId:'batch-1',batchItemIndex:2,batchItemCount:2,assessmentYear:'2025-26'});
  const rows=activityPaymentBeneficiaries({sql:{receipts:[first,{...first},second]}},[
    person('222222222222','Saved Two','clients'),
    person('333333333333','Saved Three','friends_family','mother')
  ],'en');
  assert.deepEqual(rows.map(row=>[row.tin,row.amountMinor]),[
    ['222222222222',15000],['333333333333',20000]
  ]);
  assert.deepEqual(rows[0].assessmentYears,['2026-27','2025-26']);
  assert.deepEqual(rows[0].heads,['Advance Tax','Penalty']);
  assert.equal(rows.reduce((sum,row)=>sum+(row.amountMinor??0),0),35000);
});

test('conflicting SQL allocation snapshots for one payment identity fail closed',()=>{
  const one=receipt([
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Advance Tax',paymentServiceBn:'অগ্রিম কর',assessmentYear:'2026-27',amountMinor:10000}
  ],{id:'head-1',paymentTransactionId:'payment-1',batchId:'batch-1',batchItemIndex:1});
  const conflicting=receipt([
    {taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Advance Tax',paymentServiceBn:'অগ্রিম কর',assessmentYear:'2026-27',amountMinor:20000}
  ],{id:'head-1',paymentTransactionId:'payment-1',batchId:'batch-1',batchItemIndex:1});
  assert.deepEqual(activityPaymentBeneficiaries({sql:{receipts:[one,conflicting]}},[
    person('222222222222','Saved Two','clients')
  ],'en'),[]);
});

test('a corrected retry after conflicting history readback restores the one original payment item',()=>{
  const item={taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Advance Tax',paymentServiceBn:'অগ্রিম কর',
    assessmentYear:'2026-27',amountMinor:12500};
  const original=receipt([item],{id:'original-item',paymentTransactionId:'original-payment-id',
    batchId:'original-batch',batchItemIndex:1,batchItemCount:1});
  const conflicting=receipt([{...item,amountMinor:22500}],{id:'original-item',paymentTransactionId:'original-payment-id',
    batchId:'original-batch',batchItemIndex:1,batchItemCount:1});
  const saved=[person('222222222222','Saved Two','clients')];
  const disputed=activityPaymentBeneficiaries({sql:{receipts:[original,conflicting]}},saved,'en');
  assert.deepEqual(disputed,[],'never expose a guessed amount for conflicting immutable IDs');
  const retried=activityPaymentBeneficiaries({sql:{receipts:[original,{...original}]}},saved,'en');
  assert.equal(retried.length,1);
  assert.equal(retried[0].amountMinor,12500,'retry must not double the first payment');
  assert.equal(original.paymentTransactionId,'original-payment-id','source transaction ID is immutable');
  assert.equal(original.batchId,'original-batch');
});

test('read-only beneficiary tags remain scoped to the payer book across successive account views',()=>{
  const paid=receipt([{taxpayerName:'Two',taxpayerTin:'222222222222',paymentServiceEn:'Penalty',
    paymentServiceBn:'জরিমানা',assessmentYear:'2025-26',amountMinor:5500}],
    {id:'payment-item',paymentTransactionId:'payment-id'});
  const history={sql:{receipts:[paid]}};
  const accountA=activityPaymentBeneficiaries(history,[person('222222222222','Account A tag','clients')],'en');
  const accountB=activityPaymentBeneficiaries(history,[person('333333333333','Account B person','others')],'en');
  assert.equal(accountA[0].name,'Account A tag');
  assert.equal(accountA[0].tag,'Clients');
  assert.equal(accountA[0].saved,true);
  assert.equal(accountB[0].name,'Two','a different payer book cannot leak the first account name');
  assert.equal(accountB[0].tag,null);
  assert.equal(accountB[0].saved,false);
  assert.equal(accountB[0].amountMinor,5500,'payment amount stays tied only to receipt TIN');
  assert.equal(activityPaymentBeneficiaries(history,[person('222222222222','Account A tag','clients')],'en')[0].tag,'Clients',
    'second account projection must not overwrite first account tags');
});
