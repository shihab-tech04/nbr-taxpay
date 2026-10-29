import React,{useEffect,useState} from 'react';
import {TaxPayModal} from '../ui/TaxPayModal';
import {DEMO_USERS} from '../../data/demoUsers';
import {useTaxState} from '../../services/taxState';
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
  useEffect(()=>{
    setIncoming(null);setDismissed([]);setCode(null);setError('');
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
  if(!actor||!incoming)return null;
  const requester=DEMO_USERS[incoming.payerId];
  const displayedCode=code??(incoming.status==='CODE_ISSUED'?incoming.consentCode:null);
  const dismiss=()=>{setDismissed(before=>[...before,`${incoming.id}:${incoming.codeResends??0}`]);setIncoming(null);setCode(null);};
  const act=async(choice:'accept'|'decline')=>{
    if(busy)return;
    setBusy(true);setError('');
    try{
      const result=await performHostedAuthorization(actor,choice,{id:incoming.id});
      if(choice==='accept'&&result.consentCode)setCode(result.consentCode);
      else dismiss();
    }catch(e){setError(e instanceof Error?e.message:'Authorization unavailable');}
    finally{setBusy(false);}
  };
  const viewAuthorization = () => {
    try { sessionStorage.setItem('taxpay-authorization-open-tab', 'incoming'); }
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
        <p className="text-sm text-slate-700">{incoming.status==='CODE_ISSUED'
          ?(bn?'নতুন কোড এসেছে। আগের কোড বাতিল হয়েছে। সর্বশেষ কোডটি অনুরোধকারীকে দিন।':'New code received. The previous code is invalid. Share this latest code with the requester.')
          :(bn?'অনুরোধ গ্রহণ করা হয়েছে। এই কোডটি অনুরোধকারীকে দিন।':'Request accepted. Share this code with the requester.')}</p>
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-blue-900">{displayedCode}</p>
        <p className="text-xs text-slate-600">{bn?'কোডটি ১৫ মিনিট কার্যকর। অনুরোধকারী কোড লিখলে অনুমোদন সম্পূর্ণ হবে।':'This four-digit code expires in 15 minutes. Authorization completes when the requester enters it.'}</p>
      </div>:<div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-slate-700"><strong>{bn?requester.nameBn:requester.nameEn}</strong> ({requester.id}) {bn?'আপনার টিআইএনের কর পরিশোধের অনুমতি চাইছেন।':'wants permission to make simulated tax payments for your TIN.'}</p>
        <p className="text-sm text-slate-600">{bn?'TIN:':'TIN:'} {DEMO_USERS[actor].tin}</p>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
  </TaxPayModal>;
}
