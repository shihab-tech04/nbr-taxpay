import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Search, ChevronDown, ExternalLink, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

type Category = 'payments'|'status'|'travel'|'withholding'|'records'|'security';
type Pair = [string,string];
type Device = 'web'|'mobile';
type GuideStep = {title:Pair;web:Pair;mobile:Pair};
type GuideEntry = {id:Category;en:string;bn:string;description:Pair;steps:GuideStep[];faqs:{q:Pair;a:Pair}[]};

export const GUIDE_CONTENT:GuideEntry[] = [
 {id:'payments',en:'Payment basics',bn:'পেমেন্টের মূল বিষয়',description:['Know what to check before paying.','কর পরিশোধের আগে যা যাচাই করবেন।'],steps:[
  {title:['Choose a payment service','কর পরিশোধের সেবা বাছুন'],web:['On Home, click Pay Tax, select the payment service, then choose Continue.','মূল পাতায় কর পরিশোধ বেছে সেবা নির্বাচন করুন, তারপর এগিয়ে যান চাপুন।'],mobile:['On Home, tap Pay Tax, choose a service card in the mobile dialog, then tap Continue.','মূল পাতায় কর পরিশোধ চাপুন, মোবাইল ডায়ালগে সেবা বেছে এগিয়ে যান চাপুন।']},
  {title:['Enter payer and amount details','করদাতা ও পরিমাণের তথ্য দিন'],web:['Complete payer name, e-TIN, assessment year and zone/circle. Continue to the payment head and amount breakdown.','করদাতার নাম, ই-টিআইএন, করবর্ষ, অঞ্চল ও সার্কেল পূরণ করুন। এরপর পেমেন্ট খাত ও পরিমাণের বিবরণে যান।'],mobile:['Complete Payer & TIN Info, then scroll through Head & Calculation to enter the payment amounts.','করদাতা ও টিআইএন তথ্য পূরণ করে খাত ও হিসাব ধাপে যান। স্ক্রল করে পরিমাণ লিখুন।']},
  {title:['Review the payment summary','পেমেন্টের সারসংক্ষেপ যাচাই করুন'],web:['Check the payment head and total, choose a payment method and run the payment simulation to view its receipt preview.','পেমেন্ট খাত ও মোট অর্থ মিলিয়ে মাধ্যম বাছুন এবং পেমেন্ট সিমুলেশন চালিয়ে রসিদের প্রিভিউ দেখুন।'],mobile:['Review the total on the final screen, run the payment simulation, then inspect the receipt preview.','শেষ স্ক্রিনে মোট অর্থ দেখে পেমেন্ট সিমুলেশন চালান, তারপর রসিদের প্রিভিউ যাচাই করুন।']}
 ],faqs:[
  {q:['What should I check before payment?','পেমেন্টের আগে কী যাচাই করব?'],a:['Taxpayer identity, purpose, year and amount against official guidance.','সরকারি নির্দেশনা অনুযায়ী পরিচয়, উদ্দেশ্য, করবর্ষ ও পরিমাণ।']},
  {q:['Can I make an official payment here?','এখানে কি সরকারি পেমেন্ট করা যায়?'],a:['No. Amar Kor payment processing is not connected to an official gateway.','না। আমার কর সরকারি পেমেন্ট গেটওয়ের সঙ্গে সংযুক্ত নয়।']}
 ]},
 {id:'status',en:'Payment status',bn:'পেমেন্টের অবস্থা',description:['Understand references, receipts and settlement.','রেফারেন্স, রসিদ ও জমার অবস্থা জানুন।'],steps:[
  {title:['Open the receipt lookup','রসিদ অনুসন্ধান খুলুন'],web:['On Home, select Check payment & receipt to open the lookup dialog.','মূল পাতায় পেমেন্ট ও রসিদ যাচাই বেছে অনুসন্ধান ডায়ালগ খুলুন।'],mobile:['On Home, tap Check payment & receipt to open the mobile lookup screen.','মূল পাতায় পেমেন্ট ও রসিদ যাচাই চাপুন এবং মোবাইল অনুসন্ধান স্ক্রিন খুলুন।']},
  {title:['Search by payment reference','পেমেন্ট রেফারেন্স দিয়ে খুঁজুন'],web:['Enter a challan, token or transaction reference and select Search records.','চালান, টোকেন বা লেনদেনের রেফারেন্স লিখে রেকর্ড খুঁজুন চাপুন।'],mobile:['Type the reference into the lookup field, then tap Search records.','অনুসন্ধান ঘরে রেফারেন্স লিখে রেকর্ড খুঁজুন চাপুন।']},
  {title:['Check the lookup result','অনুসন্ধানের ফল যাচাই করুন'],web:['Review matching receipt details. If none is found, use Report a payment issue or contact your provider.','মিলে যাওয়া রসিদের তথ্য দেখুন। না পাওয়া গেলে পেমেন্টের সমস্যা জানান অথবা সেবাদাতার সঙ্গে যোগাযোগ করুন।'],mobile:['Open a matching receipt to inspect it. If the record is missing, follow the payment-issue option.','মিলে যাওয়া রসিদ খুলে দেখুন। রেকর্ড না পেলে পেমেন্টের সমস্যা জানান বিকল্প ব্যবহার করুন।']}
 ],faqs:[
  {q:['Does a receipt confirm tax credit?','রসিদ কি কর ক্রেডিট নিশ্চিত করে?'],a:['No. Tax credit requires legal entitlement and verified reconciliation.','না। কর ক্রেডিটের জন্য আইনগত অধিকার ও যাচাইকৃত সমন্বয় প্রয়োজন।']},
  {q:['Why is my reference not found?','রেফারেন্স পাওয়া যাচ্ছে না কেন?'],a:['This service can search demonstration records only. Check official channels for real transactions.','এখানে শুধু নমুনা রেকর্ড খোঁজা যায়। প্রকৃত লেনদেন সরকারি মাধ্যমে যাচাই করুন।']}
 ]},
 {id:'travel',en:'Travel tax',bn:'ভ্রমণ কর',description:['Review the guest travel-tax workflow.','সাইন ইন ছাড়া ভ্রমণ করের ধাপ দেখুন।'],steps:[
  {title:['Choose your journey','যাত্রার তথ্য বাছুন'],web:['On Home, select Pay travel tax. Choose destination, travel mode and passenger count.','মূল পাতায় ভ্রমণ কর পরিশোধ বেছে গন্তব্য, যাত্রার ধরন ও যাত্রীর সংখ্যা নির্বাচন করুন।'],mobile:['Tap Pay travel tax under payment types, then select the route and passenger count.','পেমেন্টের ধরন অংশে ভ্রমণ কর পরিশোধ চাপুন, তারপর পথ ও যাত্রীর সংখ্যা বাছুন।']},
  {title:['Enter passenger details','যাত্রীর তথ্য দিন'],web:['Continue to passenger details; enter passenger name, passport number, departure port and date.','যাত্রীর তথ্য ধাপে গিয়ে নাম, পাসপোর্ট নম্বর, যাত্রা শুরুর বন্দর ও তারিখ লিখুন।'],mobile:['Tap Continue to passenger details, then complete the passenger and departure fields.','যাত্রীর তথ্য ধাপে এগিয়ে গিয়ে যাত্রী ও যাত্রা শুরুর তথ্য পূরণ করুন।']},
  {title:['Review the travel summary','ভ্রমণের সারসংক্ষেপ দেখুন'],web:['Continue to review, check the amount summary and run the payment simulation to see the result.','পর্যালোচনায় গিয়ে মোট অর্থ যাচাই করে পেমেন্ট সিমুলেশন চালিয়ে ফলাফল দেখুন।'],mobile:['Review the amount on the final screen, then run the payment simulation and inspect its result.','শেষ স্ক্রিনে অর্থ যাচাই করে পেমেন্ট সিমুলেশন চালান এবং ফলাফল দেখুন।']}
 ],faqs:[
  {q:['Can I pay travel tax without an account?','অ্যাকাউন্ট ছাড়া ভ্রমণ কর দেওয়া যাবে?'],a:['The guest workflow is available, but the official payment gateway is not connected. No real payment is processed.','সাইন ইন ছাড়া নমুনা কার্যপ্রবাহ দেখা যায়, তবে সরকারি পেমেন্ট সংযুক্ত নয়।']},
  {q:['Are the rates final?','দেখানো হার কি চূড়ান্ত?'],a:['No. Rates and exemptions must be checked against the currently applicable official law.','না। বর্তমান প্রযোজ্য সরকারি আইন অনুযায়ী হার ও অব্যাহতি যাচাই করতে হবে।']}
 ]},
 {id:'withholding',en:'Withholding tax',bn:'উৎসে কর',description:['Understand deductor and taxpayer records.','কর্তনকারী ও করদাতার রেকর্ড বুঝুন।'],steps:[
  {title:['Select Source Tax Deposit','উৎসে কর জমা সেবা বাছুন'],web:['Open Pay Tax, select Source Tax Deposit and choose Continue.','কর পরিশোধ খুলে উৎসে কর জমা বেছে এগিয়ে যান চাপুন।'],mobile:['Tap Pay Tax, choose the Source Tax Deposit service card and continue.','কর পরিশোধ চাপুন, উৎসে কর জমা সেবা বেছে এগিয়ে যান।']},
  {title:['Identify payer and deductee','পরিশোধকারী ও কর কর্তনগ্রহীতা শনাক্ত করুন'],web:['Enter payer e-TIN and assessment year, plus deductee TIN and entity details.','পরিশোধকারীর ই-টিআইএন, করবর্ষ এবং কর কর্তনগ্রহীতার টিআইএন ও প্রতিষ্ঠানের তথ্য দিন।'],mobile:['Complete the payer fields, then scroll to Deductee Particulars to enter beneficiary details.','পরিশোধকারীর তথ্য দিন, তারপর স্ক্রল করে কর কর্তনগ্রহীতার তথ্য পূরণ করুন।']},
  {title:['Choose head and review amounts','খাত বেছে পরিমাণ যাচাই করুন'],web:['Select a payment head, enter the amount breakdown and review the payment summary.','পেমেন্ট খাত বেছে পরিমাণের বিবরণ লিখুন এবং সারসংক্ষেপ যাচাই করুন।'],mobile:['Continue to Head & Calculation, enter amounts, then review the final summary.','খাত ও হিসাব ধাপে পরিমাণ লিখে শেষ সারসংক্ষেপ যাচাই করুন।']}
 ],faqs:[{q:['Does a withholding deposit belong to the agent as credit?','উৎসে কর জমা কি এজেন্টের নিজের ক্রেডিট?'],a:['Not automatically. The deductee, period and verified ownership govern any credit.','স্বয়ংক্রিয়ভাবে নয়। কর কর্তনগ্রহীতা, সময়কাল ও যাচাইকৃত মালিকানা প্রযোজ্য।']}]},
 {id:'records',en:'Receipts & corrections',bn:'রসিদ ও সংশোধন',description:['Keep evidence and handle differences.','প্রমাণ রাখুন এবং অমিল সমাধান করুন।'],steps:[
  {title:['Find the payment record','পেমেন্ট রেকর্ড খুঁজুন'],web:['Choose Check payment & receipt on Home and enter your reference in the lookup.','মূল পাতার পেমেন্ট ও রসিদ যাচাই বেছে অনুসন্ধানে রেফারেন্স লিখুন।'],mobile:['Tap Check payment & receipt and search using the saved challan or transaction reference.','পেমেন্ট ও রসিদ যাচাই চাপুন এবং সংরক্ষিত চালান বা লেনদেন রেফারেন্স দিয়ে খুঁজুন।']},
  {title:['Compare the receipt details','রসিদের তথ্য মিলিয়ে দেখুন'],web:['Open the matching receipt and compare payer, payment category, year and total.','মিলে যাওয়া রসিদ খুলে করদাতা, পরিশোধের ধরন, করবর্ষ ও মোট অর্থ মিলিয়ে দেখুন।'],mobile:['Review the receipt fields on screen and keep its reference for follow-up.','স্ক্রিনে রসিদের তথ্য যাচাই করুন এবং পরবর্তী কাজের জন্য রেফারেন্স রাখুন।']},
  {title:['Handle a missing or incorrect record','রেকর্ড না পাওয়া গেলে বা ভুল থাকলে'],web:['If no record matches, select Report a payment issue. Use an authorized service for actual challan corrections.','রেকর্ড না পেলে পেমেন্টের সমস্যা জানান বাছুন। প্রকৃত চালান সংশোধনে অনুমোদিত সেবা ব্যবহার করুন।'],mobile:['Use Report a payment issue from the result screen; contact your provider for actual transaction issues.','ফলাফল থেকে পেমেন্টের সমস্যা জানান চাপুন; প্রকৃত লেনদেনের সমস্যায় সেবাদাতার সঙ্গে যোগাযোগ করুন।']}
 ],faqs:[{q:['Can I edit an official challan here?','এখানে কি সরকারি চালান সংশোধন করা যায়?'],a:['No. Official challans require the applicable authorized correction process.','না। সরকারি চালানের ক্ষেত্রে অনুমোদিত সংশোধন প্রক্রিয়া প্রয়োজন।']}]},
 {id:'security',en:'Security & support',bn:'নিরাপত্তা ও সহায়তা',description:['Recognize errors and report problems.','সমস্যা শনাক্ত করে অভিযোগ জানান।'],steps:[
  {title:['Record the issue','সমস্যার তথ্য রাখুন'],web:['Keep the transaction reference, amount and a note about where the problem occurred.','লেনদেন রেফারেন্স, পরিমাণ এবং কোন ধাপে সমস্যা হয়েছে তা লিখে রাখুন।'],mobile:['Keep the payment reference and a short description of the issue.','পেমেন্ট রেফারেন্স এবং সমস্যার সংক্ষিপ্ত বিবরণ রাখুন।']},
  {title:['Check the payment status','পেমেন্টের অবস্থা যাচাই করুন'],web:['Use Check payment & receipt to look up the record. Contact your bank or provider if money was debited.','পেমেন্ট ও রসিদ যাচাই দিয়ে রেকর্ড খুঁজুন। অর্থ কেটে গেলে ব্যাংক বা সেবাদাতার সঙ্গে যোগাযোগ করুন।'],mobile:['Use receipt lookup on Home, then contact your provider if the transaction is missing.','মূল পাতায় রসিদ অনুসন্ধান ব্যবহার করুন। লেনদেন না পাওয়া গেলে সেবাদাতার সঙ্গে যোগাযোগ করুন।']},
  {title:['Review the report form','সমস্যার ফর্ম পর্যালোচনা করুন'],web:['Open Report from the navigation, choose an issue type and enter a short description to review the form.','নেভিগেশন থেকে অভিযোগ খুলে সমস্যার ধরন ও সংক্ষিপ্ত বিবরণ লিখে ফর্ম পর্যালোচনা করুন।'],mobile:['Open Report from the mobile menu, select the issue type and review your description.','মোবাইল মেনু থেকে অভিযোগ খুলে সমস্যার ধরন বাছুন এবং বিবরণ পর্যালোচনা করুন।']}
 ],faqs:[{q:['What if money was debited but I received no challan?','অর্থ কাটা গেছে কিন্তু চালান পাইনি?'],a:['Contact the bank or gateway and verify the transaction with an official service.','ব্যাংক বা গেটওয়ের সঙ্গে যোগাযোগ করে সরকারি মাধ্যমে যাচাই করুন।']}]}
];

export const PublicUserGuide:React.FC=()=>{
 const {language,routeParams,navigate}=useTaxState();
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
      <h1>{bn?'আমার কর ব্যবহার নির্দেশিকা':'Amar Kor user guide'}</h1>
      <p>{bn?'পেমেন্টের ধাপ, রসিদ ও সাধারণ প্রশ্ন।':'Clear steps, payment references and common questions.'}</p>
    </header>
    <section className="public-guide-find" aria-labelledby="guide-search-title">
      <div className="public-guide-find-copy">
        <h2 id="guide-search-title">{bn?'উত্তর খুঁজুন':'Find an answer'}</h2>
        <p>{bn?'ছয়টি বিষয়ের ধাপ ও সাধারণ প্রশ্ন খুঁজুন।':'Search instructions and questions across all six topics.'}</p>
      </div>
      <div className="public-guide-find-controls">
        <label className="public-guide-search"><Search size={20} aria-hidden="true"/><span className="sr-only">{bn?'নির্দেশিকা খুঁজুন':'Search the guide'}</span>
          <input value={search} onChange={event=>setSearch(event.target.value)} placeholder={bn?'কী জানতে চান?':'What do you need help with?'} type="search"/>
        </label>
        {query&&<button className="public-guide-clear" type="button" onClick={()=>setSearch('')}><X size={16} aria-hidden="true"/>{bn?'মুছুন':'Clear'}</button>}
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
