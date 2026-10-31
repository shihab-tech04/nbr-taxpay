import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { formatBdtMinorUnits } from '../../services/minorUnitFormatting';
import type { Language } from '../../types/tax';

type Draft = { id:string; owner_uid:string; purpose:string; category:string; assessment_year:string; amount_minor:number; memo:string|null };
type Request = { id:string; source_draft_id:string|null; category:string; assessment_year:string; amount_minor:number; request_status:string; financial_receipt_status:string; tax_credit_status:string; submitted_at:string };
type Notice = { id:string; request_id:string; message_code:string; is_read:boolean; created_at:string };

/** Shared, strictly non-financial review intake. Does NOT pay tax, create challans or grant credits. */
export function SharedReviewRequests({authenticatedUserId,language,drafts}:{authenticatedUserId:string;language:Language;drafts:Draft[]}) {
  const bn=language==='bn';
  const text=(en:string,local:string)=>bn?local:en;
  const [requests,setRequests]=useState<Request[]>([]);
  const [notices,setNotices]=useState<Notice[]>([]);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [revision,setRevision]=useState(0);

  const refresh=useCallback(async()=>{
    if(!supabase) return;
    const {data:identity,error:identityError}=await supabase.auth.getUser();
    if(identityError || identity.user?.id!==authenticatedUserId) throw new Error('Session changed');
    const [r,n]=await Promise.all([
      supabase.from('taxpay_payment_requests').select('id,source_draft_id,category,assessment_year,amount_minor,request_status,financial_receipt_status,tax_credit_status,submitted_at').eq('owner_uid',authenticatedUserId).order('submitted_at',{ascending:false}).limit(50),
      supabase.from('taxpay_in_app_notifications').select('id,request_id,message_code,is_read,created_at').order('created_at',{ascending:false}).limit(50)
    ]);
    if(r.error || n.error) throw new Error(r.error?.message||n.error?.message||'Unable to read back');
    const {data:stillCurrent}=await supabase.auth.getUser();
    if(stillCurrent.user?.id!==authenticatedUserId) throw new Error('Session changed');
    setRequests((r.data||[]) as Request[]);setNotices((n.data||[]) as Notice[]);setLoaded(true);setError('');
  },[authenticatedUserId]);

  useEffect(()=>{
    let active=true;
    setRequests([]);setNotices([]);setLoaded(false);setError('');
    const run=()=>{if(active) void refresh().catch(()=>{if(active)setError(text('Could not load review status. Retry.','রিভিউয়ের অবস্থা পাওয়া যায়নি। আবার চেষ্টা করুন।'));});};
    run();const interval=window.setInterval(run,20000);
    return()=>{active=false;window.clearInterval(interval);};
  // Revision is deliberately a manual refresh after a committed mutation.
  },[refresh,revision]);

  const submit=async(draft:Draft)=>{
    if(!supabase||busy||draft.owner_uid!==authenticatedUserId)return;
    setBusy(draft.id);setError('');
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||auth.user?.id!==authenticatedUserId)throw new Error('Session changed');
      const {data,error:insertError}=await supabase.from('taxpay_payment_requests').insert({
        owner_uid:authenticatedUserId,source_draft_id:draft.id,purpose:draft.purpose,category:draft.category,
        assessment_year:draft.assessment_year,amount_minor:draft.amount_minor,memo:draft.memo
      }).select('id').single();
      if(insertError||!data?.id)throw new Error(insertError?.message||'Submission not confirmed');
      // No optimistic success: require a fresh owner-scoped SQL/API read.
      const {data:confirmed,error:readError}=await supabase.from('taxpay_payment_requests').select('id,request_status,processing_mode').eq('id',data.id).eq('owner_uid',authenticatedUserId).single();
      if(readError||confirmed?.request_status!=='SUBMITTED_FOR_REVIEW'||confirmed?.processing_mode!=='NON_FINANCIAL_REVIEW')throw new Error('Server read-back not confirmed');
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Submission failed');}finally{setBusy(null);}
  };
  const markRead=async(notice:Notice)=>{
    if(!supabase)return;setBusy(notice.id);setError('');
    try{
      const {data:identity}=await supabase.auth.getUser();
      if(identity.user?.id!==authenticatedUserId)throw new Error('Session changed');
      const {error:updateError}=await supabase.from('taxpay_in_app_notifications').update({is_read:true}).eq('id',notice.id);
      if(updateError)throw updateError;
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Update failed');}finally{setBusy(null);}
  };
  const names:Record<string,[string,string]>={SUBMITTED_FOR_REVIEW:['Submitted for officer review','কর্মকর্তার পর্যালোচনার জন্য জমা'],ACKNOWLEDGED:['Officer acknowledged','কর্মকর্তা গ্রহণ করেছেন'],INFO_REQUESTED:['More information requested','অতিরিক্ত তথ্য চাওয়া হয়েছে'],REVIEW_CLOSED:['Review closed','পর্যালোচনা সমাপ্ত'],OFFICER_NEW_REQUEST:['Review request received','নতুন রিভিউ অনুরোধ এসেছে'],REQUEST_SUBMITTED:['Review request submitted','রিভিউ অনুরোধ জমা হয়েছে'],REQUEST_ACKNOWLEDGED:['Officer acknowledged the request','কর্মকর্তা অনুরোধটি গ্রহণ করেছেন'],REQUEST_INFO_REQUESTED:['Officer requested additional information','কর্মকর্তা আরও তথ্য চেয়েছেন'],REQUEST_REVIEW_CLOSED:['Officer completed the review','কর্মকর্তা পর্যালোচনা শেষ করেছেন']};
  const label=(key:string)=>names[key]?.[bn?1:0]||key;
  const submittedIds=new Set(requests.map(r=>r.source_draft_id));
  return <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4" aria-label={text('Shared review requests','রিভিউ অনুরোধ')}>
    <header className="space-y-2">
      <h2 className="font-serif-fraunces text-xl font-bold text-emerald-950">{text('Officer review requests','কর্মকর্তার রিভিউ অনুরোধ')}</h2>
      <p className="text-sm text-slate-600">{text('Submit a saved plan for non-financial review. This does not make a payment, transfer funds, issue a challan or create a tax credit.','সংরক্ষিত পরিকল্পনা অ-আর্থিক পর্যালোচনার জন্য পাঠান। এতে অর্থ পরিশোধ, স্থানান্তর, চালান বা কর ক্রেডিট তৈরি হয় না।')}</p>
      <button type="button" className="min-h-11 border rounded-lg px-4 py-2 text-sm font-semibold" onClick={()=>setRevision(v=>v+1)}>{text('Refresh status','অবস্থা হালনাগাদ')}</button>
    </header>
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    {!loaded?<p role="status">{text('Loading review requests…','রিভিউ অনুরোধ লোড হচ্ছে…')}</p>:<>
      <div className="space-y-2"><h3 className="font-semibold">{text('Saved plans ready for review','পর্যালোচনার জন্য প্রস্তুত পরিকল্পনা')}</h3>
        {drafts.length===0?<p className="text-sm">{text('Save a private draft first.','আগে ব্যক্তিগত খসড়া সংরক্ষণ করুন।')}</p>:<ul className="divide-y">{drafts.filter(d=>d.owner_uid===authenticatedUserId).map(d=><li key={d.id} className="py-3 flex flex-wrap gap-3 justify-between items-center"><p className="text-sm"><span className="taxpay-service-value" data-payment-service={d.category}>{d.category}</span> · {d.assessment_year} · ৳ {formatBdtMinorUnits(d.amount_minor,language)}</p><button type="button" disabled={busy!==null||submittedIds.has(d.id)} onClick={()=>void submit(d)} className="min-h-11 border border-emerald-800 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">{submittedIds.has(d.id)?text('Already submitted','ইতোমধ্যে জমা'):busy===d.id?text('Submitting…','জমা হচ্ছে…'):text('Send for review','পর্যালোচনার জন্য পাঠান')}</button></li>)}</ul>}
      </div>
      <div className="space-y-2"><h3 className="font-semibold">{text('Request status','অনুরোধের অবস্থা')}</h3>
        {requests.length===0?<p className="text-sm">{text('No review requests yet.','এখনো কোনো রিভিউ অনুরোধ নেই।')}</p>:<ul className="divide-y">{requests.map(r=><li key={r.id} className="py-3"><p className="font-semibold text-sm break-all">{r.id}</p><p className="text-sm"><span className="taxpay-service-value" data-payment-service={r.category}>{r.category}</span> · {r.assessment_year} · {label(r.request_status)}</p><p className="text-xs text-slate-600">{text('Financial receipt: unverified · Tax credit: unverified','আর্থিক রসিদ: যাচাই হয়নি · কর ক্রেডিট: যাচাই হয়নি')}</p></li>)}</ul>}
      </div>
      <div className="space-y-2"><h3 className="font-semibold">{text('In-app notifications','অ্যাপের বিজ্ঞপ্তি')}</h3>
        {notices.length===0?<p className="text-sm">{text('No updates yet.','এখনো কোনো হালনাগাদ নেই।')}</p>:<ul className="divide-y">{notices.map(n=><li key={n.id} className="py-2 flex flex-wrap justify-between gap-2"><div><p className="text-sm">{label(n.message_code)}</p><p className="text-xs text-slate-500 break-all">{n.request_id}</p></div>{!n.is_read&&<button type="button" disabled={busy!==null} onClick={()=>void markRead(n)} className="min-h-11 px-3 border rounded-lg text-sm">{text('Mark read','পড়া হয়েছে')}</button>}</li>)}</ul>}
      </div>
    </>}
  </section>;
}
