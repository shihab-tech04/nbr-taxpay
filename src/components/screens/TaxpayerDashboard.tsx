import React, { useMemo, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, Download, Receipt, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import { DemoServiceRecordsPanel } from './DemoServiceRecordsPanel';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { ServiceCategoryTag, type ServiceCategoryCode } from '../ui/ServiceCategoryTag';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import { taxpayerGreeting, isReturningTaxpayer } from '../../services/taxpayerGreeting';
import { AccountActivitySummary } from './AccountActivitySummary';
import {TaxpayerFinancialKpi} from './TaxpayerFinancialKpi';

type Category = 'all'|'income'|'source'|'travel';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const fmt = (v:number) => new Intl.NumberFormat('en-BD').format(v);
export const TaxpayerDashboard: React.FC = () => {
  const { language, receipts, taxpayerProfile, demoUser, previewAccount, userRole, navigate, selectReceipt } = useTaxState();
  const { user } = useAccountIdentity();
  const bn = language === 'bn';
  const tr = (en:string, bangla:string) => bn ? bangla : en;
  const registeredName = typeof user?.user_metadata?.taxpay_display_name === 'string'
    ? user.user_metadata.taxpay_display_name.trim() : '';
  const visibleName = registeredName || (previewAccount ? (bn ? previewAccount.nameBn : previewAccount.nameEn) : '');
  const greeting = taxpayerGreeting(language, new Date().getHours(), visibleName,
    Boolean(previewAccount) || isReturningTaxpayer(user?.created_at, user?.last_sign_in_at));
  const serviceName = (code: ServiceCategoryCode) => code === 'TRAVEL_TAX' ? tr('Travel tax','ভ্রমণ কর') : (CATEGORY_LABELS[code]?.[language] ?? code);
  const [year,setYear] = useState(ASSESSMENT_YEARS[0] || '2026-2027');
  const [category,setCategory] = useState<Category>('all');
  const [query,setQuery] = useState('');
  // Explicit demo activity ONLY. Payer-TIN fixtures do not establish credit ownership.
  const exampleRecords = useMemo(()=>taxpayerPreviewReceipts(receipts,taxpayerProfile.tin,userRole,demoUser,Boolean(user))
    .filter(r=>r.assessmentYear===year),[receipts,taxpayerProfile.tin,userRole,demoUser,user,year]);
  const classify = (kind:string):Category => {
    const x=kind.toUpperCase();
    if (x.includes('TRAVEL')) return 'travel';
    if (x.includes('SOURCE') || x.includes('WITHHOLD')) return 'source';
    return 'income';
  };
  const records = exampleRecords.filter(r=>(category==='all'||classify(String(r.paymentCategory))===category)
    && [r.challanNo,r.tokenNumber,r.paymentCategory].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const demoTotals = (['income','source','travel'] as Category[]).map(k=>exampleRecords.filter(r=>classify(String(r.paymentCategory))===k)
    .reduce((n,r)=>n+r.totalAmount,0));
  const sum = demoTotals.reduce((a,b)=>a+b,0);
  const filterLabels:{key:Category;en:string;bn:string}[] = [
    {key:'all',en:'All transactions',bn:'সব লেনদেন'},
    {key:'income',en:'Income tax',bn:'আয়কর'},
    {key:'source',en:'Source tax',bn:'উৎসে কর'},
    {key:'travel',en:'Travel tax',bn:'ভ্রমণ কর'}
  ];
  // These are payer-scoped preview transactions, never certified liabilities or credits.
  // An empty account must not be shown a fabricated zero balance.
  const amountOrDash = (value:number,hasRecords:boolean) => hasRecords ? '৳ '+fmt(value) : '—';
  const metrics=[
    {en:'Recorded income tax',bn:'নথিভুক্ত আয়কর',value:amountOrDash(demoTotals[0],exampleRecords.length>0),note:'Income-tax activity across recorded statuses',noteBn:'নথিভুক্ত সকল অবস্থার আয়কর লেনদেন'},
    {en:'Recorded source tax',bn:'নথিভুক্ত উৎসে কর',value:amountOrDash(demoTotals[1],exampleRecords.length>0),note:'Withholding activity across recorded statuses',noteBn:'নথিভুক্ত সকল অবস্থার উৎসে কর লেনদেন'},
    {en:'Recorded travel tax',bn:'নথিভুক্ত ভ্রমণ কর',value:amountOrDash(demoTotals[2],exampleRecords.length>0),note:'Travel-tax activity across recorded statuses',noteBn:'নথিভুক্ত সকল অবস্থার ভ্রমণ কর লেনদেন'},
    {en:'Payment records',bn:'পেমেন্ট রেকর্ড',value:exampleRecords.length?fmt(exampleRecords.length):'—',note:'Records in the selected year',noteBn:'নির্বাচিত করবর্ষের রেকর্ড'}
  ];
  const button='min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700';
  const empty=(heading:string,detail:string)=><div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center">
    <Activity size={24} aria-hidden="true" className="mb-3 text-slate-400"/>
    <h3 className="text-sm font-semibold text-slate-700">{heading}</h3>
    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{detail}</p>
  </div>;
  const csv=()=>{
    const esc=(x:string|number)=>'"'+String(x).replace(/"/g,'""')+'"';
    const body=[['Reference','Category','Assessment year','Amount ৳','Treasury status'],...records.map(r=>[r.challanNo,r.paymentCategory,r.assessmentYear,r.totalAmount,r.isSimulatedDemo && (r.treasuryStatus==='TREASURY_SCROLLED'||r.treasuryStatus==='GATEWAY_SUCCESS')?'Treasury status not verified':r.treasuryStatus])]
      .map(r=>r.map(esc).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='Korbritto_transactions.csv';a.click();URL.revokeObjectURL(url);
  };
  const serviceShortcut=<section className="taxpayer-services-shortcut rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5" aria-labelledby="taxpayer-dashboard-services-title">
    <div>
      <h2 id="taxpayer-dashboard-services-title" className="text-lg font-semibold text-taxpay-text">{tr('Tax payment services','কর পরিশোধ সেবা')}</h2>
      <p className="mt-1 text-sm text-taxpay-muted">{tr('Choose Tax with Return or Other Tax, then select an applicable payment type.','প্রথমে রিটার্নসহ কর অথবা অন্যান্য কর বেছে নিন। এরপর প্রযোজ্য কর পরিশোধের ধরন নির্বাচন করুন।')}</p>
    </div>
    <button type="button" className={button} onClick={()=>navigate('services')}>{tr('View payment services','পরিশোধ সেবাসমূহ দেখুন')}<ArrowRight size={16} aria-hidden="true" className="ml-2 inline"/></button>
  </section>;
  return <div className={`mx-auto max-w-[1150px] space-y-4 pb-14 ${bn?'font-bengali':''}`}>
    <section aria-label={tr('Welcome','স্বাগতম')} className="space-y-1 px-1">
      <p className="text-sm text-taxpay-muted">{greeting.salutation}</p>
      <p className="text-lg font-semibold text-taxpay-text">{greeting.welcome}</p>
    </section>
    <TaxpayerPageHeading className="taxpayer-dashboard-header" title={tr('Dashboard summary','ড্যাশবোর্ড সারসংক্ষেপ')}
      description={previewAccount ? `${tr('User ID','ইউজার আইডি')}: ${previewAccount.id}` : undefined}
      actions={!user&&<div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{tr('Assessment year','করবর্ষ')}
          <select value={year} onChange={e=>setYear(e.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">{ASSESSMENT_YEARS.map(y=><option key={y} value={y}>{y}</option>)}</select>
        </label>
        <button type="button" className={button} disabled={!records.length} onClick={csv}><Download size={15} className="mr-2 inline" aria-hidden="true"/>{tr('Export CSV','CSV রপ্তানি')}</button>
      </div>} />
    {user ? <>
      <section aria-label={tr('Financial summary','আর্থিক সারসংক্ষেপ')}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          {en:'Income tax liability',bn:'আয়কর দায়',
            helpEn:'No verified assessed liability is available for this account.',
            helpBn:'এই অ্যাকাউন্টে যাচাইকৃত নির্ধারিত করদায় পাওয়া যায়নি।'},
          {en:'TDS & advance tax',bn:'উৎসে কর ও অগ্রিম কর',
            helpEn:'Verified withholding and advance-tax credits are not available for this account.',
            helpBn:'এই অ্যাকাউন্টে যাচাইকৃত উৎসে কর ও অগ্রিম কর ক্রেডিট পাওয়া যায়নি।'},
          {en:'Direct payments',bn:'সরাসরি পরিশোধ',
            helpEn:'Verified posted direct-payment credits are not available for this account.',
            helpBn:'এই অ্যাকাউন্টে যাচাইকৃত সরাসরি পরিশোধের ক্রেডিট পাওয়া যায়নি।'},
          {en:'Remaining balance',bn:'অবশিষ্ট দায়',
            helpEn:'A verified balance requires an assessed liability and eligible posted credits.',
            helpBn:'যাচাইকৃত অবশিষ্ট দায়ের জন্য নির্ধারিত করদায় ও প্রযোজ্য পোস্টকৃত ক্রেডিট প্রয়োজন।'}
        ] as const).map((item,index)=><TaxpayerFinancialKpi
          key={item.en} language={language} titleEn={item.en} titleBn={item.bn}
          value="—" helpEn={item.helpEn} helpBn={item.helpBn}
          priority={index===3}/>)}
      </section>
      <p className="text-sm text-taxpay-muted" role="status">
        {tr('Verified tax balances are not available. Your account activity is shown below.',
          'যাচাইকৃত করের ব্যালেন্স পাওয়া যায়নি। নিচে আপনার অ্যাকাউন্টের কার্যক্রম দেখুন।')}
      </p>
      <AccountActivitySummary ownerUid={user.id} language={language}
        onNavigate={(route) => navigate(route)} />
      {serviceShortcut}
    </> : <>
    {previewAccount && demoUser && !user && <DemoServiceRecordsPanel userId={demoUser.id} language={language}/>}
    <section aria-label={tr('Payment records summary','পেমেন্ট রেকর্ডের সারসংক্ষেপ')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m,i)=><article className={card} key={m.en}>
        <div className="flex justify-between gap-2"><p className="text-sm text-slate-500">{tr(m.en,m.bn)}</p><span data-payment-service={i===1?'SOURCE_TAX_DEPOSIT':i===2?'TRAVEL_TAX':'TAX_WITH_RETURN'} className="taxpayer-dashboard__category-icon rounded-lg p-2">{i===1?<ShieldCheck size={19} aria-hidden="true"/>:i===2?<Receipt size={19} aria-hidden="true"/>:<WalletCards size={19} aria-hidden="true"/>}</span></div>
        <p className="mt-4 break-words text-xl font-semibold text-slate-800 sm:text-2xl">{m.value}</p>
        <span className="sr-only">{tr(m.note,m.noteBn)}</span>
      </article>)}
    </section>
    <div className="flex justify-end">
      <button className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue-900 underline underline-offset-2" type="button" onClick={()=>navigate('ledger')}>
        {tr('Tax Ledger','কর লেজার')}<ArrowRight size={14} aria-hidden="true"/>
      </button>
    </div>
    {serviceShortcut}
    <div className="grid gap-4 lg:grid-cols-[minmax(285px,1fr)_minmax(0,2.1fr)]">
      <section className={card} aria-labelledby="composition-heading">
        <h2 id="composition-heading" className="text-base font-semibold text-slate-800">{tr('Payment composition','পেমেন্টের বিভাজন')}</h2>
        <p className="mt-1 text-xs text-slate-500">{tr('Activity by payment category','খাতভিত্তিক লেনদেন')}</p>
        {exampleRecords.length?<><div role="img" aria-label={tr('Transaction category breakdown','খাতভিত্তিক লেনদেন')} className="relative mx-auto my-6 h-52 w-52 rounded-full" style={{background:`conic-gradient(var(--service-return-primary) 0% ${100*demoTotals[0]/(sum||1)}%, var(--service-withholding-primary) ${100*demoTotals[0]/(sum||1)}% ${100*(demoTotals[0]+demoTotals[1])/(sum||1)}%, var(--service-other-primary) ${100*(demoTotals[0]+demoTotals[1])/(sum||1)}% 100%)`}}><div className="absolute inset-[54px] flex items-center justify-center rounded-full bg-white text-center text-xs font-semibold text-slate-700">{tr('Activity breakdown','লেনদেনের বিভাজন')}</div></div>
        {[tr('Income tax','আয়কর'),tr('Source tax','উৎসে কর'),tr('Travel tax','ভ্রমণ কর')].map((label,i)=><div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm" key={label}><p><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${['taxpayer-category-legend__swatch--income','taxpayer-category-legend__swatch--source','taxpayer-category-legend__swatch--travel'][i]}`}/>{label}</p><p className="font-semibold">৳ {fmt(demoTotals[i])}</p></div>)}</>:
        empty(tr('No activity to summarize','সারসংক্ষেপের তথ্য নেই'),tr('No payment records for this assessment year.','এই করবর্ষে কোনো পেমেন্ট রেকর্ড নেই।'))}
      </section>
      <section className={card} aria-labelledby="activity-heading">
        <div className="flex items-start justify-between"><div><h2 id="activity-heading" className="text-base font-semibold text-slate-800">{tr('Transaction activity','লেনদেনের কার্যক্রম')}</h2><p className="mt-1 text-xs text-slate-500">{tr('Monthly distribution by selected payment type','নির্বাচিত পেমেন্টের মাসভিত্তিক বণ্টন')}</p></div><CalendarDays size={20} className="text-blue-700"/></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr('Category filter','খাতের ফিল্টার')}>
          {filterLabels.map(f=><button key={f.key} type="button" aria-pressed={category===f.key} data-payment-service={f.key==='source'?'SOURCE_TAX_DEPOSIT':f.key==='travel'?'TRAVEL_TAX':f.key==='income'?'TAX_WITH_RETURN':undefined} className={`taxpayer-dashboard__category-filter min-h-11 rounded-lg border px-2 text-xs font-medium ${category===f.key?'border-blue-700 bg-blue-50 text-blue-900':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={()=>setCategory(f.key)}>{tr(f.en,f.bn)}</button>)}
        </div>
        {records.length?<div className="mt-8 flex h-64 items-end gap-2 border-b border-slate-200 pb-6" role="img" aria-label={tr('Transaction amounts by record','রেকর্ড অনুযায়ী লেনদেনের পরিমাণ')}>
          {records.slice(0,12).map((r,i)=>{const max=Math.max(...records.map(x=>x.totalAmount),1);return <div key={r.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><p className="text-[10px] text-slate-500">{fmt(r.totalAmount)}</p><div data-payment-service={r.paymentCategory} className="taxpayer-dashboard__category-bar w-full max-w-12 rounded-t-md" style={{height:Math.max(4,r.totalAmount/max*185)}}/><p className="text-[10px] text-slate-500">{i+1}</p></div>})}
        </div>:<div className="mt-5">{empty(tr('No activity for this selection','এই বাছাইয়ে লেনদেন নেই'),tr('No transactions match the selected category.','নির্বাচিত খাতে কোনো লেনদেন নেই।'))}</div>}
      </section>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={card}><h2 className="text-base font-semibold">{tr('TDS & advance tax','টিডিএস ও অগ্রিম কর')}</h2>
        <p className="mt-3 text-sm font-medium text-slate-700">{tr('Recognized TDS / AIT','স্বীকৃত টিডিএস / এআইটি')}: {tr('Not available','পাওয়া যাচ্ছে না')}</p>
        <button className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" type="button" onClick={()=>navigate('ledger')}>{tr('Review tax ledger','কর লেজার দেখুন')}<ArrowRight size={16}/></button>
      </section>
      <section className={card}><h2 className="text-base font-semibold">{tr('Challan & reconciliation','চালান ও সমন্বয়')}</h2>
        <p className="mt-3 text-sm font-medium text-slate-700">{tr('Government challan','সরকারি চালান')}: {tr('Not available','পাওয়া যাচ্ছে না')}</p>
        <button className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" type="button" onClick={()=>navigate('certificates')}>{tr('View documents','নথি দেখুন')}<ArrowRight size={16}/></button>
      </section>
      <section className={card}><h2 className="text-base font-semibold">{tr('Payment lifecycle','পেমেন্টের জীবনচক্র')}</h2>
        {['Payment initiated','Gateway processing','Treasury confirmed','Ledger reconciled'].map((x,i)=><div key={x} className="flex items-start gap-3 border-b border-slate-100 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-800">{String(i+1).padStart(2,'0')}</div><div><p className="text-sm font-semibold text-slate-700">{x}</p><p className="text-xs text-slate-500">{tr('Status not established','অবস্থা নিশ্চিত নয়')}</p></div></div>)}
        <button className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" type="button" onClick={()=>navigate('journey')}>{tr('Full payment journey','সম্পূর্ণ পেমেন্ট যাত্রা')}<ArrowRight size={16}/></button>
      </section>
    </div>
    <section className={card} aria-labelledby="transactions-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="transactions-heading" className="text-base font-semibold">{tr('Payment & transaction records','পেমেন্ট ও লেনদেন রেকর্ড')}</h2><p className="mt-1 text-xs text-slate-500">{tr('Select a record to view its status','অবস্থা দেখতে একটি রেকর্ড নির্বাচন করুন')}</p></div>
        <label className="relative flex items-center"><Search className="absolute left-3 text-slate-400" size={17}/><input type="search" className="min-h-11 w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm sm:w-64" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Search reference or type','রেফারেন্স বা খাত খুঁজুন')} aria-label={tr('Search transactions','লেনদেন খুঁজুন')}/></label></div>
      {records.length?<div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">{tr('Reference','রেফারেন্স')}</th><th className="p-3">{tr('Category','খাত')}</th><th className="p-3">{tr('Amount','পরিমাণ')}</th><th className="p-3">{tr('Status','অবস্থা')}</th><th className="p-3">{tr('Action','বিস্তারিত')}</th></tr></thead><tbody>{records.slice(0,10).map(r=><tr key={r.id} className="border-b border-slate-100"><td className="p-3 font-medium">{r.challanNo}</td><td className="p-3"><ServiceCategoryTag code={r.paymentCategory}>{serviceName(r.paymentCategory)}</ServiceCategoryTag></td><td className="p-3">৳ {fmt(r.totalAmount)}</td><td className="p-3 text-slate-600">{r.isSimulatedDemo && (r.treasuryStatus === 'TREASURY_SCROLLED' || r.treasuryStatus === 'GATEWAY_SUCCESS') ? tr('Treasury status not verified','ট্রেজারির অবস্থা যাচাই হয়নি') : r.treasuryStatus}</td><td className="p-3"><button type="button" className="min-h-10 text-blue-800 underline" onClick={()=>selectReceipt(r.id)}>{tr('Details','বিস্তারিত')}</button></td></tr>)}</tbody></table></div>:
      <div className="mt-4">{empty(tr('No matching transactions','মিল পাওয়া যায়নি'),tr('Try another assessment year or category.','অন্য করবর্ষ বা খাত নির্বাচন করুন।'))}</div>}
      <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" onClick={()=>navigate('history')}>{tr('Open transaction history','লেনদেনের ইতিহাস খুলুন')}<ArrowRight size={16}/></button>
    </section>
    </>}
  </div>;
};
