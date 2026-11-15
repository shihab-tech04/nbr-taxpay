import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnboundRegistrationRpcError,parseOwnerRegistrationRow,resolveAuthenticatedRegistrationProfile,
  type VerifiedRegistrationReader,
} from '../src/services/authenticatedRegistrationProfile';
import type {TaxpayerTinProfile} from '../src/contracts/taxpayerTinProfile';

const accountId='user1';
const profile:TaxpayerTinProfile={
  source:'REVIEWED_CERTIFICATE',sourceUpdatedAt:'2026-11-01T12:00:00Z',
  tin:'123456789012',taxpayerName:'Fixture taxpayer',taxpayerStatus:'Individual',
  tinType:null,tinSubtype:null,registeredOn:null,userType:null,localTaxpayer:null,
  previousTin:null,taxesCircle:null,taxesZone:null,taxesRange:null,district:null,
  country:null,registeredAddress:null,currentAddress:null,mobileNumber:null,
  emailAddress:null,certificateIssuedOn:null,certificateLastUpdatedOn:null,
  issuingOfficer:null,taxOfficeAddress:null,taxOfficePhone:null,lastLoginAt:null,
};
const row=()=>({account_id:accountId,tin:profile.tin,profile,revision:1,updated_at:profile.sourceUpdatedAt});
function reader(overrides:Partial<VerifiedRegistrationReader>={}):VerifiedRegistrationReader{
 return {
   currentAuthUid:async()=> 'owner-a',
   boundAccountId:async()=>accountId,
   readProfile:async()=>row(),
   ...overrides,
 };
}

test('verified Auth + server binding returns only exact sourced registration record',async()=>{
 const requested:string[]=[];
 const result=await resolveAuthenticatedRegistrationProfile('owner-a',reader({
   readProfile:async id=>{requested.push(id);return row();},
 }));
 assert.equal(result,profile);
 assert.deepEqual(requested,['user1']);
});

test('unbound Auth owner cannot acquire a profile by typed TIN or global record availability',async()=>{
 let reads=0;
 const result=await resolveAuthenticatedRegistrationProfile('owner-a',reader({
   boundAccountId:async()=>null,
   readProfile:async()=>{reads++;return row();},
 }));
 assert.equal(result,null);
 assert.equal(reads,0);
 await assert.rejects(resolveAuthenticatedRegistrationProfile('owner-a',reader({
   boundAccountId:async()=>profile.tin,
 })),/binding invalid/);
});

test('a different, expired or switched Auth session cannot see another owner profile',async()=>{
 let readCalls=0;
 await assert.rejects(resolveAuthenticatedRegistrationProfile('owner-a',reader({
   currentAuthUid:async()=> 'owner-b',
   readProfile:async()=>{readCalls++;return row();},
 })),/Account session changed/);
 assert.equal(readCalls,0);
 let authCall=0;
 await assert.rejects(resolveAuthenticatedRegistrationProfile('owner-a',reader({
   currentAuthUid:async()=>++authCall===1?'owner-a':'owner-b',
   readProfile:async()=>{readCalls++;return row();},
 })),/Account session changed/);
 assert.equal(readCalls,0);
 authCall=0;
 await assert.rejects(resolveAuthenticatedRegistrationProfile('owner-a',reader({
   currentAuthUid:async()=>++authCall<=2?'owner-a':'owner-b',
   readProfile:async()=>{readCalls++;return row();},
 })),/Account session changed/);
 assert.equal(readCalls,1);
});

test('foreign, malformed or inconsistent source rows fail closed and cannot leak',()=>{
 assert.equal(parseOwnerRegistrationRow(row(),accountId),profile);
 for(const invalid of [
   {...row(),account_id:'user2'},
   {...row(),tin:'555555555555'},
   {...row(),profile:{...profile,tin:'333333333333'}},
   {...row(),revision:0},
   {...row(),updated_at:'not a timestamp'},
   {...row(),profile:{...profile,sourceUpdatedAt:'invalid'}},
   {...row(),profile:Object.fromEntries(Object.entries(profile).filter(([field])=>field!=='taxpayerName'))},
   {...row(),profile:{...profile,unapprovedIdentifier:'not allowed'}},
   {...row(),profile:{...profile,taxesCircle:123}},
 ])assert.throws(()=>parseOwnerRegistrationRow(invalid,accountId),/mismatch/);
});

test('only the exact existing SQL missing-binding exception becomes a safe unlinked state',()=>{
 assert.equal(isUnboundRegistrationRpcError({
   code:'P0001',message:'No approved synthetic profile binding',
 }),true);
 for(const error of [
   null,
   {code:'42501',message:'No approved synthetic profile binding'},
   {code:'P0001',message:'Authentication required'},
   {code:'P0001',message:'Another database rule failed'},
   {code:'PGRST301',message:'Unauthorized'},
   {code:'P0001',message:'No approved synthetic profile binding for another actor'},
 ])assert.equal(isUnboundRegistrationRpcError(error),false);
});
