import React from 'react';
import {AccountCenter} from './AccountCenter';
import {useTaxState} from '../../services/taxState';
import {getDemoUserAllocations, type DemoUserId} from '../../data/demoPaymentTransactions';

/** Authenticated notices remain in AccountCenter. Fictional demo notices are read-only. */
export const NotificationsView:React.FC=()=>{
  const {demoUser,language}=useTaxState();
  if(!demoUser)return <AccountCenter page="notifications"/>;
  const records=getDemoUserAllocations(demoUser.id as DemoUserId);
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-taxpay-text">{label('Demo activity notices','নমুনা কার্যক্রমের বিজ্ঞপ্তি')}</h1>
      <p className="mt-2 text-sm text-taxpay-muted">{label(
        'These are read-only simulated allocation events, not official notices, payment confirmations or private push notifications.',
        'এগুলো কেবল অনুকরণমূলক বরাদ্দের ঘটনা; সরকারি নোটিশ, পেমেন্ট নিশ্চয়তা বা ব্যক্তিগত পুশ বিজ্ঞপ্তি নয়।'
      )}</p>
    </header>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      {!records.length?<p className="text-taxpay-muted">{label('No demo allocation events for this user.','এই ব্যবহারকারীর কোনো নমুনা বরাদ্দের ঘটনা নেই।')}</p>:
        <ul className="divide-y divide-taxpay-border">{records.map(({transaction,allocation})=>
          <li key={allocation.id} className="py-3">
            <h2 className="text-base font-semibold text-taxpay-text">{transaction.id} · {allocation.id}</h2>
            <p className="text-sm text-taxpay-muted">{transaction.payer} → {allocation.beneficiary} · {allocation.category} · {allocation.assessmentYear}</p>
            <p className="text-sm text-taxpay-muted"><time dateTime={transaction.createdAt}>{transaction.createdAt}</time> · Demo {transaction.state}</p>
          </li>)}</ul>}
    </section>
  </main>;
};