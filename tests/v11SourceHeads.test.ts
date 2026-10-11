import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { filterV11Heads, getVerifiedHeadReferences, isV11HeadReviewBlocked, V11_HEAD_GROUPS, V11_HEAD_SOURCE, V11_SOURCE_HEADS } from '../src/data/v11SourceHeads.ts';

const baselineBytes = readFileSync(new URL('../reference/v11_original_170_heads_UNVERIFIED.json', import.meta.url));
const baseline = JSON.parse(baselineBytes.toString('utf8'));

test('the original 170 record source snapshot is unchanged and matches the code catalogue', () => {
  assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'36ee10670f683e085c4a8b7c9ed5c557a4bbcfc52c4eb8700932eecbd5a4b3c2');
  assert.equal(baseline.source_sha256,V11_HEAD_SOURCE.sourceSha256);
  assert.equal(baseline.original_records.length,170);
  assert.deepEqual(V11_SOURCE_HEADS,baseline.original_records);
  assert.deepEqual(V11_SOURCE_HEADS.map(x=>x.id), Array.from({length:170},(_,i)=>i+1));
});
test('preserve disputed identifiers and Bangla gaps verbatim',()=>{
  assert.equal(V11_SOURCE_HEADS[0].codeEn,'16A');
  assert.equal(V11_SOURCE_HEADS[0].en,'Surcharge');
  assert.equal(V11_SOURCE_HEADS[4].codeEn,'19AAAAA');
  assert.equal(V11_SOURCE_HEADS[4].bn,null);
  assert.equal(V11_SOURCE_HEADS[124].codeEn,'74');
  assert.equal(V11_SOURCE_HEADS[124].en,'Tax with return');
  assert.equal(V11_SOURCE_HEADS[149].codeEn,'56(1)(28)');
  assert.equal(V11_SOURCE_HEADS[149].map,'OWNER_REVIEW');
});
test('all seven source groups and liability vs withholding assignment are preserved',()=>{
  assert.equal(V11_HEAD_GROUPS.length,7);
  assert.equal(V11_SOURCE_HEADS.filter(h=>h.journey==='WITHHOLDING').length,127);
  assert.equal(V11_SOURCE_HEADS.filter(h=>h.journey==='LIABILITY').length,43);
});
test('ids 5 and 150 remain blocked for owner/legal review',()=>{
  assert.deepEqual(V11_SOURCE_HEADS.filter(isV11HeadReviewBlocked).map(x=>x.id),[5,150]);
});
test('search returns matching source records but never silently selects an alternative',()=>{
  assert.deepEqual(filterV11Heads('16A').map(x=>x.id).includes(1),true);
  assert.deepEqual(filterV11Heads('সারচার্জ').map(x=>x.id),[1]);
  assert.deepEqual(filterV11Heads('no-such-original-code').map(x=>x.id),[]);
  assert.deepEqual(filterV11Heads('Surcharge','Source Tax').map(x=>x.id),[]);
  assert.equal(filterV11Heads('', 'Source Tax').length,127);
});
test('snapshot provides no invented financial economicCode or legal currency claim',()=>{
  assert.equal(V11_HEAD_SOURCE.legalStatus,'UNVERIFIED');
  assert.equal(V11_HEAD_SOURCE.accountingCodeStatus,'NOT_AVAILABLE');
  assert.equal(V11_SOURCE_HEADS.every(x=>!Object.prototype.hasOwnProperty.call(x,'economicCode')),true);
});

test('legacy prototype code is never silently promoted into statutory crosswalk', () => {
  for (const head of V11_SOURCE_HEADS) {
    const refs = getVerifiedHeadReferences(head);
    assert.equal(refs.originalSourceReference, head.codeEn);
    assert.equal(refs.verifiedOrdinance1984Section, null);
    assert.equal(refs.verifiedAct2023Section, null);
    assert.equal(refs.verifiedAcsEconomicCode, null);
  }
});
