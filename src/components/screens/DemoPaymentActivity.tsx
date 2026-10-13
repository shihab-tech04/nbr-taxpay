import React, {useMemo, useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {demoTransactions, getDemoUserTransactions, transactionTotalMinor, type DemoUserId} from '../../data/demoPaymentTransactions';
import {formatCurrency} from '../../services/numberFormat';

/** Read-only cross-app fictional fixture view. This is NOT Supabase or ACS data. */
export const DemoPaymentActivity:React.FC=()=>{
  const {demoUser,language}=useTaxState();
  const [perspective,setPerspective]=useState<'beneficiary'|'payer'>('beneficiary');
  const bn=language==='bn';
  const id=demoUser?.id as DemoUserId | undefined;
  const activities=useMemo(()=>id?getDemoUserTransactions(id,demoTransactions,perspective):[],[id,perspective]);
  const label=(en:string,bangla:string)=>bn?bangla:en;
  if(!id)return null;
  return <main className="mx-auto max-w-5xl space-y-4 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <p className="text-sm font-semibold text-taxpay-dark">{id} · {label('Simulation only','শুধু সিমুলেশন')}</p>
      <h1 className="mt-2 text-2xl font-bold text-taxpay-text">{label('My payment activity','আমার পেমেন্ট কার্যক্রম')}</h1>
      <p className="mt-2 text-sm text-taxpay-muted">{label(
        'Shared fictional reference scenarios. These records are not synced to SQL or Office Management in real time and confer no government receipt or tax credit.',
        'যৌথ কাল্পনিক উদাহরণ। এগুলো বাস্তব সময়ে এসকিউএল বা অফিস ম্যানেজমেন্টে সমন্বিত নয় এবং কোনো সরকারি প্রাপ্তি বা কর ক্রেডিট নয়।'
      )}</p>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label={label('Payment activity perspective','পেমেন্ট কার্যক্রমের ধরন')}>
      <button type="button" aria-pressed={perspective==='beneficiary'} onClick={()=>setPerspective('beneficiary')}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 font-semibold text-taxpay-dark">
        {label('For my tax account','আমার কর হিসাবের জন্য')}
      </button>
      <button type="button" aria-pressed={perspective==='payer'} onClick={()=>setPerspective('payer')}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 font-semibold text-taxpay-dark">
        {label('Payments I initiated','আমার শুরু করা পেমেন্ট')}
      </button>
    </nav>
    <section aria-label={label('Transaction history','লেনদেনের ইতিহাস')} className="space-y-3">
      {!activities.length?<div className="rounded-xl border border-taxpay-border bg-white p-6">
        <h2 className="text-lg font-semibold text-taxpay-text">{label('No simulated transactions','কোনো অনুকরণমূলক লেনদেন নেই')}</h2>
        <p className="mt-2 text-sm text-taxpay-muted">{label('This profile starts empty. Future authenticated activity requires a shared, verified SQL integration.', 'এই প্রোফাইল শুরুতে খালি। ভবিষ্যতের কার্যক্রমের জন্য যাচাইকৃত যৌথ এসকিউএল সংযোগ প্রয়োজন।')}</p>
      </div>:activities.map(tx=>{
        const visible=perspective==='payer'?tx.allocations:tx.allocations.filter(a=>a.beneficiary===id);
        const visibleMinor=visible.reduce((sum,a)=>sum+a.amountMinor,0);
        return <article key={tx.id} className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-taxpay-text">{tx.id} · {tx.state}</h2>
              <p className="text-sm text-taxpay-muted">{label('Payer','পরিশোধকারী')}: {tx.payer} · <time dateTime={tx.createdAt}>{new Date(tx.createdAt).toLocaleString(bn?'bn-BD':'en-GB',{timeZone:'UTC'})} UTC</time></p>
            </div>
            <p className="text-base font-bold tabular-nums text-taxpay-text">{formatCurrency(visibleMinor/100,language)}</p>
          </div>
          <p className="mt-2 text-xs text-taxpay-muted">{label('Visible allocation amount; full transaction','দৃশ্যমান বরাদ্দের পরিমাণ; সম্পূর্ণ লেনদেন')}: {formatCurrency(transactionTotalMinor(tx)/100,language)} · {label('No tax credit','কোনো কর ক্রেডিট নেই')}</p>
          <h3 className="mt-4 text-sm font-semibold text-taxpay-text">{label('Beneficiary allocations','সুবিধাভোগীর বরাদ্দ')}</h3>
          <ul className="mt-2 divide-y divide-taxpay-border">
            {visible.map(a=><li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <div><p className="font-semibold text-taxpay-text">{a.beneficiary} · {a.category}</p>
              <p className="text-taxpay-muted">{a.id} · {label('AY','করবর্ষ')} {a.assessmentYear}</p></div>
              <p className="font-medium tabular-nums text-taxpay-text">{formatCurrency(a.amountMinor/100,language)}</p>
            </li>)}
          </ul>
          <details className="mt-3 rounded-lg border border-taxpay-border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-taxpay-dark">{label('Event timeline','ঘটনার সময়রেখা')}</summary>
            <ol className="mt-3 space-y-2">{tx.events.map(e=><li key={e.id} className="text-sm">
              <p className="font-semibold text-taxpay-text">{e.action}</p>
              <p className="text-taxpay-muted"><time dateTime={e.occurredAt}>{e.occurredAt}</time> · {e.note}</p>
            </li>)}</ol>
          </details>
        </article>;
      })}
    </section>
  </main>;
};