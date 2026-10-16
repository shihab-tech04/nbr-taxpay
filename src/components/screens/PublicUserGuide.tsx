import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Monitor, Smartphone, Search, ChevronDown, ExternalLink } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

type Category = 'payments'|'status'|'travel'|'withholding'|'records'|'security';
type GuideEntry = {id:Category;en:string;bn:string;description:[string,string];steps:[[string,string],[string,string],[string,string]];faqs:{q:[string,string];a:[string,string]}[]};

export const GUIDE_CONTENT:GuideEntry[] = [
 {id:'payments',en:'Payment basics',bn:'পেমেন্টের মূল বিষয়',description:['Know what to check before paying.','কর পরিশোধের আগে যা যাচাই করবেন।'],steps:[
  ['Check taxpayer identity and tax year.','করদাতার পরিচয় ও করবর্ষ যাচাই করুন।'],
  ['Choose the applicable payment purpose.','প্রযোজ্য পেমেন্টের উদ্দেশ্য বাছুন।'],
  ['Keep the transaction reference.','লেনদেনের রেফারেন্স রাখুন।']
 ],faqs:[
  {q:['What should I check before payment?','পেমেন্টের আগে কী যাচাই করব?'],a:['Taxpayer identity, purpose, year and amount against official guidance.','সরকারি নির্দেশনা অনুযায়ী পরিচয়, উদ্দেশ্য, করবর্ষ ও পরিমাণ।']},
  {q:['Can I make an official payment here?','এখানে কি সরকারি পেমেন্ট করা যায়?'],a:['No. TaxPay payment processing is not connected to an official gateway.','না। TaxPay সরকারি পেমেন্ট গেটওয়ের সঙ্গে সংযুক্ত নয়।']}
 ]},
 {id:'status',en:'Payment status',bn:'পেমেন্টের অবস্থা',description:['Understand references, receipts and settlement.','রেফারেন্স, রসিদ ও জমার অবস্থা জানুন।'],steps:[
  ['Have your saved transaction reference ready.','সংরক্ষিত লেনদেনের রেফারেন্স প্রস্তুত রাখুন।'],
  ['Use the public status lookup.','পাবলিক স্ট্যাটাস অনুসন্ধান ব্যবহার করুন।'],
  ['Verify any official settlement separately.','সরকারি জমার অবস্থা আলাদাভাবে যাচাই করুন।']
 ],faqs:[
  {q:['Does a receipt confirm tax credit?','রসিদ কি কর ক্রেডিট নিশ্চিত করে?'],a:['No. Tax credit requires legal entitlement and verified reconciliation.','না। কর ক্রেডিটের জন্য আইনগত অধিকার ও যাচাইকৃত সমন্বয় প্রয়োজন।']},
  {q:['Why is my reference not found?','রেফারেন্স পাওয়া যাচ্ছে না কেন?'],a:['This service can search demonstration records only. Check official channels for real transactions.','এখানে শুধু নমুনা রেকর্ড খোঁজা যায়। প্রকৃত লেনদেন সরকারি মাধ্যমে যাচাই করুন।']}
 ]},
 {id:'travel',en:'Travel tax',bn:'ভ্রমণ কর',description:['Review the guest travel-tax workflow.','সাইন ইন ছাড়া ভ্রমণ করের ধাপ দেখুন।'],steps:[
  ['Select the journey and review the rules.','যাত্রার ধরন বেছে নিয়ে নিয়ম দেখুন।'],
  ['Enter example passenger details.','নমুনা যাত্রীর তথ্য দিন।'],
  ['Review the demonstration result.','নমুনা ফলাফল দেখুন।']
 ],faqs:[
  {q:['Can I pay travel tax without an account?','অ্যাকাউন্ট ছাড়া ভ্রমণ কর দেওয়া যাবে?'],a:['The guest workflow is available, but the official payment gateway is not connected. No real payment is processed.','সাইন ইন ছাড়া নমুনা কার্যপ্রবাহ দেখা যায়, তবে সরকারি পেমেন্ট সংযুক্ত নয়।']},
  {q:['Are the rates final?','দেখানো হার কি চূড়ান্ত?'],a:['No. Rates and exemptions must be checked against the currently applicable official law.','না। বর্তমান প্রযোজ্য সরকারি আইন অনুযায়ী হার ও অব্যাহতি যাচাই করতে হবে।']}
 ]},
 {id:'withholding',en:'Withholding tax',bn:'উৎসে কর',description:['Understand deductor and taxpayer records.','কর্তনকারী ও করদাতার রেকর্ড বুঝুন।'],steps:[
  ['Identify the person deducting tax.','কর কর্তনকারী শনাক্ত করুন।'],
  ['Check the relevant payment year and purpose.','প্রযোজ্য করবর্ষ ও উদ্দেশ্য যাচাই করুন।'],
  ['Reconcile deductee ownership and evidence.','কর কর্তনগ্রহীতার তথ্য ও প্রমাণ মিলিয়ে নিন।']
 ],faqs:[{q:['Does a withholding deposit belong to the agent as credit?','উৎসে কর জমা কি এজেন্টের নিজের ক্রেডিট?'],a:['Not automatically. The deductee, period and verified ownership govern any credit.','স্বয়ংক্রিয়ভাবে নয়। কর কর্তনগ্রহীতা, সময়কাল ও যাচাইকৃত মালিকানা প্রযোজ্য।']}]},
 {id:'records',en:'Receipts & corrections',bn:'রসিদ ও সংশোধন',description:['Keep evidence and handle differences.','প্রমাণ রাখুন এবং অমিল সমাধান করুন।'],steps:[
  ['Save payment or challan references.','পেমেন্ট বা চালান রেফারেন্স রাখুন।'],
  ['Compare the taxpayer and payment details.','করদাতা ও পেমেন্টের তথ্য মিলিয়ে দেখুন।'],
  ['Use the authorized correction channel.','অনুমোদিত সংশোধন মাধ্যম ব্যবহার করুন।']
 ],faqs:[{q:['Can I edit an official challan here?','এখানে কি সরকারি চালান সংশোধন করা যায়?'],a:['No. Official challans require the applicable authorized correction process.','না। সরকারি চালানের ক্ষেত্রে অনুমোদিত সংশোধন প্রক্রিয়া প্রয়োজন।']}]},
 {id:'security',en:'Security & support',bn:'নিরাপত্তা ও সহায়তা',description:['Recognize errors and report problems.','সমস্যা শনাক্ত করে অভিযোগ জানান।'],steps:[
  ['Keep bank and payment references.','ব্যাংক ও পেমেন্টের রেফারেন্স রাখুন।'],
  ['Check the transaction with the provider.','সেবাদাতার মাধ্যমে লেনদেন যাচাই করুন।'],
  ['Report suspicious activity through verified channels.','নিরাপত্তা সমস্যা যাচাইকৃত মাধ্যমে জানান।']
 ],faqs:[{q:['What if money was debited but I received no challan?','অর্থ কাটা গেছে কিন্তু চালান পাইনি?'],a:['Contact the bank or gateway and verify the transaction with an official service.','ব্যাংক বা গেটওয়ের সঙ্গে যোগাযোগ করে সরকারি মাধ্যমে যাচাই করুন।']}]}
];

export const PublicUserGuide:React.FC=()=>{
 const {language,routeParams,navigate}=useTaxState();
 const bn=language==='bn';
 const t=(pair:[string,string])=>pair[bn?1:0];
 const initial=GUIDE_CONTENT.some(x=>x.id===routeParams.category)?routeParams.category:'payments';
 const [selected,setSelected]=useState<Category>(initial);
 useEffect(()=>{
   setSelected(GUIDE_CONTENT.some(x=>x.id===routeParams.category) ? routeParams.category as Category : 'payments');
   setSearch('');
 },[routeParams]);
 const [search,setSearch]=useState('');
 const [device,setDevice]=useState<'web'|'mobile'>('web');
 const current=GUIDE_CONTENT.find(x=>x.id===selected)!;
 const matches=current.faqs.filter(x=>(x.q.join(' ')+x.a.join(' ')).toLowerCase().includes(search.trim().toLowerCase()));
 const labels=bn?['ওয়েব','মোবাইল']:['Web','Mobile'];
 return <div className={'public-guide-page '+(bn?'font-bengali':'')}>
  <button className="public-guide-back" type="button" onClick={()=>navigate('landing')}><ArrowLeft size={17}/>{bn?'হোমে ফিরুন':'Back to home'}</button>
  <header className="public-guide-intro">
    <p className="citizen-hub-eyebrow">{bn?'সহায়তা কেন্দ্র':'Help center'}</p>
    <h1>{bn?'TaxPay ব্যবহার নির্দেশিকা':'TaxPay user guide'}</h1>
    <p>{bn?'পেমেন্টের ধাপ, রসিদ ও সাধারণ প্রশ্ন।':'Clear steps, payment references and common questions.'}</p>
  </header>
  <div className="public-guide-layout">
    <nav className="public-guide-topics" aria-label={bn?'বিষয় নির্বাচন':'Guide topics'}>
      <h2>{bn?'বিষয়':'Topics'}</h2>
      {GUIDE_CONTENT.map(item=><button type="button" key={item.id} aria-current={selected===item.id?'true':undefined}
        onClick={()=>{setSelected(item.id);setSearch('');navigate('user_guide',{category:item.id});}}>{bn?item.bn:item.en}</button>)}
    </nav>
    <article className="public-guide-content">
      <div className="public-guide-content-head">
        <div><p className="citizen-hub-eyebrow">{bn?'ধাপে ধাপে':'Step by step'}</p><h2>{bn?current.bn:current.en}</h2><p>{t(current.description)}</p></div>
        <BookOpen size={26} aria-hidden="true"/>
      </div>
      <div className="public-guide-device" role="group" aria-label={bn?'প্ল্যাটফর্ম':'Platform'}>
        {(['web','mobile'] as const).map((key,i)=><button type="button" key={key} aria-pressed={device===key} onClick={()=>setDevice(key)}>
          {key==='web'?<Monitor size={17}/>:<Smartphone size={17}/>} {labels[i]}
        </button>)}
      </div>
      <ol className="public-guide-steps">
        {current.steps.map((step,i)=><li key={i}><span>{i+1}</span><p>{t(step)}</p></li>)}
      </ol>
      <p className="public-guide-context">{device==='mobile'?(bn?'মোবাইলে একই ধাপ ব্যবহার করুন।':'Use the same steps on mobile.'):(bn?'ওয়েবে একই ধাপ ব্যবহার করুন।':'Use these steps on the website.')}</p>
      <section className="public-guide-questions" aria-labelledby="guide-questions-title">
        <div className="public-guide-section-head"><div><h3 id="guide-questions-title">{bn?'সাধারণ প্রশ্ন':'Frequently asked questions'}</h3><p>{bn?'সংক্ষিপ্ত উত্তর':'Quick answers'}</p></div></div>
        <label className="public-guide-search"><Search size={18} aria-hidden="true"/><span className="sr-only">{bn?'প্রশ্ন খুঁজুন':'Search questions'}</span>
          <input value={search} onChange={event=>setSearch(event.target.value)} placeholder={bn?'প্রশ্ন খুঁজুন':'Search questions'} type="search"/>
        </label>
        {matches.length?matches.map(item=><details key={item.q[0]}>
          <summary>{t(item.q)}<ChevronDown size={17} aria-hidden="true"/></summary><p>{t(item.a)}</p>
        </details>):<p role="status">{bn?'কোনো প্রশ্ন পাওয়া যায়নি।':'No matching questions.'}</p>}
      </section>
      <div className="public-guide-source"><p>{bn?'আইনি হার বা শর্ত জানতে বর্তমান সরকারি তথ্য দেখুন।':'Check current official sources for legal rates and requirements.'}</p>
        <a href="https://nbr.gov.bd/" rel="noopener noreferrer" target="_blank">{bn?'এনবিআর প্রকাশনা':'NBR publications'}<ExternalLink size={14}/></a>
      </div>
    </article>
  </div>
 </div>;
};
