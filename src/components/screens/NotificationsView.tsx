import React,{useEffect,useState} from 'react';
import {AccountCenter} from './AccountCenter';
import {useTaxState} from '../../services/taxState';
import {loadSimulationNotices,type SimulationNotice,type SimulationUser} from '../../services/simulatedPaymentsApi';

/** In-app notifications backed by the SAME SQL event rows as the officer ledger. */
export const NotificationsView:React.FC=()=>{
  const {demoUser,language}=useTaxState();
  const id=demoUser?.id as SimulationUser|undefined;
  const [notices,setNotices]=useState<SimulationNotice[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  useEffect(()=>{
    if(!id)return;
    let active=true;setNotices([]);setLoading(true);setError('');
    const read=async()=>{
      try{const data=await loadSimulationNotices(id);if(active){setNotices(data);setLoading(false);setError('');}}
      catch(e){if(active){setError(e instanceof Error?e.message:'Notification API failed');setLoading(false);}}
    };
    void read();const timer=window.setInterval(()=>void read(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[id]);
  if(!id)return <AccountCenter page="notifications"/>;
  return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-taxpay-text">{label('Payment notifications','পেমেন্ট বিজ্ঞপ্তি')}</h1>
      <p className="mt-2 text-sm text-taxpay-muted">{label('Shared SQL notifications for simulated transactions. These are not government payment notices or tax credits.','সিমুলেটেড লেনদেনের যৌথ SQL বিজ্ঞপ্তি। এগুলো সরকারি পেমেন্টের নোটিশ বা কর ক্রেডিট নয়।')}</p>
    </header>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite">
      {loading?<p>{label('Loading…','লোড হচ্ছে…')}</p>:error?<p role="alert">{error}</p>:
        !notices.length?<p className="text-taxpay-muted">{label('No notifications yet.','এখনো কোনো বিজ্ঞপ্তি নেই।')}</p>:
        <ul className="divide-y divide-taxpay-border">{notices.map(n=><li key={n.id} className="py-3">
          <h2 className="text-base font-semibold text-taxpay-text">{({
            SIM_OFFICER_MAKER_ACKNOWLEDGED:label('Officer Maker acknowledged','মেকার অনুরোধ গ্রহণ করেছেন'),
            SIM_OFFICER_REVIEWER_VERIFIED:label('Officer Reviewer verified','রিভিউয়ার যাচাই করেছেন'),
            SIM_OFFICER_APPROVER_CLOSED:label('Officer Approver closed the review','অনুমোদনকারী পর্যালোচনা শেষ করেছেন')
          } as Record<string,string>)[n.messageCode] ??
          label('Simulated payment recorded','সিমুলেটেড পেমেন্ট সংরক্ষিত')}</h2>
          <p className="break-all text-sm text-taxpay-muted">{n.transactionId} · <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p>
        </li>)}</ul>}
    </section>
  </main>;
};