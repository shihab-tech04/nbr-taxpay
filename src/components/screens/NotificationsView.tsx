import React,{useEffect,useState} from 'react';
import {AccountCenter} from './AccountCenter';
import {getStoryNotices,type StoryPaymentNotice} from '../../services/simulatedPaymentStory';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadSimulationNotices,getBoundSimulationUser,getPrivateSimulationNotices,setPrivateSimulationNoticeRead,type SimulationNotice,type SimulationUser} from '../../services/simulatedPaymentsApi';
import {getHostedAuthorizations,type HostedAuthorization} from '../../services/hostedDemoAuthorizations';

/** In-app notifications backed by the SAME SQL event rows as the officer ledger. */
export const NotificationsView:React.FC=()=>{
  const {demoUser,previewAccount,language,navigate}=useTaxState();
  const {user:authenticatedUser,loading:authLoading}=useAccountIdentity();
  const [boundId,setBoundId]=useState<SimulationUser|null>(null);
  const [bindingError,setBindingError]=useState('');
  const [busyNotice,setBusyNotice]=useState<number|null>(null);
  const privateMode=Boolean(authenticatedUser);
  const id=(privateMode?boundId:undefined) as SimulationUser|undefined;
  const [notices,setNotices]=useState<SimulationNotice[]>([]);
  const [guestNotices,setGuestNotices]=useState<StoryPaymentNotice[]>([]);
  const [guestError,setGuestError]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [authorizationNotices,setAuthorizationNotices]=useState<HostedAuthorization[]>([]);
  const [authorizationError,setAuthorizationError]=useState('');
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  useEffect(()=>{
    if(!previewAccount){setAuthorizationNotices([]);return;}
    let active=true;
    const refresh=async()=>{
      try{const records=await getHostedAuthorizations(previewAccount.id);
        if(active){setAuthorizationNotices(records);setAuthorizationError('');}}
      catch(e){if(active)setAuthorizationError(e instanceof Error?e.message:'Could not load authorization notices');}
    };
    void refresh();const timer=window.setInterval(()=>void refresh(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[previewAccount?.id]);
  useEffect(()=>{
    if(authenticatedUser)return;
    let active=true;
    const refresh=async()=>{
      try{const data=await getStoryNotices();if(active){setGuestNotices(data);setGuestError('');}}
      catch{if(active)setGuestError(language==='bn'?'বিজ্ঞপ্তি আপাতত পাওয়া যাচ্ছে না':'Notifications temporarily unavailable');}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[authenticatedUser?.id,language]);
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
  if(previewAccount&&!authenticatedUser)return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={label('Notifications','বিজ্ঞপ্তি')}/>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite">
      {authorizationError&&<p role="alert" className="text-red-700">{authorizationError}</p>}
      {!authorizationNotices.length?<p className="text-taxpay-muted">{label('No authorization notifications yet.','এখনো কোনো অনুমোদনের বিজ্ঞপ্তি নেই।')}</p>:
      <ul className="divide-y divide-taxpay-border">{authorizationNotices.map(r=><li key={r.id} className="py-4">
        <h2 className="font-semibold text-taxpay-text">{r.taxpayerId===previewAccount.id
          ? r.status==='CODE_ISSUED' && (r.codeResends??0)>0
            ?label(`New authorization code requested by ${r.payerId}`,`${r.payerId} নতুন অনুমোদন কোড চেয়েছেন`)
            :label(`${r.payerId} requested permission to pay for you`,`${r.payerId} আপনার হয়ে পরিশোধের অনুমতি চেয়েছেন`)
          :label(`Authorization for ${r.taxpayerId}`,`${r.taxpayerId}-এর অনুমোদন`)}</h2>
        <p className="mt-1 text-sm text-taxpay-muted">{label('Status','অবস্থা')}: {r.status.replaceAll('_',' ')} · {new Date(r.requestedAt).toLocaleString(bn?'bn-BD':'en-GB')}</p>
        {r.taxpayerId===previewAccount.id && r.status==='CODE_ISSUED' && r.consentCode &&
          <p className="mt-2 text-sm text-taxpay-text">{label('Latest four-digit code','সর্বশেষ চার সংখ্যার কোড')}: <strong className="font-mono tracking-widest">{r.consentCode}</strong>
            {' · '}{label('Valid for 15 minutes from issue','পাঠানোর পর ১৫ মিনিট কার্যকর')}</p>}
        <button type="button" className="mt-2 rounded-lg border border-blue-300 px-3 py-2 font-semibold text-blue-800"
          onClick={()=>navigate('manage_authorization')}>{label('Review authorization','অনুমোদন দেখুন')}</button>
      </li>)}</ul>}
    </section>
  </main>;
  // Keep the existing pre-payment account entry; successful guest payments
  // use their own session-scoped SQL notification feed without logging in.
  const hasGuestPayment=guestNotices.length>0 || (()=>{try{return sessionStorage.getItem('taxpay-guest-story-payment')==='true';}catch{return false;}})();
  if(!authenticatedUser&&!hasGuestPayment)return <main className="mx-auto max-w-4xl space-y-3 rounded-xl border border-taxpay-border bg-white p-6" lang={language}>
    <h1 className="text-2xl font-bold text-taxpay-text">{label('Sign in to view payment notifications','পেমেন্ট বিজ্ঞপ্তি দেখতে সাইন ইন করুন')}</h1>
    <p className="text-sm text-taxpay-muted">{label('Sign in with your assigned account to view notifications.','বিজ্ঞপ্তি দেখতে নির্ধারিত অ্যাকাউন্টে সাইন ইন করুন।')}</p>
    <button type="button" className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white" onClick={()=>navigate('taxpayer_login')}>{label('Open sign-in','সাইন ইন খুলুন')}</button>
  </main>;
  if(!authenticatedUser)return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={label('Payment notifications','পেমেন্ট বিজ্ঞপ্তি')}/>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite">
      {guestError?<p role="alert">{guestError}</p>:
        !guestNotices.length?<p className="text-taxpay-muted">{label('No notifications yet.','এখনো কোনো বিজ্ঞপ্তি নেই।')}</p>:
        <ul className="divide-y divide-taxpay-border">{guestNotices.map(n=><li key={n.id} className="py-3">
          <h2 className="text-base font-semibold text-taxpay-text">{label('Payment completed successfully','পরিশোধ সফলভাবে সম্পন্ন হয়েছে')}</h2>
          <p className="break-all text-sm text-taxpay-muted">{n.paymentId} · <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p>
        </li>)}</ul>}
    </section>
  </main>;
  if(privateMode&&!id)return <main className="mx-auto max-w-4xl p-6"><h1 className="text-xl font-semibold">Protected notifications</h1><p role="status">{bindingError||'Checking profile assignment…'}</p></main>;
  if(!id)return <AccountCenter page="notifications"/>;
  return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={label('Payment notifications','পেমেন্ট বিজ্ঞপ্তি')}/>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite">
      {loading?<p>{label('Loading…','লোড হচ্ছে…')}</p>:error?<p role="alert">{error}</p>:
        !notices.length?<p className="text-taxpay-muted">{label('No notifications yet.','এখনো কোনো বিজ্ঞপ্তি নেই।')}</p>:
        <ul className="divide-y divide-taxpay-border">{notices.map(n=><li key={n.id} className="py-3">
          <h2 className="text-base font-semibold text-taxpay-text">{({
            SIM_OFFICER_MAKER_ACKNOWLEDGED:label('Officer Maker acknowledged','মেকার অনুরোধ গ্রহণ করেছেন'),
            SIM_OFFICER_REVIEWER_VERIFIED:label('Officer Reviewer verified','রিভিউয়ার যাচাই করেছেন'),
            SIM_OFFICER_APPROVER_CLOSED:label('Officer Approver closed the review','অনুমোদনকারী পর্যালোচনা শেষ করেছেন')
          } as Record<string,string>)[n.messageCode] ??
          label('Payment record added','পেমেন্ট রেকর্ড যোগ হয়েছে')}</h2>
          <p className="break-all text-sm text-taxpay-muted">{n.transactionId} · <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p>
          <p className="text-xs text-taxpay-muted">{n.isRead?label('Read','পঠিত'):label('Unread','অপঠিত')}</p>
          {privateMode&&<button type="button" className="mt-2 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark disabled:opacity-50" disabled={busyNotice!==null} onClick={()=>void markRead(n)}>{n.isRead?label('Mark unread','অপঠিত করুন'):label('Mark read','পঠিত করুন')}</button>}
        </li>)}</ul>}
    </section>
  </main>;
};
