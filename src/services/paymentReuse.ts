import type { ChallanReceipt, PaymentCategory } from '../types/tax';

/** This is an editable INPUT snapshot, not a cloned receipt or authorization. */
export type PaymentReuse = {
  ownerUid: string;
  sourcePaymentId: string;
  service: PaymentCategory;
  formPayload: Record<string, unknown>;
};

const CURRENT_YEAR = '2026-27';
const supported = new Set<PaymentCategory>([
  'TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
  'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT',
]);
const validTin = (value: string) => /^\d{12,13}$/.test(value);
const validYear = (value: string) => /^\d{4}-\d{2}$/.test(value);
const money = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
const checkedMinor = (amount: number) => {
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) throw Error('Invalid historical payment amount.');
  return minor;
};
const copiedYear = (year: string) => {
  if (!validYear(year)) throw Error('Historical assessment year is missing or invalid.');
  return year === CURRENT_YEAR ? year : '';
};

type SourceAllocation = {
  tin: string; name: string; headId: number; year: string; amountMinor: number;
};

/**
 * Never infer a missing taxpayer/head/year from a batch summary label. Only
 * reconstruct from each verified SQL receipt's full head/allocation pair.
 * Call only for account-owned, SQL-readback-confirmed payment history.
 */
export function reuseRecordedPayment(
  source: readonly ChallanReceipt[], ownerUid: string, ownTin: string | null,
  sourcePaymentId: string,
): PaymentReuse {
  if (!ownerUid || !sourcePaymentId || !source.length || source.length > 20)
    throw Error('A complete owned payment is required.');
  const service = source[0].paymentCategory;
  // Travel receipts deliberately contain only masked passports. Copy the
  // itinerary and passenger names, but require fresh identity and travel-date
  // checks. Never invent a passport/DOB from a masked financial receipt.
  if (service === 'TRAVEL_TAX') {
    if (source.length !== 1 || !source[0].isSimulatedDemo || source[0].batchId)
      throw Error('The original travel payment is incomplete.');
    const receipt = source[0];
    const trip = receipt.travelDetails;
    if (!trip || !['LAND','WATER'].includes(trip.mode) ||
        typeof trip.departurePort !== 'string' || !trip.departurePort.trim() ||
        typeof trip.destination !== 'string' || !trip.destination.trim() ||
        typeof trip.travelDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trip.travelDate) ||
        !Array.isArray(trip.passengers) || !trip.passengers.length ||
        trip.passengers.length > 20 || receipt.items.length !== trip.passengers.length ||
        !(receipt.totalAmount > 0) ||
        !Number.isSafeInteger(Math.round(receipt.totalAmount * 100)))
      throw Error('Original travel details are incomplete.');
    const sum = trip.passengers.reduce((total, passenger, index) => {
      const minor = Math.round(passenger.amount * 100);
      const lineMinor = Math.round(receipt.items[index].totalAmount * 100);
      if (!Number.isSafeInteger(minor) || minor < 0 || minor !== lineMinor ||
          typeof passenger.name !== 'string' || !passenger.name.trim() ||
          !['BD','FOREIGN'].includes(passenger.nationality) ||
          (passenger.nationality === 'FOREIGN' && !passenger.country?.trim()))
        throw Error('Original travel passenger details cannot be reconciled.');
      return total + minor;
    }, 0);
    if (sum !== Math.round(receipt.totalAmount * 100))
      throw Error('Original travel amount does not reconcile.');
    const passengers = trip.passengers.map((passenger,index) => ({
      id: 'repeat-traveller-' + (index + 1),
      nationality: passenger.nationality,
      passport: '',
      name: passenger.name,
      ageBand: 'ADULT' as const,
      birthDate: '',
      country: passenger.country || (passenger.nationality === 'BD' ? 'Bangladesh' : ''),
      identitySource: (passenger.nationality === 'BD' ? 'PENDING' : 'MANUAL') as 'PENDING' | 'MANUAL',
      medicalPortReferral: false,
    }));
    const payload: Record<string,unknown> = {
      schemaVersion: 1, step: 0, mode: trip.mode,
      port: trip.mode === 'LAND' ? trip.departurePort : '',
      waterPort: trip.mode === 'WATER' ? trip.departurePort : '',
      destination: trip.destination,
      travelDate: '',
      phone: /^01\d{9}$/.test(receipt.receiptMobile ?? '') ? receipt.receiptMobile : '',
      passengers,
    };
    return {ownerUid,sourcePaymentId,service,formPayload:payload};
  }
  if (!supported.has(service)) throw Error('This payment service needs a fresh payment journey.');
  if (source.some(r => !r.isSimulatedDemo || r.paymentCategory !== service || !r.items?.length))
    throw Error('The original payment is incomplete and cannot be copied.');
  // A single fetched row may still belong to a larger multi-item batch.
  // Never treat a partial history page or missing item as an entire payment.
  const isBatch = source.some(r => r.batchId || r.batchItemCount || r.batchItemIndex);
  if (isBatch) {
    const batchId = source[0].batchId;
    const total = source[0].batchItemCount;
    if (service !== 'OTHER_TAX_PAYMENT' || !batchId || !Number.isSafeInteger(total) ||
        total! <= 0 || total !== source.length ||
        source.some(r => r.batchId !== batchId || r.batchItemCount !== total ||
          !Number.isSafeInteger(r.batchItemIndex) || r.batchItemIndex! < 1 ||
          r.batchItemIndex! > total!) ||
        new Set(source.map(r => r.batchItemIndex)).size !== total)
      throw Error('The complete original batch is unavailable.');
  }
  const sorted = [...source].sort((a,b) => (a.batchItemIndex ?? 0) - (b.batchItemIndex ?? 0));
  const allocations: SourceAllocation[] = [];
  for (const receipt of sorted) {
    if (service === 'OTHER_TAX_PAYMENT') {
      if (!receipt.allocationItems?.length || receipt.items.length !== receipt.allocationItems.length)
        throw Error('Original taxpayer/head/year allocations are incomplete.');
      for (let index = 0; index < receipt.items.length; index++) {
        const head = receipt.items[index];
        const allocation = receipt.allocationItems[index];
        const tin = allocation.taxpayerTin ?? '';
        const value = checkedMinor(head.totalAmount);
        if (!validTin(tin) || head.headId <= 0 || !Number.isSafeInteger(head.headId) ||
            !Number.isSafeInteger(allocation.amountMinor) || allocation.amountMinor !== value)
          throw Error('Original taxpayer allocation cannot be reconciled.');
        allocations.push({tin, name: allocation.taxpayerName, headId: head.headId,
          year: allocation.assessmentYear, amountMinor: value});
      }
    } else {
      const tin = receipt.taxpayerTin ?? '';
      if (!validTin(tin)) throw Error('Original taxpayer identity cannot be verified.');
      for (const head of receipt.items) {
        if (!Number.isSafeInteger(head.headId) || head.headId <= 0)
          throw Error('Original payment head is missing.');
        allocations.push({tin, name: '', headId: head.headId,
          year: receipt.assessmentYear, amountMinor: checkedMinor(head.totalAmount)});
      }
    }
    const receiptSum = receipt.items.reduce((sum, h) => sum + checkedMinor(h.totalAmount), 0);
    if (receiptSum !== checkedMinor(receipt.totalAmount))
      throw Error('Original payment amount does not reconcile.');
  }
  if (!allocations.length || allocations.length > 20)
    throw Error('The original payment exceeds the supported allocation limit.');
  const people = new Map<string, {tin:string;name:string;id:string}>();
  for (const item of allocations) if (!people.has(item.tin))
    people.set(item.tin, {tin:item.tin,name:item.name,id:`repeat-${people.size + 1}`});
  const ownerIsPayee = Boolean(ownTin && validTin(ownTin) && people.has(ownTin));
  const firstTin = ownerIsPayee ? ownTin! : allocations[0].tin;
  const first = people.get(firstTin)!;
  first.id='primary';
  const others = [...people.values()].filter(p => p !== first);
  const initial = sorted[0];
  const years = allocations.map(item => copiedYear(item.year));
  const payload: Record<string, unknown> = {
    schemaVersion: 1, category: service, step: 1, forSelf: ownerIsPayee,
    tin: ownerIsPayee ? '' : first.tin,
    payerName: '', otherTaxpayerName: first.name,
    additionalTaxpayers: others,
    otherTaxLines: service === 'OTHER_TAX_PAYMENT'
      ? allocations.map((item,index) => ({
          id:`repeat-line-${index + 1}`,
          taxpayerId: people.get(item.tin)!.id,
          headId: item.headId,
          assessmentYear: years[index], amount: money(item.amountMinor)
        })) : [],
    phone: /^01\d{9}$/.test(initial.receiptMobile ?? '') ? initial.receiptMobile : '',
    receiptEmail: '',
    assessmentYear: years[0],
    // Old notice/demand references are historical, not new payment authority.
    noticeReference: '',
    incomeTaxType: null,
    selectedHeadIds: service === 'OTHER_TAX_PAYMENT' ? [] : [...new Set(allocations.map(a=>a.headId))],
    amountInputs: service === 'OTHER_TAX_PAYMENT' ? {} : Object.fromEntries(
      allocations.map(a => [a.headId, money(a.amountMinor)])),
  };
  if (service !== 'OTHER_TAX_PAYMENT' && allocations.some(a => a.year !== allocations[0].year))
    throw Error('Mixed assessment years require the allocation payment service.');
  if (service !== 'OTHER_TAX_PAYMENT' && allocations.some(a => a.tin !== allocations[0].tin))
    throw Error('Mixed taxpayers require the allocation payment service.');
  // A copied source record is retained only as informational context, not a receipt.
  return {ownerUid,sourcePaymentId,service,formPayload:payload};
}
