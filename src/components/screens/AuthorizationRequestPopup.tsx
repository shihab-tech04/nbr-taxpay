import React,{useEffect,useState} from 'react';
import {ShieldCheck,X} from 'lucide-react';
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
        const first=all.find(r=>r.taxpayerId===actor&&r.status==='PENDING'&&!dismissed.includes(r.id));
        if(active&&!code)setIncoming(first??null);
      }catch{/* Manage Authorization shows read errors; do not disrupt other pages */}
    };
    void poll();const timer=window.setInterval(()=>void poll(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[actor,dismissed,code]);
  if(!actor||!incoming)return null;
  const requester=DEMO_USERS[incoming.payerId];
  const dismiss=()=>{setDismissed(before=>[...before,incoming.id]);setIncoming(null);setCode(null);};
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
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="auth-popup-title"
      className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-6 shadow-2xl" lang={language}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-blue-800"><ShieldCheck size={24} aria-hidden="true"/>
          <h2 id="auth-popup-title" className="text-lg font-bold">{bn?'পেমেন্ট অনুমোদনের অনুরোধ':'Payment authorization request'}</h2></div>
        <button type="button" aria-label={bn?'বন্ধ':'Close'} onClick={dismiss} className="rounded-lg p-2 text-slate-600"><X size={20}/></button>
      </div>
      {code?<div className="mt-4 space-y-3">
        <p className="text-sm text-slate-700">{bn?'অনুরোধ গ্রহণ করা হয়েছে। এই কোডটি অনুরোধকারীকে দিন।':'Request accepted. Share this code with the requester.'}</p>
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-blue-900">{code}</p>
        <p className="text-xs text-slate-600">{bn?'কোডটি ১৫ মিনিট কার্যকর। অনুরোধকারী কোড লিখলে অনুমোদন সম্পূর্ণ হবে।':'This four-digit code expires in 15 minutes. Authorization completes when the requester enters it.'}</p>
        <button type="button" className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white" onClick={()=>{
          try{sessionStorage.setItem('taxpay-authorization-open-tab','incoming');}catch{/* optional navigation hint */}
          dismiss();navigate('manage_authorization');
        }}>{bn?'অনুমোদন দেখুন':'View authorization'}</button>
      </div>:<div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-slate-700"><strong>{bn?requester.nameBn:requester.nameEn}</strong> ({requester.id}) {bn?'আপনার টিআইএনের কর পরিশোধের অনুমতি চাইছেন।':'wants permission to make simulated tax payments for your TIN.'}</p>
        <p className="text-sm text-slate-600">{bn?'TIN:':'TIN:'} {DEMO_USERS[actor].tin}</p>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={busy} className="flex-1 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50" onClick={()=>void act('accept')}>{bn?'গ্রহণ করুন':'Accept'}</button>
          <button type="button" disabled={busy} className="flex-1 rounded-lg border border-blue-200 px-4 py-3 font-semibold text-blue-800 disabled:opacity-50" onClick={()=>void act('decline')}>{bn?'প্রত্যাখ্যান':'Decline'}</button>
        </div>
      </div>}
    </section>
  </div>;
}
