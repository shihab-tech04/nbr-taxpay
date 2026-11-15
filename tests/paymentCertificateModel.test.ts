import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChallanReceipt } from '../src/types/tax';
import { buildPaymentCertificateModel } from '../src/services/paymentCertificateModel';

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
