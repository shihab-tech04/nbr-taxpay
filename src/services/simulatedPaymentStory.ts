import type { ChallanReceipt } from '../types/tax';
import {activePreviewSession} from './previewAccountSession';
import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import type {DemoUserId} from '../data/demoUsers';
import {sampleUserNumberForTin} from '../data/sampleTinSuggestions';
import {userIdForHostedTin} from './hostedDemoAuthorizations';
/** Synthetic-only persistence; browser session ID is not an authenticated account. */
export type StoryPaymentInput = {
  idempotencyKey: string;
  sessionId: string;
  service: string;
  amountMinor: number;
  details: Record<string, unknown>;
};
export type StoryPaymentAcknowledgement = {
  success: true;
  id: string;
  status: 'SIMULATED_SUCCESS';
  mirrored: boolean;
  simulationOnly: true;
};
const API = TAXPAY_PUBLIC_ENDPOINT.url.replace(/\/$/,'')+'/functions/v1/demo-story1-taxpay';
const headers={apikey:TAXPAY_PUBLIC_ENDPOINT.publishableKey};
let fallbackSession: string | undefined;
export function storyApiHeaders(sessionId?:string):Record<string,string>{
  const profile=activePreviewSession();
  if(!profile)return headers;
  if(sessionId&&sessionId!==profile.paymentSessionId)throw new Error('Demo account changed.');
  return {...headers,'x-taxpay-guest-capability':profile.capability};
}
export function getStorySessionId(): string {
  // The same fictional userN reuses one opaque synthetic-only SQL session on
  // every device. Real authenticated payments never derive ownership from it.
  const preview=activePreviewSession();
  if(preview)return preview.paymentSessionId;
  const key = 'taxpay-guest-simulation-session';
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const next = crypto.randomUUID();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    if (!fallbackSession) fallbackSession = crypto.randomUUID();
    return fallbackSession;
  }
}
/** Bind synthetic payer identity to the active server-issued demo profile,
 * never to a user-entered TIN or the selected beneficiary. The source SQL
 * independently verifies this ID against the private profile capability.
 */
/** The payment wizard stores receipt accounting heads in details.lines, but the
 * existing demo-payment SQL authorization trigger expects beneficiary allocations.
 * Preserve receipt items separately and send its exact, checked allocation contract.
 * Never manufacture an authorization for another taxpayer. */
export function bindPreviewStoryPayer(
  input: StoryPaymentInput,
  preview: {profileId:string;paymentSessionId:string}|null
): StoryPaymentInput {
  if(!preview)return input;
  if(input.sessionId!==preview.paymentSessionId)throw new Error('Demo account changed.');
  const details: Record<string,unknown>={...input.details,payerId:preview.profileId};
  if(!details.receiptSnapshot)return {...input,details};
  if(!Array.isArray(details.lines)||details.lines.length===0||
     !Number.isSafeInteger(input.amountMinor)||input.amountMinor<=0)
    throw new Error('Simulation payment details are incomplete.');
  const thirdParty=details.payerMode==='OTHER';
  const tin=typeof details.taxpayerTin==='string'?details.taxpayerTin.trim():'';
  const number=sampleUserNumberForTin(tin);
  // The server independently validates this exact TIN against the payer's
  // capability-scoped saved list. A saved beneficiary payment is not an
  // authorization to read the beneficiary's private tax records.
  // A saved TIN need not be one of the 30 illustrative accounts. Keep its
  // literal identity; SQL requires this exact TIN in the payer's owned list.
  // A true combined payment is submitted once. Keep each beneficiary, head,
  // assessment year and amount in one signed, independently checked payload.
  if (details.combinedPayment === true && input.service === 'OTHER_TAX_PAYMENT') {
    const allocations = details.allocations;
    const receiptLines = details.lines as Array<Record<string, unknown>>;
    if (!Array.isArray(allocations) || allocations.length < 1 || allocations.length > 20 ||
      receiptLines.length !== allocations.length ||
      !Array.isArray((details.receiptSnapshot as {items?:unknown}).items) ||
      (details.receiptSnapshot as {items:unknown[]}).items.length !== allocations.length)
      throw new Error('INVALID_COMBINED_ALLOCATION');
    let total = 0;
    const signedLines = allocations.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('INVALID_COMBINED_ALLOCATION');
      const alloc = raw as Record<string, unknown>;
      const allocationTin = alloc.taxpayerTin;
      const allocationAmount = alloc.amountMinor;
      const allocationYear = alloc.assessmentYear;
      const headId = alloc.headId;
      if (typeof allocationTin !== 'string' || !/^\\d{12,13}$/.test(allocationTin) ||
        typeof allocationYear !== 'string' || !allocationYear ||
        typeof headId !== 'number' || !Number.isSafeInteger(headId) ||
        typeof allocationAmount !== 'number' || !Number.isSafeInteger(allocationAmount) ||
        allocationAmount <= 0 || receiptLines[index].headId !== headId ||
        Math.round(Number(receiptLines[index].totalAmount) * 100) !== allocationAmount)
        throw new Error('INVALID_COMBINED_ALLOCATION');
      const userNumber = sampleUserNumberForTin(allocationTin);
      const beneficiary = thirdParty
        ? userIdForHostedTin(allocationTin) ||
          (userNumber ? `user${userNumber}` as DemoUserId : null) ||
          `SAVED_TIN:${allocationTin}`
        : preview.profileId;
      total += allocationAmount;
      return {beneficiary, taxpayerTin: allocationTin, category: input.service,
        assessmentYear: allocationYear, headId, amountMinor: allocationAmount};
    });
    if (!Number.isSafeInteger(total) || total !== input.amountMinor)
      throw new Error('COMBINED_TOTAL_MISMATCH');
    return {...input,details:{...details,receiptLines:details.lines,lines:signedLines}};
  }
  const selected=thirdParty
    ? userIdForHostedTin(tin)||(number?`user${number}` as DemoUserId:null)||
      (/^\d{12,13}$/.test(tin)?`SAVED_TIN:${tin}`:null)
    : preview.profileId;
  if(!selected)throw new Error('Choose a saved demo beneficiary for this simulation.');
  return {...input,details:{
    ...details,
    receiptLines:details.lines,
    lines:[{
      beneficiary:selected,
      category:input.service,
      assessmentYear:typeof details.assessmentYear==='string'?details.assessmentYear:'2026-27',
      amountMinor:input.amountMinor
    }]
  }};
}
export async function persistSimulatedPayment(input: StoryPaymentInput): Promise<StoryPaymentAcknowledgement> {
  const preview=activePreviewSession();
  const scoped=bindPreviewStoryPayer(input,preview);
  const response = await fetch(API + '/payments', {
    method: 'POST',
    headers: { ...storyApiHeaders(input.sessionId),'Content-Type': 'application/json' },
    body: JSON.stringify({ ...scoped, origin: import.meta.env?.VITE_SUPABASE_DISABLED === 'true' ? 'QA_BROWSER' : 'TAXPAY_UI' }),
  });
  const body = await response.json() as Partial<StoryPaymentAcknowledgement> & {
    error?: string; requestId?: string; retryable?: boolean;
  };
  let acknowledged: StoryPaymentAcknowledgement;
  if (response.ok && body.success === true && body.mirrored === true && body.id && body.status === 'SIMULATED_SUCCESS' && body.simulationOnly === true) {
    acknowledged = body as StoryPaymentAcknowledgement;
  } else if (response.status === 503 && body.error === 'OFFICE_SYNC_PENDING' && body.retryable === true &&
             typeof body.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(body.requestId)) {
    // Office mirror failure is NOT a payment-gateway decline. Before showing a
    // saved simulation, independently read back the exact idempotent source SQL
    // row using this session's existing capability/ownership boundary.
    const readback = await fetch(API + '/payments/' + encodeURIComponent(body.requestId) +
      '?sessionId=' + encodeURIComponent(input.sessionId), {
        headers: storyApiHeaders(input.sessionId), cache: 'no-store',
      });
    if (!readback.ok) throw new Error('SIMULATION_READBACK_PENDING');
    const stored = await readback.json() as {success?:boolean;simulationOnly?:boolean;
      data?:{id?:string;status?:string;data?:Partial<StoryPaymentInput>}};
    if (stored.success !== true || stored.simulationOnly !== true ||
        stored.data?.id !== body.requestId || stored.data.status !== 'SIMULATED_SUCCESS' ||
        stored.data.data?.idempotencyKey !== scoped.idempotencyKey ||
        stored.data.data?.sessionId !== scoped.sessionId ||
        stored.data.data?.amountMinor !== scoped.amountMinor ||
        stored.data.data?.service !== scoped.service)
      throw new Error('SIMULATION_READBACK_MISMATCH');
    acknowledged = {success:true,id:body.requestId,status:'SIMULATED_SUCCESS',
      mirrored:false,simulationOnly:true};
  } else {
    throw new Error(body.error || 'SIMULATION_SUBMISSION_PENDING');
  }
  try { sessionStorage.setItem('taxpay-guest-story-payment', 'true'); } catch { /* optional navigation hint only */ }
  // Persist the authenticated payer-to-payment link immediately after the SQL
  // acknowledgement. Do not delay a saved receipt or resubmit a payment when
  // the separate account-history index is temporarily unavailable; opening
  // History or Certificates performs the same idempotent claim again.
  // Client session presence is only an optimization: the SQL RPC independently
  // verifies auth.uid() and never trusts an arbitrary payer name or TIN.
  try {
    const {supabase}=await import('./supabaseClient');
    if(supabase) {
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.access_token) {
        await supabase.rpc('taxpay_claim_story1_session',{p_session_id:input.sessionId});
      }
    }
  } catch { /* Submitted SQL receipt remains authoritative; history can retry. */ }
  return acknowledged;
}

export type StoryPaymentNotice = {
  id: number;
  paymentId: string;
  type: string;
  createdAt: string;
};
export async function getStoryNotices(): Promise<StoryPaymentNotice[]> {
  const sessionId=getStorySessionId();
  const result = await fetch(API + '/notifications?sessionId=' + encodeURIComponent(sessionId),{headers:storyApiHeaders(sessionId),cache:'no-store'});
  if (!result.ok) throw new Error('Notification service unavailable');
  const payload = await result.json() as {success:boolean;data:StoryPaymentNotice[]};
  if (!payload.success || !Array.isArray(payload.data)) throw new Error('Notification service unavailable');
  return payload.data;
}

/** Session-scoped SQL records; not taxpayer identity or tax-ledger entitlement. */
export type StorySessionPayment={
 id:string;service:string;amountMinor:number;status:string;createdAt:string;
};
export async function getStorySessionPayments():Promise<StorySessionPayment[]>{
  const results:StorySessionPayment[]=[];
  const sessionId=getStorySessionId();
  const session=encodeURIComponent(sessionId);
  for(let page=1;page<=10000;page++){
    const response=await fetch(API+'/payments?sessionId='+session+'&page='+page+'&perPage=100',{headers:storyApiHeaders(sessionId),cache:'no-store'});
    if(!response.ok)throw new Error('Payment history unavailable');
    const payload=await response.json() as {success:boolean;data:{items:StorySessionPayment[];total:number}};
    const batch=payload.data;
    if(!payload.success||!batch||!Array.isArray(batch.items)||!Number.isSafeInteger(batch.total))
      throw new Error('Invalid payment history');
    results.push(...batch.items);
    if(results.length>=batch.total)return results;
    if(batch.items.length===0)throw new Error('Incomplete payment history');
  }
  throw new Error('Payment history exceeds supported page range');
}


/**
 * Recover an existing *simulated* receipt belonging to the current browser
 * session. This is not a public challan search and does not grant access to
 * records from another session or verify taxpayer ownership.
 *
 * The current API lists opaque payment IDs, not receipt references, so a
 * bounded scan fetches each session-owned detail and matches the mobile and
 * reference locally. A future A-Challan lookup needs its own authorized API.
 */
export async function findSessionReceiptByReference(reference: string, mobile: string): Promise<ChallanReceipt | null> {
  const wanted = reference.trim().toUpperCase();
  const receiptMobile = mobile.replace(/\D/g, '');
  if (!wanted || !/^01\d{9}$/.test(receiptMobile)) return null;

  const records = await getStorySessionPayments();
  // Never silently report NOT_FOUND when the bounded lookup cannot cover all records.
  if (records.length > 200) throw new Error('SESSION_LOOKUP_LIMIT');
  const sessionId = getStorySessionId();

  for (const record of records) {
    if (!/^[0-9a-f-]{36}$/i.test(record.id) || record.status !== 'SIMULATED_SUCCESS') continue;
    const response = await fetch(API + '/payments/' + encodeURIComponent(record.id) +
      '?sessionId=' + encodeURIComponent(sessionId), { headers:storyApiHeaders(sessionId),cache: 'no-store' });
    if (!response.ok) throw new Error('SESSION_LOOKUP_UNAVAILABLE');

    const payload = await response.json() as {
      success?: boolean;
      simulationOnly?: boolean;
      data?: { id?: string; status?: string; data?: {
        details?: { receiptSnapshot?: Partial<ChallanReceipt> };
      } };
    };
    if (payload.success !== true || payload.simulationOnly !== true) throw new Error('INVALID_SESSION_RECEIPT');
    if (payload.data?.id !== record.id || payload.data.status !== 'SIMULATED_SUCCESS') continue;
    const receipt = payload.data.data?.details?.receiptSnapshot;
    if (!receipt || receipt.isSimulatedDemo !== true ||
        typeof receipt.challanNo !== 'string' ||
        typeof receipt.tokenNumber !== 'string' ||
        typeof receipt.gatewayTransactionId !== 'string' ||
        !Array.isArray(receipt.items) ||
        typeof receipt.totalAmount !== 'number' ||
        receipt.receiptMobile !== receiptMobile) continue;
    const knownReferences = [receipt.challanNo, receipt.tokenNumber, receipt.gatewayTransactionId,
      receipt.paymentTransactionId, record.id];
    if (!knownReferences.some(value => typeof value === 'string' && value.toUpperCase() === wanted)) continue;
    return { ...receipt, paymentTransactionId: record.id } as ChallanReceipt;
  }
  return null;
}
