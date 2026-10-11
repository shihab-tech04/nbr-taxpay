import React, {useEffect,useState} from 'react';
import {supabase} from '../../services/supabaseClient';
import {sameAuthenticatedOwner} from '../../services/secureWorkspacePolicy';
import {validateCorrectionInquiry, type ProposedAttributionField} from '../../services/correctionInquiryValidation';
import {UiButton,UiInput,UiTextarea,UiSelect} from '../ui/Controls';

type Row=Readonly<{
 inquiry_id:string; original_reference:string; evidence_state:string; created_at:string;
 reason:string; requested_outcome:string; change_kind:ProposedAttributionField|null; old_value:string|null; new_value:string|null;
}>;
type Props={readonly authenticatedUserId:string;readonly language:'en'|'bn'};
const t={
 en:{
 title:'Request a review of an original reference',
 intro:'Private, unverified inquiry only. This does not open a financial correction case or change a payment, challan, withholding credit or ledger.',
 ref:'Original receipt or payment reference (user supplied, not verified)',
 reason:'Reason for requesting a correction review',
 outcome:'What outcome are you requesting?',
 select:'Proposed attribution field (optional)', none:'No attribution change', old:'Original value (user supplied)', newValue:'Requested value (unverified)',
 submit:'Save evidence-pending inquiry',
 saved:'Inquiry saved. Claimant and receipt ownership remain unverified; no financial correction was performed.',
 savedHistoryFail:'Inquiry saved, but its private history could not be refreshed. Retry to confirm its status.',
 fail:'Unable to save or load inquiry. No financial record changed.',
 auth:'Your authenticated session does not match the requester.',
 history:'My review inquiries',
 empty:'No correction inquiries for this account.',
 state:'Pending evidence — not an approved correction',
 statusUnavailable:'Status unavailable',details:'Request details',reasonLabel:'Reason provided',outcomeLabel:'Requested outcome',
 changeLabel:'Unverified attribution proposal',oldValueLabel:'Previous value (unverified)',newValueLabel:'Requested value (unverified)',
 changeKinds:{ASSESSMENT_YEAR:'Assessment year',CIRCLE:'Circle',PAYMENT_HEAD:'Payment head',ATTRIBUTION:'Payment attribution'},
 loading:'Loading private inquiries…',retry:'Retry loading inquiries',historyRefreshed:'Private inquiry history refreshed.'
 },
 bn:{
 title:'মূল রেফারেন্স পর্যালোচনার অনুরোধ',
 intro:'শুধু ব্যক্তিগত যাচাইবিহীন অনুসন্ধান। এটি আর্থিক সংশোধনী মামলা নয়; অর্থ পরিশোধ, চালান বা লেজার ক্রেডিট পরিবর্তন করে না।',
 ref:'মূল রসিদ/পরিশোধ রেফারেন্স (নিজের দেওয়া, যাচাই হয়নি)',
 reason:'সংশোধন পর্যালোচনার কারণ',
 outcome:'কী ফলাফল চান?',
 select:'পরিবর্তনের ক্ষেত্র (ঐচ্ছিক)', none:'পরিশোধের তথ্য পরিবর্তনের অনুরোধ নেই',old:'পূর্বের তথ্য (নিজের দেওয়া)', newValue:'প্রস্তাবিত তথ্য (যাচাই হয়নি)',
 submit:'প্রমাণের অপেক্ষায় থাকা অনুসন্ধান সংরক্ষণ করুন',
 saved:'অনুসন্ধান সংরক্ষিত। দাবিদার ও রসিদের মালিকানা যাচাই হয়নি; কোনো আর্থিক সংশোধন হয়নি।',
 savedHistoryFail:'অনুসন্ধান সংরক্ষিত হয়েছে, কিন্তু ব্যক্তিগত ইতিহাস নতুন করে লোড করা যায়নি। অবস্থা নিশ্চিত করতে আবার চেষ্টা করুন।',
 fail:'অনুসন্ধান সংরক্ষণ বা লোড সম্ভব নয়। আর্থিক তথ্য বদলায়নি।',
 auth:'সাইন-ইন করা অ্যাকাউন্ট ও আবেদনকারী মিলতে হবে।',
 history:'আমার পর্যালোচনার অনুসন্ধান',
 empty:'এই অ্যাকাউন্টে কোনো অনুসন্ধান নেই।',
 state:'প্রমাণের অপেক্ষায় — অনুমোদিত সংশোধন নয়',
 statusUnavailable:'অবস্থা অনুপলব্ধ',details:'অনুরোধের বিবরণ',reasonLabel:'প্রদত্ত কারণ',outcomeLabel:'অনুরোধের ফলাফল',
 changeLabel:'যাচাই না হওয়া পরিচিতি প্রস্তাব',oldValueLabel:'পূর্বের মান (যাচাই হয়নি)',newValueLabel:'অনুরোধের মান (যাচাই হয়নি)',
 changeKinds:{ASSESSMENT_YEAR:'করবর্ষ',CIRCLE:'কর সার্কেল',PAYMENT_HEAD:'কর খাত',ATTRIBUTION:'পরিশোধের পরিচিতি'},
 loading:'ব্যক্তিগত অনুসন্ধান লোড হচ্ছে…',retry:'অনুসন্ধান আবার লোড করুন',historyRefreshed:'ব্যক্তিগত অনুসন্ধানের ইতিহাস হালনাগাদ হয়েছে।'
 }
} as const;

export const CorrectionInquiries:React.FC<Props>=({authenticatedUserId,language})=>{
 const labels=t[language];
 const [originalReference,setOriginalReference]=useState('');
 const [reason,setReason]=useState('');
 const [desiredOutcome,setDesiredOutcome]=useState('');
 const [changeKind,setChangeKind]=useState<ProposedAttributionField|''>('');
 const [previousValue,setPreviousValue]=useState('');
 const [proposedValue,setProposedValue]=useState('');
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [rows,setRows]=useState<readonly Row[]>([]);
 const load=async(isActive:()=>boolean)=>{
  if(!supabase) throw new Error(labels.fail);
  const {data:who,error:idError}=await supabase.auth.getUser();
  if(idError||!sameAuthenticatedOwner(who.user?.id,authenticatedUserId))throw new Error(labels.auth);
  const {data,error}=await supabase.from('taxpay_correction_inquiries')
    .select('inquiry_id,original_reference,evidence_state,created_at,reason,requested_outcome,change_kind,old_value,new_value')
    .eq('requester_uid',authenticatedUserId).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  if(isActive())setRows((data??[]) as Row[]);
 };
 useEffect(()=>{
  let active=true;setRows([]);setLoading(true);setLoadError(false);
  load(()=>active).catch(()=>{if(active){setMessage(labels.fail);setLoadError(true)}})
   .finally(()=>{if(active)setLoading(false)});
  return ()=>{active=false;};
 },[authenticatedUserId]);
 const retryLoad=async()=>{
  if(loading)return;
  setLoading(true);setLoadError(false);setMessage('');
  try{await load(()=>true);setMessage(labels.historyRefreshed)}
  catch{setLoadError(true);setMessage(labels.fail)}
  finally{setLoading(false)}
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!supabase||busy)return;
  const change=changeKind?{field:changeKind,previousValue,proposedValue}:null;
  const checked=validateCorrectionInquiry({originalReference,reason,desiredOutcome,change});
  if(checked.error){setMessage(checked.error);return;}
  setBusy(true);setMessage('');
  let persisted=false;
  try{
   const {data:who,error:idError}=await supabase.auth.getUser();
   if(idError||!sameAuthenticatedOwner(who.user?.id,authenticatedUserId)){setMessage(labels.auth);return;}
   const {error}=await supabase.from('taxpay_correction_inquiries').insert({
     requester_uid:authenticatedUserId,
     original_reference:originalReference.trim(),
     reason:reason.trim(),
     requested_outcome:desiredOutcome.trim(),
     ...(change ? {change_kind:change.field,old_value:change.previousValue.trim(),new_value:change.proposedValue.trim()}: {})
   });
   if(error){setMessage(labels.fail);return;}
   persisted=true;
   setOriginalReference('');setReason('');setDesiredOutcome('');setChangeKind('');setPreviousValue('');setProposedValue('');
   try{await load(()=>true);setLoadError(false)}
   catch{setLoadError(true);setMessage(labels.savedHistoryFail);return;}
   setMessage(labels.saved);
  }catch{if(persisted){setLoadError(true);setMessage(labels.savedHistoryFail)}else setMessage(labels.fail)}finally{setBusy(false);}
 };
 return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5" aria-labelledby="inquiry-title">
  <header className="space-y-2">
   <h2 id="inquiry-title" className="font-serif-fraunces text-xl font-bold text-emerald-950">{labels.title}</h2>
   <p className="text-sm text-amber-900">{labels.intro}</p>
  </header>
  <form onSubmit={submit} className="space-y-4">
   <label className="block text-sm font-semibold text-slate-800">{labels.ref}
    <UiInput required minLength={6} maxLength={80} value={originalReference} onChange={e=>setOriginalReference(e.target.value)}
     className="mt-2" placeholder="e.g. TPAY-REF-123456" autoComplete="off"/>
   </label>
   <label className="block text-sm font-semibold text-slate-800">{labels.reason}
    <UiTextarea required minLength={10} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2"/>
   </label>
   <label className="block text-sm font-semibold text-slate-800">{labels.outcome}
    <UiTextarea required minLength={10} maxLength={600} rows={3} value={desiredOutcome} onChange={e=>setDesiredOutcome(e.target.value)} className="mt-2"/>
   </label>
   <label className="block text-sm font-semibold text-slate-800">{labels.select}
    <UiSelect value={changeKind} onChange={e=>{setChangeKind(e.target.value as ProposedAttributionField|'');setPreviousValue('');setProposedValue('');}} className="mt-2">
     <option value="">{labels.none}</option>
     <option value="ASSESSMENT_YEAR">{language==='bn'?'করবর্ষ':'Assessment year'}</option>
     <option value="CIRCLE">{language==='bn'?'কর সার্কেল':'Circle'}</option>
     <option value="PAYMENT_HEAD">{language==='bn'?'কর খাত':'Payment head'}</option>
     <option value="ATTRIBUTION">{language==='bn'?'পরিশোধের পরিচিতি':'Payment attribution'}</option>
    </UiSelect>
   </label>
   {changeKind&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <label className="block text-sm font-semibold text-slate-800">{labels.old}
     <UiInput required maxLength={120} value={previousValue} onChange={e=>setPreviousValue(e.target.value)} className="mt-2"/>
    </label>
    <label className="block text-sm font-semibold text-slate-800">{labels.newValue}
     <UiInput required maxLength={120} value={proposedValue} onChange={e=>setProposedValue(e.target.value)} className="mt-2"/>
    </label>
   </div>}
   <UiButton type="submit" disabled={busy}>{labels.submit}</UiButton>
  </form>
  {message&&<p role="status" aria-live="polite" className="rounded-lg border border-slate-300 p-3 text-sm break-words">{message}</p>}
  <section aria-labelledby="inquiry-history-title" className="space-y-3">
   <h3 id="inquiry-history-title" className="font-serif-fraunces text-lg font-bold">{labels.history}</h3>
   {loading?<p role="status">{labels.loading}</p>:loadError?<div className="space-y-2"><p className="text-sm text-amber-900">{labels.fail}</p><UiButton type="button" onClick={retryLoad}>{labels.retry}</UiButton></div>:rows.length===0?<p className="text-sm text-slate-600">{labels.empty}</p>:
    <ul className="divide-y divide-slate-200">{rows.map(r=><li key={r.inquiry_id} className="py-3">
     <p className="text-sm font-semibold text-slate-900 break-words">{r.original_reference} — {r.evidence_state==='PENDING_EVIDENCE'?labels.state:labels.statusUnavailable}</p>
     <p className="text-xs text-slate-600">{r.created_at}</p>
     <details className="mt-2 rounded-lg border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-emerald-900">{labels.details}</summary>
      <div className="mt-3 space-y-2 break-words text-sm text-slate-700">
       <p><span className="font-semibold">{labels.reasonLabel}: </span>{r.reason}</p>
       <p><span className="font-semibold">{labels.outcomeLabel}: </span>{r.requested_outcome}</p>
       {r.change_kind&&<div className="space-y-1 border-t border-slate-200 pt-2">
        <p className="font-semibold">{labels.changeLabel}: {labels.changeKinds[r.change_kind]}</p>
        <p><span className="font-semibold">{labels.oldValueLabel}: </span>{r.old_value}</p>
        <p><span className="font-semibold">{labels.newValueLabel}: </span>{r.new_value}</p>
       </div>}
      </div>
     </details>
    </li>)}</ul>}
  </section>
 </section>;
};
