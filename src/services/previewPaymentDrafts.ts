import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
import { activePreviewSession } from './previewAccountSession';

/** One draft is resumable payment FORM progress, never a payment or receipt. */
export type WizardDraftState = {
  category: string;
  assessmentYear: string;
  selectedHeadId: number;
  taxAmount: number;
  penaltyAmount: number;
  surchargeAmount: number;
  interestAmount: number;
  note: string;
  paymentMethod: string;
  step: 1 | 2 | 3;
};
export type PreviewDraftSummary = {
  id: string;
  journey: 'wizard';
  category: string;
  step: 1 | 2 | 3;
  version: number;
  updatedAt: string;
};
export type PreviewWizardDraft = PreviewDraftSummary & { formState: WizardDraftState };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(['TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
  'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT']);
const channels = new Set(['BKASH','NAGAD','ROCKET','SONALI_E_SHEBA','A_CHALLAN_CARD','BEFTN_RTGS']);
const amountKeys = ['taxAmount','penaltyAmount','surchargeAmount','interestAmount'] as const;
const formKeys = new Set(['category','assessmentYear','selectedHeadId',...amountKeys,'note','paymentMethod','step']);

function object(value:unknown):value is Record<string,unknown>{
  return !!value && typeof value==='object' && !Array.isArray(value);
}
function validAmount(value:unknown):value is number {
  return typeof value==='number' && Number.isFinite(value) && value>=0 && value<=99999999999 &&
    Math.round(value*100)===value*100;
}
export function parseWizardDraftState(value:unknown):WizardDraftState|null {
  if(!object(value)||Object.keys(value).some(k=>!formKeys.has(k))||
    typeof value.category!=='string'||!categories.has(value.category)||
    typeof value.assessmentYear!=='string'||value.assessmentYear.length>30||
    !Number.isSafeInteger(value.selectedHeadId)||Number(value.selectedHeadId)<1||
    typeof value.note!=='string'||value.note.length>300||
    typeof value.paymentMethod!=='string'||!channels.has(value.paymentMethod)||
    (value.step!==1&&value.step!==2&&value.step!==3)||
    amountKeys.some(k=>!validAmount(value[k])))return null;
  return value as WizardDraftState;
}
function summary(value:unknown):PreviewDraftSummary|null {
  if(!object(value)||typeof value.id!=='string'||!uuid.test(value.id)||
    value.journey!=='wizard'||typeof value.category!=='string'||!categories.has(value.category)||
    (value.step!==1&&value.step!==2&&value.step!==3)||
    !Number.isSafeInteger(value.version)||Number(value.version)<1||
    typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))return null;
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
  const body=await result.json().catch(()=>null) as
    {success?:boolean;data?:unknown;code?:string}|null;
  // Discard any in-flight result that belongs to a now-signed-out/changed account.
  const current=activePreviewSession();
  if(!current||current.profileId!==session.profileId||current.capability!==session.capability)
    throw new Error('SESSION_CHANGED');
  if(!result.ok||body?.success!==true)throw new Error(body?.code||'DRAFT_SERVICE_UNAVAILABLE');
  return body.data;
}
export async function listPreviewWizardDrafts():Promise<PreviewDraftSummary[]>{
  const data=await request('list');
  if(!Array.isArray(data))throw new Error('INVALID_DRAFT_RESPONSE');
  const parsed=data.map(summary);
  if(parsed.some(row=>row===null))throw new Error('INVALID_DRAFT_RESPONSE');
  return parsed as PreviewDraftSummary[];
}
export async function getPreviewWizardDraft(id:string):Promise<PreviewWizardDraft>{
  if(!uuid.test(id))throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request('get',{id});
  if(!object(raw))throw new Error('INVALID_DRAFT_RESPONSE');
  const meta=summary({...raw,category:object(raw.formState)?raw.formState.category:null,
    step:object(raw.formState)?raw.formState.step:null});
  const state=parseWizardDraftState(raw.formState);
  if(!meta||!state)throw new Error('INVALID_DRAFT_RESPONSE');
  return {...meta,formState:state};
}
export async function savePreviewWizardDraft(
  state:WizardDraftState,existing?:{id:string;version:number}|null
):Promise<PreviewWizardDraft>{
  if(!parseWizardDraftState(state))throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request(existing?'update':'create',{
    ...(existing?{id:existing.id,expectedVersion:existing.version}:{}),
    formState:state,
  });
  if(!object(raw))throw new Error('INVALID_DRAFT_RESPONSE');
  const meta=summary({...raw,category:state.category,step:state.step});
  if(!meta||!parseWizardDraftState(raw.formState))throw new Error('INVALID_DRAFT_RESPONSE');
  return {...meta,formState:state};
}
export async function deletePreviewWizardDraft(id:string,version:number):Promise<void>{
  if(!uuid.test(id)||!Number.isSafeInteger(version)||version<1)
    throw new Error('INVALID_DRAFT_REQUEST');
  const raw=await request('delete',{id,expectedVersion:version});
  if(!object(raw)||raw.id!==id||raw.deleted!==true)throw new Error('INVALID_DRAFT_RESPONSE');
}
