import test from 'node:test';
import assert from 'node:assert/strict';
import {retryStory1OwnershipClaim,type ClaimActor} from '../src/services/story1OwnershipClaim';
const actor={userId:'original',accessToken:'test-token'};
const other={userId:'other',accessToken:'different-test-token'};
const pause=async()=>{};
test('transient returned error retries only claim, without another payment',async()=>{
 let calls=0;const sent:string[]=[];
 assert.equal(await retryStory1OwnershipClaim(actor,async()=>actor,async a=>{sent.push(a.userId);return ++calls===1?'retryable':'acknowledged'},pause),'acknowledged');
 assert.equal(calls,2);assert.deepEqual(sent,['original','original']);
});
test('network error retries without changing actor',async()=>{
 let calls=0;
 assert.equal(await retryStory1OwnershipClaim(actor,async()=>actor,async()=>{if(++calls===1)throw Error('network');return 'acknowledged'},pause),'acknowledged');assert.equal(calls,2);
});
test('account switch prevents all further claim attempts',async()=>{
 let calls=0;let current:ClaimActor=actor;
 assert.equal(await retryStory1OwnershipClaim(actor,async()=>current,async()=>{calls++;current=other;return 'retryable'},pause),'skipped');assert.equal(calls,1);
});
test('rotated session token is rejected, even if same user',async()=>{
 let calls=0;assert.equal(await retryStory1OwnershipClaim(actor,async()=>({...actor,accessToken:'rotated'}),async()=>{calls++;return 'acknowledged'},pause),'skipped');assert.equal(calls,0);
});
test('permanent denial does not repeat and is not acknowledged',async()=>{
 let calls=0;assert.equal(await retryStory1OwnershipClaim(actor,async()=>actor,async()=>{calls++;return 'denied'},pause),'pending');assert.equal(calls,1);
});
test('exhausted retries are pending, not success',async()=>{
 let calls=0;assert.equal(await retryStory1OwnershipClaim(actor,async()=>actor,async()=>{calls++;return 'retryable'},pause),'pending');assert.equal(calls,3);
});
test('guest never claims automatically',async()=>{
 let calls=0;assert.equal(await retryStory1OwnershipClaim(null,async()=>actor,async()=>{calls++;return 'acknowledged'},pause),'skipped');assert.equal(calls,0);
});
