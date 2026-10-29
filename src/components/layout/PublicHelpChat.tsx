import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, BookOpen } from 'lucide-react';
import { GUIDE_CONTENT } from '../screens/PublicUserGuide';
import {useTaxState} from '../../services/taxState';
import { taxpayerBrandName } from '../../config/brand';

type Message = {from:'user'|'assistant';value:string};
export function PublicHelpChat(){
 const {language,navigate}=useTaxState();
 const bn=language==='bn';
 const [open,setOpen]=useState(false);
 const [input,setInput]=useState('');
 const [messages,setMessages]=useState<Message[]>([]);
 const [selectedTopic,setSelectedTopic]=useState<string|null>(null);
 const selectedGuide=GUIDE_CONTENT.find(g=>g.id===selectedTopic);
 const last=useRef<HTMLDivElement>(null);
 useEffect(()=>last.current?.scrollIntoView({block:'nearest'}),[messages,open]);
 const respond=(text:string)=>{
  const query=text.trim();
  if(!query)return;
  const normalized=query.toLowerCase();
  const terms=GUIDE_CONTENT.flatMap(group=>[{
   keywords:[group.en,group.bn,...group.faqs.flatMap(x=>x.q)],
   answer:group.faqs[0]?.a[bn?1:0] || group.description[bn?1:0]
  }]);
  const best=terms.find(row=>row.keywords.some(k=>normalized.includes(k.toLowerCase())||k.toLowerCase().includes(normalized)));
  const answer=best?.answer||(bn?'পেমেন্ট, রসিদ বা ভ্রমণ কর সম্পর্কে প্রশ্ন করুন। বিস্তারিত User guide-এ দেখুন।':'Ask about payment, receipts or travel tax. See the user guide for more.');
  setMessages(prev=>[...prev,{from:'user',value:query},{from:'assistant',value:answer}]);
  setInput('');
 };
 return <aside className="public-help-widget" aria-label={bn?'করবৃত্ত সহায়তা':'Korbritto help'}>
  {open&&<section className="public-help-panel" aria-labelledby="public-help-title">
   <header><div><h2 id="public-help-title">{taxpayerBrandName(language)} {bn?'সহায়তা':'help'}</h2><p>{bn?'নির্দেশনাভিত্তিক উত্তর':'Guide-based answers'}</p></div>
     <button onClick={()=>setOpen(false)} type="button" aria-label={bn?'চ্যাট বন্ধ করুন':'Close chat'}><X size={18}/></button></header>
   <div className="public-help-messages" role="log" aria-live="polite">
    <p className="public-help-opening">{bn?'কী জানতে চান? নিচের কোনো বিষয় বেছে নিন।':'How can we help? Choose a topic or type a question.'}</p>
    {messages.map((m,i)=><p className={'public-help-message public-help-message--'+m.from} key={i}>{m.value}</p>)}
    {selectedGuide&&<p className="public-help-message public-help-message--assistant" data-testid="guide-topic-answer">{selectedGuide.faqs[0]?.a[bn?1:0]||selectedGuide.description[bn?1:0]}</p>}
    <div ref={last}/>
   </div>
   <div className="public-help-topics">
    {GUIDE_CONTENT.slice(0,3).map(g=><button type="button" key={g.id} onClick={()=>{setSelectedTopic(g.id);setInput('');}}>{bn?g.bn:g.en}</button>)}
   </div>
   <form onSubmit={e=>{e.preventDefault();respond(input);}}><label className="sr-only" htmlFor="taxpay-help-message">{bn?'আপনার প্রশ্ন':'Your question'}</label>
    <input id="taxpay-help-message" value={input} onChange={e=>setInput(e.target.value)} placeholder={bn?'প্রশ্ন লিখুন':'Ask a question'} maxLength={250}/>
    <button type="submit" disabled={!input.trim()} aria-label={bn?'পাঠান':'Send'}><Send size={17}/></button>
   </form>
   <a className="public-help-more" href={import.meta.env.BASE_URL+'?action=user_guide&lang='+language}><BookOpen size={15}/>{bn?'ব্যবহার নির্দেশিকা':'Open user guide'}</a>
   <p className="public-help-limit">{bn?'স্বয়ংক্রিয় আইন বা কর হিসাব নয়।':'Not tax advice or a calculation service.'}</p>
  </section>}
  <button className="public-help-launch" type="button" aria-label={open?(bn?'সহায়তা বন্ধ করুন':'Close help'):(bn?'চ্যাট সহায়তা':'Chat support')}
    aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?<X size={23}/>:<MessageCircle size={23}/>}<span>{bn?'সহায়তা':'Help'}</span></button>
 </aside>;
}
