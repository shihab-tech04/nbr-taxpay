import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Search, ChevronDown, ExternalLink, X, ArrowRight, PhoneCall } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import '../../styles/public-guide-p3.css';

import { GUIDE_CONTENT, type Category, type Pair } from '../../data/publicGuideContent';
export { GUIDE_CONTENT } from '../../data/publicGuideContent';
type Device = 'web'|'mobile';

export const PublicUserGuide:React.FC=()=>{
 const {language,routeParams,navigate,openPaymentServiceChoice}=useTaxState();
 const bn=language==='bn';
 const t=(pair:Pair)=>pair[bn?1:0];
 const initial=GUIDE_CONTENT.some(x=>x.id===routeParams.category)?routeParams.category:'payments';
 const [selected,setSelected]=useState<Category>(initial);
 useEffect(()=>{
   setSelected(GUIDE_CONTENT.some(x=>x.id===routeParams.category) ? routeParams.category as Category : 'payments');
   setSearch('');
 },[routeParams]);
 const [search,setSearch]=useState('');
 const [device,setDevice]=useState<Device>(()=>{
   // The first instruction must match the visitor's device. Keep the
   // existing device switch under user control after initial rendering.
   return typeof window!=='undefined'&&window.matchMedia('(max-width: 700px)').matches?'mobile':'web';
 });
 const contentRef=useRef<HTMLElement>(null);
 const searchRef=useRef<HTMLInputElement>(null);
 const chooseTopic=(id:Category)=>{
   setSelected(id);
   navigate('user_guide',{category:id});
   // Topic changes should take the reader to the new instructions, not back to the page hero.
   window.requestAnimationFrame(()=>{
     const content=contentRef.current;
     content?.scrollIntoView({block:'start',behavior:'instant'});
     content?.focus({preventScroll:true});
   });
 };
 const current=GUIDE_CONTENT.find(x=>x.id===selected)!;
 const query=search.trim().toLocaleLowerCase();
 const results=query?GUIDE_CONTENT.map(category=>{
   const inTopic=(category.en+' '+category.bn).toLocaleLowerCase().includes(query);
   const steps=category.steps.map((step,index)=>{
     const inTitle=step.title.join(' ').toLocaleLowerCase().includes(query);
     const inWeb=step.web.join(' ').toLocaleLowerCase().includes(query);
     const inMobile=step.mobile.join(' ').toLocaleLowerCase().includes(query);
     const displayDevice:Device=(!inTopic&&!inTitle&&!step[device].join(' ').toLocaleLowerCase().includes(query))?(device==='web'?'mobile':'web'):device;
     return {step,index,displayDevice,matches:inTopic||inTitle||inWeb||inMobile};
   }).filter(item=>item.matches);
   const faqs=category.faqs.filter(item=>inTopic||(item.q.join(' ')+' '+item.a.join(' ')).toLocaleLowerCase().includes(query));
   return {category,steps,faqs};
 }).filter(item=>item.steps.length||item.faqs.length):[];
 const resultCount=results.reduce((count,item)=>count+item.steps.length+item.faqs.length,0);
 const labels=bn?['ওয়েব','মোবাইল']:['Web','Mobile'];
 const actionsFor=(category:Category)=>{
  if(category==='travel') return [{id:'travel',label:['Pay Travel Tax','ভ্রমণ কর পরিশোধ করুন'] as Pair,run:()=>openPaymentServiceChoice('TRAVEL_TAX')}];
  if(category==='status'||category==='records') return [{id:'records',label:['Find a payment record','পেমেন্ট রেকর্ড খুঁজুন'] as Pair,run:()=>navigate('verify')}];
  if(category==='withholding') return [{id:'withholding',label:['Start source tax deposit','উৎসে কর জমা শুরু করুন'] as Pair,run:()=>openPaymentServiceChoice('SOURCE_TAX_DEPOSIT')}];
  return [{id:'payment',label:['Open payment services','পরিশোধ সেবাসমূহ খুলুন'] as Pair,run:()=>openPaymentServiceChoice()}];
 };
 const actionLinks=(category:Category)=><div className="public-guide-actions" role="group" aria-label={bn?'সম্পর্কিত সেবা':'Related services'}>
  {actionsFor(category).map(action=><button key={action.id} type="button" className="public-guide-action" onClick={action.run}>
   {t(action.label)}<ArrowRight size={16} aria-hidden="true"/>
  </button>)}
 </div>;
 const officialSource=<aside className="public-guide-source" aria-label={bn?'সরকারি তথ্য ও সহায়তা':'Official information and support'}>
   <div className="public-guide-source-copy">
     <h3>{bn?'সরকারি তথ্য ও সহায়তা':'Official information and support'}</h3>
     <p>{bn?'ই-রিটার্নের প্রশ্নে এনবিআর সহায়তা: ০৯৬৪৩ ৭১৭১৭১, ছুটির দিন ছাড়া সকাল ৯টা–বিকাল ৫টা। আয়কর ই-পেমেন্ট চালান পেতে সমস্যায় ০৯৬১১-৭৭৭১১১ এবং ভ্যাট ই-পেমেন্ট চালান পেতে সমস্যায় ১৬৫৫৫ নম্বরে কল করুন। ব্যাংক বা গেটওয়ে লেনদেনের সমস্যায় আপনার সেবাদাতার সঙ্গে যোগাযোগ করুন।':'NBR e-Return help: 09643 717171, 09:00–17:00 excluding holidays. For Tax e-Payment challan problems, call 09611-777111; for VAT e-Payment challan problems, call 16555. For a bank or gateway transaction issue, contact your provider.'}</p>
   </div>
   <a className="public-guide-hotline" href="tel:09643717171">{bn?'এনবিআর ই-রিটার্ন সহায়তা কল করুন':'Call NBR e-Return support'}<PhoneCall size={16} aria-hidden="true"/></a>
   <nav className="public-guide-source-links" aria-label={bn?'সরকারি সহায়তা ও তথ্যের লিংক':'Official support and information links'}>
    <a href={bn?'https://nbr.gov.bd/all-faq/ban':'https://nbr.gov.bd/all-faq/eng'} rel="noopener noreferrer" target="_blank">{bn?'এনবিআর ই-রিটার্ন প্রশ্নোত্তর':'NBR e-Return FAQ'}<ExternalLink size={16} aria-hidden="true"/></a>
     <a href="tel:09611777111">{bn?'এনবিআর আয়কর ই-পেমেন্ট চালান সহায়তায় কল করুন (০৯৬১১-৭৭৭১১১)':'Call NBR Tax e-Payment challan support (09611-777111)'}<PhoneCall size={16} aria-hidden="true"/></a>
    <a href="tel:16555">{bn?'এনবিআর ভ্যাট ই-পেমেন্ট চালান সহায়তায় কল করুন (১৬৫৫৫)':'Call NBR VAT e-Payment challan support (16555)'}<PhoneCall size={16} aria-hidden="true"/></a>
    <a href="https://nbr.gov.bd/" rel="noopener noreferrer" target="_blank">{bn?'এনবিআর প্রকাশনা':'NBR publications'}<ExternalLink size={16} aria-hidden="true"/></a>
    <a href="https://nbr.gov.bd/terms-of-use/eng" rel="noopener noreferrer" target="_blank">{bn?'এনবিআর ভ্যাট পোর্টালের ব্যবহারের শর্ত (ইংরেজি)':'NBR VAT Portal terms (English)'}<ExternalLink size={16} aria-hidden="true"/></a>
    <a href="https://nbr.gov.bd/privacy-policy/e-services/vatcalculator/eng" rel="noopener noreferrer" target="_blank">{bn?'এনবিআর ভ্যাট পোর্টালের গোপনীয়তা নীতি (ইংরেজি)':'NBR VAT Portal privacy policy (English)'}<ExternalLink size={16} aria-hidden="true"/></a>
    <a href={import.meta.env.BASE_URL+'?action=glossary&lang='+language} onClick={event=>{event.preventDefault();navigate('glossary');}}>{bn?'কর ও পেমেন্টের শব্দ':'Payment terms'}<ArrowRight size={16} aria-hidden="true"/></a>
   </nav>
   <p className="public-guide-source-note">{bn?'এই শর্ত ও গোপনীয়তার পৃষ্ঠাগুলো এনবিআর ভ্যাট পোর্টালের জন্য; সহজকরের নিজস্ব নীতি নয়। উভয় পৃষ্ঠায় প্রকাশের তারিখ মে ২০১২। উদাহরণ রেকর্ড সরকারি কোষাগারে অর্থ জমা বা সরকারি কর লেজারে ক্রেডিটের প্রমাণ নয়। প্রকৃত পরিশোধ সরকারি রেকর্ডে যাচাই করুন।':'These terms and privacy pages describe the NBR VAT Portal, not Sohojkor. Both pages show a May 2012 publication date. An example record does not prove Treasury settlement or a credit in an official tax ledger; verify actual payments through official records.'}</p>
 </aside>;
 return <div className={'public-guide-page '+(bn?'font-bengali':'')}>
  <div className="public-guide-overview">
    <header className="public-guide-intro">
      <p className="citizen-hub-eyebrow">{bn?'ব্যবহার নির্দেশিকা':'User guide'}</p>
      <h1>{bn?'সহজকর ব্যবহার নির্দেশিকা':'Sohojkor user guide'}</h1>
      <p>{bn?'পেমেন্টের ধাপ, রসিদ ও সাধারণ প্রশ্ন।':'Clear steps, payment references and common questions.'}</p>
    </header>
    <section className="public-guide-find" aria-labelledby="guide-search-title">
      <div className="public-guide-find-copy">
        <h2 id="guide-search-title">{bn?'উত্তর খুঁজুন':'Find an answer'}</h2>
        <p>{bn?'ছয়টি বিষয়ের ধাপ ও সাধারণ প্রশ্ন খুঁজুন।':'Search instructions and questions across all six topics.'}</p>
      </div>
      <div className="public-guide-find-controls">
        <div className="public-guide-search" onClick={()=>searchRef.current?.focus()}>
          <Search size={20} aria-hidden="true"/>
          <label className="sr-only" htmlFor="public-guide-search-input">{bn?'নির্দেশিকা খুঁজুন':'Search the guide'}</label>
          <input id="public-guide-search-input" ref={searchRef} value={search} onChange={event=>setSearch(event.target.value)} placeholder={bn?'কী জানতে চান?':'What do you need help with?'} type="text" role="searchbox" inputMode="search" aria-controls={query?'guide-search-results':undefined}/>
          {search&&<button className="public-guide-clear" type="button" aria-label={bn?'অনুসন্ধান মুছুন':'Clear search'} onClick={()=>{setSearch('');searchRef.current?.focus();}}><X size={18} aria-hidden="true"/></button>}
        </div>
      </div>
    </section>
  </div>
  {query?<section className="public-guide-results" aria-labelledby="guide-results-title" id="guide-search-results">
    <div className="public-guide-results-head">
      <h2 id="guide-results-title">{bn?'অনুসন্ধানের ফল':'Search results'}</h2>
      <p role="status">{bn?`${new Intl.NumberFormat('bn-BD').format(resultCount)}টি ফল পাওয়া গেছে`:`${resultCount} ${resultCount===1?'result':'results'} across all topics`}</p>
    </div>
    {resultCount?results.map(({category,steps,faqs})=><section key={category.id} className="public-guide-result-group" aria-label={bn?category.bn:category.en}>
      <h3>{bn?category.bn:category.en}</h3>
      {steps.map(({step,index,displayDevice})=><div className="public-guide-result-step" key={`step-${index}`}>
        <span className="public-guide-result-label">{bn?`ধাপ ${index+1} · ${displayDevice==='web'?'ওয়েব':'মোবাইল'}`:`Step ${index+1} · ${displayDevice==='web'?'Web':'Mobile'}`}</span>
        <h4>{t(step.title)}</h4>
        <p>{t(step[displayDevice])}</p>
      </div>)}
      {faqs.map(item=><details className="public-guide-result-faq" key={item.q[0]}>
        <summary><span>{t(item.q)}</span><ChevronDown size={18} aria-hidden="true"/></summary>
        <p>{t(item.a)}</p>
      </details>)}
      {actionLinks(category.id)}
    </section>):<div className="public-guide-no-results" role="status">
      <h3>{bn?'কোনো ফল পাওয়া যায়নি':'No results found'}</h3>
      <p>{bn?'অন্য শব্দ দিয়ে খুঁজুন বা অনুসন্ধান মুছে বিষয়গুলো দেখুন।':'Try a different term, or clear the search to browse by topic.'}</p>
      <button className="public-guide-action" type="button" onClick={()=>{setSearch('');searchRef.current?.focus();}}>
        {bn?'অনুসন্ধান মুছুন':'Clear search'}
      </button>
    </div>}
    {officialSource}
  </section>:<div className="public-guide-layout">
    <nav className="public-guide-topics" aria-label={bn?'বিষয় নির্বাচন':'Guide topics'}>
      <h2>{bn?'বিষয় বেছে নিন':'Browse topics'}</h2>
      {GUIDE_CONTENT.map((item,index)=><button type="button" key={item.id} aria-current={selected===item.id?'true':undefined}
        onClick={()=>chooseTopic(item.id)}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{bn?item.bn:item.en}</button>)}
    </nav>
    <article className="public-guide-content" ref={contentRef} tabIndex={-1}>
      <div className="public-guide-content-head">
        <div><p className="citizen-hub-eyebrow">{bn?`বিষয় ${GUIDE_CONTENT.findIndex(x=>x.id===selected)+1} / ৬`:`TOPIC ${GUIDE_CONTENT.findIndex(x=>x.id===selected)+1} OF 6`}</p><h2>{bn?current.bn:current.en}</h2><p>{t(current.description)}</p></div>
      </div>
      <section className="public-guide-instructions" aria-labelledby="guide-steps-title">
        <div className="public-guide-steps-head">
          <div><h3 id="guide-steps-title">{bn?'ধাপে ধাপে করণীয়':'Follow these steps'}</h3><p>{bn?'আপনার ডিভাইস অনুযায়ী নির্দেশনা দেখুন।':'Choose your device to see the right instructions.'}</p></div>
          <div className="public-guide-device" role="group" aria-label={bn?'প্ল্যাটফর্ম':'Platform'}>
            {(['web','mobile'] as const).map((key,i)=><button type="button" key={key} aria-pressed={device===key} onClick={()=>setDevice(key)}>
              {key==='web'?<Monitor size={17}/>:<Smartphone size={17}/>} {labels[i]}
            </button>)}
          </div>
        </div>
        <ol className="public-guide-steps">
          {current.steps.map((step,i)=><li key={i}>
            <span aria-hidden="true">{i+1}</span>
            <div><h4>{t(step.title)}</h4><p>{t(step[device])}</p></div>
          </li>)}
        </ol>
      </section>
      {actionLinks(selected)}
      <section className="public-guide-questions" aria-labelledby="guide-questions-title">
        <div className="public-guide-section-head"><h3 id="guide-questions-title">{bn?'সাধারণ প্রশ্ন':'Common questions'}</h3><p>{bn?'এই বিষয় সম্পর্কে সংক্ষিপ্ত উত্তর।':'Quick answers about this topic.'}</p></div>
        {current.faqs.map(item=><details key={item.q[0]}>
          <summary><span>{t(item.q)}</span><ChevronDown size={18} aria-hidden="true"/></summary><p>{t(item.a)}</p>
        </details>)}
      </section>
      {officialSource}
    </article>
  </div>}
 </div>;
};
