import {supabase} from './supabaseClient';

/** Only canonical route names are stored. No query strings, payment details,
 * TINs, beneficiary data, or browser identifiers are sent as activity. */
export function accountActivityRoute(route: string): string {
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(route)) throw new Error('Invalid account route');
  return route;
}

const outstanding = new Map<string, string[]>();
const running = new Map<string, Promise<void>>();

async function drain(ownerUid: string): Promise<void> {
  const db = supabase;
  if (!db) throw new Error('Account activity storage unavailable');
  const routes = outstanding.get(ownerUid);
  while (routes?.length) {
    const {data:identity,error:identityError} = await db.auth.getUser();
    if (identityError || identity.user?.id !== ownerUid)
      throw new Error('Account changed before activity could be stored');
    const route = routes[0];
    const {data,error} = await db.from('taxpay_account_activity')
      .insert({owner_uid:ownerUid,event_type:'ROUTE_VIEW',route})
      .select('id').single();
    if (error || !data?.id) throw new Error('Account activity was not saved');
    routes.shift();
  }
  if (routes?.length === 0) outstanding.delete(ownerUid);
}

/** Serialized, retryable per-owner writes; never record a preview or guest. */
export function saveAccountRouteVisit(ownerUid:string, route:string):Promise<void> {
  if (!ownerUid) return Promise.reject(new Error('Verified account required'));
  const validated = accountActivityRoute(route);
  const events = outstanding.get(ownerUid) ?? [];
  events.push(validated);
  outstanding.set(ownerUid,events);
  const previous = running.get(ownerUid);
  if (previous) return previous.then(()=>undefined);
  const operation = drain(ownerUid);
  running.set(ownerUid,operation);
  void operation.finally(()=>{
    if (running.get(ownerUid) === operation) running.delete(ownerUid);
  }).catch(()=>undefined);
  return operation;
}

export async function flushAccountRouteVisits(ownerUid:string):Promise<void> {
  await running.get(ownerUid)?.catch(()=>undefined);
  if (outstanding.get(ownerUid)?.length) {
    const operation=drain(ownerUid);
    running.set(ownerUid,operation);
    try { await operation; }
    finally { if(running.get(ownerUid)===operation)running.delete(ownerUid); }
  }
}
