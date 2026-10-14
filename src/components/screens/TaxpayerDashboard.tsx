import React, { useMemo, useState } from 'react';
import { ArrowRight, Activity, BookOpen, CalendarDays, CreditCard, FileText, Receipt, ShieldCheck, TrendingUp } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { ASSESSMENT_YEARS } from '../../data/mockData';

const panel = 'rounded-2xl border border-taxpay-border bg-white p-4 shadow-sm sm:p-6';
type View = 'payments'|'tds'|'ait'|'travel';
export const TaxpayerDashboard: React.FC = () => {
  const { taxpayerProfile, receipts, navigate, selectReceipt, language, demoUser } = useTaxState();
  const { user } = useAccountIdentity();
  const bn = language === 'bn';
  const t = (en: string, bengali: string) => bn ? bengali : en;
  const [year,setYear] = useState(ASSESSMENT_YEARS[0] || '2026-2027');
  const [view,setView] = useState<View>('payments');
  const [query,setQuery] = useState('');
  // Sample receipts are never authoritative liability, verified payments, or credit.
  // Real identities currently require a certified ownership + settlement data contract.
  const examples = useMemo(() => demoUser && !user ? receipts.filter(r=>r.payerTin===taxpayerProfile.tin && r.assessmentYear===year) : [],[receipts,taxpayerProfile.tin,year,demoUser,user]);
  const matching = examples.filter(r => [r.challanNo,r.tokenNumber,r.paymentCategory].join(' ').toLowerCase().includes(query.toLowerCase()));
  const counts = [
    {en:'Total income tax liability',bn:'মোট আয়কর দায়',sub:'Verified assessment required',bnSub:'যাচাইকৃত কর নির্ধারণ প্রয়োজন'},
    {en:'TDS / withholding',bn:'উৎসে কর কর্তন',sub:'Ownership and credit not verified',bnSub:'মালিকানা ও ক্রেডিট যাচাই হয়নি'},
    {en:'AIT / advance tax',bn:'অগ্রিম আয়কর',sub:'Authoritative records not connected',bnSub:'কর্তৃত্বপূর্ণ রেকর্ড সংযুক্ত নয়'},
    {en:'Tax paid & credited',bn:'পরিশোধিত ও ক্রেডিটকৃত কর',sub:'Treasury and ledger confirmation required',bnSub:'ট্রেজারি ও লেজার নিশ্চিতকরণ প্রয়োজন'},
    {en:'Remaining payable',bn:'অবশিষ্ট পরিশোধযোগ্য',sub:'Not calculable from sample receipts',bnSub:'নমুনা রসিদ থেকে গণনা সম্ভব নয়'},
    {en:'Travel tax paid',bn:'পরিশোধিত ভ্রমণ কর',sub:'Separate category; not assumed as credit',bnSub:'পৃথক খাত; ক্রেডিট অনুমান নয়'}
  ];
  const options: {key:View;en:string;bn:string}[] = [
    {key:'payments',en:'Payments',bn:'পেমেন্ট'},
    {key:'tds',en:'TDS',bn:'টিডিএস'},
    {key:'ait',en:'AIT',bn:'এআইটি'},
    {key:'travel',en:'Travel tax',bn:'ভ্রমণ কর'}
  ];
  return <div className={`mx-auto max-w-7xl space-y-5 pb-12 ${bn?'font-bengali':''}`}>
    <header className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold text-taxpay-dark">{t('Taxpayer / Financial overview','করদাতা / আর্থিক সারসংক্ষেপ')}</p>
          <h1 className="mt-1 text-2xl font-bold text-taxpay-text sm:text-3xl">{t('Your tax dashboard','আপনার কর ড্যাশবোর্ড')}</h1>
          <p className="mt-2 text-sm text-taxpay-muted">{t('One place for tax position, payment activity, records and reconciliation.','করের অবস্থান, পেমেন্ট, রেকর্ড ও সমন্বয়ের একক দৃশ্য।')}</p>
        </div>
        <div className="flex flex-col gap-1"><label htmlFor="dashboard-year" className="text-xs font-semibold text-taxpay-text">{t('Assessment year','করবর্ষ')}</label>
          <select id="dashboard-year" value={year} onChange={e=>setYear(e.target.value)} className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
            {ASSESSMENT_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <p className="mt-4 rounded-lg bg-taxpay-light px-3 py-2 text-xs leading-5 text-taxpay-dark" role="status">{t('No certified financial source is connected to this overview. Unavailable is not zero. Example receipts, where present, are not government payment evidence.','এই সারসংক্ষেপে যাচাইকৃত আর্থিক উৎস সংযুক্ত নয়। তথ্য নেই মানে শূন্য নয়। নমুনা রসিদ সরকারি পেমেন্টের প্রমাণ নয়।')}</p>
    </header>
    <section aria-labelledby="dashboard-position"><div className="mb-3 flex items-center gap-2"><TrendingUp size={19} className="text-taxpay-dark"/><h2 id="dashboard-position" className="text-lg font-bold text-taxpay-text">{t('Financial position','আর্থিক অবস্থান')}</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counts.map((c,i)=><article key={c.en} className={panel}>
          <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-taxpay-muted">{t(c.en,c.bn)}</p><span className="rounded-full bg-taxpay-light p-2 text-taxpay-dark">{i===1?<ShieldCheck size={16}/>:i===5?<Receipt size={16}/>:<CreditCard size={16}/>}</span></div>
          <p className="mt-3 text-xl font-semibold text-taxpay-text">{t('Not available','পাওয়া যাচ্ছে না')}</p>
          <p className="mt-2 text-xs text-taxpay-muted">{t(c.sub,c.bnSub)}</p>
        </article>)}
      </div>
    </section>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
      <section className={panel} aria-labelledby="dashboard-composition">
        <h2 id="dashboard-composition" className="text-lg font-semibold">{t('Tax coverage','করের বিপরীতে পরিশোধ')}</h2>
        <p className="mt-1 text-xs text-taxpay-muted">{t('Liability vs eligible credits and confirmed payments','দায়ের বিপরীতে যোগ্য ক্রেডিট ও নিশ্চিত পরিশোধ')}</p>
        <div className="mx-auto my-7 flex h-48 w-48 items-center justify-center rounded-full border-[28px] border-slate-100 text-center sm:h-56 sm:w-56">
          <p className="max-w-28 text-xs font-medium text-taxpay-muted">{t('No verified breakdown','যাচাইকৃত বিভাজন নেই')}</p>
        </div>
        {['TDS','AIT',t('Direct payments','সরাসরি পেমেন্ট'),t('Remaining balance','অবশিষ্ট ব্যালেন্স')].map(x=><div key={x} className="flex justify-between border-t border-taxpay-border py-3 text-sm"><p>{x}</p><p className="text-taxpay-muted">{t('Unavailable','পাওয়া যাচ্ছে না')}</p></div>)}
      </section>
      <section className={panel} aria-labelledby="dashboard-activity">
        <div className="flex items-start justify-between gap-2"><div><h2 id="dashboard-activity" className="text-lg font-semibold">{t('Transaction activity','লেনদেন কার্যক্রম')}</h2><p className="mt-1 text-xs text-taxpay-muted">{t('Monthly verified financial movements','মাসভিত্তিক যাচাইকৃত আর্থিক লেনদেন')}</p></div><CalendarDays size={20} className="text-taxpay-dark"/></div>
        <div role="group" aria-label={t('Activity categories','কার্যক্রমের ধরন')} className="mt-5 flex flex-wrap gap-2">
          {options.map(o=><button type="button" key={o.key} aria-pressed={view===o.key} onClick={()=>setView(o.key)} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${view===o.key?'border-taxpay-dark bg-taxpay-light text-taxpay-dark':'border-taxpay-border bg-white text-taxpay-text'}`}>{t(o.en,o.bn)}</button>)}
        </div>
        <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-taxpay-border bg-taxpay-background p-6 text-center">
          <div><Activity size={28} className="mx-auto mb-3 text-taxpay-dark"/><h3 className="font-semibold text-taxpay-text">{t('No verified activity to chart','চার্টে দেখানোর মতো যাচাইকৃত তথ্য নেই')}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-taxpay-muted">{t('When eligible '+options.find(o=>o.key===view)?.en+' records are connected, this chart will show monthly movements without inventing values.','যাচাইকৃত লেনদেন সংযুক্ত হলে মাসভিত্তিক তথ্য এখানে দেখা যাবে।')}</p></div>
        </div>
      </section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-semibold">{t('Payment and reconciliation status','পেমেন্ট ও সমন্বয়ের অবস্থা')}</h2>
        <p className="mt-3 rounded-xl bg-taxpay-background p-6 text-sm text-taxpay-muted">{t('Settlement, challan verification and ledger posting are separate checks. No authoritative reconciliation events are available yet.','সেটেলমেন্ট, চালান যাচাই ও লেজার পোস্টিং পৃথক ধাপ। বর্তমানে কর্তৃত্বপূর্ণ সমন্বয়ের তথ্য নেই।')}</p>
        <button type="button" onClick={()=>navigate('ledger')} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-taxpay-dark">{t('Open tax ledger','কর লেজার খুলুন')} <ArrowRight size={16}/></button>
      </section>
      <section className={panel}><h2 className="text-lg font-semibold">{t('Documents and next steps','নথি ও পরবর্তী ধাপ')}</h2>
        <div className="mt-4 grid gap-3">{[{icon:Receipt,en:'Payment records',bn:'পেমেন্ট রেকর্ড',route:'history'},{icon:FileText,en:'Receipts and certificates',bn:'রসিদ ও সনদপত্র',route:'certificates'},{icon:BookOpen,en:'Ledger statement',bn:'লেজার বিবরণী',route:'ledger'}].map(x=><button type="button" key={x.route} onClick={()=>navigate(x.route)} className="flex min-h-12 items-center gap-3 rounded-lg border border-taxpay-border px-3 text-left text-sm font-medium text-taxpay-dark hover:bg-taxpay-light"><x.icon size={19}/><span className="flex-1">{t(x.en,x.bn)}</span><ArrowRight size={16}/></button>)}</div>
      </section>
    </div>
    <section className={panel} aria-labelledby="dashboard-records">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="dashboard-records" className="text-lg font-semibold">{t('Payment records','পেমেন্ট রেকর্ড')}</h2><p className="mt-1 text-xs text-taxpay-muted">{examples.length?t('Example records — not verified payments','নমুনা রেকর্ড — যাচাইকৃত পেমেন্ট নয়'):t('No verified financial records connected','যাচাইকৃত আর্থিক রেকর্ড সংযুক্ত নেই')}</p></div>
      <label className="text-xs text-taxpay-text">{t('Search examples','নমুনা খুঁজুন')} <input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="ml-2 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm" placeholder={t('Reference or category','রেফারেন্স বা খাত')}/></label></div>
      {matching.length ? <div className="mt-4 space-y-2">{matching.slice(0,8).map(r=><button type="button" key={r.id} onClick={()=>selectReceipt(r.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-taxpay-border p-3 text-left hover:bg-taxpay-light"><span><span className="block text-sm font-semibold text-taxpay-text">{r.challanNo}</span><span className="text-xs text-taxpay-muted">{r.paymentCategory} · {t('Example only','শুধু নমুনা')}</span></span><span className="flex items-center gap-2 text-xs text-taxpay-dark">{r.treasuryStatus} <ArrowRight size={16}/></span></button>)}</div>:
        <div className="mt-4 rounded-xl border border-dashed border-taxpay-border bg-taxpay-background p-8 text-center"><Receipt size={28} className="mx-auto mb-3 text-taxpay-dark"/><h3 className="font-semibold">{t('No matching payment records','মিল পাওয়া যায়নি')}</h3><p className="mt-2 text-sm text-taxpay-muted">{t('Connected and permitted records will appear here when available.','সংযুক্ত ও অনুমোদিত রেকর্ড পাওয়া গেলে এখানে দেখাবে।')}</p></div>}
      <button type="button" onClick={()=>navigate('history')} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-taxpay-dark">{t('View payment activity','পেমেন্ট কার্যক্রম দেখুন')}<ArrowRight size={16}/></button>
    </section>
  </div>;
};
