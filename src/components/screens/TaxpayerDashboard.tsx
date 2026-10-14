import React, { useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpen, CalendarDays, Download, FileText, Receipt, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { ASSESSMENT_YEARS } from '../../data/mockData';

type Category = 'all'|'income'|'source'|'travel';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const fmt = (v:number) => new Intl.NumberFormat('en-BD').format(v);
export const TaxpayerDashboard: React.FC = () => {
  const { language, receipts, taxpayerProfile, demoUser, navigate, selectReceipt } = useTaxState();
  const { user } = useAccountIdentity();
  const bn = language === 'bn';
  const tr = (en:string, bangla:string) => bn ? bangla : en;
  const [year,setYear] = useState(ASSESSMENT_YEARS[0] || '2026-2027');
  const [category,setCategory] = useState<Category>('all');
  const [query,setQuery] = useState('');
  // Explicit demo activity ONLY. Payer-TIN fixtures do not establish credit ownership.
  const exampleRecords = useMemo(()=> demoUser && !user
    ? receipts.filter(r=>r.payerTin===taxpayerProfile.tin && r.assessmentYear===year) : [],
    [demoUser,user,receipts,taxpayerProfile.tin,year]);
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
  const yearText = year.replace('-', '–');
  const filterLabels:{key:Category;en:string;bn:string}[] = [
    {key:'all',en:'All transactions',bn:'সব লেনদেন'},
    {key:'income',en:'Income tax',bn:'আয়কর'},
    {key:'source',en:'Source tax',bn:'উৎসে কর'},
    {key:'travel',en:'Travel tax',bn:'ভ্রমণ কর'}
  ];
  const metrics=[
    {en:'Income tax liability',bn:'মোট আয়কর দায়',desc:'No certified assessment source',bd:'যাচাইকৃত কর নির্ধারণের উৎস নেই'},
    {en:'Recognized TDS / AIT',bn:'স্বীকৃত টিডিএস / এআইটি',desc:'Credit ownership not verified',bd:'ক্রেডিটের মালিকানা যাচাই হয়নি'},
    {en:'Verified tax payments',bn:'যাচাইকৃত কর পরিশোধ',desc:'Settlement and ledger proof required',bd:'সেটেলমেন্ট ও লেজার প্রমাণ প্রয়োজন'},
    {en:'Remaining payable',bn:'অবশিষ্ট পরিশোধযোগ্য',desc:'Requires verified credit and liability records',bd:'করদায় ও ক্রেডিট যাচাই প্রয়োজন'}
  ];
  const button='min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700';
  const empty=(heading:string,detail:string)=><div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center">
    <Activity size={24} aria-hidden="true" className="mb-3 text-slate-400"/>
    <h3 className="text-sm font-semibold text-slate-700">{heading}</h3>
    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{detail}</p>
  </div>;
  const csv=()=>{
    const esc=(x:string|number)=>'"'+String(x).replace(/"/g,'""')+'"';
    const body=[['DEMONSTRATION ONLY','Reference','Category','Assessment year','Amount BDT','Treasury status'],...records.map(r=>['Not official payment evidence',r.challanNo,r.paymentCategory,r.assessmentYear,r.totalAmount,r.treasuryStatus])]
      .map(r=>r.map(esc).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='TaxPay_example_transactions.csv';a.click();URL.revokeObjectURL(url);
  };
  return <div className={`mx-auto max-w-[1480px] space-y-5 pb-14 ${bn?'font-bengali':''}`}>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800 sm:text-[28px]">{tr('Dashboard summary','ড্যাশবোর্ড সারসংক্ষেপ')}</h1>
        <p className="mt-1 text-sm text-slate-500">{tr('Income tax, payments and financial records in one view','আয়কর, পেমেন্ট ও আর্থিক রেকর্ড একসঙ্গে')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{tr('Assessment year','করবর্ষ')}
          <select value={year} onChange={e=>setYear(e.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">{ASSESSMENT_YEARS.map(y=><option key={y} value={y}>{y}</option>)}</select>
        </label>
        <button type="button" className={button} disabled={!records.length} onClick={csv}><Download size={15} className="mr-2 inline" aria-hidden="true"/>{tr('Export CSV','CSV রপ্তানি')}</button>
      </div>
    </header>
    <section className={card} aria-label={tr('Selected tax year summary','নির্বাচিত করবর্ষের সারসংক্ষেপ')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="mt-1 text-2xl font-semibold text-slate-800">{yearText}</h2>
          <p className="mt-1 text-xs text-slate-500">{tr('Taxpayer financial lifecycle overview','করদাতার আর্থিক জীবনচক্রের সারসংক্ষেপ')}</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-36 rounded-xl border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">{tr('Tax position','করের অবস্থা')}</p><p className="mt-1 font-semibold text-slate-800">{tr('Unverified','যাচাই হয়নি')}</p></div>
          <div className="min-w-36 rounded-xl border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">{tr('Ledger credit','লেজার ক্রেডিট')}</p><p className="mt-1 font-semibold text-slate-800">{tr('Not connected','সংযুক্ত নয়')}</p></div>
          <div className="min-w-36 rounded-xl border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">{tr('Payment evidence','পেমেন্টের প্রমাণ')}</p><p className="mt-1 font-semibold text-slate-800">{tr('Not verified','যাচাই হয়নি')}</p></div>
        </div>
      </div>
    </section>
    <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
      {tr('Liability and credit values remain unavailable until verified records are connected.','যাচাইকৃত রেকর্ড সংযুক্ত না হওয়া পর্যন্ত করদায় ও ক্রেডিট দেখানো যাবে না।')}
    </p>
    <section aria-label={tr('Tax position summary','কর অবস্থানের সারসংক্ষেপ')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m,i)=><article className={card} key={m.en}>
        <div className="flex justify-between gap-2"><p className="text-sm text-slate-500">{tr(m.en,m.bn)}</p><span className="rounded-lg bg-blue-50 p-2 text-blue-700">{i===1?<ShieldCheck size={19} aria-hidden="true"/>:i===2?<Receipt size={19} aria-hidden="true"/>:<WalletCards size={19} aria-hidden="true"/>}</span></div>
        <p className="mt-4 text-xl font-semibold text-slate-800">{tr('Not available','পাওয়া যাচ্ছে না')}</p>
      </article>)}
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(285px,1fr)_minmax(0,2.1fr)]">
      <section className={card} aria-labelledby="composition-heading">
        <h2 id="composition-heading" className="text-base font-semibold text-slate-800">{tr('Payment composition','পেমেন্টের বিভাজন')}</h2>
        <p className="mt-1 text-xs text-slate-500">{tr('Activity by payment category','খাতভিত্তিক লেনদেন')}</p>
        {exampleRecords.length?<><div role="img" aria-label={tr('Example transaction category proportions, not tax credits','নমুনা লেনদেনের অনুপাত; কর ক্রেডিট নয়')} className="relative mx-auto my-6 h-52 w-52 rounded-full" style={{background:`conic-gradient(#5ea9e4 0% ${100*demoTotals[0]/(sum||1)}%, #a078c7 ${100*demoTotals[0]/(sum||1)}% ${100*(demoTotals[0]+demoTotals[1])/(sum||1)}%, #ed977e ${100*(demoTotals[0]+demoTotals[1])/(sum||1)}% 100%)`}}><div className="absolute inset-[54px] flex items-center justify-center rounded-full bg-white text-center text-xs font-semibold text-slate-700">{tr('Activity breakdown','লেনদেনের বিভাজন')}</div></div>
        {['Income tax','Source tax','Travel tax'].map((label,i)=><div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm" key={label}><p><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${['bg-sky-400','bg-purple-400','bg-orange-400'][i]}`}/>{label}</p><p className="font-semibold">৳ {fmt(demoTotals[i])}</p></div>)}</>:
        empty(tr('No activity to summarize','সারসংক্ষেপের তথ্য নেই'),tr('No eligible payment records are available for this year. Credits require verified sources.','এই করবর্ষে নমুনা পেমেন্ট নেই। বাস্তব ক্রেডিটের জন্য যাচাইকৃত উৎস প্রয়োজন।'))}
      </section>
      <section className={card} aria-labelledby="activity-heading">
        <div className="flex items-start justify-between"><div><h2 id="activity-heading" className="text-base font-semibold text-slate-800">{tr('Transaction activity','লেনদেনের কার্যক্রম')}</h2><p className="mt-1 text-xs text-slate-500">{tr('Monthly distribution by selected payment type','নির্বাচিত পেমেন্টের মাসভিত্তিক বণ্টন')}</p></div><CalendarDays size={20} className="text-blue-700"/></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr('Category filter','খাতের ফিল্টার')}>
          {filterLabels.map(f=><button key={f.key} type="button" aria-pressed={category===f.key} className={`min-h-11 rounded-lg border px-2 text-xs font-medium ${category===f.key?'border-blue-700 bg-blue-50 text-blue-900':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={()=>setCategory(f.key)}>{tr(f.en,f.bn)}</button>)}
        </div>
        {records.length?<div className="mt-8 flex h-64 items-end gap-2 border-b border-slate-200 pb-6" role="img" aria-label={tr('Example transaction amounts by record, not verified financial activity','নমুনা লেনদেনের পরিমাণ; যাচাইকৃত আর্থিক তথ্য নয়')}>
          {records.slice(0,12).map((r,i)=>{const max=Math.max(...records.map(x=>x.totalAmount),1);return <div key={r.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><p className="text-[10px] text-slate-500">{fmt(r.totalAmount)}</p><div className="w-full max-w-12 rounded-t-md bg-blue-400" style={{height:Math.max(4,r.totalAmount/max*185)}}/><p className="text-[10px] text-slate-500">{i+1}</p></div>})}
        </div>:<div className="mt-5">{empty(tr('No activity for this selection','এই বাছাইয়ে লেনদেন নেই'),tr('The chart remains empty until records are available. No values are fabricated.','রেকর্ড ছাড়া কোনো সংখ্যা তৈরি করে চার্ট দেখানো হয় না।'))}</div>}
      </section>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={card}><h2 className="text-base font-semibold">{tr('TDS & advance tax','টিডিএস ও অগ্রিম কর')}</h2><p className="mt-2 text-xs text-slate-500">{tr('Credits require verified taxpayer ownership, period and legal eligibility.','ক্রেডিটের জন্য মালিকানা, করবর্ষ ও আইনি যোগ্যতার যাচাই প্রয়োজন।')}</p>
        {empty(tr('No verified credit records','যাচাইকৃত ক্রেডিট নেই'),tr('TDS and AIT cannot be derived from payer receipts.','শুধু পেমেন্ট রসিদ দিয়ে টিডিএস/এআইটি নির্ধারিত হয় না।'))}
        <button className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" type="button" onClick={()=>navigate('ledger')}>{tr('Review tax ledger','কর লেজার দেখুন')}<ArrowRight size={16}/></button>
      </section>
      <section className={card}><h2 className="text-base font-semibold">{tr('Challan & reconciliation','চালান ও সমন্বয়')}</h2><p className="mt-2 text-xs text-slate-500">{tr('Gateway, government receipt and ledger stages are independent.','গেটওয়ে, সরকারি রসিদ ও লেজার পৃথক ধাপ।')}</p>
        {empty(tr('No verified challan data','যাচাইকৃত চালানের তথ্য নেই'),tr('Challan details require government verification.','চালান সরকারি যাচাই সাপেক্ষ।'))}
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
      {records.length?<div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">{tr('Reference','রেফারেন্স')}</th><th className="p-3">{tr('Category','খাত')}</th><th className="p-3">{tr('Amount (sample)','পরিমাণ (নমুনা)')}</th><th className="p-3">{tr('Status (sample)','অবস্থা (নমুনা)')}</th><th className="p-3">{tr('Action','বিস্তারিত')}</th></tr></thead><tbody>{records.slice(0,10).map(r=><tr key={r.id} className="border-b border-slate-100"><td className="p-3 font-medium">{r.challanNo}</td><td className="p-3">{String(r.paymentCategory)}</td><td className="p-3">৳ {fmt(r.totalAmount)}</td><td className="p-3 text-slate-600">{r.treasuryStatus}</td><td className="p-3"><button type="button" className="min-h-10 text-blue-800 underline" onClick={()=>selectReceipt(r.id)}>{tr('Details','বিস্তারিত')}</button></td></tr>)}</tbody></table></div>:
      <div className="mt-4">{empty(tr('No matching transactions','মিল পাওয়া যায়নি'),tr('Try another year or filter. Verified records are not connected to this design preview.','অন্য করবর্ষ বা ফিল্টার দেখুন। প্রকৃত যাচাইকৃত তথ্য এখনো যুক্ত নয়।'))}</div>}
      <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800" onClick={()=>navigate('history')}>{tr('Open transaction history','লেনদেনের ইতিহাস খুলুন')}<ArrowRight size={16}/></button>
    </section>
  </div>;
};
