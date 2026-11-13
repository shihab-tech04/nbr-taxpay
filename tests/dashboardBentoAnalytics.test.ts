import test from 'node:test';
import assert from 'node:assert/strict';
import type {ChallanReceipt} from '../src/types/tax';
import {
  projectDashboardChartRecords,chooseDashboardChartSource,formatDashboardChartMoney,dashboardChartPercentage,
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


test('overview selects recorded data first, otherwise explicitly identified examples',()=>{
  const examples:DashboardChartRecord[]=[
    {id:'example-direct',year:'2025-2026',kind:'income',amount:300,
      state:'POSTED',beneficiaryTin:family},
    {id:'employer-withholding',year:'2025-2026',kind:'tds',amount:500,
      state:'POSTED',beneficiaryTin:family},
    {id:'failed-attempt',year:'2025-2026',kind:'income',amount:100,
      state:'FAILED',beneficiaryTin:family}
  ];
  assert.equal(chooseDashboardChartSource(examples,'2025-2026',people,owner),'example');
  const illustrative=projectDashboardChartRecords(examples,'2025-2026','example',people,owner);
  assert.equal(illustrative.paymentCount,1);
  assert.equal(illustrative.totalMinor,30000n);
  const stored=recorded('sql-1',[receipt('receipt-9','TRAVEL_TAX',[
    {tin:family,year:'2025-2026',minor:2500}
  ])]);
  assert.equal(chooseDashboardChartSource([...examples,stored],'2025-2026',people,owner),'recorded');
  const real=projectDashboardChartRecords([...examples,stored],'2025-2026','recorded',people,owner);
  assert.equal(real.totalMinor,2500n);
  assert.equal(real.paymentCount,1);
});

test('unclassified amounts distinguish known untagged recipients from missing recipients',()=>{
  const rows:DashboardChartRecord[]=[
    {id:'recipient-a',year:'2025-2026',kind:'income',amount:300,state:'POSTED',beneficiaryTin:family},
    {id:'recipient-b',year:'2025-2026',kind:'travel',amount:65,state:'POSTED',beneficiaryTin:'888888888888'},
    {id:'missing-a',year:'2025-2026',kind:'ait',amount:120,state:'POSTED'},
    {id:'missing-b',year:'2025-2026',kind:'ait',amount:200,state:'POSTED'},
    {id:'pending',year:'2025-2026',kind:'income',amount:1000,state:'FAILED'},
    {id:'other-year',year:'2026-2027',kind:'income',amount:1000,state:'POSTED'}
  ];
  const result=projectDashboardChartRecords(rows,'2025-2026','example',[],owner);
  assert.equal(result.totalMinor,68500n);
  assert.equal(result.unclassified.recipientKnownMinor,36500n);
  assert.equal(result.unclassified.recipientMissingMinor,32000n);
  assert.equal(result.unclassified.untaggedRecipientCount,2);
  assert.equal(result.unclassified.missingRecipientPaymentCount,2);
  assert.equal(result.byTag.find(slice=>slice.key==='unassigned')?.amountMinor,
    result.unclassified.recipientKnownMinor+result.unclassified.recipientMissingMinor);

  // A saved relationship classifies only the matching TIN; never allocate
  // the unrelated, missing-recipient advances to the same relationship.
  const classified=projectDashboardChartRecords(rows,'2025-26','example',
    [{tin:family,tag:'friends_family',relationship:'father'}],owner);
  assert.equal(classified.byTag.find(slice=>slice.key==='family')?.amountMinor,30000n);
  assert.equal(classified.unclassified.recipientKnownMinor,6500n);
  assert.equal(classified.unclassified.recipientMissingMinor,32000n);
  assert.equal(classified.unclassified.untaggedRecipientCount,1);

  const travel=projectDashboardChartRecords(rows,'2025-26','example',[],owner,'travel');
  assert.equal(travel.totalMinor,6500n);
  assert.equal(travel.unclassified.recipientKnownMinor,6500n);
  assert.equal(travel.unclassified.recipientMissingMinor,0n);
  assert.equal(travel.unclassified.missingRecipientPaymentCount,0);
});

test('ranking by recipient counts combined receipts once across payment heads',()=>{
  const combined=recorded('combined-1',[
    receipt('receipt-6','OTHER_TAX_PAYMENT',[
      {tin:family,year:'2026-27',minor:12000},
      {tin:family,year:'2026-27',minor:8000},
      {tin:friend,year:'2026-27',minor:9000}]),
    receipt('receipt-7','ADVANCE_TAX',[
      {tin:family,year:'2026-27',minor:40000},
      {year:'2026-27',minor:3000},
      {tin:owner,year:'2025-26',minor:10000}])
  ]);
  const other=recorded('combined-2',[
    receipt('receipt-8','TRAVEL_TAX',[{tin:friend,year:'2026-27',minor:20000}])
  ]);
  const peopleWithNames=[
    {...people[0],display_name:'Saved relative'},
    {...people[1],display_name:'Saved friend'}
  ];
  const projection=projectDashboardChartRecords([combined,other],'2026-27','recorded',peopleWithNames,owner);
  assert.equal(projection.totalMinor,92000n);
  assert.equal(projection.byBeneficiary.length,2);
  assert.equal(projection.byBeneficiary[0].tin,family);
  assert.equal(projection.byBeneficiary[0].name,'Saved relative');
  assert.equal(projection.byBeneficiary[0].tag,'family');
  assert.equal(projection.byBeneficiary[0].amountMinor,60000n);
  assert.equal(projection.byBeneficiary[0].paymentCount,1);
  assert.equal(projection.byBeneficiary[1].tin,friend);
  assert.equal(projection.byBeneficiary[1].amountMinor,29000n);
  assert.equal(projection.byBeneficiary[1].paymentCount,2);
  assert.equal(projection.unclassified.recipientMissingMinor,3000n);
  assert.equal(projection.byBeneficiary.reduce((sum,x)=>sum+x.amountMinor,0n)
    +projection.unclassified.recipientMissingMinor,projection.totalMinor);
  const travel=projectDashboardChartRecords([combined,other],'2026-27','recorded',peopleWithNames,owner,'travel');
  assert.equal(travel.byBeneficiary.length,1);
  assert.equal(travel.byBeneficiary[0].tin,friend);
  assert.equal(travel.byBeneficiary[0].amountMinor,20000n);
  const older=projectDashboardChartRecords([combined,other],'2025-26','recorded',peopleWithNames,owner);
  assert.equal(older.byBeneficiary[0].tin,owner);
  assert.equal(older.byBeneficiary[0].tag,'own');
});

test('ranked beneficiaries are never fabricated from missing recipient IDs or example payments',()=>{
  const rows:DashboardChartRecord[]=[
    {id:'example-one',year:'2025-2026',kind:'income',amount:450,state:'POSTED',beneficiaryTin:family},
    {id:'example-two',year:'2025-2026',kind:'travel',amount:65,state:'POSTED',beneficiaryTin:friend},
    {id:'no-recipient',year:'2025-2026',kind:'ait',amount:320,state:'POSTED'},
    {id:'failed',year:'2025-2026',kind:'income',amount:100,state:'FAILED',beneficiaryTin:family},
    recorded('sql-1',[receipt('receipt-9','OTHER_TAX_PAYMENT',[
      {tin:owner,year:'2025-26',minor:2500}
    ])])
  ];
  const shown=projectDashboardChartRecords(rows,'2025-26','example',[],owner);
  assert.equal(shown.byBeneficiary.length,2);
  assert.equal(shown.byBeneficiary[0].amountMinor,45000n);
  assert.equal(shown.byBeneficiary[0].name,null);
  assert.equal(shown.byBeneficiary[0].saved,false);
  assert.equal(shown.byBeneficiary[1].amountMinor,6500n);
  assert.equal(shown.unclassified.recipientMissingMinor,32000n);
  assert.equal(shown.totalMinor,83500n);
  const saved=projectDashboardChartRecords(rows,'2025-26','recorded',[],owner);
  assert.equal(saved.byBeneficiary.length,1);
  assert.equal(saved.byBeneficiary[0].tin,owner);
  assert.equal(saved.byBeneficiary[0].amountMinor,2500n);
  const selected=projectDashboardChartRecords(rows,'2025-26','example',[],owner,'travel');
  assert.deepEqual(selected.byBeneficiary.map(item=>item.tin),[friend]);
});
