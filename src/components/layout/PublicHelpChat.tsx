import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, BookOpen } from 'lucide-react';
import type { GuideEntry } from '../../data/publicGuideContent';
import {useTaxState} from '../../services/taxState';
import { taxpayerBrandName } from '../../config/brand';

type Message = {from:'user'|'assistant';value:string};
export function PublicHelpChat(){
 const {language,navigate}=useTaxState();
 const bn=language==='bn';
 const [open,setOpen]=useState(false);
 const [mobile,setMobile]=useState(false);
 const [input,setInput]=useState('');
 const [messages,setMessages]=useState<Message[]>([]);
 const [selectedTopic,setSelectedTopic]=useState<string|null>(null);
 // Guide answers are only fetched when the visitor opens Help. Its launcher
 // and focusable control remain available immediately on every public route.
 const [guideContent,setGuideContent]=useState<GuideEntry[]>([]);
 const [guideLoadError,setGuideLoadError]=useState(false);
 const GUIDE_CONTENT=guideContent;
 const selectedGuide=GUIDE_CONTENT.find(g=>g.id===selectedTopic);
 useEffect(()=>{
  if(!open||guideContent.length)return;
  let active=true;
  setGuideLoadError(false);
  void import('../../data/publicGuideContent')
   .then(m=>{if(active)setGuideContent(m.GUIDE_CONTENT);})
   .catch(()=>{if(active)setGuideLoadError(true);});
  return()=>{active=false;};
 },[open,guideContent.length]);
 const last=useRef<HTMLDivElement>(null);
 const launchRef=useRef<HTMLButtonElement>(null);
 const panelRef=useRef<HTMLElement>(null);
 const wasOpen=useRef(false);
 useEffect(()=>{
  const query=window.matchMedia('(max-width: 650px)');
  const update=()=>setMobile(query.matches);
  update();
  query.addEventListener('change',update);
  return ()=>query.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(!open||!mobile)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  panelRef.current?.focus();
  const trap=(event:KeyboardEvent)=>{
   if(event.key!=='Tab'||!panelRef.current)return;
   const candidates=Array.from(panelRef.current.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
   )).filter(el=>el.getClientRects().length>0);
   if(!candidates.length){event.preventDefault();return;}
   const first=candidates[0], last=candidates[candidates.length-1];
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===panelRef.current)){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panelRef.current)){
    event.preventDefault();first.focus();
   }
  };
  document.addEventListener('keydown',trap);
  return ()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',trap);};
 },[open,mobile]);
 const closePanel=()=>setOpen(false);
 useEffect(()=>{
  if(!open&&wasOpen.current)launchRef.current?.focus();
  wasOpen.current=open;
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closePanel();}
  };
  document.addEventListener('keydown',onKeyDown);
  return ()=>document.removeEventListener('keydown',onKeyDown);
 },[open]);
 useEffect(()=>{ last.current?.scrollIntoView({block:'nearest'}); },[messages,open]);
 const respond=(text:string)=>{
  const query=text.trim();
  if(!query)return;
  const normalized=query.toLowerCase();
  const matches=(keywords:string[])=>keywords.some(k=>normalized.includes(k.toLowerCase())||k.toLowerCase().includes(normalized));
  // Match each question to its own maintained answer. Previously every
  // question in a topic returned that topic's first FAQ response.
  const faqAnswers=GUIDE_CONTENT.flatMap(group=>group.faqs.map(faq=>({keywords:faq.q,answer:faq.a[bn?1:0]})));
  const matchedFaq=faqAnswers.find(row=>matches(row.keywords));
  const matchedTopic=GUIDE_CONTENT.find(group=>matches([group.en,group.bn]));
  const answer=matchedFaq?.answer || matchedTopic?.description[bn?1:0] ||
   (bn?'পেমেন্ট, রসিদ বা ভ্রমণ কর সম্পর্কে প্রশ্ন করুন। বিস্তারিত User guide-এ দেখুন।':'Ask about payment, receipts or travel tax. See the user guide for more.');
  setMessages(prev=>[...prev,{from:'user',value:query},{from:'assistant',value:answer}]);
  setInput('');
 };
 return <aside className="public-help-widget" aria-label={bn?'সহজকর সহায়তা':'Sohojkor help'}>
  {open&&<div className="public-help-backdrop" aria-hidden="true" onClick={closePanel}/>} 
  {open&&<section ref={panelRef} tabIndex={-1} id="public-help-panel" className="public-help-panel" role="dialog" aria-modal={mobile} aria-labelledby="public-help-title">
   <header><div><h2 id="public-help-title">{taxpayerBrandName(language)} {bn?'সহায়তা':'help'}</h2><p>{bn?'নির্দেশনাভিত্তিক উত্তর':'Guide-based answers'}</p></div>
     <button onClick={closePanel} type="button" aria-label={bn?'চ্যাট বন্ধ করুন':'Close chat'}><X size={18}/></button></header>
   <div className="public-help-messages" role="log" aria-live="polite">
    <p className="public-help-opening">{bn?'কী জানতে চান? নিচের কোনো বিষয় বেছে নিন।':'How can we help? Choose a topic or type a question.'}</p>
    {messages.map((m,i)=><p className={'public-help-message public-help-message--'+m.from} key={i}>{m.value}</p>)}
    {selectedGuide&&<p className="public-help-message public-help-message--assistant" data-testid="guide-topic-answer">{selectedGuide.faqs[0]?.a[bn?1:0]||selectedGuide.description[bn?1:0]}</p>}
    <div ref={last}/>
   </div>
   <div className="public-help-topics">
    {!GUIDE_CONTENT.length && <p role="status">{guideLoadError
      ? (bn?'বিষয়গুলো লোড করা যায়নি। ব্যবহার নির্দেশিকা খুলুন।':'Topics unavailable. Open the user guide.')
      : (bn?'সহায়তার বিষয় লোড হচ্ছে…':'Loading help topics…')}</p>}
    {GUIDE_CONTENT.slice(0,3).map(g=><button type="button" key={g.id} onClick={()=>{setSelectedTopic(g.id);setInput('');}}>{bn?g.bn:g.en}</button>)}
   </div>
   <form onSubmit={e=>{e.preventDefault();respond(input);}}><label className="sr-only" htmlFor="taxpay-help-message">{bn?'আপনার প্রশ্ন':'Your question'}</label>
    <input id="taxpay-help-message" value={input} onChange={e=>setInput(e.target.value)} placeholder={bn?'প্রশ্ন লিখুন':'Ask a question'} maxLength={250}/>
    <button type="submit" disabled={!input.trim()||(!GUIDE_CONTENT.length&&!guideLoadError)} aria-label={bn?'পাঠান':'Send'}><Send size={17}/></button>
   </form>
   <a className="public-help-more" href={import.meta.env.BASE_URL+'?action=user_guide&lang='+language}><BookOpen size={15}/>{bn?'ব্যবহার নির্দেশিকা':'Open user guide'}</a>
   <p className="public-help-limit">{bn?'স্বয়ংক্রিয় আইন বা কর হিসাব নয়।':'Not tax advice or a calculation service.'}</p>
  </section>}
  <button ref={launchRef} className="public-help-launch" type="button" aria-label={open?(bn?'সহায়তা বন্ধ করুন':'Close help'):(bn?'চ্যাট সহায়তা':'Chat support')}
    aria-controls="public-help-panel" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?<><X className="public-help-launch__close" size={23}/><MessageCircle className="public-help-launch__chat" size={23}/></>:<MessageCircle size={23}/>}<span>{bn?'সহায়তা':'Help'}</span></button>
 </aside>;
}
