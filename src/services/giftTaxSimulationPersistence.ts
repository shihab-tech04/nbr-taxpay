import type {ChallanReceipt} from '../types/tax';
import type {GiftTaxPaymentInput,GiftTaxSimulationMethod,GiftTaxPaymentOutcome} from './giftTaxPaymentGateway';
import {getStorySessionId,persistSimulatedPayment,type StoryPaymentInput} from './simulatedPaymentStory';
import {getConfirmedReceipt} from './confirmedPaymentCertificate';
import {activePreviewSession,GIFT_PENDING_SESSION_KEY,type PreviewSession} from './previewAccountSession';
import {sampleTinForUserNumber} from '../data/sampleTinSuggestions';
import {estimateGiftTax} from './giftTaxEstimate';

/** Existing immutable Story 1 parent and Office outbox; no real funds or official credit. */
export function giftTaxStoryInput(input:GiftTaxPaymentInput,method:GiftTaxSimulationMethod,
 sessionId:string,profileId:string|null):StoryPaymentInput {
 const minor=input.estimatedTaxMinor;
 if(!Number.isSafeInteger(minor)||minor<=0||Math.round((estimateGiftTax(input.giftAmountMinor/100)??-1)*100)!==minor)
  throw Error('INVALID_GIFT_AMOUNT');
 if(!/^\d{12}$/.test(input.donor.tin)||!/^\d{12}$/.test(input.donee.tin)||input.donor.tin===input.donee.tin)
  throw Error('INVALID_GIFT_PARTIES');
 const {donor,donee,giftAmountMinor,estimatedTaxMinor,giftDate,description,remarks}=input;
 const giftDetails={donor,donee,giftAmountMinor,estimatedTaxMinor,giftDate,description,remarks};
 const ownTin=profileId?sampleTinForUserNumber(Number(profileId.slice(4))):null;
 const payerMode=ownTin===donor.tin?'SELF':'OTHER';
 const reference='SIM-GIFT-'+input.idempotencyKey;
 const startYear=Number(giftDate.slice(0,4))+(Number(giftDate.slice(5,7))>=7?1:0);
 const assessmentYear=startYear+'-'+String(startYear+1).slice(-2);
 const line={headId:0,economicCode:'SIM-GIFT',headNameEn:'Gift Tax',taxAmount:minor/100,
  penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:minor/100};
 const receiptSnapshot:ChallanReceipt={
  id:reference,challanNo:reference,tokenNumber:'SIMULATION',paymentCategory:'GIFT_TAX',assessmentYear,
  payerName:input.payer?.name??'',payerTin:ownTin??input.payer?.tin??'',
  taxpayerName:donor.name,taxpayerTin:donor.tin,receiptMobile:input.payer?.phone??'',receiptEmail:input.payer?.email??'',
  noticeReference:input.payer?.noticeReference??'',paymentRemarks:remarks,giftDetails,isRepresentativePayment:false,
  taxZone:'—',taxCircle:'—',isWithholding:false,items:[line],totalAmount:minor/100,
  paymentMethod:method,gatewayTransactionId:reference,treasuryStatus:'INITIATED',taxCreditStatus:'NOT_APPLICABLE',
  createdAt:giftDate+'T00:00:00.000Z',isSimulatedDemo:true,
 };
 return {idempotencyKey:input.idempotencyKey,sessionId,service:'GIFT_TAX',amountMinor:minor,details:{
  sampleOnly:true,payerMode,payerName:receiptSnapshot.payerName,payerTin:receiptSnapshot.payerTin,
  taxpayerName:donor.name,taxpayerTin:donor.tin,assessmentYear,receiptReference:reference,
  receiptMobile:receiptSnapshot.receiptMobile,receiptEmail:receiptSnapshot.receiptEmail,
  noticeReference:receiptSnapshot.noticeReference,challanRemarks:remarks,paymentMethod:method,
  giftDetails,lines:[line],receiptSnapshot,
 }};
}
export type PendingGiftTax={profileId:string;sessionId:string;input:GiftTaxPaymentInput;method:GiftTaxSimulationMethod};
const methods=new Set<GiftTaxSimulationMethod>(['BKASH','NAGAD','ROCKET','SONALI_E_SHEBA','A_CHALLAN_CARD','BEFTN_RTGS','INTERNET_BANKING','VISA','MASTERCARD','BANK_BRANCH','SIMULATED']);
/** Only the active fictional account may recover an exact, unacknowledged
 * simulation. Never store or replay an authenticated real taxpayer payment. */
export function parsePendingGiftTax(raw:string|null,preview:Pick<PreviewSession,'profileId'|'paymentSessionId'>|null):PendingGiftTax|null{
 if(!raw||!preview)return null;
 try{
  const pending=JSON.parse(raw) as PendingGiftTax;
  if(pending.profileId!==preview.profileId||pending.sessionId!==preview.paymentSessionId||
    !methods.has(pending.method)||!pending.input||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.input.idempotencyKey))
    return null;
  giftTaxStoryInput(pending.input,pending.method,pending.sessionId,pending.profileId);
  return pending;
 }catch{return null;}
}
export function readPendingGiftTax():PendingGiftTax|null{
 try{return parsePendingGiftTax(sessionStorage.getItem(GIFT_PENDING_SESSION_KEY),activePreviewSession());}catch{return null;}
}
function canonical(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 const o=value as Record<string,unknown>;
 return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
}
export async function persistGiftTaxSimulation(input:GiftTaxPaymentInput,method:GiftTaxSimulationMethod):Promise<GiftTaxPaymentOutcome>{
 const sessionId=getStorySessionId(),preview=activePreviewSession();
 const story=giftTaxStoryInput(input,method,sessionId,preview?.profileId??null);
 const pending={kind:'SIMULATED_SYNC_PENDING' as const,reference:String(story.details.receiptReference),method};
 if(preview){
  // Retain the original review in this tab BEFORE sending the first request.
  // A different review cannot overwrite an unresolved simulation.
  const old=readPendingGiftTax();
  if(old&&(old.input.idempotencyKey!==input.idempotencyKey||old.method!==method||canonical(old.input)!==canonical(input)))
   throw Error('GIFT_PREVIOUS_SIMULATION_PENDING');
  sessionStorage.setItem(GIFT_PENDING_SESSION_KEY,JSON.stringify({profileId:preview.profileId,sessionId,input,method}));
 }
 try{
  const ack=await persistSimulatedPayment(story);
  if(!ack.mirrored||ack.officeSyncStatus!=='SYNCED')return pending;
  const receipt=await getConfirmedReceipt(ack.id);
  if(getStorySessionId()!==sessionId||activePreviewSession()?.capability!==preview?.capability||
    receipt.paymentTransactionId!==ack.id||receipt.paymentCategory!=='GIFT_TAX'||
    receipt.challanNo!==story.details.receiptReference||receipt.paymentMethod!==method||
    Math.round(receipt.totalAmount*100)!==story.amountMinor||
    receipt.paymentRemarks!==input.remarks||canonical(receipt.giftDetails)!==canonical(story.details.giftDetails))
    return pending;
  if(preview&&readPendingGiftTax()?.input.idempotencyKey===input.idempotencyKey){
   try{sessionStorage.removeItem(GIFT_PENDING_SESSION_KEY);}catch{/* the same idempotency key remains safe */}
  }
  return {kind:'SIMULATED_SUCCESS',reference:receipt.challanNo,method,createdAt:receipt.createdAt,receipt};
 }catch{return pending;}
}
