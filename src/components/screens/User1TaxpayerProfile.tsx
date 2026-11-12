import React, {useEffect,useState} from 'react';
import {Check, Copy, Download} from 'lucide-react';
import {MaskedProfileValue, sensitiveProfileKind} from '../ui/MaskedProfileValue';
import {TAXPAYER_PROFILE_LAYOUT,TAXPAYER_PROFILE_FIELD_ORDER,type ProfileFieldRow} from '../../contracts/taxpayerProfileFieldLayout';
import {
  USER1_FICTIONAL_TIN_PROFILE as initialReference,
  user1FictionalTinValue,
} from '../../data/user1FictionalTinProfile';
import type {TaxpayerTinField,TaxpayerTinProfile} from '../../contracts/taxpayerTinProfile';
import {activePreviewSession} from '../../services/previewAccountSession';
import {loadTaxpayerRegistrationProfile} from '../../services/taxpayerRegistrationProfile';

type Language='en'|'bn';
type Label=readonly [string,string];
type Row=ProfileFieldRow;

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
  const details=(rows:readonly Row[])=><dl className="divide-y divide-taxpay-border lg:flex lg:flex-1 lg:flex-col">
    {rows.map(([field,label])=>{
      const raw=record?.[field];
      const kind=typeof raw==='string'?sensitiveProfileKind(field,raw):null;
      return <div key={field} data-profile-field={field} className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4 lg:flex-1 lg:items-center lg:py-1.5">
        <dt className="text-sm font-normal text-taxpay-muted">{tr(label)}</dt>
        <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-taxpay-text">
          {kind?<MaskedProfileValue key={field+':'+raw} value={raw as string} kind={kind}
            label={tr(label)} language={language}/>:value(field,language)}
        </dd>
      </div>;
    })}
  </dl>;
  const panel=(title:Label,children:React.ReactNode)=><section className="flex h-full min-w-0 flex-col rounded-xl border border-taxpay-border bg-white p-4 lg:py-3">
    <h3 className="mb-3 border-b border-taxpay-border pb-2 text-base font-semibold text-taxpay-text">{tr(title)}</h3>
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
        ...TAXPAYER_PROFILE_FIELD_ORDER.map(([field,label])=>[label[0],String(record[field]??'')]),
      ];
      const csv='\uFEFF'+rows.map(line=>line.map(safe).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='Sohojkor-user1-profile.csv';
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
  return <div data-testid="user1-taxpayer-profile" className="space-y-3" aria-label={tr(['Taxpayer profile','করদাতার প্রোফাইল'])}>
    <section className="overflow-hidden rounded-2xl border border-taxpay-border bg-white">
      <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-5 lg:py-3">
        <div className="flex w-full min-w-0 items-start gap-4 sm:w-auto sm:flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-taxpay-light text-lg font-semibold text-taxpay-primary" aria-hidden="true">AR</div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-taxpay-muted">{tr(['Account','অ্যাকাউন্ট'])}: user1</p>
            <h2 data-profile-field="taxpayerName" className="break-words text-xl font-semibold leading-snug text-taxpay-text sm:text-2xl">
              {value('taxpayerName',language)}
            </h2>
          </div>
        </div>
        <button type="button" onClick={exportSample}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light sm:w-auto">
          <Download size={17} aria-hidden="true"/>{tr(['Download profile','প্রোফাইল ডাউনলোড'])}
        </button>
      </div>
      <div className="border-t border-taxpay-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm text-taxpay-muted">{tr(['TIN','টিআইএন'])}</p>
          <div data-profile-field="tin" className="mt-1 flex min-w-0 flex-wrap items-center gap-0.5 break-all text-xl font-semibold tracking-wide text-taxpay-text sm:text-2xl">
            <MaskedProfileValue key={tin} value={tin} kind="tin" label={tr(['TIN','টিআইএন'])}
              language={language} testId="user1-profile-tin"/>
            <button type="button" onClick={copyTin}
              aria-label={copied==='done'?tr(['Copied TIN','টিআইএন কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              title={copied==='done'?tr(['Copied','কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
              {copied==='done'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}
            </button>
          </div>
        </div>
      </div>
      {copied==='failed'&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Could not copy. Select and copy the reference manually.','কপি করা যায়নি। রেফারেন্স নির্বাচন করে কপি করুন।'])}</p>}
      {downloadError&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Download failed. Please retry.','ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'])}</p>}
      <div data-testid="user1-profile-summary" className="grid border-t border-taxpay-border sm:grid-cols-4">
        {TAXPAYER_PROFILE_LAYOUT.summary.map(([field,label])=><div key={field} data-profile-field={field} className="min-w-0 border-b border-taxpay-border px-4 py-2.5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
          <p className="text-xs text-taxpay-muted">{tr(label)}</p>
          <p className="mt-1 break-words text-sm font-semibold text-taxpay-text">{value(field,language)}</p>
        </div>)}
      </div>
    </section>
    <section className="space-y-3" data-testid="user1-profile-unified-content" aria-label={tr(['Taxpayer information','করদাতার তথ্য'])}>
      <div className="grid items-stretch gap-3 lg:grid-cols-2" data-testid="user1-profile-detail-columns">
        <div data-testid="profile-personal-card" className="min-w-0 lg:col-start-1 lg:row-start-1">
          {panel(['Personal information','ব্যক্তিগত তথ্য'],details(TAXPAYER_PROFILE_LAYOUT.personal))}
        </div>
        <div data-testid="profile-contact-card" className="min-w-0 lg:col-start-1 lg:row-start-2">
          {panel(['Contact and addresses','যোগাযোগ ও ঠিকানা'],details(TAXPAYER_PROFILE_LAYOUT.contact))}
        </div>
        <div data-testid="profile-jurisdiction-card" className="min-w-0 lg:col-start-2 lg:row-start-1">
          {panel(['TIN registration and jurisdiction','টিআইএন নিবন্ধন ও কর অধিক্ষেত্র'],details(TAXPAYER_PROFILE_LAYOUT.jurisdiction))}
        </div>
        <div data-testid="profile-certificate-card" className="min-w-0 lg:col-start-2 lg:row-start-2">
          {panel(['Certificate details','সনদের তথ্য'],details(TAXPAYER_PROFILE_LAYOUT.certificate))}
        </div>
      </div>
    </section>
  </div>;
}
