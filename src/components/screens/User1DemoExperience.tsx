import {TaxPayUnifiedTable,TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter} from '../ui/TaxPayDataTable';
import React, {useEffect, useMemo, useState} from 'react';
import {Activity, ArrowRight, Bell, BookOpen, CalendarDays, CircleAlert, CreditCard, Download, Info, FileCheck2, FilePenLine, FileText, Landmark, ReceiptText, Search, ShieldCheck, WalletCards} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {DemoServiceRecordsPanel} from './DemoServiceRecordsPanel';
import {TaxpayerFinancialKpi} from './TaxpayerFinancialKpi';
import {DEMO_USERS} from '../../data/demoUsers';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {taxpayerGreeting} from '../../services/taxpayerGreeting';
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
  id:string; year:string; date:string; kind:Kind; amount:number; state:State;
  title:string; detail:string; channel:string; ref:string; challan?:string;
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
  {id:'U1-006',year:'2025-2026',date:'2026-04-08',kind:'travel',amount:6500,state:'POSTED',title:'Travel tax payment',detail:'Separate travel-tax category; not an income-tax credit',channel:'Card channel (unverified)',ref:'DEMO-TRAVEL-01',challan:'DEMO-CH-TRAVEL-01'},
  {id:'U1-007',year:'2025-2026',date:'2026-06-21',kind:'income',amount:30000,state:'POSTED',title:'Tax with return — part 1',detail:'Payment status and ledger allocation',channel:'Bank transfer channel (unverified)',ref:'DEMO-PAY-01',challan:'DEMO-CH-INC-01'},
  {id:'U1-008',year:'2025-2026',date:'2026-09-14',kind:'income',amount:45000,state:'POSTED',title:'Tax with return — part 2',detail:'Payment status and linked ledger entry',channel:'Mobile banking channel (unverified)',ref:'DEMO-PAY-02',challan:'DEMO-CH-INC-02'},
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
export const user1DemoRoutes:readonly string[]=['taxpayer_home','dashboard','history','ledger','journey','certificates','corrections','account_profile','account_notifications','account_settings'];
export const User1DemoExperience:React.FC<{route:string;activityTabs?:boolean}>=({route,activityTabs=false})=>{
  const {navigate,language,setLanguage,routeParams}=useTaxState();
  const bn=language==='bn';
  const greeting=taxpayerGreeting(language,new Date().getHours(),bn?DEMO_USERS.user1.nameBn:DEMO_USERS.user1.nameEn,true);
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [year,setYear]=useState<string>(()=>{
    const initial=new URLSearchParams(window.location.search).get('scenarioYear');
    return taxYears.some(x=>x.year===initial) ? initial! : '2025-2026';
  });
  const changeYear=(nextYear:string)=>{
    setYear(nextYear);
    setLedgerYear(nextYear);
    setMonthFilter('all');
    const url=new URL(window.location.href);
    url.searchParams.set('scenarioYear',nextYear);
    // Never carry the previous tax year's calendar month into the next year.
    url.searchParams.delete('monthFilter');
    window.history.replaceState(window.history.state,'',url);
  };
  const [ledgerYear,setLedgerYear]=useState<string>(year);
  const [documentSearch,setDocumentSearch]=useState('');
  const [caseSearch,setCaseSearch]=useState('');
  const [caseStatus,setCaseStatus]=useState<State|'all'>('all');
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
  useEffect(()=>{
    if(route!=='history')return;
    const category=routeParams.categoryFilter;
    if(['income','tds','ait','travel'].includes(String(category)))setKind(category as Kind);
    const month=routeParams.monthFilter;
    setMonthFilter(typeof month==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?month:'all');
    const statuses=routeParams.reviewStatuses;
    if(Array.isArray(statuses) && statuses.length && statuses.every((x:unknown)=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(String(x)))){
      setReviewFilter(statuses as State[]);
      setStatus('all');
    } else setReviewFilter(null);
  },[route,routeParams]);
  const openReview=(states:State[])=>navigate('history',{reviewStatuses:states});
  const [query,setQuery]=useState('');
  const [historyPage,setHistoryPage]=useState(1);
  const [selected,setSelected]=useState<RecordItem|null>(null);
  const totals=yearSummary(year)!;
  const scoped=useMemo(()=>events.filter(x=>x.year===year),[year]);
  const filtered=useMemo(()=>scoped.filter(x=>(kind==='all'||kind===x.kind)&&(status==='all'||status===x.state)&&(monthFilter==='all'||x.date.startsWith(monthFilter))&&(!reviewFilter||reviewFilter.includes(x.state))&&[x.ref,x.title,x.challan||'',x.detail].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)),[scoped,kind,status,reviewFilter,monthFilter,query]);
  const historyPerPage=10;
  const currentHistoryPage=Math.min(historyPage,Math.max(1,Math.ceil(filtered.length/historyPerPage)));
  const visibleHistoryRows=filtered.slice((currentHistoryPage-1)*historyPerPage,currentHistoryPage*historyPerPage);
  const availableHistoryMonths=[...new Set(scoped.map(x=>x.date.slice(0,7)))].sort();
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
  const summaryCard=(en:string,bengali:string,value:string,description:string,descriptionBn:string,priority=false)=>
    <TaxpayerFinancialKpi
      language={language}
      titleEn={en}
      titleBn={bengali}
      value={value}
      helpEn={description}
      helpBn={descriptionBn}
      priority={priority}
      onReviewPayment={priority && totals.outstanding > 0
        ? () => navigate('wizard',{initialCategory:'TAX_WITH_RETURN',initialAssessmentYear:year})
        : undefined}
    />;
  const money=(x:number)=>amount(x,bn);
  const formatDate=(date:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{
    day:'numeric',month:'short',year:'numeric',timeZone:'UTC'
  }).format(new Date(date+'T00:00:00Z'));
  const csv=()=>{
    const clean=(v:string|number)=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const lines=[['SYNTHETIC EXAMPLE ONLY','Reference','Assessment year','Kind','Amount ৳','Status','Event date','Challan sample'],
      ...filtered.map(x=>['NOT GOVERNMENT DATA',x.ref,x.year,x.kind,x.amount,x.state,x.date,x.challan||''])].map(x=>x.map(clean).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='Korbritto_user1_SYNTHETIC_'+year+'.csv';a.click();URL.revokeObjectURL(url);
  };
  const years=<label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{tr('Assessment year','করবর্ষ')}
    <select aria-label={tr('Assessment year','করবর্ষ')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={year} onChange={e=>changeYear(e.target.value)}>{taxYears.map(x=><option key={x.year} value={x.year}>{x.year}</option>)}</select>
  </label>;
  const transactionList=<section className={panel+' taxpayer-transaction-panel'} aria-labelledby="taxpayer-transaction-heading">
    <div className="taxpayer-transaction-panel__heading">
      <div><h2 id="taxpayer-transaction-heading" className="text-base font-semibold">{tr('Transaction history','লেনদেনের ইতিহাস')}</h2>{sub('Search and filter your payment activity','লেনদেন খুঁজুন ও ফিল্টার করুন')}</div>
      <button type="button" onClick={csv} className={action}><Download size={16}/>{tr('Export CSV','CSV রপ্তানি')}</button>
    </div>
    <TaxPayTableControls className="taxpayer-transaction-filters">
      <label className="taxpayer-transaction-filter taxpayer-transaction-filter--search"><span>{tr('Search','খুঁজুন')}</span><span className="taxpayer-transaction-filter__search"><Search size={17} aria-hidden="true"/><input aria-label={tr('Search transaction reference','লেনদেন রেফারেন্স খুঁজুন')} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Search reference / title','রেফারেন্স/বিবরণ খুঁজুন')}/></span></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Payment type','পেমেন্টের ধরন')}</span><select aria-label={tr('Transaction category','লেনদেনের ধরন')} value={kind} onChange={e=>setKind(e.target.value as Kind|'all')}>
        <option value="all">{tr('All types','সব ধরন')}</option>{(Object.keys(labels) as Kind[]).map(k=><option key={k} value={k}>{tr(...labels[k])}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Calendar month','ক্যালেন্ডার মাস')}</span><select aria-label={tr('Transaction month','লেনদেনের মাস')} value={availableHistoryMonths.includes(monthFilter)?monthFilter:'all'} onChange={e=>chooseHistoryMonth(e.target.value)}>
        <option value="all">{tr('All months','সব মাস')}</option>{availableHistoryMonths.map(month=><option key={month} value={month}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'))}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Status','অবস্থা')}</span><select aria-label={tr('Transaction status','লেনদেনের অবস্থা')} value={status} onChange={e=>{setReviewFilter(null);setStatus(e.target.value as State|'all');}}>
        <option value="all">{tr('All statuses','সব অবস্থা')}</option>{(Object.keys(stateLabels) as State[]).map(s=><option key={s} value={s}>{tr(...stateLabels[s])}</option>)}
      </select></label>
    </TaxPayTableControls>
    <div className="taxpayer-transaction-count">
      <TaxPayTableCounter label={tr('Records','রেকর্ড')} shown={filtered.length} total={scoped.length}/>
      {reviewFilter&&<button type="button" className="min-h-10 rounded-lg px-3 text-xs font-medium text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
        onClick={()=>setReviewFilter(null)}>{tr('Clear review filter','পর্যালোচনা ফিল্টার মুছুন')}</button>}
    </div>
    {filtered.length ? <TaxPayDataGrid variant="tabular" rows={visibleHistoryRows} getRowKey={item=>item.id}
      pagination={{page:currentHistoryPage,perPage:historyPerPage,total:filtered.length,onPageChange:setHistoryPage,
        labels:bn?{previous:'আগের পৃষ্ঠা',next:'পরের পৃষ্ঠা',showing:'দেখানো হচ্ছে',of:'মোট',records:'রেকর্ড',page:'পৃষ্ঠা'}:undefined}}
      ariaLabel={tr('Payment transactions','পেমেন্ট লেনদেন')}
      className="taxpayer-transaction-table" testId="taxpayer-transaction-table"
      mobileTestId="taxpayer-transaction-mobile-cards"
      onViewRow={item=>setSelected(item)}
      columns={[
        {key:'payment',header:tr('Payment','পেমেন্ট'),renderCell:item=>
          <p className="taxpayer-transaction-row__title">{item.title}</p>},
        {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:item=>
          <span className="taxpayer-transaction-reference">{item.ref}</span>},
        {key:'type',header:tr('Payment type','পেমেন্টের ধরন'),renderCell:item=>
          <span className="taxpayer-transaction-type">{tr(...labels[item.kind])}</span>},
        {key:'date',header:tr('Date','তারিখ'),renderCell:item=>
          <time dateTime={item.date} className="taxpayer-transaction-date">{formatDate(item.date)}</time>},
        {key:'amount',header:tr('Amount','পরিমাণ'),headerClassName:'text-right',
          cellClassName:'text-right tabular-nums',renderCell:item=>
          <p className="taxpayer-transaction-row__amount tabular-nums">{money(item.amount)}</p>},
        {key:'status',header:tr('Status','অবস্থা'),renderCell:item=>
          <div className="taxpayer-transaction-row__status">{tag(item.state)}</div>},
        {key:'actions',header:tr('Actions','কার্যক্রম'),renderCell:item=>
          <button type="button" onClick={()=>setSelected(item)}
            className={action+' taxpayer-transaction-row__action'}
            aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>}
      ]}
      renderMobileCard={item=><div className="taxpayer-transaction-mobile-record">
        <div className="taxpayer-transaction-mobile-record__top">
          <p className="taxpayer-transaction-row__title">{item.title}</p>
          <p className="taxpayer-transaction-row__amount tabular-nums">{money(item.amount)}</p>
        </div>
        <p className="taxpayer-transaction-reference">{item.ref}</p>
        <p className="taxpayer-transaction-mobile-record__meta">{tr(...labels[item.kind])} · <time dateTime={item.date}>{formatDate(item.date)}</time></p>
        <div className="taxpayer-transaction-mobile-record__footer">
          <div className="taxpayer-transaction-row__status">{tag(item.state)}</div>
          <button type="button" onClick={()=>setSelected(item)}
            className={action+' taxpayer-transaction-row__action'}
            aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>
        </div>
      </div>}/>:<div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><h3 className="font-semibold">{tr('No matching records','মিল পাওয়া যায়নি')}</h3>{sub('Change the filters or select another year.','ফিল্টার বা করবর্ষ পরিবর্তন করুন।')}</div>}
  </section>;
  const overviewRoute=route==='taxpayer_home'||route==='dashboard';
  const pageTitle=route==='history'?tr('Payments & activity','পেমেন্ট ও লেনদেন'):route==='ledger'?tr('Tax ledger','কর লেজার'):route==='certificates'?tr('Receipts & payment records','রসিদ ও পেমেন্ট রেকর্ড'):route==='corrections'?tr('Corrections & exceptions','সংশোধন ও ব্যতিক্রম'):route==='journey'?tr('My tax journey','আমার কর কার্যক্রম'):route==='account_profile'?tr('Taxpayer profile','করদাতা প্রোফাইল'):route==='account_notifications'?tr('Notifications','বিজ্ঞপ্তি'):route==='account_settings'?tr('Profile settings','প্রোফাইল সেটিংস'):tr('Dashboard summary','ড্যাশবোর্ড সারসংক্ষেপ');
  const header=<TaxpayerPageHeading title={pageTitle} className="taxpayer-dashboard-header"
    actions={!['account_profile','account_settings','ledger','journey'].includes(route) ? years : undefined} />;
  const coveredBreakdown=[
    {label:tr('TDS','উৎসে কর'),value:totals.tds,color:'var(--color-taxpay-primary)'},
    {label:tr('Advance tax','অগ্রিম কর'),value:totals.ait,color:'var(--color-taxpay-secondary)'},
    {label:tr('Direct payment','সরাসরি পেমেন্ট'),value:totals.direct,color:'var(--color-taxpay-dark)'},
    {label:tr('Remaining','অবশিষ্ট'),value:totals.outstanding,color:'var(--color-taxpay-accent)'}
  ];
  const gradients=coveredBreakdown.reduce((a,x)=>{const from=a.end;const end=from+meter(x.value,totals.liability);return {end,parts:[...a.parts,x.color+' '+from+'% '+end+'%']};},{end:0,parts:[] as string[]});
  const cats:Kind[]=['income','tds','ait','travel'];
  const [chartKind,setChartKind]=useState<Kind>('income');
  const [selectedCoverage,setSelectedCoverage]=useState<number|null>(null);
  // Group posted events by their full calendar YYYY-MM key; assessment year only
  // selects the ledger and must never collapse January across different years.
  const postedInCategory=scoped.filter(x=>x.kind===chartKind&&x.state==='POSTED').sort((a,b)=>a.date.localeCompare(b.date));
  const firstKey=postedInCategory[0]?.date.slice(0,7);
  const lastKey=postedInCategory[postedInCategory.length-1]?.date.slice(0,7);
  const monthKeys:string[]=[];
  if(firstKey&&lastKey){
    let [y,m]=firstKey.split('-').map(Number);
    const [lastYear,lastMonth]=lastKey.split('-').map(Number);
    while(y<lastYear||(y===lastYear&&m<=lastMonth)){
      monthKeys.push(y+'-'+String(m).padStart(2,'0'));
      m++;
      if(m>12){m=1;y++;}
    }
  }
  const enMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const bnMonths=['জানু','ফেব','মার্চ','এপ্রি','মে','জুন','জুলা','আগ','সেপ','অক্টো','নভে','ডিসে'];
  const monthLabel=(key:string,long=false)=>{
    const [y,m]=key.split('-');
    return (bn?bnMonths[Number(m)-1]:enMonths[Number(m)-1])+' '+(long?y:'’'+y.slice(-2));
  };
  const periodLabel=monthKeys.length?(monthKeys.length===1?monthLabel(monthKeys[0]):monthLabel(monthKeys[0])+'–'+monthLabel(monthKeys[monthKeys.length-1])):'';
  const monthValues=monthKeys.map(key=>postedInCategory.filter(x=>x.date.slice(0,7)===key).reduce((a,x)=>a+x.amount,0));
  const chartMax=Math.max(...monthValues,1);
  const monthTotal=monthValues.reduce((total,entry)=>total+entry,0);
  const overview=<>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={tr('Financial summary','আর্থিক সারসংক্ষেপ')}>
      {summaryCard('Income tax liability','আয়কর দায়',money(totals.liability),
        'Starting liability used for this tax year.','এই করবর্ষের প্রাথমিক করদায়।')}
      {summaryCard('TDS & advance tax','উৎসে কর ও অগ্রিম কর',money(totals.tds+totals.ait),
        'Posted TDS and advance-tax amounts only; unmatched entries are excluded.','শুধু পোস্টকৃত উৎসে কর ও অগ্রিম কর; অমিল লেনদেন বাদ।')}
      {summaryCard('Direct payments','সরাসরি পরিশোধ',money(totals.direct),
        'Posted payments only. Pending, failed and reversed attempts are excluded.','শুধু পোস্টকৃত পরিশোধ; অপেক্ষমাণ, ব্যর্থ ও বাতিল লেনদেন বাদ।')}
      {summaryCard('Remaining balance','অবশিষ্ট দায়',money(totals.outstanding),
        'Opening liability minus eligible posted TDS, advance tax and direct payments.','প্রাথমিক করদায় থেকে যোগ্য উৎসে কর, অগ্রিম কর ও সরাসরি পরিশোধ বাদ।',true)}
    </section>
    <section className={panel+' taxpayer-dashboard-attention'} aria-labelledby="taxpayer-attention-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="taxpayer-attention-title" className="text-base font-semibold">{tr('Needs review','পর্যালোচনা প্রয়োজন')}</h2>
          {info(tr('Needs review','পর্যালোচনা প্রয়োজন'),
            'Pending payments, failed or reversed attempts, unmatched withholding and unresolved requests do not count as credited payments.','অপেক্ষমাণ, ব্যর্থ, বাতিল, অমিল বা অনিষ্পন্ন আবেদন ক্রেডিট হিসেবে গণনা করা হয় না।')}
        </div>
        {view('corrections','Review exceptions','ব্যতিক্রম দেখুন')}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          {label:tr('Pending','অপেক্ষমাণ'),count:scoped.filter(x=>x.state==='PENDING').length,states:['PENDING']},
          {label:tr('Failed / reversed','ব্যর্থ / বাতিল'),count:scoped.filter(x=>x.state==='FAILED'||x.state==='REVERSED').length,states:['FAILED','REVERSED']},
          {label:tr('Unmatched','অমিল'),count:totals.disputed,states:['DISPUTED']},
          {label:tr('Requests','আবেদন'),count:scoped.filter(x=>x.state==='REQUESTED').length,states:['REQUESTED']}
        ] as {label:string;count:number;states:State[]}[]).map(item=>
          <button type="button" key={item.label} onClick={()=>openReview(item.states)}
            aria-label={tr('View ','দেখুন: ')+item.label+': '+item.count}
            className="taxpayer-review-tile group rounded-xl border border-taxpay-border bg-taxpay-background px-3 py-3 text-left">
            <span className="flex items-center justify-between gap-2 text-xs text-taxpay-muted">{item.label}<ArrowRight size={15} aria-hidden="true" className="text-taxpay-primary opacity-60"/></span>
            <span className="mt-1 block text-xl font-semibold tabular-nums">{item.count}</span>
          </button>)}
      </div>
    </section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(290px,1fr)_minmax(0,1.65fr)]">
      <section className={panel+' taxpayer-dashboard-chart'} aria-labelledby="taxpayer-coverage-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="taxpayer-coverage-title" className="text-base font-semibold">{tr('Tax coverage','করদায়ের বিভাজন')}</h2>
          {info(tr('Tax coverage','করদায়ের বিভাজন'),
            'Distribution between TDS, advance tax, direct payments and remaining balance.','উৎসে কর, অগ্রিম কর, সরাসরি পরিশোধ ও অবশিষ্ট দায়ের বিভাজন।')}
        </div>
        <div className="relative mx-auto my-5 h-48 w-48 rounded-full sm:h-52 sm:w-52" role="img"
          aria-label={tr('Liability coverage: ','করদায়ের বিভাজন: ')+Math.round(meter(totals.applied,totals.liability))+'%. '+tr('Remaining ','অবশিষ্ট ')+money(totals.outstanding)}
          style={{background:'conic-gradient('+gradients.parts.join(',')+')'}}>
          <div className="absolute inset-[43px] flex flex-col items-center justify-center rounded-full bg-white p-2 text-center">
            <p className="text-xs text-taxpay-muted">{selectedCoverage===null?tr('Applied','সমন্বিত'):coveredBreakdown[selectedCoverage].label}</p>
            <p className={'font-semibold tabular-nums '+(selectedCoverage===null?'text-2xl':'text-base')}>{selectedCoverage===null?Math.round(meter(totals.applied,totals.liability))+'%':money(coveredBreakdown[selectedCoverage].value)}</p>
          </div>
        </div>
        <div className="divide-y divide-taxpay-border" role="group" aria-label={tr('Coverage details','করদায়ের বিস্তারিত')}>{coveredBreakdown.map((x,i)=>
          <button key={x.label} type="button" aria-pressed={selectedCoverage===i}
            title={tr('Show ','দেখুন: ')+x.label+': '+money(x.value)}
            onClick={()=>setSelectedCoverage(selectedCoverage===i?null:i)}
            className={'taxpayer-coverage-row flex w-full min-w-0 items-center justify-between gap-2 py-2 text-left text-sm '+(selectedCoverage===i?'taxpayer-coverage-row--active':'')}>
            <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:x.color}}/>{x.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{money(x.value)}</span>
          </button>)}
        </div>
      </section>
      <section className={panel+' taxpayer-dashboard-chart'} aria-labelledby="taxpayer-activity-title">
        <div className="taxpayer-monthly-help-row flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="taxpayer-activity-title" className="text-base font-semibold">{tr('Monthly activity','মাসভিত্তিক কার্যক্রম')}</h2>
            {periodLabel&&<p className="text-xs font-medium text-taxpay-muted" aria-live="polite">{periodLabel}</p>}
            <p className="text-sm font-semibold tabular-nums text-taxpay-primary" aria-live="polite">{money(monthTotal)}</p>
          </div>
          <div className="flex items-center gap-2">
            {info(tr('Monthly activity','মাসভিত্তিক কার্যক্রম'),
              'Posted amounts by month for the selected payment category. Empty months have no matching records.','নির্বাচিত পরিশোধের ধরন অনুযায়ী মাসভিত্তিক পোস্টকৃত পরিমাণ। ফাঁকা মাসে সংশ্লিষ্ট রেকর্ড নেই।')}
            <button type="button" aria-label={tr('Open transaction history','লেনদেনের ইতিহাস খুলুন')} onClick={()=>navigateTo('history')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light">
              {tr('View all','সব দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr('Activity category','কার্যক্রমের ধরন')}>
          {cats.map(k=><button type="button" key={k} aria-pressed={chartKind===k} onClick={()=>setChartKind(k)}
            className={'min-h-11 rounded-lg border px-2 py-2 text-xs font-medium '+(chartKind===k?'border-taxpay-primary bg-taxpay-light text-taxpay-dark':'border-taxpay-border bg-white text-taxpay-text')}>{tr(...labels[k])}</button>)}
        </div>
        <div className="taxpayer-monthly-scroll mt-3 overflow-x-auto" tabIndex={monthKeys.length>5?0:undefined}
          aria-label={tr('Monthly activity chart','মাসভিত্তিক কার্যক্রম চার্ট')}>
          {monthKeys.length?
            <div className="taxpayer-monthly-chart grid h-40 items-end gap-1 border-b border-taxpay-border pb-1 sm:gap-2"
              style={{gridTemplateColumns:'repeat('+monthKeys.length+',minmax(52px,1fr))',minWidth:monthKeys.length*52+'px'}}
              role="group" aria-label={tr(...labels[chartKind])+': '+monthKeys.map((key,i)=>monthLabel(key,true)+' '+money(monthValues[i])).join('; ')}>
              {monthValues.map((v,i)=><div key={monthKeys[i]} className="flex min-w-0 h-full flex-col items-center justify-end gap-1">
                <p className="min-h-4 text-[10px] tabular-nums text-taxpay-muted">{v?Math.round(v/1000)+'k':''}</p>
                {v>0?
                  <button type="button" className="taxpayer-monthly-bar w-full max-w-10 rounded-t bg-taxpay-secondary"
                    aria-label={tr(...labels[chartKind])+', '+monthLabel(monthKeys[i],true)+': '+money(v)}
                    title={monthLabel(monthKeys[i],true)+': '+money(v)}
                    style={{height:Math.max(6,v*94/chartMax)+'px'}}
                    onClick={()=>navigate('history',{categoryFilter:chartKind,monthFilter:monthKeys[i]})}>
                    <span className="taxpayer-monthly-bar__tooltip" aria-hidden="true">{monthLabel(monthKeys[i],true)} · {money(v)}</span>
                  </button>:
                  <span aria-hidden="true" className="w-full max-w-10" style={{height:0}}/>}
                <p className="text-xs whitespace-nowrap text-taxpay-muted">{monthLabel(monthKeys[i])}</p>
              </div>)}
            </div>:
            <p className="flex min-h-24 items-center justify-center text-sm text-taxpay-muted">{tr('No posted activity','পোস্টকৃত কার্যক্রম নেই')}</p>}
        </div>
        <div className="taxpayer-travel-tax-summary mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-taxpay-background px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm text-taxpay-muted">{tr('Travel tax (separate)','ভ্রমণ কর (পৃথক)')}</p>
            {info(tr('Travel tax','ভ্রমণ কর'),'Travel tax is reported separately and never included in income-tax credits.','ভ্রমণ কর আলাদা দেখানো হয় এবং আয়কর ক্রেডিটে যোগ হয় না।')}
          </div>
          <p className="font-semibold tabular-nums">{money(totals.travel)}</p>
        </div>
      </section>
    </div>
    <section className={panel} aria-labelledby="taxpayer-year-comparison-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="taxpayer-year-comparison-title" className="text-base font-semibold">{tr('By assessment year','করবর্ষ অনুযায়ী')}</h2>
          <p className="mt-1 text-sm text-taxpay-muted">{tr('Compare recorded credits and remaining balances across years.','করবর্ষ অনুযায়ী নথিভুক্ত ক্রেডিট ও অবশিষ্ট দায় তুলনা করুন।')}</p>
        </div>
        {view('ledger','Review tax ledger','কর লেজার দেখুন')}
      </div>
      <div className="taxpay-table-viewport mt-4" role="region" aria-label={tr('Assessment-year tax position','করবর্ষভিত্তিক কর অবস্থান')} tabIndex={0}>
        <TaxPayUnifiedTable className="taxpay-unified-table w-full min-w-[660px] text-left text-sm">
          <thead className="bg-taxpay-background text-taxpay-muted"><tr>
            <th scope="col" className="px-3 py-3 font-medium">{tr('Year','করবর্ষ')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{tr('Liability','দায়')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{tr('TDS + advance','উৎসে + অগ্রিম')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{tr('Direct payments','সরাসরি পেমেন্ট')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{tr('Remaining','অবশিষ্ট')}</th>
            <th scope="col" className="px-3 py-3 font-medium">{tr('Status','অবস্থা')}</th>
          </tr></thead>
          <tbody className="divide-y divide-taxpay-border">
            {taxYears.map(({year:rowYear})=>{
              const item=yearSummary(rowYear)!;
              return <tr key={rowYear} className={year===rowYear?'bg-taxpay-light/50':''}>
                <td className="px-3 py-3"><button type="button" aria-current={year===rowYear?'true':undefined}
                  className="min-h-10 text-left font-semibold text-taxpay-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary" onClick={()=>changeYear(rowYear)}>{rowYear}</button></td>
                <td className="px-3 py-3 text-right tabular-nums">{money(item.liability)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(item.tds+item.ait)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(item.direct)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(item.outstanding)}</td>
                <td className="px-3 py-3">{item.outstanding>0?tr('Outstanding','বকেয়া'):tr('Settled','নিষ্পন্ন')}</td>
              </tr>;
            })}
          </tbody>
        </TaxPayUnifiedTable>
      </div>
      <p className="mt-3 text-xs text-taxpay-muted">{tr('Only posted income tax, TDS and advance tax reduce the displayed balance. Pending, reversed and travel tax are excluded.','শুধু নথিভুক্ত আয়কর, উৎসে কর ও অগ্রিম কর অবশিষ্ট দায় থেকে বাদ যায়। অপেক্ষমাণ, প্রত্যাবর্তিত ও ভ্রমণ কর বাদ।')}</p>
      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-taxpay-border bg-taxpay-background p-4" aria-labelledby="taxpayer-credit-composition-title">
          <h3 id="taxpayer-credit-composition-title" className="text-base font-semibold text-taxpay-text">{tr('How your credits are made up','আপনার ক্রেডিট কীভাবে গঠিত')}</h3>
          <p className="mt-1 text-xs text-taxpay-muted">{tr('Posted credits for the selected assessment year','নির্বাচিত করবর্ষের নথিভুক্ত ক্রেডিট')} · {year}</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-taxpay-border" role="img"
            aria-label={tr('Posted credit composition','নথিভুক্ত ক্রেডিটের বিভাজন')+': '+tr('TDS','উৎসে কর')+' '+money(totals.tds)+', '+tr('Advance tax','অগ্রিম কর')+' '+money(totals.ait)+', '+tr('Direct payments','সরাসরি পরিশোধ')+' '+money(totals.direct)}>
            {([
              {value:totals.tds,color:'var(--color-taxpay-primary)'},
              {value:totals.ait,color:'var(--color-taxpay-secondary)'},
              {value:totals.direct,color:'var(--color-taxpay-dark)'}
            ] as const).map((part,i)=><span key={i} aria-hidden="true" style={{width:(totals.applied>0?part.value/totals.applied*100:0)+'%',backgroundColor:part.color}} />)}
          </div>
          <TaxPayUnifiedTable className="taxpay-unified-table mt-4 w-full text-sm" aria-label={tr('Posted credit components','নথিভুক্ত ক্রেডিটের উপাদান')}>
            <thead><tr className="text-taxpay-muted"><th scope="col" className="pb-2 text-left font-medium">{tr('Component','উপাদান')}</th><th scope="col" className="pb-2 text-right font-medium">{tr('Posted credit','নথিভুক্ত ক্রেডিট')}</th></tr></thead>
            <tbody className="divide-y divide-taxpay-border">
              {([
                {label:tr('TDS','উৎসে কর'),value:totals.tds,color:'var(--color-taxpay-primary)'},
                {label:tr('Advance tax','অগ্রিম কর'),value:totals.ait,color:'var(--color-taxpay-secondary)'},
                {label:tr('Direct payments','সরাসরি পরিশোধ'),value:totals.direct,color:'var(--color-taxpay-dark)'}
              ] as const).map(component=><tr key={component.label}>
                <th scope="row" className="py-2 text-left font-normal text-taxpay-text"><span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor:component.color}}/>{component.label}</th>
                <td className="py-2 text-right font-semibold tabular-nums">{money(component.value)}</td>
              </tr>)}
              <tr><th scope="row" className="pt-3 text-left font-semibold">{tr('Total applied credits','মোট সমন্বিত ক্রেডিট')}</th><td className="pt-3 text-right font-semibold tabular-nums">{money(totals.applied)}</td></tr>
            </tbody>
          </TaxPayUnifiedTable>
        </section>
        <section className="min-w-0 rounded-xl border border-taxpay-border bg-taxpay-surface p-4" aria-labelledby="taxpayer-current-position-title">
          <h3 id="taxpayer-current-position-title" className="text-base font-semibold text-taxpay-text">{tr('Current tax position','বর্তমান কর অবস্থান')}</h3>
          <p className="mt-1 text-xs text-taxpay-muted">{tr('Selected assessment year','নির্বাচিত করবর্ষ')} · {year}</p>
          <dl className="mt-3 divide-y divide-taxpay-border text-sm">
            <div className="flex items-center justify-between gap-3 py-2"><dt className="text-taxpay-muted">{tr('Income tax liability','আয়কর দায়')}</dt><dd className="font-semibold tabular-nums">{money(totals.liability)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-2"><dt className="text-taxpay-muted">{tr('Posted credits','নথিভুক্ত ক্রেডিট')}</dt><dd className="font-semibold tabular-nums">{money(totals.applied)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-2"><dt className="font-semibold text-taxpay-text">{tr('Remaining balance','অবশিষ্ট দায়')}</dt><dd className="text-lg font-semibold tabular-nums text-taxpay-primary">{money(totals.outstanding)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-2"><dt className="text-taxpay-muted">{tr('Travel tax recorded separately','ভ্রমণ কর পৃথকভাবে নথিভুক্ত')}</dt><dd className="font-semibold tabular-nums">{money(totals.travel)}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-taxpay-muted">{tr('Pending payments, failed attempts and unmatched withholding do not reduce the remaining balance. Refund inquiries are not approved refunds.','অপেক্ষমাণ পেমেন্ট, ব্যর্থ চেষ্টা ও অমিল উৎসে কর অবশিষ্ট দায় কমায় না। ফেরতের আবেদন অনুমোদিত ফেরত নয়।')}</p>
        </section>
      </div>
    </section>
    <section className={panel} aria-labelledby="taxpayer-recent-activity-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="taxpayer-recent-activity-title" className="text-base font-semibold">{tr('Recent activity','সাম্প্রতিক কার্যক্রম')}</h2>
        {view('history','View all activity','সব কার্যক্রম দেখুন')}
      </div>
      <ul className="mt-3 divide-y divide-taxpay-border" aria-label={tr('Latest transactions in selected year','নির্বাচিত করবর্ষের সাম্প্রতিক লেনদেন')}>
        {[...scoped].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-taxpay-text">{item.title}</p>
            <p className="mt-1 text-xs text-taxpay-muted"><time dateTime={item.date}>{formatDate(item.date)}</time> · {tr(...labels[item.kind])}</p>
          </div>
          <p className="whitespace-nowrap text-sm font-semibold tabular-nums">{money(item.amount)}</p>
          <div>{tag(item.state)}</div>
          <button type="button" className={action} onClick={()=>setSelected(item)} aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>
        </li>)}
      </ul>
      <button type="button" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-taxpay-primary hover:underline" onClick={()=>navigate('services')}>
        {tr('View payment services','পরিশোধ সেবাসমূহ দেখুন')}<ArrowRight size={15} aria-hidden="true"/>
      </button>
    </section>
  </>;
  // A single event projection powers every supported assessment year; a record is
  // never promoted into an official balance just because its scenario state is POSTED.
  const ledgerEvents:TaxAccountEvent[]=taxYears.flatMap(assessment=>{
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
  });
  const visibleLedgerTotals=ledgerYear==='all'
    ? taxYears.map(y=>yearSummary(y.year)!).reduce((sum,item)=>({
      liability:sum.liability+item.liability,applied:sum.applied+item.applied,
      outstanding:sum.outstanding+item.outstanding
    }),{liability:0,applied:0,outstanding:0})
    : yearSummary(ledgerYear)||totals;
  const ledger=<>
    <section className="grid gap-3 sm:grid-cols-3" aria-label={tr('Assessment-year summary','করবর্ষের সারসংক্ষেপ')}>
      {card('Tax liability','করদায়',money(visibleLedgerTotals.liability),'Opening liabilities','প্রাথমিক দায়')}
      {card('Applied credits','প্রয়োগকৃত ক্রেডিট',money(visibleLedgerTotals.applied),'Posted source, advance and direct entries','উৎসে কর, অগ্রিম কর ও সরাসরি এন্ট্রি')}
      {card('Remaining balance','অবশিষ্ট দায়',money(visibleLedgerTotals.outstanding),'Scenario journal, not an official NBR balance','সরকারি এনবিআর ব্যালেন্স নয়')}
    </section>
    <EventBasedTaxLedger events={ledgerEvents} language={language} year={ledgerYear} showRecordedScenarioBalance
      onYearChange={nextYear=>nextYear==='all'?setLedgerYear('all'):changeYear(nextYear)}
      onOpenPayment={reference=>{const record=events.find(item=>item.ref===reference);if(record)setSelected(record);}}/>
  </>;

  // Records, exceptions and beneficiary entries use the same column-driven grid.
  // Preserve the existing case/receipt details modal and never suggest that
  // a recorded payment automatically means a government receipt was issued.
  const allDocumentRecords=scoped.filter(x=>x.state==='POSTED'&&(x.challan||x.kind==='tds'));
  const documentNeedle=documentSearch.trim().toLocaleLowerCase();
  const documentRecords=allDocumentRecords.filter(x=>(x.title+' '+x.ref+' '+(x.challan||'')+' '+tr(...labels[x.kind]))
    .toLocaleLowerCase().includes(documentNeedle));
  const documents=<section className={panel+' taxpayer-records-panel'} aria-labelledby="taxpayer-documents-heading">
    <div className="taxpay-table-toolbar">
      <div>
        <h2 id="taxpayer-documents-heading" className="text-base font-semibold">{tr('Payment records and supporting references','পেমেন্ট রেকর্ড ও সহায়ক রেফারেন্স')}</h2>
        <p className="mt-1 text-sm text-taxpay-muted">{tr('Open a record to check its payment details. A recorded entry is not itself an issued certificate.','পেমেন্টের বিস্তারিত দেখতে রেকর্ড খুলুন। নথিভুক্ত তথ্য নিজে কোনো ইস্যুকৃত সনদ নয়।')}</p>
      </div>
      <TaxPayTableCounter label={tr('Records','রেকর্ড')} shown={documentRecords.length} total={allDocumentRecords.length}/>
    </div>
    <TaxPayTableControls className="taxpayer-transaction-filters taxpay-record-page-filters">
      <label className="taxpayer-transaction-filter taxpayer-transaction-filter--search">
        <span>{tr('Search payment records','পেমেন্ট রেকর্ড খুঁজুন')}</span>
        <span className="taxpayer-transaction-filter__search">
          <Search size={17} aria-hidden="true"/>
          <input type="search" value={documentSearch} onChange={e=>setDocumentSearch(e.target.value)}
            aria-label={tr('Search payment references','পেমেন্ট রেফারেন্স খুঁজুন')}
            placeholder={tr('Search name or reference','নাম বা রেফারেন্স খুঁজুন')}/>
        </span>
      </label>
      {documentSearch&&<button type="button" className={action} onClick={()=>setDocumentSearch('')}>{tr('Clear search','অনুসন্ধান মুছুন')}</button>}
    </TaxPayTableControls>
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
    </div>:<p role="status" className="taxpay-table-state mt-4">{documentSearch?tr('No payment records match this search.','এই অনুসন্ধানে কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।'):tr('No recorded payment references for this assessment year.','এই করবর্ষে কোনো পেমেন্ট রেফারেন্স নেই।')}</p>}
  </section>;
  const allCorrectionRecords=scoped.filter(x=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(x.state));
  const caseNeedle=caseSearch.trim().toLocaleLowerCase();
  const correctionRecords=allCorrectionRecords.filter(x=>(caseStatus==='all'||x.state===caseStatus)&&
    (x.title+' '+x.ref+' '+x.detail+' '+tr(...stateLabels[x.state])).toLocaleLowerCase().includes(caseNeedle));
  const exceptions=<>
    <div className="grid gap-3 sm:grid-cols-3">
      {card('Awaiting reconciliation','সমন্বয়ের অপেক্ষায়',String(allCorrectionRecords.filter(x=>x.state==='PENDING').length),'Not yet counted as a tax credit','এখনো কর ক্রেডিট হিসেবে গণনা হয়নি')}
      {card('Refund or adjustment inquiries','ফেরত বা সমন্বয়ের আবেদন',String(allCorrectionRecords.filter(x=>x.state==='REQUESTED').length),'A request does not mean approval','আবেদন মানেই অনুমোদন নয়')}
      {card('Failed, reversed or disputed','ব্যর্থ, প্রত্যাবর্তিত বা বিরোধপূর্ণ',String(allCorrectionRecords.filter(x=>['DISPUTED','FAILED','REVERSED'].includes(x.state)).length),'Excluded from confirmed tax credits','নিশ্চিত কর ক্রেডিটে অন্তর্ভুক্ত নয়')}
    </div>
    <section className={panel+' taxpayer-records-panel'} aria-labelledby="taxpayer-exceptions-heading">
      <div className="taxpay-table-toolbar">
        <div>
          <h2 id="taxpayer-exceptions-heading" className="text-base font-semibold">{tr('Cases requiring attention','যেসব বিষয়ে নজর দেওয়া প্রয়োজন')}</h2>
          <p className="mt-1 text-sm text-taxpay-muted">{tr('Review the recorded reason and status. These entries do not establish a tax credit.','নথিভুক্ত কারণ ও অবস্থা দেখুন। এসব এন্ট্রি কর ক্রেডিট নিশ্চিত করে না।')}</p>
        </div>
        <TaxPayTableCounter label={tr('Cases','বিষয়')} shown={correctionRecords.length} total={allCorrectionRecords.length}/>
      </div>
      <TaxPayTableControls className="taxpayer-transaction-filters taxpay-record-page-filters">
        <label className="taxpayer-transaction-filter taxpayer-transaction-filter--search">
          <span>{tr('Search cases','বিষয় খুঁজুন')}</span>
          <span className="taxpayer-transaction-filter__search">
            <Search size={17} aria-hidden="true"/>
            <input type="search" value={caseSearch} onChange={e=>setCaseSearch(e.target.value)}
              aria-label={tr('Search case references','বিষয়ের রেফারেন্স খুঁজুন')}
              placeholder={tr('Search case or reference','বিষয় বা রেফারেন্স খুঁজুন')}/>
          </span>
        </label>
        <label className="taxpayer-transaction-filter"><span>{tr('Status','অবস্থা')}</span>
          <select value={caseStatus} aria-label={tr('Filter case status','বিষয়ের অবস্থা ফিল্টার')}
            onChange={e=>setCaseStatus(e.target.value as State|'all')}>
            <option value="all">{tr('All statuses','সব অবস্থা')}</option>
            {(['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'] as const).map(state=><option key={state} value={state}>{tr(...stateLabels[state])}</option>)}
          </select>
        </label>
        {(caseSearch||caseStatus!=='all')&&<button type="button" className={action} onClick={()=>{setCaseSearch('');setCaseStatus('all');}}>{tr('Clear filters','ফিল্টার মুছুন')}</button>}
      </TaxPayTableControls>
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
      </div>:<p role="status" className="taxpay-table-state mt-4">{caseSearch||caseStatus!=='all'?tr('No cases match the selected filters.','নির্বাচিত ফিল্টারে কোনো বিষয় পাওয়া যায়নি।'):tr('No unresolved or disputed records for this assessment year.','এই করবর্ষে কোনো অমীমাংসিত বা বিরোধপূর্ণ রেকর্ড নেই।')}</p>}
    </section>
  </>;

  // The same immutable payment records feed Transactions, Tax Ledger and this journey.
  // Group by calendar year, not assessment year; do not manufacture posting milestones.
  const journeyEvents=[...events].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
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
  const profile=<section className={panel}><h2 className="text-base font-semibold">{tr('Account details','অ্যাকাউন্টের তথ্য')}</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{[
      ['Account','user1'],['Display name',DEMO_USERS.user1.nameEn],['Identifier',DEMO_USERS.user1.tin],['Taxpayer class','Individual'],
      ['Income sources','Salary, bank interest and consultancy'],['Address','Address unavailable'],
      ['Assessment years',taxYears.map(x=>x.year).join(', ')],['Representative mandate','Not applicable']
    ].map(x=><div key={x[0]} className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">{x[0]}</p><p className="mt-1 text-sm font-semibold">{x[1]}</p></div>)}</div>
  </section>;
  const notifications=<section className={panel}><h2 className="text-base font-semibold">{tr('Recent updates','সাম্প্রতিক আপডেট')}</h2><div className="mt-3 space-y-3">{scoped.filter(x=>x.state!=='POSTED').map(x=><article className="rounded-xl border border-slate-200 p-3" key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{x.title}</h3>{tag(x.state)}</div><p className="mt-1 text-xs text-slate-500">{x.date} · {x.ref}</p><p className="mt-2 text-sm">{x.detail}</p><button className={action+' mt-2'} type="button" onClick={()=>setSelected(x)}>{tr('View reference','রেফারেন্স দেখুন')}</button></article>)}</div></section>;
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
  const content=route==='ledger'?ledger:route==='history'?transactionList:route==='certificates'?documents:route==='corrections'?exceptions:route==='journey'?journey:route==='account_profile'?profile:route==='account_notifications'?notifications:route==='account_settings'?settings:overview;
  return <div data-testid="user1-synthetic-workspace" data-dashboard-view={overviewRoute?'true':undefined} className={'taxpayer-workspace mx-auto max-w-7xl space-y-4 pb-12 '+(bn?'font-bengali':'')}>
    {overviewRoute && <section aria-label={tr('Welcome','স্বাগতম')} className="space-y-1 px-1">
      <p className="text-sm text-taxpay-muted">{greeting.salutation}</p>
      <p className="text-lg font-semibold text-taxpay-text">{greeting.welcome}</p>
    </section>}
    {header}
    {activityTabs && <TaxpayerActivityTabs />}
    {content}
    {route==='history'&&<DemoServiceRecordsPanel userId="user1" language={language}/>}
    {selected && <TaxPayModal
      title={selected.title}
      onClose={() => setSelected(null)}
      closeIconLabel={tr('Close transaction details','লেনদেনের বিস্তারিত বন্ধ করুন')}
      className="taxpayer-transaction-detail"
      hideFooter
    >
      <PaymentLifecycleDetails language={language} record={{
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
      }}/>
    </TaxPayModal>}
  </div>;
};
