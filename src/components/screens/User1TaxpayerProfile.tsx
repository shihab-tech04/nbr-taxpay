import React, {useEffect,useState} from 'react';
import {Check, Clipboard, Download} from 'lucide-react';
import {MaskedProfileValue, sensitiveProfileKind} from '../ui/MaskedProfileValue';
import {DEMO_USERS} from '../../data/demoUsers';
import {
  USER1_FICTIONAL_TIN_PROFILE as initialReference,
  user1FictionalTinValue,
} from '../../data/user1FictionalTinProfile';
import type {TaxpayerTinField,TaxpayerTinProfile} from '../../contracts/taxpayerTinProfile';
import {activePreviewSession} from '../../services/previewAccountSession';
import {loadTaxpayerRegistrationProfile} from '../../services/taxpayerRegistrationProfile';

type Language='en'|'bn';
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
];
const contactRows:readonly Row[]=[
  ['mobileNumber',['Mobile number','মোবাইল নম্বর']],
  ['emailAddress',['Email address','ইমেইল ঠিকানা']],
];
const allRows:readonly Row[]=[['tin',['TIN number','টিআইএন নম্বর']],...identityRows,...jurisdictionRows,...registrationRows,...contactRows,...certificateRows];

export function User1TaxpayerProfile({language}:{language:Language}){
  const bn=language==='bn';
  const tr=(pair:Label)=>pair[bn?1:0];
  const session=activePreviewSession();
  const [reload,setReload]=useState(0);
  const [recordState,setRecordState]=useState<{status:'loading'|'ready'|'error';profile:TaxpayerTinProfile|null}>(
    {status:session?.profileId==='user1'?'loading':'ready',profile:null});
  useEffect(()=>{
    if(session?.profileId!=='user1')return;
    let active=true;
    setRecordState({status:'loading',profile:null});
    loadTaxpayerRegistrationProfile('user1').then(snapshot=>{
      if(active)setRecordState(snapshot?{status:'ready',profile:snapshot.profile}:{status:'error',profile:null});
    }).catch(()=>{
      if(active)setRecordState({status:'error',profile:null});
    });
    return()=>{active=false;};
  },[session?.profileId,reload]);
  const record=session?.profileId==='user1'?recordState.profile:initialReference;
  const value=(field:TaxpayerTinField,language:Language)=>
    user1FictionalTinValue(field,language,record??initialReference);
  const [copied,setCopied]=useState<'idle'|'done'|'failed'>('idle');
  const [downloadError,setDownloadError]=useState(false);
  const tin=record?.tin??'';
  const details=(rows:readonly Row[])=><dl className="divide-y divide-taxpay-border">
    {rows.map(([field,label])=>{
      const raw=record?.[field];
      const kind=typeof raw==='string'?sensitiveProfileKind(field,raw):null;
      return <div key={field} className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4">
        <dt className="text-sm font-normal text-taxpay-muted">{tr(label)}</dt>
        <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-taxpay-text">
          {kind?<MaskedProfileValue key={field+':'+raw} value={raw as string} kind={kind}
            label={tr(label)} language={language}/>:value(field,language)}
        </dd>
      </div>;
    })}
  </dl>;
  const panel=(title:Label,children:React.ReactNode)=><section className="min-w-0 rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
    <h3 className="mb-4 border-b border-taxpay-border pb-3 text-base font-semibold text-taxpay-text">{tr(title)}</h3>
    {children}
  </section>;
  const copyTin=async()=>{
    setCopied('idle');
    try {
      await navigator.clipboard.writeText(tin);
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
      if(!record)throw Error('Profile SQL unavailable');
      const rows=[['Field','Value'],
        ['Account','user1'],...allRows.map(([field,label])=>[label[0],String(record?.[field]??'')]),
      ];
      const csv='\uFEFF'+rows.map(line=>line.map(safe).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='Korbritto-user1-profile.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
    }
  };
  if(session?.profileId==='user1'&&recordState.status!=='ready'){
    return <section className="rounded-xl border border-taxpay-border bg-white p-5" data-testid="user1-taxpayer-profile">
      {recordState.status==='loading'?<p role="status">{bn?'করদাতার প্রোফাইল লোড হচ্ছে…':'Loading taxpayer profile…'}</p>:
      <div><p role="alert">{bn?'প্রোফাইলের তথ্য লোড করা যায়নি।':'Could not load taxpayer information.'}</p>
      <button type="button" onClick={()=>setReload(v=>v+1)}
        className="mt-3 min-h-11 rounded-lg border border-taxpay-border px-4 text-sm text-taxpay-primary">
        {bn?'আবার চেষ্টা করুন':'Retry'}</button></div>}
    </section>;
  }
  return <div data-testid="user1-taxpayer-profile" className="space-y-4" aria-label={tr(['Taxpayer profile','করদাতার প্রোফাইল'])}>
    <section className="overflow-hidden rounded-2xl border border-taxpay-border bg-white">
      <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-6">
        <div className="flex w-full min-w-0 items-start gap-4 sm:w-auto sm:flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-taxpay-light text-lg font-semibold text-taxpay-primary" aria-hidden="true">AR</div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-taxpay-muted">{tr(['Account','অ্যাকাউন্ট'])}: user1</p>
            <h2 className="break-words text-xl font-semibold leading-snug text-taxpay-text sm:text-2xl">
              {bn?DEMO_USERS.user1.nameBn:record?.taxpayerName??DEMO_USERS.user1.nameEn}
            </h2>
          </div>
        </div>
        <button type="button" onClick={exportSample}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light sm:w-auto">
          <Download size={17} aria-hidden="true"/>{tr(['Download profile','প্রোফাইল ডাউনলোড'])}
        </button>
      </div>
      <div className="border-t border-taxpay-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm text-taxpay-muted">{tr(['TIN','টিআইএন'])}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-0.5 break-all text-xl font-semibold tracking-wide text-taxpay-text sm:text-2xl">
            <MaskedProfileValue key={tin} value={tin} kind="tin" label={tr(['TIN','টিআইএন'])}
              language={language} testId="user1-profile-tin"/>
            <button type="button" onClick={copyTin}
              aria-label={copied==='done'?tr(['Copied TIN','টিআইএন কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              title={copied==='done'?tr(['Copied','কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
              {copied==='done'?<Check size={18} aria-hidden="true"/>:<Clipboard size={18} aria-hidden="true"/>}
            </button>
          </div>
        </div>
      </div>
      {copied==='failed'&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Could not copy. Select and copy the reference manually.','কপি করা যায়নি। রেফারেন্স নির্বাচন করে কপি করুন।'])}</p>}
      {downloadError&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Download failed. Please retry.','ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'])}</p>}
      <div data-testid="user1-profile-summary" className="grid border-t border-taxpay-border sm:grid-cols-4">
        {([
          [tr(['TIN type','টিআইএন ধরন']),value('tinType',language)],
          [tr(['Taxes circle','কর সার্কেল']),value('taxesCircle',language)],
          [tr(['Registered since','নিবন্ধিত হওয়ার তারিখ']),value('registeredOn',language)],
          [tr(['Last account login','সর্বশেষ লগইন']),value('lastLoginAt',language)]
        ] as const).map(([label,text])=><div key={label} className="min-w-0 border-b border-taxpay-border px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:last:border-r-0">
          <p className="text-xs text-taxpay-muted">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-taxpay-text">{text}</p>
        </div>)}
      </div>
    </section>
    <section className="space-y-4" data-testid="user1-profile-unified-content" aria-label={tr(['Taxpayer information','করদাতার তথ্য'])}>
      <div className="grid items-start gap-4 lg:grid-cols-2" data-testid="user1-profile-detail-columns">
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['Personal information','ব্যক্তিগত তথ্য'],details([
            ['taxpayerStatus',['Taxpayer class','করদাতার শ্রেণি']],
            ['tinSubtype',['TIN classification','টিআইএন শ্রেণি']],
            ['userType',['User type','ব্যবহারকারীর ধরন']],
            ['localTaxpayer',['Local taxpayer','স্থানীয় করদাতা']],
          ]))}
          {panel(['Contact and addresses','যোগাযোগ ও ঠিকানা'],details([
            ...contactRows,
            ['registeredAddress',['Registered / permanent address','নিবন্ধিত / স্থায়ী ঠিকানা']],
            ['currentAddress',['Current address','বর্তমান ঠিকানা']],
          ]))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {panel(['TIN registration and jurisdiction','টিআইএন নিবন্ধন ও কর অধিক্ষেত্র'],details([
            ['taxesZone',['Taxes zone','কর অঞ্চল']],
            ['taxesRange',['Taxes range','কর রেঞ্জ']],
            ['district',['District','জেলা']],
            ['country',['Country','দেশ']],
            ['previousTin',['Previous TIN','পূর্ববর্তী টিআইএন']],
          ]))}
          {panel(['Certificate details','সনদের তথ্য'],details(certificateRows))}
        </div>
      </div>
    </section>
  </div>;
}
