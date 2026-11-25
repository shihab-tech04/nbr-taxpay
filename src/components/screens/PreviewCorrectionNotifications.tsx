import React,{useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useCorrectionNotices,markCorrectionNoticeRead,correctionNoticeTitle} from '../../services/previewCorrections';
import {UiButton} from '../ui/Controls';
export function PreviewCorrectionNotifications(){
 const {previewAccount,language,navigate}=useTaxState();
 const notices=useCorrectionNotices(previewAccount?.id??null,true);
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(false);
 const tr=(en:string,bn:string)=>language==='bn'?bn:en;
 if(!previewAccount)return null;
 return <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6 space-y-3" aria-label={tr('Correction notifications','সংশোধনের বিজ্ঞপ্তি')} data-testid="correction-notifications">
 <div className="taxpay-table-toolbar"><h2 className="text-base font-semibold">{tr('Correction notifications','সংশোধনের বিজ্ঞপ্তি')}</h2><UiButton variant="outline" type="button" onClick={notices.retry}>{tr('Refresh','রিফ্রেশ')}</UiButton></div>
 {notices.phase==='loading'?<p role="status">{tr('Loading notifications…','বিজ্ঞপ্তি লোড হচ্ছে…')}</p>:notices.phase==='error'?<p role="alert">{tr('Correction notifications unavailable. Try again.','বিজ্ঞপ্তি পাওয়া যায়নি। আবার চেষ্টা করুন।')}</p>:notices.items.length===0?<p role="status">{tr('No correction notifications yet.','এখনো সংশোধনের বিজ্ঞপ্তি নেই।')}</p>:<ul className="divide-y divide-taxpay-border">
 {notices.items.map(n=><li key={n.eventId} className="py-3 space-y-2">
 <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{correctionNoticeTitle(n.code,language)}</p><span className="text-xs">{n.isRead?tr('Read','পঠিত'):tr('Unread','অপঠিত')}</span></div>
 <p className="text-sm break-all">{n.reference} · {new Date(n.createdAt).toLocaleString(language==='bn'?'bn-BD':'en-GB')}</p>
 {n.detail&&<p className="text-sm break-words">{n.detail}</p>}
 <div className="flex flex-wrap gap-2"><UiButton type="button" variant="outline" onClick={()=>navigate('corrections',{correctionRequestId:n.requestId,originalReference:n.reference})}>{n.code.startsWith('REPORT_')?tr('View report','রিপোর্ট দেখুন'):tr('View correction','সংশোধন দেখুন')}</UiButton>
 {!n.isRead&&<UiButton type="button" variant="outline" disabled={busy!==null} onClick={async()=>{setBusy(n.eventId);setError(false);try{await markCorrectionNoticeRead(n.eventId);notices.retry();}catch{setError(true);}finally{setBusy(null);}}}>{tr('Mark as read','পঠিত হিসেবে চিহ্নিত করুন')}</UiButton>}</div>
 </li>)}</ul>}
 {error&&<p role="alert">{tr('Could not mark notification as read. Please retry.','বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত করা যায়নি। আবার চেষ্টা করুন।')}</p>}
 </section>;
}
