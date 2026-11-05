import {supabase} from './supabaseClient';

export type AccountUiKey='beneficiary_tag_filter'|'beneficiary_relationship_filter'|
  'payment_service'|'payment_for_self'|'last_route';
export type AccountEvent='NAVIGATE'|'PAYMENT_ENTRY'|'PAYMENT_STAGE'|
  'BENEFICIARY_LIST_SELECTED'|'BENEFICIARY_ADDED'|'BENEFICIARY_EDITED'|
  'BENEFICIARY_REMOVED'|'BENEFICIARY_LIST_CREATED'|'BENEFICIARY_LIST_RENAMED'|
  'BENEFICIARY_LIST_REMOVED'|'NOTIFICATIONS_READ'|'SETTINGS_SAVED';
type UiRow={preference_key:AccountUiKey;value:string};
type PendingEvent={id:string;owner_uid:string;client_event_id:string;event_type:AccountEvent;source:string};

const pendingStates=new Map<string,Map<AccountUiKey,string>>();
const stateWrites=new Map<string,Promise<void>>();
const pendingEvents=new Map<string,Map<string,PendingEvent>>();
const eventWrites=new Map<string,Promise<void>>();
const filters=new Set(['all','clients','friends_family','others','legacy']);
const relationshipPattern=/^(?:all|father|mother|brother|sister|siblings|son|daughter|spouse|friends|friend)$/;
const servicePattern=/^[A-Z_]{3,40}$/;
const routePattern=/^[a-z_]{2,40}$/;

/** UI state cannot carry a TIN, name, payment amount or arbitrary JSON. */
export function accountUiValue(key:AccountUiKey,value:string):string{
  if(key==='beneficiary_tag_filter'&&!filters.has(value))throw Error('Invalid beneficiary tag preference');
  if(key==='beneficiary_relationship_filter'&&!relationshipPattern.test(value))throw Error('Invalid relationship preference');
  if(key==='payment_service'&&!servicePattern.test(value))throw Error('Invalid payment service preference');
  if(key==='payment_for_self'&&value!=='self'&&value!=='other')throw Error('Invalid payment mode preference');
  if(key==='last_route'&&!routePattern.test(value))throw Error('Invalid route preference');
  if(!value||value.length>160)throw Error('Invalid account preference');
  return value;
}
async function authenticatedOwner(ownerUid:string){
  const client=supabase;
  if(!client)throw Error('Account storage unavailable');
  const {data,error}=await client.auth.getUser();
  if(error||data.user?.id!==ownerUid)throw Error('Account session changed');
  return client;
}
async function commitState(ownerUid:string,key:AccountUiKey,value:string):Promise<void>{
  const db=await authenticatedOwner(ownerUid);
  const {data,error}=await db.from('taxpay_account_ui_state')
    .upsert({owner_uid:ownerUid,preference_key:key,value,updated_at:new Date().toISOString()},
      {onConflict:'owner_uid,preference_key'})
    .select('value').single();
  if(error||data?.value!==value)throw Error('Account preference save not confirmed');
  await authenticatedOwner(ownerUid);
}
/** The last choice wins even when a network write completes out of order. */
export function saveAccountUiState(ownerUid:string,key:AccountUiKey,value:string):Promise<void>{
  value=accountUiValue(key,value);
  const changes=pendingStates.get(ownerUid)??new Map<AccountUiKey,string>();
  changes.set(key,value);pendingStates.set(ownerUid,changes);
  const prior=stateWrites.get(ownerUid)??Promise.resolve();
  const current=prior.catch(()=>undefined).then(async()=>{
    await commitState(ownerUid,key,value);
    if(changes.get(key)===value){
      changes.delete(key);
      if(!changes.size)pendingStates.delete(ownerUid);
    }
  });
  stateWrites.set(ownerUid,current);
  void current.catch(()=>undefined).finally(()=>{
    if(stateWrites.get(ownerUid)===current)stateWrites.delete(ownerUid);
  });
  return current;
}
export async function loadAccountUiState(ownerUid:string):Promise<Partial<Record<AccountUiKey,string>>>{
  const db=await authenticatedOwner(ownerUid);
  const {data,error}=await db.from('taxpay_account_ui_state')
    .select('preference_key,value').eq('owner_uid',ownerUid);
  if(error)throw error;
  await authenticatedOwner(ownerUid);
  const result:Partial<Record<AccountUiKey,string>>={};
  for(const row of (data??[]) as UiRow[]){
    try{result[row.preference_key]=accountUiValue(row.preference_key,row.value);}
    catch{ /* Ignore invalid/obsolete preference values instead of affecting UI. */ }
  }
  return result;
}
async function commitEvent(entry:PendingEvent):Promise<void>{
  const db=await authenticatedOwner(entry.owner_uid);
  const {error}=await db.from('taxpay_account_interactions').insert(entry);
  if(error && error.code!=='23505')throw error;
  const {data, error:readError}=await db.from('taxpay_account_interactions')
    .select('id').eq('id',entry.id).eq('owner_uid',entry.owner_uid).single();
  if(readError||data?.id!==entry.id)throw Error('Account activity save not confirmed');
  await authenticatedOwner(entry.owner_uid);
}
/** Whitelisted action and source only: never persist TIN, payment payload,
 * receipt, email, search text or a false financial status in an interaction.
 */
export function recordAccountInteraction(ownerUid:string,eventType:AccountEvent,source:string):Promise<void>{
  if(!/^[a-z_]{2,60}$/.test(source))return Promise.reject(Error('Invalid account interaction source'));
  const id=crypto.randomUUID();
  const item:PendingEvent={id,owner_uid:ownerUid,client_event_id:id,event_type:eventType,source};
  const pending=pendingEvents.get(ownerUid)??new Map<string,PendingEvent>();
  pending.set(id,item);pendingEvents.set(ownerUid,pending);
  const prior=eventWrites.get(ownerUid)??Promise.resolve();
  const next=prior.catch(()=>undefined).then(async()=>{
    await commitEvent(item);
    pending.delete(id);
    if(!pending.size)pendingEvents.delete(ownerUid);
  });
  eventWrites.set(ownerUid,next);
  void next.catch(()=>undefined).finally(()=>{
    if(eventWrites.get(ownerUid)===next)eventWrites.delete(ownerUid);
  });
  return next;
}
export async function flushAccountExperience(ownerUid:string):Promise<void>{
  await stateWrites.get(ownerUid)?.catch(()=>undefined);
  const prefs=pendingStates.get(ownerUid);
  for(const [key,value] of [...(prefs?.entries()??[])]){
    if(prefs?.get(key)===value)await saveAccountUiState(ownerUid,key,value);
  }
  await eventWrites.get(ownerUid)?.catch(()=>undefined);
  const events=pendingEvents.get(ownerUid);
  for(const entry of [...(events?.values()??[])]){
    await commitEvent(entry);
    events?.delete(entry.id);
  }
  if(events&&!events.size)pendingEvents.delete(ownerUid);
  if(pendingStates.get(ownerUid)?.size||pendingEvents.get(ownerUid)?.size)
    throw Error('Account experience could not be saved');
}
export async function loadAccountInteractions(ownerUid:string,limit=100):Promise<
  {id:string;event_type:AccountEvent;source:string;occurred_at:string}[]>{
  if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Invalid activity page size');
  const db=await authenticatedOwner(ownerUid);
  const {data,error}=await db.from('taxpay_account_interactions')
    .select('id,owner_uid,event_type,source,occurred_at')
    .eq('owner_uid',ownerUid).order('occurred_at',{ascending:false})
    .order('id',{ascending:false}).limit(limit);
  if(error)throw error;
  await authenticatedOwner(ownerUid);
  return (data??[]).filter(row=>row.owner_uid===ownerUid).map(({id,event_type,source,occurred_at})=>
    ({id,event_type,source,occurred_at}));
}
