import React, {useState} from 'react';
import {ArrowRight, Check, Clipboard, Download, Info} from 'lucide-react';
import {DEMO_USERS} from '../../data/demoUsers';
import {
  USER1_FICTIONAL_TIN_PROFILE as record,
  user1FictionalTinValue as value,
} from '../../data/user1FictionalTinProfile';
import type {TaxpayerTinField} from '../../contracts/taxpayerTinProfile';

type Language='en'|'bn';
type Tab='overview'|'registration';
type Label=readonly [string,string];
type Row=readonly [TaxpayerTinField,Label];

const identityRows:readonly Row[]=[
  ['taxpayerName',['Registered name','নিবন্ধিত নাম']],
  ['taxpayerStatus',['Taxpayer class','করদাতার শ্রেণি']],
  ['tinType',['TIN type','টিআইএন ধরন']],
  ['tinSubtype',['TIN classification','টিআইএন শ্রেণি']],
  ['userType',['User type','ব্যবহারকারীর ধরন']],
  ['localTaxpayer',['Local taxpayer','স্থানীয় করদাতা']],
];
const jurisdictionRows:readonly Row[]=[
  ['taxesCircle',['Taxes circle','কর সার্কেল']],
  ['taxesZone',['Taxes zone','কর অঞ্চল']],
  ['taxesRange',['Taxes range','কর রেঞ্জ']],
  ['district',['District','জেলা']],
  ['country',['Country','দেশ']],
];
const registrationRows:readonly Row[]=[
  ['registeredOn',['TIN registration date','টিআইএন নিবন্ধনের তারিখ']],
  ['previousTin',['Previous TIN','পূর্ববর্তী টিআইএন']],
  ['registeredAddress',['Registered / permanent address','নিবন্ধিত / স্থায়ী ঠিকানা']],
  ['currentAddress',['Current address','বর্তমান ঠিকানা']],
];
const certificateRows:readonly Row[]=[
  ['certificateIssuedOn',['Certificate issue date','সনদ ইস্যুর তারিখ']],
  ['certificateLastUpdatedOn',['Certificate last updated','সনদ সর্বশেষ হালনাগাদ']],
  ['issuingOfficer',['Issuing tax officer','সনদ ইস্যুকারী কর কর্মকর্তা']],
  ['taxOfficeAddress',['Tax office address','কর অফিসের ঠিকানা']],
  ['taxOfficePhone',['Tax office phone','কর অফিসের ফোন']],
  ['lastLoginAt',['Last account login','অ্যাকাউন্টে সর্বশেষ লগইন']],
];
const contactRows:readonly Row[]=[
  ['mobileNumber',['Mobile number','মোবাইল নম্বর']],
  ['emailAddress',['Email address','ইমেইল ঠিকানা']],
];
const allRows:readonly Row[]=[['tin',['TIN number','টিআইএন নম্বর']],...identityRows,...jurisdictionRows,...registrationRows,...contactRows,...certificateRows];

export function User1TaxpayerProfile({language,onNavigate}:{
  language:Language;
  onNavigate:(route:string)=>void;
}){
  const bn=language==='bn';
  const tr=(pair:Label)=>pair[bn?1:0];
  const [tab,setTab]=useState<Tab>('overview');
  const [copied,setCopied]=useState<'idle'|'done'|'failed'>('idle');
  const [downloadError,setDownloadError]=useState(false);
  const sampleTin=DEMO_USERS.user1.tin;
  const details=(rows:readonly Row[])=><dl className="divide-y divide-taxpay-border">
    {rows.map(([field,label])=><div key={field} className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-normal text-taxpay-muted">{tr(label)}</dt>
      <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-taxpay-text">{value(field,language)}</dd>
    </div>)}
  </dl>;
  const panel=(title:Label,children:React.ReactNode)=><section className="min-w-0 rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
    <h3 className="mb-4 border-b border-taxpay-border pb-3 text-base font-semibold text-taxpay-text">{tr(title)}</h3>
    {children}
  </section>;
  const copyTin=async()=>{
    setCopied('idle');
    try {
      await navigator.clipboard.writeText(sampleTin);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };
  const exportSample=()=>{
    setDownloadError(false);
    try {
      const safe=(input:string)=>{
        const escaped=/^[=+\-@\t\r]/.test(input)?"'"+input:input;
        return '"'+escaped.replaceAll('"','""')+'"';
      };
      const rows=[['Field','Sample value'],
        ['Account','user1'],...allRows.map(([field,label])=>[label[0],String(record[field])]),
        ['Income sources','Salary, bank interest and consultancy'],
        ['Assessment years','2025-2026, 2024-2025, 2023-2024'],
        ['Representative mandate','Not applicable'],
        ['Record source','FICTIONAL SAMPLE - NOT AN NBR CERTIFICATE'],
      ];
      const csv='\uFEFF'+rows.map(line=>line.map(safe).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='Korbritto-user1-fictional-profile.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
    }
  };
  const tabButton=(next:Tab,label:Label)=>{
    const active=tab===next;
    return <button type="button" key={next} role="tab" id={'user1-profile-tab-'+next}
      aria-selected={active} aria-controls={'user1-profile-panel-'+next} tabIndex={active?0:-1}
      onClick={()=>setTab(next)}
      onKeyDown={event=>{
        if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
          event.preventDefault();
          const target:Tab=tab==='overview'?'registration':'overview';
          setTab(target);
          requestAnimationFrame(()=>document.getElementById('user1-profile-tab-'+target)?.focus());
        }
      }}
      className={'min-h-11 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary '+
        (active?'border-taxpay-primary text-taxpay-primary':'border-transparent text-taxpay-muted hover:text-taxpay-text')}>
      {tr(label)}
    </button>;
  };
  return <div data-testid="user1-taxpayer-profile" className="space-y-4" aria-label={tr(['Taxpayer profile','করদাতার প্রোফাইল'])}>
    <section className="overflow-hidden rounded-2xl border border-taxpay-border bg-white">
      <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-6">
        <div className="flex w-full min-w-0 items-start gap-4 sm:w-auto sm:flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-taxpay-light text-lg font-semibold text-taxpay-primary" aria-hidden="true">AR</div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="rounded-md bg-taxpay-light px-2.5 py-1 text-xs font-medium text-taxpay-primary">
                {tr(['Fictional sample profile','কাল্পনিক নমুনা প্রোফাইল'])}
              </span>
              <span className="text-xs text-taxpay-muted">{tr(['Account','অ্যাকাউন্ট'])}: user1</span>
            </div>
            <h2 className="break-words text-xl font-semibold leading-snug text-taxpay-text sm:text-2xl">
              {bn?DEMO_USERS.user1.nameBn:DEMO_USERS.user1.nameEn}
            </h2>
          </div>
        </div>
        <button type="button" onClick={exportSample}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light sm:w-auto">
          <Download size={17} aria-hidden="true"/>{tr(['Download sample profile','নমুনা প্রোফাইল ডাউনলোড'])}
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-taxpay-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm text-taxpay-muted">{tr(['Sample TIN / payment reference','নমুনা টিআইএন / পেমেন্ট রেফারেন্স'])}</p>
          <p className="mt-1 break-all text-xl font-semibold tracking-wide text-taxpay-text sm:text-2xl" data-testid="user1-profile-tin">{sampleTin}</p>
          <p className="mt-1 text-xs text-taxpay-muted">{tr(['Not an NBR-issued TIN','এনবিআর থেকে ইস্যুকৃত টিআইএন নয়'])}</p>
        </div>
        <button type="button" onClick={copyTin} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light">
          {copied==='done'?<Check size={16} aria-hidden="true"/>:<Clipboard size={16} aria-hidden="true"/>}
          {copied==='done'?tr(['Copied','কপি হয়েছে']):tr(['Copy reference','রেফারেন্স কপি করুন'])}
        </button>
      </div>
      {copied==='failed'&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Could not copy. Select and copy the reference manually.','কপি করা যায়নি। রেফারেন্স নির্বাচন করে কপি করুন।'])}</p>}
      {downloadError&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Download failed. Please retry.','ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'])}</p>}
      <div className="grid border-t border-taxpay-border sm:grid-cols-3">
        {([
          [tr(['TIN type','টিআইএন ধরন']),value('tinType',language)],
          [tr(['Taxes circle','কর সার্কেল']),value('taxesCircle',language)],
          [tr(['Registered since','নিবন্ধিত হওয়ার তারিখ']),value('registeredOn',language)]
        ] as const).map(([label,text])=><div key={label} className="min-w-0 border-b border-taxpay-border px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:last:border-r-0">
          <p className="text-xs text-taxpay-muted">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-taxpay-text">{text}</p>
        </div>)}
      </div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav role="tablist" aria-label={tr(['Profile sections','প্রোফাইলের বিভাগ'])}
        className="flex max-w-full gap-1 overflow-x-auto border-b border-taxpay-border">
        {tabButton('overview',['Overview','সংক্ষিপ্ত বিবরণ'])}
        {tabButton('registration',['TIN & certificate','টিআইএন ও সনদ'])}
      </nav>
      <button type="button" onClick={()=>onNavigate('history')}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light">
        {tr(['View payment activity','পেমেন্টের কার্যক্রম দেখুন'])}<ArrowRight size={16} aria-hidden="true"/>
      </button>
    </div>
    {tab==='overview'?<div role="tabpanel" id="user1-profile-panel-overview"
      aria-labelledby="user1-profile-tab-overview" tabIndex={0}>
      <div className="grid items-start gap-4 lg:grid-cols-2" data-testid="user1-profile-detail-columns">
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['Personal information','ব্যক্তিগত তথ্য'],details(identityRows.slice(0,4)))}
          {panel(['Tax registration','কর নিবন্ধন'],details(jurisdictionRows.slice(0,4)))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['Contact information','যোগাযোগের তথ্য'],<>
            {details(contactRows)}
            <div className="mt-4 border-t border-taxpay-border pt-4">
              <p className="text-sm font-normal text-taxpay-muted">{tr(['Current address','বর্তমান ঠিকানা'])}</p>
              <p className="mt-1 break-words text-sm font-medium leading-relaxed text-taxpay-text">{value('currentAddress',language)}</p>
            </div>
          </>)}
          {panel(['Account and tax history','অ্যাকাউন্ট ও কর ইতিহাস'],<dl className="divide-y divide-taxpay-border">
            {([
              [tr(['Income sources','আয়ের উৎস']),tr(['Salary, bank interest and consultancy','বেতন, ব্যাংক সুদ ও পরামর্শ সেবা'])],
              [tr(['Assessment years','করবর্ষ']),'2025-2026, 2024-2025, 2023-2024'],
              [tr(['Representative mandate','প্রতিনিধির অনুমোদন']),tr(['Not applicable','প্রযোজ্য নয়'])],
              [tr(['Last account login','সর্বশেষ লগইন']),value('lastLoginAt',language)]
            ] as const).map(([label,text])=><div key={label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm text-taxpay-muted">{label}</dt><dd className="break-words text-sm font-medium text-taxpay-text">{text}</dd>
            </div>)}
          </dl>)}
        </div>
      </div>
    </div>:<div role="tabpanel" id="user1-profile-panel-registration"
      aria-labelledby="user1-profile-tab-registration" tabIndex={0}
      data-testid="taxpayer-tin-information">
      <div className="grid items-start gap-4 lg:grid-cols-2" data-testid="user1-tin-detail-columns">
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['TIN and registration','টিআইএন ও নিবন্ধন'],details([
            ['tin',['TIN number','টিআইএন নম্বর']],...identityRows,...registrationRows.slice(0,2)
          ]))}
          {panel(['Contact and addresses','যোগাযোগ ও ঠিকানা'],details([
            ...registrationRows.slice(2),...contactRows
          ]))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['Tax office and jurisdiction','কর অফিস ও অধিক্ষেত্র'],details(jurisdictionRows))}
          {panel(['Certificate and account records','সনদ ও অ্যাকাউন্টের তথ্য'],details(certificateRows))}
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-taxpay-muted">
        <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true"/>
        {tr(['This fictional reference is not a downloadable NBR-issued certificate.',
          'এই কাল্পনিক রেফারেন্সটি এনবিআর থেকে ইস্যুকৃত ডাউনলোডযোগ্য সনদ নয়।'])}
      </p>
    </div>}
  </div>;
}
