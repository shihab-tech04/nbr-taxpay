import type { ChallanReceipt } from '../types/tax';
import { canViewPaymentCertificate } from './paymentCertificateModel';

function minorUnits(amount: number): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

function samePassenger(
  expected: NonNullable<ChallanReceipt['travelDetails']>['passengers'][number],
  recorded: NonNullable<ChallanReceipt['travelDetails']>['passengers'][number],
): boolean {
  return expected.name === recorded.name &&
    expected.passportMasked === recorded.passportMasked &&
    expected.nationality === recorded.nationality &&
    expected.country === recorded.country &&
    expected.ageBand === recorded.ageBand &&
    expected.age === recorded.age &&
    minorUnits(expected.amount) !== null &&
    minorUnits(expected.amount) === minorUnits(recorded.amount);
}

function sameAccountingLine(
  expected: ChallanReceipt['items'][number],
  recorded: ChallanReceipt['items'][number],
): boolean {
  return expected.headId === recorded.headId &&
    expected.economicCode === recorded.economicCode &&
    expected.headNameEn === recorded.headNameEn &&
    expected.note === recorded.note &&
    minorUnits(expected.taxAmount) !== null &&
    minorUnits(expected.taxAmount) === minorUnits(recorded.taxAmount) &&
    minorUnits(expected.penaltyAmount) !== null &&
    minorUnits(expected.penaltyAmount) === minorUnits(recorded.penaltyAmount) &&
    minorUnits(expected.surchargeAmount) !== null &&
    minorUnits(expected.surchargeAmount) === minorUnits(recorded.surchargeAmount) &&
    minorUnits(expected.interestAmount) !== null &&
    minorUnits(expected.interestAmount) === minorUnits(recorded.interestAmount) &&
    minorUnits(expected.totalAmount) !== null &&
    minorUnits(expected.totalAmount) === minorUnits(recorded.totalAmount);
}

/**
 * A payment acknowledgement is not enough to show a completed receipt.
 * Require the session/owner-scoped SQL readback to retain the exact Travel Tax
 * parent, route, passengers, accounting rows and total, and to support the
 * existing certificate model.
 */
export function matchesConfirmedTravelTaxReceipt(
  expected: ChallanReceipt,
  recorded: ChallanReceipt,
  transactionId: string,
): boolean {
  const expectedTravel = expected.travelDetails;
  const recordedTravel = recorded.travelDetails;
  if (!expectedTravel || !recordedTravel ||
      expected.paymentCategory !== 'TRAVEL_TAX' ||
      recorded.paymentCategory !== 'TRAVEL_TAX' ||
      recorded.paymentTransactionId !== transactionId ||
      recorded.isSimulatedDemo !== true ||
      !recorded.completedAt ||
      (recorded.treasuryStatus !== 'GATEWAY_SUCCESS' &&
        recorded.treasuryStatus !== 'TREASURY_SCROLLED') ||
      expected.challanNo !== recorded.challanNo ||
      expected.tokenNumber !== recorded.tokenNumber ||
      expected.gatewayTransactionId !== recorded.gatewayTransactionId ||
      expected.paymentMethod !== recorded.paymentMethod ||
      expected.payerName !== recorded.payerName ||
      expected.payerTin !== recorded.payerTin ||
      expected.receiptMobile !== recorded.receiptMobile ||
      expected.assessmentYear !== recorded.assessmentYear ||
      minorUnits(expected.totalAmount) === null ||
      minorUnits(expected.totalAmount) !== minorUnits(recorded.totalAmount) ||
      expectedTravel.mode !== recordedTravel.mode ||
      expectedTravel.departurePort !== recordedTravel.departurePort ||
      expectedTravel.destination !== recordedTravel.destination ||
      expectedTravel.travelDate !== recordedTravel.travelDate ||
      expectedTravel.economicCode !== recordedTravel.economicCode ||
      expectedTravel.passengers.length < 1 ||
      expectedTravel.passengers.length !== recordedTravel.passengers.length ||
      expected.items.length !== expectedTravel.passengers.length ||
      expected.items.length !== recorded.items.length) return false;

  if (!expectedTravel.passengers.every((person, index) =>
    samePassenger(person, recordedTravel.passengers[index]))) return false;

  if (!expected.items.every((line, index) =>
    sameAccountingLine(line, recorded.items[index]))) return false;

  return canViewPaymentCertificate(recorded);
}
