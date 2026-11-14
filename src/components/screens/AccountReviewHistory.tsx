import React, {useEffect,useState} from 'react';
import {supabase} from '../../services/supabaseClient';
import {useTaxState} from '../../services/taxState';
import {TaxpayerActivityTabs,TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {formattedReviewAmount,safeReviewStatus} from '../../services/accountReviewHistory';
import {AccountBeneficiaryHistory} from './AccountBeneficiaryHistory';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter,TaxPayActiveFilterChips} from '../ui/TaxPayDataTable';

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
  const [search,setSearch]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [selectedYear,setSelectedYear]=useState('all');
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
  const needle=search.trim().toLocaleLowerCase();
  const years=[...new Set(state.rows.map(row=>row.assessment_year))].filter(Boolean).sort((a,b)=>b.localeCompare(a));
  const visible=state.rows.filter(row=>(selectedYear==='all'||row.assessment_year===selectedYear)&&
    (!needle||[row.id,row.category,row.assessment_year,row.request_status].some(value=>value.toLocaleLowerCase().includes(needle))));
  const formatDate=(raw:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-BD',{dateStyle:'medium'}).format(new Date(raw));

  return <div className="mx-auto max-w-7xl space-y-4 pb-12">
    <TaxpayerPageHeading title={tr('My submitted requests','আমার জমা দেওয়া অনুরোধ')}
      description={tr('Account-owned, non-financial payment review activity. No TIN binding required.',
        'অ্যাকাউন্টভিত্তিক অ-আর্থিক পরিশোধ পর্যালোচনা। টিআইএন সংযোগের প্রয়োজন নেই।')} />
    {activityTabs && <TaxpayerActivityTabs />}
    <AccountBeneficiaryHistory ownerUid={ownerUid} language={language}/>
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
      {state.status==='ready'&&state.rows.length>0&&<div className="mt-4 space-y-3" data-testid="account-owner-review-history">
        <TaxPayOfficeRegisterToolbar title={tr('Submitted request history','জমা দেওয়া অনুরোধের ইতিহাস')}
          count={visible.length} total={state.rows.length} countLabel={tr('records','রেকর্ড')}
          searchValue={search} onSearchChange={setSearch}
          searchLabel={tr('Search requests','অনুরোধ খুঁজুন')}
          searchPlaceholder={tr('Reference, service or status','রেফারেন্স, সেবা বা অবস্থা')}
          filtersOpen={filtersOpen} onToggleFilters={()=>setFiltersOpen(open=>!open)}
          filterLabel={tr('Filter','ফিল্টার')}/>
        <TaxPayOfficeRegisterFilters open={filtersOpen}>
          <label className="taxpayer-transaction-filter">
            <span>{tr('Assessment year','করবর্ষ')}</span>
            <select value={selectedYear} onChange={event=>setSelectedYear(event.target.value)}
              aria-label={tr('Filter requests by year','করবর্ষ অনুযায়ী অনুরোধ ফিল্টার করুন')}
              className="min-h-11 w-full min-w-0 rounded-lg border border-taxpay-border bg-white px-3 text-base">
              <option value="all">{tr('All years','সব করবর্ষ')}</option>
              {years.map(year=><option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          {(search||selectedYear!=='all')&&<button type="button"
            className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>{setSearch('');setSelectedYear('all');}}>{tr('Clear filters','ফিল্টার মুছুন')}</button>}
        </TaxPayOfficeRegisterFilters>
        <TaxPayActiveFilterChips clearLabel={tr('Clear all','সব ফিল্টার মুছুন')}
          onClear={()=>{setSearch('');setSelectedYear('all');}}
          filters={[
            ...(search.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+search.trim(),onRemove:()=>setSearch('')}]:[]),
            ...(selectedYear!=='all'?[{key:'year',label:selectedYear,onRemove:()=>setSelectedYear('all')}]:[])
          ]}/>
        {visible.length===0?<TaxPayTableState>{tr('No submitted requests match those filters.','এই ফিল্টারে কোনো অনুরোধ মেলেনি।')}</TaxPayTableState>:
          <TaxPayDataGrid variant="tabular" rows={visible} getRowKey={row=>row.id}
            ariaLabel={tr('Submitted request register','জমা দেওয়া অনুরোধের তালিকা')}
            testId="account-owner-review-table" mobileTestId="account-owner-review-mobile-cards" className="taxpay-convay-signed-in-table"
            columns={[
              {key:'category',header:tr('Service / reference','সেবা / রেফারেন্স'),renderCell:row=><div>
                <p className="font-semibold">{row.category.replaceAll('_',' ')}</p>
                <p className="break-all font-mono-plex text-sm text-taxpay-muted">{row.id}</p>
              </div>},
              {key:'year',header:tr('Assessment year','করবর্ষ'),renderCell:row=><p>{row.assessment_year}</p>},
              {key:'amount',header:tr('Requested amount (not paid)','অনুরোধের পরিমাণ (পরিশোধ নয়)'),
                headerClassName:'text-right',cellClassName:'text-right tabular-nums',
                renderCell:row=><p className="font-semibold">{formattedReviewAmount(row.amount_minor,language)}</p>},
              {key:'status',header:tr('Review status','পর্যালোচনার অবস্থা'),
                renderCell:row=><p className="font-semibold text-taxpay-text">{statuses[safeReviewStatus(row.request_status)][language]}</p>},
              {key:'submitted',header:tr('Submitted / verification','জমা / যাচাই'),renderCell:row=><div>
                <time dateTime={row.submitted_at} className="block">{formatDate(row.submitted_at)}</time>
                <p className="text-sm text-taxpay-muted">{tr('Financial status: Not verified','আর্থিক অবস্থা: যাচাই হয়নি')}</p>
              </div>}
            ]}/>}
        <TaxPayOfficeRegisterFooter shown={visible.length} total={state.rows.length}
          labels={{showing:tr('Showing','দেখানো হচ্ছে'),of:tr('of','মোট'),records:tr('records','রেকর্ড')}}/>
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={()=>navigate('secure_workspace')} className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Saved drafts & review workspace','সংরক্ষিত খসড়া ও পর্যালোচনা')}</button>
        <button type="button" onClick={()=>navigate('corrections')} className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Correction inquiries','সংশোধনের অনুসন্ধান')}</button>
      </div>
    </section>
  </div>;
};
