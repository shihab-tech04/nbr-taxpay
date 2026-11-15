import type {ReceivedPaymentNotice,StoredReceivedPaymentNotice} from './demoReceivedPaymentNotices';
import type {CorrectionCaseKind} from './correctionInquiryValidation';

/**
 * This is only a short-lived navigation draft for the existing Auth-owned
 * correction form. It grants no taxpayer identity, payment ownership or
 * reporting permission: SQL validates the authenticated owner on INSERT.
 * Never store the recipient's TIN, contact data, financial amount or preview
 * capability here.
 */
const STORAGE_KEY='sohojkor.received-payment-case-intent.v1';
const MAX_AGE_MS=30*60*1000;
const referencePattern=/^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$/;
const eventPattern=/^[0-9a-f-]{36}:(?:allocation|legacy):[1-9][0-9]*$/i;
const allocationPattern=/^\S(?:.{0,126}\S)?$/;

export type ReceivedPaymentCaseIntent=Readonly<{
  eventId:string;
  originalReference:string;
  targetAllocationId:string|null;
  caseKind:CorrectionCaseKind;
  createdAt:number;
}>;

type Notice=Pick<ReceivedPaymentNotice|StoredReceivedPaymentNotice,
  'eventId'|'paymentId'|'receiptReference'|'allocationId'>;

export function buildReceivedPaymentCaseIntent(
  notice:Notice,caseKind:CorrectionCaseKind,now=Date.now()
):ReceivedPaymentCaseIntent {
  if(caseKind!=='CORRECTION_REVIEW'&&caseKind!=='UNSOLICITED_PAYMENT_REPORT')
    throw Error('Invalid inquiry type');
  if(!eventPattern.test(notice.eventId) || !referencePattern.test(notice.paymentId))
    throw Error('Invalid received payment reference');
  const reference=notice.receiptReference&&referencePattern.test(notice.receiptReference)
    ?notice.receiptReference:notice.paymentId;
  const allocation=notice.allocationId;
  if(allocation!==null&&(!allocationPattern.test(allocation)||allocation.length>128))
    throw Error('Invalid received payment allocation');
  if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid intent timestamp');
  return {eventId:notice.eventId,originalReference:reference,
    targetAllocationId:allocation,caseKind,createdAt:now};
}
export function isValidReceivedPaymentCaseIntent(raw:unknown,now=Date.now()):
  raw is ReceivedPaymentCaseIntent {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const item=raw as Record<string,unknown>;
  return Object.keys(item).length===5 &&
    typeof item.eventId==='string'&&eventPattern.test(item.eventId)&&
    typeof item.originalReference==='string'&&referencePattern.test(item.originalReference)&&
    (item.targetAllocationId===null||typeof item.targetAllocationId==='string'&&
      allocationPattern.test(item.targetAllocationId)&&item.targetAllocationId.length<=128)&&
    (item.caseKind==='CORRECTION_REVIEW'||item.caseKind==='UNSOLICITED_PAYMENT_REPORT')&&
    typeof item.createdAt==='number'&&Number.isSafeInteger(item.createdAt)&&
    Number.isSafeInteger(now)&&item.createdAt<=now&&now-item.createdAt<=MAX_AGE_MS;
}

export function queueReceivedPaymentCaseIntent(notice:Notice,caseKind:CorrectionCaseKind):void {
  const draft=buildReceivedPaymentCaseIntent(notice,caseKind);
  window.sessionStorage.setItem(STORAGE_KEY,JSON.stringify(draft));
}
export function readReceivedPaymentCaseIntent():ReceivedPaymentCaseIntent|null {
  try {
    const raw=window.sessionStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const value:unknown=JSON.parse(raw);
    if(isValidReceivedPaymentCaseIntent(value))return value;
    window.sessionStorage.removeItem(STORAGE_KEY);
  }catch{/* Storage may be blocked, expired or malformed. Never authorize from it. */}
  return null;
}
export function clearReceivedPaymentCaseIntent():void {
  try{window.sessionStorage.removeItem(STORAGE_KEY);}
  catch{/* Leave the server-side owner check authoritative. */}
}

/** An exact source reference is required before this hint may bypass a payer
 * session claim. SQL still has to authenticate and authorize this allocation.
 */
export function receivedAllocationForReference(
  intent:ReceivedPaymentCaseIntent|null,reference:string
):string|null {
  if(!intent||!intent.targetAllocationId||
     intent.originalReference!==reference.trim())return null;
  return intent.targetAllocationId;
}
