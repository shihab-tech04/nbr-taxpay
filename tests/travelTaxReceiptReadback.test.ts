import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChallanReceipt } from '../src/types/tax';
import { matchesConfirmedTravelTaxReceipt } from '../src/services/travelTaxReceiptReadback';

const transactionId = '3f3a5de8-1f5b-45a4-8a76-87c53e72c001';
const expected: ChallanReceipt = {
  id: 'preview-travel-receipt',
  challanNo: 'SIM-TRAVEL-2026-51',
  tokenNumber: 'SIM-TOKEN-travel-51',
  paymentCategory: 'TRAVEL_TAX',
  assessmentYear: '2026-27',
  payerName: 'SAMPLE FIRST',
  payerTin: 'NON-TIN-PASSENGER',
  receiptMobile: '01712345678',
  isRepresentativePayment: false,
  taxZone: '',
  taxCircle: '',
  isWithholding: false,
  items: [
    { headId: 155, economicCode: '1144102', headNameEn: 'Travel tax — SAMPLE FIRST',
      taxAmount: 1000, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0,
      totalAmount: 1000, note: 'LAND | Benapole | India | 2026-12-01 | age 32 | Passport ••••3456' },
    { headId: 156, economicCode: '1144102', headNameEn: 'Travel tax — FRIEND SECOND',
      taxAmount: 500, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0,
      totalAmount: 500, note: 'LAND | Benapole | India | 2026-12-01 | age 9 | Passport ••••4321' },
  ],
  totalAmount: 1500,
  paymentMethod: 'NAGAD',
  gatewayTransactionId: 'SIM-TXN-travel-51',
  treasuryStatus: 'GATEWAY_SUCCESS',
  taxCreditStatus: 'NOT_APPLICABLE',
  createdAt: '2026-11-22T00:00:00.000Z',
  completedAt: '2026-11-22T00:00:00.000Z',
  isSimulatedDemo: true,
  travelDetails: {
    mode: 'LAND',
    departurePort: 'Benapole',
    destination: 'India',
    travelDate: '2026-12-01',
    economicCode: '1144102',
    passengers: [
      { name: 'SAMPLE FIRST', passportMasked: '••••3456', nationality: 'BD',
        country: 'Bangladesh', ageBand: 'ADULT', age: 32, amount: 1000 },
      { name: 'FRIEND SECOND', passportMasked: '••••4321', nationality: 'FOREIGN',
        country: 'India', ageBand: 'CHILD', age: 9, amount: 500 },
    ],
  },
};
const recorded: ChallanReceipt = {
  ...expected,
  id: 'preview-travel-receipt',
  paymentTransactionId: transactionId,
  createdAt: '2026-11-22T00:00:02.000Z',
  completedAt: '2026-11-22T00:00:02.000Z',
};

test('F-043 accepts only a completed, itemized SQL readback for the same Travel Tax payment', () => {
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, recorded, transactionId), true);
});

test('F-043 refuses a different parent, total, route, passenger, or accounting row', () => {
  assert.equal(matchesConfirmedTravelTaxReceipt(expected,
    { ...recorded, paymentTransactionId: '0d6b1f26-1fa8-4e97-8a12-d7a08ba3f821' }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, { ...recorded, totalAmount: 1499 }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, {
    ...recorded, travelDetails: { ...recorded.travelDetails!, destination: 'Nepal' },
  }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, {
    ...recorded, travelDetails: { ...recorded.travelDetails!, passengers: [
      { ...recorded.travelDetails!.passengers[0], name: 'WRONG TRAVELLER' },
      recorded.travelDetails!.passengers[1],
    ] },
  }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, {
    ...recorded, items: [{ ...recorded.items[0], headId: 156 }, recorded.items[1]],
  }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, { ...recorded, completedAt: undefined }, transactionId), false);
  assert.equal(matchesConfirmedTravelTaxReceipt(expected, { ...recorded, treasuryStatus: 'INITIATED' }, transactionId), false);
});
