import React,{useEffect,useState} from 'react';
import {AccountCenter} from './AccountCenter';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadSimulationNotices,getBoundSimulationUser,getPrivateSimulationNotices,setPrivateSimulationNoticeRead,type SimulationNotice,type SimulationUser} from '../../services/simulatedPaymentsApi';

/** In-app notifications backed by the SAME SQL event rows as the officer ledger. */
export const NotificationsView:React.FC=()=>{
  const {demoUser,language,navigate}=useTaxState();
  const {user:authenticatedUser,loading:authLoading}=useAccountIdentity();
  const [boundId,setBoundId]=useState<SimulationUser|null>(null);
  const [bindingError,setBindingError]=useState('');
  const [busyNotice,setBusyNotice]=useState<number|null>(null);
  const privateMode=Boolean(authenticatedUser);
  const id=(privateMode?boundId:undefined) as SimulationUser|undefined;
  const [notices,setNotices]=useState<SimulationNotice[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  useEffect(()=>{
    if(!authenticatedUser){setBoundId(null);setBindingError('');return;}
    let active=true;setBoundId(null);setBindingError('');
    getBoundSimulationUser().then(profile=>{if(active)setBoundId(profile);})
      .catch(e=>{if(active)setBindingError(e instanceof Error?e.message:'Profile assignment unavailable');});
    return()=>{active=false;};
  },[authenticatedUser?.id]);
  useEffect(()=>{
    if(!id||!privateMode)return;
    let active=true;setNotices([]);setLoading(true);setError('');
    const read=async()=>{
      try{const data=privateMode?await getPrivateSimulationNotices():await loadSimulationNotices(id);if(active){setNotices(data);setLoading(false);setError('');}}
      catch(e){if(active){setError(e instanceof Error?e.message:'Notification API failed');setLoading(false);}}
    };
    void read();const timer=window.setInterval(()=>void read(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[id,privateMode]);
  const markRead=async (notice:SimulationNotice)=>{
    if(!privateMode||busyNotice!==null)return;
    setBusyNotice(notice.id);setError('');
    try{const confirmed=await setPrivateSimulationNoticeRead(notice.id,!notice.isRead);
      if(confirmed.id!==notice.id||confirmed.isRead===notice.isRead)throw Error('Notification read-back mismatch');
      const after=await getPrivateSimulationNotices();
      if(!after.some(n=>n.id===notice.id&&n.isRead===confirmed.isRead))throw Error('SQL notification read-back failed');
      setNotices(after);
    }catch(e){setError(e instanceof Error?e.message:'Notification update failed');}
    finally{setBusyNotice(null);}
  };
  if(authLoading)return <main className="mx-auto max-w-4xl p-6"><p role="status">Checking account…</p></main>;
  if(!authenticatedUser)return <main className="mx-auto max-w-4xl space-y-3 rounded-xl border border-taxpay-border bg-white p-6" lang={language}>
    <h1 className="text-2xl font-bold text-taxpay-text">{label('Sign in to view payment notifications','পেমেন্ট বিজ্ঞপ্তি দেখতে সাইন ইন করুন')}</h1>
    <p className="text-sm text-taxpay-muted">{label('Sign in to view notifications for your assigned account.','আপনার নির্ধারিত অ্যাকাউন্টের বিজ্ঞপ্তি দেখতে সাইন ইন করুন।')}</p>
    <button type="button" className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white" onClick={()=>navigate('taxpayer_login')}>{label('Open sign-in','সাইন ইন খুলুন')}</button>
  </main>;
  if(privateMode&&!id)return <main className="mx-auto max-w-4xl p-6"><h1 className="text-xl font-semibold">Protected notifications</h1><p role="status">{bindingError||'Checking profile assignment…'}</p></main>;
  if(!id)return <AccountCenter page="notifications"/>;
  return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-taxpay-text">{label('Payment notifications','পেমেন্ট বিজ্ঞপ্তি')}</h1>
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
          <p className="text-xs text-taxpay-muted">{n.isRead?label('Read','পঠিত'):label('Unread','অপঠিত')}</p>
          {privateMode&&<button type="button" className="mt-2 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark disabled:opacity-50" disabled={busyNotice!==null} onClick={()=>void markRead(n)}>{n.isRead?label('Mark unread','অপঠিত করুন'):label('Mark read','পঠিত করুন')}</button>}
        </li>)}</ul>}
    </section>
  </main>;
};
