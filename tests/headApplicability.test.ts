import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidateHeadApplicability, evaluateProductionHeadApplicability,
 type ApplicabilityFacts, type SourcedApplicability } from '../src/services/headApplicability.ts';
const heads = new Set([1, 5, 150]);
const facts: ApplicabilityFacts = {
 headId:1, taxpayerClass:'INDIVIDUAL', paymentEvent:'RETURN',
 eventDate:'2099-06-30', incomeYear:'2098-99', assessmentYear:'2099-00'
};
const synthetic: SourcedApplicability = {
 headId:1,sourceId:'SYNTHETIC-ONLY-NOT-LAW',sourceVerified:true,legalApproved:true,
 version:1,taxpayerClasses:['INDIVIDUAL'],paymentEvents:['RETURN'],
 effectiveFrom:'2099-01-01',effectiveTo:'2099-12-31',
 incomeYear:'2098-99',assessmentYear:'2099-00'
};
test('real TaxPay v11 candidates always remain fail-closed without authoritative rules',()=>{
 const r=evaluateProductionHeadApplicability(facts,heads);
 assert.equal(r.decision,'NO_VERIFIED_SOURCE');
 assert.equal(r.financialExecutionAllowed,false);
 assert.equal(r.sourceId,null);
});
test('synthetic matching rule demonstrates applicability without authorizing payment',()=>{
 const r=evaluateCandidateHeadApplicability(facts,heads,[synthetic]);
 assert.equal(r.decision,'PROVISIONALLY_APPLICABLE');
 assert.equal(r.sourceId,'SYNTHETIC-ONLY-NOT-LAW');
 assert.equal(r.financialExecutionAllowed,false);
});
test('taxpayer, event, effective date, IY and AY must all match independently',()=>{
 const variants: Partial<ApplicabilityFacts>[] = [
 {taxpayerClass:'COMPANY'},{paymentEvent:'ADVANCE'},{eventDate:'2098-12-31'},
 {eventDate:'2100-01-01'},{incomeYear:'2097-98'},{assessmentYear:'2098-99'}
 ];
 for (const v of variants) {
  const r=evaluateCandidateHeadApplicability({...facts,...v},heads,[synthetic]);
  assert.equal(r.decision,'NOT_APPLICABLE', JSON.stringify(v));
  assert.equal(r.financialExecutionAllowed,false);
 }
});
test('two overlapping rules fail closed rather than silently prioritizing versions',()=>{
 const duplicate={...synthetic,sourceId:'SECOND-SYNTHETIC',version:2};
 const r=evaluateCandidateHeadApplicability(facts,heads,[synthetic,duplicate]);
 assert.equal(r.decision,'CONFLICT');
 assert.equal(r.financialExecutionAllowed,false);
});
test('unverified, unapproved, undated and unknown evidence cannot unlock applicability',()=>{
 const bad:SourcedApplicability[]=[
 {...synthetic,sourceVerified:false},
 {...synthetic,legalApproved:false},
 {...synthetic,effectiveTo:'not-a-date'},
 {...synthetic,sourceId:' '}
 ];
 for (const row of bad) {
  const r=evaluateCandidateHeadApplicability(facts,heads,[row]);
  assert.equal(r.decision,'NO_VERIFIED_SOURCE');
 }
 assert.equal(evaluateCandidateHeadApplicability({...facts,headId:171},heads,[synthetic]).decision,'NO_VERIFIED_SOURCE');
});
test('invalid fact formats never produce a payable result',()=>{
 const invalid=[{eventDate:'2099-02-29'},{eventDate:'2099-13-01'},
   {incomeYear:'2098-00'},{assessmentYear:''},{headId:-1}];
 for(const override of invalid){
  const r=evaluateCandidateHeadApplicability({...facts,...override},heads,[synthetic]);
  assert.equal(r.decision,'INVALID_FACTS');
  assert.equal(r.financialExecutionAllowed,false);
 }
});
