import React, {useEffect, useState} from 'react';
import {RefreshCcw} from 'lucide-react';
import {supabase} from '../../services/supabaseClient';
import {useAccountIdentity} from '../../services/accountIdentity';
import {ASSESSMENT_YEARS} from '../../data/mockData';
import {getDemoUser} from '../../data/demoUsers';
import {checkedOwnerRecordCount, type AccountActivityCounts} from '../../services/accountActivityCounts';
import {loadPrivateDashboardPaymentActivity} from '../../services/privateDashboardPayments';
import type {PrivateDashboardPaymentActivity} from '../../services/privateDashboardPayments';
import {simulationCategories, simulationCategoryLabels, type SimulationCategory, type SimulationUser} from '../../contracts/paymentSimulationContract';
import {filterPrivateDashboardTransactionsByYear, type DashboardSimulationTransaction} from '../../services/accountDashboardProjection';

type DashboardRoute = 'secure_workspace'|'corrections'|'account_notifications'|'account_profile'|'history'|'journey'|'ledger'|'certificates'|'beneficiaries'|'manage_authorization';
type Props = {
  ownerUid: string;
  language: 'en'|'bn';
  onNavigate: (route:DashboardRoute)=>void;
};
type State = {ownerUid:string|null;phase:'loading'|'ready'|'error';counts:AccountActivityCounts|null};
const initial:State={ownerUid:null,phase:'loading',counts:null};
type ScenarioState = {
  ownerUid:string|null;
  phase:'loading'|'linked'|'unlinked'|'error';
  profileId:SimulationUser|null;
  transactions:DashboardSimulationTransaction[];
};
const initialScenario:ScenarioState={ownerUid:null,phase:'loading',profileId:null,transactions:[]};

/**
 * Auth-UID-owned NON-FINANCIAL workflow counts. No e-TIN binding is required.
 * Never use these records to imply a payment, assessed demand or tax credit.
 */
export const AccountActivitySummary:React.FC<Props>=({ownerUid,language,onNavigate})=>{
  const [state,setState]=useState<State>(initial);
  const [scenario,setScenario]=useState<ScenarioState>(initialScenario);
  const [assessmentYear,setAssessmentYear]=useState('');
  const [revision,setRevision]=useState(0);
  const {user}=useAccountIdentity();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  useEffect(()=>{
    let active=true;
    setState({ownerUid,phase:'loading',counts:null});
    const run=async()=>{
      if(!supabase)throw Error('Account records unavailable');
      const {data:before,error:beforeError}=await supabase.auth.getUser();
      if(beforeError||before.user?.id!==ownerUid)throw Error('Account session changed');
      const [drafts,requests,corrections,notifications]=await Promise.all([
        supabase.from('taxpay_payment_drafts').select('id',{count:'exact',head:true}).eq('owner_uid',ownerUid),
        supabase.from('taxpay_payment_requests').select('id',{count:'exact',head:true}).eq('owner_uid',ownerUid),
        supabase.from('taxpay_correction_inquiries').select('inquiry_id',{count:'exact',head:true}).eq('requester_uid',ownerUid),
        supabase.from('taxpay_in_app_notifications').select('id',{count:'exact',head:true})
          .eq('recipient_uid',ownerUid).eq('is_read',false)
      ]);
      if(drafts.error||requests.error||corrections.error||notifications.error)throw Error('Unable to load account records');
      const {data:after,error:afterError}=await supabase.auth.getUser();
      if(afterError||after.user?.id!==ownerUid)throw Error('Account session changed');
      const counts:AccountActivityCounts={
        drafts:checkedOwnerRecordCount(drafts.count),
        reviewRequests:checkedOwnerRecordCount(requests.count),
        correctionInquiries:checkedOwnerRecordCount(corrections.count),
        unreadNotifications:checkedOwnerRecordCount(notifications.count)
      };
      if(active)setState({ownerUid,phase:'ready',counts});
    };
    void run().catch(()=>{if(active)setState({ownerUid,phase:'error',counts:null})});
    return()=>{active=false;};
  },[ownerUid,revision]);
  useEffect(()=>{
    let active=true;
    setScenario({ownerUid,phase:'loading',profileId:null,transactions:[]});
    loadPrivateDashboardPaymentActivity(ownerUid).then((activity:PrivateDashboardPaymentActivity)=>{
      if(!active)return;
      setScenario({ownerUid,phase:activity.status,profileId:activity.profileId,transactions:activity.transactions});
    }).catch(()=>{
      if(active)setScenario({ownerUid,phase:'error',profileId:null,transactions:[]});
    });
    return()=>{active=false;};
  },[ownerUid,revision]);
  const visible=state.ownerUid===ownerUid?state:{ownerUid,phase:'loading' as const,counts:null};
  const visibleScenario=scenario.ownerUid===ownerUid?scenario:{ownerUid,phase:'loading' as const,profileId:null,transactions:[]};
  const storedYears=visibleScenario.transactions.flatMap(transaction=>
    transaction.allocations.map(allocation=>allocation.assessmentYear));
  const knownYears=ASSESSMENT_YEARS.map(year=>{
    const match=/^(20\d{2})-(20\d{2}|\d{2})$/.exec(year);
    return match?`${match[1]}-${match[2].slice(-2)}`:year;
  });
  const availableYears=[...new Set([...storedYears,...knownYears])].filter(year=>/^20\d{2}-\d{2}$/.test(year)).sort((a,b)=>b.localeCompare(a));
  const selectedYear=availableYears.includes(assessmentYear)?assessmentYear:(availableYears[0]??'');
  const yearTransactions=selectedYear
    ? filterPrivateDashboardTransactionsByYear(visibleScenario.transactions,selectedYear) : [];
  const accountName=user?.id===ownerUid&&typeof user.user_metadata?.taxpay_display_name==='string'
    ? user.user_metadata.taxpay_display_name.trim() : '';
  const accountEmail=user?.id===ownerUid&&typeof user.email==='string' ? user.email : '';
  const items=[
    {id:'drafts',label:tr('Saved payment drafts','সংরক্ষিত পরিশোধ খসড়া'),count:visible.counts?.drafts,route:'secure_workspace' as const},
    {id:'review',label:tr('Payment requests','পেমেন্ট অনুরোধ'),count:visible.counts?.reviewRequests,route:'secure_workspace' as const},
    {id:'corrections',label:tr('Correction inquiries','সংশোধনের অনুসন্ধান'),count:visible.counts?.correctionInquiries,route:'corrections' as const},
    {id:'notifications',label:tr('Unread notifications','অপঠিত বিজ্ঞপ্তি'),count:visible.counts?.unreadNotifications,route:'account_notifications' as const}
  ];
  const recentTransactions=yearTransactions.slice(0,5);
  const scenarioAmount=yearTransactions.reduce((sum,transaction)=>sum+BigInt(transaction.amountMinor),0n);
  const categoryTotals=new Map<SimulationCategory,bigint>(simulationCategories.map(category=>[category,0n]));
  for(const transaction of yearTransactions){
    for(const allocation of transaction.allocations){
      categoryTotals.set(allocation.category,(categoryTotals.get(allocation.category)??0n)+BigInt(allocation.amountMinor));
    }
  }
  const categoryRows=simulationCategories.map(category=>({category,amount:categoryTotals.get(category)??0n}))
    .filter(row=>row.amount>0n);
  const serviceLabels=(transaction:DashboardSimulationTransaction)=>[...new Set(transaction.allocations.map(allocation=>
    simulationCategoryLabels[allocation.category][language]))].join(', ');
  const assessmentYears=(transaction:DashboardSimulationTransaction)=>[...new Set(transaction.allocations.map(allocation=>allocation.assessmentYear))].join(', ');
  const transactionStatus=(state:string)=>{
    const labels:Record<string,{en:string;bn:string}>={
      SIMULATED:{en:'Recorded in scenario',bn:'সিনারিওতে নথিভুক্ত'},
      PENDING:{en:'Pending in scenario',bn:'সিনারিওতে অপেক্ষমাণ'},
      FAILED:{en:'Failed in scenario',bn:'সিনারিওতে ব্যর্থ'},
      REVERSED:{en:'Reversed in scenario',bn:'সিনারিওতে প্রত্যাবর্তিত'}
    };
    return labels[state]?.[language]??state;
  };
  const roleLabel=(transaction:DashboardSimulationTransaction)=>transaction.participantView==='both'
    ?tr('Payer and recipient','পরিশোধকারী ও প্রাপক')
    :transaction.participantView==='payer'?tr('Payment initiated by this profile','এই প্রোফাইল থেকে শুরু')
      :tr('Allocated to this profile','এই প্রোফাইলে বরাদ্দ');
  const dateLabel=(value:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',
    {year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(value));
  const scenarioAmountLabel=(minor:bigint)=>{
    const locale=bn?'bn-BD':'en-BD';
    const taka=new Intl.NumberFormat(locale).format(minor/100n);
    const paisa=new Intl.NumberFormat(locale,{minimumIntegerDigits:2,useGrouping:false}).format(Number(minor%100n));
    return `৳ ${taka}.${paisa}`;
  };
  const shortcutItems=[
    {route:'history' as const,label:tr('Payment history','পেমেন্টের ইতিহাস')},
    {route:'journey' as const,label:tr('My Tax Journey','আমার কর যাত্রা')},
    {route:'ledger' as const,label:tr('Tax ledger','কর লেজার')},
    {route:'certificates' as const,label:tr('Certificates & documents','সনদ ও নথি')},
    {route:'corrections' as const,label:tr('Corrections','সংশোধন')},
    {route:'beneficiaries' as const,label:tr('Saved beneficiaries','সংরক্ষিত উপকারভোগী')},
    {route:'manage_authorization' as const,label:tr('Manage authorization','অনুমোদন পরিচালনা')},
  ];
  const linkedScenarioUser=visibleScenario.phase==='linked'&&visibleScenario.profileId
    ?getDemoUser(visibleScenario.profileId):null;
  const linkedScenarioName=linkedScenarioUser
    ?language==='bn'?linkedScenarioUser.nameBn:linkedScenarioUser.nameEn
    :null;
  const profileDescription=visibleScenario.phase==='linked'&&visibleScenario.profileId
    ? `${tr('Application account · linked scenario profile','অ্যাপ অ্যাকাউন্ট · সংযুক্ত সিনারিও প্রোফাইল')} ${visibleScenario.profileId}${linkedScenarioName?` · ${linkedScenarioName}`:''}`
    : visibleScenario.phase==='loading'
      ? tr('Application account · checking private profile','অ্যাপ অ্যাকাউন্ট · ব্যক্তিগত প্রোফাইল যাচাই হচ্ছে')
      : tr('Application account · no taxpayer profile linked','অ্যাপ অ্যাকাউন্ট · কোনো করদাতা প্রোফাইল সংযুক্ত নেই');
  return <section aria-labelledby="taxpay-owner-workflow-title" data-testid="account-workflow-summary"
    className="rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="taxpay-owner-workflow-title" className="text-base font-semibold text-taxpay-text">
          {tr('My account activity', 'আমার অ্যাকাউন্টের কার্যক্রম')}
        </h2>
        <p className="mt-1 text-sm font-medium text-taxpay-text">{accountName||accountEmail||tr('Signed-in application account','সাইন-ইন করা অ্যাপ অ্যাকাউন্ট')}</p>
        <p className="text-xs text-taxpay-muted">{profileDescription}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>onNavigate('account_profile')}
          className="min-h-10 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('View profile','প্রোফাইল দেখুন')}
        </button>
        <button type="button" onClick={()=>setRevision(value=>value+1)} disabled={visible.phase==='loading'}
          aria-label={tr('Refresh account activity','অ্যাকাউন্টের কার্যক্রম হালনাগাদ করুন')}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary disabled:opacity-60">
          <RefreshCcw size={15} aria-hidden="true"/>{tr('Refresh','হালনাগাদ')}
        </button>
      </div>
    </div>
    <p className="mt-1 text-sm text-taxpay-muted">
      {tr('These are private application records, not completed payments, Treasury settlements, assessed liabilities or tax credits.',
        'এগুলো ব্যক্তিগত অ্যাপ্লিকেশন রেকর্ড; সম্পন্ন পরিশোধ, ট্রেজারি নিষ্পত্তি, নির্ধারিত করদায় বা কর ক্রেডিট নয়।')}
    </p>
    {visible.phase==='loading'&&<p className="mt-4 text-sm text-taxpay-muted" role="status">
      {tr('Loading account activity…','অ্যাকাউন্টের কার্যক্রম লোড হচ্ছে…')}</p>}
    {visible.phase==='error'&&<p className="mt-4 text-sm text-taxpay-error" role="alert">
      {tr('Account activity could not be verified. No totals are shown.', 'অ্যাকাউন্টের কার্যক্রম যাচাই করা যায়নি। কোনো সংখ্যা দেখানো হচ্ছে না।')}</p>}
    {visible.phase==='ready'&&visible.counts&&<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(item=><article key={item.id} className="flex min-w-0 flex-col rounded-xl border border-taxpay-border bg-slate-50 p-3">
        <p className="text-sm text-taxpay-muted">{item.label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-taxpay-text">{item.count?.toLocaleString(bn?'bn-BD':'en-BD')}</p>
        <button type="button" onClick={()=>onNavigate(item.route)}
          className="mt-3 min-h-11 self-start rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
          {tr('Open records','রেকর্ড দেখুন')}
        </button>
      </article>)}
    </div>}
    <nav className="mt-4" aria-label={tr('Account shortcuts','অ্যাকাউন্ট শর্টকাট')}>
      <p className="mb-2 text-sm font-semibold text-taxpay-text">{tr('Account shortcuts','অ্যাকাউন্ট শর্টকাট')}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shortcutItems.map(item=><button key={item.route} type="button" onClick={()=>onNavigate(item.route)}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-left text-sm font-medium text-taxpay-primary hover:bg-slate-50">
          {item.label}
        </button>)}
      </div>
    </nav>
    <section className="mt-5 border-t border-taxpay-border pt-4" aria-labelledby="account-payment-activity-title"
      data-testid="account-payment-activity" aria-busy={visibleScenario.phase==='loading'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="account-payment-activity-title" className="text-sm font-semibold text-taxpay-text">{tr('Recent payment activity','সাম্প্রতিক পেমেন্ট কার্যক্রম')}</h3>
          <p className="mt-1 text-xs text-taxpay-muted">{tr('Financial records appear only when an approved account binding and its private records are available.','অনুমোদিত অ্যাকাউন্ট সংযোগ ও ব্যক্তিগত রেকর্ড থাকলেই আর্থিক তথ্য দেখানো হয়।')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {visibleScenario.phase!=='loading'&&visibleScenario.phase!=='error'&&availableYears.length>0&&<label className="flex flex-col gap-1 text-xs font-medium text-taxpay-muted">
            {tr('Assessment year','করবর্ষ')}
            <select aria-label={tr('Assessment year','করবর্ষ')} value={selectedYear} onChange={event=>setAssessmentYear(event.target.value)}
              className="min-h-10 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
              {availableYears.map(year=><option key={year} value={year}>{year}</option>)}
            </select>
          </label>}
          <button type="button" onClick={()=>onNavigate('history')}
            className="min-h-10 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-medium text-taxpay-primary">
            {tr('Open payment history','পেমেন্টের ইতিহাস দেখুন')}
          </button>
        </div>
      </div>
      {visibleScenario.phase==='loading'&&<p role="status" className="mt-3 text-sm text-taxpay-muted">{tr('Checking private payment records…','ব্যক্তিগত পেমেন্ট রেকর্ড যাচাই হচ্ছে…')}</p>}
      {visibleScenario.phase==='error'&&<p role="alert" className="mt-3 text-sm text-taxpay-error">{tr('Private payment records could not be verified. No payment amounts are shown. Refresh to try again.','ব্যক্তিগত পেমেন্ট রেকর্ড যাচাই করা যায়নি। কোনো পরিমাণ দেখানো হচ্ছে না। আবার চেষ্টা করতে হালনাগাদ করুন।')}</p>}
      {visibleScenario.phase==='unlinked'&&<p role="status" className="mt-3 rounded-lg border border-dashed border-taxpay-border bg-slate-50 p-3 text-sm text-taxpay-muted">
        {tr('No payment profile is linked to this application account. No financial totals are available.','এই অ্যাপ অ্যাকাউন্টে কোনো পেমেন্ট প্রোফাইল সংযুক্ত নেই। আর্থিক মোট পরিমাণ পাওয়া যায়নি।')}
      </p>}
      {visibleScenario.phase==='linked'&&<>
        <p className="mt-3 rounded-lg bg-taxpay-light p-3 text-xs text-taxpay-muted" role="note">
          {tr('These private scenario records are not government payments, Treasury settlements, assessed liabilities or tax credits.','এই ব্যক্তিগত সিনারিও রেকর্ড সরকারি পেমেন্ট, ট্রেজারি নিষ্পত্তি, নির্ধারিত করদায় বা কর ক্রেডিট নয়।')}
        </p>
        {yearTransactions.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-taxpay-border bg-white p-3">
            <p className="text-xs text-taxpay-muted">{tr('Scenario payment records','সিনারিও পেমেন্ট রেকর্ড')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-taxpay-text">{visibleScenario.transactions.length.toLocaleString(bn?'bn-BD':'en-BD')}</p>
          </div>
          <div className="rounded-xl border border-taxpay-border bg-white p-3">
            <p className="text-xs text-taxpay-muted">{tr('Recorded amount in scenario','সিনারিওতে নথিভুক্ত পরিমাণ')}</p>
            <p className="mt-1 break-words text-xl font-semibold tabular-nums text-taxpay-text">{scenarioAmountLabel(scenarioAmount)}</p>
          </div>
        </div>}
        {categoryRows.length>0&&<figure className="mt-4 rounded-xl border border-taxpay-border bg-white p-3" data-testid="account-payment-category-breakdown">
          <figcaption className="text-sm font-semibold text-taxpay-text">{tr('Scenario activity by payment category','পেমেন্ট খাত অনুযায়ী সিনারিও কার্যক্রম')}</figcaption>
          <div role="img" aria-label={tr('Category amounts for private scenario records','ব্যক্তিগত সিনারিও রেকর্ডের খাতভিত্তিক পরিমাণ')} className="mt-3 space-y-3">
            {categoryRows.map(row=>{
              const basisPoints=scenarioAmount>0n?Number(row.amount*10000n/scenarioAmount):0;
              return <div key={row.category} data-payment-service={row.category}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <p className="min-w-0 truncate text-taxpay-muted">{simulationCategoryLabels[row.category][language]}</p>
                  <p className="shrink-0 font-semibold tabular-nums text-taxpay-text">{scenarioAmountLabel(row.amount)}</p>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="taxpayer-dashboard__category-bar h-full rounded-full" style={{width:`${basisPoints/100}%`}}/>
                </div>
              </div>;
            })}
          </div>
        </figure>}
        {yearTransactions.length===0?<p role="status" className="mt-3 rounded-lg border border-dashed border-taxpay-border bg-slate-50 p-3 text-sm text-taxpay-muted">
          {visibleScenario.transactions.length===0
            ?tr('No stored payment activity is linked to this scenario profile.','এই সিনারিও প্রোফাইলে কোনো সংরক্ষিত পেমেন্ট কার্যক্রম নেই।')
            :tr(`No stored payment activity is available for assessment year ${selectedYear}.`,`${selectedYear} করবর্ষে কোনো সংরক্ষিত পেমেন্ট কার্যক্রম নেই।`)}
        </p>:<ul className="mt-3 space-y-2" aria-label={tr('Recent scenario transactions','সাম্প্রতিক সিনারিও লেনদেন')}>
          {recentTransactions.map(transaction=><li key={transaction.transactionId} className="rounded-xl border border-taxpay-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-taxpay-text">{transaction.id}</p>
                <p className="mt-1 text-xs text-taxpay-muted">{roleLabel(transaction)} · {dateLabel(transaction.createdAt)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-taxpay-text">{scenarioAmountLabel(BigInt(transaction.amountMinor))}</p>
            </div>
            <p className="mt-2 text-xs text-taxpay-muted">{serviceLabels(transaction)} · {tr('Assessment year','করবর্ষ')} {assessmentYears(transaction)}</p>
            <p className="mt-1 text-xs font-medium text-taxpay-muted">{transactionStatus(transaction.state)}</p>
          </li>)}
        </ul>}
      </>}
    </section>
  </section>;
};
