import test from 'node:test';
import assert from 'node:assert/strict';
import type {ChallanReceipt} from '../src/types/tax';
import {
  projectDashboardChartRecords,formatDashboardChartMoney,dashboardChartPercentage,
  type DashboardChartRecord
} from '../src/components/screens/dashboardBentoAnalytics';

const receipt=(id:string,category:ChallanReceipt['paymentCategory'],
  allocations:Array<{tin?:string;year:string;minor:number}>):ChallanReceipt=>({
  id,paymentTransactionId:id,batchId:'combined-A',batchItemIndex:Number(id.slice(-1)),
  paymentCategory:category,assessmentYear:'2026-27',
  allocationItems:allocations.map(row=>({
    taxpayerTin:row.tin,taxpayerName:'Account recipient',assessmentYear:row.year,
    amountMinor:row.minor,paymentServiceEn:'Tax service',paymentServiceBn:'কর'
  }))
} as unknown as ChallanReceipt);

const recorded=(id:string,receipts:ChallanReceipt[]):DashboardChartRecord=>({
  id,year:'2025-2026',state:'POSTED',kind:'income',amount:100000,
  sql:{receipts}
});

const owner='111111111111';
const family='222222222222';
const friend='333333333333';
const people=[
  {tin:family,tag:'friends_family' as const,relationship:'father' as const},
  {tin:friend,tag:'friends_family' as const,relationship:'friends' as const}
];

test('combined payments reconcile by recipient and assessment year, not entire batch total',()=>{
  const rows=[
    recorded('batch-A',[
      receipt('receipt-1','OTHER_TAX_PAYMENT',[
        {tin:family,year:'2025-26',minor:10000},
        {tin:friend,year:'2026-27',minor:30000},
      ]),
      receipt('receipt-2','ADVANCE_TAX',[
        {tin:family,year:'2026-27',minor:40000},
        {tin:owner,year:'2025-26',minor:20000},
      ])
    ])
  ];
  const current=projectDashboardChartRecords(rows,'2026-2027','recorded',people,owner);
  assert.equal(current.totalMinor,70000n);
  assert.equal(current.paymentCount,1);
  assert.equal(current.byService.find(x=>x.key==='other')?.amountMinor,30000n);
  assert.equal(current.byService.find(x=>x.key==='ait')?.amountMinor,40000n);
  assert.equal(current.byTag.find(x=>x.key==='family')?.amountMinor,40000n);
  assert.equal(current.byTag.find(x=>x.key==='friends')?.amountMinor,30000n);
  const old=projectDashboardChartRecords(rows,'2025-26','recorded',people,owner);
  assert.equal(old.totalMinor,30000n);
  assert.equal(old.byTag.find(x=>x.key==='own')?.amountMinor,20000n);
  assert.equal(old.byTag.find(x=>x.key==='family')?.amountMinor,10000n);
  assert.equal(current.totalMinor+old.totalMinor,100000n);
  assert.equal(current.byTag.reduce((s,x)=>s+x.amountMinor,0n),current.totalMinor);
});

test('source tabs never mix sample scenarios with account SQL, and service filters use allocations',()=>{
  const rows:DashboardChartRecord[]=[
    recorded('batch-A',[receipt('receipt-3','TRAVEL_TAX',[
      {tin:family,year:'2026-27',minor:9950}
    ])]),
    {id:'example-1',year:'2026-2027',kind:'income',amount:1000,
      state:'POSTED',beneficiaryTin:friend},
    {id:'example-2',year:'2026-2027',kind:'tds',amount:200,
      state:'FAILED',beneficiaryTin:family}
  ];
  const actual=projectDashboardChartRecords(rows,'2026-27','recorded',people,owner,'travel');
  const example=projectDashboardChartRecords(rows,'2026-27','example',people,owner);
  assert.equal(actual.totalMinor,9950n);
  assert.equal(actual.byTag.find(x=>x.key==='family')?.amountMinor,9950n);
  assert.equal(actual.byService.find(x=>x.key==='travel')?.amountMinor,9950n);
  assert.equal(example.totalMinor,100000n);
  assert.equal(example.byTag.find(x=>x.key==='friends')?.amountMinor,100000n);
  assert.equal(example.paymentCount,1);
});

test('incomplete historical receipts and repeated SQL readbacks do not manufacture extra credits',()=>{
  const complete=receipt('receipt-4','TAX_WITH_RETURN',[{tin:family,year:'2026-27',minor:50000}]);
  const legacy=receipt('receipt-5','OTHER_TAX_PAYMENT',[]);
  const rows=[recorded('payment-1',[complete,{...complete},legacy])];
  const result=projectDashboardChartRecords(rows,'2026-27','recorded',[],owner);
  assert.equal(result.totalMinor,50000n);
  assert.equal(result.paymentCount,1);
  assert.equal(result.omittedRecords,1);
  assert.equal(result.byTag.find(x=>x.key==='unassigned')?.amountMinor,50000n);
  assert.equal(result.byTag.reduce((sum,x)=>sum+x.amountMinor,0n),result.totalMinor);
});

test('display percentages stay bounded and minor-unit arithmetic remains exact',()=>{
  assert.equal(formatDashboardChartMoney(10025n,'en'),'৳ 100.25');
  assert.equal(dashboardChartPercentage(1n,3n),33.33);
  assert.equal(dashboardChartPercentage(0n,0n),0);
  assert.deepEqual(projectDashboardChartRecords([], '2026-2027','recorded',[],owner).byService.map(x=>x.amountMinor),[0n,0n,0n,0n,0n]);
});
