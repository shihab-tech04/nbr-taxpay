import {supabase} from './supabaseClient';

/** Nonfinancial account actions only. Never record taxpayer IDs, amounts,
 * names, credentials, payment results, Treasury status, or tax liability. */
export type AccountActivityType =
  | 'PAGE_OPENED'
  | 'LANGUAGE_CHANGED'
  | 'BENEFICIARY_LIST_SELECTED'
  | 'PAYMENT_STARTED'
  | 'PROFILE_SAVED';

export type AccountActivityItem = {
  id:string;
  owner_uid:string;
  event_type:AccountActivityType;
  route:string|null;
  occurred_at:string;
};

const allowedTypes:ReadonlySet<string>=new Set([
  'PAGE_OPENED','LANGUAGE_CHANGED','BENEFICIARY_LIST_SELECTED',
  'PAYMENT_STARTED','PROFILE_SAVED'
]);
const safeRoute=/^[a-z_]{1,64}$/;
const recentEvents=new Map<string,number>();

export function accountActivityIsSafe(type:string,route:string|null):boolean {
  return allowedTypes.has(type) && (route===null || safeRoute.test(route));
}

async function currentOwner(ownerUid:string):Promise<void>{
  const db=supabase;
  if(!db)throw new Error('Account activity storage unavailable.');
  const {data,error}=await db.auth.getUser();
  if(error||data.user?.id!==ownerUid)throw new Error('Account session changed.');
}

/** Save a small, nonfinancial activity entry for the currently signed-in owner.
 * RLS independently enforces the same owner when the row is written. */
export async function recordAccountActivity(
  ownerUid:string|null|undefined,
  eventType:AccountActivityType,
  route:string|null=null
):Promise<void>{
  if(!ownerUid||!accountActivityIsSafe(eventType,route))return;
  const key=`${ownerUid}:${eventType}:${route??''}`;
  const now=Date.now();
  const last=recentEvents.get(key);
  if(last!==undefined&&now-last<900)return;
  const db=supabase;
  if(!db)throw new Error('Account activity storage unavailable.');
  await currentOwner(ownerUid);
  const {data:inserted,error:insertError}=await db.from('taxpay_account_activity')
    .insert({owner_uid:ownerUid,event_type:eventType,route})
    .select('id,owner_uid,event_type,route,occurred_at').single();
  if(insertError)throw insertError;
  await currentOwner(ownerUid);
  if(inserted?.owner_uid!==ownerUid||inserted.event_type!==eventType||
     inserted.route!==route||!Number.isFinite(Date.parse(inserted.occurred_at)))
    throw new Error('Account activity write could not be confirmed.');
  recentEvents.set(key,Date.now());
}

export async function loadAccountActivities(ownerUid:string):Promise<AccountActivityItem[]>{
  const db=supabase;
  if(!db)throw new Error('Account activity storage unavailable.');
  await currentOwner(ownerUid);
  const {data,error}=await db.from('taxpay_account_activity')
    .select('id,owner_uid,event_type,route,occurred_at')
    .eq('owner_uid',ownerUid).order('occurred_at',{ascending:false}).limit(60);
  if(error)throw error;
  await currentOwner(ownerUid);
  const rows=(data??[]) as AccountActivityItem[];
  if(rows.some(row=>row.owner_uid!==ownerUid||!accountActivityIsSafe(row.event_type,row.route)||
      !Number.isFinite(Date.parse(row.occurred_at))))
    throw new Error('Unexpected account activity record.');
  return rows;
}
