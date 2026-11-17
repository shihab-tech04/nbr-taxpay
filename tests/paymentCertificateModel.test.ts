import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChallanReceipt } from '../src/types/tax';
import { buildPaymentCertificateModel, canViewPaymentCertificate } from '../src/services/paymentCertificateModel';

const parentId = '3f3a5de8-1f5b-45a4-8a76-87c53e72c001';
const baseReceipt: ChallanReceipt = {
  id: parentId,
  paymentTransactionId: parentId,
  challanNo: 'CH-2026-00051',
  tokenNumber: 'TOKEN-2026-51',
  paymentCategory: 'PENALTY',
  assessmentYear: '2026-27',
  payerName: 'Payer One',
  payerTin: '1111111111111',
  taxpayerName: 'Recipient One',
  taxpayerTin: '2222222222222',
  isRepresentativePayment: true,
  taxZone: 'Taxes Zone 1',
  taxCircle: 'Circle 1',
  isWithholding: false,
  items: [{
    headId: 120, economicCode: '1-1001-0000-1201', headNameEn: 'Penalty',
    taxAmount: 0, penaltyAmount: 50, surchargeAmount: 0, interestAmount: 0,
    totalAmount: 50,
  }],
  totalAmount: 50,
  paymentMethod: 'BKASH',
  gatewayTransactionId: parentId,
  treasuryStatus: 'GATEWAY_SUCCESS',
  taxCreditStatus: 'PENDING_RECONCILIATION',
  createdAt: '2026-11-12T04:30:00.000Z',
  completedAt: '2026-11-12T04:30:00.000Z',
  isSimulatedDemo: true,
};

test('individual certificate is distinct, parent-linked and retains payer, recipient, head, year and total', () => {
  const model = buildPaymentCertificateModel(baseReceipt);
  assert.ok(model);
  assert.equal(model.contractVersion, 1);
  assert.equal(model.paymentTransactionId, parentId);
  assert.equal(model.certificateReference, 'SK-PC-' + parentId);
  assert.equal(model.paymentReference, 'CH-2026-00051');
  assert.equal(model.payerName, 'Payer One');
  assert.equal(model.payerTin, '1111111111111');
  assert.equal(model.lines[0].recipientName, 'Recipient One');
  assert.equal(model.lines[0].recipientTin, '2222222222222');
  assert.equal(model.lines[0].descriptionEn, 'Penalty');
  assert.equal(model.lines[0].assessmentYear, '2026-27');
  assert.equal(model.lines[0].amountMinor, 5000);
  assert.equal(model.totalMinor, 5000);
  assert.equal('treasuryStatus' in model, false);
  assert.equal('taxCreditStatus' in model, false);
});

test('one combined certificate retains each reconciled beneficiary, head, year and amount', () => {
  const receipt: ChallanReceipt = {
    ...baseReceipt,
    paymentCategory: 'OTHER_TAX_PAYMENT',
    assessmentYear: '2025-26, 2026-27',
    items: [],
    totalAmount: 50,
    allocationItems: [
      { taxpayerName: 'Recipient One', taxpayerTin: '2222222222222', paymentServiceEn: 'Advance Tax', paymentServiceBn: 'অগ্রিম কর', assessmentYear: '2025-26', amountMinor: 1500, economicCode: '64' },
      { taxpayerName: 'Recipient Two', taxpayerTin: '3333333333333', paymentServiceEn: 'Demand Notice Tax', paymentServiceBn: 'দাবিনামার কর', assessmentYear: '2026-27', amountMinor: 3500, economicCode: '135' },
    ],
  };
  const model = buildPaymentCertificateModel(receipt);
  assert.ok(model);
  assert.equal(model.lines.length, 2);
  assert.deepEqual(model.lines.map(line => [
    line.recipientTin, line.descriptionEn, line.economicCode, line.assessmentYear, line.amountMinor,
  ]), [
    ['2222222222222', 'Advance Tax', '64', '2025-26', 1500],
    ['3333333333333', 'Demand Notice Tax', '135', '2026-27', 3500],
  ]);
  assert.deepEqual(model.assessmentYears, ['2025-26', '2026-27']);
  assert.equal(model.totalMinor, 5000);
});

test('combined certificate rejects mismatched original receipt head, amount and row count', () => {
  const lines = [
    { headId: 121, economicCode: '64', headNameEn: 'Advance Tax',
      taxAmount: 15, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 15 },
    { headId: 145, economicCode: '135', headNameEn: 'Demand Notice Tax',
      taxAmount: 35, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 35 },
  ];
  const allocations = [
    { taxpayerName: 'Recipient One', taxpayerTin: '2222222222222', paymentServiceEn: 'Advance Tax',
      paymentServiceBn: 'অগ্রিম কর', assessmentYear: '2025-26', amountMinor: 1500, economicCode: '64' },
    { taxpayerName: 'Recipient Two', taxpayerTin: '3333333333333', paymentServiceEn: 'Demand Notice Tax',
      paymentServiceBn: 'দাবিনামার কর', assessmentYear: '2026-27', amountMinor: 3500, economicCode: '135' },
  ];
  const saved: ChallanReceipt = { ...baseReceipt, paymentCategory: 'OTHER_TAX_PAYMENT',
    assessmentYear: '2025-26, 2026-27', items: lines, allocationItems: allocations, totalAmount: 50 };
  const original = JSON.stringify(saved);
  assert.equal(buildPaymentCertificateModel(saved)?.lines.length, 2);
  // Older recorded parents without receipt line rows can still use their saved allocations.
  assert.equal(buildPaymentCertificateModel({ ...saved, items: [] })?.lines.length, 2);
  assert.equal(buildPaymentCertificateModel({ ...saved, items: [lines[0]] }), null);
  assert.equal(buildPaymentCertificateModel({ ...saved,
    items: [{ ...lines[0], totalAmount: 35 }, { ...lines[1], totalAmount: 15 }] }), null);
  assert.equal(buildPaymentCertificateModel({ ...saved,
    items: [{ ...lines[0], headNameEn: 'Wrong Tax Head' }, lines[1]] }), null);
  assert.equal(buildPaymentCertificateModel({ ...saved,
    items: [lines[0], { ...lines[1], economicCode: 'WRONG' }] }), null);
  assert.equal(JSON.stringify(saved), original, 'certificate validation must not mutate saved payment');
});

test('certificate refuses a mismatched allocation sum, malformed reference, or incomplete parent', () => {
  assert.equal(buildPaymentCertificateModel({
    ...baseReceipt,
    allocationItems: [{
      taxpayerName: 'Recipient One', taxpayerTin: '2222222222222',
      paymentServiceEn: 'Penalty', paymentServiceBn: 'জরিমানা',
      assessmentYear: '2026-27', amountMinor: 4999,
    }],
  }), null);
  assert.equal(buildPaymentCertificateModel({ ...baseReceipt, paymentTransactionId: 'SIM-TOKEN-123' }), null);
  assert.equal(buildPaymentCertificateModel({ ...baseReceipt, completedAt: undefined }), null);
});

test('Travel Tax certificate keeps one parent and itemized passenger, route, passport, date and totals without preview codes', () => {
  const receipt: ChallanReceipt = {
    ...baseReceipt,
    paymentCategory: 'TRAVEL_TAX',
    challanNo: 'SIM-TOKEN-2a1e',
    payerName: 'SAMPLE FIRST',
    payerTin: 'NON-TIN-PASSENGER',
    taxpayerTin: undefined,
    taxpayerName: undefined,
    isRepresentativePayment: false,
    assessmentYear: '2026-27',
    totalAmount: 1500,
    items: [
      { headId: 155, economicCode: '1-1111-0000-1551', headNameEn: 'Travel tax — SAMPLE FIRST', taxAmount: 1000, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 1000 },
      { headId: 156, economicCode: '1-1111-0000-1551', headNameEn: 'Travel tax — FRIEND SECOND', taxAmount: 500, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 500 },
    ],
    travelDetails: {
      mode: 'LAND',
      departurePort: 'Benapole',
      destination: 'India',
      travelDate: '2026-11-20',
      economicCode: '1-1111-0000-1551',
      passengers: [
        { name: 'SAMPLE FIRST', passportMasked: '••••3456', nationality: 'BD', country: 'Bangladesh', ageBand: 'ADULT', age: 32, amount: 1000 },
        { name: 'FRIEND SECOND', passportMasked: '••••4321', nationality: 'FOREIGN', country: 'India', ageBand: 'CHILD', age: 9, amount: 500 },
      ],
    },
  };
  const model = buildPaymentCertificateModel(receipt);
  assert.ok(model);
  assert.equal(model.certificateReference, 'SK-PC-' + parentId);
  assert.equal(model.paymentReference, parentId);
  assert.equal(model.travel?.departurePort, 'Benapole');
  assert.equal(model.travel?.destination, 'India');
  assert.equal(model.lines.length, 2);
  assert.deepEqual(model.lines.map(line => [line.recipientName, line.passportMasked, line.country, line.amountMinor]), [
    ['SAMPLE FIRST', '••••3456', 'Bangladesh', 100000],
    ['FRIEND SECOND', '••••4321', 'India', 50000],
  ]);
  assert.equal(model.totalMinor, 150000);
  assert.equal(model.paymentReference.includes('SIM'), false);
});



test('Travel Tax certificate refuses plaintext passports and unknown nationality without leaking identity',()=>{
  const src={...baseReceipt,paymentCategory:'TRAVEL_TAX' as const,
    payerTin:'NON-TIN-PASSENGER',payerName:'Recorded Traveller',totalAmount:1000,
    travelDetails:{mode:'LAND' as const,departurePort:'Benapole',destination:'India',
      travelDate:'2026-11-20',economicCode:'1144102',
      passengers:[{name:'Recorded Traveller',passportMasked:'••••3456',
        nationality:'BD' as const,country:'Bangladesh',ageBand:'ADULT' as const,age:34,amount:1000}]},
    items:[{headId:155,economicCode:'1144102',headNameEn:'Travel tax — Recorded Traveller',
      taxAmount:1000,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:1000}],
  };
  assert.equal(buildPaymentCertificateModel(src)?.lines[0].passportMasked,'••••3456');
  const altered=(change:(traveller:typeof src.travelDetails.passengers[0])=>void)=>{
    const copy=structuredClone(src);change(copy.travelDetails.passengers[0]);
    return buildPaymentCertificateModel(copy);
  };
  assert.equal(altered(p=>{p.passportMasked='TEST123456'}),null);
  assert.equal(altered(p=>{p.passportMasked='••••'}),null);
  assert.equal(altered(p=>{p.passportMasked='••••XXXX1234'}),null);
  assert.equal(altered(p=>{p.passportMasked='••••1\n23'}),null);
  assert.equal(altered(p=>{p.passportMasked='••••3-45'})?.lines[0].passportMasked,'••••3-45');
  assert.equal(altered(p=>{p.nationality='UNKNOWN' as 'BD'}),null);
  assert.equal(buildPaymentCertificateModel({...src,travelDetails:{...src.travelDetails,
    passengers:[{...src.travelDetails.passengers[0],nationality:'FOREIGN' as const,country:''}]}}),null);
  assert.equal(src.travelDetails.passengers[0].passportMasked,'••••3456');
});

test('Travel Tax certificate permits itemized zero-rated UNDER5 traveller without exposing passport',()=>{
  const src={...baseReceipt,paymentCategory:'TRAVEL_TAX' as const,
    payerTin:'NON-TIN-PASSENGER',payerName:'Recorded Traveller',totalAmount:1000,
    travelDetails:{mode:'LAND' as const,departurePort:'Benapole',destination:'India',
      travelDate:'2026-11-20',economicCode:'1144102',
      passengers:[{name:'Recorded Traveller',passportMasked:'••••3456',nationality:'BD' as const,
        country:'Bangladesh',ageBand:'ADULT' as const,age:34,amount:1000},
        {name:'Exempt Traveller',passportMasked:'••••1234',nationality:'FOREIGN' as const,
          country:'India',ageBand:'UNDER5' as const,age:4,amount:0}]},
    items:[{headId:155,economicCode:'1144102',headNameEn:'Travel tax — Recorded Traveller',
      taxAmount:1000,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:1000},
      {headId:156,economicCode:'1144102',headNameEn:'Travel tax — Exempt Traveller',
      taxAmount:0,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:0}],
  };
  const model=buildPaymentCertificateModel(src);
  assert.equal(model?.lines.length,2);
  assert.deepEqual(model?.lines.map(x=>x.amountMinor),[100000,0]);
  assert.deepEqual(model?.lines.map(x=>x.passportMasked),['••••3456','••••1234']);
});


test('M07 Travel Tax certificate reconciles each saved passenger with its original accounting head',()=>{
  const original:ChallanReceipt={...baseReceipt,paymentCategory:'TRAVEL_TAX',
    payerTin:'NON-TIN-PASSENGER',payerName:'Adult Traveller',totalAmount:1500,
    travelDetails:{mode:'LAND',departurePort:'Benapole',destination:'India',
      travelDate:'2026-11-20',economicCode:'1144102',passengers:[
        {name:'Adult Traveller',passportMasked:'••••4321',nationality:'BD',
          country:'Bangladesh',ageBand:'ADULT',age:34,amount:1000},
        {name:'Child Traveller',passportMasked:'••••9876',nationality:'FOREIGN',
          country:'India',ageBand:'CHILD',age:9,amount:500}]},
    items:[
      {headId:155,economicCode:'1144102',headNameEn:'Travel tax — Adult Traveller',
        taxAmount:1000,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:1000},
      {headId:156,economicCode:'1144102',headNameEn:'Travel tax — Child Traveller',
        taxAmount:500,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:500}]
  };
  const before=JSON.stringify(original);
  assert.deepEqual(buildPaymentCertificateModel(original)?.lines.map(x=>[x.recipientName,x.amountMinor]),
    [['Adult Traveller',100000],['Child Traveller',50000]]);
  const badLine=(index:number,change:(value:ChallanReceipt['items'][number])=>void)=>{
    const tampered=structuredClone(original);
    change(tampered.items[index]);
    assert.equal(buildPaymentCertificateModel(tampered),null);
    assert.equal(canViewPaymentCertificate(tampered),false);
  };
  badLine(0,head=>{head.headId=156;});
  badLine(0,head=>{head.headNameEn='Travel tax — Child Traveller';});
  badLine(1,head=>{head.economicCode='WRONG';});
  badLine(0,head=>{head.taxAmount=900;});
  badLine(0,head=>{head.penaltyAmount=100;});
  badLine(0,head=>{head.totalAmount=500;});
  const fewer=structuredClone(original);
  fewer.items.pop();
  assert.equal(buildPaymentCertificateModel(fewer),null);
  const legacy={...original,items:[]};
  assert.equal(buildPaymentCertificateModel(legacy)?.lines.length,2,
    'historical allocation-only certificate can still fall back to saved passenger rows');
  assert.equal(JSON.stringify(original),before,'certificate model must not rewrite the source record');
});

test('saved payment certificate action is offered only for a completed, reconciled parent', () => {
  assert.equal(canViewPaymentCertificate(baseReceipt), true);
  assert.equal(canViewPaymentCertificate({ ...baseReceipt, treasuryStatus: 'TREASURY_SCROLLED' }), true);
  assert.equal(canViewPaymentCertificate({ ...baseReceipt, completedAt: undefined }), false);
  assert.equal(canViewPaymentCertificate({ ...baseReceipt, treasuryStatus: 'GATEWAY_PENDING' }), false);
  assert.equal(canViewPaymentCertificate({ ...baseReceipt, paymentTransactionId: 'SIM-TOKEN-123' }), false);
  assert.equal(canViewPaymentCertificate({ ...baseReceipt, totalAmount: 49 }), false);
});
