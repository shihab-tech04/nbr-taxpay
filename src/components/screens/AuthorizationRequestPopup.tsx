import React,{useEffect,useState} from 'react';
import {TaxPayModal} from '../ui/TaxPayModal';
import {DEMO_USERS} from '../../data/demoUsers';
import {useTaxState} from '../../services/taxState';
import {formatCurrency} from '../../services/numberFormat';
import {unreadReceivedPaymentNotices,acknowledgeReceivedPaymentNotice,type ReceivedPaymentNotice}
  from '../../services/demoReceivedPaymentNotices';
import {
  getHostedAuthorizations,performHostedAuthorization,type HostedAuthorization
} from '../../services/hostedDemoAuthorizations';

/** In-app live popup for synthetic accounts; also appears in Notifications/Manage Authorization. */
export function AuthorizationRequestPopup(){
  const {previewAccount,language,navigate}=useTaxState();
  const actor=previewAccount?.id;
  const bn=language==='bn';
  const [incoming,setIncoming]=useState<HostedAuthorization|null>(null);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [code,setCode]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [received,setReceived]=useState<ReceivedPaymentNotice|null>(null);
  const [receivedOwner,setReceivedOwner]=useState<string|null>(null);
  const [dismissedReceived,setDismissedReceived]=useState<string[]>([]);
  const [receivedBusy,setReceivedBusy]=useState(false);
  const [receivedError,setReceivedError]=useState('');
  useEffect(()=>{
    setIncoming(null);setDismissed([]);setCode(null);setError('');
    setReceived(null);setReceivedOwner(null);setDismissedReceived([]);setReceivedError('');setReceivedBusy(false);
  },[actor]);
  useEffect(()=>{
    if(!actor)return;
    let active=true;
    const poll=async()=>{
      try{
        const all=await getHostedAuthorizations(actor);
        const first=all.find(r=>r.taxpayerId===actor &&
          (r.status==='PENDING'||(r.status==='CODE_ISSUED'&&(r.codeResends??0)>0)) &&
          !dismissed.includes(`${r.id}:${r.codeResends??0}`));
        // A resend must replace an already-open original-code popup too.
        if(active&&(!code||first?.status==='CODE_ISSUED')){
          setIncoming(first??null);
          if(first?.status==='CODE_ISSUED')setCode(null);
        }
      }catch{/* Manage Authorization shows read errors; do not disrupt other pages */}
    };
    void poll();const timer=window.setInterval(()=>void poll(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[actor,dismissed,code]);
  // The canonical WS3 feed determines the recipient on the server. Keep the
  // oldest unread notice first and acknowledge only after an explicit action.
  useEffect(()=>{
    // WS3 #408 is not merged yet. Opt in only with the verified capability RPC;
    // older preview/browser mocks must retain their existing behavior.
    if(!actor || import.meta.env.VITE_RECIPIENT_NOTICE_FEED_ENABLED !== 'true')return;
    let active=true;
    const refresh=async()=>{
      try{
        const notices=await unreadReceivedPaymentNotices(actor);
        if(active&&!receivedBusy){
          setReceivedOwner(actor);
          setReceived(notices.find(item=>!dismissedReceived.includes(item.eventId))??null);
        }
      }catch{
        // A missing WS3 API does not bypass login or disturb authorization UI.
        // Keep the last verified notice for explicit retry.
      }
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[actor,dismissedReceived,receivedBusy]);

  // Guard synchronously during a profile switch, before the reset effect runs.
  const visibleReceived=receivedOwner===actor?received:null;
  const visibleIncoming=incoming?.taxpayerId===actor?incoming:null;
  const dismissReceived=()=>{
    if(!visibleReceived||receivedBusy)return;
    setDismissedReceived(previous=>[...previous,visibleReceived.eventId]);
    setReceived(null);setReceivedError('');
  };
  const acknowledgeReceived=async()=>{
    if(!actor||!visibleReceived||receivedBusy)return;
    const eventId=visibleReceived.eventId;
    setReceivedBusy(true);setReceivedError('');
    try{
      await acknowledgeReceivedPaymentNotice(actor,eventId);
      const remaining=await unreadReceivedPaymentNotices(actor);
      if(remaining.some(item=>item.eventId===eventId))
        throw new Error('Notice acknowledgement has not been confirmed.');
      setReceivedOwner(actor);
      setReceived(remaining.find(item=>!dismissedReceived.includes(item.eventId))??null);
    }catch(cause){
      setReceivedError(cause instanceof Error?cause.message:'Could not confirm notice read state.');
    }finally{setReceivedBusy(false);}
  };

  if(!actor)return null;
  if(!visibleIncoming&&visibleReceived){
    const money=formatCurrency(visibleReceived.amountMinor/100,language);
    return <TaxPayModal
      title={bn?'প্রাপ্ত কর পরিশোধের বিজ্ঞপ্তি':'Received tax payment notice'}
      onClose={dismissReceived}
      closeIconLabel={bn?'বন্ধ করুন':'Close modal'}
      className="taxpayer-authorization-modal"
      footer={<button type="button" disabled={receivedBusy}
        className="tax-service-choice__continue" onClick={()=>void acknowledgeReceived()}>
        {receivedBusy?(bn?'নিশ্চিত করা হচ্ছে…':'Confirming…'):(bn?'পড়েছি, পরেরটি দেখুন':'Acknowledge and continue')}
      </button>}
    >
      <div className="mt-4 space-y-3" data-testid="visibleReceived-payment-notice">
        <p className="text-sm leading-6 text-taxpay-text">
          {bn?'আপনার করদাতা প্রোফাইলের জন্য একটি পরিশোধ রেকর্ড হয়েছে।':'A payment has been recorded for your taxpayer profile.'}
        </p>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div><dt>{bn?'পরিমাণ':'Amount'}</dt><dd className="font-semibold">{money}</dd></div>
          <div><dt>{bn?'করবর্ষ':'Assessment year'}</dt><dd>{visibleReceived.assessmentYear}</dd></div>
          <div><dt>{bn?'খাত':'Payment head'}</dt><dd>{visibleReceived.headId??'—'}</dd></div>
          <div><dt>{bn?'রেফারেন্স':'Reference'}</dt><dd className="break-all">{visibleReceived.receiptReference??visibleReceived.paymentId}</dd></div>
        </dl>
        <p className="text-xs text-taxpay-muted">{bn?'এটি নথিভুক্ত পেমেন্টের তথ্য; সরকারি নিষ্পত্তির প্রমাণ নয়।':'This is a recorded payment, not confirmation of government settlement.'}</p>
        {receivedError&&<p role="alert" className="text-sm text-taxpay-error">{receivedError}</p>}
      </div>
    </TaxPayModal>;
  }
  if(!visibleIncoming)return null;
  const requester=DEMO_USERS[visibleIncoming.payerId];
  const displayedCode=code??(visibleIncoming.status==='CODE_ISSUED'?visibleIncoming.consentCode:null);
  const dismiss=()=>{setDismissed(before=>[...before,`${visibleIncoming.id}:${visibleIncoming.codeResends??0}`]);setIncoming(null);setCode(null);};
  const act=async(choice:'accept'|'decline')=>{
    if(busy)return;
    setBusy(true);setError('');
    try{
      const result=await performHostedAuthorization(actor,choice,{id:visibleIncoming.id});
      if(choice==='accept'&&result.consentCode)setCode(result.consentCode);
      else dismiss();
    }catch(e){setError(e instanceof Error?e.message:'Authorization unavailable');}
    finally{setBusy(false);}
  };
  const viewAuthorization = () => {
    try { sessionStorage.setItem('taxpay-authorization-open-tab', 'visibleIncoming'); }
    catch { /* Optional navigation hint. */ }
    dismiss();
    navigate('manage_authorization');
  };
  return <TaxPayModal
    title={bn ? 'পেমেন্ট অনুমোদনের অনুরোধ' : 'Payment authorization request'}
    onClose={dismiss}
    closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
    className="taxpayer-authorization-modal"
    footer={displayedCode ? (
      <button type="button" className="tax-service-choice__continue" onClick={viewAuthorization}>
        {bn ? 'অনুমোদন দেখুন' : 'View authorization'}
      </button>
    ) : (
      <div className="tax-service-choice__actions">
        <button type="button" disabled={busy} className="taxpay-modal__footer-close"
          onClick={() => void act('decline')}>{bn ? 'প্রত্যাখ্যান' : 'Decline'}</button>
        <button type="button" disabled={busy} className="tax-service-choice__continue"
          onClick={() => void act('accept')}>{bn ? 'গ্রহণ করুন' : 'Accept'}</button>
      </div>
    )}
  >
      {displayedCode?<div className="mt-4 space-y-3">
        <p className="text-sm text-slate-700">{visibleIncoming.status==='CODE_ISSUED'
          ?(bn?'নতুন কোড এসেছে। আগের কোড বাতিল হয়েছে। সর্বশেষ কোডটি অনুরোধকারীকে দিন।':'New code visibleReceived. The previous code is invalid. Share this latest code with the requester.')
          :(bn?'অনুরোধ গ্রহণ করা হয়েছে। এই কোডটি অনুরোধকারীকে দিন।':'Request accepted. Share this code with the requester.')}</p>
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-blue-900">{displayedCode}</p>
        <p className="text-xs text-slate-600">{bn?'কোডটি ১৫ মিনিট কার্যকর। অনুরোধকারী কোড লিখলে অনুমোদন সম্পূর্ণ হবে।':'This four-digit code expires in 15 minutes. Authorization completes when the requester enters it.'}</p>
      </div>:<div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-slate-700"><strong>{bn?requester.nameBn:requester.nameEn}</strong> ({requester.id}) {bn?'আপনার টিআইএনের কর পরিশোধের অনুমতি চাইছেন।':'wants permission to make tax payments for your TIN.'}</p>
        <p className="text-sm text-slate-600">{bn?'TIN:':'TIN:'} {DEMO_USERS[actor].tin}</p>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
  </TaxPayModal>;
}
