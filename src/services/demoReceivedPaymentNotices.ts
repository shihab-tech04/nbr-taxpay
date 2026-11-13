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

async function scopedRequest(profileId:string,action:'received-notices-unread'|'received-notices-ack',
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

export async function unreadReceivedPaymentNotices(profileId:string):Promise<ReceivedPaymentNotice[]> {
  const value=await scopedRequest(profileId,'received-notices-unread',{offset:0,limit:100});
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid notice feed');
  const data=value as Record<string,unknown>;
  if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||
    Number(data.total)<data.items.length||typeof data.hasMore!=='boolean'||
    data.items.length>100)throw new Error('Invalid notice feed');
  const parsed=data.items.map(parseReceivedPaymentNotice);
  if(new Set(parsed.map(item=>item.eventId)).size!==parsed.length)
    throw new Error('Duplicate received-payment notice');
  return parsed;
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
