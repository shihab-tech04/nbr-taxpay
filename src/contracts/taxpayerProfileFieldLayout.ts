import type {TaxpayerTinField} from './taxpayerTinProfile';

/** One displayed row per exact TIN certificate, TIN profile, or account field.
 * The separate sources may hold mock values, but never gain extra UI fields.
 * Certificate: nbr_tin_certificate_577935451798.pdf (uploaded reference).
 * The profile fields are the existing approved TIN dashboard field contract.
 */
export type ProfileFieldOrigin='certificate'|'tin_profile'|'account';
export type ProfileFieldLabel=readonly [string,string];
export type ProfileFieldRow=readonly [TaxpayerTinField,ProfileFieldLabel,ProfileFieldOrigin];

export const TAXPAYER_PROFILE_LAYOUT={
  identity:[
    ['taxpayerName',['Name','নাম'],'certificate'],
    ['tin',['TIN','টিআইএন'],'certificate']
  ],
  summary:[
    ['tinType',['TIN type','টিআইএন ধরন'],'tin_profile'],
    ['taxesCircle',['Taxes circle','কর সার্কেল'],'certificate'],
    ['registeredOn',['Registered since','নিবন্ধিত হওয়ার তারিখ'],'tin_profile'],
    ['lastLoginAt',['Last account login','সর্বশেষ লগইন'],'account']
  ],
  personal:[
    ['taxpayerStatus',['Taxpayer status','করদাতার অবস্থা'],'certificate'],
    ['tinSubtype',['TIN classification','টিআইএন শ্রেণি'],'tin_profile'],
    ['userType',['User type','ব্যবহারকারীর ধরন'],'tin_profile'],
    ['localTaxpayer',['Local taxpayer','স্থানীয় করদাতা'],'tin_profile']
  ],
  contact:[
    ['mobileNumber',['Mobile number','মোবাইল নম্বর'],'tin_profile'],
    ['emailAddress',['Email address','ইমেইল ঠিকানা'],'tin_profile'],
    ['registeredAddress',['Registered / permanent address','নিবন্ধিত / স্থায়ী ঠিকানা'],'certificate'],
    ['currentAddress',['Current address','বর্তমান ঠিকানা'],'certificate']
  ],
  jurisdiction:[
    ['taxesZone',['Taxes zone','কর অঞ্চল'],'certificate'],
    ['taxesRange',['Taxes range','কর রেঞ্জ'],'tin_profile'],
    ['district',['District','জেলা'],'tin_profile'],
    ['country',['Country','দেশ'],'tin_profile']
  ],
  certificate:[
    ['previousTin',['Previous TIN','পূর্ববর্তী টিআইএন'],'certificate'],
    ['certificateIssuedOn',['Certificate issue date','সনদ ইস্যুর তারিখ'],'certificate'],
    ['certificateLastUpdatedOn',['Certificate last updated','সনদ সর্বশেষ হালনাগাদ'],'certificate'],
    ['issuingOfficer',['Issuing tax officer','সনদ ইস্যুকারী কর কর্মকর্তা'],'certificate'],
    ['taxOfficeAddress',['Tax office address','কর অফিসের ঠিকানা'],'certificate'],
    ['taxOfficePhone',['Tax office phone','কর অফিসের ফোন'],'certificate']
  ]
} as const satisfies Record<string,readonly ProfileFieldRow[]>;

export const TAXPAYER_PROFILE_FIELD_ORDER:readonly ProfileFieldRow[]=
  (Object.values(TAXPAYER_PROFILE_LAYOUT) as readonly (readonly ProfileFieldRow[])[]).flatMap(rows=>rows);
