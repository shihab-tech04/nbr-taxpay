import { supabase } from './supabaseClient';
import {retryStory1OwnershipClaim,type ClaimActor,type ClaimAttempt} from './story1OwnershipClaim';
import { getStorySessionId, getStorySessionPayments, storyApiHeaders } from './simulatedPaymentStory';
import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
import { makeConfirmedReceipt, validCertificateTransactionId } from './confirmedPaymentCertificate';
import type { ChallanReceipt } from '../types/tax';

const STORY_API = TAXPAY_PUBLIC_ENDPOINT.url.replace(/\/$/,'') + '/functions/v1/demo-story1-taxpay';

// Use the captured bearer, not a mutable client token, for the two existing
// owner-scoped RPCs. SQL remains the final authorization boundary.
async function invokeStory1OwnershipClaim(name:'taxpay_claim_story1_session'|'taxpay_claim_walkin_payer_payments',
  args:Record<string,unknown>,actor:ClaimActor):Promise<ClaimAttempt>{
  const response=await fetch(TAXPAY_PUBLIC_ENDPOINT.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
    method:'POST',cache:'no-store',headers:{
      apikey:TAXPAY_PUBLIC_ENDPOINT.publishableKey,
      Authorization:'Bearer '+actor.accessToken,
      'Content-Type':'application/json'
    },body:JSON.stringify(args)
  });
  if(!response.ok)return response.status===408||response.status===425||response.status===429||response.status>=500?'retryable':'denied';
  const count:unknown=await response.json();
  // Zero is a successful RPC, not proof that a new owner link was created.
  // The subsequent authenticated list remains the only ownership readback.
  return typeof count==='number'&&Number.isSafeInteger(count)&&count>=0?'acknowledged':'denied';
}

/**
 * Paid-record read model: one immutable transaction per selected payment head.
 * Beneficiary rows always use the reconciled amount from the same SQL record,
 * never the full batch total or an inferred tax credit.
 */
export type OwnedStoryPayment = {
  id: string;
  service: string;
  amountMinor: number;
  status: string;
  createdAt: string;
  details: Record<string, unknown>;
};
export type BeneficiaryPaymentEntry = {
  key: string;
  paymentId: string;
  beneficiaryName: string;
  taxpayerTin: string;
  assessmentYear: string;
  paymentHead: string;
  economicCode?: string;
  amountMinor: number;
  batchId?: string;
  batchItemIndex?: number;
  batchItemCount?: number;
  receipt: ChallanReceipt;
};

const isRecord = (value: unknown): value is Record<string,unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function verifiedPayment(raw: unknown): OwnedStoryPayment {
  if (!isRecord(raw) || !validCertificateTransactionId(raw.id) ||
      typeof raw.service !== 'string' || raw.status !== 'SIMULATED_SUCCESS' ||
      typeof raw.amountMinor !== 'number' || !Number.isSafeInteger(raw.amountMinor) ||
      raw.amountMinor <= 0 || typeof raw.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(raw.createdAt)) || !isRecord(raw.details)) {
    throw new Error('Invalid stored beneficiary payment record');
  }
  return raw as OwnedStoryPayment;
}

/** Session-bound historical readback, including records submitted before sign-in. */
export async function getDetailedStorySessionPayments(): Promise<OwnedStoryPayment[]> {
  const records = await getStorySessionPayments();
  const result: OwnedStoryPayment[] = [];
  // A bounded worker pool prevents one payment per head from overwhelming Edge.
  let next = 0;
  const session = encodeURIComponent(getStorySessionId());
  await Promise.all(Array.from({ length: Math.min(5, records.length) }, async () => {
    while (next < records.length) {
      const record = records[next++];
      if (!validCertificateTransactionId(record.id)) throw new Error('Invalid session payment identity');
      const response = await fetch(STORY_API + '/payments/' +
        encodeURIComponent(record.id) + '?sessionId=' + session, { headers:storyApiHeaders(getStorySessionId()),cache: 'no-store' });
      if (!response.ok) throw new Error('Session payment history unavailable');
      const envelope = await response.json() as { success?: boolean; simulationOnly?: boolean;
        data?: { id?: string; status?: string; data?: unknown; createdAt?: string } };
      const original = envelope.data?.data;
      if (envelope.success !== true || envelope.simulationOnly !== true ||
          envelope.data?.id !== record.id || !isRecord(original) ||
          original.service !== record.service || original.amountMinor !== record.amountMinor ||
          envelope.data?.status !== record.status || !isRecord(original.details)) {
        throw new Error('Session payment details did not match SQL history');
      }
      result.push(verifiedPayment({ ...record, details: original.details }));
    }
  }));
  return result.sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
}

/** An authenticated owner can claim only an existing unclaimed secret session.
 * Owner lookup never uses a taxpayer TIN, payer name or browser-supplied user ID
 * as proof of identity. The SQL functions perform the final auth.uid() checks.
 */
export async function getAccountStoryPayments(ownerUid: string, options: { claimPending?: boolean } = {}): Promise<OwnedStoryPayment[]> {
  if (!supabase || !ownerUid) throw new Error('Authenticated payment history is unavailable');
  const { data: before, error: identityError } = await supabase.auth.getUser();
  if (identityError || before.user?.id !== ownerUid) throw new Error('Account identity changed');
  // Personalized shortcuts are a read-only affordance, not a claim action.
  if (options.claimPending !== false) {
    // A mounted Activity/Certificate read automatically retries a transient
    // ownership failure after the source acknowledgement event. Only retry the
    // idempotent link RPC; the payment submission itself is never repeated.
    const client=supabase;
    const currentActor=async():Promise<ClaimActor|null>=>{
      const {data,error}=await client.auth.getSession();
      const session=data.session;
      if(error||!session?.access_token||session.user.id!==ownerUid)return null;
      return {userId:session.user.id,accessToken:session.access_token};
    };
    const actor=await currentActor();
    if(!actor)throw Error('Account identity changed');
    const sessionId=getStorySessionId();
    const signedClaim=(name:'taxpay_claim_story1_session'|'taxpay_claim_walkin_payer_payments',args:Record<string,unknown>)=>
      (captured:ClaimActor):Promise<ClaimAttempt>=>invokeStory1OwnershipClaim(name,args,captured);
    const claimResult=await retryStory1OwnershipClaim(actor,currentActor,
      signedClaim('taxpay_claim_story1_session',{p_session_id:sessionId}));
    if(claimResult!=='acknowledged')throw Error('Unable to synchronize saved payment history');
    // Guest Other Tax records may declare a payer TIN, but only this authenticated
    // RPC can link them through the existing approver-verified account binding.
    // Never pass the entered payer TIN or a browser-selected account identity.
    const payerClaimResult=await retryStory1OwnershipClaim(actor,currentActor,
      signedClaim('taxpay_claim_walkin_payer_payments',{}));
    if(payerClaimResult!=='acknowledged')throw Error('Unable to verify walk-in payer history');
  }
  const all: OwnedStoryPayment[] = [];
  const seen = new Set<string>();
  for (let page=1; page<=2000; page++) {
    const { data, error } = await supabase.rpc('taxpay_my_story1_payments', {
      p_page:page, p_per_page:100
    });
    if (error || !isRecord(data) || !Array.isArray(data.items) ||
        typeof data.total !== 'number' || !Number.isSafeInteger(data.total) ||
        data.total < 0 || data.items.length > 100 || data.page !== page) {
      throw new Error('Unable to verify account-owned payment history');
    }
    for (const raw of data.items) {
      const payment=verifiedPayment(raw);
      if (seen.has(payment.id)) throw new Error('Payment history changed during pagination');
      seen.add(payment.id);
      all.push(payment);
    }
    if (seen.size >= data.total) break;
    if (!data.items.length) throw new Error('Incomplete payment history');
    if (page === 2000) throw new Error('Account payment history exceeds safe retrieval limit');
  }
  const { data: after, error: recheck } = await supabase.auth.getUser();
  if (recheck || after.user?.id !== ownerUid) throw new Error('Account identity changed');
  return all;
}

/** Preserve the tax-head and AY of every beneficiary even in a mixed-year batch. */
export function beneficiaryPaymentEntries(payments: OwnedStoryPayment[]): BeneficiaryPaymentEntry[] {
  return payments.flatMap(payment => {
    const receipt = makeConfirmedReceipt(payment);
    if (receipt.allocationItems?.length) return receipt.allocationItems.map((allocation,index) => ({
      key: payment.id+':'+index,
      paymentId: payment.id,
      beneficiaryName: allocation.taxpayerName,
      taxpayerTin: allocation.taxpayerTin || '',
      assessmentYear: allocation.assessmentYear,
      paymentHead: allocation.paymentServiceEn,
      economicCode: allocation.economicCode,
      amountMinor: allocation.amountMinor,
      batchId: receipt.batchId,
      batchItemIndex: receipt.batchItemIndex,
      batchItemCount: receipt.batchItemCount,
      receipt
    }));
    const details=payment.details;
    return [{
      key:payment.id,
      paymentId:payment.id,
      beneficiaryName:typeof details.taxpayerName==='string'&&details.taxpayerName.trim()
        ?details.taxpayerName:'—',
      taxpayerTin:receipt.taxpayerTin || '',
      assessmentYear:receipt.assessmentYear,
      paymentHead:receipt.items.map(item=>item.headNameEn).filter(Boolean).join(', ') || payment.service.replaceAll('_',' '),
      economicCode:receipt.items[0]?.economicCode || undefined,
      amountMinor:payment.amountMinor,
      batchId:receipt.batchId,
      batchItemIndex:receipt.batchItemIndex,
      batchItemCount:receipt.batchItemCount,
      receipt
    }];
  });
}
