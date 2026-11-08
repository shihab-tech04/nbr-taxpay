import type { ChallanReceipt, PaymentLineItem, ReceiptAllocationItem } from '../types/tax';
import type { StoryPaymentInput } from './simulatedPaymentStory';

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
const MAX_LINES = 20;
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
  for (let i = 0; i < lines.length; i++) {
    const allocation = lines[i];
    if (!allocation.sourceId || !validTin(allocation.taxpayerTin) ||
      !allocation.assessmentYear || !Number.isSafeInteger(allocation.amountMinor) ||
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
    paymentServiceBn: item.line.headNameEn,
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
  if (JSON.stringify({ ...payload, origin: 'TAXPAY_UI' }).length > 12000)
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
/** Durable exact-key retry; only one combined SQL row may be created. */
export function saveCombinedOtherTaxRequest(
  request: StoredCombinedRequest['request'],
  phase: StoredCombinedRequest['phase'],
  storage: CombinedStorage = sessionStorage,
): void {
  validateCombinedRequest(request);
  storage.setItem(combinedKey(request.payload.sessionId),JSON.stringify({version:2,phase,request}));
}
export function loadCombinedOtherTaxRequest(
  sessionId: string,
  storage: CombinedStorage = sessionStorage,
): StoredCombinedRequest | null {
  const raw=storage.getItem(combinedKey(sessionId));
  if(!raw)return null;
  let parsed:StoredCombinedRequest;
  try{parsed=JSON.parse(raw) as StoredCombinedRequest;}catch{throw Error('INVALID_COMBINED_RECOVERY');}
  if(parsed?.version!==2||!['READY','PENDING_BANK'].includes(parsed.phase)||
    parsed.request?.payload?.sessionId!==sessionId)
    throw Error('INVALID_COMBINED_RECOVERY');
  validateCombinedRequest(parsed.request);
  return parsed;
}
export function clearCombinedOtherTaxRequest(sessionId:string,storage: CombinedStorage = sessionStorage): void {
  if(!UUID.test(sessionId))throw Error('INVALID_COMBINED_RECOVERY');
  storage.removeItem(combinedKey(sessionId));
}
function validateCombinedRequest(request: StoredCombinedRequest['request']): void {
  const {payload,receipt}=request;
  const allocations=payload?.details?.allocations;
  const snapshot=payload?.details?.receiptSnapshot as Partial<ChallanReceipt>|undefined;
  if(!payload||!receipt||!UUID.test(payload.sessionId)||!UUID.test(payload.idempotencyKey)||
    payload.service!=='OTHER_TAX_PAYMENT'||payload.details.combinedPayment!==true||
    !Array.isArray(allocations)||!allocations.length||allocations.length>MAX_LINES||
    !Array.isArray(payload.details.lines)||payload.details.lines.length!==allocations.length||
    !snapshot||snapshot.challanNo!==receipt.challanNo||receipt.isSimulatedDemo!==true||
    receipt.challanNo!=='SIM-'+payload.idempotencyKey||
    !Array.isArray(receipt.allocationItems)||receipt.allocationItems.length!==allocations.length||
    Math.round(receipt.totalAmount*100)!==payload.amountMinor||
    !Number.isSafeInteger(payload.amountMinor)||payload.amountMinor<=0)
    throw Error('INVALID_COMBINED_RECOVERY');
  const sum=allocations.reduce((value,item,index)=>{
    const a=item as Record<string,unknown>;
    const r=receipt.allocationItems![index];
    if(!a||typeof a!=='object'||!validTin(String(a.taxpayerTin??''))||
      typeof a.amountMinor!=='number'||!Number.isSafeInteger(a.amountMinor)||a.amountMinor<=0||
      typeof a.assessmentYear!=='string'||!a.assessmentYear||
      a.taxpayerTin!==r.taxpayerTin||a.assessmentYear!==r.assessmentYear||
      a.amountMinor!==r.amountMinor)
      throw Error('INVALID_COMBINED_RECOVERY');
    return value+(a.amountMinor as number);
  },0);
  if(sum!==payload.amountMinor||!Number.isSafeInteger(sum))throw Error('INVALID_COMBINED_RECOVERY');
}
