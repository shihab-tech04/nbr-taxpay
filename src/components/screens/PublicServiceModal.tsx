import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ReceiptLookup } from './ReceiptLookup';
import { TravelTax } from './TravelTax';

export type PublicService = 'status' | 'travel';

export function PublicServiceModal({service,onClose}:{service:PublicService,onClose:()=>void}) {
  const {language}=useTaxState();
  const bn=language==='bn';
  const dialog=useRef<HTMLDivElement>(null);
  const close=useRef<HTMLButtonElement>(null);
  const title=service==='travel'?(bn?'ভ্রমণ কর':'Travel tax'):(bn?'পেমেন্টের অবস্থা ও রসিদ':'Payment status & receipt');
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    close.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab'||!dialog.current)return;
      const els=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
      if(!els.length)return;
      const first=els[0],last=els[els.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  return <div className="public-service-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={dialog} className="public-service-dialog" role="dialog" aria-modal="true" aria-labelledby="public-service-title" data-public-service={service}>
      <header className="public-service-dialog__header">
        <div><p>{bn?'সাইন ইন ছাড়াই':'Without signing in'}</p><h2 id="public-service-title">{title}</h2></div>
        <button ref={close} type="button" onClick={onClose} aria-label={bn?'বন্ধ করুন':'Close modal'}><X size={20}/></button>
      </header>
      <div className="public-service-dialog__notice" role="note">
        {bn?'শুধু নমুনা কার্যপ্রবাহ। সরকারি পেমেন্ট বা যাচাইকৃত রসিদ ইস্যু হয় না।':'Demonstration workflow only. No government payment or verified receipt is issued.'}
      </div>
      <div className="public-service-dialog__body" key={service}>
        {service==='travel'?<TravelTax embedded/>:<ReceiptLookup embedded/>}
      </div>
    </div>
  </div>;
}
