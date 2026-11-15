import assert from 'node:assert/strict';
import {after,beforeEach,test} from 'node:test';

// The module reads public test-only configuration at import time. No hosted
// production keys, Auth session, taxpayer ID or financial records are used.
process.env.VITE_SUPABASE_URL='https://m02-session-test.invalid';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-public-key';
delete process.env.VITE_SUPABASE_DISABLED;

const storage=new Map<string,string>();
const localStorage=new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{
  sessionStorage:{
    getItem:(key:string)=>storage.get(key)??null,
    setItem:(key:string,value:string)=>{storage.set(key,value);},
    removeItem:(key:string)=>{storage.delete(key);},
  },
  localStorage:{
    getItem:(key:string)=>localStorage.get(key)??null,
    setItem:(key:string,value:string)=>{localStorage.set(key,value);},
    removeItem:(key:string)=>{localStorage.delete(key);},
  },
}});
const originalFetch=globalThis.fetch;
type Request={action:string;resolve:(response:Response)=>void};
const waiting:Request[]=[];
const delayedLoginIds=new Set<string>();
async function takePending(action:string):Promise<Request>{
  // savePreviewSetting queues a promise chain; one microtask tick is insufficient.
  for(let i=0;i<20 && !waiting.length;i++)await Promise.resolve();
  assert.equal(waiting.length,1,`Expected an in-flight ${action} request`);
  const request=waiting.shift()!;
  assert.equal(request.action,action);
  return request;
}
let loginCount=0;
const response=(data:unknown)=>new Response(JSON.stringify({success:true,data}),{
  status:200,headers:{'content-type':'application/json'},
});
const loginResponse=(id:string,sequence:number)=>response({
  profileId:id,
  capability:String.fromCharCode(96+sequence).repeat(43),
  paymentSessionId:'00000000-0000-4000-8000-0000000000'+String(sequence).padStart(2,'0'),
  language:'en',selectedListId:null,
});
globalThis.fetch=async (_input,init)=>{
  const body=JSON.parse(String(init?.body)) as {action:string;userId?:string};
  if(body.action==='demo-login'){
    loginCount++;
    if(delayedLoginIds.has(body.userId??'')){
      return new Promise<Response>(resolve=>waiting.push({action:'demo-login',resolve}));
    }
    return loginResponse(body.userId!,loginCount);
  }
  return new Promise<Response>(resolve=>waiting.push({action:body.action,resolve}));
};
const session=await import('../src/services/previewAccountSession');

beforeEach(()=>{
  session.clearPreviewSession();
  storage.clear();
  localStorage.clear();
  waiting.length=0;
  delayedLoginIds.clear();
  loginCount=0;
});
after(async()=>{
  // The draft service constructs a real Supabase client against this invalid
  // test origin. Stop its refresh timer before removing the browser stub.
  const {supabase}=await import('../src/services/supabaseClient');
  await supabase?.auth.stopAutoRefresh();
  globalThis.fetch=originalFetch;
});

test('late settings read cannot resurrect a different preview owner after account switch',async()=>{
  const first=await session.signInPreviewProfile('user1','user1');
  assert.ok(first);
  const read=session.getPreviewSettings();
  const delayed=await takePending('demo-settings');
  const next=await session.signInPreviewProfile('user2','user2');
  assert.ok(next);
  delayed.resolve(response({
    language:'bn',selectedListId:null,paymentSessionId:first.paymentSessionId,
  }));
  await assert.rejects(read,/Demo account changed/);
  assert.equal(session.activePreviewSession()?.profileId,'user2');
  assert.equal(session.activePreviewSession()?.capability,next.capability);
  assert.equal(session.activePreviewSession()?.language,'en');
});

test('old setting save cannot overwrite a newly issued capability for the same profile',async()=>{
  const old=await session.signInPreviewProfile('user1','user1');
  assert.ok(old);
  const oldWrite=session.savePreviewSetting('language','bn');
  const delayed=await takePending('demo-settings');
  const renewed=await session.signInPreviewProfile('user1','user1');
  assert.ok(renewed);
  assert.notEqual(renewed.capability,old.capability);
  delayed.resolve(response({
    language:'bn',selectedListId:null,paymentSessionId:old.paymentSessionId,
  }));
  await assert.rejects(oldWrite,/Demo account changed/);
  assert.equal(session.activePreviewSession()?.capability,renewed.capability);
  assert.equal(session.activePreviewSession()?.language,'en');

  const newWrite=session.savePreviewSetting('language','bn');
  const fresh=await takePending('demo-settings');
  fresh.resolve(response({
    language:'bn',selectedListId:null,paymentSessionId:renewed.paymentSessionId,
  }));
  await newWrite;
  assert.equal(session.activePreviewSession()?.language,'bn');
  assert.equal(session.activePreviewSession()?.capability,renewed.capability);
});

test('clearing a preview session cannot be undone by a delayed saved setting',async()=>{
  await session.signInPreviewProfile('user1','user1');
  const old=session.activePreviewSession()!;
  const saving=session.savePreviewSetting('language','bn');
  const delayed=await takePending('demo-settings');
  session.clearPreviewSession();
  delayed.resolve(response({
    language:'bn',selectedListId:null,paymentSessionId:old.paymentSessionId,
  }));
  await assert.rejects(saving,/Demo account changed/);
  assert.equal(session.activePreviewSession(),null);
});

test('slow older sign-in cannot replace a newer authenticated preview session',async()=>{
  delayedLoginIds.add('user1');
  const oldAttempt=session.signInPreviewProfile('user1','user1');
  const deferred=await takePending('demo-login');
  const newest=await session.signInPreviewProfile('user2','user2');
  assert.equal(newest?.profileId,'user2');
  deferred.resolve(loginResponse('user1',1));
  await assert.rejects(oldAttempt,/Demo account changed/);
  assert.equal(session.activePreviewSession()?.profileId,'user2');
  assert.equal(session.activePreviewSession()?.capability,newest?.capability);
});

test('sign-out invalidates a preview sign-in still waiting on the network',async()=>{
  delayedLoginIds.add('user1');
  const oldAttempt=session.signInPreviewProfile('user1','user1');
  const deferred=await takePending('demo-login');
  session.clearPreviewSession();
  deferred.resolve(loginResponse('user1',1));
  await assert.rejects(oldAttempt,/Demo account changed/);
  assert.equal(session.activePreviewSession(),null);
});

test('preview draft list refuses a late response from an old capability for the same demo profile',async()=>{
  const old=await session.signInPreviewProfile('user1','user1');
  assert.ok(old);
  const drafts=await import('../src/services/accountPaymentFormDrafts');
  const reading=drafts.listPaymentFormDrafts({kind:'preview',profileId:'user1'});
  const delayed=await takePending('payment-draft-list');

  // User 1 signs in again while their earlier draft response is in flight.
  // The newly issued server capability must invalidate the old response.
  const current=await session.signInPreviewProfile('user1','user1');
  assert.ok(current);
  assert.notEqual(old.capability,current.capability);
  delayed.resolve(response([]));

  await assert.rejects(reading,/Sign in to your account again/);
  assert.equal(session.activePreviewSession()?.capability,current.capability);
  assert.equal(session.activePreviewSession()?.paymentSessionId,current.paymentSessionId);
});

test('preview draft list still accepts a response from the unchanged capability',async()=>{
  const current=await session.signInPreviewProfile('user1','user1');
  assert.ok(current);
  const drafts=await import('../src/services/accountPaymentFormDrafts');
  const reading=drafts.listPaymentFormDrafts({kind:'preview',profileId:'user1'});
  const request=await takePending('payment-draft-list');
  request.resolve(response([]));
  assert.deepEqual(await reading,[]);
  assert.equal(session.activePreviewSession()?.capability,current.capability);
});

test('draft owner scope distinguishes two capabilities for the same preview account',async()=>{
  const drafts=await import('../src/services/accountPaymentFormDrafts');
  const actor={kind:'preview' as const,profileId:'user1'};
  const first=await session.signInPreviewProfile('user1','user1');
  assert.ok(first);
  const before=drafts.paymentDraftOwnerScope(actor);
  assert.equal(before,'preview:user1:'+first.paymentSessionId);
  const second=await session.signInPreviewProfile('user1','user1');
  assert.ok(second);
  assert.notEqual(second.paymentSessionId,first.paymentSessionId);
  const after=drafts.paymentDraftOwnerScope(actor);
  assert.equal(after,'preview:user1:'+second.paymentSessionId);
  assert.notEqual(before,after);
  assert.equal(drafts.paymentDraftOwnerScope({kind:'authenticated',userId:'owner-a'}),'authenticated:owner-a');
  assert.equal(drafts.paymentDraftOwnerScope(null),'');
});

test('guest draft UI owner scope changes on capability rotation without exposing its token',async()=>{
  const drafts=await import('../src/services/accountPaymentFormDrafts');
  const actor={kind:'guest' as const};
  const key='korbritto.guest-beneficiaries.capability.v1';
  const oldToken='A'.repeat(43);
  const newToken='B'.repeat(43);
  const unavailable=drafts.paymentDraftOwnerScope(actor);
  assert.match(unavailable,/^guest:unavailable:\d+$/);
  localStorage.set(key,oldToken);
  const first=drafts.paymentDraftOwnerScope(actor);
  assert.match(first,/^guest:session:\d+$/);
  assert.equal(first,drafts.paymentDraftOwnerScope(actor));
  assert.equal(first.includes(oldToken),false,'React owner scope must not contain a bearer capability');
  localStorage.set(key,newToken);
  const second=drafts.paymentDraftOwnerScope(actor);
  assert.notEqual(second,first,'a new guest capability invalidates the prior draft owner UI');
  assert.equal(second.includes(newToken),false);
  localStorage.delete(key);
  assert.notEqual(drafts.paymentDraftOwnerScope(actor),second);
  localStorage.set(key,oldToken);
  assert.notEqual(drafts.paymentDraftOwnerScope(actor),first,
    'A -> B -> A capability switch must not accept delayed results from the first A session');
  localStorage.set(key,'not-a-capability');
  assert.match(drafts.paymentDraftOwnerScope(actor),/^guest:unavailable:\d+$/);
});
