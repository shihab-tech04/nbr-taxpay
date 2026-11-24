import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {activePreviewSession} from './previewAccountSession';

export type PreviewCorrectionInput = {
  paymentId:string; requestKey:string; allocationIndex:number|null; allocationId:string|null;
  proposedAY:string; proposedCircle:string; proposedHeadCode:string; reason:string;
};
export type PreviewCorrectionRecord = {
  id:string; paymentId:string; originalReference:string; allocationIndex:number|null; allocationId:string|null;
  currentAY:string; proposedAY:string; currentCircle:string; proposedCircle:string;
  currentHeadCode:string; proposedHeadCode:string; reason:string; createdAt:string; status:'RECORDED';
};
function checked(raw:unknown):PreviewCorrectionRecord{
  if(!raw||typeof raw!=='object')throw Error('Invalid correction response');
  const row=raw as Record<string,unknown>;
  const fields=['id','paymentId','originalReference','currentAY','proposedAY','currentCircle','proposedCircle','currentHeadCode','proposedHeadCode','reason','createdAt'];
  if(fields.some(key=>typeof row[key]!=='string')||row.status!=='RECORDED'||
    !/^[0-9a-f-]{36}$/i.test(String(row.id))||!Number.isFinite(Date.parse(String(row.createdAt)))||
    (row.allocationIndex!==null&&(!Number.isSafeInteger(row.allocationIndex)||Number(row.allocationIndex)<0))||
    (row.allocationId!==null&&typeof row.allocationId!=='string'))throw Error('Invalid correction response');
  return row as unknown as PreviewCorrectionRecord;
}
async function request(path:string,method:'GET'|'POST',body?:PreviewCorrectionInput):Promise<unknown>{
  const session=activePreviewSession();
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!session||!url||!publishableKey)throw Error('Correction session unavailable');
  const response=await fetch(url.replace(/\/$/,'')+'/functions/v1/demo-story1-taxpay/corrections'+path,{
    method,cache:'no-store',headers:{apikey:publishableKey,'content-type':'application/json','x-taxpay-guest-capability':session.capability},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const envelope=await response.json().catch(()=>null) as {success?:boolean;simulationOnly?:boolean;data?:unknown}|null;
  const current=activePreviewSession();
  if(!response.ok||envelope?.success!==true||envelope.simulationOnly!==true||current?.profileId!==session.profileId||
    current.capability!==session.capability||current.paymentSessionId!==session.paymentSessionId)throw Error('Correction unavailable');
  return envelope.data;
}
export async function listPreviewCorrections():Promise<PreviewCorrectionRecord[]>{
  const session=activePreviewSession();
  if(!session)throw Error('Correction session unavailable');
  const rows:PreviewCorrectionRecord[]=[];
  for(let offset=0;offset<=1000000;offset+=100){
    const page=await request('?limit=100&offset='+offset,'GET');
    if(!Array.isArray(page)||page.length>100)throw Error('Invalid correction history');
    const current=activePreviewSession();
    if(current?.profileId!==session.profileId||current.capability!==session.capability)throw Error('Correction session changed');
    rows.push(...page.map(checked));
    if(page.length<100)return rows;
  }
  throw Error('Correction history limit reached');
}
export async function submitPreviewCorrection(input:PreviewCorrectionInput):Promise<PreviewCorrectionRecord>{
  const row=checked(await request('','POST',input));
  if(row.paymentId!==input.paymentId||row.allocationId!==input.allocationId||
    (input.allocationIndex!==null&&row.allocationIndex!==input.allocationIndex)||row.reason!==input.reason.trim())
    throw Error('Correction acknowledgement mismatch');
  return row;
}
