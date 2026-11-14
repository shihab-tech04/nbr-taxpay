import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {activePreviewSession} from './previewAccountSession';

/** The server resolves recipients from the existing fictional-profile capability. */
export type ReceivedPaymentNotice = {
  eventId:string; paymentId:string; allocationId:string|null;
  recipientTin:string|null; serviceCode:string|null; headId:string|null;
  assessmentYear:string; amountMinor:number; receiptReference:string|null;
  createdAt:string; isRead:false;
};

export function parseReceivedPaymentNotice(value:unknown):ReceivedPaymentNotice {
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('Invalid received-payment notice');
  const row=value as Record<string,unknown>;
  if(typeof row.eventId!=='string'||!row.eventId||row.eventId.length>200||
    typeof row.paymentId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(row.paymentId)||
    typeof row.assessmentYear!=='string'||!row.assessmentYear||
    typeof row.amountMinor!=='number'||!Number.isSafeInteger(row.amountMinor)||row.amountMinor<=0||
    typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||
    row.isRead!==false) throw new Error('Invalid received-payment notice');
  const optional=(key:string)=>row[key]===null||row[key]===undefined?null:
    typeof row[key]==='string'&&row[key].length<=200?row[key] as string:null;
  return {
    eventId:row.eventId,paymentId:row.paymentId,allocationId:optional('allocationId'),
    recipientTin:optional('recipientTin'),serviceCode:optional('serviceCode'),
    headId:optional('headId'),assessmentYear:row.assessmentYear,
    amountMinor:row.amountMinor,receiptReference:optional('receiptReference'),
    createdAt:row.createdAt,isRead:false,
  };
}

async function scopedRequest(profileId:string,action:'received-notices-unread'|'received-notices-list'|'received-notices-ack',
  fields:Record<string,unknown>={}):Promise<unknown>{
  const session=activePreviewSession();
  if(!session||session.profileId!==profileId)
    throw new Error('Sign in to this preview account again.');
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!url||!publishableKey)throw new Error('Received notices are unavailable.');
  const response=await fetch(url.replace(/\/$/,'')+'/functions/v1/taxpay-guest-beneficiaries',{
    method:'POST',cache:'no-store',
    headers:{apikey:publishableKey,'content-type':'application/json',
      'x-taxpay-guest-capability':session.capability},
    body:JSON.stringify({action,...fields}),
  });
  const payload:unknown=await response.json().catch(()=>null);
  const result=payload&&typeof payload==='object'?payload as Record<string,unknown>:null;
  if(!response.ok||result?.success!==true)
    throw new Error('Received notices could not be verified. Try again.');
  const current=activePreviewSession();
  if(!current||current.profileId!==profileId||current.capability!==session.capability)
    throw new Error('Preview account changed during the notice request.');
  return result.data;
}

/**
 * Fetch the full chronological unread queue using WS3 #408's existing
 * capability-scoped offset contract, without silently losing item 101+.
 * Concurrent ack/addition is fail-closed and retried by the existing poll.
 */
export async function loadUnreadReceivedPaymentNotices(
  requestPage:(offset:number,limit:number)=>Promise<unknown>,
  limit=100,maxPages=200,
):Promise<ReceivedPaymentNotice[]>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||
     !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>200)throw Error('Invalid notice pagination');
  const items:ReceivedPaymentNotice[]=[];
  const seen=new Set<string>();
  let total:number|null=null;
  for(let index=0;index<maxPages;index++){
    const offset=items.length;
    const value=await requestPage(offset,limit);
    if(!value||typeof value!=='object'||Array.isArray(value))
      throw Error('Invalid notice page');
    const data=value as Record<string,unknown>;
    if(!Array.isArray(data.items)||data.items.length>limit||
       !Number.isSafeInteger(data.total)||Number(data.total)<0||
       data.offset!==offset||data.limit!==limit||
       typeof data.hasMore!=='boolean'||(total!==null&&data.total!==total))
      throw Error('Invalid notice page');
    total=data.total as number;
    if(total>maxPages*limit||data.hasMore&&data.items.length===0)
      throw Error('Notice pagination exceeded its safe limit');
    const page=data.items.map(parseReceivedPaymentNotice);
    for(const item of page){
      if(seen.has(item.eventId))throw Error('Duplicate received-payment notice');
      seen.add(item.eventId);items.push(item);
    }
    if(data.hasMore){
      if(items.length>=total)throw Error('Notice cursor changed while loading');
      continue;
    }
    if(items.length!==total)throw Error('Notice page count changed while loading');
    return items;
  }
  throw Error('Notice retrieval exceeded its safe limit');
}
export async function unreadReceivedPaymentNotices(profileId:string):Promise<ReceivedPaymentNotice[]> {
  return loadUnreadReceivedPaymentNotices((offset,limit)=>
    scopedRequest(profileId,'received-notices-unread',{offset,limit}));
}

export async function acknowledgeReceivedPaymentNotice(profileId:string,eventId:string):Promise<void>{
  if(!eventId||eventId.length>200)throw new Error('Invalid received-payment ID');
  const value=await scopedRequest(profileId,'received-notices-ack',{eventId});
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Notice acknowledgement failed');
  const row=value as Record<string,unknown>;
  if(row.eventId!==eventId||row.isRead!==true||typeof row.acknowledgedAt!=='string'||
     !Number.isFinite(Date.parse(row.acknowledgedAt)))
    throw new Error('Notice acknowledgement could not be verified');
}


/** The separate read-only Notifications register contains both acknowledged
 * and unacknowledged recipient events. The popup deliberately uses unread only.
 * No other payer's source allocation or financial settlement is exposed.
 */
export type StoredReceivedPaymentNotice=Omit<ReceivedPaymentNotice,'isRead'> & {
  isRead:boolean; acknowledgedAt:string|null;
};

export function parseStoredReceivedPaymentNotice(value:unknown):StoredReceivedPaymentNotice {
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('Invalid stored received-payment notice');
  const row=value as Record<string,unknown>;
  if(typeof row.isRead!=='boolean' ||
    (row.isRead && (typeof row.acknowledgedAt!=='string' ||
      !Number.isFinite(Date.parse(row.acknowledgedAt)))) ||
    (!row.isRead && row.acknowledgedAt!=null))
    throw Error('Invalid received-payment read state');
  const verified=parseReceivedPaymentNotice({...row,isRead:false});
  return {...verified,isRead:row.isRead,
    acknowledgedAt:row.isRead?row.acknowledgedAt as string:null};
}

/** Preserve SQL's stable event ordering across all saved read/unread pages.
 * An interrupted, duplicate, truncated or reordered page is rejected wholly.
 */
export async function loadStoredReceivedPaymentNotices(
  requestPage:(offset:number,limit:number)=>Promise<unknown>,
  limit=100,maxPages=200,
):Promise<StoredReceivedPaymentNotice[]>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>100 ||
    !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>200)
    throw Error('Invalid notice pagination');
  const items:StoredReceivedPaymentNotice[]=[];
  const seen=new Set<string>();
  let total:number|null=null;
  let previousOrderKey:string|null=null;
  for(let index=0;index<maxPages;index++){
    const offset=items.length;
    const value=await requestPage(offset,limit);
    if(!value||typeof value!=='object'||Array.isArray(value))
      throw Error('Invalid notice page');
    const data=value as Record<string,unknown>;
    if(!Array.isArray(data.items)||data.items.length>limit||
      !Number.isSafeInteger(data.total)||Number(data.total)<0||
      data.offset!==offset||data.limit!==limit||
      typeof data.hasMore!=='boolean'||(total!==null&&data.total!==total))
      throw Error('Invalid notice page');
    total=data.total as number;
    if(total>maxPages*limit||(data.hasMore&&data.items.length===0))
      throw Error('Notice pagination exceeded its safe limit');
    const page=data.items.map(parseStoredReceivedPaymentNotice);
    for(const item of page){
      if(seen.has(item.eventId))throw Error('Duplicate received-payment notice');
      // WS3 SQL sorts by createdAt, paymentId and eventId, ascending.
      // Compare timestamps as epochs: their ISO formatting may differ.
      const stamp=Date.parse(item.createdAt);
      const key=String(stamp).padStart(16,'0')+'|'+item.paymentId+'|'+item.eventId;
      if(previousOrderKey!==null&&key<previousOrderKey)
        throw Error('Received-payment notices changed ordering');
      previousOrderKey=key;seen.add(item.eventId);items.push(item);
    }
    if(data.hasMore){
      if(items.length>=total)throw Error('Notice cursor changed while loading');
      continue;
    }
    if(items.length!==total)throw Error('Notice page count changed while loading');
    return items;
  }
  throw Error('Notice retrieval exceeded its safe limit');
}

export async function listReceivedPaymentNotices(profileId:string):Promise<StoredReceivedPaymentNotice[]> {
  return loadStoredReceivedPaymentNotices((offset,limit)=>
    scopedRequest(profileId,'received-notices-list',{offset,limit}));
}


export type ReceivedNoticeFilter={
  query:string;readStatus:'all'|'read'|'unread';
  dateFrom?:string;dateTo?:string;
};
/** All filters operate only on the already validated recipient-owned SQL list.
 * Never expand the data source or infer a payer's unrelated allocations. */
export function filterStoredReceivedPaymentNotices(
  rows:readonly StoredReceivedPaymentNotice[],filter:ReceivedNoticeFilter,
):StoredReceivedPaymentNotice[]{
  const query=filter.query.trim().toLocaleLowerCase();
  const from=filter.dateFrom??'',to=filter.dateTo??'';
  if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||
    (to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||
    (from&&to&&from>to))return [];
  return rows.filter(row=>{
    if(filter.readStatus==='read'&&!row.isRead||
      filter.readStatus==='unread'&&row.isRead)return false;
    // Stable UTC date of the original SQL event, not browser's render clock.
    const day=new Date(row.createdAt).toISOString().slice(0,10);
    if(from&&day<from||to&&day>to)return false;
    return !query || [
      row.paymentId,row.receiptReference??'',row.assessmentYear,row.headId??'',
      row.serviceCode??'',row.eventId,day
    ].some(value=>value.toLocaleLowerCase().includes(query));
  });
}
