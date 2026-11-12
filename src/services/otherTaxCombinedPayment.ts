import type { ChallanReceipt, PaymentLineItem, ReceiptAllocationItem } from '../types/tax';
import type { StoryPaymentInput } from './simulatedPaymentStory';
import { MASTER_PAYMENT_HEADS, BLOCKED_HEAD_IDS } from '../data/paymentHeads';
import { V11_SOURCE_HEADS, isV11HeadReviewBlocked } from '../data/v11SourceHeads';

/** One immutable SQL payment and one receipt, with independently auditable allocations. */
export type CombinedOtherTaxLine = {
  sourceId: string;
  taxpayerTin: string;
  taxpayerName: string;
  assessmentYear: string;
  amountMinor: number;
  line: PaymentLineItem;
};

const validTin = (value: string) => /^\d{12,13}$/.test(value);
export const MAX_COMBINED_ALLOCATIONS = 256;
/** Keep existing forms below the same immutable SQL allocation count limit. */
export const fitsCombinedAllocationCapacity = (count: number) =>
  Number.isSafeInteger(count) && count >= 0 && count <= MAX_COMBINED_ALLOCATIONS;
export const MAX_COMBINED_PAYLOAD_CHARS = 750_000;
const MAX_LINES = MAX_COMBINED_ALLOCATIONS;
const eligibleHeads = new Map(V11_SOURCE_HEADS.filter(head =>
  (head.journey === 'LIABILITY' || head.journey === 'WITHHOLDING') &&
  head.active && head.purpose !== 'return' && head.map === 'MAPPED' &&
  !isV11HeadReviewBlocked(head) && !BLOCKED_HEAD_IDS.includes(head.id)
).map(head => [head.id, head]));
export function prepareCombinedOtherTaxPayment(
  original: StoryPaymentInput,
  receipt: ChallanReceipt,
  lines: CombinedOtherTaxLine[],
): { payload: StoryPaymentInput; receipt: ChallanReceipt } {
  if (original.service !== 'OTHER_TAX_PAYMENT' || original.details.payerMode !== 'OTHER' &&
    original.details.payerMode !== 'SELF' || lines.length < 1 || lines.length > MAX_LINES ||
    receipt.isSimulatedDemo !== true || receipt.items.length !== lines.length ||
    new Set(lines.map(line => line.sourceId)).size !== lines.length)
    throw new Error('INVALID_COMBINED_PAYMENT');
  let sum = 0;
  const uniqueAllocationKeys = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const allocation = lines[i];
    const head = eligibleHeads.get(allocation.line.headId);
    if (!head || allocation.line.headNameEn !== head.en || allocation.line.economicCode !== head.codeEn)
      throw new Error('INVALID_COMBINED_HEAD');
    const uniqueKey = `${allocation.taxpayerTin}:${allocation.line.headId}:${allocation.assessmentYear}`;
    if (uniqueAllocationKeys.has(uniqueKey)) throw new Error('DUPLICATE_COMBINED_ALLOCATION');
    uniqueAllocationKeys.add(uniqueKey);
    if (!allocation.sourceId || !validTin(allocation.taxpayerTin) ||
      !/^20\d{2}-\d{2}$/.test(allocation.assessmentYear) ||
      Number(allocation.assessmentYear.slice(5)) !== (Number(allocation.assessmentYear.slice(0, 4)) + 1) % 100 ||
      !Number.isSafeInteger(allocation.amountMinor) ||
      allocation.amountMinor <= 0 || allocation.line.headId <= 0 ||
      !Number.isSafeInteger(allocation.line.headId) ||
      Math.round(allocation.line.totalAmount * 100) !== allocation.amountMinor ||
      JSON.stringify(receipt.items[i]) !== JSON.stringify(allocation.line))
      throw new Error('INVALID_COMBINED_ALLOCATION');
    sum += allocation.amountMinor;
  }
  if (!Number.isSafeInteger(sum) || sum !== original.amountMinor ||
    Math.round(receipt.totalAmount * 100) !== sum)
    throw new Error('COMBINED_TOTAL_MISMATCH');
  const tins = [...new Set(lines.map(item => item.taxpayerTin))];
  const years = [...new Set(lines.map(item => item.assessmentYear))];
  const allocationItems: ReceiptAllocationItem[] = lines.map(item => ({
    taxpayerName: item.taxpayerName.trim() || 'TIN ' + item.taxpayerTin,
    taxpayerTin: item.taxpayerTin,
    paymentServiceEn: item.line.headNameEn,
    paymentServiceBn: MASTER_PAYMENT_HEADS.find(head => head.id===item.line.headId && head.nameEn===item.line.headNameEn)?.nameBn || item.line.headNameEn,
    assessmentYear: item.assessmentYear,
    amountMinor: item.amountMinor,
    economicCode: item.line.economicCode,
  }));
  const combinedReceipt: ChallanReceipt = {
    ...receipt,
    taxpayerTin: tins.length === 1 ? tins[0] : undefined,
    assessmentYear: years.join(', '),
    allocationItems,
  };
  const payload: StoryPaymentInput = {
    ...original,
    details: {
      ...original.details,
      combinedPayment: true,
      allocationCount: lines.length,
      taxpayerCount: tins.length,
      taxpayerTin: tins.length === 1 ? tins[0] : '',
      taxpayerName: tins.length === 1 ? lines[0].taxpayerName : tins.length + ' taxpayers',
      assessmentYear: years.join(', '),
      lines: receipt.items,
      allocations: lines.map(item => ({
        taxpayerTin: item.taxpayerTin, taxpayerName: item.taxpayerName,
        headId: item.line.headId, assessmentYear: item.assessmentYear,
        amountMinor: item.amountMinor,
      })),
      totalAmount: sum / 100,
      receiptSnapshot: { ...combinedReceipt, treasuryStatus: 'GATEWAY_SUCCESS' },
    },
  };
  if (JSON.stringify({ ...payload, origin: 'TAXPAY_UI' }).length > MAX_COMBINED_PAYLOAD_CHARS)
    throw new Error('PAYMENT_DETAILS_TOO_LONG');
  return { payload, receipt: combinedReceipt };
}

const COMBINED_STORAGE_KEY = 'taxpay-other-tax-combined-v2';
const combinedKey = (sessionId:string) => COMBINED_STORAGE_KEY + ':' + sessionId;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type StoredCombinedRequest = {
  version: 2;
  phase: 'READY' | 'PENDING_BANK';
  request: { payload: StoryPaymentInput; receipt: ChallanReceipt };
};
type CombinedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** An unavailable sessionStorage must not block an otherwise valid, idempotent
 * SQL submission. This memory fallback survives only while this tab is open. */
const volatileRequests = new Map<string, StoredCombinedRequest>();
const storageFor = (provided?: CombinedStorage): CombinedStorage | null => {
  if (provided) return provided;
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; }
  catch { return null; }
};
/** Durable exact-key retry. Returns false if the request is held in memory
 * only; callers must warn that closing/reloading the tab loses recovery. */
export function saveCombinedOtherTaxRequest(
  request: StoredCombinedRequest['request'],
  phase: StoredCombinedRequest['phase'],
  storage?: CombinedStorage,
): boolean {
  validateCombinedRequest(request);
  const key = combinedKey(request.payload.sessionId);
  const pending: StoredCombinedRequest = { version: 2, phase, request };
  const encoded = JSON.stringify(pending);
  const activeStorage = storageFor(storage);
  if (activeStorage) {
    try {
      activeStorage.setItem(key, encoded);
      volatileRequests.delete(key);
      return true;
    } catch { /* Storage denied, full, or private browsing: retain exact request in this tab. */ }
  }
  volatileRequests.set(key, pending);
  return false;
}
export function loadCombinedOtherTaxRequest(
  sessionId: string,
  storage?: CombinedStorage,
): StoredCombinedRequest | null {
  const key = combinedKey(sessionId);
  const cached = volatileRequests.get(key);
  let raw: string | null = null;
  if (!cached) {
    try { raw = storageFor(storage)?.getItem(key) ?? null; }
    catch { /* Fall back to current-tab request when storage is unavailable. */ }
  }
  if (!cached && !raw) return null;
  let parsed: StoredCombinedRequest;
  try { parsed = cached ?? JSON.parse(raw!) as StoredCombinedRequest; }
  catch { throw Error('INVALID_COMBINED_RECOVERY'); }
  if (parsed?.version !== 2 || !['READY','PENDING_BANK'].includes(parsed.phase) ||
    parsed.request?.payload?.sessionId !== sessionId)
    throw Error('INVALID_COMBINED_RECOVERY');
  validateCombinedRequest(parsed.request);
  return parsed;
}
export function clearCombinedOtherTaxRequest(sessionId: string, storage?: CombinedStorage): void {
  if (!UUID.test(sessionId)) throw Error('INVALID_COMBINED_RECOVERY');
  const key = combinedKey(sessionId);
  volatileRequests.delete(key);
  try { storageFor(storage)?.removeItem(key); }
  catch { /* The exact in-memory key was cleared even when storage is unavailable. */ }
}
function validateCombinedRequest(request: StoredCombinedRequest['request']): void {
  const {payload,receipt}=request;
  const details=payload?.details;
  const allocations=details?.allocations;
  const lines=details?.lines;
  const snapshot=details?.receiptSnapshot as Partial<ChallanReceipt>|undefined;
  // Recovery is a copy of the exact pending SQL request, not a new editable
  // allocation. Recheck every cross-projection identity before retrying it.
  if(!payload||!receipt||!details||!UUID.test(payload.sessionId)||!UUID.test(payload.idempotencyKey)||
    payload.service!=='OTHER_TAX_PAYMENT'||details.combinedPayment!==true||
    !Array.isArray(allocations)||!allocations.length||allocations.length>MAX_LINES||
    !Array.isArray(lines)||lines.length!==allocations.length||
    !Array.isArray(receipt.items)||receipt.items.length!==allocations.length||
    !Array.isArray(receipt.allocationItems)||receipt.allocationItems.length!==allocations.length||
    !snapshot||!Array.isArray(snapshot.items)||!Array.isArray(snapshot.allocationItems)||
    snapshot.challanNo!==receipt.challanNo||receipt.challanNo!=='SIM-'+payload.idempotencyKey||
    receipt.isSimulatedDemo!==true||receipt.paymentCategory!=='OTHER_TAX_PAYMENT'||
    snapshot.paymentCategory!=='OTHER_TAX_PAYMENT'||
    !Number.isSafeInteger(payload.amountMinor)||payload.amountMinor<=0||
    Math.round(receipt.totalAmount*100)!==payload.amountMinor||
    Math.round(Number(snapshot.totalAmount)*100)!==payload.amountMinor||
    Math.round(Number(details.totalAmount)*100)!==payload.amountMinor||
    details.allocationCount!==allocations.length||
    JSON.stringify(lines)!==JSON.stringify(receipt.items)||
    JSON.stringify(snapshot.items)!==JSON.stringify(receipt.items)||
    JSON.stringify(snapshot.allocationItems)!==JSON.stringify(receipt.allocationItems))
    throw Error('INVALID_COMBINED_RECOVERY');
  let sum=0;
  const unique=new Set<string>();
  const tins=new Set<string>();
  for(let index=0;index<allocations.length;index++){
    const a=allocations[index] as Record<string,unknown>;
    const tin=a?.taxpayerTin;
    const r=receipt.allocationItems[index];
    const line=receipt.items[index];
    if(!a||typeof a!=='object'||Array.isArray(a)||!r||!line||
      typeof tin!=='string'||!validTin(tin)||
      typeof a.taxpayerName!=='string'||
      typeof a.amountMinor!=='number'||!Number.isSafeInteger(a.amountMinor)||a.amountMinor<=0||
      typeof a.headId!=='number'||!Number.isSafeInteger(a.headId)||a.headId<=0||
      typeof a.assessmentYear!=='string'||!/^20\d{2}-\d{2}$/.test(a.assessmentYear)||
      Number(a.assessmentYear.slice(5))!==(Number(a.assessmentYear.slice(0,4))+1)%100||
      a.headId!==line.headId||a.taxpayerTin!==r.taxpayerTin||
      a.assessmentYear!==r.assessmentYear||a.amountMinor!==r.amountMinor||
      r.taxpayerName!==(a.taxpayerName.trim()||'TIN '+a.taxpayerTin)||
      r.economicCode!==line.economicCode||r.paymentServiceEn!==line.headNameEn||
      Math.round(line.totalAmount*100)!==a.amountMinor)
      throw Error('INVALID_COMBINED_RECOVERY');
    const key=tin+':'+a.headId+':'+a.assessmentYear;
    if(unique.has(key))throw Error('INVALID_COMBINED_RECOVERY');
    unique.add(key);
    tins.add(tin);
    sum+=a.amountMinor;
    if(!Number.isSafeInteger(sum))throw Error('INVALID_COMBINED_RECOVERY');
  }
  const oneTin=tins.size===1?[...tins][0]:'';
  if(sum!==payload.amountMinor||details.taxpayerCount!==tins.size||
    details.taxpayerTin!==oneTin||receipt.taxpayerTin!==(oneTin||undefined))
    throw Error('INVALID_COMBINED_RECOVERY');
}
