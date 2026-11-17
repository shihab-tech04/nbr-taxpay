import test from 'node:test';
import assert from 'node:assert/strict';
import {assertReturnDraftExclusive,returnOnlyIssue,RETURN_YEARS,RETURN_HEAD_ID}
  from '../src/services/taxWithReturnContract.ts';
const standard={category:'TAX_WITH_RETURN',assessmentYear:'2026-27',additionalTaxpayers:[],
  oneTimeTaxpayer:null,otherTaxLines:[],selectedHeadIds:[125],amountInputs:{125:'12.50'}};
test('M04 Return draft accepts one-year single-recipient self and third-party inputs',()=>{
  for(const year of RETURN_YEARS){
    assert.doesNotThrow(()=>assertReturnDraftExclusive({...standard,assessmentYear:year,forSelf:false}));
    assert.doesNotThrow(()=>assertReturnDraftExclusive({...standard,assessmentYear:year,forSelf:true}));
  }
  assert.equal(RETURN_HEAD_ID,125);
  assert.equal(returnOnlyIssue(standard),null);
});
test('M04 Return draft rejects second person, separate year/head, or hidden amounts',()=>{
  for(const changed of [
    {additionalTaxpayers:[{tin:'000000000000'}]},
    {oneTimeTaxpayer:{tin:'000000000000'}},
    {otherTaxLines:[{headId:121,assessmentYear:'2025-26'}]},
    {selectedHeadIds:[125,121]},
    {sourceAllocationIds:['prior-1','prior-2']},
    {assessmentYear:'2026-27, 2025-26'},
    {assessmentYear:'2026-28'},
    {assessmentYear:'2010-11'},
    {assessmentYear:null},
    {amountInputs:{125:'12.50',121:'1.00'}},
  ]) assert.throws(()=>assertReturnDraftExclusive({...standard,...changed}));
});
test('M04 unsupported historical Pay Again year requires explicit re-selection before submit',()=>{
  const repeat={...standard,assessmentYear:''};
  assert.doesNotThrow(()=>assertReturnDraftExclusive(repeat));
  assert.equal(returnOnlyIssue(repeat),'year');
  assert.equal(returnOnlyIssue(repeat,true),null);
  assert.equal(returnOnlyIssue({...standard,additionalTaxpayers:[{}]}),'recipient');
  assert.equal(returnOnlyIssue({...standard,otherTaxLines:[{}]}),'head');
});
test('M04 other non-Return draft fields remain unchanged by the exclusive validator',()=>{
  assert.doesNotThrow(()=>assertReturnDraftExclusive({
    category:'OTHER_TAX_PAYMENT',otherTaxLines:[{headId:121},{headId:145}],
    additionalTaxpayers:[{},{}],assessmentYear:'2026-27, 2025-26'}));
});
