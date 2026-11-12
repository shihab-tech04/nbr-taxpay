import test from 'node:test';
import assert from 'node:assert/strict';
import {isWellFormedTinProfile,type TaxpayerTinProfile} from '../src/contracts/taxpayerTinProfile';

const certificate:TaxpayerTinProfile={
  source:'REVIEWED_CERTIFICATE',sourceUpdatedAt:'2026-06-04T17:06:20+06:00',
  tin:'577935451798',taxpayerName:'TAX NAME',taxpayerStatus:'Individual',
  tinType:null,tinSubtype:null,registeredOn:null,userType:null,
  localTaxpayer:null,previousTin:'Not Applicable',
  taxesCircle:'Circle-245 (Company)',taxesZone:'12, Dhaka',taxesRange:null,
  district:'Dhaka',country:'Bangladesh',
  registeredAddress:'Dhaka, 1122, Dhaka, Bangladesh',
  currentAddress:'Dhaka, 1122, Dhaka, Bangladesh',
  mobileNumber:null,emailAddress:null,certificateIssuedOn:'2026-01-19',
  certificateLastUpdatedOn:'2026-06-04',issuingOfficer:'Deputy Commissioner of Taxes',
  taxOfficeAddress:null,taxOfficePhone:null,lastLoginAt:null
};
test('12-digit certificate record can be represented without inventing omitted dashboard fields',()=>{
  assert.equal(isWellFormedTinProfile(certificate),true);
  assert.equal(certificate.registeredOn,null);
  assert.equal(certificate.taxesRange,null);
});
test('13-digit fictional TaxPay identity is not treated as an official e-TIN',()=>{
  assert.equal(isWellFormedTinProfile({...certificate,tin:'1111111111111'}),false);
});
test('profile without source timestamp must not be presented as linked',()=>{
  assert.equal(isWellFormedTinProfile({...certificate,sourceUpdatedAt:'not-a-date'}),false);
  assert.equal(isWellFormedTinProfile(null),false);
});

test('user1 reference profile matches uploaded e-TIN and dashboard fields without changing payment identity',async()=>{
  const {USER1_FICTIONAL_TIN_PROFILE:sample}=await import('../src/data/user1FictionalTinProfile');
  assert.equal(sample.source,'REVIEWED_CERTIFICATE');
  assert.equal(sample.tin,'577935451798');
  assert.equal(isWellFormedTinProfile(sample),true);
  const {DEMO_USERS}=await import('../src/data/demoUsers');
  assert.equal(DEMO_USERS.user1.tin,'1111111111111');
  assert.notEqual(DEMO_USERS.user1.tin,sample.tin);
  assert.equal(sample.taxesCircle,'Circle-245 (Company)');
  assert.equal(sample.taxesZone,'Taxes Zone-12, Dhaka');
  assert.equal(sample.registeredAddress,'Dhaka, 1122, Dhaka, Bangladesh');
  assert.equal(sample.currentAddress,sample.registeredAddress);
  assert.equal(sample.previousTin,'Not Applicable');
  assert.equal(sample.certificateIssuedOn,'19 Jan 2026');
  assert.equal(sample.certificateLastUpdatedOn,'04 Jun 2026, 05:06:20 PM');
  assert.equal(sample.taxOfficePhone,'02-9588253');
  assert.equal(sample.mobileNumber,'+8801857648765');
  assert.equal(sample.emailAddress,'email@test.com');
  const fields=['taxpayerName','taxpayerStatus','tinType','tinSubtype','registeredOn','userType',
    'localTaxpayer','previousTin','taxesCircle','taxesZone','taxesRange','district',
    'country','registeredAddress','currentAddress','mobileNumber','emailAddress',
    'certificateIssuedOn','certificateLastUpdatedOn','issuingOfficer','taxOfficeAddress',
    'taxOfficePhone','lastLoginAt'];
  for(const field of fields)assert.ok(String((sample as unknown as Record<string,unknown>)[field]).trim(),field);
  assert.ok(sample.taxOfficeAddress?.includes('Purana Paltan'));
});

test('profile and e-TIN certificate fields match the canonical UI/export field map 1:1',async()=>{
  const {TAXPAYER_PROFILE_LAYOUT,TAXPAYER_PROFILE_FIELD_ORDER}=await import('../src/contracts/taxpayerProfileFieldLayout');
  const {USER1_FICTIONAL_TIN_PROFILE:sample}=await import('../src/data/user1FictionalTinProfile');
  const all=TAXPAYER_PROFILE_FIELD_ORDER.map(([key])=>key);
  const expected=Object.keys(sample).filter(k=>k!=='source'&&k!=='sourceUpdatedAt');
  assert.equal(all.length,24,'24 distinct visible source fields');
  assert.equal(new Set(all).size,all.length,'no repeated profile, date, circle, or address field');
  assert.deepEqual([...all].sort(),expected.sort(),'no source field omitted and no new unsupported field');
  assert.deepEqual(TAXPAYER_PROFILE_LAYOUT.identity.map(([key])=>key),['taxpayerName','tin']);
  assert.deepEqual(TAXPAYER_PROFILE_LAYOUT.summary.map(([key])=>key),['tinType','registeredOn','previousTin','lastLoginAt']);
  assert.deepEqual(TAXPAYER_PROFILE_LAYOUT.jurisdiction.slice(0,3).map(([key])=>key),
    ['taxesCircle','taxesZone','taxesRange']);
  const fromCertificate=['tin','taxpayerName','taxpayerStatus','previousTin',
    'registeredAddress','currentAddress','taxesCircle','taxesZone','certificateIssuedOn',
    'certificateLastUpdatedOn','issuingOfficer','taxOfficeAddress','taxOfficePhone'];
  assert.deepEqual(
    TAXPAYER_PROFILE_FIELD_ORDER.filter(row=>row[2]==='certificate').map(row=>row[0]).sort(),
    fromCertificate.sort(),'all certificate fields appear once in the combined profile');
  assert.equal(TAXPAYER_PROFILE_LAYOUT.summary[2][2],'tin_profile',
    'registered since is a separate TIN profile field, not falsely a certificate date');
  assert.equal(TAXPAYER_PROFILE_LAYOUT.summary[3][2],'account',
    'last account login does not come from the certificate');
  assert.equal(TAXPAYER_PROFILE_LAYOUT.contact[0][2],'tin_profile');
  assert.equal(TAXPAYER_PROFILE_LAYOUT.contact[1][2],'tin_profile');
  assert.equal(TAXPAYER_PROFILE_LAYOUT.certificate[4][0],'taxOfficePhone');
  assert.equal(sample.taxesCircle,'Circle-245 (Company)');
  assert.equal(sample.taxpayerStatus,'Individual');
  assert.equal(sample.tinType,'Individual');
  assert.equal(sample.registeredAddress,sample.currentAddress,
    'identical sample address values still represent two distinct certificate fields');
});
