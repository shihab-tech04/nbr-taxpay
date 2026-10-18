import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorizationSyncError,activeAuthorizationFor,getHostedAuthorizations,
  performHostedAuthorization,userIdForHostedTin,type HostedAuthorization
} from '../src/services/hostedDemoAuthorizations';

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
  const calls:Array<{url:string;body?:Record<string,unknown>}>=[];
  globalThis.fetch=(async(input:RequestInfo|URL,options?:RequestInit)=>{
    calls.push({url:String(input),body:options?.body?JSON.parse(String(options.body)):undefined});
    return new Response(JSON.stringify({success:true,mirrored:true,data:
      options?.method==='POST'?{id:'test-id',status:'PENDING',attempts:0}:[]}),
      {status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try{
    await performHostedAuthorization('user1','request',{tin:'2222222222222'});
    await getHostedAuthorizations('user2');
    assert.match(calls[0].url,/\/authorizations$/);
    assert.deepEqual(calls[0].body,{actor:'user1',action:'request',tin:'2222222222222'});
    assert.match(calls[1].url,/actor=user2$/);
  }finally{globalThis.fetch=original;}
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
  try{
    await performHostedAuthorization('user1','resend',{id:'req-2'});
    await performHostedAuthorization('user1','delete',{id:'req-2'});
    assert.deepEqual(actions,[
      {actor:'user1',action:'resend',id:'req-2'},
      {actor:'user1',action:'delete',id:'req-2'},
    ]);
  }finally{globalThis.fetch=original;}
});

test('reports partial TaxPay to Office writes as retryable synchronization errors',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=(async()=>new Response(JSON.stringify({
    success:false,error:'OFFICE_SYNC_PENDING',requestId:'request-id',retryable:true
  }),{status:503,headers:{'Content-Type':'application/json'}})) as typeof fetch;
  try{
    await assert.rejects(()=>performHostedAuthorization('user1','request',{tin:'2222222222222'}),
      (error:unknown)=>error instanceof AuthorizationSyncError&&error.requestId==='request-id');
  }finally{globalThis.fetch=original;}
});
