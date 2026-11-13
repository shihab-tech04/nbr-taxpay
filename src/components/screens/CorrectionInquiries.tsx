import React, {useEffect,useState} from 'react';
import {supabase} from '../../services/supabaseClient';
import {sameAuthenticatedOwner} from '../../services/secureWorkspacePolicy';
import {validateCorrectionInquiry, type ProposedAttributionField} from '../../services/correctionInquiryValidation';
import {UiButton,UiInput,UiTextarea,UiSelect} from '../ui/Controls';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';
import {useTaxState} from '../../services/taxState';

type Row=Readonly<{
 inquiry_id:string; original_reference:string; evidence_state:string; created_at:string;
 reason:string; requested_outcome:string; change_kind:ProposedAttributionField|null; old_value:string|null; new_value:string|null;
 office_review_state:string|null; office_review_revision:number|null; office_review_updated_at:string|null;
}>;
type Props={readonly authenticatedUserId:string;readonly language:'en'|'bn';readonly dashboard?:boolean};
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
 state:'Pending evidence — not an approved correction', focusedCase:'Opened the correction case linked from this notification.',
 focusedCaseUnavailable:'This correction case is not available to the signed-in account.',
 officeReview:'Office review status',
 officeReviewUpdated:'Last updated by Office',officeReviewRevision:'Review revision',
 officeReviewStates:{PENDING_OFFICER:'Waiting for Office review',MAKER_ACKNOWLEDGED:'Maker acknowledged',REVIEWER_VERIFIED:'Reviewer verified',APPROVER_CLOSED:'Review closed — no financial record changed',REJECTED:'Review rejected — no financial record changed'},
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
 state:'প্রমাণের অপেক্ষায় — অনুমোদিত সংশোধন নয়', focusedCase:'এই বিজ্ঞপ্তির সঙ্গে যুক্ত সংশোধন মামলাটি খোলা হয়েছে।',
 focusedCaseUnavailable:'এই সংশোধন মামলা সাইন-ইন করা অ্যাকাউন্টে পাওয়া যায়নি।',
 officeReview:'অফিস পর্যালোচনার অবস্থা',
 officeReviewUpdated:'অফিসের সর্বশেষ হালনাগাদ',officeReviewRevision:'পর্যালোচনা সংস্করণ',
 officeReviewStates:{PENDING_OFFICER:'অফিস পর্যালোচনার অপেক্ষায়',MAKER_ACKNOWLEDGED:'মেকার গ্রহণ করেছেন',REVIEWER_VERIFIED:'রিভিউয়ার যাচাই করেছেন',APPROVER_CLOSED:'পর্যালোচনা বন্ধ — আর্থিক রেকর্ড বদলায়নি',REJECTED:'পর্যালোচনা প্রত্যাখ্যাত — আর্থিক রেকর্ড বদলায়নি'},
 statusUnavailable:'অবস্থা অনুপলব্ধ',details:'অনুরোধের বিবরণ',reasonLabel:'প্রদত্ত কারণ',outcomeLabel:'অনুরোধের ফলাফল',
 changeLabel:'যাচাই না হওয়া পরিচিতি প্রস্তাব',oldValueLabel:'পূর্বের মান (যাচাই হয়নি)',newValueLabel:'অনুরোধের মান (যাচাই হয়নি)',
 changeKinds:{ASSESSMENT_YEAR:'করবর্ষ',CIRCLE:'কর সার্কেল',PAYMENT_HEAD:'কর খাত',ATTRIBUTION:'পরিশোধের পরিচিতি'},
 loading:'ব্যক্তিগত অনুসন্ধান লোড হচ্ছে…',retry:'অনুসন্ধান আবার লোড করুন',historyRefreshed:'ব্যক্তিগত অনুসন্ধানের ইতিহাস হালনাগাদ হয়েছে।'
 }
} as const;

export const CorrectionInquiries:React.FC<Props>=({authenticatedUserId,language,dashboard=false})=>{
 const labels=t[language];
 const {routeParams}=useTaxState();
 const candidateInquiryId=routeParams?.inquiryId;
 const selectedInquiryId=typeof candidateInquiryId==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateInquiryId)
   ?candidateInquiryId:null;
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
 const [historySearch,setHistorySearch]=useState('');
 const load=async(isActive:()=>boolean)=>{
  if(!supabase) throw new Error(labels.fail);
  const {data:who,error:idError}=await supabase.auth.getUser();
  if(idError||!sameAuthenticatedOwner(who.user?.id,authenticatedUserId))throw new Error(labels.auth);
  let {data,error}=await supabase.from('taxpay_correction_inquiries')
    .select('inquiry_id,original_reference,evidence_state,created_at,reason,requested_outcome,change_kind,old_value,new_value,office_review_state,office_review_revision,office_review_updated_at')
    .eq('requester_uid',authenticatedUserId).order('created_at',{ascending:false}).limit(50);
  if(error && (error.code==='42703'||error.code==='PGRST204') && /office_review_state/i.test(error.message)){
   const fallback=await supabase.from('taxpay_correction_inquiries')
    .select('inquiry_id,original_reference,evidence_state,created_at,reason,requested_outcome,change_kind,old_value,new_value')
    .eq('requester_uid',authenticatedUserId).order('created_at',{ascending:false}).limit(50);
   if(fallback.error)throw fallback.error;
   data=(fallback.data??[]).map(row=>({...row,office_review_state:null,office_review_revision:null,office_review_updated_at:null}));
   error=null;
  }
  if(error)throw error;
  let ownedRows=(data??[]) as Row[];
  if(selectedInquiryId&&!ownedRows.some(row=>row.inquiry_id===selectedInquiryId)){
   let focus=await supabase.from('taxpay_correction_inquiries')
    .select('inquiry_id,original_reference,evidence_state,created_at,reason,requested_outcome,change_kind,old_value,new_value,office_review_state,office_review_revision,office_review_updated_at')
    .eq('requester_uid',authenticatedUserId).eq('inquiry_id',selectedInquiryId).maybeSingle();
   if(focus.error&&(focus.error.code==='42703'||focus.error.code==='PGRST204')&&/office_review_state/i.test(focus.error.message)){
    const legacyFocus=await supabase.from('taxpay_correction_inquiries')
     .select('inquiry_id,original_reference,evidence_state,created_at,reason,requested_outcome,change_kind,old_value,new_value')
     .eq('requester_uid',authenticatedUserId).eq('inquiry_id',selectedInquiryId).maybeSingle();
    if(legacyFocus.error)throw legacyFocus.error;
    if(legacyFocus.data)ownedRows=[{...legacyFocus.data,office_review_state:null,office_review_revision:null,office_review_updated_at:null} as Row,...ownedRows];
   }else{
    if(focus.error)throw focus.error;
    if(focus.data)ownedRows=[focus.data as Row,...ownedRows];
   }
  }
  const {data:stillSignedIn,error:stillSignedInError}=await supabase.auth.getUser();
  if(stillSignedInError||!sameAuthenticatedOwner(stillSignedIn.user?.id,authenticatedUserId))throw new Error(labels.auth);
  if(isActive())setRows(ownedRows);
 };
 useEffect(()=>{
  let active=true;setRows([]);setLoading(true);setLoadError(false);
  const refresh=()=>load(()=>active).catch(()=>{if(active){setMessage(labels.fail);setLoadError(true)}})
   .finally(()=>{if(active)setLoading(false)});
  void refresh();
  const timer=window.setInterval(()=>void refresh(),15000);
  return ()=>{active=false;window.clearInterval(timer);};
 },[authenticatedUserId,selectedInquiryId]);
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
 const needle=historySearch.trim().toLocaleLowerCase();
 const matchingRows=rows.filter(r=>(!selectedInquiryId||r.inquiry_id===selectedInquiryId)&&(!needle || [r.original_reference,r.reason,r.requested_outcome,r.evidence_state,
  r.office_review_state??''].some(value=>value.toLocaleLowerCase().includes(needle))));
 const focusedCaseExists=selectedInquiryId!==null&&rows.some(row=>row.inquiry_id===selectedInquiryId);
 const form=<form onSubmit={submit} className="space-y-4">
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
  </form>;
 return <section id={dashboard?'dashboard-correction-requests':undefined} tabIndex={dashboard?-1:undefined}
  className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5" aria-labelledby="inquiry-title">
  <header className="space-y-2">
   <h2 id="inquiry-title" className="text-xl font-semibold text-taxpay-text">{dashboard?(language==='bn'?'সংশোধনের আবেদন':'Correction Requests'):labels.title}</h2>
   <p className="text-sm leading-6 text-taxpay-muted">{dashboard?(language==='bn'?'আপনার নিজের অ্যাকাউন্টের আবেদন, কারণ ও পর্যালোচনার অবস্থা এখানে দেখুন।':'View your account-linked requests, reasons and current review statuses here.'):labels.intro}</p>
  </header>
  {!dashboard && form}
  {message&&<p role="status" aria-live="polite" className="rounded-lg border border-slate-300 p-3 text-sm break-words">{message}</p>}
  <section aria-labelledby="inquiry-history-title" className="space-y-3">
   <h3 id="inquiry-history-title" className="text-lg font-semibold text-taxpay-text">{labels.history}</h3>
   {selectedInquiryId&&<p role={focusedCaseExists?'status':'alert'} data-testid="notification-focused-correction-case">
    {focusedCaseExists?labels.focusedCase:!loading?labels.focusedCaseUnavailable:labels.loading}</p>}
   {loading?<p role="status">{labels.loading}</p>:
    loadError?<div className="space-y-2"><p className="text-sm text-amber-900">{labels.fail}</p>
      <UiButton type="button" onClick={retryLoad}>{labels.retry}</UiButton></div>:
    rows.length===0?<p className="text-sm text-slate-600">{labels.empty}</p>:
    <div className="space-y-3" data-testid="authenticated-correction-register">
      <TaxPayTableControls className="taxpay-record-page-filters">
        <label className="taxpayer-transaction-filter">
          <span>{language==='bn'?'অনুসন্ধান খুঁজুন':'Search review inquiries'}</span>
          <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-base"
            aria-label={language==='bn'?'অনুসন্ধান খুঁজুন':'Search review inquiries'}
            placeholder={language==='bn'?'রেফারেন্স বা কারণ খুঁজুন':'Find reference, reason or status'}
            value={historySearch} onChange={event=>setHistorySearch(event.target.value)}/>
        </label>
        {historySearch&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
          onClick={()=>setHistorySearch('')}>{language==='bn'?'অনুসন্ধান মুছুন':'Clear search'}</button>}
      </TaxPayTableControls>
      <TaxPayTableCounter label={language==='bn'?'অনুসন্ধান':'Inquiries'} shown={matchingRows.length} total={rows.length}/>
      {matchingRows.length===0?<TaxPayTableState>{language==='bn'?'কোনো মিল পাওয়া যায়নি।':'No review inquiries match this search.'}</TaxPayTableState>:
        <TaxPayDataGrid variant="tabular" rows={matchingRows} getRowKey={r=>r.inquiry_id}
          ariaLabel={labels.history} testId="authenticated-correction-inquiry-table" mobileTestId="authenticated-correction-inquiry-cards"
          columns={[
            {key:'reference',header:language==='bn'?'রেফারেন্স':'Reference',renderCell:r=><div>
              <p className="break-all font-semibold text-taxpay-text">{r.original_reference} — {r.evidence_state==='PENDING_EVIDENCE'?labels.state:labels.statusUnavailable}</p>
              <time dateTime={r.created_at} className="text-sm text-taxpay-muted">{r.created_at}</time>
            </div>},
            {key:'reason',header:language==='bn'?'অনুরোধের কারণ':'Recorded reason',renderCell:r=><p className="line-clamp-2 break-words text-taxpay-text">{r.reason}</p>},
            {key:'status',header:labels.officeReview,renderCell:r=><div aria-live="polite" aria-atomic="true">
              <p className="font-semibold text-taxpay-text">{labels.officeReviewStates[r.office_review_state as keyof typeof labels.officeReviewStates]??labels.statusUnavailable}</p>
              {r.office_review_revision!==null&&<p className="text-sm text-taxpay-muted">{labels.officeReviewRevision}: {r.office_review_revision}</p>}
              {r.office_review_updated_at&&<p className="text-sm text-taxpay-muted">{labels.officeReviewUpdated}: {r.office_review_updated_at}</p>}
            </div>},
            {key:'action',header:language==='bn'?'বিস্তারিত':'Details',renderCell:r=><details className="min-w-0 rounded-lg border border-taxpay-border p-3">
              <summary className="min-h-11 cursor-pointer font-semibold text-taxpay-primary">{labels.details}</summary>
              <div className="mt-2 space-y-2 break-words text-sm text-taxpay-text">
                <p>{labels.reasonLabel}: {r.reason}</p>
                <p>{labels.outcomeLabel}: {r.requested_outcome}</p>
                {r.change_kind&&<div className="space-y-1 border-t border-taxpay-border pt-2">
                  <p className="font-semibold">{labels.changeLabel}: {labels.changeKinds[r.change_kind]}</p>
                  <p>{labels.oldValueLabel}: {r.old_value}</p>
                  <p>{labels.newValueLabel}: {r.new_value}</p>
                </div>}
              </div>
            </details>}
          ]}/>}
    </div>}
  </section>
  {dashboard && <details className="rounded-lg border border-taxpay-border p-3" data-testid="dashboard-new-correction-request">
   <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-taxpay-primary">
     {language==='bn'?'নতুন সংশোধনের আবেদন করুন':'New correction request'}
   </summary>
   <p className="mb-3 mt-2 text-sm text-taxpay-muted">{labels.intro}</p>
   {form}
  </details>}
 </section>;
};
