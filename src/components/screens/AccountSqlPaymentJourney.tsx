import React, {useEffect, useMemo, useState} from 'react';
import {FileText} from 'lucide-react';
import {loadAccountSqlPaymentJourney, type AccountSqlJourneyEvent} from '../../services/accountSqlPaymentJourney';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceiptView} from '../common/ReceiptView';

type LoadState = {uid:string|null;phase:'loading'|'ready'|'error';events:AccountSqlJourneyEvent[]};

/** One SQL transaction identity for each payment; display each persisted beneficiary
 * allocation independently, without multiplying a multi-beneficiary batch total.
 * Office Taxpayer 360 reads these same transaction IDs from mirrored SQL.
 */
export function AccountSqlPaymentJourney({ownerUid,language}:{
  ownerUid:string;language:'en'|'bn';
}) {
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [revision,setRevision]=useState(0);
  const [snapshot,setSnapshot]=useState<LoadState>({uid:null,phase:'loading',events:[]});
  const [assessmentYear,setAssessmentYear]=useState('all');
  const [selected,setSelected]=useState<AccountSqlJourneyEvent|null>(null);
  useEffect(()=>{
    let active=true;
    setSnapshot({uid:ownerUid,phase:'loading',events:[]});
    setSelected(null);
    void loadAccountSqlPaymentJourney(ownerUid).then(events=>{
      if(active)setSnapshot({uid:ownerUid,phase:'ready',events});
    }).catch(()=>{
      if(active)setSnapshot({uid:ownerUid,phase:'error',events:[]});
    });
    return()=>{active=false;};
  },[ownerUid,revision]);
  const state=snapshot.uid===ownerUid?snapshot:{uid:ownerUid,phase:'loading' as const,events:[]};
  const years=useMemo(()=>[...new Set(state.events.map(entry=>entry.assessmentYear))].sort((a,b)=>b.localeCompare(a)),[state.events]);
  const year=assessmentYear==='all'||years.includes(assessmentYear)?assessmentYear:'all';
  const displayed=useMemo(()=>state.events.filter(entry=>year==='all'||entry.assessmentYear===year),[state.events,year]);
  const grouped=useMemo(()=>{
    const map=new Map<string,AccountSqlJourneyEvent[]>();
    for(const entry of displayed) {
      const calendarYear=new Date(entry.occurredAt).getUTCFullYear().toString();
      map.set(calendarYear,[...(map.get(calendarYear)??[]),entry]);
    }
    return [...map.entries()];
  },[displayed]);
  const formatDate=(date:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',
    {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date(date));
  const money=(minor:number)=>'৳ '+new Intl.NumberFormat(bn?'bn-BD':'en-BD',
    {minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6"
    data-testid="account-sql-tax-journey" aria-labelledby="account-sql-tax-journey-heading">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="account-sql-tax-journey-heading" className="text-lg font-semibold text-taxpay-text">
          {tr('Recorded payment journey','নথিভুক্ত পেমেন্টের ঘটনাক্রম')}
        </h2>
        <p className="mt-1 text-sm text-taxpay-muted">
          {tr('Your saved payments, with individual beneficiaries and payment heads.',
            'সংরক্ষিত পেমেন্ট, প্রতিটি উপকারভোগী ও করের খাতসহ।')}
        </p>
      </div>
      {state.phase==='ready'&&years.length>0&&<label className="flex flex-col gap-1 text-sm font-medium text-taxpay-text">
        {tr('Assessment year','করবর্ষ')}
        <select aria-label={tr('Payment journey assessment year','পেমেন্টের করবর্ষ')}
          value={year} onChange={event=>setAssessmentYear(event.target.value)}
          className="min-h-11 min-w-32 rounded-lg border border-taxpay-border bg-white px-3">
          <option value="all">{tr('All years','সব করবর্ষ')}</option>
          {years.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
    </header>
    <p className="mt-3 text-xs text-taxpay-muted" role="note">
      {tr('These recorded transactions also appear in Office by taxpayer TIN. A recorded payment does not establish Treasury settlement or recognized tax credit.',
        'নথিভুক্ত লেনদেনগুলো করদাতার টিআইএন অনুযায়ী অফিসেও দেখা যায়। নথিভুক্ত পেমেন্ট মানেই ট্রেজারি নিষ্পত্তি বা স্বীকৃত কর ক্রেডিট নয়।')}
    </p>
    {state.phase==='loading'&&<p role="status" className="mt-5 text-sm text-taxpay-muted">
      {tr('Loading recorded payments…','নথিভুক্ত পেমেন্ট লোড হচ্ছে…')}
    </p>}
    {state.phase==='error'&&<div role="alert" className="mt-5 space-y-2">
      <p className="text-sm text-taxpay-error">
        {tr('Saved payment records could not be verified.','সংরক্ষিত পেমেন্টের তথ্য যাচাই করা যায়নি।')}
      </p>
      <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary"
        onClick={()=>setRevision(n=>n+1)}>{tr('Try again','আবার চেষ্টা করুন')}</button>
    </div>}
    {state.phase==='ready'&&displayed.length===0&&<p role="status"
      className="mt-5 rounded-lg border border-dashed border-taxpay-border bg-slate-50 p-5 text-sm text-taxpay-muted">
      {tr('No recorded payments for this selection.','এই নির্বাচনে কোনো নথিভুক্ত পেমেন্ট নেই।')}
    </p>}
    {state.phase==='ready'&&grouped.length>0&&<div className="mt-5 space-y-6">
      {grouped.map(([calendarYear,entries])=><section key={calendarYear} aria-label={calendarYear}>
        <h3 className="mb-3 text-base font-semibold text-taxpay-text">{calendarYear}</h3>
        <ol aria-label={tr('Recorded payment events','নথিভুক্ত পেমেন্টের ঘটনা')} className="space-y-0">
          {entries.map(entry=><li key={entry.key}
            className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 sm:grid-cols-[135px_minmax(0,1fr)]">
            <time dateTime={entry.occurredAt} className="pt-1 text-right text-xs text-taxpay-muted">
              {formatDate(entry.occurredAt)}
            </time>
            <div className="relative border-l-2 border-taxpay-border pb-5 pl-5">
              <span aria-hidden="true" className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full bg-taxpay-primary"/>
              <article className="min-w-0 rounded-lg border border-taxpay-border bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="break-words text-sm font-semibold text-taxpay-text">
                      {entry.beneficiaryName} · {money(entry.amountMinor)}
                    </h4>
                    <p className="mt-1 break-words text-xs text-taxpay-muted">
                      {entry.paymentHead} · {tr('AY','করবর্ষ')} {entry.assessmentYear}
                    </p>
                  </div>
                  <span className="rounded-md border border-taxpay-border bg-white px-2 py-1 text-xs text-taxpay-primary">
                    {tr('Recorded','নথিভুক্ত')}
                  </span>
                </div>
                <p className="mt-2 break-all text-xs text-taxpay-muted">
                  {tr('TIN','টিআইএন')}: {entry.taxpayerTin||'—'} · {tr('Reference','রেফারেন্স')}: {entry.paymentId}
                </p>
                {entry.economicCode&&<p className="mt-1 text-xs text-taxpay-muted">
                  {tr('Economic code','অর্থনৈতিক কোড')}: {entry.economicCode}
                </p>}
                <button type="button"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
                  onClick={()=>setSelected(entry)}>
                  <FileText size={16} aria-hidden="true"/>{tr('View payment details','পেমেন্টের বিবরণ দেখুন')}
                </button>
              </article>
            </div>
          </li>)}
        </ol>
      </section>)}
    </div>}
    {selected&&<TaxPayModal title={tr('Payment receipt','পেমেন্ট রসিদ')} service="status"
      className="receipt-modal" onClose={()=>setSelected(null)} footer={<></>}>
      <ReceiptView receipt={selected.receipt} embedded/>
    </TaxPayModal>}
  </section>;
}
