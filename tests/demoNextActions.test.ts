import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoNextActions, nextActionDescription } from '../src/services/demoNextActions';
import type { DemoSqlServiceRecord } from '../src/services/demoSqlProfiles';

function row(id: string, state: DemoSqlServiceRecord['state'], serviceCode: DemoSqlServiceRecord['serviceCode'], recordedAt='2026-10-20T12:00:00Z'): DemoSqlServiceRecord {
  return {recordId:id,userId:'user1',serviceCode,assessmentYear:'2026-27',
    amountMinor:123400,state,participantRole:'PAYER',relatedUserId:null,
    recordedAt,simulationOnly:true};
}
test('empty account only offers exploration without suggesting an amount due',()=>{
  const actions=buildDemoNextActions([]);
  assert.deepEqual(actions,[{id:'explore-services',kind:'explore',serviceCode:null,reason:'first'}]);
});
test('prioritize failed, reversed, pending over previous simulated use',()=>{
  const a=buildDemoNextActions([
    row('a','SIMULATED','TRAVEL_TAX'),row('b','PENDING','ADVANCE_TAX'),
    row('c','FAILED','ASSESSED_DEMAND'),row('d','REVERSED','PENALTY')]);
  assert.deepEqual(a.map(x=>x.reason),['failed','reversed','previous']);
  assert.equal(a[2].serviceCode,'TRAVEL_TAX');
});
test('deduplicate attention by service and avoid automatic repayment suggestions',()=>{
  const a=buildDemoNextActions([
    row('a','PENDING','PENALTY'),row('b','FAILED','PENALTY'),row('c','REVIEW_REQUIRED','SOURCE_TAX_DEPOSIT')]);
  assert.deepEqual(a.map(x=>x.id),['b','c']);
  assert.ok(a.every(x=>x.kind==='review'));
  assert.match(nextActionDescription(a[0],'en'),/before deciding/);
});
test('previous payments only produce service navigation; never liability estimates',()=>{
  const a=buildDemoNextActions([row('s','SIMULATED','TAX_WITH_RETURN')]);
  assert.deepEqual(a,[{id:'previous-TAX_WITH_RETURN',kind:'explore',serviceCode:'TAX_WITH_RETURN',reason:'previous'}]);
  assert.ok(!('amount' in a[0]));
  assert.ok(nextActionDescription(a[0],'bn').length>0);
});
