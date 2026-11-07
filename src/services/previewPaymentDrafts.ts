import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
import { activePreviewSession } from './previewAccountSession';
import type { OtherTaxTaxpayer, OtherTaxAllocation } from '../components/screens/OtherTaxBatchComposer';
import type { TravelPassenger, TravelMode } from '../data/travelTax2026';

/** Cross-browser form progress belongs to the verified preview capability, never browser storage.
 * Draft payloads cannot authorize a beneficiary, confirm a passport or submit a payment.
 */
export type DraftJourney = 'guest_payment' | 'travel_tax';
export type GuestPaymentDraftState = {
  schema:'1'; journey:'guest_payment'; step:1|2|3;
  forSelf:boolean|null; tin:string; payerName:string; otherTaxpayerName:string;
  additionalTaxpayers:OtherTaxTaxpayer[]; otherTaxLines:OtherTaxAllocation[];
  phone:string; receiptEmail:string; assessmentYear:string; noticeReference:string;
  incomeTaxType:'NON_COMPANY'|'COMPANY'|null; category:string;
  selectedHeadIds:number[]; amountInputs:Record<string,string>;
  paymentChannel:'NOW'|'OTC'|null; methodGroup:'mfs'|'bank'|'card'|null;
  paymentMethod:string|null;
};
export type TravelTaxDraftState = {
  schema:'1'; journey:'travel_tax'; step:0|1|2; mode:TravelMode;
  port:string; waterPort:string; destination:string; travelDate:string;
  passengers:TravelPassenger[]; phone:string;
  paymentChannel:'NOW'|'OTC'|null; methodGroup:'mfs'|'bank'|'card'|null;
  paymentMethod:string|null;
};
export type PreviewFormDraftState = GuestPaymentDraftState | TravelTaxDraftState;
export type PreviewDraftSummary = {
  id:string; journey:DraftJourney; category:string; step:number;
  version:number; updatedAt:string;
};
export type PreviewSavedDraft = PreviewDraftSummary & { formState:PreviewFormDraftState };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(['TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
  'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT']);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const nullable=(v:unknown,values:readonly string[])=>v===null||(typeof v==='string'&&values.includes(v));
const arrays=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max;
const methods=(v:unknown)=>v===null||text(v,50);
const parseBase=(v:Record<string,unknown>,journey:DraftJourney)=>
  v.schema==='1'&&v.journey===journey;

export function parseGuestPaymentDraft(v:unknown):GuestPaymentDraftState|null {
  if(!obj(v)||!parseBase(v,'guest_payment')||!keys(v,[
    'schema','journey','step','forSelf','tin','payerName','otherTaxpayerName',
    'additionalTaxpayers','otherTaxLines','phone','receiptEmail','assessmentYear',
    'noticeReference','incomeTaxType','category','selectedHeadIds','amountInputs',
    'paymentChannel','methodGroup','paymentMethod'
  ])||!integer(v.step,1,3)||(v.forSelf!==null&&typeof v.forSelf!=='boolean')||
    !text(v.tin,13)||!text(v.payerName,160)||!text(v.otherTaxpayerName,160)||
    !text(v.phone,11)||!text(v.receiptEmail,180)||!text(v.noticeReference,160)||
    !text(v.assessmentYear,20)||!nullable(v.incomeTaxType,['NON_COMPANY','COMPANY'])||
    typeof v.category!=='string'||!categories.has(v.category)||
    !nullable(v.paymentChannel,['NOW','OTC'])||
    !nullable(v.methodGroup,['mfs','bank','card'])||!methods(v.paymentMethod)||
    !arrays(v.additionalTaxpayers,20)||!arrays(v.otherTaxLines,80)||
    !arrays(v.selectedHeadIds,40)||!obj(v.amountInputs))return null;
  if(!v.additionalTaxpayers.every((p:unknown)=>obj(p)&&keys(p,['id','tin','name'])&&
    text(p.id,50)&&text(p.tin,13)&&text(p.name,160)))return null;
  if(!v.otherTaxLines.every((l:unknown)=>obj(l)&&keys(l,['id','taxpayerId','headId','assessmentYear','amount'])&&
    text(l.id,50)&&text(l.taxpayerId,50)&&integer(l.headId,1,1000000)&&
    text(l.assessmentYear,20)&&text(l.amount,40)))return null;
  if(!v.selectedHeadIds.every((id:unknown)=>integer(id,1,1000000)))return null;
  if(Object.keys(v.amountInputs).length>40||Object.entries(v.amountInputs)
    .some(([k,a])=>!/^\d{1,7}$/.test(k)||!text(a,40)))return null;
  return v as GuestPaymentDraftState;
}
export function parseTravelTaxDraft(v:unknown):TravelTaxDraftState|null {
  if(!obj(v)||!parseBase(v,'travel_tax')||!keys(v,[
    'schema','journey','step','mode','port','waterPort','destination','travelDate',
    'passengers','phone','paymentChannel','methodGroup','paymentMethod'
  ])||!integer(v.step,0,2)||(v.mode!=='LAND'&&v.mode!=='WATER')||
    !text(v.port,100)||!text(v.waterPort,100)||!text(v.destination,160)||
    !text(v.travelDate,10)||!text(v.phone,11)||
    !nullable(v.paymentChannel,['NOW','OTC'])||
    !nullable(v.methodGroup,['mfs','bank','card'])||!methods(v.paymentMethod)||
    !arrays(v.passengers,20)||v.passengers.length===0)return null;
  if(!v.passengers.every((p:unknown)=>obj(p)&&keys(p,[
    'id','nationality','passport','name','ageBand','birthDate','country',
    'identitySource','medicalPortReferral'
  ])&&text(p.id,50)&&(p.nationality==='BD'||p.nationality==='FOREIGN')&&
    text(p.passport,30)&&text(p.name,160)&&text(p.birthDate,10)&&
    text(p.country,80)&&['ADULT','CHILD','UNDER5'].includes(String(p.ageBand))&&
    ['PASSPORT_SAMPLE','MANUAL','PENDING'].includes(String(p.identitySource))&&
    typeof p.medicalPortReferral==='boolean'))return null;
  return v as TravelTaxDraftState;
}
export function parsePreviewFormDraft(value:unknown):PreviewFormDraftState|null {
  if(!obj(value))return null;
  return value.journey==='guest_payment'?parseGuestPaymentDraft(value):
    value.journey==='travel_tax'?parseTravelTaxDraft(value):null;
}
function summary(value:unknown):PreviewDraftSummary|null {
  if(!obj(value)||typeof value.id!=='string'||!uuid.test(value.id)||
    (value.journey!=='guest_payment'&&value.journey!=='travel_tax')||
    !text(value.category,55)||!integer(value.step,0,3)||
    !integer(value.version,1,2147483647)||typeof value.updatedAt!=='string'||
    !Number.isFinite(Date.parse(value.updatedAt)))return null;
  return value as PreviewDraftSummary;
}
async function request(action:string,fields:Record<string,unknown>={}):Promise<unknown>{
  const session=activePreviewSession();
  if(!session)throw new Error('SESSION_EXPIRED');
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!url||!publishableKey)throw new Error('DRAFT_SERVICE_UNAVAILABLE');
  const result=await fetch(url.replace(/\/$/,'')+'/functions/v1/taxpay-preview-drafts',{
    method:'POST',cache:'no-store',headers:{
      apikey:publishableKey,'content-type':'application/json',
      'x-taxpay-guest-capability':session.capability,
    },body:JSON.stringify({action,...fields})
  });
  const body=await result.json().catch(()=>null) as {success?:boolean;data?:unknown;code?:string}|null;
  const current=activePreviewSession();
  if(!current||current.profileId!==session.profileId||current.capability!==session.capability)
    throw new Error('SESSION_CHANGED');
  if(!result.ok||body?.success!==true)throw new Error(body?.code||'DRAFT_SERVICE_UNAVAILABLE');
  return body.data;
}
export async function listPreviewDrafts():Promise<PreviewDraftSummary[]> {
  const data=await request('list');
  if(!Array.isArray(data))throw new Error('INVALID_DRAFT_RESPONSE');
  const parsed=data.map(summary);
  if(parsed.some(row=>row===null))throw new Error('INVALID_DRAFT_RESPONSE');
  return parsed as PreviewDraftSummary[];
}
export async function getPreviewDraft(id:string):Promise<PreviewSavedDraft>{
  if(!uuid.test(id))throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request('get',{id});
  if(!obj(raw))throw new Error('INVALID_DRAFT_RESPONSE');
  const state=parsePreviewFormDraft(raw.formState);
  if(!state)throw new Error('INVALID_DRAFT_RESPONSE');
  const meta=summary({...raw,category:state.journey==='guest_payment'?state.category:'TRAVEL_TAX',
    step:state.step});
  if(!meta||meta.journey!==state.journey)throw new Error('INVALID_DRAFT_RESPONSE');
  return {...meta,formState:state};
}
export async function savePreviewDraft(
  state:PreviewFormDraftState,existing?:{id:string;version:number}|null
):Promise<PreviewSavedDraft>{
  if(!parsePreviewFormDraft(state))throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request(existing?'update':'create',{
    ...(existing?{id:existing.id,expectedVersion:existing.version}:{}),
    journey:state.journey,formState:state
  });
  if(!obj(raw))throw new Error('INVALID_DRAFT_RESPONSE');
  const meta=summary({...raw,category:state.journey==='guest_payment'?state.category:'TRAVEL_TAX',step:state.step});
  const confirmed=parsePreviewFormDraft(raw.formState);
  if(!meta||meta.journey!==state.journey||!confirmed)
    throw new Error('INVALID_DRAFT_RESPONSE');
  return {...meta,formState:confirmed};
}
export async function deletePreviewDraft(id:string,version:number):Promise<void>{
  if(!uuid.test(id)||!integer(version,1,2147483647))throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request('delete',{id,expectedVersion:version});
  if(!obj(raw)||raw.id!==id||raw.deleted!==true)throw new Error('INVALID_DRAFT_RESPONSE');
}
