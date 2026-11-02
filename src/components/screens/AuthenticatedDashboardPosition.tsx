import React from 'react';
import {ArrowRight, CalendarDays, CircleHelp, ClipboardList} from 'lucide-react';

/**
 * Phase A/B dashboard presentation for verified application users.
 *
 * The v11 user1 fixture is not a government account ledger. Until the signed-in
 * owner has assessed liability and posted credits from an authoritative source,
 * every financial figure stays unavailable. Do not use private scenario payment
 * requests, receipts, or another taxpayer's example amounts as tax credits.
 */
export const AuthenticatedDashboardPosition: React.FC<{
  language: 'en'|'bn';
  year: string;
  years: readonly string[];
  onSelectYear: (year:string)=>void;
  onNavigate: (route:'secure_workspace'|'corrections'|'history'|'ledger')=>void;
}> = ({language,year,years,onSelectYear,onNavigate}) => {
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const panel='min-w-0 rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5';
  const action='inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 py-2 text-left text-sm font-medium text-taxpay-primary hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary';
  const unavailable=tr('Not available','পাওয়া যায়নি');
  const rows=[
    {en:'Income tax liability',bn:'আয়কর দায়'},
    {en:'TDS & advance tax',bn:'উৎসে কর ও অগ্রিম কর'},
    {en:'Direct payments',bn:'সরাসরি পরিশোধ'},
    {en:'Applied credits',bn:'সমন্বিত কর ক্রেডিট'},
    {en:'Remaining balance',bn:'অবশিষ্ট দায়'},
    {en:'Travel tax (separate)',bn:'ভ্রমণ কর (পৃথক)'},
  ];
  const credits=[
    {en:'Tax deducted at source',bn:'উৎসে কর'},
    {en:'Advance income tax',bn:'অগ্রিম আয়কর'},
    {en:'Direct tax payments',bn:'সরাসরি কর পরিশোধ'},
  ];
  const visibleYears=[...new Set([year,...years.slice(0,3)])];
  return <div className="space-y-4" data-testid="authenticated-dashboard-v11">
    <section aria-labelledby="account-needs-review-title" className={panel}>
      <div className="flex items-center gap-2">
        <ClipboardList size={19} className="text-taxpay-primary" aria-hidden="true"/>
        <h2 id="account-needs-review-title" className="text-base font-semibold text-taxpay-text">{tr('Needs review','পর্যালোচনার জন্য')}</h2>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {([
          {en:'Payment requests',bn:'পেমেন্ট অনুরোধ',route:'secure_workspace'},
          {en:'Corrections',bn:'সংশোধন',route:'corrections'},
          {en:'Payment history',bn:'পেমেন্টের ইতিহাস',route:'history'},
        ] as const).map(item=><button key={item.route} type="button" className={action+' justify-between'}
          onClick={()=>onNavigate(item.route)}>
          {tr(item.en,item.bn)}<ArrowRight size={15} aria-hidden="true"/>
        </button>)}
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel} aria-labelledby="account-tax-coverage-title">
        <h2 id="account-tax-coverage-title" className="text-base font-semibold text-taxpay-text">{tr('Tax coverage','কর সমন্বয়ের চিত্র')}</h2>
        <div className="flex flex-col items-center gap-4 py-5 sm:flex-row sm:justify-center">
          <div role="img" aria-label={tr('Tax coverage unavailable; verified liability and credits are not linked','যাচাইকৃত করদায় ও ক্রেডিট সংযুক্ত না থাকায় কর সমন্বয়ের তথ্য পাওয়া যায়নি')}
            className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-[18px] border-slate-100">
            <span className="text-2xl font-semibold text-taxpay-muted">—</span>
          </div>
          <dl className="w-full max-w-52 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt>{tr('Applied credits','সমন্বিত ক্রেডিট')}</dt><dd className="font-semibold">—</dd></div>
            <div className="flex items-center justify-between gap-3"><dt>{tr('Remaining balance','অবশিষ্ট দায়')}</dt><dd className="font-semibold">—</dd></div>
          </dl>
        </div>
        <p className="text-xs text-taxpay-muted">{tr('Verified liability and posted credits are required.','যাচাইকৃত করদায় ও সমন্বিত ক্রেডিট প্রয়োজন।')}</p>
      </section>
      <section className={panel} aria-labelledby="account-monthly-activity-title">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} aria-hidden="true" className="text-taxpay-primary"/>
          <h2 id="account-monthly-activity-title" className="text-base font-semibold text-taxpay-text">{tr('Monthly activity','মাসভিত্তিক কার্যক্রম')}</h2>
        </div>
        <div className="mt-4 flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-taxpay-border bg-slate-50 px-4 py-6 text-center">
          <CircleHelp size={22} aria-hidden="true" className="text-taxpay-muted"/>
          <p className="mt-2 text-sm font-medium text-taxpay-text">{unavailable}</p>
          <p className="mt-1 text-xs text-taxpay-muted">{tr('Verified payment activity for this assessment year is not connected.','এই করবর্ষের যাচাইকৃত পরিশোধ তথ্য এখনো সংযুক্ত নয়।')}</p>
        </div>
        <button type="button" className={action+' mt-3'} onClick={()=>onNavigate('history')}>{tr('View payment history','পেমেন্টের ইতিহাস দেখুন')}<ArrowRight size={15} aria-hidden="true"/></button>
      </section>
    </div>

    <section className={panel} aria-label={tr('Assessment-year tax position','করবর্ষ অনুযায়ী কর অবস্থান')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-taxpay-text">{tr('By assessment year','করবর্ষ অনুযায়ী')}</h2>
        <span className="text-xs text-taxpay-muted">{tr('No verified balances available','যাচাইকৃত ব্যালেন্স পাওয়া যায়নি')}</span>
      </div>
      <div className="mt-3 max-w-full overflow-x-auto" role="region" aria-label={tr('Assessment-year table scroll area','করবর্ষের তালিকা স্ক্রল')} tabIndex={0}>
        <table className="min-w-[660px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-taxpay-muted"><tr>
            {[tr('Assessment year','করবর্ষ'),tr('Liability','করদায়'),tr('TDS & AIT','উৎসে ও অগ্রিম কর'),tr('Direct paid','সরাসরি পরিশোধ'),tr('Remaining','অবশিষ্ট')].map((heading,index)=>
              <th key={heading} scope="col" className={'px-3 py-3 '+(index?'text-right':'')}>{heading}</th>)}
          </tr></thead>
          <tbody>{visibleYears.map(item=><tr key={item} className="border-b border-taxpay-border">
            <td className="px-3 py-3"><button type="button" aria-pressed={item===year}
              className={'min-h-10 rounded-lg px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary '+(item===year?'bg-taxpay-light text-taxpay-primary':'text-taxpay-text hover:bg-slate-50')}
              onClick={()=>onSelectYear(item)}>{item}</button></td>
            {[0,1,2,3].map(index=><td className="px-3 py-3 text-right tabular-nums" key={index}>—</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel} aria-labelledby="account-credit-composition-title">
        <h2 id="account-credit-composition-title" className="text-base font-semibold text-taxpay-text">{tr('How your credits are made up','আপনার ক্রেডিটের বিবরণ')}</h2>
        <div role="img" aria-label={tr('Posted credit composition unavailable','সমন্বিত ক্রেডিটের বিভাজন পাওয়া যায়নি')} className="mt-4 h-3 rounded-full bg-slate-100"/>
        <table className="mt-3 w-full text-sm" aria-label={tr('Posted credit components','সমন্বিত ক্রেডিটের অংশ')}>
          <tbody>{credits.map(item=><tr className="border-b border-taxpay-border" key={item.en}>
            <th scope="row" className="py-3 text-left font-normal text-taxpay-muted">{tr(item.en,item.bn)}</th>
            <td className="py-3 text-right font-semibold tabular-nums">—</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" className="py-3 text-left font-semibold">{tr('Total applied credits','মোট সমন্বিত ক্রেডিট')}</th><td className="py-3 text-right font-semibold">—</td></tr></tfoot>
        </table>
        <p className="text-xs text-taxpay-muted">{tr('No credit is assumed from a payment request or receipt.','পেমেন্ট অনুরোধ বা রসিদকে স্বয়ংক্রিয়ভাবে কর ক্রেডিট ধরা হয়নি।')}</p>
      </section>
      <section className={panel} aria-label={tr('Current tax position','বর্তমান কর অবস্থান')}>
        <h2 className="text-base font-semibold text-taxpay-text">{tr('Current tax position','বর্তমান কর অবস্থান')}</h2>
        <p className="mt-1 text-xs text-taxpay-muted">{tr('Assessment year','করবর্ষ')}: {year}</p>
        <dl className="mt-3 space-y-0 text-sm">{rows.map(item=><div key={item.en} className="flex items-center justify-between gap-3 border-b border-taxpay-border py-3">
          <dt className="text-taxpay-muted">{tr(item.en,item.bn)}</dt><dd className="font-semibold tabular-nums">—</dd>
        </div>)}</dl>
        <button type="button" className={action+' mt-3'} onClick={()=>onNavigate('ledger')}>{tr('Open tax ledger','কর লেজার দেখুন')}<ArrowRight size={15} aria-hidden="true"/></button>
      </section>
    </div>
  </div>;
};
