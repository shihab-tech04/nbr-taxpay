import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAuthorizedTaxpayers, accountPaymentSuggestions } from '../src/services/signedInPaymentContext';
import type { HostedAuthorization } from '../src/services/hostedDemoAuthorizations';
import type { DemoSqlServiceRecord } from '../src/services/demoSqlProfiles';

const now = 1_800_000_000_000;
function authorization(id:string,payerId:'user1'|'user2', taxpayerId:'user2'|'user3', status:HostedAuthorization['status'], activeUntil:number|null):HostedAuthorization {
  return {id,payerId,taxpayerId,status,requestedAt:now-10000,codeExpiresAt:now+10000,
    consentCode:null,confirmedAt:now-1000,activeUntil,attempts:0,revokedAt:null};
}
function record(recordId:string,serviceCode:DemoSqlServiceRecord['serviceCode'],state:DemoSqlServiceRecord['state'],recordedAt='2026-10-28T09:00:00Z'):DemoSqlServiceRecord {
  return {recordId,userId:'user1',serviceCode,assessmentYear:'2026-27',amountMinor:10000,
    state,participantRole:'PAYER',relatedUserId:null,recordedAt,simulationOnly:true};
}

test('only payer-owned active unexpired authorizations appear and a duplicate beneficiary is counted once',()=>{
  const rows=[
    authorization('a','user1','user2','ACTIVE',null),
    authorization('duplicate','user1','user2','ACTIVE',now+20000),
    authorization('expired','user1','user3','ACTIVE',now-100),
    authorization('revoked','user1','user3','REVOKED',now+20000),
    authorization('another-payer','user2','user3','ACTIVE',now+20000)
  ];
  const actual=activeAuthorizedTaxpayers(rows,'user1',now);
  assert.deepEqual(actual.map(x=>x.tin),['2222222222222']);
  assert.equal(actual[0].authorizationId,'a');
  assert.equal(activeAuthorizedTaxpayers(rows,'user2',now).length,1);
});
test('only relevant historical service categories are suggested, with no fabricated amount',()=>{
  const rows=[
    record('a','TAX_WITH_RETURN','SIMULATED'),
    record('b','ADVANCE_TAX','SIMULATED'),
    record('c','PENALTY','PENDING'),
    record('d','TRAVEL_TAX','SIMULATED'),
  ];
  const own=accountPaymentSuggestions(rows,'TAX_WITH_RETURN');
  assert.deepEqual(own.map(x=>x.serviceCode),['TAX_WITH_RETURN']);
  const others=accountPaymentSuggestions(rows,'OTHER_TAX_PAYMENT');
  assert.deepEqual(others.map(x=>x.serviceCode),['ADVANCE_TAX','PENALTY']);
  assert.equal(others.find(x=>x.serviceCode==='PENALTY')?.requiresReview,true);
  assert.ok(others.every(x=>!('amount' in x) && !('amountMinor' in x)));
});
test('latest record state controls whether a repeated payment is blocked from suggestion actions',()=>{
  const rows=[
    record('old','PENALTY','SIMULATED','2026-10-01T00:00:00Z'),
    record('pending','PENALTY','PENDING','2026-10-28T00:00:00Z')
  ];
  assert.equal(accountPaymentSuggestions(rows,'OTHER_TAX_PAYMENT')[0].requiresReview,true);
});
