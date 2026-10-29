import type { ChallanReceipt, PaymentLineItem } from '../types/tax';
import type { StoryPaymentAcknowledgement, StoryPaymentInput } from './simulatedPaymentStory';

const STORAGE_KEY = 'taxpay-other-tax-batch-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MINOR = 999999999999;
let activeBatch: string | null = null;

export type OtherTaxBatchSourceItem = {
  sourceId: string;
  taxpayerTin: string;
  taxpayerName: string;
  assessmentYear: string;
  amountMinor: number;
  line: PaymentLineItem;
};
export type OtherTaxBatchItem = {
  sourceId: string;
  payload: StoryPaymentInput;
  receipt: ChallanReceipt;
  confirmedId?: string;
};
export type OtherTaxBatch = {
  version: 1;
  id: string;
  sessionId: string;
  phase: 'PENDING_BANK' | 'READY' | 'COMPLETE';
  amountMinor: number;
  items: OtherTaxBatchItem[];
};
type BatchStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Create one stable request and receipt per cart item, with no parent challan. */
export function createOtherTaxBatch(
  template: StoryPaymentInput,
  receipt: ChallanReceipt,
  source: OtherTaxBatchSourceItem[],
  phase: 'PENDING_BANK' | 'READY',
  uuid: () => string = () => crypto.randomUUID(),
): OtherTaxBatch {
  if (!source.length || template.service !== 'OTHER_TAX_PAYMENT' || !UUID.test(template.sessionId))
    throw new Error('INVALID_BATCH');
  const amountMinor = source.reduce((sum, item) => sum + item.amountMinor, 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_MINOR ||
      amountMinor !== template.amountMinor ||
      source.some(item => !Number.isSafeInteger(item.amountMinor) || item.amountMinor <= 0 ||
        !/^\d{12,13}$/.test(item.taxpayerTin) || !item.sourceId || !item.assessmentYear) ||
      new Set(source.map(item => item.sourceId)).size !== source.length)
    throw new Error('INVALID_BATCH');
  const batchId = uuid();
  const items = source.map((item, index) => {
    const id = uuid();
    const itemReceipt: ChallanReceipt = {
      ...receipt, id: `rcpt-${id}`, taxEventId: `SIM-EVENT-${id}`,
      paymentTransactionId: `SIM-PAYMENT-${id}`, challanNo: `SIM-${id}`,
      tokenNumber: `SIM-TOKEN-${id}`, gatewayTransactionId: `SIM-TXN-${id}`,
      taxpayerTin: item.taxpayerTin, assessmentYear: item.assessmentYear,
      items: [item.line], totalAmount: item.amountMinor / 100,
    };
    const payload: StoryPaymentInput = {
      ...template, idempotencyKey: id, amountMinor: item.amountMinor,
      details: {
        ...template.details, receiptReference: itemReceipt.challanNo,
        taxpayerTin: item.taxpayerTin, taxpayerName: item.taxpayerName,
        assessmentYear: item.assessmentYear, lines: [item.line],
        allocations: [{ taxpayerTin: item.taxpayerTin, taxpayerName: item.taxpayerName,
          headId: item.line.headId, assessmentYear: item.assessmentYear, amountMinor: item.amountMinor }],
        totalAmount: item.amountMinor / 100,
        receiptSnapshot: { ...itemReceipt, treasuryStatus: 'GATEWAY_SUCCESS' },
        batchId, batchItemId: item.sourceId, batchItemIndex: index + 1, batchItemCount: source.length,
      },
    };
    // The existing endpoint rejects request bodies longer than 12,000 characters.
    if (JSON.stringify({ ...payload, origin: 'TAXPAY_UI' }).length > 12000)
      throw new Error('PAYMENT_DETAILS_TOO_LONG');
    return { sourceId: item.sourceId, payload, receipt: itemReceipt };
  });
  const batch: OtherTaxBatch = { version: 1, id: batchId, sessionId: template.sessionId, phase, amountMinor, items };
  validateOtherTaxBatch(batch, template.sessionId);
  return batch;
}

/** Reject incomplete stored requests instead of silently creating a new batch. */
export function validateOtherTaxBatch(value: unknown, sessionId: string): asserts value is OtherTaxBatch {
  if (!value || typeof value !== 'object') throw new Error('INVALID_BATCH');
  const batch = value as OtherTaxBatch;
  if (batch.version !== 1 || !UUID.test(batch.id) || batch.sessionId !== sessionId || !UUID.test(sessionId) ||
      !['PENDING_BANK', 'READY', 'COMPLETE'].includes(batch.phase) ||
      !Number.isSafeInteger(batch.amountMinor) || batch.amountMinor <= 0 || batch.amountMinor > MAX_MINOR ||
      !Array.isArray(batch.items) || !batch.items.length) throw new Error('INVALID_BATCH');
  let sum = 0;
  const ids = new Set<string>(), sources = new Set<string>(), confirmed = new Set<string>();
  for (const [index, item] of batch.items.entries()) {
    if (!item || !item.payload || !item.receipt || !item.sourceId || sources.has(item.sourceId) ||
        item.payload.service !== 'OTHER_TAX_PAYMENT' || item.payload.sessionId !== sessionId ||
        !UUID.test(item.payload.idempotencyKey) || ids.has(item.payload.idempotencyKey) ||
        !Number.isSafeInteger(item.payload.amountMinor) || item.payload.amountMinor <= 0 ||
        item.receipt.isSimulatedDemo !== true || item.receipt.items?.length !== 1 ||
        item.receipt.challanNo !== `SIM-${item.payload.idempotencyKey}` ||
        item.receipt.totalAmount !== item.payload.amountMinor / 100 ||
        (item.confirmedId !== undefined && (!UUID.test(item.confirmedId) || confirmed.has(item.confirmedId))))
      throw new Error('INVALID_BATCH');
    const details = item.payload.details;
    const allocation = Array.isArray(details?.allocations) && details.allocations.length === 1
      ? details.allocations[0] as Record<string, unknown> : null;
    const snapshot = details?.receiptSnapshot as Partial<ChallanReceipt> | undefined;
    const line = item.receipt.items[0];
    if (!details || !allocation || !line || !Number.isSafeInteger(line.headId) || line.headId <= 0 ||
        line.totalAmount !== item.payload.amountMinor / 100 ||
        !/^\d{12,13}$/.test(item.receipt.taxpayerTin ?? '') ||
        details.batchId !== batch.id || details.batchItemId !== item.sourceId ||
        details.batchItemIndex !== index + 1 || details.batchItemCount !== batch.items.length ||
        details.taxpayerTin !== item.receipt.taxpayerTin || details.assessmentYear !== item.receipt.assessmentYear ||
        details.receiptReference !== item.receipt.challanNo || details.totalAmount !== item.receipt.totalAmount ||
        allocation.taxpayerTin !== item.receipt.taxpayerTin || allocation.assessmentYear !== item.receipt.assessmentYear ||
        allocation.headId !== line.headId || allocation.amountMinor !== item.payload.amountMinor ||
        !Array.isArray(details.lines) || details.lines.length !== 1 ||
        JSON.stringify(details.lines[0]) !== JSON.stringify(line) ||
        !snapshot || snapshot.challanNo !== item.receipt.challanNo || snapshot.taxpayerTin !== item.receipt.taxpayerTin ||
        snapshot.totalAmount !== item.receipt.totalAmount || snapshot.assessmentYear !== item.receipt.assessmentYear)
      throw new Error('INVALID_BATCH');
    ids.add(item.payload.idempotencyKey); sources.add(item.sourceId); sum += item.payload.amountMinor;
    if (item.confirmedId) confirmed.add(item.confirmedId);
  }
  if (sum !== batch.amountMinor || (batch.phase === 'COMPLETE' && batch.items.some(item => !item.confirmedId)) ||
      (batch.phase === 'PENDING_BANK' && confirmed.size > 0))
    throw new Error('INVALID_BATCH');
}

export function saveOtherTaxBatch(batch: OtherTaxBatch, storage: BatchStorage = sessionStorage): void {
  validateOtherTaxBatch(batch, batch.sessionId);
  storage.setItem(STORAGE_KEY, JSON.stringify(batch));
}

export function loadOtherTaxBatch(sessionId: string, storage: BatchStorage = sessionStorage): OtherTaxBatch | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('INVALID_BATCH'); }
  validateOtherTaxBatch(value, sessionId);
  return value;
}

export function clearOtherTaxBatch(storage: BatchStorage = sessionStorage): void {
  storage.removeItem(STORAGE_KEY);
}

/** Persist before sending and after each acknowledgement. A lost response is retried with the original key. */
export async function syncOtherTaxBatch(
  initial: OtherTaxBatch,
  submit: (payload: StoryPaymentInput) => Promise<StoryPaymentAcknowledgement>,
  onProgress: (batch: OtherTaxBatch) => void,
  storage: BatchStorage = sessionStorage,
): Promise<OtherTaxBatch> {
  if (initial.phase !== 'READY') throw new Error('BATCH_NOT_READY');
  if (activeBatch) throw new Error('BATCH_IN_PROGRESS');
  activeBatch = initial.id;
  try {
    let batch = initial;
    saveOtherTaxBatch(batch, storage);
    for (let index = 0; index < batch.items.length; index++) {
      const item = batch.items[index];
      if (item.confirmedId) continue;
      const acknowledgement = await submit(item.payload);
      if (!UUID.test(acknowledgement.id) || acknowledgement.success !== true || acknowledgement.mirrored !== true ||
          acknowledgement.status !== 'SIMULATED_SUCCESS' || acknowledgement.simulationOnly !== true)
        throw new Error('OFFICE_SYNC_PENDING');
      batch = { ...batch, items: batch.items.map((entry, i) => i === index
        ? { ...entry, confirmedId: acknowledgement.id } : entry) };
      saveOtherTaxBatch(batch, storage);
      onProgress(batch);
    }
    batch = { ...batch, phase: 'COMPLETE' };
    saveOtherTaxBatch(batch, storage);
    onProgress(batch);
    return batch;
  } finally {
    activeBatch = null;
  }
}

export function confirmedBatchReceipts(batch: OtherTaxBatch): ChallanReceipt[] {
  return batch.items.flatMap(item => item.confirmedId ? [{
    ...item.receipt, paymentTransactionId: item.confirmedId,
    treasuryStatus: 'GATEWAY_SUCCESS' as const, treasuryScrollNo: undefined, treasuryDate: undefined,
  }] : []);
}
