import React,{useEffect,useState,useRef} from 'react';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceivedPaymentNoticeDetails} from './ReceivedPaymentNoticeDetails';
import {listReceivedPaymentNotices,type StoredReceivedPaymentNotice} from '../../services/demoReceivedPaymentNotices';
import {clearReceivedPaymentCaseIntent,type ReceivedPaymentCaseIntent} from '../../services/receivedPaymentCaseIntent';
import {submitPreviewReceivedPaymentReport,previewCorrectionStatus,listPreviewCorrections,type PreviewCorrectionRecord} from '../../services/previewCorrections';
export function PreviewReceivedPaymentReport({profileId,intent,language,onExit}:{profileId:string;intent:ReceivedPaymentCaseIntent;language:'en'|'bn';onExit:()=>void}){
 const bn=language==='bn';const tr=(en:string,b:string)=>bn?b:en;
 const [notice,setNotice]=useState<StoredReceivedPaymentNotice|null>(null);
 const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
 const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);const [record,setRecord]=useState<PreviewCorrectionRecord|null>(null);
 const [attempt,setAttempt]=useState(0);const key=useRef(crypto.randomUUID());
 useEffect(()=>{let active=true;setPhase('loading');void Promise.all([listReceivedPaymentNotices(profileId),listPreviewCorrections()]).then(([rows,reports])=>{
  const row=rows.find(r=>r.eventId===intent.eventId&&r.allocationId===intent.targetAllocationId);
  if(!row)throw Error('Recipient record unavailable');
  if(active){
    const existing=reports.find(r=>r.caseKind==='UNSOLICITED_PAYMENT_REPORT'&&r.recipientEventId===row.eventId&&r.paymentId===row.paymentId&&r.allocationId===row.allocationId);
    setNotice(row);setRecord(existing??null);if(existing)setReason(existing.reason);setPhase('ready');
  }
 }).catch(()=>{if(active)setPhase('error');});return()=>{active=false;};},[profileId,intent.eventId,intent.targetAllocationId,attempt]);
 useEffect(()=>{
  if(!record||record.officeSyncState==='ACKNOWLEDGED')return;
  let active=true;
  const poll=()=>void listPreviewCorrections().then(rows=>{
   const current=rows.find(r=>r.id===record.id&&r.recipientEventId===intent.eventId);
   if(active&&current)setRecord(current);
  }).catch(()=>{/* retain last confirmed state */});
  const timer=window.setInterval(poll,5000);
  return()=>{active=false;window.clearInterval(timer);};
 },[record?.id,record?.officeSyncState,intent.eventId]);
 const close=()=>{if(!busy){clearReceivedPaymentCaseIntent();onExit();}};
 const submit=async()=>{if(!notice||busy||reason.trim().length<10||reason.trim().length>1000)return;setBusy(true);setError(false);
 try{const saved=await submitPreviewReceivedPaymentReport({caseKind:'UNSOLICITED_PAYMENT_REPORT',eventId:notice.eventId,requestKey:key.current,reason});
 if(saved.paymentId!==notice.paymentId||saved.allocationId!==notice.allocationId)throw Error('Report target mismatch');setRecord(saved);}catch{setError(true);}finally{setBusy(false);}};
 return <TaxPayModal title={tr('Report Payment','পেমেন্ট রিপোর্ট করুন')} onClose={close} footer={<div className="flex w-full gap-3"><button type="button" className="taxpay-modal__footer-close" disabled={busy} onClick={close}>{tr('Close','বন্ধ করুন')}</button>{phase==='ready'&&record?.officeSyncState!=='ACKNOWLEDGED'&&<button type="button" className="tax-service-choice__continue" disabled={busy||reason.trim().length<10||reason.trim().length>1000} onClick={()=>void submit()}>{busy?tr('Submitting…','জমা হচ্ছে…'):record?tr('Retry Office delivery','অফিসে আবার পাঠান'):tr('Submit Report','রিপোর্ট জমা দিন')}</button>}</div>}>
 {phase==='loading'&&<p role="status">{tr('Loading payment details…','পেমেন্টের তথ্য লোড হচ্ছে…')}</p>}
 {phase==='error'&&<div role="alert"><p>{tr('Payment details unavailable.','পেমেন্টের তথ্য পাওয়া যায়নি।')}</p><button type="button" onClick={()=>setAttempt(a=>a+1)}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>}
 {phase==='ready'&&notice&&<div className="space-y-4"><ReceivedPaymentNoticeDetails notice={notice} language={language}/><label className="block text-sm font-medium">{tr('Reason for reporting (10–1000 characters)','রিপোর্টের কারণ (১০–১০০০ অক্ষর)')}<textarea className="mt-2 w-full rounded-lg border border-taxpay-border p-3" rows={4} maxLength={1000} value={reason} disabled={busy||!!record} onChange={e=>setReason(e.target.value)}/></label>{record&&<div role="status"><p>{record.officeSyncState==='ACKNOWLEDGED'?tr('Report reference','রিপোর্ট রেফারেন্স'):tr('Saved reference — Office delivery pending','সংরক্ষিত রেফারেন্স — অফিসে পাঠানো বাকি')}: {record.id}</p><p>{previewCorrectionStatus(record,language)}</p></div>}{error&&<p role="alert">{tr('Report could not be confirmed. Retry without creating another report.','রিপোর্ট নিশ্চিত করা যায়নি। আবার চেষ্টা করুন।')}</p>}</div>}
 </TaxPayModal>;
}
