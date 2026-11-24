import React from 'react';
import {MaskedProfileValue,sensitiveProfileKind} from '../ui/MaskedProfileValue';
import {TAXPAYER_PROFILE_LAYOUT,type ProfileFieldLabel} from '../../contracts/taxpayerProfileFieldLayout';
import {isWellFormedTinProfile,type TaxpayerTinProfile,type TaxpayerTinField} from '../../contracts/taxpayerTinProfile';

type Props={
  language:'en'|'bn';
  record?:TaxpayerTinProfile|null;
  /** Private app-account metadata is part of the same profile, not a detached page card. */
  accountDetails?:React.ReactNode;
};

/** Shared approved 24-field layout for both preview and authenticated accounts.
 * Missing owner-authorized registration values are never reconstructed from a typed TIN,
 * another account's preview record, or an unrelated PDF.
 */
export function TaxpayerTinInformation({language,record,accountDetails}:Props){
  const bn=language==='bn';
  const tr=(label:ProfileFieldLabel)=>label[bn?1:0];
  const sourced=isWellFormedTinProfile(record);
  const unavailable=bn?'পাওয়া যায়নি':'Not available';
  const value=(field:TaxpayerTinField)=>{
    if(!sourced)return unavailable;
    const current=record[field];
    return typeof current==='string'&&current.trim()?current.trim():unavailable;
  };
  const fieldRow=([field,label]:readonly [TaxpayerTinField,ProfileFieldLabel,...unknown[]])=>{
    const raw=sourced?record[field]:null;
    const kind=typeof raw==='string'?sensitiveProfileKind(field,raw):null;
    return <div key={field} data-profile-field={field} className="min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[minmax(135px,43%)_minmax(0,1fr)] sm:gap-4">
      <dt className="taxpay-profile-field-label text-taxpay-muted">{tr(label)}</dt>
      <dd className="taxpay-profile-field-value min-w-0 break-words text-taxpay-text">
        {kind?<MaskedProfileValue key={field+':'+raw} value={raw as string} kind={kind}
          label={tr(label)} language={language} allowCopy profileContext/>:value(field)}
      </dd>
    </div>;
  };
  const panel=(label:ProfileFieldLabel,rows:readonly (readonly [TaxpayerTinField,ProfileFieldLabel,...unknown[]])[])=>
    <section className="min-w-0 rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
      <h3 className="taxpay-profile-section-heading mb-4 border-b border-taxpay-border pb-3 text-taxpay-text">{tr(label)}</h3>
      <dl className="divide-y divide-taxpay-border">{rows.map(fieldRow)}</dl>
    </section>;
  return <section data-testid="taxpayer-tin-information" aria-labelledby="taxpayer-tin-information-heading"
    className="space-y-4">
    <div className="overflow-hidden rounded-2xl border border-taxpay-border bg-white">
      <div className="p-5 sm:p-6">
        <h2 id="taxpayer-tin-information-heading" className="text-xl font-semibold text-taxpay-text">
          {bn?'ই-টিআইএন ও করদাতার নিবন্ধন তথ্য':'e-TIN and taxpayer registration details'}
        </h2>
        {!sourced&&<p role="status" className="mt-2 text-sm text-taxpay-muted">
          {bn?'এই অ্যাকাউন্টের জন্য যাচাইকৃত ই-টিআইএন তথ্য এখনো সংযুক্ত হয়নি। তথ্য পাওয়া গেলে নিচের ঘরগুলো পূরণ হবে।':'Verified e-TIN data is not connected to this account. These fields remain unavailable until an authorized source is linked.'}
        </p>}
        {sourced&&<p className="mt-2 text-xs text-taxpay-muted">
          {record.source==='SYNTHETIC'?
            (bn?'কাল্পনিক নমুনা তথ্য — ইস্যুকৃত টিআইএন নয়':'Fictional sample information — not an issued TIN'):
            record.source==='NBR_TIN'?
            (bn?'উৎস: সংযুক্ত টিআইএন সিস্টেম':'Source: connected TIN system'):
            (bn?'উৎস: পর্যালোচিত সনদ; সরাসরি টিআইএন সিঙ্ক নয়':'Source: reviewed certificate; not a live TIN sync')}
          {' · '}{bn?'তথ্য হালনাগাদ':'Record updated'}: {record.sourceUpdatedAt}
        </p>}
      </div>
      <dl className="border-t border-taxpay-border px-5 sm:px-6">
        {TAXPAYER_PROFILE_LAYOUT.identity.map(fieldRow)}
      </dl>
      <dl data-testid="authenticated-profile-summary" className="grid border-t border-taxpay-border sm:grid-cols-4">
        {TAXPAYER_PROFILE_LAYOUT.summary.map(([field,label])=><div key={field}
          data-profile-field={field} className="min-w-0 border-b border-taxpay-border px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:last:border-r-0">
          <dt className="taxpay-profile-summary-label text-taxpay-muted">{tr(label)}</dt>
          <dd className="taxpay-profile-summary-value mt-1 break-words text-taxpay-text">{value(field)}</dd>
        </div>)}
      </dl>
      {accountDetails&&<div className="border-t border-taxpay-border px-5 py-4 sm:px-6"
        data-testid="authenticated-profile-account-metadata">{accountDetails}</div>}
    </div>
    <div data-testid="authenticated-profile-detail-columns" className="grid items-stretch gap-4 lg:grid-cols-2">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        {panel(['Personal information','ব্যক্তিগত তথ্য'],TAXPAYER_PROFILE_LAYOUT.personal)}
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        {panel(['Contact and addresses','যোগাযোগ ও ঠিকানা'],TAXPAYER_PROFILE_LAYOUT.contact)}
      </div>
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        {panel(['TIN registration and jurisdiction','টিআইএন নিবন্ধন ও কর অধিক্ষেত্র'],TAXPAYER_PROFILE_LAYOUT.jurisdiction)}
      </div>
      <div className="min-w-0 lg:col-start-2 lg:row-start-2">
        {panel(['Certificate details','সনদের তথ্য'],TAXPAYER_PROFILE_LAYOUT.certificate)}
      </div>
    </div>
  </section>;
}
