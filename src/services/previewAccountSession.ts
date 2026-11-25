import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import type {DemoUserId} from '../data/demoUsers';

/** Public fictional user1-user55 profile, never Supabase Auth or tax ownership.
 * A server-issued random capability selects the same synthetic data on each browser.
 */
export const PREVIEW_USER_KEY='taxpay-taxpayer-preview-user';
export const GIFT_PENDING_SESSION_KEY='taxpay.gift-tax.pending.v1';
const PREVIEW_SESSION_KEY='korbritto.demo-profile-session.v1';
const PENDING_LANGUAGE_KEY='korbritto.demo-pending-language.v1';
const capabilityPattern=/^[A-Za-z0-9_-]{43}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const demoIdPattern=/^user(?:[1-9]|[1-4][0-9]|5[0-5])$/;
export type DemoSettings={language:'en'|'bn';selectedListId:string|null;paymentSessionId:string};
export type PreviewSession=DemoSettings&{profileId:DemoUserId;capability:string};
const outstanding=new Map<string,Map<'language'|'selected-list',string>>();
const pending=new Map<string,Promise<void>>();
// Monotonic local generation prevents older sign-ins from reactivating after a
// newer login or explicit sign-out, even when network responses arrive late.
let sessionGeneration=0;

function valid(raw:unknown):PreviewSession|null {
  if(!raw||typeof raw!=='object')return null;
  const value=raw as Record<string,unknown>;
  if(typeof value.profileId!=='string'||!demoIdPattern.test(value.profileId)||
    typeof value.capability!=='string'||!capabilityPattern.test(value.capability)||
    typeof value.paymentSessionId!=='string'||!uuidPattern.test(value.paymentSessionId)||
    (value.language!=='en'&&value.language!=='bn')||
    (value.selectedListId!==null&&typeof value.selectedListId!=='string'))return null;
  return raw as PreviewSession;
}
export function activePreviewSession():PreviewSession|null {
  try {
    const id=window.sessionStorage.getItem(PREVIEW_USER_KEY);
    const value=valid(JSON.parse(window.sessionStorage.getItem(PREVIEW_SESSION_KEY)??'null'));
    return id&&value?.profileId===id?value:null;
  }catch{return null;}
}
// A same-tab refresh can interrupt the preference write before SQL confirms it.
// Retain the user's explicit language choice until acknowledgement; a new login
// or sign-out clears this session-local value. It grants no account access.
export function pendingPreviewLanguage():DemoSettings['language']|null {
  if(!activePreviewSession())return null;
  try {
    const value=window.sessionStorage.getItem(PENDING_LANGUAGE_KEY);
    return value==='en'||value==='bn'?value:null;
  }catch{return null;}
}
/** Reject async results whenever the server-issued session has changed, even for the same profile ID. */
function samePreviewSession(session:PreviewSession):boolean {
  const active=activePreviewSession();
  return active?.profileId===session.profileId && active.capability===session.capability &&
    active.paymentSessionId===session.paymentSessionId;
}
function remember(session:PreviewSession):void {
  window.sessionStorage.setItem(PREVIEW_SESSION_KEY,JSON.stringify(session));
  window.sessionStorage.setItem(PREVIEW_USER_KEY,session.profileId);
}
export function clearPreviewSession():void {
  sessionGeneration++;
  // Discard stale queued writes: a later sign-in with the same profile ID
  // must never replay settings from a previously issued capability.
  outstanding.clear();
  pending.clear();
  try{
    window.sessionStorage.removeItem(PREVIEW_USER_KEY);
    window.sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    window.sessionStorage.removeItem(PENDING_LANGUAGE_KEY);
    window.sessionStorage.removeItem(GIFT_PENDING_SESSION_KEY);
  }catch{/* private browsing can prevent storage writes */}
}
async function send<T>(action:string,fields:Record<string,unknown>,capability?:string):Promise<T>{
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!url||!publishableKey)throw new Error('Saved preview profiles are unavailable.');
  const result=await fetch(url.replace(/\/$/,'')+'/functions/v1/taxpay-guest-beneficiaries',{
    method:'POST',cache:'no-store',headers:{
      apikey:publishableKey,'content-type':'application/json',
      ...(capability?{'x-taxpay-guest-capability':capability}:{})
    },body:JSON.stringify({action,...fields})
  });
  const body=await result.json().catch(()=>null) as {success?:boolean;data?:T;code?:string}|null;
  if(!result.ok||body?.success!==true)throw new Error(body?.code==='INVALID_DEMO_LOGIN'
    ?'Incorrect User ID or password.':'Unable to save or load your demo profile. Please retry.');
  return body.data as T;
}
export async function signInPreviewProfile(id:string,password:string):Promise<PreviewSession|null>{
  if(!demoIdPattern.test(id)||password!==id)return null;
  const attempt=++sessionGeneration;
  const raw=await send<PreviewSession>('demo-login',{userId:id,password});
  if(attempt!==sessionGeneration)throw new Error('Demo account changed.');
  const session=valid(raw);
  if(!session||session.profileId!==id)throw new Error('Demo account response could not be verified.');
  clearPreviewSession();
  remember(session);
  return session;
}
export async function getPreviewSettings():Promise<DemoSettings>{
  const session=activePreviewSession();
  if(!session)throw new Error('Sign in to your demo profile again.');
  const data=await send<DemoSettings>('demo-settings',{},session.capability);
  if((data.language!=='en'&&data.language!=='bn')||!uuidPattern.test(data.paymentSessionId)||
    data.paymentSessionId!==session.paymentSessionId)
    throw new Error('The saved demo settings could not be verified.');
  if(!samePreviewSession(session))throw new Error('Demo account changed.');
  remember({...session,language:data.language,selectedListId:data.selectedListId??null});
  return data;
}
export function savePreviewSetting(key:'language'|'selected-list',value:string):Promise<void>{
  const session=activePreviewSession();
  if(!session)return Promise.reject(new Error('Sign in to your demo profile again.'));
  if(key==='language'&&value!=='bn'&&value!=='en')return Promise.reject(new Error('Invalid language'));
  if(key==='selected-list'&&value&&!uuidPattern.test(value))return Promise.reject(new Error('Invalid saved list'));
  if(key==='language'){
    try{window.sessionStorage.setItem(PENDING_LANGUAGE_KEY,value);}
    catch{/* Keep the existing server preference write available. */}
  }
  const profile=session.profileId;
  const values=outstanding.get(profile)??new Map<'language'|'selected-list',string>();
  values.set(key,value);
  outstanding.set(profile,values);
  const prior=pending.get(profile)??Promise.resolve();
  const next=prior.catch(()=>undefined).then(async()=>{
    if(!samePreviewSession(session))throw new Error('Demo account changed.');
    const saved=await send<DemoSettings>('demo-settings',{key,value},session.capability);
    if(key==='language'&&saved.language!==value ||
      key==='selected-list'&&(saved.selectedListId??'')!==value)
      throw new Error('The account setting was not confirmed.');
    if(!samePreviewSession(session))throw new Error('Demo account changed.');
    const current=activePreviewSession()!;
    remember({...current,language:saved.language,selectedListId:saved.selectedListId??null});
    if(values.get(key)===value){
      if(key==='language'&&pendingPreviewLanguage()===value)
        window.sessionStorage.removeItem(PENDING_LANGUAGE_KEY);
      values.delete(key);
      if(!values.size)outstanding.delete(profile);
    }
  });
  pending.set(profile,next);
  void next.finally(()=>{if(pending.get(profile)===next)pending.delete(profile);}).catch(()=>undefined);
  return next;
}
export async function flushPreviewSettings():Promise<void>{
  const session=activePreviewSession();
  if(!session)return;
  await pending.get(session.profileId)?.catch(()=>undefined);
  if(!samePreviewSession(session))throw new Error('Demo account changed.');
  const values=outstanding.get(session.profileId);
  if(!values?.size)return;
  for(const [key,value] of [...values]){
    if(!samePreviewSession(session))throw new Error('Demo account changed.');
    if(values.get(key)===value)await savePreviewSetting(key,value);
  }
  if(outstanding.get(session.profileId)?.size)throw new Error('Could not confirm saved settings.');
}
