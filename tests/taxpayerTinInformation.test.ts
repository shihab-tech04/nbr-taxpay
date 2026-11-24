import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TaxpayerTinInformation} from '../src/components/screens/TaxpayerTinInformation';
import {USER1_FICTIONAL_TIN_PROFILE} from '../src/data/user1FictionalTinProfile';
import {TAXPAYER_PROFILE_FIELD_ORDER} from '../src/contracts/taxpayerProfileFieldLayout';

const render=(language:'en'|'bn',record?:typeof USER1_FICTIONAL_TIN_PROFILE|null)=>
 renderToStaticMarkup(createElement(TaxpayerTinInformation,{language,record}));

test('missing authorized profile retains all 24 fields and a clear English empty state',()=>{
 const output=render('en',null);
 assert.equal(TAXPAYER_PROFILE_FIELD_ORDER.length,24);
 assert.equal(output.split('Not available').length-1,24,
   'Every existing profile field needs an unavailable value; no fields may disappear');
 assert.match(output,/Verified e-TIN data is not connected to this account/);
 assert.match(output,/role="status"/);
 assert.match(output,/e-TIN and taxpayer registration details/);
 assert.match(output,/TIN registration and jurisdiction/);
 assert.match(output,/Contact and addresses/);
 assert.match(output,/Certificate details/);
 assert.doesNotMatch(output,/\b(?:undefined|null|DEMO-TIN-\d{3})\b/);
});

test('missing authorized profile retains identical 24 fields and Bengali empty state',()=>{
 const output=render('bn',null);
 assert.equal(output.split('পাওয়া যায়নি').length-1,24);
 assert.match(output,/এই অ্যাকাউন্টের জন্য যাচাইকৃত ই-টিআইএন তথ্য/);
 assert.match(output,/ই-টিআইএন ও করদাতার নিবন্ধন তথ্য/);
 assert.match(output,/টিআইএন নিবন্ধন ও কর অধিক্ষেত্র/);
 assert.match(output,/যোগাযোগ ও ঠিকানা/);
 assert.match(output,/সনদের তথ্য/);
});

test('sourced User1 retains its original full profile and masks personal identifiers',()=>{
 for(const language of ['en','bn'] as const){
   const output=render(language,USER1_FICTIONAL_TIN_PROFILE);
   assert.doesNotMatch(output,/Not available|পাওয়া যায়নি/);
   for(const raw of [USER1_FICTIONAL_TIN_PROFILE.tin,
      USER1_FICTIONAL_TIN_PROFILE.mobileNumber,
      USER1_FICTIONAL_TIN_PROFILE.emailAddress]){
     if(typeof raw==='string')assert.equal(output.includes(raw),false,
       'A sensitive value must stay masked until the user explicitly reveals it');
   }
   assert.match(output,/aria-pressed="false"/);
   assert.match(output,/data-testid="taxpayer-tin-information"/);
 }
});
