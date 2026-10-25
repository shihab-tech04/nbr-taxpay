import assert from 'node:assert/strict';
import test from 'node:test';
import {taxpayerGreeting,isReturningTaxpayer} from '../src/services/taxpayerGreeting';

test('greeting uses the selected language and time of day',()=>{
  assert.deepEqual(taxpayerGreeting('en',9,'Md. Arif Rahman',true),{
    salutation:'Good morning',welcome:'Welcome back, Md. Arif Rahman'
  });
  assert.deepEqual(taxpayerGreeting('en',14,'Md. Arif Rahman',false),{
    salutation:'Good afternoon',welcome:'Welcome, Md. Arif Rahman'
  });
  assert.deepEqual(taxpayerGreeting('bn',19,'আরিফ রহমান',true),{
    salutation:'শুভ সন্ধ্যা',welcome:'আবারও স্বাগতম আরিফ রহমান'
  });
});
test('missing account name never becomes a fabricated taxpayer name',()=>{
  assert.equal(taxpayerGreeting('en',8,'',false).welcome,'Welcome');
  assert.equal(taxpayerGreeting('bn',8,undefined,false).welcome,'স্বাগতম');
});
test('new sign-ins are distinguished from prior logins using stable Auth timestamps',()=>{
  assert.equal(isReturningTaxpayer('2026-10-25T01:00:00Z','2026-10-25T01:01:00Z'),false);
  assert.equal(isReturningTaxpayer('2026-10-20T01:00:00Z','2026-10-25T01:01:00Z'),true);
  assert.equal(isReturningTaxpayer('broken','2026-10-25T01:01:00Z'),false);
  assert.equal(isReturningTaxpayer(undefined,undefined),false);
});
