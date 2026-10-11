import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceChangeProposal} from '../src/services/sourceChangeProposal.ts';
const known=new Set([1,5,150]);
const valid={sourceHeadId:1,sourceDocumentSha256:'0'.repeat(64),
 reason:'Review the source translation before approval',
 proposedPatch:{suggestedEnglishLabel:'Synthetic proposed label only'}};
test('synthetic candidate proposal can be accepted for review without payment activation',()=>{
 const r=validateSourceChangeProposal(valid,known);
 assert.equal(r.acceptedForReview,true);
 assert.equal(r.executable,false);
 assert.equal(r.error,null);
});
test('unknown source head, invented hash and short reason cannot be proposed',()=>{
 const changes=[
 {...valid,sourceHeadId:171},
 {...valid,sourceDocumentSha256:'not-a-real-sha'},
 {...valid,reason:'short'},
 {...valid,proposedPatch:{}},
 {...valid,proposedPatch:[] as any}
 ];
 for(const c of changes){
  const r=validateSourceChangeProposal(c,known);
  assert.equal(r.acceptedForReview,false);
  assert.equal(r.executable,false);
  assert.ok(r.error);
 }
});
test('source proposal validation cannot grant any government approval or execution',()=>{
 const input={...valid,proposedPatch:{financial_execution_enabled:true,authority_reviewed:true}};
 const r=validateSourceChangeProposal(input,known);
 assert.equal(r.acceptedForReview,true);
 assert.equal(r.executable,false);
});
