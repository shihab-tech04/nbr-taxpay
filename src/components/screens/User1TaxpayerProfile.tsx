import React, {useEffect,useState} from 'react';
import {Check, Copy, Download, UserRound} from 'lucide-react';
import {MaskedProfileValue, sensitiveProfileKind} from '../ui/MaskedProfileValue';
import {TAXPAYER_PROFILE_LAYOUT,TAXPAYER_PROFILE_FIELD_ORDER,type ProfileFieldRow} from '../../contracts/taxpayerProfileFieldLayout';
import {user1FictionalTinValue} from '../../data/user1FictionalTinProfile';
import type {TaxpayerTinField,TaxpayerTinProfile} from '../../contracts/taxpayerTinProfile';
import {getDemoUser,type DemoUser,type DemoUserId} from '../../data/demoUsers';
import {useDemoSqlProfileAndServiceRecords} from '../../services/demoSqlProfiles';
import {activePreviewSession} from '../../services/previewAccountSession';
import {loadTaxpayerRegistrationProfile} from '../../services/taxpayerRegistrationProfile';

type Language='en'|'bn';
type Label=readonly [string,string];
type Row=ProfileFieldRow;

/**
 * Shared 24-field profile for all authenticated fictional preview accounts.
 * A stored registration row is displayed only for its matching capability owner.
 * Other users keep the exact same layout with only account-backed metadata;
 * a 13-digit scenario reference is never presented as an issued e-TIN.
 */
export function User1TaxpayerProfile({language,account}:{language:Language;account?:DemoUser|null}){
  const bn=language==='bn';
  const tr=(pair:Label)=>pair[bn?1:0];
  const session=activePreviewSession();
  const accountId=account?.id??session?.profileId??null;
  const verified=Boolean(session&&session.profileId===accountId);
  // The compile-time disabled-backend test build can show account-only mock
  // fields after its local User ID login, but never bundled certificate values.
  // Production does not permit any unverified preview ownership.
  const offlinePreview=import.meta.env?.VITE_SUPABASE_DISABLED==='true'&&Boolean(account)&&!session;
  const allowed=verified||offlinePreview;
  const owner=allowed&&accountId?getDemoUser(accountId):null;
  const demoSql=useDemoSqlProfileAndServiceRecords(owner?.id??null);
  const sqlAccount=demoSql.status==='ready'&&demoSql.userId===accountId?demoSql.profile:null;
  const [reload,setReload]=useState(0);
  const [showUnavailableFields,setShowUnavailableFields]=useState(false);
  const [recordState,setRecordState]=useState<{
    owner:DemoUserId|null;status:'loading'|'ready'|'error';profile:TaxpayerTinProfile|null
  }>({owner:null,status:'loading',profile:null});
  useEffect(()=>{
    if(!accountId||!allowed){
      setRecordState({owner:accountId,status:'error',profile:null});
      return;
    }
    if(offlinePreview){
      setRecordState({owner:accountId,status:'ready',profile:null});
      return;
    }
    let active=true;
    setRecordState({owner:accountId,status:'loading',profile:null});
    loadTaxpayerRegistrationProfile(accountId).then(snapshot=>{
      if(active)setRecordState({owner:accountId,status:'ready',profile:snapshot?.profile??null});
    }).catch(()=>{
      if(active)setRecordState({owner:accountId,status:'error',profile:null});
    });
    return()=>{active=false;};
  },[accountId,allowed,offlinePreview,reload]);
  // Never show a previous account's SQL row while a new account is loading.
  const current=recordState.owner===accountId?recordState:null;
  const record=verified?current?.profile??null:null;
  const status=current?.status??'loading';
  // Only User1 has a reviewed registration certificate in the canonical seed.
  // A 13-digit demo scenario reference is not a certified 12-digit e-TIN.
  const registrationNotLinked=status==='ready' && !record && Boolean(owner);
  const accountStatus=(sqlAccount?.roleCode??owner?.role)==='TAXPAYER_CORPORATE'
    ?tr(['Company','কোম্পানি'])
    : (sqlAccount?.roleCode??owner?.role)==='WITHHOLDING_AGENT'
      ?tr(['Withholding agent','উৎসে কর কর্তনকারী'])
      :tr(['Individual','ব্যক্তি']);
  const rawValue=(field:TaxpayerTinField):string|null=>{
    const fromRegistration=record?.[field];
    if(typeof fromRegistration==='string'&&fromRegistration.trim())return fromRegistration.trim();
    if(record)return null; // An incomplete registration row is not enriched from unrelated sample data.
    if(!owner)return null;
    if(field==='taxpayerName')return bn?(sqlAccount?.nameBn??owner.nameBn):(sqlAccount?.nameEn??owner.nameEn);
    if(field==='taxpayerStatus'||field==='tinType')return accountStatus;
    if(field==='taxesCircle')return sqlAccount?.jurisdictionLabel??owner.taxCircle;
    return null;
  };
  const value=(field:TaxpayerTinField,lang:Language):string=>{
    const raw=rawValue(field);
    if(!raw)return lang==='bn'?'পাওয়া যায়নি':'Not available';
    return record&&accountId==='user1'?user1FictionalTinValue(field,lang,record):raw;
  };
  const initials=(()=>{
    const name=(record?.taxpayerName??sqlAccount?.nameEn??owner?.nameEn??'').replace(/^(md\.?|mr\.?|ms\.?)\s+/i,'');
    const parts=name.split(/\s+/).map(part=>part.replace(/[^A-Za-z]/g,'')).filter(Boolean);
    return (parts.slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'—');
  })();
  const details=(rows:readonly Row[])=><>
    {registrationNotLinked && !showUnavailableFields && rows.every(([field])=>!rawValue(field)) &&
      <p className="py-2 text-sm text-taxpay-muted">
        {tr(['No verified registration details linked.','যাচাইকৃত নিবন্ধনের তথ্য সংযুক্ত নেই।'])}
      </p>}
    <dl className="divide-y divide-taxpay-border">
      {rows.map(([field,label])=>{
        const raw=rawValue(field);
        const kind=typeof raw==='string'?sensitiveProfileKind(field,raw):null;
        const hideUnavailable=registrationNotLinked && !showUnavailableFields && !raw;
        return <div key={field} data-profile-field={field} className={(hideUnavailable?'hidden':'grid')+' min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4'}>
          <dt className="taxpay-profile-field-label text-taxpay-muted">{tr(label)}</dt>
          <dd className="taxpay-profile-field-value min-w-0 break-words text-taxpay-text">
            {kind?<MaskedProfileValue key={field+':'+raw} value={raw as string} kind={kind}
              label={tr(label)} language={language} allowCopy profileContext/>:value(field,language)}
          </dd>
        </div>;
      })}
    </dl>
  </>;
  const panel=(title:Label,children:React.ReactNode)=><section className="flex h-full min-w-0 flex-col rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
    <h3 className="taxpay-profile-section-heading mb-4 border-b border-taxpay-border pb-3 text-taxpay-text">{tr(title)}</h3>
    {children}
  </section>;
  const [copied,setCopied]=useState<'idle'|'done'|'failed'>('idle');
  const [downloadError,setDownloadError]=useState(false);
  const tin=record?.tin??'';
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
      if(!owner||status!=='ready')throw Error('Profile source unavailable');
      const rows=[['Field','Value'],
        ...TAXPAYER_PROFILE_FIELD_ORDER.map(([field,label])=>[label[0],rawValue(field)??'']),
      ];
      const csv='\uFEFF'+rows.map(line=>line.map(safe).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='Sohojkor-'+accountId+'-profile.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
    }
  };
  if(!allowed){
    return <section className="rounded-xl border border-taxpay-border bg-white p-5" data-testid="user1-taxpayer-profile">
      <p role="alert">{bn?'এই অ্যাকাউন্টের জন্য করদাতার প্রোফাইল পাওয়া যায়নি।':'Taxpayer profile is not available for this account.'}</p>
    </section>;
  }
  return <div data-testid="user1-taxpayer-profile" className="space-y-4" aria-label={tr(['Taxpayer profile','করদাতার প্রোফাইল'])}>
    <section className="overflow-hidden rounded-2xl border border-taxpay-border bg-white">
      <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-6">
        <div className="flex w-full min-w-0 items-start gap-4 sm:w-auto sm:flex-1">
          <div data-testid="user1-profile-identity-badge" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-taxpay-light text-lg font-semibold text-taxpay-primary" aria-hidden="true">{initials==='—'?<UserRound size={20}/>:initials}</div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm text-taxpay-muted">{tr(['Account','অ্যাকাউন্ট'])}: {accountId??'—'}</p>
            <h2 data-profile-field="taxpayerName" className="break-words text-xl font-semibold leading-snug text-taxpay-text sm:text-2xl">
              {value('taxpayerName',language)}
            </h2>
          </div>
        </div>
        <button type="button" onClick={exportSample} disabled={status!=='ready'}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light sm:w-auto">
          <Download size={17} aria-hidden="true"/>{tr(['Download profile','প্রোফাইল ডাউনলোড'])}
        </button>
      </div>
      <div className="border-t border-taxpay-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm text-taxpay-muted">{tr(['TIN','টিআইএন'])}</p>
          <div data-profile-field="tin" className="mt-1 flex min-w-0 flex-wrap items-center gap-0.5 break-all text-xl font-semibold tracking-wide text-taxpay-text sm:text-2xl">
            {tin?<MaskedProfileValue key={tin} value={tin} kind="tin" label={tr(['TIN','টিআইএন'])}
              language={language} testId="user1-profile-tin"/>:<span>{value('tin',language)}</span>}
            <button type="button" onClick={copyTin} disabled={!tin}
              aria-label={copied==='done'?tr(['Copied TIN','টিআইএন কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              title={copied==='done'?tr(['Copied','কপি হয়েছে']):tr(['Copy TIN','টিআইএন কপি করুন'])}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary hover:bg-taxpay-light disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
              {copied==='done'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}
            </button>
          </div>
        </div>
      </div>
      {copied==='failed'&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Could not copy. Select and copy the reference manually.','কপি করা যায়নি। রেফারেন্স নির্বাচন করে কপি করুন।'])}</p>}
      {downloadError&&<p className="px-5 pb-3 text-sm text-taxpay-error" role="alert">{tr(['Download failed. Please retry.','ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'])}</p>}
      <div data-testid="user1-profile-summary" className="grid border-t border-taxpay-border sm:grid-cols-4">
        {TAXPAYER_PROFILE_LAYOUT.summary.map(([field,label])=><div key={field} data-profile-field={field} className="min-w-0 border-b border-taxpay-border px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:last:border-r-0">
          <p className="taxpay-profile-summary-label text-taxpay-muted">{tr(label)}</p>
          <p className="taxpay-profile-summary-value mt-1 break-words text-taxpay-text">{value(field,language)}</p>
        </div>)}
      </div>
    </section>
    {registrationNotLinked&&<section data-testid="registration-not-linked" role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-taxpay-border bg-white px-4 py-3 sm:px-5">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-taxpay-text">
          {tr(['Registration record not linked','নিবন্ধনের রেকর্ড সংযুক্ত নেই'])}
        </p>
        <p className="text-sm text-taxpay-muted">
          {tr(['Only account-backed information is shown. A demo account reference is not an issued e-TIN.',
            'শুধু অ্যাকাউন্টে সংরক্ষিত তথ্য দেখানো হচ্ছে। ডেমো অ্যাকাউন্টের রেফারেন্স ইস্যুকৃত ই-টিআইএন নয়।'])}
        </p>
      </div>
      <button type="button" aria-expanded={showUnavailableFields} onClick={()=>setShowUnavailableFields(value=>!value)}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light">
        {showUnavailableFields
          ?tr(['Hide unavailable registration fields','অনুপলব্ধ নিবন্ধন তথ্য লুকান'])
          :tr(['Show unavailable registration fields','অনুপলব্ধ নিবন্ধন তথ্য দেখুন'])}
      </button>
    </section>}
    {status==='loading'&&<p role="status" className="text-sm text-taxpay-muted">{tr(['Loading registration details…','নিবন্ধন তথ্য লোড হচ্ছে…'])}</p>}
    {status==='error'&&<div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-taxpay-border bg-white px-4 py-3 text-sm text-taxpay-muted">
      <span>{tr(['Registration details are temporarily unavailable. Account information remains visible.','নিবন্ধনের তথ্য সাময়িকভাবে পাওয়া যাচ্ছে না। অ্যাকাউন্টের তথ্য দেখানো হচ্ছে।'])}</span>
      <button type="button" onClick={()=>setReload(v=>v+1)} className="min-h-11 rounded-lg border border-taxpay-border px-4 font-semibold text-taxpay-primary">{tr(['Retry','আবার চেষ্টা'])}</button>
    </div>}
    <section className="space-y-4" data-testid="user1-profile-unified-content" aria-label={tr(['Taxpayer information','করদাতার তথ্য'])}>
      <div className="grid items-stretch gap-4 lg:grid-cols-2" data-testid="user1-profile-detail-columns">
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
