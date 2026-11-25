import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorizationSyncError,activeAuthorizationFor,getHostedAuthorizations,
  performHostedAuthorization,retryHostedAuthorizationSync,userIdForHostedTin,type HostedAuthorization
} from '../src/services/hostedDemoAuthorizations';


// Node tests simulate only the browser's server-issued preview-session
// possession proof. They never authenticate against hosted Supabase.
function previewSession(actor:'user1'|'user2'){
  const old=Object.getOwnPropertyDescriptor(globalThis,'window');
  const id='00000000-0000-4000-8000-000000000001';
  const raw=JSON.stringify({profileId:actor,capability:'A'.repeat(43),
    paymentSessionId:id,language:'en',selectedListId:null});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{
    sessionStorage:{getItem:(key:string)=>key==='taxpay-taxpayer-preview-user'?actor:
      key==='korbritto.demo-profile-session.v1'?raw:null}
  }});
  return ()=>{if(old)Object.defineProperty(globalThis,'window',old);
    else Reflect.deleteProperty(globalThis,'window');};
}

test('all ten synthetic TINs resolve, including user2 and user10',()=>{
  for(let i=1;i<=9;i++)assert.equal(userIdForHostedTin(String(i).repeat(13)),`user${i}`);
  assert.equal(userIdForHostedTin('2222222222222'),'user2');
  assert.equal(userIdForHostedTin('1010101010101'),'user10');
  assert.equal(userIdForHostedTin('0000000000000'),null);
});

test('third-party payments require an ACTIVE request for the exact payer and beneficiary',()=>{
  const row={id:'req-1',payerId:'user1',taxpayerId:'user2',status:'CODE_ISSUED',
    requestedAt:0,codeExpiresAt:1000,consentCode:null,confirmedAt:null,
    activeUntil:null,attempts:0,revokedAt:null} satisfies HostedAuthorization;
  assert.equal(activeAuthorizationFor([row],'user1','user2'),undefined);
  const approved={...row,status:'ACTIVE' as const};
  assert.equal(activeAuthorizationFor([approved],'user1','user2')?.id,'req-1');
  assert.equal(activeAuthorizationFor([approved],'user2','user1'),undefined);
  assert.equal(activeAuthorizationFor([approved],'user1','user3'),undefined);
});

test('request and recipient inbox use the shared SQL endpoint and hide caller-controlled fields',async()=>{
  const original=globalThis.fetch;
  const calls:Array<{url:string;body?:Record<string,unknown>;capability?:string}>=[];
  globalThis.fetch=(async(input:RequestInfo|URL,options?:RequestInit)=>{
    calls.push({url:String(input),body:options?.body?JSON.parse(String(options.body)):undefined,
      capability:(options?.headers as Record<string,string>)?.['x-taxpay-guest-capability']});
    return new Response(JSON.stringify({success:true,mirrored:true,data:
      options?.method==='POST'?{id:'test-id',status:'PENDING',attempts:0}:[]}),
      {status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  const restore1=previewSession('user1');
  try{
    await performHostedAuthorization('user1','request',{tin:'2222222222222'});
    restore1();
    const restore2=previewSession('user2');
    try{await getHostedAuthorizations('user2');}finally{restore2();}
    assert.match(calls[0].url,/\/authorizations$/);
    assert.deepEqual(calls[0].body,{actor:'user1',action:'request',tin:'2222222222222'});
    assert.match(calls[1].url,/actor=user2$/);
    assert.equal(calls[0].capability,'A'.repeat(43));
    assert.equal(calls[1].capability,'A'.repeat(43));
  }finally{restore1();globalThis.fetch=original;}
});

test('resend and delete actions keep the request identity and actor on the SQL API',async()=>{
  const original=globalThis.fetch;
  const actions:Array<Record<string,unknown>>=[];
  globalThis.fetch=(async(_input:RequestInfo|URL,options?:RequestInit)=>{
    actions.push(JSON.parse(String(options?.body)) as Record<string,unknown>);
    return new Response(JSON.stringify({success:true,mirrored:true,
      data:{id:'req-2',status:'CODE_ISSUED',attempts:0,codeResends:1,consentCode:null}}),
    {status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  const restore=previewSession('user1');
  try{
    await performHostedAuthorization('user1','resend',{id:'req-2'});
    await performHostedAuthorization('user1','delete',{id:'req-2'});
    assert.deepEqual(actions,[
      {actor:'user1',action:'resend',id:'req-2'},
      {actor:'user1',action:'delete',id:'req-2'},
    ]);
  }finally{restore();globalThis.fetch=original;}
});

test('reports partial TaxPay to Office writes as retryable synchronization errors',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=(async()=>new Response(JSON.stringify({
    success:false,error:'OFFICE_SYNC_PENDING',requestId:'request-id',retryable:true
  }),{status:503,headers:{'Content-Type':'application/json'}})) as typeof fetch;
  const restore=previewSession('user1');
  try{
    await assert.rejects(()=>performHostedAuthorization('user1','request',{tin:'2222222222222'}),
      (error:unknown)=>error instanceof AuthorizationSyncError&&error.requestId==='request-id');
  }finally{restore();globalThis.fetch=original;}
});

test('anonymous and cross-account consent actions never reach the network',async()=>{
  const oldFetch=globalThis.fetch;
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Reflect.deleteProperty(globalThis,'window');
  let calls=0;
  globalThis.fetch=(async()=>{calls++;throw Error('no request expected');}) as typeof fetch;
  try{
    await assert.rejects(()=>getHostedAuthorizations('user1'),/Sign in to the selected demo account/);
    const restore=previewSession('user1');
    try{
      await assert.rejects(()=>getHostedAuthorizations('user2'),/Sign in to the selected demo account/);
      await assert.rejects(()=>performHostedAuthorization('user2','accept',{id:'forged'}),/Sign in to the selected demo account/);
      await assert.rejects(()=>retryHostedAuthorizationSync('forged','user2'),/Sign in to the selected demo account/);
    }finally{restore();}
    assert.equal(calls,0);
  }finally{
    globalThis.fetch=oldFetch;
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);
    else Reflect.deleteProperty(globalThis,'window');
  }
});

test('authorization sync sends the same verified actor and capability',async()=>{
  const restore=previewSession('user1');
  const original=globalThis.fetch;
  let payload:unknown;
  let capability:unknown;
  globalThis.fetch=(async(_input:RequestInfo|URL,options?:RequestInit)=>{
    payload=JSON.parse(String(options?.body));
    capability=(options?.headers as Record<string,string>)?.['x-taxpay-guest-capability'];
    return new Response(JSON.stringify({success:true,data:{id:'request-1'}}),
      {headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try{
    await retryHostedAuthorizationSync('request-1','user1');
    assert.deepEqual(payload,{id:'request-1',actor:'user1'});
    assert.equal(capability,'A'.repeat(43));
  }finally{restore();globalThis.fetch=original;}
});
