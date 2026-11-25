import test from 'node:test';
import assert from 'node:assert/strict';
import {retryStory1OwnershipClaim,readStory1OwnedPaymentPage,type ClaimActor} from '../src/services/story1OwnershipClaim';
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

test('A-B-A session switching sends only the original signed bearer for account history',async()=>{
 let current:ClaimActor=actor;
 const read:typeof fetch=async(url,init)=>{
   current=other;
   assert.equal(String(url),'https://example.invalid/rest/v1/rpc/taxpay_my_story1_payments');
   assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer '+actor.accessToken);
   assert.deepEqual(JSON.parse(String(init?.body)),{p_page:2,p_per_page:100});
   current=actor;
   return Response.json({items:[],total:0,page:2});
 };
 assert.deepEqual(await readStory1OwnedPaymentPage(actor,async()=>current,'https://example.invalid/','test-key',2,read),{items:[],total:0,page:2});
});
test('account switch before history request prevents network access',async()=>{
 let calls=0;
 const read:typeof fetch=async()=>{calls++;return Response.json({});};
 await assert.rejects(readStory1OwnedPaymentPage(actor,async()=>other,'https://example.invalid','test-key',1,read),/Account identity changed/);
 assert.equal(calls,0);
});
test('account switch during history response rejects the data',async()=>{
 let current:ClaimActor=actor;
 const read:typeof fetch=async()=>{current=other;return Response.json({items:[{synthetic:true}]});};
 await assert.rejects(readStory1OwnedPaymentPage(actor,async()=>current,'https://example.invalid','test-key',1,read),/Account identity changed/);
});
test('same-account bearer rotation during history response is rejected',async()=>{
 let current:ClaimActor=actor;
 const read:typeof fetch=async()=>{current={...actor,accessToken:'rotated'};return Response.json({items:[]});};
 await assert.rejects(readStory1OwnedPaymentPage(actor,async()=>current,'https://example.invalid','test-key',1,read),/Account identity changed/);
});
test('failed history HTTP response is never treated as an empty or successful history',async()=>{
 const read:typeof fetch=async()=>new Response(null,{status:403});
 await assert.rejects(readStory1OwnedPaymentPage(actor,async()=>actor,'https://example.invalid','test-key',1,read),/Unable to verify/);
});
