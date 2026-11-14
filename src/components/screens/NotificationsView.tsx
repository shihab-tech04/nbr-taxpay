import React,{useEffect,useRef,useState} from 'react';
import {AccountCenter} from './AccountCenter';
import { SessionPaymentNotifications } from './SessionPaymentNotifications';
import {ReceivedPaymentNoticeRegister} from './ReceivedPaymentNoticeRegister';
import {getStoryNotices,getStorySessionPayments} from '../../services/simulatedPaymentStory';
import {formatSimulatedAmount,getDemoStoryPaymentHistory} from '../../services/simulatedPaymentsApi';
import {reconcileDemoSimulationActivity,type DemoSimulationActivity} from '../../services/demoSimulationActivity';
import {reconcileStoryPaymentNotices,type VerifiedStoryPaymentNotice} from '../../services/storyNotificationReconciliation';
import {reconcilePrivateSimulationNotices,type VerifiedPrivateSimulationNotice} from '../../services/privateSimulationNotices';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter} from '../ui/TaxPayDataTable';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {getBoundSimulationUser,getPrivateSimulationHistory,getPrivateSimulationNotices,setPrivateSimulationNoticeRead,type SimulationNotice,type SimulationUser} from '../../services/simulatedPaymentsApi';
import {getHostedAuthorizations,type HostedAuthorization} from '../../services/hostedDemoAuthorizations';

/** In-app notifications backed by the SAME SQL event rows as the officer ledger. */
export const NotificationsView:React.FC=()=>{
  const {demoUser,previewAccount,language,navigate}=useTaxState();
  const {user:authenticatedUser,loading:authLoading}=useAccountIdentity();
  const [boundId,setBoundId]=useState<SimulationUser|null>(null);
  const [boundOwnerUid,setBoundOwnerUid]=useState<string|null>(null);
  // A late SQL acknowledgement from the previous account must never repaint
  // the next account's notification register.
  const currentAuthUid=useRef(authenticatedUser?.id??null);
  currentAuthUid.current=authenticatedUser?.id??null;
  const [noticeOwner,setNoticeOwner]=useState<SimulationUser|null>(null);
  const [bindingError,setBindingError]=useState('');
  const [bindingReady,setBindingReady]=useState(false);
  const [busyNotice,setBusyNotice]=useState<number|null>(null);
  const privateMode=Boolean(authenticatedUser);
  const id=(privateMode&&authenticatedUser&&boundOwnerUid===authenticatedUser.id
    ?boundId:undefined) as SimulationUser|undefined;
  const [notices,setNotices]=useState<VerifiedPrivateSimulationNotice[]>([]);
  const [guestNotices,setGuestNotices]=useState<VerifiedStoryPaymentNotice[]>([]);
  const [guestError,setGuestError]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [authorizationNotices,setAuthorizationNotices]=useState<HostedAuthorization[]>([]);
  const [authorizationError,setAuthorizationError]=useState('');
  const [previewPaymentEvents,setPreviewPaymentEvents]=useState<DemoSimulationActivity[]>([]);
  const [previewPaymentError,setPreviewPaymentError]=useState('');
  const [authorizationSearch,setAuthorizationSearch]=useState('');
  const [authorizationFilter,setAuthorizationFilter]=useState('all');
  const [paymentSearch,setPaymentSearch]=useState('');
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  const authorizationStatus=(state:string)=>{
    const names:Record<string,[string,string]>={
      ACTIVE:['Active','সক্রিয়'],EXPIRED:['Expired','মেয়াদ শেষ'],
      CODE_ISSUED:['Code issued','কোড দেওয়া হয়েছে'],PENDING:['Pending','অপেক্ষমাণ'],
      REVOKED:['Revoked','বাতিল করা হয়েছে'],REJECTED:['Rejected','প্রত্যাখ্যাত'],
      APPROVED:['Approved','অনুমোদিত']
    };
    const copy=names[state];
    return copy?label(...copy):state.replaceAll('_',' ').toLowerCase();
  };
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
    if(!previewAccount){setPreviewPaymentEvents([]);setPreviewPaymentError('');return;}
    let active=true;
    const refresh=async()=>{
      try{
        const [payerRows,beneficiaryRows]=await Promise.all([
          getDemoStoryPaymentHistory(previewAccount.id,'payer'),
          getDemoStoryPaymentHistory(previewAccount.id,'beneficiary'),
        ]);
        const records=reconcileDemoSimulationActivity(previewAccount.id,payerRows,beneficiaryRows);
        if(active){setPreviewPaymentEvents(records);setPreviewPaymentError('');}
      }catch(e){if(active){setPreviewPaymentEvents([]);setPreviewPaymentError(e instanceof Error?e.message:'Payment updates unavailable');}}
    };
    void refresh();const timer=window.setInterval(()=>void refresh(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[previewAccount?.id]);
  useEffect(()=>{
    if(authenticatedUser||previewAccount){setGuestNotices([]);setGuestError('');return;}
    let active=true;
    const refresh=async()=>{
      try{
        const [events,payments]=await Promise.all([getStoryNotices(),getStorySessionPayments()]);
        const verified=reconcileStoryPaymentNotices(events,payments);
        if(active){setGuestNotices(verified);setGuestError('');}
      }
      catch{if(active){setGuestNotices([]);setGuestError(language==='bn'?'বিজ্ঞপ্তির পরিমাণ যাচাই করা যায়নি।':'Could not verify the amount for these notifications.');}}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[authenticatedUser?.id,previewAccount?.id,language]);
  useEffect(()=>{
    if(!authenticatedUser){setBoundId(null);setBoundOwnerUid(null);setBindingError('');setBindingReady(false);return;}
    let active=true;setBoundId(null);setBoundOwnerUid(null);setBindingError('');setBindingReady(false);
    getBoundSimulationUser().then(profile=>{if(active){setBoundId(profile);setBoundOwnerUid(authenticatedUser.id);setBindingReady(true);}})
      .catch(e=>{if(active){setBindingError(e instanceof Error?e.message:'Profile assignment unavailable');setBindingReady(true);}});
    return()=>{active=false;};
  },[authenticatedUser?.id]);
  useEffect(()=>{
    let active=true;setNotices([]);setNoticeOwner(null);setLoading(true);setError('');
    if(!id||!privateMode){setLoading(false);return()=>{active=false;};}
    const read=async()=>{
      try{
        const [data,payerRows,beneficiaryRows]=await Promise.all([
          getPrivateSimulationNotices(),getPrivateSimulationHistory('payer'),getPrivateSimulationHistory('beneficiary'),
        ]);
        const verified=reconcilePrivateSimulationNotices(id,data,payerRows,beneficiaryRows);
        if(active){setNotices(verified);setNoticeOwner(id);setLoading(false);setError('');}
      }
      catch(e){if(active){setError(e instanceof Error?e.message:'Notification API failed');setLoading(false);}}
    };
    void read();const timer=window.setInterval(()=>void read(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[id,privateMode]);
  const privateNotices=noticeOwner===id?notices:[];
  const markRead=async (notice:SimulationNotice)=>{
    const originalAuth=authenticatedUser?.id??null;
    if(!id||!originalAuth||boundOwnerUid!==originalAuth||noticeOwner!==id||
       !privateMode||busyNotice!==null)return;
    setBusyNotice(notice.id);setError('');
    try{const confirmed=await setPrivateSimulationNoticeRead(notice.id,!notice.isRead);
      if(confirmed.id!==notice.id||confirmed.isRead===notice.isRead)throw Error('Notification read-back mismatch');
      const [after,payerRows,beneficiaryRows]=await Promise.all([
        getPrivateSimulationNotices(),getPrivateSimulationHistory('payer'),getPrivateSimulationHistory('beneficiary'),
      ]);
      if(!after.some(n=>n.id===notice.id&&n.isRead===confirmed.isRead))throw Error('SQL notification read-back failed');
      // The owner bound to this request may have logged out during the RPC.
      // Ignore stale responses instead of showing them to the next session.
      if(currentAuthUid.current!==originalAuth)return;
      setNotices(reconcilePrivateSimulationNotices(id,after,payerRows,beneficiaryRows));
    }catch(e){
      if(currentAuthUid.current===originalAuth)
        setError(e instanceof Error?e.message:'Notification update failed');
    }finally{
      if(currentAuthUid.current===originalAuth)setBusyNotice(null);
    }
  };
  if(authLoading)return <main className="mx-auto max-w-4xl p-6"><p role="status">Checking account…</p></main>;
  const visibleAuthorizations=authorizationNotices.filter(r=>(authorizationFilter==="all"||r.status===authorizationFilter)&&
    (r.payerId+" "+r.taxpayerId+" "+r.status).toLocaleLowerCase().includes(authorizationSearch.trim().toLocaleLowerCase()));
  const visiblePayments=previewPaymentEvents.filter(p=>(p.transactionId+" "+p.payer+" "+p.state+" "+p.createdAt.slice(0,10)).toLocaleLowerCase().includes(paymentSearch.trim().toLocaleLowerCase()));
  if(previewAccount&&!authenticatedUser)return <main className="mx-auto max-w-7xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={label('Notifications','বিজ্ঞপ্তি')} description={label('Review requests and recorded payment updates.','অনুমোদনের অনুরোধ ও সংরক্ষিত পেমেন্টের হালনাগাদ দেখুন।')}/>
    <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="authorization-notice-title">
      <div className="taxpay-table-toolbar"><h2 id="authorization-notice-title" className="text-base font-semibold text-taxpay-text">{label('Authorization updates','অনুমোদনের হালনাগাদ')}</h2><TaxPayTableCounter label={label('Requests','অনুরোধ')} shown={visibleAuthorizations.length} total={authorizationNotices.length}/></div>
      <p className="mt-1 text-sm text-taxpay-muted">{label('Permission requests and their current recorded status.','অনুমতির আবেদন এবং সেগুলোর বর্তমান নথিভুক্ত অবস্থা।')}</p>
      <TaxPayTableControls className="taxpayer-transaction-filters taxpay-record-page-filters">
        <label className="taxpayer-transaction-filter">
          <span>{label('Search authorizations','অনুমোদন খুঁজুন')}</span>
          <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"
            value={authorizationSearch} onChange={e=>setAuthorizationSearch(e.target.value)}
            placeholder={label('Search payer or taxpayer','পরিশোধকারী বা করদাতা খুঁজুন')}/>
        </label>
        <label className="taxpayer-transaction-filter">
          <span>{label('Status','অবস্থা')}</span>
          <select className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"
            value={authorizationFilter} onChange={e=>setAuthorizationFilter(e.target.value)}>
            <option value="all">{label('All statuses','সব অবস্থা')}</option>
            {['ACTIVE','PENDING','CODE_ISSUED','APPROVED','REJECTED','EXPIRED','REVOKED'].map(state=>
              <option key={state} value={state}>{authorizationStatus(state)}</option>)}
          </select>
        </label>
        {(authorizationSearch||authorizationFilter!=='all')&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary"
          onClick={()=>{setAuthorizationSearch('');setAuthorizationFilter('all');}}>{label('Clear filters','ফিল্টার মুছুন')}</button>}
      </TaxPayTableControls>
      {authorizationError&&<p role="alert" className="text-red-700">{authorizationError}</p>}
      {!visibleAuthorizations.length?<p role="status" className="taxpay-table-state">{authorizationNotices.length?label('No authorization requests match your filters.','ফিল্টারে কোনো অনুমোদনের অনুরোধ মেলেনি।'):label('No authorization notifications yet.','এখনো কোনো অনুমোদনের বিজ্ঞপ্তি নেই।')}</p>:
      <TaxPayDataGrid variant="tabular" rows={visibleAuthorizations} getRowKey={r=>String(r.id)}
        ariaLabel={label('Authorization requests','অনুমোদনের অনুরোধ')}
        columns={[
          {key:'request',header:label('Authorization','অনুমোদন'),renderCell:r=><div>
            <p className="text-sm font-semibold text-taxpay-text">{r.taxpayerId===previewAccount.id
              ?r.status==='CODE_ISSUED'&&(r.codeResends??0)>0
                ?label('New authorization code requested by '+r.payerId,r.payerId+' নতুন অনুমোদন কোড চেয়েছেন')
                :label(r.payerId+' requested permission to pay for you',r.payerId+' আপনার হয়ে পরিশোধের অনুমতি চেয়েছেন')
              :label('Authorization for '+r.taxpayerId,r.taxpayerId+'-এর অনুমোদন')}</p>
            {r.taxpayerId===previewAccount.id&&r.status==='CODE_ISSUED'&&r.consentCode&&
              <p className="mt-1 text-sm text-taxpay-text">{label('Latest four-digit code','সর্বশেষ চার সংখ্যার কোড')}: <strong className="font-mono tracking-widest">{r.consentCode}</strong>
                {' · '}{label('Valid for 15 minutes from issue','পাঠানোর পর ১৫ মিনিট কার্যকর')}</p>}
          </div>},
          {key:'status',header:label('Status','অবস্থা'),renderCell:r=><p className={'inline-flex rounded-full border px-3 py-1 text-sm font-semibold '+(r.status==='ACTIVE'?'border-emerald-200 bg-emerald-50 text-emerald-800':r.status==='EXPIRED'?'border-slate-200 bg-slate-100 text-slate-700':'border-amber-200 bg-amber-50 text-amber-900')}>{authorizationStatus(r.status)}</p>},
          {key:'requested',header:label('Requested','অনুরোধের সময়'),renderCell:r=><time dateTime={new Date(r.requestedAt).toISOString()} className="text-sm text-taxpay-muted">{new Date(r.requestedAt).toLocaleString(bn?'bn-BD':'en-GB')}</time>},
          {key:'actions',header:label('Actions','কার্যক্রম'),renderCell:()=><button type="button" className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
            onClick={()=>navigate('manage_authorization')}>{label('Review authorization','অনুমোদন দেখুন')}</button>}
        ]}/>}
    </section>
    <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-label={label('Payment updates','পেমেন্ট হালনাগাদ')}>
      <div className="taxpay-table-toolbar"><h2 className="text-base font-semibold text-taxpay-text">{label('Payment updates','পেমেন্ট হালনাগাদ')}</h2><TaxPayTableCounter label={label('Records','রেকর্ড')} shown={visiblePayments.length} total={previewPaymentEvents.length}/></div>
      <p className="mt-1 text-sm text-taxpay-muted">{label('Recorded amounts only. No funds transferred or tax credit issued.','শুধু সংরক্ষিত পরিমাণ। কোনো অর্থ স্থানান্তর বা কর ক্রেডিট হয়নি।')}</p>
      <TaxPayTableControls className="taxpayer-transaction-filters taxpay-record-page-filters">
        <label className="taxpayer-transaction-filter">
          <span>{label('Search payment updates','পেমেন্টের হালনাগাদ খুঁজুন')}</span>
          <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"
            value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)}
            placeholder={label('Search payer or reference','পরিশোধকারী বা রেফারেন্স খুঁজুন')}/>
        </label>
        {paymentSearch&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary"
          onClick={()=>setPaymentSearch('')}>{label('Clear search','অনুসন্ধান মুছুন')}</button>}
      </TaxPayTableControls>
      {previewPaymentError?<p role="alert">{previewPaymentError}</p>:
       !visiblePayments.length?<p role="status" className="taxpay-table-state">{previewPaymentEvents.length?label('No payment updates match this search.','এই অনুসন্ধানে কোনো পেমেন্ট হালনাগাদ পাওয়া যায়নি।'):label('No payment activity yet.','এখনো কোনো পেমেন্ট কার্যক্রম নেই।')}</p>:
       <TaxPayDataGrid variant="tabular" rows={visiblePayments}
         getRowKey={p=>p.transactionId+':'+p.perspective}
         ariaLabel={label('Recorded payment updates','সংরক্ষিত পেমেন্টের হালনাগাদ')}
         columns={[
           {key:'payment',header:label('Payment','পেমেন্ট'),renderCell:p=><p className="text-sm font-semibold text-taxpay-text">{p.perspective==='beneficiary'
             ?label('Allocated to you by '+p.payer,p.payer+' আপনার জন্য বরাদ্দ করেছেন')
             :label('Your recorded payment','আপনার সংরক্ষিত পেমেন্ট')}</p>},
           {key:'reference',header:label('Reference','রেফারেন্স'),renderCell:p=><p className="break-all text-sm text-taxpay-muted">{p.transactionId}</p>},
           {key:'amount',header:label('Amount','পরিমাণ'),renderCell:p=><p className="text-sm font-semibold tabular-nums text-taxpay-text">{formatSimulatedAmount(p.amountMinor)}</p>},
           {key:'status',header:label('Status','অবস্থা'),renderCell:p=><div className="text-sm text-taxpay-muted">
             <p>{p.state==='SIMULATED'
             ?label('Recorded','সংরক্ষিত'):String(p.state).replaceAll('_',' ').toLowerCase()}</p>
             <time dateTime={p.createdAt} className="block text-xs">
               {new Date(p.createdAt).toLocaleDateString(bn?'bn-BD':'en-GB',{dateStyle:'medium'})}
             </time>
           </div>}
         ]}/>}
    </section>
    <ReceivedPaymentNoticeRegister profileId={previewAccount.id} language={language}/>
    <SessionPaymentNotifications language={language}/>
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
        <TaxPayDataGrid variant="tabular" rows={guestNotices} getRowKey={n=>String(n.id)}
          ariaLabel={label('Payment notices','পেমেন্ট বিজ্ঞপ্তি')}
          columns={[
            {key:'update',header:label('Update','হালনাগাদ'),renderCell:()=><h2 className="text-sm font-semibold text-taxpay-text">{label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত')}</h2>},
            {key:'amount',header:label('Amount','পরিমাণ'),renderCell:n=><p className="font-semibold tabular-nums text-taxpay-text">{label('Amount','পরিমাণ')}: {formatSimulatedAmount(n.amountMinor)}</p>},
            {key:'reference',header:label('Reference','রেফারেন্স'),renderCell:n=><p className="break-all text-sm text-taxpay-muted">{n.paymentId}</p>},
            {key:'date',header:label('Recorded','সংরক্ষণের সময়'),renderCell:n=><time className="text-sm text-taxpay-muted" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time>}
          ]}/>}
    </section>
  </main>;
  // Authenticated general TaxPay users can receive review/draft notifications
  // without a fictional simulator profile. The AccountCenter has its own
  // authenticated owner-only SQL query, so never block that private inbox.
  if(privateMode&&!id){
    if(!bindingReady)return <main className="mx-auto max-w-4xl p-6"><h1 className="text-xl font-semibold">Protected notifications</h1><p role="status">{label('Checking account…','অ্যাকাউন্ট যাচাই হচ্ছে…')}</p></main>;
    return <AccountCenter page="notifications"/>;
  }
  if(!id)return <AccountCenter page="notifications"/>;
  return <main className="mx-auto max-w-4xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={label('Payment notifications','পেমেন্ট বিজ্ঞপ্তি')}/>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite">
      {loading||noticeOwner!==id?<p>{label('Loading…','লোড হচ্ছে…')}</p>:error?<p role="alert">{error}</p>:
        !privateNotices.length?<p className="text-taxpay-muted">{label('No notifications yet.','এখনো কোনো বিজ্ঞপ্তি নেই।')}</p>:
        <TaxPayDataGrid variant="tabular" rows={privateNotices} getRowKey={n=>String(n.id)}
          ariaLabel={label('Account payment notifications','অ্যাকাউন্টের পেমেন্ট বিজ্ঞপ্তি')}
          columns={[
            {key:'update',header:label('Update','হালনাগাদ'),renderCell:n=><div>
              <h2 className="text-sm font-semibold text-taxpay-text">{({
                SIM_OFFICER_MAKER_ACKNOWLEDGED:label('Officer Maker acknowledged','মেকার অনুরোধ গ্রহণ করেছেন'),
                SIM_OFFICER_REVIEWER_VERIFIED:label('Officer Reviewer verified','রিভিউয়ার যাচাই করেছেন'),
                SIM_OFFICER_APPROVER_CLOSED:label('Officer Approver closed the review','অনুমোদনকারী পর্যালোচনা শেষ করেছেন')
              } as Record<string,string>)[n.messageCode]??label('Payment record added','পেমেন্ট রেকর্ড যোগ হয়েছে')}</h2>
              <p className="mt-1 text-sm text-taxpay-muted">{n.isRead?label('Read','পঠিত'):label('Unread','অপঠিত')}</p>
            </div>},
            {key:'amount',header:label('Amount','পরিমাণ'),renderCell:n=>n.amountMinor!==null
              ?<p className="font-semibold tabular-nums text-taxpay-text">{label(n.perspective==='beneficiary'?'Your allocation':'Amount',n.perspective==='beneficiary'?'আপনার বরাদ্দ':'পরিমাণ')}: {formatSimulatedAmount(n.amountMinor)}</p>
              :<p className="text-sm text-taxpay-muted">{label('Amount not verified','পরিমাণ যাচাই করা যায়নি')}</p>},
            {key:'reference',header:label('Reference and date','রেফারেন্স ও তারিখ'),renderCell:n=><div>
              <p className="break-all text-sm text-taxpay-muted">{n.transactionId}</p>
              <time className="text-sm text-taxpay-muted" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time>
            </div>},
            {key:'action',header:label('Actions','কার্যক্রম'),renderCell:n=><button type="button"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark disabled:opacity-50"
              disabled={busyNotice!==null} onClick={()=>void markRead(n)}>{n.isRead?label('Mark unread','অপঠিত করুন'):label('Mark read','পঠিত করুন')}</button>}
          ]}/>}
    </section>
    <SessionPaymentNotifications language={language}/>
  </main>;
};
