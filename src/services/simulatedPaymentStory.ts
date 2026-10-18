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
  mirrored: true;
  simulationOnly: true;
};
const API = 'https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay';
let fallbackSession: string | undefined;
export function getStorySessionId(): string {
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
export async function persistSimulatedPayment(input: StoryPaymentInput): Promise<StoryPaymentAcknowledgement> {
  const response = await fetch(API + '/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, origin: import.meta.env?.VITE_SUPABASE_DISABLED === 'true' ? 'QA_BROWSER' : 'TAXPAY_UI' }),
  });
  const body = await response.json() as Partial<StoryPaymentAcknowledgement> & { error?: string };
  if (!response.ok || body.success !== true || body.mirrored !== true || !body.id)
    throw new Error(body.error || 'OFFICE_SYNC_PENDING');
  try { sessionStorage.setItem('taxpay-guest-story-payment', 'true'); } catch { /* optional navigation hint only */ }
  return body as StoryPaymentAcknowledgement;
}

export type StoryPaymentNotice = {
  id: number;
  paymentId: string;
  type: string;
  createdAt: string;
};
export async function getStoryNotices(): Promise<StoryPaymentNotice[]> {
  const result = await fetch(API + '/notifications?sessionId=' + encodeURIComponent(getStorySessionId()));
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
  const session=encodeURIComponent(getStorySessionId());
  for(let page=1;page<=10000;page++){
    const response=await fetch(API+'/payments?sessionId='+session+'&page='+page+'&perPage=100',{cache:'no-store'});
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
