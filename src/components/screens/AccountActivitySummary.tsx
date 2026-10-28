import React, {useEffect, useState} from 'react';
import {supabase} from '../../services/supabaseClient';
import {checkedOwnerRecordCount, type AccountActivityCounts} from '../../services/accountActivityCounts';

type Props = {
  ownerUid: string;
  language: 'en'|'bn';
  onNavigate: (route:'secure_workspace'|'corrections')=>void;
};
type State = {ownerUid:string|null;phase:'loading'|'ready'|'error';counts:AccountActivityCounts|null};
const initial:State={ownerUid:null,phase:'loading',counts:null};

/**
 * Auth-UID-owned NON-FINANCIAL workflow counts. No e-TIN binding is required.
 * Never use these records to imply a payment, assessed demand or tax credit.
 */
export const AccountActivitySummary:React.FC<Props>=({ownerUid,language,onNavigate})=>{
  const [state,setState]=useState<State>(initial);
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  useEffect(()=>{
    let active=true;
    setState({ownerUid,phase:'loading',counts:null});
    const run=async()=>{
      if(!supabase)throw Error('Account records unavailable');
      const {data:before,error:beforeError}=await supabase.auth.getUser();
      if(beforeError||before.user?.id!==ownerUid)throw Error('Account session changed');
      const [drafts,requests,corrections]=await Promise.all([
        supabase.from('taxpay_payment_drafts').select('id',{count:'exact',head:true}).eq('owner_uid',ownerUid),
        supabase.from('taxpay_payment_requests').select('id',{count:'exact',head:true}).eq('owner_uid',ownerUid),
        supabase.from('taxpay_correction_inquiries').select('inquiry_id',{count:'exact',head:true}).eq('requester_uid',ownerUid)
      ]);
      if(drafts.error||requests.error||corrections.error)throw Error('Unable to load account records');
      const {data:after,error:afterError}=await supabase.auth.getUser();
      if(afterError||after.user?.id!==ownerUid)throw Error('Account session changed');
      const counts:AccountActivityCounts={
        drafts:checkedOwnerRecordCount(drafts.count),
        reviewRequests:checkedOwnerRecordCount(requests.count),
        correctionInquiries:checkedOwnerRecordCount(corrections.count)
      };
      if(active)setState({ownerUid,phase:'ready',counts});
    };
    void run().catch(()=>{if(active)setState({ownerUid,phase:'error',counts:null})});
    return()=>{active=false;};
  },[ownerUid]);
  const visible=state.ownerUid===ownerUid?state:{ownerUid,phase:'loading' as const,counts:null};
  const items=[
    {id:'drafts',label:tr('Saved payment drafts','সংরক্ষিত পরিশোধ খসড়া'),count:visible.counts?.drafts,route:'secure_workspace' as const},
    {id:'review',label:tr('Submitted non-financial reviews','জমা দেওয়া অ-আর্থিক পর্যালোচনা'),count:visible.counts?.reviewRequests,route:'secure_workspace' as const},
    {id:'corrections',label:tr('Correction inquiries','সংশোধনের অনুসন্ধান'),count:visible.counts?.correctionInquiries,route:'corrections' as const}
  ];
  return <section aria-labelledby="taxpay-owner-workflow-title" data-testid="account-workflow-summary"
    className="rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5">
    <h2 id="taxpay-owner-workflow-title" className="text-base font-semibold text-taxpay-text">
      {tr('My account activity', 'আমার অ্যাকাউন্টের কার্যক্রম')}
    </h2>
    <p className="mt-1 text-sm text-taxpay-muted">
      {tr('These are private application records, not completed payments, Treasury settlements, assessed liabilities or tax credits.',
        'এগুলো ব্যক্তিগত অ্যাপ্লিকেশন রেকর্ড; সম্পন্ন পরিশোধ, ট্রেজারি নিষ্পত্তি, নির্ধারিত করদায় বা কর ক্রেডিট নয়।')}
    </p>
    {visible.phase==='loading'&&<p className="mt-4 text-sm text-taxpay-muted" role="status">
      {tr('Loading account activity…','অ্যাকাউন্টের কার্যক্রম লোড হচ্ছে…')}</p>}
    {visible.phase==='error'&&<p className="mt-4 text-sm text-taxpay-error" role="alert">
      {tr('Account activity could not be verified. No totals are shown.', 'অ্যাকাউন্টের কার্যক্রম যাচাই করা যায়নি। কোনো সংখ্যা দেখানো হচ্ছে না।')}</p>}
    {visible.phase==='ready'&&visible.counts&&<div className="mt-4 grid gap-3 sm:grid-cols-3">
      {items.map(item=><div key={item.id} className="flex min-w-0 flex-col rounded-xl border border-taxpay-border bg-slate-50 p-3">
        <p className="text-sm text-taxpay-muted">{item.label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-taxpay-text">{item.count?.toLocaleString(bn?'bn-BD':'en-BD')}</p>
        <button type="button" onClick={()=>onNavigate(item.route)}
          className="mt-3 min-h-11 self-start rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Open records','রেকর্ড দেখুন')}
        </button>
      </div>)}
    </div>}
  </section>;
};
