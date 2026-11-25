import type { StoryPaymentInput } from './simulatedPaymentStory';
import type { ChallanReceipt } from '../types/tax';
import { TRAVEL_TAX_ECONOMIC_CODE } from '../data/travelTax2026';

/** The unchanged original request must be replayed after an uncertain response.
 * This checks local recovery integrity; server-side idempotency and owner/session
 * authorization remain authoritative. Never reconstruct a second payment here. */
export type PendingTravelPayment = StoryPaymentInput & {
  service: 'TRAVEL_TAX';
  details: StoryPaymentInput['details'] & { receiptSnapshot: ChallanReceipt };
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const minorUnits = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const rounded = Math.round(value * 100);
  return Number.isSafeInteger(rounded) && Math.abs(value * 100 - rounded) < 0.000001
    ? rounded : null;
};

export function parseRecoverableTravelPayment(raw: string | null, sessionId: string): PendingTravelPayment | null {
  if (!raw || !sessionId) return null;
  try {
    const payment: unknown = JSON.parse(raw);
    if (!record(payment) || payment.service !== 'TRAVEL_TAX' || payment.sessionId !== sessionId ||
        typeof payment.idempotencyKey !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payment.idempotencyKey) ||
        !Number.isSafeInteger(payment.amountMinor) || (payment.amountMinor as number) <= 0 ||
        !record(payment.details)) return null;
    const details = payment.details;
    if (!record(details.receiptSnapshot)) return null;
    const receipt = details.receiptSnapshot;
    if (receipt.paymentCategory !== 'TRAVEL_TAX' ||
        receipt.id !== 'rcpt-trv-' + payment.idempotencyKey ||
        receipt.taxEventId !== 'SIM-EVENT-' + payment.idempotencyKey ||
        receipt.paymentTransactionId !== 'SIM-TOKEN-' + payment.idempotencyKey ||
        receipt.tokenNumber !== 'SIM-TOKEN-' + payment.idempotencyKey ||
        receipt.challanNo !== 'SIM-' + payment.idempotencyKey ||
        receipt.gatewayTransactionId !== 'SIM-TXN-' + payment.idempotencyKey ||
        !record(receipt.travelDetails) || !Array.isArray(receipt.items) ||
        !Array.isArray(details.lines) || !Array.isArray(details.passengers)) return null;
    const trip = receipt.travelDetails;
    if (!Array.isArray(trip.passengers) || trip.passengers.length < 1 || trip.passengers.length > 20 ||
        receipt.items.length !== trip.passengers.length ||
        details.lines.length !== trip.passengers.length ||
        details.passengers.length !== trip.passengers.length ||
        !['LAND', 'WATER'].includes(String(trip.mode)) ||
        typeof trip.departurePort !== 'string' || !trip.departurePort.trim() ||
        typeof trip.destination !== 'string' || !trip.destination.trim() ||
        typeof trip.travelDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trip.travelDate) ||
        Number.isNaN(Date.parse(trip.travelDate + 'T00:00:00Z')) ||
        new Date(trip.travelDate + 'T00:00:00Z').toISOString().slice(0, 10) !== trip.travelDate ||
        trip.economicCode !== TRAVEL_TAX_ECONOMIC_CODE ||
        details.economicCode !== trip.economicCode ||
        details.travelMode !== trip.mode || details.departurePort !== trip.departurePort ||
        details.destination !== trip.destination || details.travelDate !== trip.travelDate ||
        details.receiptReference !== receipt.tokenNumber) return null;
    let sum = 0;
    for (let i = 0; i < trip.passengers.length; i++) {
      const person = trip.passengers[i];
      const storedPerson = details.passengers[i];
      const line = receipt.items[i];
      const storedLine = details.lines[i];
      if (!record(person) || !record(storedPerson) || !record(line) || !record(storedLine) ||
          typeof person.name !== 'string' || !person.name.trim() ||
          !['BD', 'FOREIGN'].includes(String(person.nationality)) ||
          !['ADULT', 'CHILD', 'UNDER5'].includes(String(person.ageBand)) ||
          typeof person.passportMasked !== 'string' ||
          !/^••••[^\s\u0000-\u001F\u007F-\u009F]{4}$/.test(person.passportMasked) ||
          (person.nationality === 'FOREIGN' && (typeof person.country !== 'string' || !person.country.trim())) ||
          typeof person.age !== 'number' || !Number.isInteger(person.age) || person.age < 0 || person.age >= 130 ||
          storedPerson.name !== person.name || storedPerson.passportMasked !== person.passportMasked ||
          storedPerson.nationality !== person.nationality || storedPerson.ageBand !== person.ageBand ||
          storedPerson.country !== person.country || storedPerson.age !== person.age ||
          storedPerson.amount !== person.amount ||
          line.headId !== 155 + i || storedLine.headId !== line.headId ||
          line.economicCode !== trip.economicCode || storedLine.economicCode !== line.economicCode ||
          line.headNameEn !== 'Travel tax — ' + person.name ||
          storedLine.headNameEn !== line.headNameEn) return null;
      const amount = minorUnits(person.amount);
      if (amount === null || minorUnits(line.totalAmount) !== amount ||
          minorUnits(storedLine.totalAmount) !== amount ||
          minorUnits(line.taxAmount) !== amount || minorUnits(storedLine.taxAmount) !== amount ||
          minorUnits(line.penaltyAmount) !== 0 || minorUnits(storedLine.penaltyAmount) !== 0 ||
          minorUnits(line.surchargeAmount) !== 0 || minorUnits(storedLine.surchargeAmount) !== 0 ||
          minorUnits(line.interestAmount) !== 0 || minorUnits(storedLine.interestAmount) !== 0) return null;
      sum += amount;
      if (!Number.isSafeInteger(sum)) return null;
    }
    if (sum !== payment.amountMinor || minorUnits(receipt.totalAmount) !== sum) return null;
    return payment as PendingTravelPayment;
  } catch {
    return null;
  }
}
