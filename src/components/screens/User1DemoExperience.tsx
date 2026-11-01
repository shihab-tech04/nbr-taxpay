import React, {useEffect, useMemo, useState} from 'react';
import {Activity, ArrowRight, Bell, BookOpen, CalendarDays, CircleAlert, CreditCard, Download, Info, FileCheck2, FilePenLine, FileText, Landmark, ReceiptText, Search, ShieldCheck, WalletCards} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {DemoServiceRecordsPanel} from './DemoServiceRecordsPanel';
import {TaxpayerFinancialKpi} from './TaxpayerFinancialKpi';
import {DEMO_USERS} from '../../data/demoUsers';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {taxpayerGreeting} from '../../services/taxpayerGreeting';
import {ReceiptLookup} from './ReceiptLookup';

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
  const trackingActivity=route==='history' && Boolean(routeParams.trackPayment);
  const greeting=taxpayerGreeting(language,new Date().getHours(),bn?DEMO_USERS.user1.nameBn:DEMO_USERS.user1.nameEn,true);
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [year,setYear]=useState<string>(()=>{
    const initial=new URLSearchParams(window.location.search).get('scenarioYear');
    return taxYears.some(x=>x.year===initial) ? initial! : '2025-2026';
  });
  const changeYear=(nextYear:string)=>{
    setYear(nextYear);
    setMonthFilter('all');
    const url=new URL(window.location.href);
    url.searchParams.set('scenarioYear',nextYear);
    // Never carry the previous tax year's calendar month into the next year.
    url.searchParams.delete('monthFilter');
    window.history.replaceState(window.history.state,'',url);
  };
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
  const [selected,setSelected]=useState<RecordItem|null>(null);
  const totals=yearSummary(year)!;
  const scoped=useMemo(()=>events.filter(x=>x.year===year),[year]);
  const filtered=useMemo(()=>scoped.filter(x=>(kind==='all'||kind===x.kind)&&(status==='all'||status===x.state)&&(monthFilter==='all'||x.date.startsWith(monthFilter))&&(!reviewFilter||reviewFilter.includes(x.state))&&[x.ref,x.title,x.challan||'',x.detail].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)),[scoped,kind,status,reviewFilter,monthFilter,query]);
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
    <div className="taxpayer-transaction-filters">
      <label className="taxpayer-transaction-filter taxpayer-transaction-filter--search"><span>{tr('Search','খুঁজুন')}</span><span className="taxpayer-transaction-filter__search"><Search size={17} aria-hidden="true"/><input aria-label={tr('Search transaction reference','লেনদেন রেফারেন্স খুঁজুন')} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={trackingActivity?tr('Enter challan or transaction reference','চালান বা লেনদেন রেফারেন্স লিখুন'):tr('Search reference / title','রেফারেন্স/বিবরণ খুঁজুন')}/></span></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Payment type','পেমেন্টের ধরন')}</span><select aria-label={tr('Transaction category','লেনদেনের ধরন')} value={kind} onChange={e=>setKind(e.target.value as Kind|'all')}>
        <option value="all">{tr('All types','সব ধরন')}</option>{(Object.keys(labels) as Kind[]).map(k=><option key={k} value={k}>{tr(...labels[k])}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Calendar month','ক্যালেন্ডার মাস')}</span><select aria-label={tr('Transaction month','লেনদেনের মাস')} value={availableHistoryMonths.includes(monthFilter)?monthFilter:'all'} onChange={e=>chooseHistoryMonth(e.target.value)}>
        <option value="all">{tr('All months','সব মাস')}</option>{availableHistoryMonths.map(month=><option key={month} value={month}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'))}</option>)}
      </select></label>
      <label className="taxpayer-transaction-filter"><span>{tr('Status','অবস্থা')}</span><select aria-label={tr('Transaction status','লেনদেনের অবস্থা')} value={status} onChange={e=>{setReviewFilter(null);setStatus(e.target.value as State|'all');}}>
        <option value="all">{tr('All statuses','সব অবস্থা')}</option>{(Object.keys(stateLabels) as State[]).map(s=><option key={s} value={s}>{tr(...stateLabels[s])}</option>)}
      </select></label>
    </div>
    <div className="taxpayer-transaction-count">
      <p className="text-xs text-slate-500" aria-live="polite">{tr('Records','রেকর্ড')}: {filtered.length} <span className="text-slate-400">/ {scoped.length}</span></p>
      {reviewFilter&&<button type="button" className="min-h-10 rounded-lg px-3 text-xs font-medium text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
        onClick={()=>setReviewFilter(null)}>{tr('Clear review filter','পর্যালোচনা ফিল্টার মুছুন')}</button>}
    </div>
    {filtered.length ? <div className="taxpayer-transaction-list">
      <div className="taxpayer-transaction-list__columns" aria-hidden="true"><span>{tr('Payment','পেমেন্ট')}</span><span>{tr('Amount','পরিমাণ')}</span><span>{tr('Status','অবস্থা')}</span><span /></div>
      <ul>{filtered.map(item=><li key={item.id} className="taxpayer-transaction-row">
        <div className="taxpayer-transaction-row__identity"><p className="taxpayer-transaction-row__title">{item.title}</p>
          <p className="taxpayer-transaction-row__meta"><span>{tr(...labels[item.kind])}</span><span aria-hidden="true">·</span><time dateTime={item.date}>{formatDate(item.date)}</time></p>
          <p className="taxpayer-transaction-row__ref">{item.ref}</p></div>
        <p className="taxpayer-transaction-row__amount tabular-nums">{money(item.amount)}</p>
        <div className="taxpayer-transaction-row__status">{tag(item.state)}</div>
        <button type="button" onClick={()=>setSelected(item)} className={action+' taxpayer-transaction-row__action'} aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>{tr('Details','বিস্তারিত')}</button>
      </li>)}</ul>
    </div>:<div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><h3 className="font-semibold">{tr('No matching records','মিল পাওয়া যায়নি')}</h3>{sub('Change the filters or select another year.','ফিল্টার বা করবর্ষ পরিবর্তন করুন।')}</div>}
  </section>;
  const overviewRoute=route==='taxpayer_home'||route==='dashboard';
  const pageTitle=route==='history'?(trackingActivity?tr('Track payment','পেমেন্ট অনুসন্ধান'):tr('Payments & activity','পেমেন্ট ও লেনদেন')):route==='ledger'?tr('Tax ledger','কর লেজার'):route==='certificates'?tr('Certificate summaries','সনদের সারসংক্ষেপ'):route==='corrections'?tr('Corrections & exceptions','সংশোধন ও ব্যতিক্রম'):route==='journey'?tr('My tax journey','আমার কর কার্যক্রম'):route==='account_profile'?tr('Taxpayer profile','করদাতা প্রোফাইল'):route==='account_notifications'?tr('Notifications','বিজ্ঞপ্তি'):route==='account_settings'?tr('Profile settings','প্রোফাইল সেটিংস'):tr('Dashboard summary','ড্যাশবোর্ড সারসংক্ষেপ');
  const header=<TaxpayerPageHeading title={pageTitle} className="taxpayer-dashboard-header"
    actions={!['account_profile','account_settings'].includes(route) ? years : undefined} />;
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
      <div className="mt-4 overflow-x-auto rounded-xl border border-taxpay-border" role="region" aria-label={tr('Assessment-year tax position','করবর্ষভিত্তিক কর অবস্থান')} tabIndex={0}>
        <table className="w-full min-w-[660px] text-left text-sm">
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
        </table>
      </div>
      <p className="mt-3 text-xs text-taxpay-muted">{tr('Only posted income tax, TDS and advance tax reduce the displayed balance. Pending, reversed and travel tax are excluded.','শুধু নথিভুক্ত আয়কর, উৎসে কর ও অগ্রিম কর অবশিষ্ট দায় থেকে বাদ যায়। অপেক্ষমাণ, প্রত্যাবর্তিত ও ভ্রমণ কর বাদ।')}</p>
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
  const journalEntries=(()=>{
    let balance=totals.liability;
    const postings=scoped.filter(x=>x.state==='POSTED'&&['income','tds','ait'].includes(x.kind)).sort((a,b)=>a.date.localeCompare(b.date));
    return [{id:'OPEN',date:year.slice(0,4)+'-07-01',ref:'DEMO-LIABILITY-'+year,debit:totals.liability,credit:0,bal:totals.liability},
      ...postings.map(x=>{balance-=x.amount;return {id:x.id,date:x.date,ref:x.ref,debit:0,credit:x.amount,bal:balance};})];
  })();
  const ledger=<>
    <section className="grid gap-3 sm:grid-cols-3">{card('Tax liability','করদায়',money(totals.liability),'Single opening liability per tax year','প্রতি করবর্ষে একটি প্রাথমিক দায়')}
      {card('Applied credits','প্রয়োগকৃত ক্রেডিট',money(totals.applied),'TDS + AIT + posted direct payments','উৎসে কর + অগ্রিম কর + পোস্টকৃত পেমেন্ট')}
      {card('Remaining balance','অবশিষ্ট দায়',money(totals.outstanding),'Independent from travel-tax records','ভ্রমণ কর থেকে পৃথক')}</section>
    <section className={panel}><h2 className="text-base font-semibold">{tr('Running-balance journal','চলতি ব্যালেন্সের জার্নাল')}</h2>{sub('Journal shows the opening liability and eligible posted entries.','জার্নালে প্রাথমিক দায় ও যোগ্য পোস্টকৃত এন্ট্রি দেখানো হয়েছে।')}
      <div className="taxpayer-ledger-journal__mobile mt-4" role="list" aria-label={tr('Journal entries','জার্নাল এন্ট্রি')}>
        {journalEntries.map(entry=><article role="listitem" className="taxpayer-ledger-journal__card" key={entry.id}>
          <div className="taxpayer-ledger-journal__identity"><time dateTime={entry.date}>{entry.date}</time><p>{entry.ref}</p></div>
          <dl>
            <div><dt>{tr('Debit','ডেবিট')}</dt><dd>{entry.debit?money(entry.debit):'—'}</dd></div>
            <div><dt>{tr('Credit','ক্রেডিট')}</dt><dd>{entry.credit?money(entry.credit):'—'}</dd></div>
            <div><dt>{tr('Remaining','অবশিষ্ট')}</dt><dd>{money(entry.bal)}</dd></div>
          </dl>
        </article>)}
      </div>
      <div className="mt-4 hidden overflow-x-auto sm:block"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{[tr('Date','তারিখ'),tr('Reference','রেফারেন্স'),tr('Debit','ডেবিট'),tr('Credit','ক্রেডিট'),tr('Remaining','অবশিষ্ট')].map((label,index)=><th key={label} className={'px-3 py-3 '+(index>=2?'text-right':'')}>{label}</th>)}</tr></thead>
      <tbody>{journalEntries.map(entry=><tr className="border-b border-slate-100" key={entry.id}><td className="whitespace-nowrap px-3 py-3">{entry.date}</td><td className="px-3 py-3">{entry.ref}</td><td className="px-3 py-3 text-right">{entry.debit?money(entry.debit):'—'}</td><td className="px-3 py-3 text-right">{entry.credit?money(entry.credit):'—'}</td><td className="px-3 py-3 text-right font-semibold">{money(entry.bal)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-slate-600">{tr('Control check','যাচাই')}: {money(totals.liability)} − {money(totals.applied)} = {money(totals.outstanding)}. {tr('Pending, travel-tax, disputed, failed and reversal entries are excluded.','অপেক্ষমাণ, ভ্রমণ, বিরোধপূর্ণ, ব্যর্থ ও রিভার্স অন্তর্ভুক্ত নয়।')}</p>
    </section>
  </>;
  const documents=<><section className={panel}><h2 className="text-base font-semibold">{tr('Receipts and supporting records','রসিদ ও সহায়ক নথি')}</h2>{sub('Open a record to see its details','বিস্তারিত দেখতে রেকর্ড খুলুন')}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{scoped.filter(x=>x.state==='POSTED'&&(x.challan||x.kind==='tds')).map(x=><article key={x.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><FileCheck2 size={18} className="text-sky-700"/><h3 className="text-sm font-semibold">{x.title}</h3></div><p className="mt-2 break-all text-xs text-slate-500">{x.challan||x.ref}</p><p className="mt-2 text-sm font-semibold">{money(x.amount)}</p><button type="button" className={action+' mt-3'} onClick={()=>setSelected(x)}>{tr('View details','বিস্তারিত দেখুন')}</button></article>)}</div>
  </section></>;
  const correctionRecords=scoped.filter(x=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(x.state));
  const exceptions=<><div className="grid gap-3 sm:grid-cols-3">{card('Pending items','অপেক্ষমাণ',String(correctionRecords.filter(x=>x.state==='PENDING').length),'No credit until resolved','সমাধানের আগে ক্রেডিট নয়')}
    {card('Refund / adjustment requests','ফেরত / সমন্বয় আবেদন',String(correctionRecords.filter(x=>x.state==='REQUESTED').length),'No approval implied','অনুমোদন বোঝায় না')}
    {card('Unmatched / failed / reversed','অমিল / ব্যর্থ / রিভার্স',String(correctionRecords.filter(x=>['DISPUTED','FAILED','REVERSED'].includes(x.state)).length),'Not included as credits','ক্রেডিট হিসাবে গণনা নয়')}</div>
    <section className={panel}><h2 className="text-base font-semibold">{tr('Exception and correction tracker','ব্যতিক্রম ও সংশোধন ট্র্যাকার')}</h2><div className="mt-3 space-y-3">{correctionRecords.length?correctionRecords.map(x=><article className="rounded-lg border border-slate-200 p-3" key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{x.title}</h3>{tag(x.state)}</div><p className="mt-1 text-xs text-slate-500">{x.ref} · {x.date}</p><p className="mt-2 text-sm">{x.detail}</p><button type="button" className={action+' mt-3'} onClick={()=>setSelected(x)}>{tr('Review case','কেস দেখুন')}</button></article>):<p className="text-sm text-slate-500">{tr('No exceptions this year','এই করবর্ষে ব্যতিক্রম নেই')}</p>}</div></section></>;
  // Only actual scenario events appear; never invent Treasury, challan or credit milestones.
  const chronologicalEvents=[...scoped].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const journey=<section className={panel} aria-labelledby="taxpayer-journey-events-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="taxpayer-journey-events-heading" className="text-base font-semibold">{tr('My tax journey','আমার কর যাত্রা')}</h2>
        {sub('Recorded events for assessment year '+year+'.','করবর্ষ '+year+'-এর নথিভুক্ত ঘটনা।')}</div>
      {view('ledger','Review linked ledger','সংযুক্ত লেজার দেখুন')}
    </div>
    <p className="mt-3 text-xs text-taxpay-muted" role="note">
      {tr('Payment attempts, receipts, ledger entries and applied tax credits are distinct. Only recorded statuses are shown.',
        'পেমেন্টের চেষ্টা, রসিদ, লেজার এন্ট্রি ও সমন্বিত কর ক্রেডিট পৃথক। শুধু নথিভুক্ত অবস্থাই দেখানো হয়েছে।')}
    </p>
    {chronologicalEvents.length ? <ol className="mt-4 space-y-0" aria-label={tr('Chronological account events','কালানুক্রমিক হিসাবের ঘটনা')}>
      {chronologicalEvents.map(item=><li key={item.id} className="relative border-l-2 border-taxpay-border pb-5 pl-5 last:pb-0">
        <span className="absolute -left-[6px] top-1 h-2.5 w-2.5 rounded-full border-2 border-taxpay-primary bg-white" aria-hidden="true"/>
        <article className="min-w-0 rounded-lg border border-taxpay-border bg-taxpay-background p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-xs font-medium text-taxpay-muted"><time dateTime={item.date}>{formatDate(item.date)}</time> · {tr(...labels[item.kind])}</p>
              <h3 className="mt-1 text-sm font-semibold text-taxpay-text">{item.title}</h3></div>
            {tag(item.state)}
          </div>
          <p className="mt-2 break-all text-xs text-taxpay-muted">{tr('Reference','রেফারেন্স')}: {item.ref}</p>
          <p className="mt-2 text-sm text-taxpay-text">{item.detail}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold tabular-nums">{money(item.amount)}</p>
            <button type="button" className={action} onClick={()=>setSelected(item)} aria-label={tr('Details for ','বিস্তারিত: ')+item.title}>
              {tr('View details','বিস্তারিত দেখুন')}<ArrowRight size={15} aria-hidden="true"/>
            </button>
          </div>
        </article>
      </li>)}
    </ol> : <p role="status" className="mt-4 rounded-lg border border-dashed border-taxpay-border px-4 py-6 text-center text-sm text-taxpay-muted">
      {tr('No recorded events for this assessment year.','এই করবর্ষে কোনো নথিভুক্ত ঘটনা নেই।')}
    </p>}
    <div className="mt-4 flex flex-wrap gap-2">{view('history','Inspect transactions','লেনদেন দেখুন')}{view('certificates','Inspect evidence','প্রমাণ দেখুন')}</div>
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
  const content=route==='ledger'?ledger:route==='history'?<>
    {trackingActivity && <section className="space-y-3" aria-labelledby="taxpayer-receipt-lookup-heading">
      <h2 id="taxpayer-receipt-lookup-heading" className="text-base font-semibold">{tr('Payment status & receipt','পেমেন্টের অবস্থা ও রসিদ')}</h2>
      <ReceiptLookup hidePageHeading accountContext />
    </section>}
    {transactionList}
  </>:route==='certificates'?documents:route==='corrections'?exceptions:route==='journey'?journey:route==='account_profile'?profile:route==='account_notifications'?notifications:route==='account_settings'?settings:overview;
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
      <div className="taxpayer-transaction-detail__body">
        <p className="text-sm font-semibold text-taxpay-muted">{tr('Transaction details','লেনদেনের বিস্তারিত')}</p>
        <div className="taxpayer-transaction-detail__summary"><p className="text-xl font-semibold tabular-nums text-taxpay-text">{money(selected.amount)}</p>{tag(selected.state)}</div>
        <dl className="taxpayer-transaction-detail__facts">{[
          [tr('Reference','রেফারেন্স'),selected.ref],[tr('Assessment year','করবর্ষ'),selected.year],[tr('Date','তারিখ'),formatDate(selected.date)],[tr('Category','ধরন'),tr(...labels[selected.kind])],
          [tr('Channel','মাধ্যম'),selected.channel],[tr('Challan reference','চালান রেফারেন্স'),selected.challan||tr('Unavailable','পাওয়া যায়নি')],[tr('Meaning','বিবরণ'),selected.detail]
        ].map(x=><div key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd></div>)}</dl>
      </div>
    </TaxPayModal>}
  </div>;
};
