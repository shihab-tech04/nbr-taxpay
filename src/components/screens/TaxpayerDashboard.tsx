import React from 'react';
import { ArrowRight, BookOpen, CalendarDays, CircleHelp, History, Receipt } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const TaxpayerDashboard: React.FC = () => {
  const { taxpayerProfile, navigate, language } = useTaxState();
  const bn=language==='bn';
  const label=(en:string,bengali:string)=>bn?bengali:en;
  const rows=[
    {en:'Outstanding tax',bn:'বকেয়া কর',detailEn:'Assessment not available',detailBn:'কর নির্ধারণ পাওয়া যায়নি'},
    {en:'Recognized credits',bn:'স্বীকৃত কর ক্রেডিট',detailEn:'Credit records not available',detailBn:'ক্রেডিটের তথ্য পাওয়া যায়নি'},
    {en:'Advance tax status',bn:'অগ্রিম করের অবস্থা',detailEn:'Schedule not available',detailBn:'সময়সূচি পাওয়া যায়নি'}
  ];
  return (
    <div className={`mx-auto max-w-5xl space-y-5 pb-12 ${bn?'font-bengali':''}`}>
      <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
        <p className="text-xs font-semibold text-taxpay-dark">{label('Sample taxpayer · account overview','নমুনা করদাতা · হিসাবের সারসংক্ষেপ')}</p>
        <h1 className="mt-1 text-2xl font-bold text-taxpay-text sm:text-3xl">{label('Tax dashboard','কর সারসংক্ষেপ')}</h1>
        <p className="mt-2 text-sm text-taxpay-muted">{bn?taxpayerProfile.nameBn:taxpayerProfile.nameEn} · e-TIN: <span className="font-mono-plex">{taxpayerProfile.tin}</span></p>
      </header>

      <section aria-labelledby="tax-summary-title" className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <h2 id="tax-summary-title" className="mb-3 text-lg font-bold text-taxpay-text">{label('Tax position','করের অবস্থান')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map(item=>(
            <div key={item.en} className="rounded-lg border border-taxpay-border p-4">
              <p className="text-sm text-taxpay-muted">{bn?item.bn:item.en}</p>
              <p className="mt-2 text-lg font-semibold text-taxpay-text">{label('Unavailable','পাওয়া যাচ্ছে না')}</p>
              <p className="mt-1 text-xs text-taxpay-muted">{bn?item.detailBn:item.detailEn}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tax-advance-title" className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays size={20} className="text-taxpay-dark" aria-hidden="true"/>
          <h2 id="tax-advance-title" className="text-lg font-bold text-taxpay-text">{label('Advance tax instalments','অগ্রিম করের কিস্তি')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(q=>(
            <div key={q} className="rounded-lg border border-taxpay-border bg-taxpay-background p-3">
              <p className="text-sm font-semibold text-taxpay-text">{bn?`কিস্তি ${q}`:`Quarter ${q}`}</p>
              <p className="mt-1 text-xs text-taxpay-muted">{label('Not verified','যাচাইকৃত নয়')}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tax-withholding-title" className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Receipt size={20} className="text-taxpay-dark" aria-hidden="true"/>
          <h2 id="tax-withholding-title" className="text-lg font-bold text-taxpay-text">{label('Withholding / TDS','উৎসে কর কর্তন / টিডিএস')}</h2>
        </div>
        <p className="text-sm text-taxpay-muted">{label('No withholding records available.','উৎসে কর কর্তনের তথ্য পাওয়া যায়নি।')}</p>
      </section>

      <nav aria-label={label('Related tax services','সংশ্লিষ্ট কর সেবা')} className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={()=>navigate('history')} className="flex min-h-12 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-4 text-left font-semibold text-taxpay-dark hover:bg-taxpay-light">
          <History size={19} aria-hidden="true"/><span className="flex-1">{label('Payment activity','পেমেন্টের তথ্য')}</span><ArrowRight size={16} aria-hidden="true"/>
        </button>
        <button type="button" onClick={()=>navigate('ledger')} className="flex min-h-12 items-center gap-3 rounded-lg border border-taxpay-border bg-white p-4 text-left font-semibold text-taxpay-dark hover:bg-taxpay-light">
          <BookOpen size={19} aria-hidden="true"/><span className="flex-1">{label('View ledger','লেজার দেখুন')}</span><ArrowRight size={16} aria-hidden="true"/>
        </button>
      </nav>
    </div>
  );
};
