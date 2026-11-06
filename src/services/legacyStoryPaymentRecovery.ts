import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {activePreviewSession} from './previewAccountSession';

const LEGACY_SESSION_KEY='taxpay-guest-simulation-session';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A pre-existing browser-only payment session can be linked only by explicit
 * user action. Never infer that old payments belong to a demo profile by TIN. */
export function recoverableLegacyStorySession():string|null {
  if(typeof window==='undefined')return null;
  try {
    const previous=window.sessionStorage.getItem(LEGACY_SESSION_KEY);
    const current=activePreviewSession();
    return previous&&uuid.test(previous)&&previous!==current?.paymentSessionId?previous:null;
  }catch{return null;}
}

export async function recoverLegacyStoryPayments():Promise<number>{
  const profile=activePreviewSession();
  const legacySessionId=recoverableLegacyStorySession();
  if(!profile||!legacySessionId)throw new Error('Earlier browser payment records are not available for recovery.');
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!url||!publishableKey)throw new Error('Payment recovery service is unavailable.');
  const response=await fetch(url.replace(/\/$/,'')+'/functions/v1/taxpay-guest-beneficiaries',{
    method:'POST',cache:'no-store',
    headers:{apikey:publishableKey,'content-type':'application/json',
      'x-taxpay-guest-capability':profile.capability},
    body:JSON.stringify({action:'demo-recover-payments',legacySessionId})
  });
  const body=await response.json().catch(()=>null) as {success?:boolean;code?:string;data?:{recovered?:number}}|null;
  if(response.status===400&&body?.code==='LEGACY_SESSION_EMPTY')
    throw new Error('No earlier payment records were found in this browser session.');
  if(response.status===409&&body?.code==='LEGACY_SESSION_ALREADY_LINKED')
    throw new Error('These earlier records are already assigned to another profile.');
  if(!response.ok||body?.success!==true||typeof body.data?.recovered!=='number'||!Number.isSafeInteger(body.data.recovered)||body.data.recovered<0)
    throw new Error('Unable to confirm restored payment records. Your original history was not changed.');
  if(activePreviewSession()?.capability!==profile.capability)
    throw new Error('Account changed during recovery. Please sign in again.');
  try { window.sessionStorage.removeItem(LEGACY_SESSION_KEY); }
  catch { /* server-side alias remains authoritative */ }
  return body.data.recovered;
}
