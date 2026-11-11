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

test('fictional user1 can populate a profile without ever qualifying as issued e-TIN',async()=>{
  const {USER1_FICTIONAL_TIN_PROFILE:sample}=await import('../src/data/user1FictionalTinProfile');
  assert.equal(sample.source,'SYNTHETIC');
  assert.equal(sample.tin.length,13);
  assert.equal(isWellFormedTinProfile(sample),true);
  assert.equal(isWellFormedTinProfile({...sample,source:'NBR_TIN'}),false);
  const fields=['taxpayerName','taxpayerStatus','tinType','tinSubtype','registeredOn','userType',
    'localTaxpayer','previousTin','taxesCircle','taxesZone','taxesRange','district',
    'country','registeredAddress','currentAddress','mobileNumber','emailAddress',
    'certificateIssuedOn','certificateLastUpdatedOn','issuingOfficer','taxOfficeAddress',
    'taxOfficePhone','lastLoginAt'];
  for(const field of fields)assert.ok(String((sample as unknown as Record<string,unknown>)[field]).trim(),field);
  assert.equal(sample.emailAddress?.endsWith('@example.com'),true);
  assert.equal(sample.tin,'1111111111111');
});
