import React from 'react';

type RecordedPayment = { date: string; amount: number };
type Props = {
  payments: readonly RecordedPayment[];
  assessmentYear: string;
  language: 'en' | 'bn';
};

/**
 * Calendar-date analytics from the existing selected-year recorded payment list.
 * Only the parent-supplied settled direct/advance/travel payments are counted;
 * withholding, requests, pending and failed attempts are never added.
 */
export function DashboardMonthlyPayments({payments,assessmentYear,language}:Props) {
  const bn=language==='bn';
  const tr=(en:string,bnText:string)=>bn?bnText:en;
  const money=(n:number)=>'৳ '+new Intl.NumberFormat(bn?'bn-BD':'en-BD',{maximumFractionDigits:0}).format(n);
  const dated=payments.filter(item=>/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(item.date)
    && Number.isFinite(item.amount) && item.amount>=0);
  const latest=dated.map(item=>item.date).sort().at(-1);
  const latestDate=latest?new Date(latest+'T00:00:00Z'):null;
  const months=latestDate?Array.from({length:6},(_,index)=>{
    const d=new Date(Date.UTC(latestDate.getUTCFullYear(),latestDate.getUTCMonth()-(5-index),1));
    const key=d.toISOString().slice(0,7);
    const amount=dated.filter(item=>item.date.startsWith(key)).reduce((sum,item)=>sum+item.amount,0);
    const label=new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{month:'short',timeZone:'UTC'}).format(d);
    return {key,label,amount};
  }):[];
  const maximum=Math.max(1,...months.map(item=>item.amount));
  const total=months.reduce((sum,item)=>sum+item.amount,0);
  return <section className="taxpay-monthly-card" aria-labelledby="dashboard-monthly-title"
    data-testid="dashboard-monthly-payments">
    <div className="taxpay-monthly-card__heading">
      <div>
        <h2 id="dashboard-monthly-title">{tr('Recorded payments by month','মাস অনুযায়ী নথিভুক্ত পেমেন্ট')}</h2>
        <p>{tr('Calendar months · selected assessment year','ক্যালেন্ডার মাস · নির্বাচিত করবর্ষ')} {assessmentYear}</p>
      </div>
      {months.length>0&&<strong className="taxpay-monthly-card__total" aria-label={tr('Last six months total: ','শেষ ছয় মাসে মোট: ')+money(total)}>{money(total)}</strong>}
    </div>
    {months.length ? <>
      <div className="taxpay-monthly-card__plot" role="img" data-testid="monthly-payment-bars"
        aria-label={tr('Recorded payments for the six calendar months ending ','শেষ ছয় ক্যালেন্ডার মাসে নথিভুক্ত পেমেন্ট, শেষ মাস ')+latest!.slice(0,7)+': '+months.map(item=>item.key+' '+money(item.amount)).join(', ')}>
        {months.map(item=><div className="taxpay-monthly-card__month" key={item.key}
          data-month={item.key} data-amount={item.amount}>
          <span className="taxpay-monthly-card__bar-space" aria-hidden="true">
            <span className="taxpay-monthly-card__bar" style={{height:item.amount>0?Math.max(4,item.amount/maximum*100)+'%':'0%'}}/>
          </span>
          <span className="taxpay-monthly-card__month-label">{item.label}</span>
        </div>)}
      </div>
      <p className="taxpay-monthly-card__note">{tr('Shows eligible illustrative entries and stored scenario transactions in the selected assessment year, for these six calendar months only. Not a Treasury-confirmed balance or tax credit; travel tax remains separate.','নির্বাচিত করবর্ষের এই ছয় ক্যালেন্ডার মাসে নমুনা এন্ট্রি এবং সংরক্ষিত সিনারিও লেনদেন দেখানো হয়েছে। এটি ট্রেজারি-নিশ্চিত ব্যালেন্স বা কর ক্রেডিট নয়; ভ্রমণ কর পৃথক।')}</p>
    </> : <p className="taxpay-monthly-card__empty" role="status">{tr('No recorded direct, advance or travel payments for this year.','এই করবর্ষে নথিভুক্ত সরাসরি, অগ্রিম বা ভ্রমণ কর নেই।')}</p>}
  </section>;
}
