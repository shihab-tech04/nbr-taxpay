import React, {useMemo, useState} from 'react';
import {Activity, ArrowRight, Bell, BookOpen, CalendarDays, CircleAlert, CreditCard, Download, FileCheck2, FilePenLine, FileText, Landmark, ReceiptText, Search, ShieldCheck, WalletCards} from 'lucide-react';
import {useTaxState} from '../../services/taxState';

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
  {year:'2025-2026',liability:180000,description:'Salary and professional income — illustrative liability'},
  {year:'2024-2025',liability:125000,description:'Previous sample income-tax year'},
  {year:'2023-2024',liability:90000,description:'Historical sample income-tax year'}
] as const;
const events:readonly RecordItem[] = [
  {id:'U1-001',year:'2025-2026',date:'2025-09-30',kind:'tds',amount:27000,state:'POSTED',title:'Salary withholding',detail:'Illustrative employer deduction',channel:'Employer sample',ref:'DEMO-ETDS-SAL-01'},
  {id:'U1-002',year:'2025-2026',date:'2025-12-14',kind:'ait',amount:20000,state:'POSTED',title:'Advance income tax',detail:'Sample advance tax allocation',channel:'Demo bank',ref:'DEMO-AIT-01',challan:'DEMO-CH-AIT-01'},
  {id:'U1-003',year:'2025-2026',date:'2026-01-18',kind:'tds',amount:9000,state:'POSTED',title:'Bank interest withholding',detail:'Illustrative bank certificate',channel:'Sample bank',ref:'DEMO-ETDS-BANK-02'},
  {id:'U1-004',year:'2025-2026',date:'2026-03-15',kind:'ait',amount:12000,state:'POSTED',title:'Additional advance tax',detail:'Sample advance tax allocation',channel:'Demo bank',ref:'DEMO-AIT-02',challan:'DEMO-CH-AIT-02'},
  {id:'U1-005',year:'2025-2026',date:'2026-03-29',kind:'tds',amount:12000,state:'POSTED',title:'Professional fee withholding',detail:'Illustrative deductor withholding',channel:'Sample deductor',ref:'DEMO-ETDS-PRO-03'},
  {id:'U1-006',year:'2025-2026',date:'2026-04-08',kind:'travel',amount:6500,state:'POSTED',title:'Travel tax payment',detail:'Separate travel-tax category; not an income-tax credit',channel:'Demo card',ref:'DEMO-TRAVEL-01',challan:'DEMO-CH-TRAVEL-01'},
  {id:'U1-007',year:'2025-2026',date:'2026-06-21',kind:'income',amount:30000,state:'POSTED',title:'Tax with return — part 1',detail:'Sample bank settlement and scenario ledger allocation',channel:'Demo bank transfer',ref:'DEMO-PAY-01',challan:'DEMO-CH-INC-01'},
  {id:'U1-008',year:'2025-2026',date:'2026-09-14',kind:'income',amount:45000,state:'POSTED',title:'Tax with return — part 2',detail:'Sample settled payment with linked demo ledger entry',channel:'Demo mobile banking',ref:'DEMO-PAY-02',challan:'DEMO-CH-INC-02'},
  {id:'U1-009',year:'2025-2026',date:'2026-10-12',kind:'income',amount:14000,state:'PENDING',title:'Pending bank reconciliation',detail:'No settlement or ledger credit assigned',channel:'Demo internet banking',ref:'DEMO-PAY-PEND-01'},
  {id:'U1-010',year:'2025-2026',date:'2026-09-23',kind:'income',amount:9000,state:'FAILED',title:'Failed payment attempt',detail:'Gateway failure — no settlement',channel:'Demo card',ref:'DEMO-PAY-FAIL-01'},
  {id:'U1-011',year:'2025-2026',date:'2026-05-04',kind:'income',amount:5000,state:'REVERSED',title:'Reversed attempted payment',detail:'Compensating reversal in demo activity; excluded from credits',channel:'Demo mobile banking',ref:'DEMO-PAY-REV-01'},
  {id:'U1-012',year:'2025-2026',date:'2026-09-28',kind:'tds',amount:7000,state:'DISPUTED',title:'Unmatched withholding candidate',detail:'Ownership not established — excluded from recognized scenario credit',channel:'Unmatched deductor',ref:'DEMO-ETDS-DISPUTED'},
  {id:'U1-013',year:'2025-2026',date:'2026-10-02',kind:'refund',amount:10000,state:'REQUESTED',title:'Refund inquiry',detail:'Not approved and not disbursed; not deducted from liability',channel:'Demo request',ref:'DEMO-REFUND-01'},
  {id:'U1-014',year:'2025-2026',date:'2026-10-06',kind:'adjustment',amount:3000,state:'REQUESTED',title:'Credit reassignment inquiry',detail:'Under review; no posting or adjustment of balances',channel:'Demo review',ref:'DEMO-ADJ-01'},
  {id:'U1-101',year:'2024-2025',date:'2024-09-10',kind:'tds',amount:25000,state:'POSTED',title:'Salary withholding',detail:'Historical example deduction',channel:'Employer sample',ref:'DEMO-ETDS-24-01'},
  {id:'U1-102',year:'2024-2025',date:'2024-11-30',kind:'ait',amount:20000,state:'POSTED',title:'Advance income tax',detail:'Historical demo allocation',channel:'Demo bank',ref:'DEMO-AIT-24-01',challan:'DEMO-CH-24-AIT'},
  {id:'U1-103',year:'2024-2025',date:'2025-06-25',kind:'income',amount:40000,state:'POSTED',title:'Tax payment part 1',detail:'Historical demo paid amount',channel:'Demo bank',ref:'DEMO-PAY-24-01',challan:'DEMO-CH-24-01'},
  {id:'U1-104',year:'2024-2025',date:'2025-09-10',kind:'income',amount:30000,state:'POSTED',title:'Tax payment part 2',detail:'Historical demo paid amount',channel:'Demo bank',ref:'DEMO-PAY-24-02',challan:'DEMO-CH-24-02'},
  {id:'U1-201',year:'2023-2024',date:'2023-09-12',kind:'tds',amount:30000,state:'POSTED',title:'Salary withholding',detail:'Historical demo withholding',channel:'Employer sample',ref:'DEMO-ETDS-23-01'},
  {id:'U1-202',year:'2023-2024',date:'2024-01-20',kind:'ait',amount:15000,state:'POSTED',title:'Advance tax',detail:'Historical demo allocation',channel:'Demo bank',ref:'DEMO-AIT-23-01',challan:'DEMO-CH-23-AIT'},
  {id:'U1-203',year:'2023-2024',date:'2024-08-20',kind:'income',amount:45000,state:'POSTED',title:'Tax with return',detail:'Historical demo settlement',channel:'Demo bank',ref:'DEMO-PAY-23-01',challan:'DEMO-CH-23-01'}
];
const labels:Record<Kind,[string,string]> = {
  income:['Income tax','আয়কর'],tds:['TDS / withholding','উৎসে কর'],ait:['Advance income tax','অগ্রিম আয়কর'],
  travel:['Travel tax','ভ্রমণ কর'],refund:['Refund inquiry','ফেরত অনুসন্ধান'],adjustment:['Adjustment inquiry','সমন্বয় অনুসন্ধান']
};
const stateLabels:Record<State,[string,string]> = {
  POSTED:['Posted in scenario','নমুনা লেজারে পোস্ট হয়েছে'],
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
type Route = 'taxpayer_home'|'dashboard'|'history'|'ledger'|'journey'|'certificates'|'corrections'|'account_profile'|'account_notifications'|'account_settings'|'services';
export const user1DemoRoutes:readonly string[]=['taxpayer_home','dashboard','history','ledger','journey','certificates','corrections','account_profile','account_notifications','account_settings','services'];
export const User1DemoExperience:React.FC<{route:string}>=({route})=>{
  const {navigate,language}=useTaxState();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [year,setYear]=useState<string>(()=>{
    const initial=new URLSearchParams(window.location.search).get('scenarioYear');
    return taxYears.some(x=>x.year===initial) ? initial! : '2025-2026';
  });
  const changeYear=(nextYear:string)=>{
    setYear(nextYear);
    const url=new URL(window.location.href);
    url.searchParams.set('scenarioYear',nextYear);
    window.history.replaceState(window.history.state,'',url);
  };
  const [kind,setKind]=useState<Kind|'all'>('all');
  const [status,setStatus]=useState<State|'all'>('all');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<RecordItem|null>(null);
  const totals=yearSummary(year)!;
  const scoped=useMemo(()=>events.filter(x=>x.year===year),[year]);
  const filtered=useMemo(()=>scoped.filter(x=>(kind==='all'||kind===x.kind)&&(status==='all'||status===x.state)&&[x.ref,x.title,x.challan||'',x.detail].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)),[scoped,kind,status,query]);
  const navigateTo=(r:string)=>navigate(r);
  const view=(r:string,textEn:string,textBn:string)=> <button type="button" className={action} onClick={()=>navigateTo(r)}>{tr(textEn,textBn)} <ArrowRight size={15} aria-hidden="true"/></button>;
  const tag=(s:State)=><span className={'inline-flex rounded-full px-2 py-1 text-[11px] font-medium '+stateColor[s]}>{tr(...stateLabels[s])}</span>;
  const sub=(desc:string,bengali:string)=><p className="mt-1 text-xs leading-5 text-slate-500">{tr(desc,bengali)}</p>;
  const card=(title:string,titleBn:string,value:string,subtitle:string,subtitleBn:string)=><article className={panel}>
    <p className="text-xs font-medium text-slate-500">{tr(title,titleBn)}</p><p className="mt-2 text-xl font-semibold text-slate-800">{value}</p>{sub(subtitle,subtitleBn)}
  </article>;
  const money=(x:number)=>amount(x,bn);
  const csv=()=>{
    const clean=(v:string|number)=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const lines=[['SYNTHETIC EXAMPLE ONLY','Reference','Assessment year','Kind','Amount BDT','Status','Event date','Challan sample'],
      ...filtered.map(x=>['NOT GOVERNMENT DATA',x.ref,x.year,x.kind,x.amount,x.state,x.date,x.challan||''])].map(x=>x.map(clean).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='TaxPay_user1_SYNTHETIC_'+year+'.csv';a.click();URL.revokeObjectURL(url);
  };
  const years=<label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{tr('Assessment year','করবর্ষ')}
    <select aria-label={tr('Assessment year','করবর্ষ')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={year} onChange={e=>changeYear(e.target.value)}>{taxYears.map(x=><option key={x.year} value={x.year}>{x.year}</option>)}</select>
  </label>;
  const transactionList=<div className={panel}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-base font-semibold">{tr('Transaction and evidence register','লেনদেন ও প্রমাণের তালিকা')}</h2>{sub('Scenario records, including exclusions and exceptions','ব্যতিক্রমসহ সব নমুনা রেকর্ড')}</div>
      <button type="button" onClick={csv} className={action}><Download size={16}/>{tr('Export sample CSV','নমুনা CSV নিন')}</button>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <label className="relative"><Search size={17} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input aria-label={tr('Search transaction reference','লেনদেন রেফারেন্স খুঁজুন')} type="search" className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Search reference / title','রেফারেন্স/বিবরণ খুঁজুন')}/></label>
      <select aria-label={tr('Transaction category','লেনদেনের ধরন')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={kind} onChange={e=>setKind(e.target.value as Kind|'all')}>
        <option value="all">{tr('All types','সব ধরন')}</option>{(Object.keys(labels) as Kind[]).map(k=><option key={k} value={k}>{tr(...labels[k])}</option>)}
      </select>
      <select aria-label={tr('Transaction status','লেনদেনের অবস্থা')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value as State|'all')}>
        <option value="all">{tr('All statuses','সব অবস্থা')}</option>{(Object.keys(stateLabels) as State[]).map(s=><option key={s} value={s}>{tr(...stateLabels[s])}</option>)}
      </select>
    </div>
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">{tr('Records','রেকর্ড')}: {filtered.length}</p>
    {filtered.length ? <div className="mt-2 space-y-2">{filtered.map(item=><article key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 break-all text-xs text-slate-500">{item.ref} · {item.date}</p><p className="mt-1 text-xs text-slate-600">{tr(...labels[item.kind])}</p></div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end"><p className="text-sm font-semibold tabular-nums">{money(item.amount)}</p>{tag(item.state)}
        <button type="button" onClick={()=>setSelected(item)} className={action}>{tr('Details','বিস্তারিত')}</button></div>
    </article>)}</div>:<div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><h3 className="font-semibold">{tr('No matching records','মিল পাওয়া যায়নি')}</h3>{sub('Change the filters or select another year.','ফিল্টার বা করবর্ষ পরিবর্তন করুন।')}</div>}
  </div>;
  const header=<header className={panel}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="mt-1 text-2xl font-semibold text-slate-800 sm:text-3xl">{route==='history'?tr('Payments & activity','পেমেন্ট ও লেনদেন'):route==='ledger'?tr('Tax ledger','কর লেজার'):route==='certificates'?tr('Certificate previews','সনদের নমুনা'):route==='corrections'?tr('Corrections & exceptions','সংশোধন ও ব্যতিক্রম'):route==='journey'?tr('My tax journey','আমার কর কার্যক্রম'):route==='account_profile'?tr('Taxpayer profile','করদাতা প্রোফাইল'):route==='account_notifications'?tr('Notifications','বিজ্ঞপ্তি'):route==='account_settings'?tr('Profile settings','প্রোফাইল সেটিংস'):route==='services'?tr('Connected services','সংযুক্ত সেবা'):tr('Dashboard summary','ড্যাশবোর্ড সারসংক্ষেপ')}</h1>
      {sub('Example figures only · Not an official tax account','শুধু নমুনা হিসাব · সরকারি কর হিসাব নয়')}</div>{years}</div>
    <div className="mt-4 flex flex-wrap gap-2">{view('taxpayer_home','Overview','সারসংক্ষেপ')}{view('history','Open transaction history','লেনদেনের ইতিহাস খুলুন')}{view('ledger','Ledger','লেজার')}{view('certificates','Documents','নথি')}</div>
  </header>;
  const coveredBreakdown=[
    {label:tr('TDS','উৎসে কর'),value:totals.tds,color:'var(--color-taxpay-primary)'},
    {label:tr('Advance tax','অগ্রিম কর'),value:totals.ait,color:'var(--color-taxpay-secondary)'},
    {label:tr('Direct payment','সরাসরি পেমেন্ট'),value:totals.direct,color:'var(--color-taxpay-dark)'},
    {label:tr('Remaining','অবশিষ্ট'),value:totals.outstanding,color:'var(--color-taxpay-accent)'}
  ];
  const gradients=coveredBreakdown.reduce((a,x)=>{const from=a.end;const end=from+meter(x.value,totals.liability);return {end,parts:[...a.parts,x.color+' '+from+'% '+end+'%']};},{end:0,parts:[] as string[]});
  const cats:Kind[]=['income','tds','ait','travel'];
  const [chartKind,setChartKind]=useState<Kind>('income');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthValues=months.map((_,i)=>scoped.filter(x=>x.kind===chartKind&&x.state==='POSTED'&&Number(x.date.slice(5,7))===i+1).reduce((a,x)=>a+x.amount,0));
  const chartMax=Math.max(...monthValues,1);
  const overview=<>
    <section className={panel} aria-label={tr('Assessment-year summary','করবর্ষ সারসংক্ষেপ')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-semibold text-taxpay-text">{year.replace('-', '–')}</h2>{sub('Assessment-year summary','করবর্ষের সারসংক্ষেপ')}</div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{tr('Scenario transactions','নমুনা লেনদেন')}</p><p className="text-lg font-semibold">{scoped.length}</p></div>
          <div className="rounded-xl border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{tr('Posted examples','পোস্টকৃত নমুনা')}</p><p className="text-lg font-semibold">{totals.posted}</p></div>
          <div className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 lg:col-span-1"><p className="text-xs text-slate-500">{tr('Exceptions','ব্যতিক্রম')}</p><p className="text-lg font-semibold">{scoped.filter(x=>x.state!=='POSTED').length}</p></div>
        </div>
      </div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={tr('Financial summary','আর্থিক সারসংক্ষেপ')}>
      {card('Illustrative income tax liability','নমুনা আয়কর দায়',money(totals.liability),'Scenario input; no legal calculation performed','নমুনা ইনপুট, আইনি হিসাব নয়')}
      {card('Applied TDS and AIT','প্রয়োগকৃত উৎসে কর ও অগ্রিম কর',money(totals.tds+totals.ait),'Only posted scenario credits','শুধু নমুনা পোস্টকৃত ক্রেডিট')}
      {card('Direct payments posted','পোস্টকৃত সরাসরি পেমেন্ট',money(totals.direct),'Excludes pending, failed and reversed','অপেক্ষমাণ, ব্যর্থ ও রিভার্স বাদ')}
      {card('Illustrative outstanding','নমুনা বকেয়া',money(totals.outstanding),'Liability minus eligible scenario allocations','নমুনা দায় থেকে নমুনা ক্রেডিট বাদ')}
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(290px,1fr)_minmax(0,2fr)]">
      <section className={panel}><h2 className="text-base font-semibold">{tr('How the liability is covered','দায় পরিশোধের বিভাজন')}</h2>{sub('Linked to the example ledger and transaction IDs','নমুনা লেজার ও লেনদেনের সাথে সংযুক্ত')}
        <div className="relative mx-auto my-5 h-52 w-52 rounded-full sm:h-56 sm:w-56" role="img" aria-label={tr('Scenario liability coverage breakdown','নমুনা করদায়ের বিভাজন')} style={{background:'conic-gradient('+gradients.parts.join(',')+')'}}>
          <div className="absolute inset-[48px] flex flex-col items-center justify-center rounded-full bg-white p-2 text-center"><p className="text-xs text-slate-500">{tr('Applied','প্রয়োগকৃত')}</p><p className="text-lg font-semibold">{Math.round(meter(totals.applied,totals.liability))}%</p></div>
        </div>
        {coveredBreakdown.map(x=><div key={x.label} className="flex items-center justify-between border-t border-slate-100 py-2"><p className="text-sm"><span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor:x.color}}/>{x.label}</p><p className="text-sm font-semibold">{money(x.value)}</p></div>)}
      </section>
      <section className={panel}><div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-semibold">{tr('Transaction activity','লেনদেন কার্যক্রম')}</h2>{sub('Monthly posted amounts from the same scenario records','একই নমুনা রেকর্ড থেকে মাসভিত্তিক পোস্টকৃত পরিমাণ')}</div><CalendarDays size={19} className="text-blue-700"/></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{cats.map(k=><button type="button" key={k} aria-pressed={chartKind===k} onClick={()=>setChartKind(k)} className={'min-h-11 rounded-lg border px-2 text-xs font-medium '+(chartKind===k?'border-taxpay-primary bg-taxpay-light text-taxpay-dark':'border-slate-200 bg-white text-slate-700')}>{tr(...labels[k])}</button>)}</div>
        <div className="mt-5 flex h-64 items-end gap-2 border-b border-slate-200 pb-1" role="img" aria-label={tr('Monthly scenario amount bars in BDT','মাসভিত্তিক নমুনা অর্থের বার চার্ট')}>
          {monthValues.map((v,i)=><div key={months[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><p className="text-[9px] text-slate-500">{v?Math.round(v/1000)+'k':''}</p><div className="w-full max-w-10 rounded-t bg-taxpay-secondary" style={{height:Math.max(3,v*183/chartMax)+'px'}}/><p className="text-[9px] text-slate-500">{months[i]}</p></div>)}
        </div>
        {sub('Zero-height bars indicate no posted scenario event, not confirmed absence of real activity.','শূন্য বার মানে নমুনায় তথ্য নেই; বাস্তব লেনদেন নেই এমন নয়।')}
        <div className="mt-4 grid grid-cols-2 gap-2">{card('Travel tax (separate)','ভ্রমণ কর (পৃথক)',money(totals.travel),'Not included as income-tax credit','আয়কর ক্রেডিটে ধরা হয়নি')}{card('Pending settlement','অপেক্ষমাণ সেটেলমেন্ট',money(totals.pending),'Excluded from paid or credited totals','পরিশোধিত বা ক্রেডিটে ধরা হয়নি')}</div>
      </section>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={panel}><h2 className="font-semibold">{tr('Income tax and source records','আয়কর ও উৎসের রেকর্ড')}</h2>
        {coveredBreakdown.slice(0,3).map(x=><div key={x.label} className="mt-4"><div className="flex items-center justify-between text-xs"><p>{x.label}</p><p className="font-semibold">{money(x.value)}</p></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-taxpay-secondary" style={{width:meter(x.value,totals.liability)+'%'}}/></div></div>)}
        <div className="mt-4">{view('ledger','Open source-to-ledger trace','লেজারের বিবরণ দেখুন')}</div>
      </section>
      <section className={panel}><h2 className="font-semibold">{tr('Reconciliation health','সমন্বয়ের অবস্থা')}</h2>
        <div className="mt-4 space-y-3">{[['Scenario posted',totals.posted],['Pending',scoped.filter(x=>x.state==='PENDING').length],['Failed / reversed',scoped.filter(x=>x.state==='FAILED'||x.state==='REVERSED').length],['Unmatched credits',totals.disputed]].map(row=><div className="flex justify-between border-b border-slate-100 pb-2 text-sm" key={row[0]}><p>{row[0]}</p><p className="font-semibold">{row[1]}</p></div>)}</div>
        <div className="mt-3">{view('history','Investigate exceptions','ব্যতিক্রম দেখুন')}</div>
      </section>
      <section className={panel}><h2 className="font-semibold">{tr('Documents and support','নথি ও সহায়তা')}</h2><div className="mt-3 grid gap-2">{view('certificates','Receipts / sample challans','রসিদ / নমুনা চালান')}{view('corrections','Corrections and refund','সংশোধন ও ফেরত')}{view('account_notifications','Alerts and updates','বিজ্ঞপ্তি')}{view('journey','Taxpayer lifecycle','করদাতা জীবনচক্র')}</div></section>
    </div>
  </>;
  const ledger=<>
    <section className="grid gap-3 sm:grid-cols-3">{card('Illustrative debit','নমুনা ডেবিট',money(totals.liability),'Single opening liability per tax year','প্রতি করবর্ষে একটি প্রাথমিক দায়')}
      {card('Illustrative allocated credits','নমুনা ক্রেডিট',money(totals.applied),'TDS + AIT + posted direct payments','উৎসে কর + অগ্রিম কর + পোস্টকৃত পেমেন্ট')}
      {card('Remaining scenario balance','নমুনা বকেয়া',money(totals.outstanding),'Independent from travel-tax records','ভ্রমণ কর থেকে পৃথক')}</section>
    <section className={panel}><h2 className="text-base font-semibold">{tr('Running-balance journal','চলতি ব্যালেন্সের জার্নাল')}</h2>{sub('Read-only demonstration; one liability and eligible posted entries, never other taxpayers.','শুধু প্রদর্শনী; অন্য করদাতার রেকর্ড নয়।')}
      <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Date','Reference','Debit','Credit','Remaining'].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
      <tbody>{(()=>{let bal=totals.liability;const postings=scoped.filter(x=>x.state==='POSTED'&&['income','tds','ait'].includes(x.kind)).sort((a,b)=>a.date.localeCompare(b.date));return [{id:'OPEN',date:year.slice(0,4)+'-07-01',ref:'DEMO-LIABILITY-'+year,debit:totals.liability,credit:0,bal:totals.liability},...postings.map(x=>{bal-=x.amount;return {id:x.id,date:x.date,ref:x.ref,debit:0,credit:x.amount,bal};})].map(x=><tr className="border-b border-slate-100" key={x.id}><td className="whitespace-nowrap px-3 py-3">{x.date}</td><td className="px-3 py-3">{x.ref}</td><td className="px-3 py-3">{x.debit?money(x.debit):'—'}</td><td className="px-3 py-3">{x.credit?money(x.credit):'—'}</td><td className="px-3 py-3 font-semibold">{money(x.bal)}</td></tr>)})()}</tbody></table></div>
      <p className="mt-3 text-xs text-slate-600">{tr('Control check','যাচাই')}: {money(totals.liability)} − {money(totals.applied)} = {money(totals.outstanding)}. {tr('Pending, travel-tax, disputed, failed and reversal entries are excluded.','অপেক্ষমাণ, ভ্রমণ, বিরোধপূর্ণ, ব্যর্থ ও রিভার্স অন্তর্ভুক্ত নয়।')}</p>
    </section>
    {transactionList}
  </>;
  const documents=<><section className={panel}><h2 className="text-base font-semibold">{tr('Sample receipt and evidence register','নমুনা রসিদ ও প্রমাণের তালিকা')}</h2>{sub('Reference-linked previews, not government challans or certificates','রেফারেন্স-সংযুক্ত নমুনা; সরকারি চালান বা সনদ নয়')}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{scoped.filter(x=>x.state==='POSTED'&&(x.challan||x.kind==='tds')).map(x=><article key={x.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><FileCheck2 size={18} className="text-sky-700"/><h3 className="text-sm font-semibold">{x.title}</h3></div><p className="mt-2 break-all text-xs text-slate-500">{x.challan||x.ref}</p><p className="mt-2 text-sm font-semibold">{money(x.amount)}</p><button type="button" className={action+' mt-3'} onClick={()=>setSelected(x)}>{tr('View sample evidence','নমুনা প্রমাণ দেখুন')}</button></article>)}</div>
  </section>{transactionList}</>;
  const correctionRecords=scoped.filter(x=>['PENDING','FAILED','REVERSED','DISPUTED','REQUESTED'].includes(x.state));
  const exceptions=<><div className="grid gap-3 sm:grid-cols-3">{card('Pending items','অপেক্ষমাণ',String(correctionRecords.filter(x=>x.state==='PENDING').length),'No credit until resolved','সমাধানের আগে ক্রেডিট নয়')}
    {card('Refund / adjustment requests','ফেরত / সমন্বয় আবেদন',String(correctionRecords.filter(x=>x.state==='REQUESTED').length),'No approval implied','অনুমোদন বোঝায় না')}
    {card('Unmatched / failed / reversed','অমিল / ব্যর্থ / রিভার্স',String(correctionRecords.filter(x=>['DISPUTED','FAILED','REVERSED'].includes(x.state)).length),'Not included as credits','ক্রেডিট হিসাবে গণনা নয়')}</div>
    <section className={panel}><h2 className="text-base font-semibold">{tr('Exception and correction tracker','ব্যতিক্রম ও সংশোধন ট্র্যাকার')}</h2><div className="mt-3 space-y-3">{correctionRecords.length?correctionRecords.map(x=><article className="rounded-lg border border-slate-200 p-3" key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{x.title}</h3>{tag(x.state)}</div><p className="mt-1 text-xs text-slate-500">{x.ref} · {x.date}</p><p className="mt-2 text-sm">{x.detail}</p><button type="button" className={action+' mt-3'} onClick={()=>setSelected(x)}>{tr('Review case','কেস দেখুন')}</button></article>):<p className="text-sm text-slate-500">{tr('No example exceptions this year','এই করবর্ষে নমুনা ব্যতিক্রম নেই')}</p>}</div></section></>;
  const journey=<><section className={panel}><h2 className="text-base font-semibold">{tr('Transaction lifecycle examples','লেনদেন জীবনচক্রের উদাহরণ')}</h2>{sub('Each stage is shown from scenario evidence, not NBR services.','প্রতিটি ধাপ শুধু নমুনা প্রমাণ থেকে দেখানো হয়েছে।')}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{['Initiated','Gateway decision','Treasury / sample settlement','Scenario ledger allocation'].map((s,i)=><article key={s} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-blue-800">{'0'+(i+1)}</p><h3 className="mt-1 font-semibold">{s}</h3><p className="mt-2 text-xs text-slate-500">{i===0?'All scenario records start as requests':i===1?'Examples include failed and reversed attempts':i===2?'Only POSTED example payments represent scenario settlement':'Only POSTED eligible income, TDS or AIT is applied; travel excluded'}</p></article>)}</div>
    <div className="mt-4 flex flex-wrap gap-2">{view('history','Inspect transactions','লেনদেন দেখুন')}{view('ledger','Inspect allocations','ক্রেডিট দেখুন')}{view('certificates','Inspect evidence','প্রমাণ দেখুন')}</div>
  </section>{transactionList}</>;
  const profile=<section className={panel}><h2 className="text-base font-semibold">{tr('Synthetic taxpayer identity','কৃত্রিম করদাতার পরিচয়')}</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{[
      ['Scenario account','user1'],['Display name','Sample Individual Taxpayer 01'],['Identifier','DEMO-TIN-001'],['Taxpayer class','Individual (illustrative)'],
      ['Income sources','Salary, bank interest and consultancy (example)'],['Address','Synthetic address, Dhaka (not a real location)'],
      ['Assessment years',taxYears.map(x=>x.year).join(', ')],['Real TIN verified','No'],['Representative mandate','Not applicable to this sample'],['Government connection','Not connected']
    ].map(x=><div key={x[0]} className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">{x[0]}</p><p className="mt-1 text-sm font-semibold">{x[1]}</p></div>)}</div>
    {sub('The scenario is local public sample data, not an authenticated taxpayer profile.','এই নমুনা তথ্য লগইন করা করদাতার বাস্তব প্রোফাইল নয়।')}
  </section>;
  const notifications=<section className={panel}><h2 className="text-base font-semibold">{tr('Scenario notifications','নমুনা বিজ্ঞপ্তি')}</h2><div className="mt-3 space-y-3">{scoped.filter(x=>x.state!=='POSTED').map(x=><article className="rounded-xl border border-slate-200 p-3" key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{x.title}</h3>{tag(x.state)}</div><p className="mt-1 text-xs text-slate-500">{x.date} · {x.ref}</p><p className="mt-2 text-sm">{x.detail}</p><button className={action+' mt-2'} type="button" onClick={()=>setSelected(x)}>{tr('View reference','রেফারেন্স দেখুন')}</button></article>)}</div></section>;
  const settings=<section className={panel}><h2 className="text-base font-semibold">{tr('Example preferences','নমুনা পছন্দসমূহ')}</h2>{sub('Interface language follows the main app control. Nothing here updates a registered taxpayer or remote database.','ভাষা মূল অ্যাপ থেকে নিয়ন্ত্রিত। কোনো বাস্তব প্রোফাইল বা ডেটাবেস পরিবর্তন হয় না।')}<p className="mt-4 text-sm">{tr('Selected language','নির্বাচিত ভাষা')}: {bn?'বাংলা':'English'}</p><p className="mt-2 text-sm">{tr('Scenario scope','নমুনা ক্ষেত্র')}: user1</p></section>;
  const services=<section className={panel}><h2 className="text-base font-semibold">{tr('Data source coverage','তথ্য উৎসের অবস্থা')}</h2>{sub('Scenario modules are populated from one client-side fixture; official integrations remain disconnected.','সব নমুনা মডিউল একটি স্থানীয় উৎস থেকে আসে; বাস্তব সংযোগ নেই।')}<div className="mt-4 grid gap-3 sm:grid-cols-2">{[
    ['Income tax assessment','Scenario fixture / not official'],['eTDS','Scenario withholding candidates / not connected'],['Advance tax','Scenario AIT payments / not connected'],['eLedger','Scenario running ledger / not connected'],['A-Challan','Sample references only / not verified'],['Travel tax','Separate scenario payment / not an income tax credit'],['Bank settlement','Scenario state only / not connected'],['Refunds and corrections','Illustrative inquiries / no approval']
  ].map(x=><div key={x[0]} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold">{x[0]}</p><p className="mt-1 text-xs text-slate-500">{x[1]}</p></div>)}</div></section>;
  const content=route==='ledger'?ledger:route==='history'?<>{card('Payment & activity count','লেনদেন সংখ্যা',String(scoped.length),'All states retained with independent evidence','সব অবস্থা আলাদা দেখানো হয়েছে')}{transactionList}<section className="rounded-xl border border-blue-100 bg-blue-50 p-4"><h2 className="text-sm font-semibold">{tr('Sign in to simulate a payment','পেমেন্ট সিমুলেট করতে সাইন ইন করুন')}</h2>{sub('This publicly accessible example is read-only. Protected payment SQL requires an authenticated account.','এই নমুনা শুধু দেখার জন্য। পেমেন্ট SQL ব্যবহারে অনুমোদিত লগইন প্রয়োজন।')}<button className={action+' mt-3'} onClick={()=>navigateTo('secure_workspace')} type="button">{tr('Open secure sign-in','নিরাপদ সাইন ইন খুলুন')}</button></section></>:route==='certificates'?documents:route==='corrections'?exceptions:route==='journey'?journey:route==='account_profile'?profile:route==='account_notifications'?notifications:route==='account_settings'?settings:route==='services'?services:overview;
  return <div data-testid="user1-synthetic-workspace" className={'mx-auto max-w-7xl space-y-4 pb-12 '+(bn?'font-bengali':'')}>
    {header}{content}
    {selected&&<div role="presentation" className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="user1-detail-title" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3"><h2 id="user1-detail-title" className="text-xl font-semibold">{selected.title}</h2><button type="button" className={action} onClick={()=>setSelected(null)}>{tr('Close','বন্ধ')}</button></div>
        <p className="mt-2 text-xs font-semibold text-amber-800">{tr('SYNTHETIC REFERENCE — NOT A GOVERNMENT CHALLAN','কৃত্রিম রেফারেন্স — সরকারি চালান নয়')}</p>
        <dl className="mt-4 space-y-3">{[
          ['Reference',selected.ref],['Assessment year',selected.year],['Date',selected.date],['Category',tr(...labels[selected.kind])],['Amount',money(selected.amount)],
          ['Status',tr(...stateLabels[selected.state])],['Channel (example)',selected.channel],['Sample challan',selected.challan||'Not issued'],['Meaning',selected.detail]
        ].map(x=><div className="border-b border-slate-100 pb-2" key={x[0]}><dt className="text-xs text-slate-500">{x[0]}</dt><dd className="mt-1 break-words text-sm font-semibold">{x[1]}</dd></div>)}</dl>
      </section>
    </div>}
  </div>;
};
