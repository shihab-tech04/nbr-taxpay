import {supabase} from './supabaseClient';
import {validateAccountReceivedPaymentPage} from './verifiedAccountNoticePage';
import {loadUnreadReceivedPaymentNotices,loadStoredReceivedPaymentNotices,
  type ReceivedPaymentNotice,type StoredReceivedPaymentNotice} from './demoReceivedPaymentNotices';

/** Auth-owned SQL queue: no client TIN, fictional capability or payer session. */
type Action='unread'|'list'|'ack';

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
  return action==='ack'?data:validateAccountReceivedPaymentPage(data);
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
