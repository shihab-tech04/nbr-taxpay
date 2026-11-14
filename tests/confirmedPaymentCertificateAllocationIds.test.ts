import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER_PAYMENT_HEADS } from '../src/data/paymentHeads.ts';
import { makeConfirmedReceipt } from '../src/services/confirmedPaymentCertificate.ts';
import type { ChallanReceipt, PaymentLineItem } from '../src/types/tax.ts';
import { buildPaymentCertificateModel } from '../src/services/paymentCertificateModel.ts';

const paymentId='00000000-0000-4000-8000-000000000501';
const lines:PaymentLineItem[]=[
  {headId:8,economicCode:'11',headNameEn:'Deduction from Salary',
    taxAmount:12,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:12},
  {headId:145,economicCode:'135',headNameEn:'Tax on notice of demand',
    taxAmount:18,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:18},
];
const serviceBn=(index:number)=>MASTER_PAYMENT_HEADS.find(head=>
  head.id===lines[index].headId&&head.nameEn===lines[index].headNameEn)?.nameBn||lines[index].headNameEn;
const allocationItems=[
  {allocationId:'one',taxpayerTin:'111111111111',taxpayerName:'First beneficiary',
    paymentServiceEn:lines[0].headNameEn,paymentServiceBn:serviceBn(0),
    assessmentYear:'2026-27',amountMinor:1200,economicCode:'11'},
  {allocationId:'two',taxpayerTin:'222222222222',taxpayerName:'Second beneficiary',
    paymentServiceEn:lines[1].headNameEn,paymentServiceBn:serviceBn(1),
    assessmentYear:'2025-26',amountMinor:1800,economicCode:'135'},
];

function validDetails():Record<string,unknown>{
  return {
    allocationContractVersion:3,
    lines:structuredClone(lines),
    allocations:allocationItems.map((item,index)=>({
      allocationId:item.allocationId,taxpayerTin:item.taxpayerTin,taxpayerName:item.taxpayerName,
      headId:lines[index].headId,assessmentYear:item.assessmentYear,amountMinor:item.amountMinor,
    })),
    receiptSnapshot:{
      paymentCategory:'OTHER_TAX_PAYMENT',totalAmount:30,
      payerName:'Saved combined payer',payerTin:'9999999999999',
      challanNo:'COMBINED-501',
      isRepresentativePayment:true,items:structuredClone(lines),
      allocationItems:structuredClone(allocationItems),
    },
  };
}

function confirm(details:Record<string,unknown>):ChallanReceipt{
  return makeConfirmedReceipt({
    id:paymentId,service:'OTHER_TAX_PAYMENT',amountMinor:3000,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-13T12:00:00.000Z',details,
  });
}

test('confirmed v3 certificate reconstruction retains the saved allocation identities and exact amounts',()=>{
  const receipt=confirm(validDetails());
  assert.deepEqual(receipt.allocationItems?.map(item=>item.allocationId),['one','two']);
  const certificate=buildPaymentCertificateModel(receipt);
  assert.ok(certificate);
  assert.deepEqual(certificate.lines.map(line=>line.allocationId),['one','two']);
  assert.deepEqual(receipt.allocationItems?.map(item=>[item.taxpayerTin,item.assessmentYear,item.amountMinor]),[
    ['111111111111','2026-27',1200],['222222222222','2025-26',1800],
  ]);
});

test('confirmed v3 reconstruction refuses missing, blank, duplicate or inconsistent saved allocation identities',()=>{
  const malformed:Array<[string,(details:Record<string,unknown>)=>void]>=[
    ['missing allocation ID',details=>{
      delete (details.allocations as Array<Record<string,unknown>>)[0].allocationId;
    }],
    ['blank allocation ID',details=>{
      (details.allocations as Array<Record<string,unknown>>)[0].allocationId='  ';
    }],
    ['duplicate allocation ID',details=>{
      (details.allocations as Array<Record<string,unknown>>)[1].allocationId='one';
    }],
    ['snapshot allocation ID mismatch',details=>{
      const snapshot=details.receiptSnapshot as ChallanReceipt;
      snapshot.allocationItems![0].allocationId='changed';
    }],
    ['snapshot beneficiary mismatch',details=>{
      const snapshot=details.receiptSnapshot as ChallanReceipt;
      snapshot.allocationItems![0].taxpayerTin='222222222222';
    }],
    ['snapshot amount mismatch',details=>{
      const snapshot=details.receiptSnapshot as ChallanReceipt;
      snapshot.allocationItems![0].amountMinor=1199;
    }],
    ['snapshot tax-head mismatch',details=>{
      const snapshot=details.receiptSnapshot as ChallanReceipt;
      snapshot.items[0].headId=145;
    }],
  ];
  for(const [name,mutate] of malformed){
    const details=validDetails();
    mutate(details);
    assert.throws(()=>confirm(details),/allocations could not be reconciled/,name);
  }
});

test('confirmed v2 and unversioned certificate recovery keeps legacy rows without fabricating IDs',()=>{
  for(const version of [2,undefined]){
    const details=validDetails();
    if(version===undefined)delete details.allocationContractVersion;
    else details.allocationContractVersion=version;
    for(const allocation of details.allocations as Array<Record<string,unknown>>) delete allocation.allocationId;
    const snapshot=details.receiptSnapshot as ChallanReceipt;
    for(const item of snapshot.allocationItems??[]) delete item.allocationId;
    const receipt=confirm(details);
    assert.deepEqual(receipt.allocationItems?.map(item=>item.allocationId),[undefined,undefined]);
    assert.deepEqual(receipt.allocationItems?.map(item=>item.amountMinor),[1200,1800]);
  }
});


test('Travel Tax Pay Again certificate uses the new parent and reference while preserving the original document',()=>{
  const oldId='00000000-0000-4000-8000-000000000901';
  const newId='00000000-0000-4000-8000-000000000902';
  const createdAt='2026-11-13T12:00:00.000Z';
  const travelSnapshot=(id:string,challanNo:string):ChallanReceipt=>({
    id,paymentTransactionId:id,challanNo,tokenNumber:'—',
    paymentCategory:'TRAVEL_TAX',assessmentYear:'2026-27',
    payerName:'Travel payer',payerTin:'1111111111111',
    isRepresentativePayment:false,taxZone:'',taxCircle:'',isWithholding:false,
    items:[],totalAmount:1500,paymentMethod:'SIMULATED',
    gatewayTransactionId:id,treasuryStatus:'GATEWAY_SUCCESS',
    taxCreditStatus:'PENDING_RECONCILIATION',createdAt,completedAt:createdAt,
    isSimulatedDemo:true,
    taxpayerName:undefined,taxpayerTin:undefined,receiptMobile:'01712345678',
    travelDetails:{
      mode:'LAND',departurePort:'Benapole',destination:'India',travelDate:'2026-11-20',
      economicCode:'1144102',passengers:[
        {name:'Traveler One',passportMasked:'••••3456',nationality:'BD',country:'Bangladesh',ageBand:'ADULT',age:32,amount:1000},
        {name:'Traveler Two',passportMasked:'••••4321',nationality:'FOREIGN',country:'India',ageBand:'CHILD',age:8,amount:500},
      ],
    },
  });
  const originalSnapshot=travelSnapshot(oldId,'TRAVEL-ORIGINAL');
  const originalBefore=structuredClone(originalSnapshot);
  const original=makeConfirmedReceipt({
    id:oldId,service:'TRAVEL_TAX',amountMinor:150000,status:'SIMULATED_SUCCESS',createdAt,
    details:{payerName:'Travel payer',payerTin:'1111111111111',receiptReference:'TRAVEL-ORIGINAL',receiptSnapshot:originalSnapshot},
  });
  const payAgainSnapshot={...originalSnapshot,id:oldId,paymentTransactionId:oldId,challanNo:'TRAVEL-NEW'};
  const replacement=makeConfirmedReceipt({
    id:newId,service:'TRAVEL_TAX',amountMinor:150000,status:'SIMULATED_SUCCESS',createdAt,
    details:{sourcePaymentId:oldId,payerName:'Travel payer',payerTin:'1111111111111',
      receiptReference:'TRAVEL-NEW',receiptSnapshot:payAgainSnapshot},
  });
  const originalCertificate=buildPaymentCertificateModel(original);
  const replacementCertificate=buildPaymentCertificateModel(replacement);
  assert.ok(originalCertificate);
  assert.ok(replacementCertificate);
  assert.equal(originalCertificate.paymentTransactionId,oldId);
  assert.equal(originalCertificate.certificateReference,'SK-PC-'+oldId);
  assert.equal(replacement.paymentTransactionId,newId,'confirmed document must bind the saved replacement parent');
  assert.equal(replacementCertificate.paymentTransactionId,newId);
  assert.equal(replacementCertificate.certificateReference,'SK-PC-'+newId);
  assert.equal(replacementCertificate.paymentReference,'TRAVEL-NEW');
  assert.notEqual(replacementCertificate.certificateReference,originalCertificate.certificateReference);
  assert.deepEqual(replacementCertificate.lines,originalCertificate.lines);
  assert.deepEqual(originalSnapshot,originalBefore,'Pay Again never mutates the earlier receipt source');
});
