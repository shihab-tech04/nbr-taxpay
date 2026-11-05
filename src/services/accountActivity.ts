import {supabase} from './supabaseClient';

/** Nonfinancial account actions only. Never record TIN, amounts, names, form
 * answers, credentials, payment success or unconfirmed Treasury status here. */
export type AccountActivityType =
  | 'PAGE_OPENED' | 'LANGUAGE_CHANGED' | 'BENEFICIARY_LIST_SELECTED'
  | 'PAYMENT_STARTED' | 'PROFILE_SAVED';
export type AccountActivityItem = {
  id:string;owner_uid:string;event_type:AccountActivityType;
  route:string|null;occurred_at:string;
};

const allowedTypes:ReadonlySet<string>=new Set([
  'PAGE_OPENED','LANGUAGE_CHANGED','BENEFICIARY_LIST_SELECTED',
  'PAYMENT_STARTED','PROFILE_SAVED'
]);
const safeRoute=/^[a-z_]{1,64}$/;
const outstanding=new Map<string,Promise<void>>();
const unsaved=new Map<string,Array<{eventType:AccountActivityType;route:string|null}>>();
const recent=new Map<string,{event:string;at:number}>();

export function accountActivityIsSafe(type:string,route:string|null):boolean {
  return allowedTypes.has(type) && (route===null || safeRoute.test(route));
}
async function persistActivity(uid:string,eventType:AccountActivityType,route:string|null):Promise<void>{
  const db=supabase;
  if(!db)throw new Error('Account activity storage unavailable.');
  const {data:identity,error:authError}=await db.auth.getUser();
  if(authError||identity.user?.id!==uid)throw new Error('Account session changed.');
  const {error}=await db.from('taxpay_account_activity')
    .insert({owner_uid:uid,event_type:eventType,route});
  if(error)throw error;
}
/** Owner-serialized writes. Failed events remain retryable during the session.
 * Never claim a financial event from a click or a public sample login. */
export function recordAccountActivity(
  uid:string|null|undefined,eventType:AccountActivityType,route:string|null=null
):Promise<void> {
  if(!uid||!accountActivityIsSafe(eventType,route))return Promise.resolve();
  const key=eventType+':'+(route??'');
  const previous=recent.get(uid);
  if(previous?.event===key&&Date.now()-previous.at<900)return outstanding.get(uid)??Promise.resolve();
  recent.set(uid,{event:key,at:Date.now()});
  const queue=unsaved.get(uid)??[];
  queue.push({eventType,route});
  unsaved.set(uid,queue);
  const prior=outstanding.get(uid)??Promise.resolve();
  const next=prior.catch(()=>undefined).then(async()=>{
    for(const entry of [...(unsaved.get(uid)??[])]){
      await persistActivity(uid,entry.eventType,entry.route);
      const pending=unsaved.get(uid);
      if(pending?.[0]===entry){
        pending.shift();
        if(pending.length===0)unsaved.delete(uid);
      }
    }
  });
  outstanding.set(uid,next);
  void next.finally(()=>{if(outstanding.get(uid)===next)outstanding.delete(uid);}).catch(()=>undefined);
  return next;
}
export async function flushAccountActivities(uid:string):Promise<void>{
  await outstanding.get(uid)?.catch(()=>undefined);
  const queue=unsaved.get(uid);
  if(!queue?.length)return;
  for(const entry of [...queue]){
    await persistActivity(uid,entry.eventType,entry.route);
    if(queue[0]===entry)queue.shift();
  }
  if(queue.length===0)unsaved.delete(uid);
}
export async function loadAccountActivities(uid:string):Promise<AccountActivityItem[]>{
  const db=supabase;
  if(!db)throw new Error('Account activity storage unavailable.');
  const {data:identity,error:authError}=await db.auth.getUser();
  if(authError||identity.user?.id!==uid)throw new Error('Account session changed.');
  const {data,error}=await db.from('taxpay_account_activity')
    .select('id,owner_uid,event_type,route,occurred_at')
    .eq('owner_uid',uid).order('occurred_at',{ascending:false}).limit(60);
  if(error)throw error;
  const rows=(data??[]) as AccountActivityItem[];
  if(rows.some(row=>row.owner_uid!==uid || !accountActivityIsSafe(row.event_type,row.route) ||
       !Number.isFinite(Date.parse(row.occurred_at))))throw new Error('Unexpected activity record.');
  return rows;
}
