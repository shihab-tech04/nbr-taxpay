import React, {useEffect,useState} from 'react';
import {supabase} from '../../services/supabaseClient';
import {useTaxState} from '../../services/taxState';
import {TaxpayerActivityTabs,TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {formattedReviewAmount,safeReviewStatus} from '../../services/accountReviewHistory';

type Row={
  id:string;owner_uid:string;category:string;assessment_year:string;
  amount_minor:string|number;request_status:string;financial_receipt_status:string;
  tax_credit_status:string;submitted_at:string;
};
type Snapshot={uid:string|null;status:'loading'|'ready'|'error';rows:Row[]};
const statuses={
  SUBMITTED_FOR_REVIEW:{en:'Submitted for review',bn:'পর্যালোচনার জন্য জমা'},
  OFFICER_ACKNOWLEDGED:{en:'Officer acknowledged',bn:'কর্মকর্তা গ্রহণ করেছেন'},
  INFO_REQUESTED:{en:'More information requested',bn:'অতিরিক্ত তথ্য চাওয়া হয়েছে'},
  CLOSED:{en:'Review closed',bn:'পর্যালোচনা বন্ধ'},
  UNVERIFIED:{en:'Status unavailable',bn:'অবস্থা পাওয়া যায়নি'}
} as const;
export const AccountReviewHistory:React.FC<{ownerUid:string;language:'en'|'bn';activityTabs?:boolean}>=
({ownerUid,language,activityTabs=false})=>{
  const {navigate}=useTaxState();
  const [snapshot,setSnapshot]=useState<Snapshot>({uid:null,status:'loading',rows:[]});
  const [retry,setRetry]=useState(0);
  const bn=language==='bn';
  const tr=(en:string,other:string)=>bn?other:en;
  useEffect(()=>{
    let active=true;
    setSnapshot({uid:ownerUid,status:'loading',rows:[]});
    const run=async()=>{
      if(!supabase)throw Error('Account backend is unavailable');
      const {data:before,error:firstError}=await supabase.auth.getUser();
      if(firstError||before.user?.id!==ownerUid)throw Error('Account identity changed');
      const {data,error}=await supabase.from('taxpay_payment_requests')
        .select('id,owner_uid,category,assessment_year,amount_minor,request_status,financial_receipt_status,tax_credit_status,submitted_at')
        .eq('owner_uid',ownerUid).order('submitted_at',{ascending:false}).limit(50);
      if(error)throw error;
      const {data:after,error:secondError}=await supabase.auth.getUser();
      if(secondError||after.user?.id!==ownerUid)throw Error('Account identity changed');
      const records=(data??[]) as Row[];
      if(records.some(row=>row.owner_uid!==ownerUid||typeof row.id!=='string'||!row.id||
        !Number.isFinite(Date.parse(row.submitted_at))))throw Error('Invalid owned request record');
      // Reject malformed money instead of showing a fake zero or rounded amount.
      records.forEach(row=>formattedReviewAmount(row.amount_minor,language));
      if(active)setSnapshot({uid:ownerUid,status:'ready',rows:records});
    };
    void run().catch(()=>{if(active)setSnapshot({uid:ownerUid,status:'error',rows:[]})});
    return()=>{active=false;};
  },[ownerUid,retry]);
  const state=snapshot.uid===ownerUid?snapshot:{uid:ownerUid,status:'loading' as const,rows:[]};
  return <div className="mx-auto max-w-5xl space-y-4 pb-12">
    <TaxpayerPageHeading title={tr('My submitted requests','আমার জমা দেওয়া অনুরোধ')}
      description={tr('Account-owned, non-financial payment review activity. No TIN binding required.',
        'অ্যাকাউন্টভিত্তিক অ-আর্থিক পরিশোধ পর্যালোচনা। টিআইএন সংযোগের প্রয়োজন নেই।')} />
    {activityTabs && <TaxpayerActivityTabs />}
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" aria-label={tr('Submitted request history','জমা দেওয়া অনুরোধের ইতিহাস')}>
      <p className="text-sm text-taxpay-muted">
        {tr('These are review requests, not payments or government receipts. No Treasury settlement, liability, credit, or tax balance is implied.',
          'এগুলো পর্যালোচনার অনুরোধ, অর্থ পরিশোধ বা সরকারি রসিদ নয়। ট্রেজারি নিষ্পত্তি, দায়, ক্রেডিট বা করের ব্যালেন্স বোঝায় না।')}
      </p>
      {state.status==='loading'&&<p role="status" className="mt-4 text-sm text-taxpay-muted">
        {tr('Loading my requests…','আমার অনুরোধ লোড হচ্ছে…')}</p>}
      {state.status==='error'&&<div role="alert" className="mt-4 space-y-2">
        <p className="text-sm text-taxpay-error">{tr('Unable to verify my request history.', 'আমার অনুরোধের ইতিহাস যাচাই করা যাচ্ছে না।')}</p>
        <button type="button" onClick={()=>setRetry(v=>v+1)} className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary">
          {tr('Try again','আবার চেষ্টা করুন')}</button>
      </div>}
      {state.status==='ready'&&state.rows.length===0&&<div role="status" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-taxpay-muted">
        {tr('No review requests have been submitted from this account.', 'এই অ্যাকাউন্ট থেকে কোনো পর্যালোচনা অনুরোধ জমা দেওয়া হয়নি।')}</div>}
      {state.status==='ready'&&state.rows.length>0&&<ul className="mt-4 space-y-3" data-testid="account-owner-review-history">
        {state.rows.map(row=><li key={row.id} className="rounded-xl border border-taxpay-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold text-taxpay-text">{row.category.replaceAll('_',' ')}</h2>
              <p className="mt-1 break-all text-xs text-taxpay-muted">{row.id}</p>
            </div>
            <p className="rounded-lg border border-taxpay-border bg-slate-50 px-2 py-1 text-xs font-medium text-taxpay-primary">
              {statuses[safeReviewStatus(row.request_status)][language]}</p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-taxpay-muted">{tr('Requested amount (not paid)','অনুরোধের পরিমাণ (পরিশোধ নয়)')}</dt>
              <dd className="font-semibold tabular-nums text-taxpay-text">{formattedReviewAmount(row.amount_minor,language)}</dd></div>
            <div><dt className="text-taxpay-muted">{tr('Assessment year','করবর্ষ')}</dt>
              <dd className="text-taxpay-text">{row.assessment_year}</dd></div>
            <div><dt className="text-taxpay-muted">{tr('Submitted','জমার তারিখ')}</dt>
              <dd className="text-taxpay-text"><time dateTime={row.submitted_at}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-BD',{dateStyle:'medium'}).format(new Date(row.submitted_at))}</time></dd></div>
            <div><dt className="text-taxpay-muted">{tr('Financial verification','আর্থিক যাচাই')}</dt>
              <dd className="font-medium text-taxpay-text">{tr('Not verified','যাচাই হয়নি')}</dd></div>
          </dl>
        </li>)}
      </ul>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={()=>navigate('secure_workspace')} className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Saved drafts & review workspace','সংরক্ষিত খসড়া ও পর্যালোচনা')}</button>
        <button type="button" onClick={()=>navigate('corrections')} className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Correction inquiries','সংশোধনের অনুসন্ধান')}</button>
      </div>
    </section>
  </div>;
};
