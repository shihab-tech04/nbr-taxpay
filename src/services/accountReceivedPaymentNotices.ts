import {supabase} from './supabaseClient';
import {loadUnreadReceivedPaymentNotices,loadStoredReceivedPaymentNotices,
  type ReceivedPaymentNotice,type StoredReceivedPaymentNotice} from './demoReceivedPaymentNotices';

/** Auth-owned SQL queue: never accept TIN, fictional capability or a caller-owned
 * payment session. The database obtains the approved profile from auth.uid().
 */
type Action='unread'|'list'|'ack';
function verifiedRecordedPage(raw:unknown):unknown {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid recipient page');
  const data=raw as Record<string,unknown>;
  if(!Array.isArray(data.items))throw Error('Invalid recipient page');
  for(const item of data.items) {
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid recipient event');
    const row=item as Record<string,unknown>;
    if(row.recordState!=='RECORDED_NOT_CONFIRMED_TAX_CREDIT'||row.recipientTin!==null)
      throw Error('Recipient provenance or privacy not verified');
  }
  return data;
}

async function authenticatedNoticeRequest(ownerUid:string,action:Action,
  extras:{offset?:number;limit?:number;eventId?:string}={}):Promise<unknown> {
  const client=supabase;
  if(!client||!ownerUid)throw Error('Sign in to view received payments.');
  const {data:before,error:identityError}=await client.auth.getUser();
  if(identityError||before.user?.id!==ownerUid)
    throw Error('Signed-in account changed. Please sign in again.');
  const {data,error}=await client.rpc('taxpay_account_received_payment_notices',{
    p_action:action,
    p_event_id:extras.eventId??null,
    p_offset:extras.offset??0,
    p_limit:extras.limit??100,
  });
  if(error)throw Error('Recipient notice verification is unavailable.');
  const {data:after,error:afterError}=await client.auth.getUser();
  if(afterError||after.user?.id!==ownerUid)
    throw Error('Signed-in account changed during the request.');
  return action==='ack'?data:verifiedRecordedPage(data);
}

export function loadAccountUnreadReceivedPayments(ownerUid:string):Promise<ReceivedPaymentNotice[]> {
  return loadUnreadReceivedPaymentNotices((offset,limit)=>
    authenticatedNoticeRequest(ownerUid,'unread',{offset,limit}));
}
export function listAccountReceivedPayments(ownerUid:string):Promise<StoredReceivedPaymentNotice[]> {
  return loadStoredReceivedPaymentNotices((offset,limit)=>
    authenticatedNoticeRequest(ownerUid,'list',{offset,limit}));
}
export async function acknowledgeAccountReceivedPayment(ownerUid:string,eventId:string):Promise<void> {
  if(!/^[0-9a-f-]{36}:allocation:[1-9][0-9]*$/i.test(eventId))
    throw Error('Invalid recipient event identity.');
  const response=await authenticatedNoticeRequest(ownerUid,'ack',{eventId});
  if(!response||typeof response!=='object'||Array.isArray(response))throw Error('Notice read state was not confirmed.');
  const row=response as Record<string,unknown>;
  if(row.eventId!==eventId||row.isRead!==true||
    typeof row.acknowledgedAt!=='string'||!Number.isFinite(Date.parse(row.acknowledgedAt)))
    throw Error('Notice read state was not confirmed.');
}
