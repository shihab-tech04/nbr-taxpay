import {PreviewCorrectionNotifications} from './PreviewCorrectionNotifications';
import {usePreviewCorrectionRegister,previewCorrectionStatus,correctionsForAssessmentYear} from '../../services/previewCorrections';
import {TaxPayCompactCellList,TaxPayUnifiedTable,TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableFilterToggle,TaxPayActiveFilterChips,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter} from '../ui/TaxPayDataTable';
import React, {useEffect, useMemo, useState} from 'react';
import '../../styles/taxpay-dashboard-bento.css';
import {Activity, ArrowRight, Bell, BookOpen, CalendarDays, CircleAlert, CreditCard, Download, Info, FileCheck2, FilePenLine, FileText, Landmark, ReceiptText, Search, ShieldCheck, WalletCards} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {DashboardPaymentDrafts} from './DashboardPaymentDrafts';
import {BentoPaymentAnalytics} from './BentoPaymentAnalytics';
import {chooseDashboardChartSource,projectDashboardChartRecords,formatDashboardChartMoney,dashboardChartPercentage,matchesDashboardChartDrilldown,type DashboardChartSource,type DashboardChartService} from './dashboardBentoAnalytics';
import type {PaymentFormDraft} from '../../services/accountPaymentFormDrafts';
import {LegacyPaymentRecovery} from './PaymentHistory';
import {getDetailedStorySessionPayments,type OwnedStoryPayment} from '../../services/story1AccountPaymentHistory';
import {makeConfirmedReceipt} from '../../services/confirmedPaymentCertificate';
import {reuseRecordedPayment,reuseLegacySingleHeadPayment,type PaymentReuse} from '../../services/paymentReuse';
import {ReceiptView} from '../common/ReceiptView';
import {CorrectionRequests} from './CorrectionRequests';
import type {ChallanReceipt} from '../../types/tax';
import {activePreviewSession} from '../../services/previewAccountSession';
import {DEMO_USERS} from '../../data/demoUsers';
import {User1TaxpayerProfile} from './User1TaxpayerProfile';
import {TaxpayerTinInformation} from './TaxpayerTinInformation';
import {loadBeneficiaries,type Beneficiary} from '../../services/beneficiaries';
import {activityPaymentBeneficiaries} from '../../services/activityPaymentBeneficiaries';
import {activityPaymentPayer} from '../../services/activityPaymentPayer';
import {PAYMENT_TAG_GROUPS,paymentTagGroupLabels,paymentTagGroupForTin,type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {taxpayerGreeting} from '../../services/taxpayerGreeting';
import {initialActivityYear, compareActivityNewestFirst, selectActivitySource, allowLocalActivityExamples} from '../../services/activityYearScope';
import {EventBasedTaxLedger, PaymentLifecycleDetails, type TaxAccountEvent} from './EventBasedTaxLedger';

/**
 * Public synthetic storybook dataset for fictional "user1" only.
 * NEVER use these values as legal calculation, NBR validation, real taxpayer
 * credit, payment confirmation, Supabase ownership, or government challans.
 * All displayed totals and detail pages derive from this one immutable fixture.
 */
type Kind = 'income'|'tds'|'ait'|'travel'|'refund'|'adjustment';
type State = 'POSTED'|'PENDING'|'FAILED'|'REVERSED'|'DISPUTED'|'REQUESTED';
type RecordItem = {
  id:string; year:string; date:string; occurredAt?:string; kind:Kind; amount:number; state:State;
  title:string; detail:string; channel:string; ref:string; challan?:string; beneficiaryTin?:string;
  sql?:{receipts:ChallanReceipt[];reuse:PaymentReuse|null}; years?:string[]; typeLabel?:string;
};
const normalizeAY=(input:string)=>{
  const year=/^(20\d{2})-(\d{2})$/.exec(input.trim());
  return year?year[1]+'-20'+year[2]:input.trim();
};
const taxYears = [
  {year:'2025-2026',liability:180000,description:'Salary and professional income'},
  {year:'2024-2025',liability:125000,description:'Previous income-tax year'},
  {year:'2023-2024',liability:90000,description:'Earlier income-tax year'}
] as const;
const events:readonly RecordItem[] = [
  {id:'U1-001',year:'2025-2026',date:'2025-09-30',kind:'tds',amount:27000,state:'POSTED',title:'Salary withholding',detail:'Salary withholding entry',channel:'Employer channel (unverified)',ref:'DEMO-ETDS-SAL-01'},
  {id:'U1-002',year:'2025-2026',date:'2025-12-14',kind:'ait',amount:20000,state:'POSTED',title:'Advance income tax',detail:'Advance-tax allocation entry',channel:'Bank channel (unverified)',ref:'DEMO-AIT-01',challan:'DEMO-CH-AIT-01'},
  {id:'U1-003',year:'2025-2026',date:'2026-01-18',kind:'tds',amount:9000,state:'POSTED',title:'Bank interest withholding',detail:'Bank withholding entry',channel:'Bank channel (unverified)',ref:'DEMO-ETDS-BANK-02'},
  {id:'U1-004',year:'2025-2026',date:'2026-03-15',kind:'ait',amount:12000,state:'POSTED',title:'Additional advance tax',detail:'Advance-tax allocation entry',channel:'Bank channel (unverified)',ref:'DEMO-AIT-02',challan:'DEMO-CH-AIT-02'},
  {id:'U1-005',year:'2025-2026',date:'2026-03-29',kind:'tds',amount:12000,state:'POSTED',title:'Professional fee withholding',detail:'Professional fee withholding entry',channel:'Deductor channel (unverified)',ref:'DEMO-ETDS-PRO-03'},
  {id:'U1-006',year:'2025-2026',date:'2026-04-08',kind:'travel',amount:6500,state:'POSTED',title:'Travel tax payment',detail:'Separate travel-tax category; not an income-tax credit',channel:'Card channel (unverified)',ref:'DEMO-TRAVEL-01',challan:'DEMO-CH-TRAVEL-01',beneficiaryTin:'888888888888'},
  {id:'U1-007',year:'2025-2026',date:'2026-06-21',kind:'income',amount:30000,state:'POSTED',title:'Tax with return — part 1',detail:'Payment status and ledger allocation',channel:'Bank transfer channel (unverified)',ref:'DEMO-PAY-01',challan:'DEMO-CH-INC-01',beneficiaryTin:'222222222222'},
  {id:'U1-008',year:'2025-2026',date:'2026-09-14',kind:'income',amount:45000,state:'POSTED',title:'Tax with return — part 2',detail:'Payment status and linked ledger entry',channel:'Mobile banking channel (unverified)',ref:'DEMO-PAY-02',challan:'DEMO-CH-INC-02',beneficiaryTin:'909000000011'},
  {id:'U1-009',year:'2025-2026',date:'2026-10-12',kind:'income',amount:14000,state:'PENDING',title:'Pending bank reconciliation',detail:'No settlement or ledger credit assigned',channel:'Internet banking channel (unverified)',ref:'DEMO-PAY-PEND-01'},
  {id:'U1-010',year:'2025-2026',date:'2026-09-23',kind:'income',amount:9000,state:'FAILED',title:'Failed payment attempt',detail:'Gateway failure — no settlement',channel:'Card channel (unverified)',ref:'DEMO-PAY-FAIL-01'},
  {id:'U1-011',year:'2025-2026',date:'2026-05-04',kind:'income',amount:5000,state:'REVERSED',title:'Reversed attempted payment',detail:'Reversed payment, excluded from credits',channel:'Mobile banking channel (unverified)',ref:'DEMO-PAY-REV-01'},
  {id:'U1-012',year:'2025-2026',date:'2026-09-28',kind:'tds',amount:7000,state:'DISPUTED',title:'Unmatched withholding candidate',detail:'Ownership not established; excluded from recognized credits',channel:'Unmatched deductor',ref:'DEMO-ETDS-DISPUTED'},
  {id:'U1-013',year:'2025-2026',date:'2026-10-02',kind:'refund',amount:10000,state:'REQUESTED',title:'Refund inquiry',detail:'Not approved and not disbursed; not deducted from liability',channel:'Request channel (unverified)',ref:'DEMO-REFUND-01'},
  {id:'U1-014',year:'2025-2026',date:'2026-10-06',kind:'adjustment',amount:3000,state:'REQUESTED',title:'Credit reassignment inquiry',detail:'Under review; no posting or adjustment of balances',channel:'Review channel (unverified)',ref:'DEMO-ADJ-01'},
  {id:'U1-101',year:'2024-2025',date:'2024-09-10',kind:'tds',amount:25000,state:'POSTED',title:'Salary withholding',detail:'Withholding record',channel:'Employer channel (unverified)',ref:'DEMO-ETDS-24-01'},
  {id:'U1-102',year:'2024-2025',date:'2024-11-30',kind:'ait',amount:20000,state:'POSTED',title:'Advance income tax',detail:'Advance-tax allocation',channel:'Bank channel (unverified)',ref:'DEMO-AIT-24-01',challan:'DEMO-CH-24-AIT'},
  {id:'U1-103',year:'2024-2025',date:'2025-06-25',kind:'income',amount:40000,state:'POSTED',title:'Tax payment part 1',detail:'Payment amount',channel:'Bank channel (unverified)',ref:'DEMO-PAY-24-01',challan:'DEMO-CH-24-01'},
  {id:'U1-104',year:'2024-2025',date:'2025-09-10',kind:'income',amount:30000,state:'POSTED',title:'Tax payment part 2',detail:'Payment amount',channel:'Bank channel (unverified)',ref:'DEMO-PAY-24-02',challan:'DEMO-CH-24-02'},
  {id:'U1-201',year:'2023-2024',date:'2023-09-12',kind:'tds',amount:30000,state:'POSTED',title:'Salary withholding',detail:'Withholding record',channel:'Employer channel (unverified)',ref:'DEMO-ETDS-23-01'},
  {id:'U1-202',year:'2023-2024',date:'2024-01-20',kind:'ait',amount:15000,state:'POSTED',title:'Advance tax',detail:'Advance-tax allocation',channel:'Bank channel (unverified)',ref:'DEMO-AIT-23-01',challan:'DEMO-CH-23-AIT'},
  {id:'U1-203',year:'2023-2024',date:'2024-08-20',kind:'income',amount:45000,state:'POSTED',title:'Tax with return',detail:'Historical payment record',channel:'Bank channel (unverified)',ref:'DEMO-PAY-23-01',challan:'DEMO-CH-23-01'}
];
const labels:Record<Kind,[string,string]> = {
  income:['Income tax','আয়কর'],tds:['TDS / withholding','উৎসে কর'],ait:['Advance income tax','অগ্রিম আয়কর'],
  travel:['Travel tax','ভ্রমণ কর'],refund:['Refund inquiry','ফেরত অনুসন্ধান'],adjustment:['Adjustment inquiry','সমন্বয় অনুসন্ধান']
};
const stateLabels:Record<State,[string,string]> = {
  POSTED:['Recorded','রেকর্ড হয়েছে'],
  PENDING:['Awaiting reconciliation','সমন্বয়ের অপেক্ষায়'],
  FAILED:['Payment failed','পেমেন্ট ব্যর্থ'],REVERSED:['Reversed','ফেরত/রিভার্স হয়েছে'],
  DISPUTED:['Unmatched / disputed','অমিল/বিরোধপূর্ণ'],REQUESTED:['Requested only','শুধু আবেদন করা হয়েছে']
};
const stateColor:Record<State,string> = {
  POSTED:'bg-sky-50 text-sky-800',PENDING:'bg-amber-50 text-amber-900',
  FAILED:'bg-rose-50 text-rose-900',REVERSED:'bg-slate-100 text-slate-700',
  DISPUTED:'bg-orange-50 text-orange-900',REQUESTED:'bg-violet-50 text-violet-900'
};
const amount=(n:number, bn:boolean)=>'৳ '+new Intl.NumberFormat(bn?'bn-BD':'en-BD',{maximumFractionDigits:0}).format(n);
function yearSummary(year:string) {
  const base=taxYears.find(x=>x.year===year);
  if(!base)return null;
  const scoped=events.filter(x=>x.year===year);
  const sum=(kind:Kind)=>scoped.filter(x=>x.kind===kind&&x.state==='POSTED').reduce((v,x)=>v+x.amount,0);
  const tds=sum('tds'),ait=sum('ait'),direct=sum('income'),travel=sum('travel');
  const applied=tds+ait+direct;
  return {year,liability:base.liability,tds,ait,direct,travel,applied,outstanding:base.liability-applied,
    pending:scoped.filter(x=>x.state==='PENDING').reduce((v,x)=>v+x.amount,0),
    failed:scoped.filter(x=>x.state==='FAILED').length,
    disputed:scoped.filter(x=>x.state==='DISPUTED').length,
    posted:scoped.filter(x=>x.state==='POSTED').length};
}
const panel='rounded-2xl border border-taxpay-border bg-taxpay-surface p-4 shadow-sm sm:p-5';
const action='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-taxpay-surface px-3 text-sm font-medium text-taxpay-dark transition hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary';
const meter=(value:number,total:number)=>Math.min(100,Math.max(0,total>0?value*100/total:0));
export { user1DemoRoutes } from '../../config/user1DemoRoutes';
export const User1DemoExperience:React.FC<{route:string;activityTabs?:boolean;onResumePaymentDraft?: (draft:PaymentFormDraft)=>void}>=({route,activityTabs=false,onResumePaymentDraft})=>{
  const {navigate,language,setLanguage,routeParams,openAllTaxPayments,previewAccount,startPaymentReuse}=useTaxState();
  const bn=language==='bn';
  // The legacy localhost QA flag retains the test-only source comparison.
  // Production preview requires a current fictional profile session and never
  // substitutes these records for a real authenticated taxpayer account.
  const localHost=['localhost','127.0.0.1'].includes(window.location.hostname);
  const localQaScenario=localHost&&new URLSearchParams(window.location.search).get('qaScenario')==='1';
  // A server-issued preview session selects fictional user1 Activity records only.
  // Real Supabase accounts are routed elsewhere and never inherit these figures.
  const authorizedPreviewScenario=previewAccount?.id==='user1'&&activePreviewSession()?.profileId==='user1';
  // Production never consumes bundled events, even if a URL requests a sample.
  const showIllustrativeRecords=allowLocalActivityExamples(localHost,Boolean(previewAccount),localQaScenario);
  // Historical bundled references remain available only to explicit local QA; never add them to production payment history.
  const historicalCorrectionRecords=localQaScenario?events.filter(x=>x.state==='POSTED'&&['income','ait','tds','travel'].includes(x.kind)).map(x=>({reference:x.ref,year:x.year,amount:x.amount,title:x.title})):[];
  const recordedCorrections=usePreviewCorrectionRegister(authorizedPreviewScenario?'user1':null,authorizedPreviewScenario&&!localQaScenario&&['taxpayer_home','dashboard'].includes(route));
  const greeting=taxpayerGreeting(language,new Date().getHours(),bn?DEMO_USERS.user1.nameBn:DEMO_USERS.user1.nameEn,true);
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [savedTagPeople,setSavedTagPeople]=useState<Beneficiary[]>([]);
  const [tagLoadState,setTagLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const [paymentTagFilter,setPaymentTagFilter]=useState<'all'|PaymentTagGroup|'own'>('all');
  const [beneficiaryFilter,setBeneficiaryFilter]=useState('all');
  const [transactionFiltersExpanded,setTransactionFiltersExpanded]=useState(false);
  useEffect(()=>{
    let active=true;
    if(activePreviewSession()?.profileId!=='user1'){
      setSavedTagPeople([]);setTagLoadState('ready');
      return()=>{active=false;};
    }
    // Only overview and Activity render beneficiary-tag data. Profile, Settings,
    // Ledger and other routes must not read the private address book unnecessarily.
    if(route!=='taxpayer_home'&&route!=='dashboard'&&route!=='history'){
      setSavedTagPeople([]);setTagLoadState('ready');
      return()=>{active=false;};
    }
    setTagLoadState('loading');
    void loadBeneficiaries(null).then(result=>{
      if(active){setSavedTagPeople(result.people);setTagLoadState('ready');}
    }).catch(()=>{
      if(active){setSavedTagPeople([]);setTagLoadState('error');}
    });
    return()=>{active=false;};
  },[route]);
  const paymentTag=(item:RecordItem)=>paymentTagGroupForTin(item.beneficiaryTin,savedTagPeople);
  // Only link exact TINs saved under this payer's currently selected profile.
  const transactionBeneficiaries=(item:RecordItem)=>activityPaymentBeneficiaries(item,savedTagPeople,language);
  // User1's own fictional income-tax rows explicitly know their payer.
  // Other example events and SQL receipts never inherit that payer by assumption.
  const transactionPayer=(item:RecordItem)=>activityPaymentPayer(item,
    item.kind==='income'?{name:bn?DEMO_USERS.user1.nameBn:DEMO_USERS.user1.nameEn,
      tin:DEMO_USERS.user1.tin}:null);
  const payerName=(item:RecordItem)=>transactionPayer(item)?.name??tr('Not recorded','তথ্য নেই');
  const matchesTransactionTag=(item:RecordItem,group:PaymentTagGroup|'own')=>{
    const recipients=transactionBeneficiaries(item);
    if(group==='own')return recipients.some(person=>person.tin===DEMO_USERS.user1.tin);
    return recipients.length
      ?recipients.some(person=>paymentTagGroupForTin(person.tin,savedTagPeople)===group)
      :group==='unassigned';
  };
  const transactionBeneficiaryCell=(item:RecordItem,compact=false)=>{
    const recipients=transactionBeneficiaries(item);
    // Keep the transaction itself one scannable row. Full beneficiary/amount/head
    // details remain in the original record modal and beneficiary profiles.
    const renderPerson=(person:(typeof recipients)[number])=><div className="min-w-0 break-words">
      {person.saved&&previewAccount?.id==='user1'&&activePreviewSession()?.profileId==='user1'
        ?<button type="button" onClick={event=>{event.stopPropagation();navigate('beneficiaries',{openBeneficiaryTin:person.tin,returnTo:'history'});}}
          className={(compact?'taxpay-recipient-inline-link min-h-9 ':'min-h-9 ')+'text-left font-semibold text-taxpay-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary'}
          aria-label={tr('Open beneficiary profile for ','উপকারভোগীর প্রোফাইল খুলুন: ')+person.name}>
          {person.name}</button>
        :<span className="font-medium text-taxpay-text">{person.name}</span>}
      {!compact&&<span className="ml-2 text-xs text-taxpay-muted">· {person.tag??tr('Tag not saved','ট্যাগ সংরক্ষিত নেই')}</span>}
      {!compact&&<p className="break-all text-xs text-taxpay-muted">{person.tin}
        {person.amountMinor!==null&&<span> · {tr('Allocated','বরাদ্দ')}: ৳ {(person.amountMinor/100).toLocaleString(bn?'bn-BD':'en-BD')}</span>}
      </p>}
      {!compact&&person.heads.length>0&&<p className="text-xs text-taxpay-muted">{person.heads.join(', ')}
        {person.assessmentYears.length>0?' · '+person.assessmentYears.join(', '):''}</p>}
    </div>;
    return <div className={compact?'taxpayer-transaction-beneficiaries--compact':'mt-2 space-y-1 border-t border-taxpay-border pt-2 text-sm'}
      data-testid="transaction-beneficiaries" aria-label={tr('Paid for','যার কর পরিশোধ করা হয়েছে')}>
      {!recipients.length
        ?<p className="text-xs text-taxpay-muted">{tr('No beneficiary linked','উপকারভোগীর তথ্য সংযুক্ত নেই')}</p>
        :compact
          ?<TaxPayCompactCellList items={recipients} getKey={person=>person.tin}
            renderItem={renderPerson}
            moreLabel={(hidden,total)=>tr(`+${hidden} more · View all ${total}`,`আরও ${hidden} জন · মোট ${total} জন দেখুন`)}
            onShowAll={()=>setSelected(item)}/>
          :recipients.map(person=><React.Fragment key={person.tin}>{renderPerson(person)}</React.Fragment>)}
    </div>;
  };
  const paymentTagLabel=(group:PaymentTagGroup|'own')=>group==='own'
    ?tr('My tax','নিজের কর'):paymentTagGroupLabels[group][language];
  const [year,setYear]=useState<string>(()=>{
    const initial=new URLSearchParams(window.location.search).get('scenarioYear');
    // Never inherit the historical sample assessment year in a real signed-in account.
    return typeof initial==='string'&&/^20\d{2}-20\d{2}$/.test(initial)
      ? initial : (!showIllustrativeRecords||((route==='taxpayer_home'||route==='dashboard')&&!localQaScenario&&!authorizedPreviewScenario)?'2026-2027':'2025-2026');
  });
  // Ordinary signed-in Activity is an all-year transaction register. Keep
  // the selected assessment year for Overview, Ledger and explicit drilldowns.
  const [historyYear,setHistoryYear]=useState(()=>initialActivityYear(
    new URLSearchParams(window.location.search).get('scenarioYear'),
    year,authorizedPreviewScenario&&!localQaScenario,false));
  const [correctionYear,setCorrectionYear]=useState<string>(()=>new URLSearchParams(window.location.search).get('scenarioYear')?.match(/^20\d{2}-20\d{2}$/)?.[0]??'all');
  useEffect(()=>{if(route==='corrections'&&typeof routeParams?.correctionRequestId==='string')setCorrectionYear('all');},[route,routeParams?.correctionRequestId]);
  const [overviewSourceChoice,setOverviewSourceChoice]=useState<{year:string;source:DashboardChartSource}|null>(null);
  const changeYear=(nextYear:string)=>{
    if(route==='history')setHistoryYear(nextYear);
    if(route==='corrections')setCorrectionYear(nextYear);
    if(nextYear!=='all'){setYear(nextYear);setLedgerYear(nextYear);}
    setMonthFilter('all');
    const url=new URL(window.location.href);
    url.searchParams.set('scenarioYear',nextYear);
    // Never carry the previous tax year's calendar month into the next year.
    url.searchParams.delete('monthFilter');
    window.history.replaceState(window.history.state,'',url);
  };
  const [ledgerYear,setLedgerYear]=useState<string>(()=>showIllustrativeRecords||/^20\d{2}-20\d{2}$/.test(new URLSearchParams(window.location.search).get('scenarioYear')??'')?year:'all');
  const [documentSearch,setDocumentSearch]=useState('');
  const [caseFiltersExpanded,setCaseFiltersExpanded]=useState(false);
  const [caseSearch,setCaseSearch]=useState('');
  const [caseStatus,setCaseStatus]=useState<State|'all'>('all');
  const [savedDraftCount,setSavedDraftCount]=useState<number|null>(null);
  const [draftHelpVisible,setDraftHelpVisible]=useState(false);
  const [followupTab,setFollowupTab]=useState<'drafts'|'requests'>('requests');
  const [kind,setKind]=useState<Kind|'all'>('all');
  const [status,setStatus]=useState<State|'all'>('all');
  const [monthFilter,setMonthFilter]=useState('all');
  const chooseHistoryMonth=(month:string)=>{
    if(month!=='all'&&!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return;
    setMonthFilter(month);
    const url=new URL(window.location.href);
    if(month==='all')url.searchParams.delete('monthFilter');
    else url.searchParams.set('monthFilter',month);
    window.history.replaceState(window.history.state,'',url);
  };
  const [reviewFilter,setReviewFilter]=useState<State[]|null>(null);
  const [dashboardHistorySource,setDashboardHistorySource]=useState<DashboardChartSource|'all'>('all');
  const [dashboardHistoryService,setDashboardHistoryService]=useState<DashboardChartService|'all'>('all');
  const [dashboardHistoryCompletedOnly,setDashboardHistoryCompletedOnly]=useState(false);
  useEffect(()=>{
    if(route!=='history')return;
    const scopedDrilldown=routeParams.dashboardSource==='recorded'||routeParams.dashboardSource==='example'||
      Array.isArray(routeParams.reviewStatuses)||typeof routeParams.monthFilter==='string'||typeof routeParams.categoryFilter==='string';
    setHistoryYear(initialActivityYear(new URLSearchParams(window.location.search).get('scenarioYear'),
      year,authorizedPreviewScenario&&!localQaScenario,scopedDrilldown));
    // A chart drill-down is a new scoped view, never inherit unrelated
    // Activity filters from a previous search or payment head.
    if(routeParams.dashboardSource==='recorded'||routeParams.dashboardSource==='example'){
      setKind('all');setStatus('all');setQuery('');
      setMonthFilter('all');setReviewFilter(null);
    }
    const category=routeParams.categoryFilter;
    if(['income','tds','ait','travel'].includes(String(category)))setKind(category as Kind);
    const month=routeParams.monthFilter;
    setMonthFilter(typeof month==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?month:'all');
    const statuses=routeParams.reviewStatuses;
    if(Array.isArray(statuses) && statuses.length && statuses.every((x:unknown)=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(String(x)))){
      setReviewFilter(statuses as State[]);
      setStatus('all');
    } else setReviewFilter(null);
    const tag=routeParams.dashboardTagFilter;
    setPaymentTagFilter(['family','friends','clients','others','own','unassigned'].includes(String(tag))
      ?tag as PaymentTagGroup|'own':'all');
    setDashboardHistorySource(routeParams.dashboardSource==='recorded'||(showIllustrativeRecords&&routeParams.dashboardSource==='example')
      ?routeParams.dashboardSource as DashboardChartSource:'all');
    setDashboardHistoryCompletedOnly(routeParams.dashboardOnlyCompleted===true);
    setDashboardHistoryService(['income','tds','ait','other','travel'].includes(String(routeParams.dashboardService))
      ?routeParams.dashboardService as DashboardChartService:'all');
    const dashboardRecipientTin=String(routeParams.dashboardRecipientTin??'');
    setBeneficiaryFilter(/^\d{12,13}$/.test(dashboardRecipientTin)?dashboardRecipientTin:'all');
  },[route,routeParams]);
  const openReview=(states:State[])=>navigate('history',{reviewStatuses:states});
  const [query,setQuery]=useState('');
  const [historyPage,setHistoryPage]=useState(1);
  const [selected,setSelected]=useState<RecordItem|null>(null);
  const [correctionTarget,setCorrectionTarget]=useState<RecordItem|null>(null);
  const [sqlPayments,setSqlPayments]=useState<OwnedStoryPayment[]>([]);
  const [sqlLoadError,setSqlLoadError]=useState(false);
  const [sqlLoading,setSqlLoading]=useState(authorizedPreviewScenario);
  const retryRecordedPayments=()=>window.dispatchEvent(new Event('taxpay:story-payments-recovered'));
  useEffect(()=>{
    if(!['history','taxpayer_home','dashboard','corrections','certificates','journey','ledger'].includes(route)||previewAccount?.id!=='user1'||activePreviewSession()?.profileId!=='user1'){
      setSqlPayments([]);setSqlLoadError(false);setSqlLoading(false);return;
    }
    let active=true;
    let revision=0;
    const session=activePreviewSession();
    setSqlLoading(true);
    const load=()=>{
      const current=++revision;
      const isCurrent=()=>active&&current===revision&&
        activePreviewSession()?.paymentSessionId===session?.paymentSessionId&&
        activePreviewSession()?.capability===session?.capability;
      void getDetailedStorySessionPayments().then(payments=>{
        if(isCurrent()){setSqlPayments(payments);setSqlLoadError(false);setSqlLoading(false);}
      }).catch(()=>{if(isCurrent()){setSqlPayments([]);setSqlLoadError(true);setSqlLoading(false);}});
    };
    load();
    const refresh=()=>{setHistoryPage(1);setSqlLoading(true);load();};
    window.addEventListener('taxpay:story-payments-recovered',refresh);
    return()=>{active=false;window.removeEventListener('taxpay:story-payments-recovered',refresh);};
  },[route,previewAccount?.id]);
  // SQL records are never matched to illustrative DEMO-* rows by their labels.
  // Every complete multi-head batch is one transaction and repeats as a whole.
  const sqlRows=useMemo<RecordItem[]>(()=>{
    const records=sqlPayments.map(payment=>{
      let receipt:ChallanReceipt|null=null;
      try{receipt=makeConfirmedReceipt(payment);}catch{/* Do not infer missing allocations. */}
      return {payment,receipt};
    });
    const grouped=new Map<string,typeof records>();
    for(const entry of records){
      const id=entry.receipt?.batchId??entry.payment.id;
      grouped.set(id,[...(grouped.get(id)??[]),entry]);
    }
    return [...grouped].map(([id,items])=>{
      const first=items[0].payment;
      const receipts=items.flatMap(entry=>entry.receipt?[entry.receipt]:[]);
      const years=[...new Set(items.flatMap(entry=>[
        ...(entry.receipt?.allocationItems?.map(x=>x.assessmentYear)??[]),
        entry.receipt?.assessmentYear??'',
        typeof entry.payment.details.assessmentYear==='string'?entry.payment.details.assessmentYear:''
      ]).flatMap(value=>value.split(',').map(normalizeAY))
        .filter(value=>/^20\d{2}-20\d{2}$/.test(value)))];
      let reuse:PaymentReuse|null=null;
      try{
        // A generated display-only fallback receipt is not a faithful
        // payment input snapshot. Never let historic head IDs silently
        // become different modern tax heads.
        const sourceSnapshotsVerified=items.every(({payment})=>{
          const snapshot=payment.details.receiptSnapshot;
          return Boolean(snapshot)&&typeof snapshot==='object'&&!Array.isArray(snapshot)&&
            (snapshot as Record<string,unknown>).paymentCategory===payment.service &&
            Array.isArray((snapshot as Record<string,unknown>).items)&&
            typeof (snapshot as Record<string,unknown>).totalAmount==='number' &&
            Math.round(((snapshot as Record<string,unknown>).totalAmount as number)*100)===payment.amountMinor;
        });
        if(sourceSnapshotsVerified&&receipts.length===items.length)
          reuse=reuseRecordedPayment(receipts,'user1',DEMO_USERS.user1.tin,id);
      }catch{/* Old records are checked separately; modern invalid snapshots remain blocked. */}
      // Some legacy SQL rows stored only an exact category, one AY, one TIN
      // and amount. No head ID or classification was recorded. Permit a new
      // editable journey with the missing fields required, never infer a head.
      if(!reuse && items.length===1){
        try{reuse=reuseLegacySingleHeadPayment(first,'user1',DEMO_USERS.user1.tin);}
        catch{/* Mixed/incomplete/unauthorized source records stay disabled. */}
      }
      const service=first.service.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,word=>word.toUpperCase());
      const minor=items.reduce((total,entry)=>total+entry.payment.amountMinor,0);
      const kind:Kind=first.service==='TRAVEL_TAX'?'travel':first.service==='SOURCE_TAX_DEPOSIT'?'tds':'income';
      return {id:'recorded-'+id,ref:id,year:years[0]??'—',years:years.length?years:['—'],
        date:first.createdAt.slice(0,10),occurredAt:first.createdAt,kind,amount:minor/100,state:'POSTED' as const,
        title:service,typeLabel:service,detail:'SQL-recorded simulated payment',
        channel:'Recorded simulated payment',sql:{receipts,reuse}};
    }).sort(compareActivityNewestFirst);
  },[sqlPayments]);
  const availableYears=useMemo(()=>[
    ...new Set(['2026-2027',...taxYears.map(item=>item.year),
      ...sqlRows.flatMap(row=>row.years??[]).filter(value=>/^20\d{2}-20\d{2}$/.test(value))])
  ].sort((a,b)=>b.localeCompare(a)),[sqlRows]);
  const totals=(showIllustrativeRecords?yearSummary(year):null)??{year,liability:0,tds:0,ait:0,direct:0,travel:0,
    applied:0,outstanding:0,pending:0,failed:0,disputed:0,posted:0};
  // One verified owner-scoped SQL projection for the signed-in payment register,
  // recent activity, documents and timeline. Never fall back to bundled examples.
  const activityRecords=useMemo(()=>selectActivitySource(sqlRows,events,showIllustrativeRecords),[sqlRows,showIllustrativeRecords]);
  const scoped=useMemo(()=>activityRecords.filter(x=>x.years?x.years.includes(year):x.year===year),[activityRecords,year]);
  const historyScoped=useMemo(()=>historyYear==='all'?activityRecords:
    activityRecords.filter(row=>row.years?row.years.includes(historyYear):row.year===historyYear),
    [historyYear,activityRecords]);
  const dashboardChartRecords=activityRecords;
  const defaultOverviewSource=localQaScenario
    ?chooseDashboardChartSource(dashboardChartRecords,year,savedTagPeople,DEMO_USERS.user1.tin)
    :'recorded';
  const overviewSource=(localQaScenario
    ?(overviewSourceChoice?.year===year?overviewSourceChoice.source:defaultOverviewSource)
    :'recorded') as DashboardChartSource;
  const overviewCompletedRows=overviewSource==='recorded'
    ?sqlRows.filter(item=>item.state==='POSTED'&&item.years?.includes(year))
    :scoped.filter(item=>!item.sql&&item.state==='POSTED'&&['income','ait','travel'].includes(item.kind));
  const availableTransactionBeneficiaries=[...new Map(historyScoped.flatMap(item=>
    transactionBeneficiaries(item)).map(person=>[person.tin,person])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name));
  const filtered=historyScoped.filter(x=>{
    const people=transactionBeneficiaries(x);
    // Only an exact allocation match may satisfy a service/recipient/tag
    // drilldown; parent-batch metadata can refer to other tax years.
    const needsAllocationMatch=dashboardHistoryService!=='all'||(
      dashboardHistorySource!=='all'&&
      (beneficiaryFilter!=='all'||paymentTagFilter!=='all'));
    const allocationMatch=!needsAllocationMatch||(historyYear==='all'?(x.years??[x.year]):[historyYear]).some(ay=>
      matchesDashboardChartDrilldown(x,ay,x.sql?'recorded':'example',savedTagPeople,DEMO_USERS.user1.tin,
        dashboardHistoryService,beneficiaryFilter==='all'?undefined:beneficiaryFilter,
        paymentTagFilter==='all'?undefined:paymentTagFilter));
    const searchFields=[x.ref,x.title,x.challan||'',x.detail,x.typeLabel||'',payerName(x),...people.flatMap(p=>
      [p.name,p.tin,p.tag||'',...p.heads,...p.assessmentYears])];
    return (dashboardHistorySource==='all'||((dashboardHistorySource==='recorded')===Boolean(x.sql)))&&
      allocationMatch&&
      (!dashboardHistoryCompletedOnly||(x.state==='POSTED'&&
        (Boolean(x.sql)||['income','ait','travel'].includes(x.kind))))&&
      (kind==='all'||kind===x.kind)&&(status==='all'||status===x.state)&&
      (monthFilter==='all'||x.date.startsWith(monthFilter))&&
      (!reviewFilter||reviewFilter.includes(x.state))&&
      (beneficiaryFilter==='all'||people.some(person=>person.tin===beneficiaryFilter))&&
      (paymentTagFilter==='all'||(tagLoadState==='ready'&&matchesTransactionTag(x,paymentTagFilter)))&&
      searchFields.join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort(compareActivityNewestFirst);
  const historyPerPage=10;
  const currentHistoryPage=Math.min(historyPage,Math.max(1,Math.ceil(filtered.length/historyPerPage)));
  const visibleHistoryRows=filtered.slice((currentHistoryPage-1)*historyPerPage,currentHistoryPage*historyPerPage);
  useEffect(()=>setHistoryPage(1),[historyYear,query,kind,status,monthFilter,reviewFilter,paymentTagFilter,beneficiaryFilter,dashboardHistorySource,dashboardHistoryCompletedOnly,dashboardHistoryService]);
  const availableHistoryMonths=[...new Set(historyScoped.map(x=>x.date.slice(0,7)))].sort();
  // Use the same selected-year, owner-owned projection as the Activity table.
  // Keep demo events identifiable; SQL records are simulation payments, not certified credits.
  const navigateTo=(r:string)=>navigate(r);
  const view=(r:string,textEn:string,textBn:string)=> <button type="button" className={action} onClick={()=>navigateTo(r)}>{tr(textEn,textBn)} <ArrowRight size={15} aria-hidden="true"/></button>;
  const tag=(s:State)=><span className={'inline-flex rounded-full px-2 py-1 text-[11px] font-medium '+stateColor[s]}>{tr(...stateLabels[s])}</span>;
  const sub=(desc:string,bengali:string)=><p className="mt-1 text-sm leading-6 text-slate-500">{tr(desc,bengali)}</p>;
  const card=(title:string,titleBn:string,value:string,subtitle:string,subtitleBn:string)=><article className={panel}>
    <p className="text-xs font-medium text-slate-500">{tr(title,titleBn)}</p><p className="mt-2 text-xl font-semibold text-slate-800">{value}</p>{sub(subtitle,subtitleBn)}
  </article>;

  const info=(label:string, english:string, bengali:string)=><details className="taxpayer-inline-help"
    onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.stopPropagation();}}}>
    <summary aria-label={tr('About ','বিস্তারিত: ')+label} title={tr('More information','বিস্তারিত তথ্য')}><Info size={16} aria-hidden="true"/></summary>
    <p className="taxpayer-inline-help__content">{tr(english,bengali)}</p>
  </details>;
  const money=(x:number)=>amount(x,bn);
  const payAgain=(item:RecordItem)=>{
    if(!item.sql?.reuse||previewAccount?.id!=='user1'||
        activePreviewSession()?.profileId!=='user1')return;
    setSelected(null);
    startPaymentReuse(item.sql.reuse);
  };
  const applyForCorrection=(item:RecordItem)=>{
    // A route hint never authorizes a correction. Only a currently owned SQL
    // receipt can be offered; the existing request form validates its source.
    if(!authorizedPreviewScenario||!(item.sql?.receipts.length||(!item.sql&&historicalCorrectionRecords.some(x=>x.reference===item.ref))))return;
    setSelected(null);
    setCorrectionTarget(item);
  };
  const canApplyCorrection=(item:RecordItem)=>authorizedPreviewScenario&&Boolean(item.sql?.receipts.length||(!item.sql&&historicalCorrectionRecords.some(x=>x.reference===item.ref)));
  const rowActions=(item:RecordItem)=><div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>setSelected(item)}
      className={action+' taxpayer-transaction-row__action'}
      aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>
    {item.sql&&<button type="button" data-testid="recorded-pay-again"
      disabled={!item.sql.reuse} onClick={()=>payAgain(item)}
      title={!item.sql.reuse?tr('Complete original payment unavailable','আগের পেমেন্টের সম্পূর্ণ তথ্য নেই'):undefined}
      className={action+' taxpayer-transaction-row__action disabled:opacity-50'}>
      {tr('Pay Again','আবার পরিশোধ')}
    </button>}
  </div>;
  const formatDate=(date:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{
    day:'numeric',month:'short',year:'numeric',timeZone:'UTC'
  }).format(new Date(date+'T00:00:00Z'));
  const csv=()=>{
    const clean=(v:string|number)=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const lines=[['Record source','Reference','Assessment year','Kind','Amount ৳','Status','Event date','Challan sample','Paid by','Paid for','Beneficiary TINs','Beneficiary tags','Tax heads'],
      ...filtered.map(x=>{
        const recipients=transactionBeneficiaries(x);
        return [x.sql?'SQL-RECORDED SIMULATION':'NOT GOVERNMENT DATA',x.ref,x.year,x.kind,x.amount,x.state,x.date,x.challan||'',
          payerName(x),recipients.map(p=>p.name).join('; '),recipients.map(p=>p.tin).join('; '),
          recipients.map(p=>p.tag||tr('Not saved','সংরক্ষিত নেই')).join('; '),
          recipients.flatMap(p=>p.heads).join('; ')];
      })].map(x=>x.map(clean).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='Sohojkor_user1_SYNTHETIC_'+historyYear+'.csv';a.click();URL.revokeObjectURL(url);
  };
  const years=<label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{tr('Assessment year','করবর্ষ')}
    <select aria-label={tr('Assessment year','করবর্ষ')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={route==='history'?historyYear:route==='corrections'?correctionYear:year} onChange={e=>changeYear(e.target.value)}>{(route==='history'?['all',...availableYears]:route==='corrections'?['all',...new Set([...availableYears,...taxYears.map(x=>x.year)])]:['taxpayer_home','dashboard'].includes(route)?availableYears:taxYears.map(x=>x.year)).map(value=>
      <option key={value} value={value}>{value==='all'?tr('All years','সব করবর্ষ'):value==='—'?tr('Unknown assessment year','অজ্ঞাত করবর্ষ'):value}</option>)}</select>
  </label>;
  const transactionList=<section className={panel+' taxpayer-transaction-panel taxpay-office-register-frame'} aria-labelledby="taxpayer-transaction-heading">
    <TaxPayOfficeRegisterToolbar id="taxpayer-transaction-heading" testId="convay-table-toolbar"
      title={tr('Transaction history','লেনদেনের ইতিহাস')} count={filtered.length} total={historyScoped.length}
      countLabel={tr('records','রেকর্ড')} searchValue={query} onSearchChange={setQuery}
      searchLabel={tr('Search transaction reference','লেনদেন রেফারেন্স খুঁজুন')}
      searchPlaceholder={tr('Search reference, beneficiary, tag or head','রেফারেন্স, উপকারভোগী, ট্যাগ বা খাত খুঁজুন')}
      filterLabel={tr('Filter','ফিল্টার')} filtersOpen={transactionFiltersExpanded}
      onToggleFilters={()=>setTransactionFiltersExpanded(open=>!open)}
      actions={<button type="button" onClick={csv} className={action+' taxpayer-convay-table-toolbar__export'}>
        <Download size={16}/>{tr('Export CSV','CSV রপ্তানি')}
      </button>}/>
    <TaxPayOfficeRegisterFilters open={transactionFiltersExpanded} className="taxpayer-transaction-filters taxpayer-convay-table-filters" testId="convay-table-filters">
      <label className="taxpayer-transaction-filter"><span>{tr('Payment type','পেমেন্টের ধরন')}</span><select aria-label={tr('Transaction category','লেনদেনের ধরন')} value={kind} onChange={e=>setKind(e.target.value as Kind|'all')}>
        <option value="all">{tr('All types','সব ধরন')}</option>{(Object.keys(labels) as Kind[]).map(k=><option key={k} value={k}>{tr(...labels[k])}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Calendar month','ক্যালেন্ডার মাস')}</span><select aria-label={tr('Transaction month','লেনদেনের মাস')} value={availableHistoryMonths.includes(monthFilter)?monthFilter:'all'} onChange={e=>chooseHistoryMonth(e.target.value)}>
        <option value="all">{tr('All months','সব মাস')}</option>{availableHistoryMonths.map(month=><option key={month} value={month}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'))}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Status','অবস্থা')}</span><select aria-label={tr('Transaction status','লেনদেনের অবস্থা')} value={status} onChange={e=>{setReviewFilter(null);setStatus(e.target.value as State|'all');}}>
        <option value="all">{tr('All statuses','সব অবস্থা')}</option>{(Object.keys(stateLabels) as State[]).map(s=><option key={s} value={s}>{tr(...stateLabels[s])}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Beneficiary','উপকারভোগী')}</span>
        <select aria-label={tr('Filter transactions by beneficiary','উপকারভোগী অনুযায়ী লেনদেন ফিল্টার')}
          value={beneficiaryFilter} onChange={event=>setBeneficiaryFilter(event.target.value)}>
          <option value="all">{tr('All beneficiaries','সব উপকারভোগী')}</option>
          {availableTransactionBeneficiaries.map(person=><option key={person.tin} value={person.tin}>{person.name} · {person.tin}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter"><span>{tr('Beneficiary tag','উপকারভোগীর ট্যাগ')}</span>
        <select aria-label={tr('Filter transactions by beneficiary tag','উপকারভোগীর ট্যাগ দিয়ে লেনদেন ফিল্টার')}
          value={paymentTagFilter} onChange={event=>setPaymentTagFilter(event.target.value as 'all'|PaymentTagGroup|'own')}>
          <option value="all">{tr('All tags','সব ট্যাগ')}</option>
          <option value="own">{paymentTagLabel('own')}</option>
          {PAYMENT_TAG_GROUPS.map(group=><option key={group} value={group}>{paymentTagLabel(group)}</option>)}
        </select>
      </label>
    </TaxPayOfficeRegisterFilters>
    <TaxPayActiveFilterChips clearLabel={tr('Clear all','সব ফিল্টার মুছুন')}
      onClear={()=>{setQuery('');setKind('all');setStatus('all');chooseHistoryMonth('all');setPaymentTagFilter('all');setBeneficiaryFilter('all');setReviewFilter(null);setDashboardHistorySource('all');setDashboardHistoryCompletedOnly(false);setDashboardHistoryService('all');}}
      filters={[
        ...(query.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+query.trim(),onRemove:()=>setQuery('')}]:[]),
        ...(kind!=='all'?[{key:'kind',label:tr(...labels[kind]),onRemove:()=>setKind('all')}]:[]),
        ...(monthFilter!=='all'?[{key:'month',label:monthFilter,onRemove:()=>chooseHistoryMonth('all')}]:[]),
        ...(status!=='all'?[{key:'status',label:tr(...stateLabels[status]),onRemove:()=>setStatus('all')}]:[]),
        ...(paymentTagFilter!=='all'?[{key:'tag',label:paymentTagLabel(paymentTagFilter),onRemove:()=>setPaymentTagFilter('all')}]:[]),
        ...(dashboardHistorySource!=='all'?[{key:'source',label:dashboardHistorySource==='recorded'?tr('Saved payments','সংরক্ষিত পেমেন্ট'):tr('Examples','উদাহরণ'),onRemove:()=>setDashboardHistorySource('all')}]:[]),
        ...(dashboardHistoryService!=='all'?[{key:'service',label:tr('Service: ','সেবা: ')+dashboardHistoryService,onRemove:()=>setDashboardHistoryService('all')}]:[]),
        ...(dashboardHistoryCompletedOnly?[{key:'completed',label:tr('Completed only','শুধু সম্পন্ন'),onRemove:()=>setDashboardHistoryCompletedOnly(false)}]:[]),
        ...(beneficiaryFilter!=='all'?[{key:'beneficiary',label:tr('Beneficiary: ','উপকারভোগী: ')+(availableTransactionBeneficiaries.find(p=>p.tin===beneficiaryFilter)?.name??beneficiaryFilter),onRemove:()=>setBeneficiaryFilter('all')}]:[])
      ]}/>
    {tagLoadState==='error'&&<p className="px-3 text-sm text-taxpay-error" role="alert">{tr('Saved beneficiary tags could not be loaded.','সংরক্ষিত উপকারভোগীর ট্যাগ লোড করা যায়নি।')}</p>}
    {sqlLoadError&&<div role="alert" className="px-3 text-sm text-taxpay-error">
      {tr('Recorded payments could not be verified.','সংরক্ষিত পেমেন্ট যাচাই করা যায়নি।')}
      <button type="button" className={action+' ml-2'} onClick={retryRecordedPayments}>{tr('Retry','আবার চেষ্টা করুন')}</button>
    </div>}
    {reviewFilter&&<div className="taxpayer-transaction-count">
      <button type="button" className="min-h-10 rounded-lg px-3 text-xs font-medium text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
        onClick={()=>setReviewFilter(null)}>{tr('Clear review filter','পর্যালোচনা ফিল্টার মুছুন')}</button>
    </div>}
    {filtered.length>0&&<p className="taxpay-register-scroll-note" role="note">
      {tr('All payment fields are retained. Scroll for additional columns; Payment, Amount, Status and Actions stay visible.',
        'সব পেমেন্টের তথ্য অক্ষত আছে। অতিরিক্ত কলামে স্ক্রল করুন; পেমেন্ট, পরিমাণ, অবস্থা ও কার্যক্রম দেখা যাবে।')}
    </p>}
    {filtered.length ? <TaxPayDataGrid variant="tabular" rows={visibleHistoryRows} getRowKey={item=>item.id}
      pagination={{page:currentHistoryPage,perPage:historyPerPage,total:filtered.length,onPageChange:setHistoryPage,
        labels:bn?{previous:'আগের পৃষ্ঠা',next:'পরের পৃষ্ঠা',showing:'দেখানো হচ্ছে',of:'মোট',records:'রেকর্ড',page:'পৃষ্ঠা'}:undefined}}
      ariaLabel={tr('Payment transactions','পেমেন্ট লেনদেন')}
      className="taxpayer-transaction-table" testId="taxpayer-transaction-table"
      mobileTestId="taxpayer-transaction-mobile-cards"
      onViewRow={item=>setSelected(item)}
      columns={[
        {key:'payment',header:tr('Payment','পেমেন্ট'),renderCell:item=><div className="taxpayer-transaction-payment-cell">
          <p className="taxpayer-transaction-row__title">{item.title}</p>
          {/* The reference, type and date each have their own dedicated columns.
              Do not repeat them in the Payment cell and make rows three lines tall. */}
        </div>},
        {key:'paid-by',header:tr('Paid by','পরিশোধকারী'),renderCell:item=>
          <p className="taxpayer-transaction-identity">{payerName(item)}</p>},
        {key:'paid-for',header:tr('Paid for','যার জন্য পরিশোধ'),renderCell:item=>
          <div className="taxpayer-transaction-identity">{transactionBeneficiaryCell(item,true)}</div>},
        {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:item=>
          <span className="taxpayer-transaction-reference" title={item.ref}>{item.ref}</span>},
        {key:'type',header:tr('Payment type','পেমেন্টের ধরন'),renderCell:item=>
          <span className="taxpayer-transaction-type">{item.typeLabel??tr(...labels[item.kind])}</span>},
        {key:'date',header:tr('Date','তারিখ'),renderCell:item=>
          <time dateTime={item.date} className="taxpayer-transaction-date">{formatDate(item.date)}</time>},
        {key:'amount',header:tr('Amount','পরিমাণ'),headerClassName:'text-right',
          cellClassName:'text-right tabular-nums',renderCell:item=>
          <p className="taxpayer-transaction-row__amount tabular-nums">{item.sql?'৳ '+item.amount.toLocaleString(bn?'bn-BD':'en-BD',{minimumFractionDigits:2,maximumFractionDigits:2}):money(item.amount)}</p>},
        {key:'status',header:tr('Status','অবস্থা'),renderCell:item=>
          <div className="taxpayer-transaction-row__status">{tag(item.state)}</div>},
        {key:'actions',header:tr('Actions','কার্যক্রম'),renderCell:rowActions}
      ]}
      renderMobileCard={item=><div className="taxpayer-transaction-mobile-record">
        <div className="taxpayer-transaction-mobile-record__top">
          <p className="taxpayer-transaction-row__title">{item.title}</p>
          <p className="taxpayer-transaction-row__amount tabular-nums">{item.sql?'৳ '+item.amount.toLocaleString(bn?'bn-BD':'en-BD',{minimumFractionDigits:2,maximumFractionDigits:2}):money(item.amount)}</p>
        </div>
        <p className="taxpayer-transaction-reference">{item.ref}</p>
        <p className="taxpayer-transaction-mobile-record__meta">{item.typeLabel??tr(...labels[item.kind])} · <time dateTime={item.date}>{formatDate(item.date)}</time></p>
        <p className="taxpayer-transaction-mobile-record__meta"><strong>{tr('Paid by','পরিশোধকারী')}:</strong> {payerName(item)}</p>
        <div className="taxpayer-transaction-mobile-record__meta">
          <strong>{tr('Paid for','যার জন্য পরিশোধ')}:</strong>
          {transactionBeneficiaryCell(item,true)}
        </div>
        <div className="taxpayer-transaction-mobile-record__footer">
          <div className="taxpayer-transaction-row__status">{tag(item.state)}</div>
          {rowActions(item)}
        </div>
      </div>}/>:sqlLoading?<p role="status" className="taxpay-table-state mt-4">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>:sqlLoadError?null:<div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><h3 className="font-semibold">{!activityRecords.length?tr('No transactions yet.','এখনও কোনো লেনদেন নেই।'):tr('No matching records','মিল পাওয়া যায়নি')}</h3>{!activityRecords.length?sub('Completed payments will appear here.','সম্পন্ন পেমেন্ট এখানে দেখা যাবে।'):sub('Change the filters or select another year.','ফিল্টার বা করবর্ষ পরিবর্তন করুন।')}</div>}
  </section>;
  const overviewRoute=route==='taxpayer_home'||route==='dashboard';
  const pageTitle=route==='history'?tr('Payments & activity','পেমেন্ট ও লেনদেন'):route==='ledger'?tr('Tax ledger','কর লেজার'):route==='certificates'?tr('Receipts & payment records','রসিদ ও পেমেন্ট রেকর্ড'):route==='corrections'?tr('Corrections & exceptions','সংশোধন ও ব্যতিক্রম'):route==='journey'?tr('My tax journey','আমার কর কার্যক্রম'):route==='account_profile'?tr('Taxpayer profile','করদাতা প্রোফাইল'):route==='account_notifications'?tr('Notifications','বিজ্ঞপ্তি'):route==='account_settings'?tr('Profile settings','প্রোফাইল সেটিংস'):tr('Overview','সংক্ষিপ্ত বিবরণ');
  const header=<TaxpayerPageHeading title={overviewRoute?tr('Your tax overview','আপনার করের সারসংক্ষেপ'):pageTitle} description={overviewRoute?tr('Payments, recipients and follow-ups for your assessment year.','আপনার করবর্ষের পেমেন্ট, প্রাপক ও পরবর্তী করণীয়।'):undefined} className={'taxpayer-dashboard-header'+(overviewRoute?' taxpayer-dashboard-header--overview':'')}
    actions={!['account_profile','account_settings','ledger','journey'].includes(route) ? years : undefined} />;
  // Keep the existing external-data UI gated until a verified, nonempty source is linked.
  const verifiedExternalTaxPositionReady=false;
  // Employer/deductor withholding belongs in Activity, not payer-initiated
  // Completed Payments. The lower payer-spending chart uses the same definition.
  const completedPayments=overviewCompletedRows.length;
  // A preview session with no account-backed allocations should be a compact,
  // task-first bento. This never promotes synthetic events into real payments.
  const hasItemizedAccountAllocations=projectDashboardChartRecords(
    dashboardChartRecords,year,'recorded',savedTagPeople,DEMO_USERS.user1.tin).totalMinor>0n;
  // Use the exact same filtered allocation projection as the interactive charts.
  // This overview shows activity, never assessed liability or posted tax credit.
  const overviewProjection=projectDashboardChartRecords(
    dashboardChartRecords,year,overviewSource,savedTagPeople,DEMO_USERS.user1.tin);
  const overviewHasAmount=!(overviewSource==='recorded'&&sqlLoadError)&&overviewProjection.totalMinor>0n;
  const overviewServices=[...overviewProjection.byService]
    .filter(item=>item.amountMinor>0n)
    .sort((a,b)=>a.amountMinor>b.amountMinor?-1:a.amountMinor<b.amountMinor?1:0).slice(0,3);
  const overviewServiceNames:Record<DashboardChartService,string>={
    income:tr('Tax with return','রিটার্নের সঙ্গে কর'),
    ait:tr('Advance tax','অগ্রিম কর'),
    tds:tr('Source tax','উৎসে কর'),
    other:tr('Other tax','অন্যান্য কর'),
    travel:tr('Travel tax','ভ্রমণ কর')
  };
  const compactEmptyOverview=overviewSource==='recorded'&&!localQaScenario&&!hasItemizedAccountAllocations&&Boolean(onResumePaymentDraft);
  const correctionRequests=overviewSource==='example'
    ?scoped.filter(x=>x.state==='REQUESTED'&&(x.kind==='refund'||x.kind==='adjustment')):[];
  const scopedRecordedCorrections=correctionsForAssessmentYear(recordedCorrections.rows,year);
  const correctionRequestCount:number|null=authorizedPreviewScenario&&!localQaScenario
    ?recordedCorrections.count===null?null:scopedRecordedCorrections.length
    :overviewSource==='example'?correctionRequests.length:null;
  const openOverviewPayments=()=>navigate('history',{
    dashboardSource:overviewSource,dashboardOnlyCompleted:true
  });
  const openSavedDrafts=()=>{
    setFollowupTab('drafts');
    const list=document.getElementById('taxpayer-dashboard-draft-section');
    if(list && previewAccount?.id==='user1' && activePreviewSession()?.profileId==='user1'){
      list.scrollIntoView({behavior:'smooth',block:'start'});
      list.focus({preventScroll:true});
    }else setDraftHelpVisible(visible=>!visible);
  };
  const focusCorrectionRequests=()=>{
    setFollowupTab('requests');
    const target=document.getElementById('dashboard-correction-requests');
    target?.scrollIntoView({behavior:'smooth',block:'start'});
    target?.focus({preventScroll:true});
  };
  const overview=<div className="taxpay-bento-grid" data-testid="taxpayer-overview-bento"
    data-drafts-empty={savedDraftCount===0?'true':'false'} data-dashboard-empty={compactEmptyOverview?'true':'false'}>
    {verifiedExternalTaxPositionReady && <>
    <section className={panel+' taxpay-bento-position'} aria-labelledby="taxpay-bento-position-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="taxpay-bento-position-title" className="text-base font-semibold">{tr('Current tax position','বর্তমান কর অবস্থান')}</h2>
        {info(tr('Current tax position','বর্তমান কর অবস্থান'),'Recorded account scenario for the selected assessment year; this is not a verified government assessment.','নির্বাচিত করবর্ষের নথিভুক্ত হিসাব; এটি যাচাইকৃত সরকারি কর নির্ধারণ নয়।')}
      </div>
      <div className="taxpay-bento-position__highlight">
        <div className="taxpay-bento-position__balance"><p>{tr('Still remaining ·','অবশিষ্ট ·')} {year}</p>
          <strong>{money(totals.outstanding)}</strong></div>
        <div role="progressbar" aria-label={tr('Tax recorded as covered','নথিভুক্ত কর সমন্বয়')} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(meter(totals.applied,totals.liability))} className="taxpay-bento-position__track">
          <span style={{width:meter(totals.applied,totals.liability)+'%'}}/>
        </div>
        <p className="mt-2 text-xs">{Math.round(meter(totals.applied,totals.liability))}% {tr('covered for this assessment year','এই করবর্ষে সমন্বিত')}</p>
      </div>
      <dl className="taxpay-bento-position__totals">
        <div><dt>{tr('Total tax','মোট কর')}</dt><dd>{money(totals.liability)}</dd></div>
        <div><dt>{tr('Already covered','সমন্বিত')}</dt><dd>{money(totals.applied)}</dd></div>
      </dl>
      <p className="text-xs text-taxpay-muted">{tr('Travel tax (separate)','ভ্রমণ কর (পৃথক)')}: <strong className="tabular-nums text-taxpay-text">{money(totals.travel)}</strong></p>
      {view('ledger','View tax ledger','কর লেজার দেখুন')}
    </section>
    <section className="taxpay-bento-hero" aria-labelledby="taxpay-bento-hero-title">
      <p className="text-xs font-semibold">{tr('NEXT STEPS','পরবর্তী করণীয়')} · {year}</p>
      <h2 id="taxpay-bento-hero-title">{tr('What needs your attention?','কোন বিষয়গুলোতে নজর দেবেন?')}</h2>
      <p className="text-sm">{tr('Review exceptions or start a payment.','ব্যতিক্রম দেখুন অথবা পেমেন্ট শুরু করুন।')}</p>
      <div className="taxpay-bento-hero__actions">
        <button type="button" className="taxpay-bento-hero__secondary" onClick={()=>openAllTaxPayments()}>{tr('Pay tax','কর পরিশোধ')}<ArrowRight size={16} aria-hidden="true"/></button>

      </div>
      <div className="taxpay-bento-hero__status" aria-label={tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}>
        <button type="button" onClick={openOverviewPayments}><span>{tr('Completed Payments','সম্পন্ন পেমেন্ট')}</span><strong className="tabular-nums">{completedPayments}</strong></button>
        <button type="button" onClick={openSavedDrafts}><span>{tr('Saved Drafts','সংরক্ষিত খসড়া')}</span><strong className="tabular-nums">{savedDraftCount===null?'—':savedDraftCount}</strong></button>
        <button type="button" onClick={focusCorrectionRequests}><span>{tr('Correction Requests','সংশোধনের আবেদন')}</span><strong className="tabular-nums">{correctionRequestCount===null?'—':correctionRequestCount}</strong></button>
      </div>
      <button type="button" className="taxpay-bento-hero__review self-end min-h-10 px-2 text-sm font-medium text-taxpay-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary" onClick={()=>navigate('corrections')}>
        {tr('Review exceptions','ব্যতিক্রম দেখুন')}<ArrowRight size={15} className="ml-2 inline" aria-hidden="true"/>
      </button>
    </section>
    </>}
    <div className="taxpay-bento-request-row">
      <section className={panel+' taxpay-bento-hero taxpay-bento-summary'} aria-label={tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}>
        <div className="taxpay-overview-feature">
          <p className="taxpay-overview-feature__eyebrow"><FileCheck2 size={17} aria-hidden="true"/>
            {tr('PAYMENT ACTIVITY','পেমেন্ট কার্যক্রম')} · {year}</p>
          <h2>{tr('Payments at a glance','এক নজরে আপনার পেমেন্ট')}</h2>
          <h3 className="sr-only">{tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}</h3>
          <p className="taxpay-overview-feature__source" data-testid="dashboard-source-indicator">
            {overviewSource==='example'
              ?tr('Example activity (simulated) — not real payments or tax credits','উদাহরণভিত্তিক কার্যক্রম (সিমুলেশন) — প্রকৃত পেমেন্ট বা কর ক্রেডিট নয়')
              :tr('Payments linked to this session — not verified tax credits','এই সেশনের পেমেন্ট — যাচাইকৃত কর ক্রেডিট নয়')}
          </p>
          <div className="taxpay-overview-feature__main">
            <div className="taxpay-overview-feature__amount">
              <strong className="tabular-nums" data-testid="dashboard-overview-total">
                {overviewHasAmount?formatDashboardChartMoney(overviewProjection.totalMinor,language):'—'}
              </strong>
              <p>{overviewHasAmount
                ?([ ...overviewCompletedRows ].length
                  ?tr('Latest payment activity','সর্বশেষ পেমেন্ট কার্যক্রম')+': '+money([...overviewCompletedRows].sort(compareActivityNewestFirst)[0].amount)+' · '+formatDate([...overviewCompletedRows].sort(compareActivityNewestFirst)[0].date)
                  :tr('Payer-initiated allocations for this assessment year','এই করবর্ষে আপনার শুরু করা পেমেন্ট বরাদ্দ'))
                :overviewSource==='recorded'&&sqlLoadError
                  ?tr('Payment records could not be loaded','পেমেন্ট রেকর্ড লোড করা যায়নি')
                  :tr('No itemized payments for this year','এই করবর্ষে কোনো বিস্তারিত পেমেন্ট নেই')}</p>
            </div>
            {overviewHasAmount&&<div className="taxpay-overview-feature__chart">
              <svg viewBox="0 0 120 120" className="taxpay-overview-feature__donut" role="img"
                aria-label={tr('Distribution of payer-initiated payment activity','আপনার শুরু করা পেমেন্টের বিভাজন')}>
                <circle cx="60" cy="60" r="43" pathLength="100" strokeWidth="18" fill="none" stroke="rgba(255,255,255,.23)"/>
                {overviewServices.map((item,index)=>{
                  const share=Number(item.amountMinor*10000n/overviewProjection.totalMinor)/100;
                  const previous=overviewServices.slice(0,index).reduce((sum,row)=>sum+Number(row.amountMinor*10000n/overviewProjection.totalMinor)/100,0);
                  return <circle key={item.key} cx="60" cy="60" r="43" pathLength="100"
                    className={'taxpay-overview-feature__slice taxpay-overview-feature__slice--'+index}
                    strokeWidth="18" fill="none" strokeDasharray={share+' '+(100-share)}
                    strokeDashoffset={-previous} transform="rotate(-90 60 60)"/>;
                })}
                <text x="60" y="59" fill="#fff" textAnchor="middle" fontSize="19" fontWeight="700">
                  {dashboardChartPercentage(overviewServices[0]?.amountMinor??0n,overviewProjection.totalMinor)}%
                </text>
                <text x="60" y="73" fill="#e4efff" textAnchor="middle" fontSize="8">
                  {tr('Largest share','সর্বোচ্চ অংশ')}
                </text>
              </svg>
              <div className="taxpay-overview-feature__services" aria-label={tr('Payment service amounts','পেমেন্টের ধরন অনুযায়ী পরিমাণ')}>
                {overviewServices.map((item,index)=><div key={item.key} className="taxpay-overview-feature__service">
                  <span className={'taxpay-overview-feature__legend-dot taxpay-overview-feature__legend-dot--'+index} aria-hidden="true"/>
                  <span>{overviewServiceNames[item.key]}</span>
                  <strong className="tabular-nums">{formatDashboardChartMoney(item.amountMinor,language)}</strong>
                </div>)}
              </div>
            </div>}
          </div>
          <a href="?action=history" className="taxpay-overview-feature__action" onClick={event=>{event.preventDefault();openOverviewPayments();}}>
            {tr('View payment history','পেমেন্ট ইতিহাস দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
          </a>
        </div>
        <div className="taxpay-bento-hero__status" role="group" aria-label={tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}>
          <button type="button" className="taxpay-summary-metric taxpay-summary-metric--completed" onClick={openOverviewPayments}>
            <span className="taxpay-summary-metric__label"><FileCheck2 size={17} aria-hidden="true"/>{tr('Completed Payments','সম্পন্ন পেমেন্ট')}</span>
            <strong className="tabular-nums">{overviewSource==='recorded'&&(sqlLoadError||sqlLoading)?'—':completedPayments}</strong>
          </button>
          <button type="button" className="taxpay-summary-metric taxpay-summary-metric--drafts" onClick={openSavedDrafts}
            aria-expanded={draftHelpVisible && !(savedDraftCount!==null && savedDraftCount>0)}>
            <span className="taxpay-summary-metric__label"><FilePenLine size={17} aria-hidden="true"/>{tr('Saved Drafts','সংরক্ষিত খসড়া')}</span>
            <strong className="tabular-nums">{savedDraftCount===null?'—':savedDraftCount}</strong>
          </button>
          <button type="button" className="taxpay-summary-metric taxpay-summary-metric--requests" onClick={focusCorrectionRequests}>
            <span className="taxpay-summary-metric__label"><ReceiptText size={17} aria-hidden="true"/>{tr('Correction Requests','সংশোধনের আবেদন')}</span>
            <strong className="tabular-nums">{correctionRequestCount===null?'—':correctionRequestCount}</strong>
          </button>
        </div>
        {draftHelpVisible && !(savedDraftCount!==null && savedDraftCount>0) &&
          <p className="taxpay-summary-draft-hint" role="status">{savedDraftCount===null
            ?tr('Draft count unavailable. Sign in or refresh to check again.','খসড়ার সংখ্যা পাওয়া যায়নি। সাইন ইন করুন অথবা রিফ্রেশ করে আবার দেখুন।')
            :tr('No saved drafts yet. Use Save Draft during a payment to continue it later.','এখনও সংরক্ষিত খসড়া নেই। পরে চালু করতে পেমেন্টের সময় খসড়া সংরক্ষণ করুন।')}</p>}
      </section>
    <div className="taxpay-bento-tasks" aria-label={tr('Follow-ups','পরবর্তী করণীয়')}>
      <div className="taxpay-bento-tasks__heading">
        <h2>{tr('Follow-ups','পরবর্তী করণীয়')}</h2>
        <div className="taxpay-bento-tasks__tabs" role="group" aria-label={tr('Follow-up type','পরবর্তী করণীয়ের ধরন')}>
          <button type="button" aria-controls="taxpayer-dashboard-draft-section" aria-pressed={followupTab==='drafts'} onClick={()=>setFollowupTab('drafts')}>
            {tr('Drafts','খসড়া')} <span>{savedDraftCount===null?'—':savedDraftCount}</span>
          </button>
          <button type="button" aria-controls="dashboard-correction-requests" aria-pressed={followupTab==='requests'} onClick={()=>setFollowupTab('requests')}>
            {tr('Requests','আবেদন')} <span>{correctionRequestCount===null?'—':correctionRequestCount}</span>
          </button>
        </div>
      </div>
    <div className="taxpay-bento-drafts" id="taxpayer-dashboard-draft-section" tabIndex={-1} hidden={followupTab!=='drafts'}>
      {onResumePaymentDraft
        ? <DashboardPaymentDrafts language={language} onResume={onResumePaymentDraft}
            onCountChange={setSavedDraftCount} onStartPayment={()=>openAllTaxPayments()}/>
        : <section id="dashboard-payment-drafts" tabIndex={-1} data-testid="dashboard-payment-drafts"
            aria-labelledby="dashboard-payment-drafts-title" className={panel}>
            <h2 id="dashboard-payment-drafts-title" className="text-lg font-semibold text-taxpay-text">
              {tr('Saved payment drafts','সংরক্ষিত পেমেন্ট খসড়া')}
            </h2>
            <p className="mt-2 text-sm text-taxpay-muted" role="status">
              {tr('Draft actions are unavailable in this view.','এই দৃশ্যে খসড়ার কাজ পাওয়া যাচ্ছে না।')}
            </p>
          </section>}
    </div>
    <section id="dashboard-correction-requests" tabIndex={-1} className={panel+' taxpay-bento-corrections'} hidden={followupTab!=='requests'} aria-labelledby="dashboard-correction-requests-title">
      <h2 id="dashboard-correction-requests-title" className="text-base font-semibold">{tr('Correction Requests','সংশোধনের আবেদন')}</h2>
      {authorizedPreviewScenario&&!localQaScenario?<div className="mt-2 space-y-3">
        {recordedCorrections.phase==='loading'?<p role="status" className="text-sm text-taxpay-muted">{tr('Loading correction requests…','আবেদন লোড হচ্ছে…')}</p>
          :recordedCorrections.phase==='error'?<div role="alert" className="text-sm"><p>{tr('Correction request history unavailable.','আবেদনের ইতিহাস পাওয়া যাচ্ছে না।')}</p><button type="button" className={action+' mt-2'} onClick={recordedCorrections.retry}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>
          :scopedRecordedCorrections.length?<ul data-testid="dashboard-recorded-corrections" className="space-y-2">{scopedRecordedCorrections.slice(0,3).map(request=><li key={request.id} className="rounded-lg border border-taxpay-border p-3 min-w-0">
            <p className="break-all text-sm font-semibold">{request.originalReference}</p><p className="text-sm text-taxpay-muted">{previewCorrectionStatus(request,language)} · {request.currentAY} → {request.proposedAY}</p><p className="text-sm break-words">{request.reason}</p>
          </li>)}</ul>:<p role="status" className="text-sm text-taxpay-muted">{tr('No correction requests yet.','এখনো কোনো সংশোধনের আবেদন নেই।')}</p>}
        <button type="button" className={action} onClick={()=>navigate('corrections')}>{tr('View requests','আবেদন দেখুন')}<ArrowRight size={15} aria-hidden="true"/></button>
      </div>:<>
      <p className="mt-2 text-sm text-taxpay-muted">{overviewSource==='example'
        ?tr('Example requests and their displayed status.','উদাহরণভিত্তিক আবেদন ও প্রদর্শিত অবস্থা।')
        :tr('Correction request status is not available for this session.','এই সেশনে সংশোধনের আবেদনের অবস্থা পাওয়া যাচ্ছে না।')}</p>
      {correctionRequests.length ? <ul data-testid="dashboard-correction-request-list" className="mt-3 space-y-2">
        {correctionRequests.map(request=><li key={request.id} className="min-w-0 rounded-lg border border-taxpay-border bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-taxpay-text">{request.title}</h3>
            {tag(request.state)}
          </div>
          <p className="mt-1 text-xs text-taxpay-muted"><time dateTime={request.date}>{formatDate(request.date)}</time></p>
          <p className="mt-2 text-sm leading-5 text-taxpay-text">{request.detail}</p>
          <button type="button" className={action+' mt-2'} onClick={()=>setSelected(request)}
            aria-label={tr('View request details for ','আবেদনের বিস্তারিত: ')+request.title}>
            {tr('View details','বিস্তারিত দেখুন')}<ArrowRight size={15} aria-hidden="true"/>
          </button>
        </li>)}
      </ul> : overviewSource==='example'
        ?<p className="mt-3 text-sm text-taxpay-muted" role="status">{tr('No example requests for this assessment year.','এই করবর্ষে কোনো উদাহরণভিত্তিক আবেদন নেই।')}</p>
        :<p className="mt-3 text-sm text-taxpay-muted" role="status">{tr('No correction requests are recorded for this session.','এই সেশনের জন্য কোনো সংশোধন আবেদন সংরক্ষিত নেই।')}</p>}</>}
    </section>
    </div>
    </div>
    <div className="taxpay-bento-recent">
    <section className={panel} aria-labelledby="taxpayer-recent-activity-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="taxpayer-recent-activity-title" className="text-base font-semibold">{tr('My Tax Journey','আমার কর যাত্রা')}</h2>
        {view('history','View all activity','সব কার্যক্রম দেখুন')}
      </div>
      <p className="mt-1 text-xs text-taxpay-muted">{overviewSource==='example'
        ?tr('Example payer-initiated activity','উদাহরণভিত্তিক পরিশোধকারীর কার্যক্রম')
        :tr('Saved session payment activity','সংরক্ষিত সেশন পেমেন্ট কার্যক্রম')} · {tr('Assessment year','করবর্ষ')}: {year}</p>
      <ul className="mt-3 divide-y divide-taxpay-border" aria-label={tr('Latest transactions in selected year','নির্বাচিত করবর্ষের সাম্প্রতিক লেনদেন')}>
        {[...overviewCompletedRows].sort(compareActivityNewestFirst).slice(0,5).map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-taxpay-text">{item.title}</p>
            <p className="mt-1 text-xs text-taxpay-muted"><time dateTime={item.date}>{formatDate(item.date)}</time> · {tr(...labels[item.kind])}</p>
          </div>
          <p className="whitespace-nowrap text-sm font-semibold tabular-nums">{money(item.amount)}</p>
          {overviewSource==='recorded'&&<div>{tag(item.state)}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={action} onClick={()=>setSelected(item)} aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>
            {item.sql?.reuse && <button type="button" className={action} onClick={()=>payAgain(item)}>
              {tr('Pay Again','আবার পরিশোধ')}
            </button>}
          </div>
        </li>)}
      </ul>
      {!overviewCompletedRows.length&&!(overviewSource==='recorded'&&(sqlLoadError||sqlLoading))&&<p role="status" className="mt-3 text-sm text-taxpay-muted">{tr('No completed payment activity for the selected assessment year.','নির্বাচিত করবর্ষে সম্পন্ন পেমেন্ট নেই।')}</p>}
      {overviewSource==='recorded'&&sqlLoading&&<p role="status" className="mt-2 text-sm text-taxpay-muted">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>}
      {overviewSource==='recorded'&&sqlLoadError&&<p role="alert" className="mt-2 text-sm text-taxpay-error">{tr('Account-linked payment records could not be loaded. No example activity is included in this overview.','অ্যাকাউন্টের পেমেন্ট রেকর্ড লোড হয়নি। এই বিবরণে কোনো নমুনা কার্যক্রম যুক্ত করা হয়নি।')}</p>}
    </section>
    </div>
    <BentoPaymentAnalytics
      records={dashboardChartRecords}
      people={savedTagPeople}
      year={year}
      ownerTin={DEMO_USERS.user1.tin}
      language={language}
      sourceLoadError={overviewSource==='recorded'&&sqlLoadError}
      allowExamples={localQaScenario}
      previewOnlyExamples={false}
      selectedSource={overviewSource}
      onSourceChange={source=>{if(localQaScenario)setOverviewSourceChoice({year,source});}}
      onManageBeneficiaries={()=>navigate('beneficiaries')}
      onOpenBeneficiary={tin=>navigate('beneficiaries',{
        openBeneficiaryTin:tin,returnTo:'taxpayer_home'
      })}
      onOpenHistory={(tag,service,recipientTin)=>navigate('history',{
        dashboardSource:overviewSource,dashboardOnlyCompleted:true,
        ...(tag?{dashboardTagFilter:tag}:{}),
        ...(service&&service!=='all'?{dashboardService:service}:{}),
        ...(recipientTin?{dashboardRecipientTin:recipientTin}:{})
      })}
    />
  </div>;
  // A single event projection powers every supported assessment year; a record is
  // never promoted into an official balance just because its scenario state is POSTED.
  const ledgerEvents:TaxAccountEvent[]=showIllustrativeRecords?taxYears.flatMap(assessment=>{
    let running=assessment.liability*100;
    const opening:TaxAccountEvent={
      id:'OPEN-'+assessment.year,occurredAt:assessment.year.slice(0,4)+'-07-01T00:00:00Z',
      code:'LIABILITY_CREATED',title:tr('Opening liability','প্রাথমিক করদায়'),
      assessmentYear:assessment.year,component:tr('Income tax','আয়কর'),
      amountMinor:running,effectMinor:running,balanceAfterMinor:running,
      actor:'System',source:'Account scenario',taxEventId:'OPEN-'+assessment.year,
      reference:'LIABILITY-'+assessment.year,status:'Recorded',
      reason:tr('Opening assessment-year liability.','করবর্ষের প্রাথমিক দায়।')
    };
    const lines=events.filter(item=>item.year===assessment.year).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    const entries=lines.map(item=>{
      const accepted=item.state==='POSTED'&&['tds','ait','income'].includes(item.kind);
      const effect=accepted?-item.amount*100:null;
      if(effect!==null)running+=effect;
      const code=item.kind==='tds'?'TDS_'+item.state:
        item.kind==='ait'?'ADVANCE_TAX_'+item.state:
        item.kind==='refund'?'REFUND_'+item.state:
        item.kind==='adjustment'?'CORRECTION_'+item.state:
        item.kind==='travel'?'TRAVEL_TAX_'+item.state:'PAYMENT_'+item.state;
      return {
        id:item.id,occurredAt:item.date+'T00:00:00Z',code,title:item.title,
        assessmentYear:item.year,component:tr(...labels[item.kind]),
        amountMinor:item.amount*100,effectMinor:effect,balanceAfterMinor:running,
        actor:'System',source:item.channel,taxEventId:item.id,
        paymentId:['income','ait','travel'].includes(item.kind)?item.ref:undefined,
        challanNo:item.challan,reference:item.ref,status:tr(...stateLabels[item.state]),
        reason:item.detail,linkedReferences:[item.ref,...(item.challan?[item.challan]:[])]
      } satisfies TaxAccountEvent;
    });
    return [opening,...entries];
  }):sqlRows.flatMap(row=>{
    const receipts=row.sql?.receipts??[];
    const lines=receipts.flatMap(receipt=>(receipt.allocationItems??[]).map((line,index)=>({
      id:receipt.paymentTransactionId+':'+index,year:normalizeAY(line.assessmentYear),amountMinor:line.amountMinor,
      component:bn?line.paymentServiceBn:line.paymentServiceEn
    })));
    // A legacy multi-year payment without exact allocations is one unallocated record, never repeated by year.
    const entries=lines.length&&lines.reduce((sum,line)=>sum+line.amountMinor,0)===Math.round(row.amount*100)?lines:[{id:row.id,year:row.years?.length===1?row.year:'—',amountMinor:Math.round(row.amount*100),component:row.title}];
    return entries.map(line=>({id:line.id,occurredAt:row.occurredAt??row.date,code:'PAYMENT_RECORD_PRESENT',title:row.title,assessmentYear:line.year,component:line.component,
      amountMinor:line.amountMinor,effectMinor:null,balanceAfterMinor:null,actor:tr('Not recorded','নথিভুক্ত নয়'),source:tr('Recorded payment','নথিভুক্ত পেমেন্ট'),paymentId:row.ref,reference:row.ref,status:tr('Recorded','রেকর্ড হয়েছে'),reason:row.detail}));
  });
  const visibleLedgerTotals=ledgerYear==='all'
    ? taxYears.map(y=>yearSummary(y.year)!).reduce((sum,item)=>({
      liability:sum.liability+item.liability,applied:sum.applied+item.applied,
      outstanding:sum.outstanding+item.outstanding
    }),{liability:0,applied:0,outstanding:0})
    : yearSummary(ledgerYear)||totals;
  const ledger=<>
    {showIllustrativeRecords&&<section className="grid gap-3 sm:grid-cols-3" aria-label={tr('Assessment-year summary','করবর্ষের সারসংক্ষেপ')}>
      {card('Tax liability','করদায়',money(visibleLedgerTotals.liability),'Opening liabilities','প্রাথমিক দায়')}
      {card('Applied credits','প্রয়োগকৃত ক্রেডিট',money(visibleLedgerTotals.applied),'Posted source, advance and direct entries','উৎসে কর, অগ্রিম কর ও সরাসরি এন্ট্রি')}
      {card('Remaining balance','অবশিষ্ট দায়',money(visibleLedgerTotals.outstanding),'Scenario journal, not an official NBR balance','সরকারি এনবিআর ব্যালেন্স নয়')}
    </section>}
    {sqlLoading&&<p role="status" className="text-sm text-taxpay-muted">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>}
    {sqlLoadError&&<div role="alert" className="text-sm text-taxpay-error">{tr('Recorded payments could not be verified.','সংরক্ষিত পেমেন্ট যাচাই করা যায়নি।')} <button type="button" className={action} onClick={retryRecordedPayments}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>}
    <EventBasedTaxLedger events={ledgerEvents} language={language} year={ledgerYear} showRecordedScenarioBalance={showIllustrativeRecords}
      onYearChange={nextYear=>nextYear==='all'?setLedgerYear('all'):changeYear(nextYear)}
      onOpenPayment={reference=>{const record=activityRecords.find(item=>item.ref===reference);if(record)setSelected(record);}}/>
  </>;

  // Records, exceptions and beneficiary entries use the same column-driven grid.
  // Preserve the existing case/receipt details modal and never suggest that
  // a recorded payment automatically means a government receipt was issued.
  const allDocumentRecords=scoped.filter(x=>x.state==='POSTED'&&(Boolean(x.sql?.receipts.length)||x.challan||x.kind==='tds'));
  const documentNeedle=documentSearch.trim().toLocaleLowerCase();
  const documentRecords=allDocumentRecords.filter(x=>(x.title+' '+x.ref+' '+(x.challan||'')+' '+tr(...labels[x.kind]))
    .toLocaleLowerCase().includes(documentNeedle));
  const documents=<>
    <section className={panel} data-testid="issued-tax-credit-certificates" aria-labelledby="sample-tax-credit-certificates-title">
      <h2 id="sample-tax-credit-certificates-title" className="text-base font-semibold">{tr('Tax Credit Certificates','কর ক্রেডিট সনদপত্র')}</h2>
      <p className="mt-2 text-sm text-taxpay-muted" role="status">{tr('No issuer-verified tax credit certificates are linked to this account. Payment records below are not issued tax credit certificates.', 'এই অ্যাকাউন্টে ইস্যুকারী কর্তৃপক্ষের যাচাইকৃত কর ক্রেডিট সনদপত্র নেই। নিচের পেমেন্ট রেকর্ড ইস্যুকৃত কর ক্রেডিট সনদপত্র নয়।')}</p>
    </section>
    <section className={panel+' taxpayer-records-panel taxpay-office-register-frame'} aria-labelledby="taxpayer-documents-heading">
    <TaxPayOfficeRegisterToolbar id="taxpayer-documents-heading"
      title={tr('Payment records and supporting references','পেমেন্ট রেকর্ড ও সহায়ক রেফারেন্স')}
      description={tr('Open a record to check its payment details. A recorded entry is not itself an issued certificate.','পেমেন্টের বিস্তারিত দেখতে রেকর্ড খুলুন। নথিভুক্ত তথ্য নিজে কোনো ইস্যুকৃত সনদ নয়।')}
      count={documentRecords.length} total={allDocumentRecords.length} countLabel={tr('records','রেকর্ড')}
      searchValue={documentSearch} onSearchChange={setDocumentSearch}
      searchLabel={tr('Search payment references','পেমেন্ট রেফারেন্স খুঁজুন')}
      searchPlaceholder={tr('Search name or reference','নাম বা রেফারেন্স খুঁজুন')}/>
    <TaxPayActiveFilterChips clearLabel={tr('Clear search','অনুসন্ধান মুছুন')}
      onClear={()=>setDocumentSearch('')}
      filters={documentSearch.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+documentSearch.trim(),onRemove:()=>setDocumentSearch('')}]:[]}/>
    {documentRecords.length?<div className="mt-4">
      <TaxPayDataGrid variant="documents" rows={documentRecords} getRowKey={x=>x.id}
        ariaLabel={tr('Payment records and supporting references','পেমেন্ট রেকর্ড ও সহায়ক রেফারেন্স')}
        columns={[
          {key:'name',header:tr('Payment','পেমেন্ট'),renderCell:x=><div>
            <h3 className="text-sm font-semibold text-taxpay-text">{x.title}</h3>
            <p className="mt-1 text-sm text-taxpay-muted">{tr(...labels[x.kind])}</p>
          </div>},
          {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:x=><p className="break-all text-sm text-taxpay-muted">{x.challan||x.ref}</p>},
          {key:'amount',header:tr('Amount','পরিমাণ'),renderCell:x=><p className="text-sm font-semibold tabular-nums">{money(x.amount)}</p>},
          {key:'action',header:tr('Actions','কার্যক্রম'),renderCell:x=><button type="button" className={action}
            onClick={()=>setSelected(x)} aria-label={tr('View payment details for ','পেমেন্টের বিস্তারিত: ')+x.title}>{tr('View details','বিস্তারিত দেখুন')}</button>}
        ]}/>
    </div>:sqlLoading?<p role="status" className="taxpay-table-state mt-4">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>:sqlLoadError?<div role="alert" className="taxpay-table-state mt-4">{tr('Recorded payments could not be verified.','সংরক্ষিত পেমেন্ট যাচাই করা যায়নি।')} <button type="button" className={action} onClick={retryRecordedPayments}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>:<p role="status" className="taxpay-table-state mt-4">{documentSearch?tr('No payment records match this search.','এই অনুসন্ধানে কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।'):tr('No recorded payment references for this assessment year.','এই করবর্ষে কোনো পেমেন্ট রেফারেন্স নেই।')}</p>}
    <TaxPayOfficeRegisterFooter shown={documentRecords.length} total={allDocumentRecords.length}
      labels={{showing:tr('Showing','দেখানো হচ্ছে'),of:tr('of','মোট'),records:tr('records','রেকর্ড')}}/>
  </section></>;
  const allCorrectionRecords=scoped.filter(x=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(x.state));
  const caseNeedle=caseSearch.trim().toLocaleLowerCase();
  const correctionRecords=allCorrectionRecords.filter(x=>(caseStatus==='all'||x.state===caseStatus)&&
    (x.title+' '+x.ref+' '+x.detail+' '+tr(...stateLabels[x.state])).toLocaleLowerCase().includes(caseNeedle));
  const exceptions=<>
    {!showIllustrativeRecords&&<p role="status" className="text-sm text-taxpay-muted">{tr('Only verified payment records are shown. Correction status requires the account correction register.','শুধু যাচাইকৃত পেমেন্ট রেকর্ড দেখানো হচ্ছে। সংশোধনের অবস্থা দেখতে অ্যাকাউন্ট সংশোধন রেজিস্টার প্রয়োজন।')}</p>}
    {showIllustrativeRecords&&<div className="grid gap-3 sm:grid-cols-3">
      {card('Awaiting reconciliation','সমন্বয়ের অপেক্ষায়',String(allCorrectionRecords.filter(x=>x.state==='PENDING').length),'Not yet counted as a tax credit','এখনো কর ক্রেডিট হিসেবে গণনা হয়নি')}
      {card('Refund or adjustment inquiries','ফেরত বা সমন্বয়ের আবেদন',String(allCorrectionRecords.filter(x=>x.state==='REQUESTED').length),'A request does not mean approval','আবেদন মানেই অনুমোদন নয়')}
      {card('Failed, reversed or disputed','ব্যর্থ, প্রত্যাবর্তিত বা বিরোধপূর্ণ',String(allCorrectionRecords.filter(x=>['DISPUTED','FAILED','REVERSED'].includes(x.state)).length),'Excluded from confirmed tax credits','নিশ্চিত কর ক্রেডিটে অন্তর্ভুক্ত নয়')}
    </div>}
    <section className={panel+' taxpayer-records-panel taxpay-office-register-frame'} aria-labelledby="taxpayer-exceptions-heading">
      <TaxPayOfficeRegisterToolbar id="taxpayer-exceptions-heading"
        title={tr('Cases requiring attention','যেসব বিষয়ে নজর দেওয়া প্রয়োজন')}
        description={tr('Review the recorded reason and status. These entries do not establish a tax credit.','নথিভুক্ত কারণ ও অবস্থা দেখুন। এসব এন্ট্রি কর ক্রেডিট নিশ্চিত করে না।')}
        count={correctionRecords.length} total={allCorrectionRecords.length} countLabel={tr('cases','বিষয়')}
        searchValue={caseSearch} onSearchChange={setCaseSearch}
        searchLabel={tr('Search case references','বিষয়ের রেফারেন্স খুঁজুন')}
        searchPlaceholder={tr('Search case or reference','বিষয় বা রেফারেন্স খুঁজুন')}
        filterLabel={tr('Filter','ফিল্টার')} filtersOpen={caseFiltersExpanded}
        onToggleFilters={()=>setCaseFiltersExpanded(open=>!open)}/>
      <TaxPayOfficeRegisterFilters open={caseFiltersExpanded} className="taxpayer-transaction-filters taxpay-record-page-filters">
        <label className="taxpayer-transaction-filter"><span>{tr('Status','অবস্থা')}</span>
          <select value={caseStatus} aria-label={tr('Filter case status','বিষয়ের অবস্থা ফিল্টার')}
            onChange={e=>setCaseStatus(e.target.value as State|'all')}>
            <option value="all">{tr('All statuses','সব অবস্থা')}</option>
            {(['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'] as const).map(state=><option key={state} value={state}>{tr(...stateLabels[state])}</option>)}
          </select>
        </label>
      </TaxPayOfficeRegisterFilters>
      <TaxPayActiveFilterChips clearLabel={tr('Clear all','সব ফিল্টার মুছুন')}
        onClear={()=>{setCaseSearch('');setCaseStatus('all');}}
        filters={[
          ...(caseSearch.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+caseSearch.trim(),onRemove:()=>setCaseSearch('')}]:[]),
          ...(caseStatus!=='all'?[{key:'status',label:tr(...stateLabels[caseStatus]),onRemove:()=>setCaseStatus('all')}]:[])
        ]}/>
      {correctionRecords.length?<div className="mt-4">
        <TaxPayDataGrid variant="exceptions" rows={correctionRecords} getRowKey={x=>x.id}
          ariaLabel={tr('Correction and exception cases','সংশোধন ও ব্যতিক্রমের তালিকা')}
          columns={[
            {key:'case',header:tr('Case','বিষয়'),renderCell:x=><div>
              <h3 className="text-sm font-semibold text-taxpay-text">{x.title}</h3>
              <p className="mt-1 text-sm text-taxpay-muted"><time dateTime={x.date}>{formatDate(x.date)}</time></p>
              <p className="break-all text-xs text-taxpay-muted">{x.ref}</p>
            </div>},
            {key:'reason',header:tr('Recorded reason','নথিভুক্ত কারণ'),renderCell:x=><p className="text-sm text-taxpay-text">{x.detail}</p>},
            {key:'status',header:tr('Status','অবস্থা'),renderCell:x=><div>{tag(x.state)}</div>},
            {key:'action',header:tr('Actions','কার্যক্রম'),renderCell:x=><button type="button" className={action}
              onClick={()=>setSelected(x)} aria-label={tr('View case details for ','বিষয়ের বিস্তারিত: ')+x.title}>{tr('View details','বিস্তারিত দেখুন')}</button>}
          ]}/>
      </div>:<p role="status" className="taxpay-table-state mt-4">{caseSearch||caseStatus!=='all'?tr('No cases match the selected filters.','নির্বাচিত ফিল্টারে কোনো বিষয় পাওয়া যায়নি।'):showIllustrativeRecords?tr('No unresolved or disputed records for this assessment year.','এই করবর্ষে কোনো অমীমাংসিত বা বিরোধপূর্ণ রেকর্ড নেই।'):tr('Correction register status unavailable.','সংশোধন রেজিস্টারের অবস্থা পাওয়া যাচ্ছে না।')}</p>}
      <TaxPayOfficeRegisterFooter shown={correctionRecords.length} total={allCorrectionRecords.length}
        labels={{showing:tr('Showing','দেখানো হচ্ছে'),of:tr('of','মোট'),records:tr('cases','বিষয়')}}/>
    </section>
  </>;

  // The same immutable payment records feed Transactions, Tax Ledger and this journey.
  // Group by calendar year, not assessment year; do not manufacture posting milestones.
  const journeyEvents=[...activityRecords].sort(compareActivityNewestFirst);
  const journeyCalendarYears=[...new Set(journeyEvents.map(item=>item.date.slice(0,4)))];
  const journey=<section className={panel+' taxpayer-payment-journey'} aria-labelledby="taxpayer-journey-events-heading" data-testid="taxpay-payment-journey">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="taxpayer-journey-events-heading" className="text-lg font-semibold">{tr('Tax journey','কর যাত্রা')}</h2>
        {sub('Payment activity across calendar years. Open any event for complete details.','বছর অনুযায়ী পেমেন্টের কার্যক্রম। বিস্তারিত দেখতে ঘটনা খুলুন।')}</div>
      {view('history','Transaction history','লেনদেনের ইতিহাস')}
    </div>
    <p className="mt-3 text-xs text-taxpay-muted" role="note">
      {tr('Recorded payment events only. An attempt, a saved receipt and a verified tax credit are different statuses.',
        'শুধু নথিভুক্ত পেমেন্টের ঘটনা। পেমেন্ট প্রচেষ্টা, সংরক্ষিত রসিদ এবং যাচাইকৃত কর ক্রেডিট আলাদা অবস্থা।')}
    </p>
    {!journeyEvents.length&&(sqlLoading?<p role="status" className="mt-5 text-sm text-taxpay-muted">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>:sqlLoadError?<div role="alert" className="mt-5 text-sm text-taxpay-error">{tr('Recorded payments could not be verified.','সংরক্ষিত পেমেন্ট যাচাই করা যায়নি।')} <button type="button" className={action} onClick={retryRecordedPayments}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>:<p role="status" className="mt-5 text-sm text-taxpay-muted">{tr('No transactions yet.','এখনও কোনো লেনদেন নেই।')}</p>)}
    <div className="mt-5 space-y-6">
      {journeyCalendarYears.map(calendarYear=><section key={calendarYear} aria-label={calendarYear}>
        <h3 className="mb-3 text-xl font-semibold text-taxpay-text">{calendarYear}</h3>
        <ol className="space-y-0" aria-label={tr('Payment events in ','এই বছরের পেমেন্ট ঘটনা: ')+calendarYear}>
          {journeyEvents.filter(item=>item.date.startsWith(calendarYear)).map(item=>
            <li key={item.id} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
              <time dateTime={item.date} className="pt-1 text-right text-xs text-taxpay-muted">{formatDate(item.date)}</time>
              <div className="relative border-l-2 border-taxpay-border pb-5 pl-5 last:pb-0">
                <span className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full bg-taxpay-primary" aria-hidden="true"/>
                <button type="button" onClick={()=>setSelected(item)} aria-label={tr('View details for ','বিস্তারিত দেখুন: ')+item.title}
                  className="w-full min-w-0 rounded-lg p-1 text-left hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
                  <span className="block text-sm font-semibold text-taxpay-text">{item.title} · {money(item.amount)}</span>
                  <span className="mt-1 block break-words text-xs text-taxpay-muted">
                    {tr('AY ','করবর্ষ ')}{item.year} · {tr(...stateLabels[item.state])} · {tr(...labels[item.kind])}
                  </span>
                  <span className="mt-1 block break-all text-xs text-taxpay-muted">{item.ref} · {item.detail}</span>
                </button>
              </div>
            </li>)}
        </ol>
      </section>)}
    </div>
  </section>;
  const profile=<User1TaxpayerProfile language={language}/>;
  const notifications=<><section className={panel}><h2 className="text-base font-semibold">{tr('Recent updates','সাম্প্রতিক আপডেট')}</h2><div className="mt-3 space-y-3">{scoped.filter(x=>x.state!=='POSTED').map(x=><article className="rounded-xl border border-slate-200 p-3" key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{x.title}</h3>{tag(x.state)}</div><p className="mt-1 text-xs text-slate-500">{x.date} · {x.ref}</p><p className="mt-2 text-sm">{x.detail}</p><button className={action+' mt-2'} type="button" onClick={()=>setSelected(x)}>{tr('View reference','রেফারেন্স দেখুন')}</button></article>)}</div></section>{authorizedPreviewScenario&&<PreviewCorrectionNotifications/>}</>;
  const settings=<section className={panel+' taxpayer-preferences'}>
    <h2 className="text-lg font-semibold">{tr('Display preferences','প্রদর্শনের পছন্দ')}</h2>
    {sub('Choose the language used throughout your taxpayer workspace.','করদাতা ওয়ার্কস্পেসের ভাষা নির্বাচন করুন।')}
    <label className="mt-5 flex max-w-sm flex-col gap-2 text-sm font-medium" htmlFor="taxpayer-preview-language">
      {tr('Interface language','ইন্টারফেসের ভাষা')}
      <select id="taxpayer-preview-language" className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm" value={language} onChange={e=>setLanguage(e.target.value as 'en'|'bn')}>
        <option value="en">English</option><option value="bn">বাংলা</option>
      </select>
    </label>
    <div className="mt-6 border-t border-taxpay-border pt-4">
      <h3 className="text-base font-semibold">{tr('Account information','অ্যাকাউন্টের তথ্য')}</h3>
      <button type="button" className={action+' mt-3'} onClick={()=>navigate('account_profile')}>{tr('View profile','প্রোফাইল দেখুন')}<ArrowRight size={16} aria-hidden="true"/></button>
    </div>
  </section>;
  const content=route==='ledger'?ledger:route==='history'?transactionList:route==='certificates'?documents:
    route==='corrections'&&authorizedPreviewScenario
      ?<>{localQaScenario&&routeParams?.applyForCorrection!==true&&exceptions}<CorrectionRequests historyOnly={routeParams?.applyForCorrection!==true} assessmentYear={correctionYear}
        historicalRecords={historicalCorrectionRecords} recordedReceipts={sqlRows.flatMap(row=>row.sql?.receipts??[])}
        preferredReference={typeof routeParams.originalReference==='string'?routeParams.originalReference:''}/></>
      :route==='corrections'?exceptions:route==='journey'?journey:route==='account_profile'?profile:route==='account_notifications'?notifications:route==='account_settings'?settings:overview;
  return <div data-testid="user1-synthetic-workspace" data-payment-source-state={sqlLoadError?'error':sqlLoading?'loading':'ready'} data-taxpay-register-page={["history","ledger","certificates","corrections"].includes(route)?"true":undefined} data-dashboard-view={overviewRoute?'true':undefined} className={'taxpayer-workspace mx-auto max-w-7xl space-y-4 pb-12 '+(bn?'font-bengali':'')}>
    {overviewRoute && <section aria-label={tr('Welcome','স্বাগতম')} className="space-y-1 px-1">
      <p className="text-sm text-taxpay-muted">{greeting.salutation}</p>
      <p className="text-lg font-semibold text-taxpay-text">{greeting.welcome}</p>
    </section>}
    {header}
    {activityTabs && <TaxpayerActivityTabs />}
    {content}
    {route==='history'&&activePreviewSession()?.profileId==='user1'&&<LegacyPaymentRecovery language={language}/>}
    {selected && <TaxPayModal
      title={selected.title}
      onClose={() => setSelected(null)}
      closeIconLabel={tr('Close transaction details','লেনদেনের বিস্তারিত বন্ধ করুন')}
      className="taxpayer-transaction-detail"
      hideFooter={!selected.sql&&!canApplyCorrection(selected)}
      footer={!selected.sql&&canApplyCorrection(selected)?<button type="button" className={action} data-testid="historical-detail-apply-correction" onClick={()=>applyForCorrection(selected)}>{tr('Apply for Correction','সংশোধনের আবেদন')}</button>:<></>}
    >
      {selected.sql?<section className="space-y-4">
        {/* The same transaction ID is already shown in the receipt identity fields. */}
        {selected.sql.receipts.length
          ?selected.sql.receipts.map((receipt,index)=><ReceiptView receipt={receipt}
            key={receipt.paymentTransactionId} embedded accountRecordView suppressFooterActions={index>0}
            payAgainTestId="recorded-pay-again-detail"
            transactionActions={index===0}
            onPayAgain={index===0&&selected.sql?.reuse?()=>payAgain(selected):undefined}
            onApplyForCorrection={index===0?()=>applyForCorrection(selected):undefined}/>)
          :<p role="status">{tr('Original allocations unavailable; payment cannot be repeated.',
            'আগের বরাদ্দের তথ্য নেই; পেমেন্ট পুনরায় করা যাবে না।')}</p>}

      </section>:<PaymentLifecycleDetails language={language} record={{
        reference:selected.ref,taxEventId:selected.id,challanNo:selected.challan,
        payerName:selected.kind==='income'?DEMO_USERS.user1.nameEn:undefined,
        payerTin:selected.kind==='income'?DEMO_USERS.user1.tin:undefined,
        taxpayerName:DEMO_USERS.user1.nameEn,taxpayerTin:DEMO_USERS.user1.tin,
        assessmentYear:selected.year,paymentType:tr(...labels[selected.kind]),
        taxCircle:DEMO_USERS.user1.taxCircle,channel:selected.channel,
        amountMinor:selected.amount*100,createdAt:selected.date+'T00:00:00Z',
        status:tr(...stateLabels[selected.state]),
        financialReceiptStatus:tr('Not verified','যাচাই হয়নি'),
        taxCreditStatus:tr('Not verified','যাচাই হয়নি'),
        source:selected.channel,
        events:[{id:selected.id,title:selected.title,occurredAt:selected.date+'T00:00:00Z',
          source:selected.channel,note:selected.detail}],
      }}/>}
    </TaxPayModal>}
    {correctionTarget && canApplyCorrection(correctionTarget) ? (
      <TaxPayModal
        title={tr('Apply for Correction','সংশোধনের আবেদন')}
        onClose={() => setCorrectionTarget(null)}
        closeIconLabel={tr('Close correction form','সংশোধনের ফরম বন্ধ করুন')}
        footer={<></>}
        className="taxpayer-correction-modal"
      >
        <CorrectionRequests
          embedded
          onViewRequests={()=>{setCorrectionTarget(null);setCorrectionYear('all');navigate('corrections');}}
          recordedReceipts={correctionTarget.sql?.receipts??[]}
          historicalRecords={correctionTarget.sql?[]:historicalCorrectionRecords}
          preferredReference={correctionTarget.sql?.receipts[0]?.challanNo??correctionTarget.ref}
        />
      </TaxPayModal>
    ) : null}
  </div>;
};
