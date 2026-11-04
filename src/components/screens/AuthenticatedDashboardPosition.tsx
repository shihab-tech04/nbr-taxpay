import {TaxPayUnifiedTable} from '../ui/TaxPayDataTable';
import React from 'react';
import {ArrowRight, CalendarDays, CircleHelp, ClipboardList} from 'lucide-react';
import {getIllustrativeDashboardYear,formatIllustrativeTaka} from '../../data/dashboardIllustrativeExample';

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
  exampleMode?:boolean;
}> = ({language,year,years,onSelectYear,onNavigate,exampleMode=false}) => {
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const panel='min-w-0 rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5';
  const action='inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 py-2 text-left text-sm font-medium text-taxpay-primary hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary';
  const unavailable=tr('Not available','পাওয়া যায়নি');
  const sample=exampleMode?getIllustrativeDashboardYear(year):null;
  const money=(value:number|undefined)=>value===undefined?'—':formatIllustrativeTaka(value,language);
  const coverage=sample?Math.min(100,Math.round(100*sample.applied/sample.liability)):0;
  const monthlyMax=sample?Math.max(1,...sample.months.map(m=>m.tds+m.ait+m.direct+m.travel)):1;
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
    <section aria-labelledby="account-quick-actions-title" className={panel}>
      <div className="flex items-center gap-2">
        <ClipboardList size={19} className="text-taxpay-primary" aria-hidden="true"/>
        <h2 id="account-quick-actions-title" className="text-base font-semibold text-taxpay-text">{tr('Quick actions','দ্রুত কাজ')}</h2>
      </div>
      <p className="mt-2 text-sm text-taxpay-muted">{tr('Open your saved requests, correction inquiries or payment history. These links do not mean you have overdue payments.','সংরক্ষিত অনুরোধ, সংশোধনের অনুসন্ধান বা পেমেন্টের ইতিহাস দেখুন। এই লিংকগুলোর অর্থ আপনার বকেয়া পেমেন্ট আছে—এমন নয়।')}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {([
          {en:'Requests & drafts',bn:'অনুরোধ ও খসড়া',route:'secure_workspace'},
          {en:'Correction inquiries',bn:'সংশোধনের অনুসন্ধান',route:'corrections'},
          {en:'Payment history',bn:'পেমেন্টের ইতিহাস',route:'history'},
        ] as const).map(item=><button key={item.route} type="button" className={action+' justify-between'}
          onClick={()=>onNavigate(item.route)}>
          {tr(item.en,item.bn)}<ArrowRight size={15} aria-hidden="true"/>
        </button>)}
      </div>
    </section>
    <section aria-labelledby="account-deadlines-title" className={panel}>
      <div className="flex items-center gap-2">
        <CalendarDays size={19} className="text-taxpay-primary" aria-hidden="true"/>
        <h2 id="account-deadlines-title" className="text-base font-semibold text-taxpay-text">
          {tr('Payment deadlines & demands','কর পরিশোধের সময়সীমা ও দাবি')}
        </h2>
      </div>
      <p className="mt-3 text-sm font-medium text-taxpay-text">
        {tr('No verified due dates available','যাচাইকৃত পরিশোধের শেষ তারিখ পাওয়া যায়নি')}
      </p>
      <p className="mt-2 text-sm leading-6 text-taxpay-muted">
        {tr('This account is not connected to a verified assessment and demand schedule. An unavailable balance does not mean nothing is owed.',
          'এই অ্যাকাউন্টে যাচাইকৃত কর নির্ধারণ ও দাবির সময়সূচির তথ্য সংযুক্ত নেই। ব্যালেন্স পাওয়া না যাওয়ার অর্থ করদায় নেই—এমন নয়।')}
      </p>
      <button type="button" className={action+' mt-4'} onClick={()=>onNavigate('ledger')}>
        {tr('Review tax ledger','কর লেজার পর্যালোচনা করুন')}<ArrowRight size={15} aria-hidden="true"/>
      </button>
    </section>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel} aria-labelledby="account-tax-coverage-title">
        <h2 id="account-tax-coverage-title" className="text-base font-semibold text-taxpay-text">{tr('Tax coverage','কর সমন্বয়ের চিত্র')}</h2>
        {sample ? <div className="flex flex-col items-center gap-4 py-5 sm:flex-row sm:justify-center">
          <div role="img" aria-label={tr('Illustrative liability coverage','উদাহরণভিত্তিক করদায় সমন্বয়')}
            className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-[18px] border-slate-100">
            <p className="text-2xl font-semibold text-taxpay-muted">{coverage}%</p>
          </div>
          <dl className="w-full max-w-52 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt>{tr('Applied credits','সমন্বিত ক্রেডিট')}</dt><dd className="font-semibold tabular-nums">{money(sample.applied)}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt>{tr('Remaining balance','অবশিষ্ট দায়')}</dt><dd className="font-semibold tabular-nums">{money(sample.remaining)}</dd></div>
          </dl>
        </div> : <div role="status" className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-taxpay-border bg-slate-50 px-4 py-5 text-center">
          <CircleHelp size={22} className="text-taxpay-muted" aria-hidden="true"/>
          <p className="mt-2 text-sm font-medium text-taxpay-text">{tr('Coverage percentage unavailable','কর সমন্বয়ের শতকরা হার পাওয়া যায়নি')}</p>
          <p className="mt-1 max-w-sm text-sm text-taxpay-muted">{tr('Verified liabilities and posted credits are needed to calculate coverage.','কর সমন্বয়ের হার নির্ণয়ে যাচাইকৃত করদায় ও সমন্বিত ক্রেডিট প্রয়োজন।')}</p>
        </div>}
        {sample&&<div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
          aria-label={tr('Illustrative liability covered','উদাহরণে করদায়ের সমন্বয়')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage}>
          <div className="h-full bg-taxpay-primary" style={{width:coverage+'%'}}/>
        </div>}
        <p className="text-xs text-taxpay-muted">{exampleMode
          ?tr('Example only — no tax credit has been assigned to this account.','শুধু উদাহরণ — এই অ্যাকাউন্টে কোনো কর ক্রেডিট যোগ করা হয়নি।')
          :tr('Account liability and posted credits are not available.','অ্যাকাউন্টের করদায় ও সমন্বিত ক্রেডিট পাওয়া যায়নি।')}</p>
      </section>
      <section className={panel} aria-labelledby="account-monthly-activity-title">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} aria-hidden="true" className="text-taxpay-primary"/>
          <h2 id="account-monthly-activity-title" className="text-base font-semibold text-taxpay-text">{tr('Monthly activity','মাসভিত্তিক কার্যক্রম')}</h2>
        </div>
        {sample ? <div className="mt-4 min-w-0 overflow-x-auto" role="region" aria-label={tr('Example monthly activity chart','উদাহরণের মাসভিত্তিক কার্যক্রম')} tabIndex={0}>
          <div className="flex h-44 min-w-[360px] items-end gap-3 border-b border-taxpay-border px-2 pb-1" role="list">
            {sample.months.map(m=>{
              const total=m.tds+m.ait+m.direct+m.travel;
              const monthLabel=new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(m.month+'-01T00:00:00Z'));
              return <div role="listitem" key={m.month} aria-label={monthLabel+': '+money(total)}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-taxpay-muted">{Math.round(total/1000)}k</span>
                <div className="w-full max-w-10 rounded-t bg-taxpay-primary" style={{height:Math.max(5,115*total/monthlyMax)}}/>
                <span className="text-center text-[10px] text-taxpay-muted">{monthLabel}</span>
              </div>;
            })}
          </div>
          <p className="mt-2 text-xs text-taxpay-muted">{tr('Illustrative records only; travel tax stays separate from income-tax credits.','শুধু উদাহরণ; ভ্রমণ কর আয়কর ক্রেডিট থেকে পৃথক।')}</p>
        </div>:<div className="mt-4 flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-taxpay-border bg-slate-50 px-4 py-6 text-center">
          <CircleHelp size={22} aria-hidden="true" className="text-taxpay-muted"/>
          <p className="mt-2 text-sm font-medium text-taxpay-text">{unavailable}</p>
          <p className="mt-1 text-xs text-taxpay-muted">{exampleMode
            ?tr('No example exists for this assessment year.','এই করবর্ষের জন্য কোনো উদাহরণ নেই।')
            :tr('Account payment activity for this year is not available.','এই করবর্ষের অ্যাকাউন্ট পরিশোধ কার্যক্রম পাওয়া যায়নি।')}</p>
        </div>}
        <button type="button" className={action+' mt-3'} onClick={()=>onNavigate('history')}>{tr('View payment history','পেমেন্টের ইতিহাস দেখুন')}<ArrowRight size={15} aria-hidden="true"/></button>
      </section>
    </div>

    <section className={panel} aria-label={tr('Assessment-year tax position','করবর্ষ অনুযায়ী কর অবস্থান')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-taxpay-text">{tr('By assessment year','করবর্ষ অনুযায়ী')}</h2>
          <p className="mt-1 text-sm text-taxpay-muted">{tr('Select a year to update the summary and recent activity. Unverified amounts remain blank.','করবর্ষ নির্বাচন করলে সারসংক্ষেপ ও সাম্প্রতিক কার্যক্রম হালনাগাদ হবে। যাচাই হয়নি এমন পরিমাণ ফাঁকা থাকবে।')}</p>
        </div>
        <span className="text-xs text-taxpay-muted">{exampleMode?tr('Example figures only','শুধু উদাহরণের পরিমাণ'):tr('Balances unavailable','ব্যালেন্স পাওয়া যায়নি')}</span>
      </div>
      <div className="taxpay-table-viewport mt-3" role="region" aria-label={tr('Assessment-year table scroll area','করবর্ষের তালিকা স্ক্রল')} tabIndex={0}>
        <TaxPayUnifiedTable className="taxpay-unified-table min-w-[660px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-taxpay-muted"><tr>
            {[tr('Assessment year','করবর্ষ'),tr('Liability','করদায়'),tr('TDS & AIT','উৎসে ও অগ্রিম কর'),tr('Direct paid','সরাসরি পরিশোধ'),tr('Remaining','অবশিষ্ট')].map((heading,index)=>
              <th key={heading} scope="col" className={'px-3 py-3 '+(index?'text-right':'')}>{heading}</th>)}
          </tr></thead>
          <tbody>{visibleYears.map(item=><tr key={item} className="border-b border-taxpay-border">
            <td className="px-3 py-3"><button type="button" aria-pressed={item===year}
              className={'min-h-10 rounded-lg px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary '+(item===year?'bg-taxpay-light text-taxpay-primary':'text-taxpay-text hover:bg-slate-50')}
              onClick={()=>onSelectYear(item)}>{item}</button></td>
            {([0,1,2,3] as const).map(index=>{
              const rowSample=exampleMode?getIllustrativeDashboardYear(item):null;
              const value=rowSample?[rowSample.liability,rowSample.tds+rowSample.ait,rowSample.direct,rowSample.remaining][index]:undefined;
              return <td className="px-3 py-3 text-right tabular-nums" key={index}>{money(value)}</td>;
            })}
          </tr>)}</tbody>
        </TaxPayUnifiedTable>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel} aria-labelledby="account-credit-composition-title">
        <h2 id="account-credit-composition-title" className="text-base font-semibold text-taxpay-text">{tr('Tax payments and adjustments','কর পরিশোধ ও সমন্বয়')}</h2>
        {sample ? <>
          <div role="img" aria-label={tr('Illustrative TDS, AIT and direct-payment composition','উদাহরণের উৎসে কর, অগ্রিম কর ও সরাসরি পরিশোধের বিভাজন')}
            className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {sample.applied>0&&<>
              <div className="bg-taxpay-primary" style={{width:(100*sample.tds/sample.applied)+'%'}}/>
              <div className="bg-taxpay-secondary" style={{width:(100*sample.ait/sample.applied)+'%'}}/>
              <div className="bg-slate-400" style={{width:(100*sample.direct/sample.applied)+'%'}}/>
            </>}
          </div>
          <TaxPayUnifiedTable className="taxpay-unified-table mt-3 w-full text-sm" aria-label={tr('Posted credit components','সমন্বিত ক্রেডিটের অংশ')}>
            <tbody>{credits.map(item=><tr className="border-b border-taxpay-border" key={item.en}>
              <th scope="row" className="py-3 text-left font-normal text-taxpay-muted">{tr(item.en,item.bn)}</th>
              <td className="py-3 text-right font-semibold tabular-nums">{money([sample.tds,sample.ait,sample.direct][credits.indexOf(item)])}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row" className="py-3 text-left font-semibold">{tr('Total applied credits','মোট সমন্বিত ক্রেডিট')}</th><td className="py-3 text-right font-semibold">{money(sample.applied)}</td></tr></tfoot>
          </TaxPayUnifiedTable>
          <p className="mt-3 text-sm text-taxpay-muted">{tr('Example only. No credit was applied to this account.','শুধু উদাহরণ। এই অ্যাকাউন্টে কোনো ক্রেডিট যোগ করা হয়নি।')}</p>
        </> : <div role="status" className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-taxpay-border bg-slate-50 px-4 py-5 text-center">
          <CircleHelp size={22} className="text-taxpay-muted" aria-hidden="true"/>
          <p className="mt-2 text-sm font-medium text-taxpay-text">{tr('Verified credit breakdown unavailable','যাচাইকৃত কর ক্রেডিটের বিবরণ পাওয়া যায়নি')}</p>
          <p className="mt-1 max-w-sm text-sm text-taxpay-muted">{tr('A payment request or receipt alone does not confirm a tax credit. Verified posted credits are needed to show a breakdown.','শুধু পেমেন্ট অনুরোধ বা রসিদ কর ক্রেডিট নিশ্চিত করে না। ক্রেডিটের বিবরণ দেখাতে যাচাইকৃত সমন্বিত কর প্রয়োজন।')}</p>
        </div>}
      </section>
      <section className={panel} aria-label={tr('Current tax position','বর্তমান কর অবস্থান')}>
        <h2 className="text-base font-semibold text-taxpay-text">{tr('Current tax position','বর্তমান কর অবস্থান')}</h2>
        <p className="mt-1 text-xs text-taxpay-muted">{tr('Assessment year','করবর্ষ')}: {year}</p>
        <dl className="mt-3 space-y-0 text-sm">{rows.map(item=><div key={item.en} className="flex items-center justify-between gap-3 border-b border-taxpay-border py-3">
          <dt className="text-taxpay-muted">{tr(item.en,item.bn)}</dt><dd className="font-semibold tabular-nums">{money(sample
            ?[sample.liability,sample.tds+sample.ait,sample.direct,sample.applied,sample.remaining,sample.travel][rows.indexOf(item)]
            :undefined)}</dd>
        </div>)}</dl>
        <button type="button" className={action+' mt-3'} onClick={()=>onNavigate('ledger')}>{tr('Open tax ledger','কর লেজার দেখুন')}<ArrowRight size={15} aria-hidden="true"/></button>
      </section>
    </div>
  </div>;
};
