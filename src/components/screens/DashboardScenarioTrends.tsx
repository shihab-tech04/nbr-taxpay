import React from 'react';
import type {DashboardSimulationTransaction} from '../../services/accountDashboardProjection';

type Month = {month:string;label:string;amountMinor:bigint;count:number};

/**
 * Calendar-month totals for the already owner- and assessment-year-scoped
 * private simulation projection. Beneficiary-only allocations, pending/failed
 * attempts and reversals are NOT spending initiated by this account.
 * The source projection deduplicates payer/recipient views by transaction ID.
 */
export function summarizeOwnedScenarioMonths(
  transactions:readonly DashboardSimulationTransaction[],
  language:'en'|'bn',
):Month[] {
  const completed=transactions.filter(row=>
    row.state==='SIMULATED' && row.participantView!=='beneficiary' &&
    /^20\d{2}-(0[1-9]|1[0-2])-\d{2}T/.test(row.createdAt) &&
    Number.isSafeInteger(row.amountMinor) && row.amountMinor>0);
  if(!completed.length)return [];
  const latest=completed.map(row=>row.createdAt.slice(0,7)).sort().at(-1)!;
  const [year,month]=latest.split('-').map(Number);
  const locale=language==='bn'?'bn-BD':'en-GB';
  return Array.from({length:6},(_,index)=>{
    const date=new Date(Date.UTC(year,month-1-5+index,1));
    const key=date.toISOString().slice(0,7);
    const records=completed.filter(row=>row.createdAt.startsWith(key));
    return {
      month:key,
      label:new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(date),
      count:records.length,
      amountMinor:records.reduce((total,row)=>total+BigInt(row.amountMinor),0n)
    };
  });
}

export const DashboardScenarioTrends:React.FC<{
  transactions:readonly DashboardSimulationTransaction[];
  assessmentYear:string;
  language:'en'|'bn';
}>=({transactions,assessmentYear,language})=>{
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const months=summarizeOwnedScenarioMonths(transactions,language);
  const max=months.reduce((value,month)=>month.amountMinor>value?month.amountMinor:value,0n);
  const total=months.reduce((value,month)=>value+month.amountMinor,0n);
  const formatMoney=(minor:bigint)=>{
    const locale=bn?'bn-BD':'en-BD';
    const whole=new Intl.NumberFormat(locale).format(minor/100n);
    const fraction=new Intl.NumberFormat(locale,{minimumIntegerDigits:2,useGrouping:false}).format(Number(minor%100n));
    return '৳ '+whole+'.'+fraction;
  };
  return <section className="taxpay-monthly-card" aria-labelledby="account-scenario-monthly-title"
    data-testid="account-scenario-monthly">
    <div className="taxpay-monthly-card__heading">
      <div className="min-w-0">
        <h3 id="account-scenario-monthly-title">{tr('Monthly payment activity','মাসভিত্তিক পেমেন্ট কার্যক্রম')}</h3>
        <p>{tr('Completed account-initiated simulations · assessment year','অ্যাকাউন্ট থেকে সম্পন্ন সিমুলেশন · করবর্ষ')} {assessmentYear}</p>
      </div>
      {months.length>0&&<strong className="taxpay-monthly-card__total tabular-nums">{formatMoney(total)}</strong>}
    </div>
    {months.length>0 ? <>
      <div className="taxpay-monthly-card__plot" role="img" data-testid="account-scenario-monthly-bars"
        aria-label={tr('Last six months of completed account-initiated scenario payments: ','অ্যাকাউন্ট থেকে সম্পন্ন সিমুলেশনের শেষ ছয় মাসের পেমেন্ট: ')+
          months.map(month=>month.month+' '+formatMoney(month.amountMinor)).join(', ')}>
        {months.map(month=><div key={month.month} className="taxpay-monthly-card__month"
          data-month={month.month} data-amount-minor={String(month.amountMinor)}>
          <span className="taxpay-monthly-card__bar-space" aria-hidden="true">
            <span className="taxpay-monthly-card__bar" style={{height:month.amountMinor>0n
              ? Math.max(4,Number(month.amountMinor*10000n/max)/100)+'%' : '0%'}}/>
          </span>
          <span className="taxpay-monthly-card__month-label">{month.label}</span>
        </div>)}
      </div>
      <p className="taxpay-monthly-card__note">{tr(
        'Recorded simulations only, not Treasury-confirmed payments or tax credits. Beneficiary-only, pending, failed and reversed transactions are excluded.',
        'শুধু নথিভুক্ত সিমুলেশন; ট্রেজারি-নিশ্চিত পেমেন্ট বা কর ক্রেডিট নয়। শুধু প্রাপক হিসেবে পাওয়া, অপেক্ষমাণ, ব্যর্থ ও প্রত্যাবর্তিত লেনদেন বাদ।'
      )}</p>
    </> : <p className="taxpay-monthly-card__empty" role="status">{tr(
      'No completed payments initiated by this account for the selected assessment year.',
      'নির্বাচিত করবর্ষে এই অ্যাকাউন্ট থেকে সম্পন্ন কোনো পেমেন্ট নেই।'
    )}</p>}
  </section>;
};
