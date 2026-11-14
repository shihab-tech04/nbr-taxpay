import type { ChallanReceipt } from '../types/tax';
import { MAX_COMBINED_ALLOCATIONS } from './otherTaxCombinedPayment';
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
  // Combined payments use the established Office-compatible contract:
  // details.lines = accounting heads, details.allocations = taxpayer shares.
  // Do not synthesize beneficiary IDs into lines: Office 360 and Analytics
  // explicitly reject records with BOTH beneficiary and explicit allocations.
  // The private SQL trigger independently verifies every saved TIN for this
  // payer's capability-scoped session before accepting the single payment.
  if (details.combinedPayment === true && input.service === 'OTHER_TAX_PAYMENT') {
    const allocations=details.allocations;
    const accounting=details.lines as Array<Record<string,unknown>>;
    const snapshot=details.receiptSnapshot as {items?:unknown}|undefined;
    if (!Array.isArray(allocations) || allocations.length < 1 || allocations.length > MAX_COMBINED_ALLOCATIONS ||
      accounting.length !== allocations.length ||
      !snapshot || !Array.isArray(snapshot.items) ||
      snapshot.items.length !== allocations.length)
      throw new Error('INVALID_COMBINED_ALLOCATION');
    let total=0;
    for (let index=0;index<allocations.length;index++) {
      const a=allocations[index] as Record<string,unknown>;
      if (!a || typeof a!=='object' || Array.isArray(a) ||
        typeof a.taxpayerTin!=='string' || !/^\d{12,13}$/.test(a.taxpayerTin) ||
        typeof a.assessmentYear!=='string' || !a.assessmentYear ||
        typeof a.headId!=='number' || !Number.isSafeInteger(a.headId) || a.headId<=0 ||
        typeof a.amountMinor!=='number' || !Number.isSafeInteger(a.amountMinor) || a.amountMinor<=0 ||
        accounting[index].headId!==a.headId ||
        Math.round(Number(accounting[index].totalAmount)*100)!==a.amountMinor)
        throw new Error('INVALID_COMBINED_ALLOCATION');
      total+=a.amountMinor;
    }
    if (!Number.isSafeInteger(total) || total!==input.amountMinor)
      throw new Error('COMBINED_TOTAL_MISMATCH');
    return {...input,details};
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


/** F-129 / US-050: recover an immutable, original Taxpayer SQL simulation
 * only through an already issued, unexpired profile possession capability.
 * The B-owned Edge route verifies the capability, existing owner/session link,
 * source provenance and exact reference. This path does NOT grant public
 * reference+phone access and does not create an issuer-backed challan.
 *
 * If the new Edge route has not yet been deployed, return checked:false and
 * let the existing same-session/mobile path continue unchanged.
 */
export async function findProfileReceiptByReference(
 reference:string, mobile:string
):Promise<{checked:boolean;receipt:ChallanReceipt|null}> {
  const profile=activePreviewSession();
  if(!profile)return {checked:false,receipt:null};
  const wanted=reference.trim().toUpperCase();
  const cleanMobile=mobile.replace(/\D/g,'');
  if(!wanted||wanted.length>200)return {checked:true,receipt:null};
  if(cleanMobile && !/^01\d{9}$/.test(cleanMobile))
    return {checked:true,receipt:null};
  const params=new URLSearchParams({reference:wanted});
  if(cleanMobile)params.set('receiptMobile',cleanMobile);
  const response=await fetch(API+'/payments/reference?'+params.toString(),{
    headers:storyApiHeaders(profile.paymentSessionId),cache:'no-store'
  });
  const body=await response.json().catch(()=>null) as {
    success?:boolean;simulationOnly?:boolean;error?:string;data?:unknown
  }|null;
  if(response.status===404){
    // Older Edge versions have no /payments/reference route. Do not turn a
    // generic 404 into a verified negative or disable legacy recovery.
    if(body?.error!=='NOT_FOUND')return {checked:false,receipt:null};
    if(activePreviewSession()?.capability!==profile.capability)
      throw new Error('Preview profile changed during receipt lookup');
    return {checked:true,receipt:null};
  }
  if(!response.ok||body?.success!==true||body.simulationOnly!==true)
    throw new Error('Authorized receipt lookup is unavailable');
  const row=body.data;
  if(!row||typeof row!=='object'||Array.isArray(row))
    throw new Error('Invalid original receipt response');
  const source=row as Record<string,unknown>;
  const details=source.details;
  if(typeof source.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.id)||
    source.status!=='SIMULATED_SUCCESS'||typeof source.service!=='string'||
    !Number.isSafeInteger(source.amountMinor)||Number(source.amountMinor)<=0||
    !details||typeof details!=='object'||Array.isArray(details))
    throw new Error('Invalid original receipt response');
  const stored=details as Record<string,unknown>;
  // The source must name the exact active preview payer. A matching receipt
  // reference or mobile alone is not an ownership assertion.
  if(stored.payerId!==profile.profileId)
    throw new Error('Original receipt ownership mismatch');
  const raw=stored.receiptSnapshot;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new Error('Original source has no saved receipt document');
  const snapshot=raw as Record<string,unknown>;
  if(snapshot.isSimulatedDemo!==true||
    typeof snapshot.challanNo!=='string'||typeof snapshot.tokenNumber!=='string'||
    typeof snapshot.gatewayTransactionId!=='string'||
    typeof snapshot.totalAmount!=='number'||!Number.isFinite(snapshot.totalAmount)||
    !Array.isArray(snapshot.items)||snapshot.items.length<1||
    Math.round(snapshot.totalAmount*100)!==source.amountMinor||
    snapshot.paymentCategory!==source.service)
    throw new Error('Original receipt and payment mismatch');
  if(cleanMobile && snapshot.receiptMobile!==cleanMobile)
    throw new Error('Original receipt mobile mismatch');
  const references=[source.id,'SK-PC-'+source.id,stored.receiptReference,
    stored.tokenNumber,stored.gatewayTransactionId,snapshot.challanNo,
    snapshot.tokenNumber,snapshot.gatewayTransactionId,snapshot.paymentTransactionId];
  if(!references.some(value=>typeof value==='string'&&value.trim().toUpperCase()===wanted))
    throw new Error('Original receipt reference mismatch');
  const latest=activePreviewSession();
  if(!latest||latest.capability!==profile.capability||
    latest.profileId!==profile.profileId||
    latest.paymentSessionId!==profile.paymentSessionId)
    throw new Error('Preview profile changed during receipt lookup');
  return {checked:true,receipt:{
    ...(snapshot as unknown as ChallanReceipt),
    paymentTransactionId:source.id
  }};
}
