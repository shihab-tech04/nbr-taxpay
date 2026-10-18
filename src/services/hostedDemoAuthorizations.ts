import { DEMO_USERS, type DemoUserId } from '../data/demoUsers';

/** Shared SQL demo consent. Fictional account names are NOT authenticated taxpayer identities. */
export type HostedAuthorizationStatus = 'PENDING' | 'CODE_ISSUED' | 'ACTIVE' | 'DENIED' | 'REVOKED' | 'EXPIRED' | 'CANCELLED';
export type HostedAuthorization = {
  id: string; payerId: DemoUserId; taxpayerId: DemoUserId;
  status: HostedAuthorizationStatus;
  requestedAt: number; codeExpiresAt: number;
  consentCode: string | null; confirmedAt: number | null;
  activeUntil: number | null; attempts: number; revokedAt: number | null;
  codeSentAt?: number | null; codeResends?: number;
};

const API = 'https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay';
type ResponseEnvelope<T>={success?:boolean;data?:T;error?:string;requestId?:string;mirrored?:boolean};
export class AuthorizationSyncError extends Error {
  constructor(public readonly requestId: string) {
    super('TaxPay saved this request, but Office synchronization is pending. Please retry sync.');
  }
}
async function unwrap<T>(response:Response):Promise<T>{
  let payload:ResponseEnvelope<T>;
  try {payload=await response.json() as ResponseEnvelope<T>;}
  catch {throw Error('Authorization service is unavailable.');}
  if(payload.success&&payload.data!==undefined)return payload.data;
  if(payload.error==='OFFICE_SYNC_PENDING'&&payload.requestId)throw new AuthorizationSyncError(payload.requestId);
  throw Error((payload.error??'AUTHORIZATION_UNAVAILABLE').replaceAll('_',' '));
}
export const getHostedAuthorizations=async(actor:DemoUserId):Promise<HostedAuthorization[]>=>{
  const response=await fetch(`${API}/authorizations?actor=${encodeURIComponent(actor)}`,{cache:'no-store'});
  const data=await unwrap<HostedAuthorization[]>(response);
  if(!Array.isArray(data))throw Error('Invalid authorization response');
  return data;
};
export type AuthorizationAction='request'|'accept'|'confirm'|'decline'|'revoke'|'resend'|'delete';
export async function performHostedAuthorization(actor:DemoUserId,action:AuthorizationAction,
  options:{id?:string;tin?:string;code?:string}={}):Promise<{id:string;status:HostedAuthorizationStatus;consentCode?:string|null;attempts:number}> {
  const response=await fetch(API+'/authorizations',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({actor,action,...options}),
  });
  return unwrap(response);
}
export async function retryHostedAuthorizationSync(requestId:string):Promise<void>{
  const response=await fetch(API+'/authorizations/sync',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId}),
  });
  await unwrap(response);
}
export function userIdForHostedTin(tin:string):DemoUserId|null{
  const pair=Object.entries(DEMO_USERS).find(([,person])=>person.tin===tin.trim());
  return pair?pair[0] as DemoUserId:null;
}
export function activeAuthorizationFor(
  records:HostedAuthorization[],payer:DemoUserId,beneficiary:DemoUserId
):HostedAuthorization|undefined{
  return records.find(r=>r.payerId===payer&&r.taxpayerId===beneficiary&&r.status==='ACTIVE');
}
