import type { ChallanReceipt, PaymentCategory, PaymentLineItem } from '../types/tax';
import { MAX_COMBINED_ALLOCATIONS } from './otherTaxCombinedPayment';
import { CURRENT_PAY_AGAIN_YEAR } from './payAgain';
import { TRAVEL_TAX_ECONOMIC_CODE } from '../data/travelTax2026';
import {estimateGiftTax} from './giftTaxEstimate';
import {validGiftDate} from './giftTaxDate';
import {validBeneficiaryClassification} from './beneficiaryTags';
import {lookupSampleTaxpayer} from './sampleTaxpayerLookup';

/** This is an editable INPUT snapshot, not a cloned receipt or authorization. */
export type PaymentReuse = {
  ownerUid: string;
  sourcePaymentId: string;
  /** Read-only original SQL allocation IDs; never new allocation IDs or payment authority. */
  sourceAllocationIds?: readonly string[];
  service: PaymentCategory;
  formPayload: Record<string, unknown>;
};

const supported = new Set<PaymentCategory>([
  'TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
  'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT',
]);
const validTin = (value: string) => /^\d{12,13}$/.test(value);
const validYear = (value: string) => /^\d{4}-\d{2}$/.test(value);
const money = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
const checkedMinor = (amount: number) => {
  const minor = Math.round(amount * 100);
  // SQL allocation and parent amounts are in exact minor units. Refuse
  // historical fractional cents rather than silently rounding the source.
  if (!Number.isFinite(amount) || !Number.isSafeInteger(minor) || minor <= 0 ||
      Math.abs(amount * 100 - minor) > 0.000001)
    throw Error('Invalid historical payment amount.');
  return minor;
};
/** Validate each saved source component in minor units, including zero fees.
 * A valid parent total must not conceal a malformed tax or fee breakdown. */
const checkedComponentMinor = (amount: number) => {
  const minor = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(minor) || minor < 0 ||
      Math.abs(amount * 100 - minor) > 0.000001)
    throw Error('Invalid historical payment amount.');
  return minor;
};
const reconciledHeadMinor = (head: PaymentLineItem) => {
  const total = checkedMinor(head.totalAmount);
  const parts = [head.taxAmount, head.penaltyAmount, head.surchargeAmount,
    head.interestAmount].map(checkedComponentMinor);
  const sum = parts.reduce((value, part) => value + part, 0);
  if (!Number.isSafeInteger(sum) || sum !== total)
    throw Error('Original payment head breakdown does not reconcile.');
  return total;
};
const copiedYear = (year: string) => {
  if (!validYear(year)) throw Error('Historical assessment year is missing or invalid.');
  // F-073: retain current AY only; historical AY stays on the immutable source.
  return year === CURRENT_PAY_AGAIN_YEAR ? year : '';
};

type SourceAllocation = {
  tin: string; name: string; headId: number; year: string; amountMinor: number;
};

/** A receipt may hide duplicate accounting rows while displaying verified SQL
 * allocation groups. Only use those saved head rows after readback reconciliation. */
const reusableHeads = (receipt: ChallanReceipt) =>
  receipt.items?.length ? receipt.items : receipt.reusableAccountingLines ?? [];

/** A grouped historical batch has one Pay Again choice, not one per receipt.
 * Keep the full original row list available to the reconstruction validator.
 * Prefix batch and individual identities so unrelated IDs cannot collide. */
export function oneChoicePerRecordedParent<T extends {id: string}>(
  rows: readonly T[], batchIdOf: (row: T) => string | undefined,
): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const batchId = batchIdOf(row);
    const key = batchId ? 'batch:' + batchId : 'payment:' + row.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Editable Gift Tax input only; never copy the original payment reference,
 * result, gateway method, payment authority, or issued receipt into the new form. */
export type GiftTaxReuseDraft={
  giftDetails:NonNullable<ChallanReceipt['giftDetails']>;
  payerName:string;
  phone:string;
};
export function parseGiftTaxReuseDraft(value:unknown):GiftTaxReuseDraft|null{
  if(!value||typeof value!=='object')return null;
  const raw=value as Partial<GiftTaxReuseDraft>&{schemaVersion?:number};
  const g=raw.giftDetails;
  if(raw.schemaVersion!==1||!g||!g.donor||!g.donee||
     typeof g.donor.tin!=='string'||typeof g.donee.tin!=='string'||
     !/^\d{12}$/.test(g.donor.tin)||!/^\d{12}$/.test(g.donee.tin)||g.donor.tin===g.donee.tin||
     typeof g.donor.name!=='string'||typeof g.donee.name!=='string'||
     !Number.isSafeInteger(g.giftAmountMinor)||g.giftAmountMinor<=0||
     !Number.isSafeInteger(g.estimatedTaxMinor)||g.estimatedTaxMinor<=0||
     Math.round((estimateGiftTax(g.giftAmountMinor/100)??-1)*100)!==g.estimatedTaxMinor||
     typeof g.giftDate!=='string'||!validGiftDate(g.giftDate,'2099-12-31')||
     typeof g.description!=='string'||typeof g.remarks!=='string'||
     !validBeneficiaryClassification(g.donee.tag,g.donee.relationship,g.donee.otherLabel)||
     typeof raw.payerName!=='string'||typeof raw.phone!=='string')return null;
  const donor=lookupSampleTaxpayer(g.donor.tin),donee=lookupSampleTaxpayer(g.donee.tin);
  if(!donor||!donee||![donor.nameEn,donor.nameBn].includes(g.donor.name)||
     ![donee.nameEn,donee.nameBn].includes(g.donee.name))return null;
  // Explicit field projection rather than spreading an untrusted old snapshot.
  return {giftDetails:{donor:{tin:g.donor.tin,name:g.donor.name},
    donee:{tin:g.donee.tin,name:g.donee.name,tag:g.donee.tag,relationship:g.donee.relationship??null,otherLabel:g.donee.otherLabel??null},
    giftAmountMinor:g.giftAmountMinor,estimatedTaxMinor:g.estimatedTaxMinor,giftDate:g.giftDate,
    description:g.description,remarks:g.remarks},
    payerName:raw.payerName,phone:/^01[3-9]\d{8}$/.test(raw.phone)?raw.phone:''};
}
/**
 * Never infer a missing taxpayer/head/year from a batch summary label. Only
 * reconstruct from each verified SQL receipt's full head/allocation pair.
 * Call only for account-owned, SQL-readback-confirmed payment history.
 */
export function reuseRecordedPayment(
  source: readonly ChallanReceipt[], ownerUid: string, ownTin: string | null,
  sourcePaymentId: string,
): PaymentReuse {
  if (!ownerUid || !sourcePaymentId || !source.length || source.length > MAX_COMBINED_ALLOCATIONS)
    throw Error('A complete owned payment is required.');
  // A selected payer-history row may only reconstruct its own immutable SQL
  // payment, or the exact already-verified parent batch. Never attach another
  // payment's ID to an otherwise valid receipt/draft.
  const batchIdentity = source[0].batchId;
  if (batchIdentity && sourcePaymentId !== batchIdentity)
    throw Error('The complete original payment batch identity does not match.');
  if (!batchIdentity && source.length === 1 && source[0].paymentTransactionId &&
      sourcePaymentId !== source[0].paymentTransactionId)
    throw Error('The original payment identity does not match the selected receipt.');
  const service = source[0].paymentCategory;
  if(service==='GIFT_TAX'){
    const receipt=source[0];
    const draft=parseGiftTaxReuseDraft({schemaVersion:1,giftDetails:receipt.giftDetails,
      payerName:receipt.payerName??'',phone:receipt.receiptMobile??''});
    if(source.length!==1||!receipt.isSimulatedDemo||receipt.batchId||!draft||
       receipt.paymentTransactionId!==sourcePaymentId||
       !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sourcePaymentId)||
       receipt.taxCreditStatus!=='NOT_APPLICABLE'||receipt.items.length!==1)
      throw Error('Original Gift Tax details are incomplete.');
    const gift=draft.giftDetails,head=receipt.items[0];
    const year=Number(gift.giftDate.slice(0,4))+(Number(gift.giftDate.slice(5,7))>=7?1:0);
    if(receipt.taxpayerTin!==gift.donor.tin||receipt.taxpayerName!==gift.donor.name||
       receipt.paymentRemarks!==gift.remarks||
       receipt.assessmentYear!==year+'-'+String(year+1).slice(-2)||
       checkedMinor(receipt.totalAmount)!==gift.estimatedTaxMinor||
       head.headId!==0||head.economicCode!=='SIM-GIFT'||head.headNameEn!=='Gift Tax'||
       reconciledHeadMinor(head)!==gift.estimatedTaxMinor||
       head.penaltyAmount!==0||head.surchargeAmount!==0||head.interestAmount!==0)
      throw Error('Original Gift Tax receipt does not reconcile.');
    return {ownerUid,sourcePaymentId,service,formPayload:{schemaVersion:1,...draft}};
  }
  // Travel receipts deliberately contain only masked passports. Copy the
  // itinerary and passenger names, but require fresh identity and travel-date
  // checks. Never invent a passport/DOB from a masked financial receipt.
  if (service === 'TRAVEL_TAX') {
    if (source.length !== 1 || !source[0].isSimulatedDemo || source[0].batchId)
      throw Error('The original travel payment is incomplete.');
    const receipt = source[0];
    const trip = receipt.travelDetails;
    const parentMinor = Math.round(receipt.totalAmount * 100);
    if (!trip || !['LAND','WATER'].includes(trip.mode) ||
        typeof trip.departurePort !== 'string' || !trip.departurePort.trim() ||
        typeof trip.destination !== 'string' || !trip.destination.trim() ||
        typeof trip.travelDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trip.travelDate) ||
        trip.economicCode !== TRAVEL_TAX_ECONOMIC_CODE ||
        !Array.isArray(trip.passengers) || !trip.passengers.length ||
        trip.passengers.length > 20 || receipt.items.length !== trip.passengers.length ||
        !(receipt.totalAmount > 0) || !Number.isSafeInteger(parentMinor) ||
        Math.abs(receipt.totalAmount * 100 - parentMinor) > 0.000001)
      throw Error('Original travel details are incomplete.');
    const sum = trip.passengers.reduce((total, passenger, index) => {
      const minor = Math.round(passenger.amount * 100);
      const head = receipt.items[index];
      const lineMinor = Math.round(head.totalAmount * 100);
      // The old receipt is historical evidence, not a reusable rate authority.
      // A wrong passenger head, age band or unit amount must never be copied
      // into another journey under a convincing but unrelated receipt total.
      if (!Number.isFinite(passenger.amount) || passenger.amount < 0 ||
          !Number.isSafeInteger(minor) || Math.abs(passenger.amount * 100 - minor) > 0.000001 ||
          !Number.isFinite(head.totalAmount) || Math.abs(head.totalAmount * 100 - lineMinor) > 0.000001 ||
          minor !== lineMinor || head.headId !== 155 + index ||
          head.economicCode !== trip.economicCode ||
          head.headNameEn !== 'Travel tax — ' + passenger.name ||
          // Travel Tax has no permitted hidden fees. Compare the saved tax
          // exactly in minor units rather than rounding away fractional cents.
          !Number.isFinite(head.taxAmount) ||
          Math.abs(head.taxAmount * 100 - minor) > 0.000001 ||
          head.penaltyAmount !== 0 || head.surchargeAmount !== 0 ||
          head.interestAmount !== 0 ||
          !['ADULT','CHILD','UNDER5'].includes(passenger.ageBand) ||
          typeof passenger.name !== 'string' || !passenger.name.trim() ||
          !['BD','FOREIGN'].includes(passenger.nationality) ||
          (passenger.nationality === 'FOREIGN' && !passenger.country?.trim()))
        throw Error('Original travel passenger details cannot be reconciled.');
      return total + minor;
    }, 0);
    if (sum !== parentMinor)
      throw Error('Original travel amount does not reconcile.');
    const passengers = trip.passengers.map((passenger,index) => ({
      id: 'repeat-traveller-' + (index + 1),
      nationality: passenger.nationality,
      passport: '',
      name: passenger.name,
      // Preserve the recorded category for the editable copy; the new journey
      // still requires fresh DOB, date and passport validation before rating.
      ageBand: passenger.ageBand,
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
  if (source.some(r => !r.isSimulatedDemo || r.paymentCategory !== service || !reusableHeads(r).length))
    throw Error('The original payment is incomplete and cannot be copied.');
  // Return is exclusive in BOTH directions. Historical records sometimes
  // carry an OTHER_TAX_PAYMENT parent category even when an invalid line is a
  // Return head. Never reconstruct that line into an editable combined draft.
  // The original remains untouched; the payer must start a valid new journey.
  const hasReturnHead = source.some(r => reusableHeads(r).some(head => head.headId === 125));
  // Only an explicitly verified unified v5 parent can replay a mixed Return.
  // Legacy Return and non-v5 combined receipts keep their exclusive rules.
  const unifiedV5 = source.length===1 && service==='OTHER_TAX_PAYMENT' &&
    source[0].allocationContractVersion===5 && Boolean(source[0].allocationItems?.length) &&
    source[0].allocationItems!.every(item=>typeof item.allocationId==='string'&&!!item.allocationId.trim());
  if ((service === 'TAX_WITH_RETURN' && source.some(r =>
      reusableHeads(r).some(head => head.headId !== 125))) ||
      (service !== 'TAX_WITH_RETURN' && hasReturnHead && !unifiedV5))
    throw Error('Tax with Return cannot be combined with another payment head.');
  // A single fetched row may still belong to a larger multi-item batch.
  // Never treat a partial history page or missing item as an entire payment.
  const isBatch = source.some(r => r.batchId || r.batchItemCount || r.batchItemIndex);
  // A modern combined SQL payment has ONE receipt with several allocations.
  // Multiple receipt rows are related only when all carry one complete batch.
  // Never manufacture a combined draft out of unrelated recorded payments.
  if (!isBatch && source.length !== 1)
    throw Error('The complete original batch is unavailable.');
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
  // Explicit allocation data takes precedence over legacy receipt summaries.
  const returnWithAllocations = service === 'TAX_WITH_RETURN' &&
    sorted.some(receipt => (receipt.allocationItems?.length ?? 0) > 0);
  const hasAllocationSnapshot = service === 'OTHER_TAX_PAYMENT' || returnWithAllocations ||
    sorted.some(receipt => (receipt.allocationItems?.length ?? 0) > 0);
  const allocations: SourceAllocation[] = [];
  for (const receipt of sorted) {
    const savedHeads = reusableHeads(receipt);
    if (hasAllocationSnapshot) {
      if (!receipt.allocationItems?.length || savedHeads.length !== receipt.allocationItems.length)
        throw Error('Original taxpayer/head/year allocations are incomplete.');
      for (let index = 0; index < savedHeads.length; index++) {
        const head = savedHeads[index];
        const allocation = receipt.allocationItems[index];
        const tin = allocation.taxpayerTin ?? '';
        const value = checkedMinor(head.totalAmount);
        if (!validTin(tin) || head.headId <= 0 || !Number.isSafeInteger(head.headId) ||
            (returnWithAllocations && head.headId !== 125) ||
            !Number.isSafeInteger(allocation.amountMinor) || allocation.amountMinor !== value)
          throw Error('Original taxpayer allocation cannot be reconciled.');
        allocations.push({tin, name: allocation.taxpayerName, headId: head.headId,
          year: allocation.assessmentYear, amountMinor: value});
      }
    } else {
      const tin = receipt.taxpayerTin ?? '';
      if (!validTin(tin)) throw Error('Original taxpayer identity cannot be verified.');
      for (const head of savedHeads) {
        if (!Number.isSafeInteger(head.headId) || head.headId <= 0)
          throw Error('Original payment head is missing.');
        allocations.push({tin, name: '', headId: head.headId,
          year: receipt.assessmentYear, amountMinor: checkedMinor(head.totalAmount)});
      }
    }
    const receiptSum = savedHeads.reduce((sum, h) => sum + reconciledHeadMinor(h), 0);
    if (receiptSum !== checkedMinor(receipt.totalAmount))
      throw Error('Original payment amount does not reconcile.');
  }
  if (!allocations.length || allocations.length > MAX_COMBINED_ALLOCATIONS)
    throw Error('The original payment exceeds the supported allocation limit.');
  // A saved non-Return transaction may contain multiple independently dated,
  // headed or recipient-owned allocations even if its original category was
  // a single-head service. Use the existing combined editor; never flatten it.
  const isAllocationPayment = service === 'OTHER_TAX_PAYMENT' ||
    (service !== 'TAX_WITH_RETURN' && allocations.length > 1);
  if (service === 'TAX_WITH_RETURN' && allocations.length !== 1)
    throw Error('Tax with Return requires exactly one taxpayer and one assessment year.');
  const exactAllocations = allocations.map(item => item.tin + ':' + item.headId + ':' + item.year);
  if (new Set(exactAllocations).size !== allocations.length)
    throw Error('The original payment contains duplicate taxpayer/head/year allocations.');
  const people = new Map<string, {tin:string;name:string;id:string}>();
  for (const item of allocations) if (!people.has(item.tin))
    people.set(item.tin, {tin:item.tin,name:item.name,id:`repeat-${people.size + 1}`});
  const ownerIsPayee = Boolean(ownTin && validTin(ownTin) && people.has(ownTin));
  const firstTin = ownerIsPayee ? ownTin! : allocations[0].tin;
  const first = people.get(firstTin)!;
  first.id='primary';
  const others = [...people.values()].filter(p => p !== first);
  const ownOnly=ownerIsPayee && others.length===0;
  const initial = sorted[0];
  const years = allocations.map(item => copiedYear(item.year));
  const payload: Record<string, unknown> = {
    schemaVersion: 1, category: isAllocationPayment ? 'OTHER_TAX_PAYMENT' : service,
    step: 1, forSelf: ownOnly,
    ...(unifiedV5 || (isAllocationPayment && ownerIsPayee && others.length>0) ? {unifiedFlowVersion:5} : {}),
    tin: ownOnly ? '' : first.tin,
    payerName: '', otherTaxpayerName: first.name,
    additionalTaxpayers: others,
    otherTaxLines: isAllocationPayment
      ? allocations.map((item,index) => ({
          // A repeat is a NEW payment. Historical source IDs remain read-only;
          // each editable copy receives independent, valid allocation identities.
          id: crypto.randomUUID(),
          taxpayerId: people.get(item.tin)!.id,
          headId: item.headId,
          assessmentYear: years[index], amount: money(item.amountMinor)
        })) : [],
    phone: /^01\d{9}$/.test(initial.receiptMobile ?? '') ? initial.receiptMobile : '',
    receiptEmail: '',
    assessmentYear: years[0],
    // Old notice/demand references are historical, not new payment authority.
    noticeReference: '',
    paymentRemarks: initial.paymentRemarks ?? '',
    incomeTaxType: null,
    selectedHeadIds: isAllocationPayment ? [] : [...new Set(allocations.map(a=>a.headId))],
    amountInputs: isAllocationPayment ? {} : Object.fromEntries(
      allocations.map(a => [a.headId, money(a.amountMinor)])),
  };
  if (!isAllocationPayment && allocations.some(a => a.year !== allocations[0].year))
    throw Error('Mixed assessment years require the allocation payment service.');
  if (!isAllocationPayment && allocations.some(a => a.tin !== allocations[0].tin))
    throw Error('Mixed taxpayers require the allocation payment service.');
  // Old allocation identities remain historical provenance, not IDs for the
  // new payment. The new composer generates independent IDs on submission.
  const historicalIds=sorted.flatMap(receipt => (receipt.allocationItems ?? [])
    .map(item => item.allocationId).filter((id):id is string=>typeof id==='string'&&!!id.trim()));
  const sourceAllocationIds=historicalIds.length===allocations.length &&
    new Set(historicalIds).size===historicalIds.length ? historicalIds : undefined;
  // The source parent stays immutable. Only a multi-allocation NON-Return copy
  // changes editor service to the approved general combined-payment composer.
  return {ownerUid,sourcePaymentId,
    service:isAllocationPayment?'OTHER_TAX_PAYMENT':service,
    ...(sourceAllocationIds?{sourceAllocationIds}:{}),formPayload:payload};
}


/** Older SQL-recorded simulated payments predate the immutable receipt snapshot.
 * Copy only independently recorded, single-head facts; the missing head and
 * income-tax classification MUST be reselected in the existing payment wizard.
 * Never use this compatibility path for a modern damaged/incomplete receipt,
 * mixed service, multiple payer/beneficiary rows or a Travel Tax itinerary.
 */
export function reuseLegacySingleHeadPayment(
  original:{
    id:string;service:string;status:string;amountMinor:number;details:Record<string,unknown>;
  },
  ownerUid:string,ownTin:string|null,
):PaymentReuse {
  if(!ownerUid || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(original.id) ||
    original.status!=='SIMULATED_SUCCESS' || !Number.isSafeInteger(original.amountMinor) ||
    original.amountMinor<=0 || !original.details || typeof original.details!=='object' ||
    Array.isArray(original.details))
    throw Error('The original recorded payment cannot be verified.');
  const service=original.service as PaymentCategory;
  if(!supported.has(service) || service==='OTHER_TAX_PAYMENT' ||
    original.details.receiptSnapshot!=null || original.details.receiptLines!=null ||
    original.details.allocations!=null || original.details.combinedPayment===true)
    throw Error('A complete historical allocation is required.');
  const details=original.details;
  const tin=details.taxpayerTin;
  if(typeof tin!=='string'||!validTin(tin)||
    (typeof details.payerId==='string' && details.payerId!==ownerUid))
    throw Error('Original payer or taxpayer identity is incomplete.');
  const lines=details.lines;
  if(!Array.isArray(lines)||lines.length!==1)throw Error('Historical multi-head payment needs its full allocation.');
  const line=lines[0] as Record<string,unknown>|null;
  if(!line || typeof line!=='object' || Array.isArray(line) ||
    line.category!==service || line.amountMinor!==original.amountMinor ||
    typeof line.assessmentYear!=='string' || !validYear(line.assessmentYear) ||
    (details.assessmentYear!=null && details.assessmentYear!==line.assessmentYear) ||
    // Historic head IDs belong to a different catalogue. Validate their
    // shape, but NEVER reuse them as today's payment head. The wizard
    // requires an explicit new head selection instead.
    (line.headId!=null && (!Number.isSafeInteger(line.headId) || (line.headId as number)<=0)) ||
    (line.taxpayerTin!=null && line.taxpayerTin!==tin) ||
    (line.beneficiary!=null && typeof line.beneficiary!=='string'))
    throw Error('Historical source facts do not reconcile.');
  // A historical amount is a form-input suggestion, not an approved tax head,
  // existing challan, government credit or beneficiary authorization.
  const ownerIsPayee=Boolean(ownTin&&validTin(ownTin)&&ownTin===tin);
  if(ownerIsPayee && line.beneficiary!=null && line.beneficiary!==ownerUid)
    throw Error('Historical beneficiary identity conflicts with the payer.');
  return {ownerUid,sourcePaymentId:original.id,service,formPayload:{
    schemaVersion:1,category:service,step:1,forSelf:ownerIsPayee,
    tin:ownerIsPayee?'':tin,payerName:'',otherTaxpayerName:'',
    additionalTaxpayers:[],otherTaxLines:[],phone:'',receiptEmail:'',
    assessmentYear:copiedYear(line.assessmentYear),
    noticeReference:'',
    // Historical SQL parents may predate receipt snapshots; retain their original remarks
    // as editable input for a NEW Pay Again payment without altering the saved parent.
    paymentRemarks:typeof details.challanRemarks==='string'?details.challanRemarks:
      typeof details.paymentRemarks==='string'?details.paymentRemarks:'',
    incomeTaxType:null,selectedHeadIds:[],
    amountInputs:{},legacySourceAmount:money(original.amountMinor),
  }};
}
