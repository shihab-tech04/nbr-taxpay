import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Search, ChevronDown, ExternalLink, X, ArrowRight } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import '../../styles/public-guide-actions.css';

import { GUIDE_CONTENT, type Category, type Pair } from '../../data/publicGuideContent';
export { GUIDE_CONTENT } from '../../data/publicGuideContent';
type Device = 'web'|'mobile';
type GuideAction={id:string;label:Pair;run?:()=>void;href?:string};

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
 const [device,setDevice]=useState<'web'|'mobile'>('web');
 const contentRef=useRef<HTMLElement>(null);
 const searchRef=useRef<HTMLInputElement>(null);
 const chooseTopic=(id:Category)=>{
   setSelected(id);
   navigate('user_guide',{category:id});
   // Topic changes should take the reader to the new instructions, not back to the page hero.
   window.requestAnimationFrame(()=>contentRef.current?.scrollIntoView({block:'start',behavior:'instant'}));
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
 const actionsFor=(category:Category):GuideAction[]=>{
  if(category==='travel') return [{id:'travel',label:['Pay Travel Tax','ভ্রমণ কর পরিশোধ করুন'],run:()=>openPaymentServiceChoice('TRAVEL_TAX')}];
  if(category==='status'||category==='records') return [{id:'records',label:['Find a payment record','পেমেন্ট রেকর্ড খুঁজুন'],run:()=>navigate('verify')}];
  if(category==='withholding') return [{id:'withholding',label:['Start source tax deposit','উৎসে কর জমা শুরু করুন'],run:()=>openPaymentServiceChoice('SOURCE_TAX_DEPOSIT')}];
  if(category==='security') return [
   {id:'support',label:['Report a payment issue','পেমেন্টের সমস্যা জানান'],run:()=>navigate('incident')},
   {id:'nbr-support',label:['NBR e-Return support','এনবিআর ই-রিটার্ন সহায়তা'],href:bn?'https://nbr.gov.bd/all-faq/ban':'https://nbr.gov.bd/all-faq/eng'},
   {id:'nbr-terms',label:['NBR VAT Portal terms (English)','NBR VAT Portal-এর ব্যবহারের শর্ত (ইংরেজি)'],href:'https://nbr.gov.bd/terms-of-use/eng'},
   {id:'nbr-privacy',label:['NBR VAT Portal privacy policy (English)','NBR VAT Portal-এর গোপনীয়তা নীতি (ইংরেজি)'],href:'https://nbr.gov.bd/privacy-policy/eng'}
  ];
  const actions=[{id:'payment',label:['Open payment services','পরিশোধ সেবাসমূহ খুলুন'] as Pair,run:()=>openPaymentServiceChoice()}];
  if(category==='payments') actions.push({id:'glossary',label:['Browse tax terms','কর বিষয়ক শব্দ দেখুন'] as Pair,run:()=>navigate('glossary')});
  return actions;
 };
 const actionLinks=(category:Category)=><div className="public-guide-actions" role="group" aria-label={bn?'সম্পর্কিত সেবা':'Related services'}>
  {actionsFor(category).map((action,index)=>action.href
   ?<a key={action.id} href={action.href} target="_blank" rel="noopener noreferrer" className={index===0?'public-guide-action-primary':'public-guide-action-link'}>
     {t(action.label)}<ExternalLink size={16} aria-hidden="true"/>
    </a>
   :<button key={action.id} type="button" className={index===0?'public-guide-action-primary':'public-guide-action-link'} onClick={action.run}>
     {t(action.label)}<ArrowRight size={16} aria-hidden="true"/>
    </button>)}
 </div>;
 const officialSource=<aside className="public-guide-source" aria-label={bn?'সরকারি তথ্যের উৎস':'Official information'}>
   <div className="public-guide-source-copy">
     <h3>{bn?'সরকারি তথ্য':'Official information'}</h3>
     <p>{bn?'বর্তমান করহার ও প্রযোজ্য শর্ত যাচাই করতে এনবিআরের প্রকাশনা দেখুন।':'For current tax rates and requirements, refer to NBR publications.'}</p>
   </div>
   <a href="https://nbr.gov.bd/" rel="noopener noreferrer" target="_blank">{bn?'এনবিআর প্রকাশনা':'NBR publications'}<ExternalLink size={16} aria-hidden="true"/></a>
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
          <input id="public-guide-search-input" ref={searchRef} value={search} onChange={event=>setSearch(event.target.value)} placeholder={bn?'কী জানতে চান?':'What do you need help with?'} type="text" role="searchbox" inputMode="search"/>
          {search&&<button className="public-guide-clear" type="button" aria-label={bn?'অনুসন্ধান মুছুন':'Clear search'} onClick={()=>{setSearch('');searchRef.current?.focus();}}><X size={18} aria-hidden="true"/></button>}
        </div>
      </div>
    </section>
  </div>
  {query?<section className="public-guide-results" aria-labelledby="guide-results-title" id="guide-search-results">
    <div className="public-guide-results-head">
      <h2 id="guide-results-title">{bn?'অনুসন্ধানের ফল':'Search results'}</h2>
      <p role="status">{bn?`${resultCount}টি ফল পাওয়া গেছে`:`${resultCount} ${resultCount===1?'result':'results'} across all topics`}</p>
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
    </div>}
    {officialSource}
  </section>:<div className="public-guide-layout">
    <nav className="public-guide-topics" aria-label={bn?'বিষয় নির্বাচন':'Guide topics'}>
      <h2>{bn?'বিষয় বেছে নিন':'Browse topics'}</h2>
      {GUIDE_CONTENT.map((item,index)=><button type="button" key={item.id} aria-current={selected===item.id?'true':undefined}
        onClick={()=>chooseTopic(item.id)}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{bn?item.bn:item.en}</button>)}
    </nav>
    <article className="public-guide-content" ref={contentRef}>
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
