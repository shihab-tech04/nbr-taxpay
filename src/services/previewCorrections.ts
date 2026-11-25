import {useEffect,useState} from 'react';
import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {activePreviewSession} from './previewAccountSession';

export type PreviewCorrectionInput = {
  paymentId:string|null; historicalReference?:string; requestKey:string; allocationIndex:number|null; allocationId:string|null;
  proposedAY:string; proposedCircle:string; proposedHeadCode:string; reason:string;
};
export type PreviewReportInput={caseKind:'UNSOLICITED_PAYMENT_REPORT';eventId:string;requestKey:string;reason:string};
export type PreviewCorrectionRecord = {
  caseKind?:'CORRECTION_REVIEW'|'UNSOLICITED_PAYMENT_REPORT';recipientEventId?:string|null;
  id:string; paymentId:string|null; originalReference:string; allocationIndex:number|null; allocationId:string|null;
  currentAY:string; proposedAY:string; currentCircle:string; proposedCircle:string;
  currentHeadCode:string; proposedHeadCode:string; reason:string; createdAt:string; status:'RECORDED';
  officeSyncState?:'PENDING'|'ACKNOWLEDGED';
  reviewState?:'PENDING_OFFICER'|'MAKER_ACKNOWLEDGED'|'REVIEWER_VERIFIED'|'APPROVER_CLOSED'|'REJECTED';
  reviewUpdatedAt?:string|null;reviewReason?:string|null;
  initiatedBy?:'OFFICE'|'TAXPAYER';requestedOutcome?:string|null;evidenceNote?:string|null;
};
export function correctionsForAssessmentYear(rows:readonly PreviewCorrectionRecord[],year:string){
 const normalize=(value:string)=>value.trim().replace(/^(20\d{2})-(\d{2})$/,(_,start:string,end:string)=>start+'-20'+end);
 return rows.filter(row=>normalize(row.currentAY)===normalize(year));
}
/** Follow-ups is an account-wide queue, independent of the payment chart's year. */
export function recentPreviewCorrections(rows:readonly PreviewCorrectionRecord[]) {
  return [...rows].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
}
export function previewCorrectionStatus(record:Pick<PreviewCorrectionRecord,'officeSyncState'|'reviewState'>,language:'en'|'bn'){
  const bn=language==='bn';
  if(record.officeSyncState!=='ACKNOWLEDGED')return bn?'অফিসে পাঠানো হচ্ছে':'Awaiting Office';
  switch(record.reviewState){
    case 'MAKER_ACKNOWLEDGED':return bn?'অফিস গ্রহণ করেছে':'Acknowledged';
    case 'REVIEWER_VERIFIED':return bn?'পর্যালোচনা সম্পন্ন':'Reviewed';
    case 'APPROVER_CLOSED':return bn?'নিষ্পত্তি হয়েছে':'Closed';
    case 'REJECTED':return bn?'প্রত্যাখ্যাত':'Rejected';
    default:return bn?'অফিসে জমা হয়েছে':'Submitted to Office';
  }
}
function checked(raw:unknown):PreviewCorrectionRecord{
  if(!raw||typeof raw!=='object')throw Error('Invalid correction response');
  const row=raw as Record<string,unknown>;
  const fields=['id','originalReference','currentAY','proposedAY','currentCircle','proposedCircle','currentHeadCode','proposedHeadCode','reason','createdAt'];
  if(fields.some(key=>typeof row[key]!=='string')||(row.paymentId!==null&&typeof row.paymentId!=='string')||row.status!=='RECORDED'||
    !/^[0-9a-f-]{36}$/i.test(String(row.id))||!Number.isFinite(Date.parse(String(row.createdAt)))||
    (row.allocationIndex!==null&&(!Number.isSafeInteger(row.allocationIndex)||Number(row.allocationIndex)<0))||
    (row.allocationId!==null&&typeof row.allocationId!=='string'))throw Error('Invalid correction response');
  if(row.officeSyncState!==undefined&&!['PENDING','ACKNOWLEDGED'].includes(String(row.officeSyncState)))throw Error('Invalid Office delivery state');
  if(row.reviewState!==undefined&&!['PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED'].includes(String(row.reviewState)))throw Error('Invalid Office review state');
  if(row.reviewReason!==undefined&&row.reviewReason!==null&&typeof row.reviewReason!=='string')throw Error('Invalid Office review reason');
  return row as unknown as PreviewCorrectionRecord;
}
async function request(path:string,method:'GET'|'POST',body?:PreviewCorrectionInput|PreviewReportInput|{eventId:string}):Promise<unknown>{
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
    if(current?.profileId!==session.profileId||current.capability!==session.capability||current.paymentSessionId!==session.paymentSessionId)throw Error('Correction session changed');
    rows.push(...page.map(checked));
    if(page.length<100){
      if(new Set(rows.map(row=>row.id)).size!==rows.length)throw Error('Correction history changed during pagination');
      return recentPreviewCorrections(rows);
    }
  }
  throw Error('Correction history limit reached');
}
export async function submitPreviewReceivedPaymentReport(input:PreviewReportInput):Promise<PreviewCorrectionRecord>{
 const row=checked(await request('','POST',input));
 if(row.caseKind!=='UNSOLICITED_PAYMENT_REPORT'||row.recipientEventId!==input.eventId)throw Error('Report acknowledgement mismatch');
 window.dispatchEvent(new Event('taxpay:preview-corrections-changed'));
 return row;
}
export async function submitPreviewCorrection(input:PreviewCorrectionInput):Promise<PreviewCorrectionRecord>{
  const row=checked(await request('','POST',input));
  if(row.paymentId!==input.paymentId||(input.historicalReference&&row.originalReference!==input.historicalReference)||row.allocationId!==input.allocationId||
    (input.allocationIndex!==null&&row.allocationIndex!==input.allocationIndex)||row.reason!==input.reason.trim())
    throw Error('Correction acknowledgement mismatch');
  window.dispatchEvent(new Event('taxpay:preview-corrections-changed'));
  return row;
}

/** Account-bound dashboard read model. An unavailable API is never counted as zero. */
export function usePreviewCorrectionRegister(profileId:string|null,enabled=true){
  const session=activePreviewSession();
  const key=enabled&&session&&session.profileId===profileId?session.profileId+':'+session.paymentSessionId+':'+session.capability:null;
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
    window.addEventListener('focus',load);
    const refreshVisible=()=>{if(document.visibilityState==='visible')load();};
    document.addEventListener('visibilitychange',refreshVisible);
    const timer=window.setInterval(refreshVisible,60000);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',refreshVisible);window.removeEventListener('taxpay:preview-corrections-changed',load);window.removeEventListener('focus',load);};
  },[key,revision]);
  const visible=state.key===key?state:{key,phase:'loading' as const,rows:[]};
  return {phase:visible.phase,rows:visible.rows,count:key&&visible.phase==='ready'?visible.rows.length:null,
    retry:()=>setRevision(n=>n+1)};
}

export type CorrectionNotice={eventId:string;requestId:string;code:string;reference:string;createdAt:string;detail:string|null;isRead:boolean};
export function correctionNoticeTitle(code:string,language:'en'|'bn'){
 const labels:Record<string,[string,string]>={SUBMITTED:['Correction request recorded','সংশোধনের আবেদন নথিভুক্ত'],OFFICE_INITIATED:['Office initiated correction','অফিস সংশোধনের আবেদন শুরু করেছে'],OFFICE_RECEIVED:['Office received correction','অফিস সংশোধনের আবেদন পেয়েছে'],MAKER_ACKNOWLEDGED:['Maker acknowledged','অফিসার আবেদন গ্রহণ করেছেন'],REVIEWER_VERIFIED:['Reviewer verified','আবেদন পর্যালোচিত হয়েছে'],APPROVER_CLOSED:['Correction review closed','সংশোধনের আবেদন নিষ্পত্তি হয়েছে'],REJECTED:['Correction rejected','সংশোধনের আবেদন প্রত্যাখ্যাত']};
 return (labels[code]??[code,code])[language==='bn'?1:0];
}
async function noticePage(offset=0,limit=100){
 const raw=await request('/notices?offset='+offset+'&limit='+limit,'GET') as {items:CorrectionNotice[];unreadCount:number};
 if(!Array.isArray(raw?.items)||raw.items.length>limit||!Number.isSafeInteger(raw.unreadCount)||raw.unreadCount<0)throw Error('Invalid correction notices');
 for(const n of raw.items)if(!n||typeof n.eventId!=='string'||typeof n.requestId!=='string'||typeof n.code!=='string'||typeof n.reference!=='string'||!Number.isFinite(Date.parse(n.createdAt))||typeof n.isRead!=='boolean'||(n.detail!==null&&typeof n.detail!=='string'))throw Error('Invalid correction notice');
 return raw;
}
export async function markCorrectionNoticeRead(eventId:string){
 const r=await request('/notices','POST',{eventId}) as {eventId:string;isRead:boolean};
 if(r?.eventId!==eventId||r.isRead!==true)throw Error('Notice acknowledgement mismatch');
 window.dispatchEvent(new Event('taxpay:correction-notices-changed'));
}
export function useCorrectionNotices(profileId:string|null,full=false){
 const session=activePreviewSession(),key=session&&session.profileId===profileId?session.capability:null;
 type Result={key:string|null;phase:'loading'|'ready'|'error';items:CorrectionNotice[];unreadCount:number|null};
 const [result,setResult]=useState<Result>({key:null,phase:'loading',items:[],unreadCount:null});
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true,sequence=0;
  if(!key)return;
  const load=async()=>{
   const attempt=++sequence;
   try{
    const first=await noticePage(0,full?100:1),items=[...first.items];
    if(full)for(let offset=100;items.length===offset&&offset<=1000000;offset+=100){const page=await noticePage(offset);items.push(...page.items);if(page.items.length<100)break;}
    if(active&&attempt===sequence)setResult({key,phase:'ready',items,unreadCount:first.unreadCount});
   }catch{if(active&&attempt===sequence)setResult({key,phase:'error',items:[],unreadCount:null});}
  };
  void load();
  const timer=window.setInterval(load,60000);
  window.addEventListener('focus',load);
  window.addEventListener('taxpay:correction-notices-changed',load);
  window.addEventListener('taxpay:preview-corrections-changed',load);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('taxpay:correction-notices-changed',load);window.removeEventListener('taxpay:preview-corrections-changed',load);};
 },[key,full,revision]);
 return {...(key&&result.key===key?result:{key,phase:'loading' as const,items:[],unreadCount:null}),retry:()=>setRevision(n=>n+1)};
}
