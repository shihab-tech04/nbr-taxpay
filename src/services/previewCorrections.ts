import {useEffect,useState} from 'react';
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
  window.dispatchEvent(new Event('taxpay:preview-corrections-changed'));
  return row;
}

/** Account-bound dashboard read model. An unavailable API is never counted as zero. */
export function usePreviewCorrectionRegister(profileId:string|null,enabled=true){
  const session=activePreviewSession();
  const key=enabled&&session&&session.profileId===profileId?session.capability:null;
  type State={key:string|null;phase:'loading'|'ready'|'error';rows:PreviewCorrectionRecord[]};
  const [state,setState]=useState<State>({key:null,phase:'loading',rows:[]});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    let sequence=0;
    if(!key){setState({key:null,phase:'error',rows:[]});return;}
    const load=()=>{
      const attempt=++sequence;
      setState({key,phase:'loading',rows:[]});
      void listPreviewCorrections().then(rows=>{
        if(active&&attempt===sequence)setState({key,phase:'ready',rows});
      }).catch(()=>{
        if(active&&attempt===sequence)setState({key,phase:'error',rows:[]});
      });
    };
    load();
    window.addEventListener('taxpay:preview-corrections-changed',load);
    return()=>{active=false;window.removeEventListener('taxpay:preview-corrections-changed',load);};
  },[key,revision]);
  const visible=state.key===key?state:{key,phase:'loading' as const,rows:[]};
  return {phase:visible.phase,rows:visible.rows,count:key&&visible.phase==='ready'?visible.rows.length:null,
    retry:()=>setRevision(n=>n+1)};
}
