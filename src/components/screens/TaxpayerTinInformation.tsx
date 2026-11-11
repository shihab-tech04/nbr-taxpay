import React from 'react';
import {isWellFormedTinProfile,type TaxpayerTinProfile,type TaxpayerTinField} from '../../contracts/taxpayerTinProfile';

type Bilingual = readonly [string, string];
type Field = readonly [TaxpayerTinField, Bilingual];
type FieldGroup = {title:Bilingual; fields:readonly Field[]};

const groups:readonly FieldGroup[]=[
  {title:['TIN and registration','টিআইএন ও নিবন্ধন'],fields:[
    ['tin',['TIN number','টিআইএন নম্বর']],
    ['taxpayerName',['Registered taxpayer name','নিবন্ধিত করদাতার নাম']],
    ['taxpayerStatus',['Taxpayer status','করদাতার ধরন']],
    ['tinType',['TIN type','টিআইএন ধরন']],
    ['tinSubtype',['TIN classification','টিআইএন শ্রেণি']],
    ['registeredOn',['TIN registration date','টিআইএন নিবন্ধনের তারিখ']],
    ['userType',['User type','ব্যবহারকারীর ধরন']],
    ['localTaxpayer',['Local taxpayer','স্থানীয় করদাতা']],
    ['previousTin',['Previous TIN','পূর্ববর্তী টিআইএন']]
  ]},
  {title:['Tax office and jurisdiction','কর অফিস ও অধিক্ষেত্র'],fields:[
    ['taxesCircle',['Taxes circle','কর সার্কেল']],
    ['taxesZone',['Taxes zone','কর অঞ্চল']],
    ['taxesRange',['Taxes range','কর রেঞ্জ']],
    ['district',['District','জেলা']],
    ['country',['Country','দেশ']]
  ]},
  {title:['Contact and addresses','যোগাযোগ ও ঠিকানা'],fields:[
    ['registeredAddress',['Registered / permanent address','নিবন্ধিত / স্থায়ী ঠিকানা']],
    ['currentAddress',['Current address','বর্তমান ঠিকানা']],
    ['mobileNumber',['Mobile number','মোবাইল নম্বর']],
    ['emailAddress',['Email address','ইমেইল ঠিকানা']]
  ]},
  {title:['Certificate and account records','সনদ ও অ্যাকাউন্টের তথ্য'],fields:[
    ['certificateIssuedOn',['Certificate issue date','সনদ ইস্যুর তারিখ']],
    ['certificateLastUpdatedOn',['Certificate last updated','সনদ সর্বশেষ হালনাগাদ']],
    ['issuingOfficer',['Issuing tax officer','সনদ ইস্যুকারী কর কর্মকর্তা']],
    ['taxOfficeAddress',['Tax office address','কর অফিসের ঠিকানা']],
    ['taxOfficePhone',['Tax office phone','কর অফিসের ফোন']],
    ['lastLoginAt',['Last account login','অ্যাকাউন্টে সর্বশেষ লগইন']]
  ]}
];

type Props={language:'en'|'bn';record?:TaxpayerTinProfile|null};

/**
 * Rendering is independent of a guessed account/TIN. Until a verified,
 * owner-authorized SQL/API profile exists, show missing fields instead of
 * importing somebody else's PDF into a synthetic user.
 */
export function TaxpayerTinInformation({language,record}:Props){
  const bn=language==='bn';
  const tr=(pair:Bilingual)=>pair[bn?1:0];
  const sourced=isWellFormedTinProfile(record);
  const value=(field:TaxpayerTinField)=>{
    if(!sourced)return bn?'পাওয়া যায়নি':'Not available';
    const current=record[field];
    return typeof current==='string'&&current.trim()?current.trim():(bn?'পাওয়া যায়নি':'Not available');
  };
  return <section className="taxpayer-account-panel" data-testid="taxpayer-tin-information" aria-labelledby="taxpayer-tin-information-heading">
    <h2 id="taxpayer-tin-information-heading" className="text-base font-semibold">
      {bn?'ই-টিআইএন ও করদাতার নিবন্ধন তথ্য':'e-TIN and taxpayer registration details'}
    </h2>
    {!sourced && <p role="status" className="mt-2 text-sm text-taxpay-muted">
      {bn?'এই অ্যাকাউন্টের জন্য যাচাইকৃত ই-টিআইএন তথ্য এখনো সংযুক্ত হয়নি। তথ্য পাওয়া গেলে নিচের ঘরগুলো পূরণ হবে।':'Verified e-TIN data is not connected to this account. These fields remain unavailable until an authorized source is linked.'}
    </p>}
    {sourced && <p className="mt-2 text-xs text-taxpay-muted">
      {record.source==='NBR_TIN'
        ? (bn?'উৎস: সংযুক্ত টিআইএন সিস্টেম':'Source: connected TIN system')
        : (bn?'উৎস: পর্যালোচিত সনদ; সরাসরি টিআইএন সিঙ্ক নয়':'Source: reviewed certificate; not a live TIN sync')}
      {' · '}{tr(['Record updated','তথ্য হালনাগাদ'])}: {record.sourceUpdatedAt}
    </p>}
    <div className="mt-4 space-y-5">
      {groups.map(group=><section key={group.title[0]}>
        <h3 className="text-sm font-semibold text-taxpay-text">{tr(group.title)}</h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          {group.fields.map(([field,label])=><div key={field} className="min-w-0 rounded-lg border border-taxpay-border p-3">
            <dt className="text-xs font-normal text-taxpay-muted">{tr(label)}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-taxpay-text">{value(field)}</dd>
          </div>)}
        </dl>
      </section>)}
    </div>
  </section>;
}
