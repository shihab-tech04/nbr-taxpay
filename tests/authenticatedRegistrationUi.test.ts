import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TaxpayerTinInformation} from '../src/components/screens/TaxpayerTinInformation';
import type {TaxpayerTinProfile} from '../src/contracts/taxpayerTinProfile';

const fixture:TaxpayerTinProfile={
 source:'REVIEWED_CERTIFICATE',sourceUpdatedAt:'2026-11-01T10:00:00Z',
 tin:'123456789012',taxpayerName:'Test account owner',
 taxpayerStatus:'Individual',tinType:'Individual',tinSubtype:null,
 registeredOn:null,userType:null,localTaxpayer:null,previousTin:null,
 taxesCircle:null,taxesZone:null,taxesRange:null,district:null,country:null,
 registeredAddress:null,currentAddress:null,mobileNumber:'01712345678',
 emailAddress:'demo@example.invalid',certificateIssuedOn:null,
 certificateLastUpdatedOn:null,issuingOfficer:null,taxOfficeAddress:null,
 taxOfficePhone:'02-9588253',lastLoginAt:null,
};

test('M02 signed-in registration panel renders exactly 24 sourced fields and no raw identifiers',()=>{
 const html=renderToStaticMarkup(createElement(TaxpayerTinInformation,{language:'en',record:fixture}));
 assert.equal((html.match(/<dt\b/g)||[]).length,24,'approved source fields rendered once each');
 assert.match(html,/data-testid="authenticated-profile-summary"/);
 assert.match(html,/data-testid="authenticated-profile-detail-columns"/);
 assert.ok(html.includes('123*********'),'TIN masks all but its first three digits');
 assert.ok(html.includes('017********'),'phone masks all but its first three digits');
 assert.ok(html.includes('de***@****.***'),'email local prefix only');
 assert.ok(html.includes('02-9******'),'office phone masks after three digits');
 assert.ok(!html.includes('123456789012'),'raw TIN never appears in initial markup');
 assert.ok(!html.includes('01712345678'),'raw mobile number never appears in initial markup');
 assert.ok(!html.includes('demo@example.invalid'),'raw email never appears in initial markup');
 assert.ok(html.includes('aria-label="Show TIN"'));
 assert.ok(html.includes('aria-label="Copy TIN"'));
 assert.ok(html.includes('aria-label="Show Mobile number"'));
 assert.ok(html.includes('aria-label="Copy Mobile number"'));
 assert.ok(html.includes('aria-label="Show Email address"'));
 assert.ok(html.includes('aria-label="Copy Email address"'));
});

test('M02 registration panel fails closed with no identity source and preserves EN/BN empty states',()=>{
 for(const language of ['en','bn'] as const){
   const html=renderToStaticMarkup(createElement(TaxpayerTinInformation,{language,record:null}));
   assert.equal((html.match(/<dt\b/g)||[]).length,24,
     'Show every approved field with an unavailable placeholder, not an invented value');
   assert.equal((html.match(/<dd\b/g)||[]).length,24);
   assert.equal(html.split(language==='bn'?'পাওয়া যায়নি':'Not available').length-1,24);
   assert.ok(!html.includes('123456789012'));
   assert.ok(html.includes('role="status"'));
   assert.ok(html.includes(language==='bn'?'ই-টিআইএন':'e-TIN'));
 }
});


test('M02 keeps authenticated app account metadata inside the single approved identity card',()=>{
 const html=renderToStaticMarkup(createElement(TaxpayerTinInformation,{
   language:'en',record:fixture,accountDetails:createElement('div',{'data-testid':'account-facts'},'Account details')
 }));
 const root=html.indexOf('data-testid="taxpayer-tin-information"');
 const summary=html.indexOf('data-testid="authenticated-profile-summary"');
 const metadata=html.indexOf('data-testid="authenticated-profile-account-metadata"');
 const detailColumns=html.indexOf('data-testid="authenticated-profile-detail-columns"');
 assert.ok(root>=0&&summary>root&&metadata>summary&&detailColumns>metadata);
 assert.equal((html.match(/data-testid="authenticated-profile-account-metadata"/g)||[]).length,1);
 assert.equal((html.match(/<dt\b/g)||[]).length,24,'registration keys stay singular');
});
