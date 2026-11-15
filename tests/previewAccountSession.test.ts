import assert from 'node:assert/strict';
import {after,beforeEach,test} from 'node:test';

// The module reads public test-only configuration at import time. No hosted
// production keys, Auth session, taxpayer ID or financial records are used.
process.env.VITE_SUPABASE_URL='https://m02-session-test.invalid';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-public-key';
delete process.env.VITE_SUPABASE_DISABLED;

const storage=new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{
  sessionStorage:{
    getItem:(key:string)=>storage.get(key)??null,
    setItem:(key:string,value:string)=>{storage.set(key,value);},
    removeItem:(key:string)=>{storage.delete(key);},
  },
}});
const originalFetch=globalThis.fetch;
type Request={action:string;resolve:(response:Response)=>void};
const waiting:Request[]=[];
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
globalThis.fetch=async (_input,init)=>{
  const body=JSON.parse(String(init?.body)) as {action:string;userId?:string};
  if(body.action==='demo-login'){
    loginCount++;
    return response({
      profileId:body.userId,
      capability:String.fromCharCode(96+loginCount).repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-0000000000'+String(loginCount).padStart(2,'0'),
      language:'en',selectedListId:null,
    });
  }
  return new Promise<Response>(resolve=>waiting.push({action:body.action,resolve}));
};
const session=await import('../src/services/previewAccountSession');

beforeEach(()=>{
  session.clearPreviewSession();
  storage.clear();
  waiting.length=0;
  loginCount=0;
});
after(()=>{globalThis.fetch=originalFetch;});

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
