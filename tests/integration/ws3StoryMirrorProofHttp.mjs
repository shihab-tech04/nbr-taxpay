/**
 * WS3 signed Story 1 transport over actual Taxpayer+Office Edge HTTP handlers.
 * Only RPC persistence is emulated: paired genuine SQL acceptance exists in
 * a different green gate. No production endpoints are contacted or modified.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createServer} from 'node:http';
import {randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const officeRoot=process.env.WS3_OFFICE_SOURCE;
assert.ok(officeRoot,'Office #270 exact source must be pinned');
const secret='ws3-isolated-service-key-with-no-hosted-access';
const store=new Map(),keys=new Map(),office=new Map();
const urls={};let failOfficeOnce=false,sourceReads=0;
function dataAccess(origin,name,args={}){
 if(origin==='TAXPAY_SQL'){
  if(name==='demo_story1_submit'){
   const p=args.p_input,previous=keys.get(p.idempotencyKey);
   if(previous){
    assert.deepEqual(store.get(previous).data,p,'Retry must keep exact source payload');
    return {id:previous,replayed:true};
   }
   const id=randomUUID();
   store.set(id,{id,sessionId:p.sessionId,data:structuredClone({...p,origin:'TAXPAY_UI'}),
    status:'SIMULATED_SUCCESS',createdAt:new Date().toISOString()});
   keys.set(p.idempotencyKey,id);
   return {id,replayed:false};
  }
  if(name==='taxpay_office_story1_mirror_read'){
   const p=store.get(args.p_id);
   return p?.sessionId===args.p_session?p:null;
  }
  if(name==='demo_story1_get'){
   const p=store.get(args.p_id);
   return p?.sessionId===args.p_session?p:null;
  }
  throw Error('Unsupported source SQL stand-in: '+name);
 }
 if(name==='demo_story1_mirror'){
  const p=args.p_input, prior=office.get(p.id);
  if(prior){
   assert.deepEqual(JSON.parse(JSON.stringify(prior)),JSON.parse(JSON.stringify(p)),'Office must not silently replace an original parent');
   return {id:p.id,replayed:true};
  }
  office.set(p.id,structuredClone(p));
  return {id:p.id,replayed:false};
 }
 throw Error('Unsupported Office SQL stand-in: '+name);
}
function routedFetch(input,init){
 const raw=typeof input==='string'?input:input.url,u=new URL(raw);
 let target;
 if(u.hostname==='ihbtabrvmyiwikqqbhrf.supabase.co'&&
   u.pathname.startsWith('/functions/v1/demo-story1-office/')){
  target=urls.OFFICE_SQL+u.pathname.replace('/functions/v1','')+u.search;
 }else if(u.hostname==='eyqhoavnitkrajvyqvxn.supabase.co'&&
   u.pathname.startsWith('/functions/v1/demo-story1-taxpay/')){
  target=urls.TAXPAY_SQL+u.pathname.replace('/functions/v1','')+u.search;
 }else throw Error('Blocked external URL in isolated Edge HTTP test');
 if(failOfficeOnce && target.includes('/demo-story1-office/mirror')){
  failOfficeOnce=false;
  return Promise.resolve(new Response(JSON.stringify({success:false,error:'DISPOSABLE_OFFICE_OUTAGE'}),
   {status:503,headers:{'content-type':'application/json'}}));
 }
 if(target.includes('/demo-story1-taxpay/payments/')&&init?.method!=='POST')sourceReads++;
 return fetch(target,init);
}
function loadHandler(file,origin){
 let handler=null;
 const cache=new Map();
 const deno={env:{get(key){
  if(key==='SUPABASE_URL')return 'https://isolated-'+origin+'.invalid';
  if(key==='SUPABASE_ANON_KEY')return 'local-publishable';
  if(key==='SUPABASE_SERVICE_ROLE_KEY')return secret;
  return null;
 }},serve(callback){handler=callback;}};
 function evaluate(path){
  const absolute=resolve(path);
  if(cache.has(absolute))return cache.get(absolute).exports;
  const src=readFileSync(absolute,'utf8');
  const mod={exports:{}};cache.set(absolute,mod);
  const compiled=transformSync(src,{loader:'ts',format:'cjs',target:'es2022'}).code;
  const ctx={
   console,URL,Request,Response,Headers,TextEncoder,AbortSignal,TextDecoder,
   Number,Date,Promise,JSON,ArrayBuffer,Uint8Array,crypto:webcrypto,
   btoa:globalThis.btoa,atob:globalThis.atob,fetch:routedFetch,
   module:mod,exports:mod.exports,Deno:deno,
   require(spec){
    if(spec.startsWith('.'))return evaluate(resolve(dirname(absolute),spec));
    assert.match(spec,/^npm:@supabase\/supabase-js@/);
    return {createClient:()=>({rpc:async(name,args)=>{try{return {data:dataAccess(origin,name,args)}}
     catch(e){return {data:null,error:{message:e.message}};}}})};
   },
  };
  vm.runInNewContext(compiled,ctx,{filename:absolute,timeout:5000});
  return mod.exports;
 }
 evaluate(file);
 assert.equal(typeof handler,'function');
 return handler;
}
async function start(origin,root,handlerName){
 const handler=loadHandler(root+'/supabase/functions/'+handlerName+'/index.ts',origin);
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/'+handlerName)){res.writeHead(404);res.end();return;}
  let raw='';for await(const part of req)raw+=part;
  try{
   const request=new Request('http://127.0.0.1'+req.url,{
    method:req.method,headers:req.headers,body:req.method==='POST'?raw:undefined});
   const result=await handler(request);
   res.writeHead(result.status,Object.fromEntries(result.headers));
   res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(JSON.stringify({error:String(e)}));}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 urls[origin]='http://127.0.0.1:'+server.address().port;
 return server;
}
async function post(origin,path,body,proof){
 const headers={'content-type':'application/json'};
 if(proof!==undefined)headers['x-taxpay-office-mirror-proof']=proof;
 const result=await fetch(urls[origin]+path,{method:'POST',headers,body:JSON.stringify(body)});
 return {status:result.status,data:await result.json()};
}
const servers=await Promise.all([
 start('TAXPAY_SQL','.','demo-story1-taxpay'),
 start('OFFICE_SQL',officeRoot,'demo-story1-office')
]);
try{
 const payerSession=randomUUID(),payerKey=randomUUID();
 const payload={
  idempotencyKey:payerKey,sessionId:payerSession,service:'OTHER_TAX_PAYMENT',
  amountMinor:5000,origin:'TAXPAY_UI',
  details:{payerId:'ws3-isolated',payerTin:'999999999999',receiptReference:'SIM-'+payerKey,
   allocationContractVersion:3,combinedPayment:true,
   allocations:[
    {allocationId:'ws3-origin-one',taxpayerTin:'111111111111',headId:121,assessmentYear:'2026-27',amountMinor:1500},
    {allocationId:'ws3-origin-two',taxpayerTin:'222222222222',headId:145,assessmentYear:'2025-26',amountMinor:3500}
   ],receiptSnapshot:{challanNo:'SIM-'+payerKey,totalAmount:50,items:[{amountMinor:1500},{amountMinor:3500}]}}
 };
 // An unsubmitted Travel Tax draft is only form state; it creates no Office row.
 const travelDraft={service:'TRAVEL_TAX',details:{passengers:[{passportNumberMasked:'••••1234'}]}};
 assert.equal(office.size,0);assert.equal(store.size,0);
 assert.equal(travelDraft.service,'TRAVEL_TAX');

 failOfficeOnce=true;
 const first=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',payload);
 assert.equal(first.status,503);assert.equal(first.data.error,'OFFICE_SYNC_PENDING');
 assert.equal(store.size,1);assert.equal(office.size,0);
 const sourceId=[...store.keys()][0];
 const deniedMissing=await post('OFFICE_SQL','/demo-story1-office/mirror',{id:sourceId,sessionId:payerSession});
 assert.equal(deniedMissing.status,403);
 assert.equal(deniedMissing.data.error,'MIRROR_PROOF_REQUIRED');
 const deniedMalformed=await post('OFFICE_SQL','/demo-story1-office/mirror',
  {id:sourceId,sessionId:payerSession},'forged');
 assert.equal(deniedMalformed.status,403);
 assert.equal(office.size,0);
 const fake='v1.'+Math.floor(Date.now()/1000)+'.'+'A'.repeat(43);
 const forged=await post('OFFICE_SQL','/demo-story1-office/mirror',
  {id:sourceId,sessionId:payerSession},fake);
 assert.equal(forged.status,424);assert.equal(office.size,0);
 // Resubmit EXACT same source key/data: real source handler signs payment+session
 // proof; real Office handler fetches source using proof; source Edge verifies it.
 const retried=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',payload);
 assert.equal(retried.status,200);assert.equal(retried.data.id,sourceId);
 assert.equal(retried.data.replayed,true);assert.equal(office.size,1);
 assert.deepEqual(office.get(sourceId).data,store.get(sourceId).data);
 assert.equal(office.get(sourceId).data.details.allocations.length,2);
 assert.equal(office.get(sourceId).data.details.allocations[0].allocationId,'ws3-origin-one');
 assert.equal(office.get(sourceId).data.details.allocations[1].allocationId,'ws3-origin-two');
 assert.equal(office.get(sourceId).data.details.receiptSnapshot.challanNo,'SIM-'+payerKey);
 assert.ok(sourceReads>=2,'Office did not fetch the source with the signed proof');
 const again=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',payload);
 assert.equal(again.status,200);assert.equal(again.data.id,sourceId);
 assert.equal(store.size,1);assert.equal(office.size,1);

 // Pay Again is a NEW submitted SQL parent with its own idempotency key,
 // original parent retained as read-only provenance; the prefilled draft alone
 // must not create a source or Office payment.
 const repeatKey=randomUUID();
 const repeat=JSON.parse(JSON.stringify(payload));
 repeat.idempotencyKey=repeatKey;
 repeat.details.sourcePaymentId=sourceId;
 repeat.details.receiptReference='SIM-'+repeatKey;
 repeat.details.receiptSnapshot.challanNo='SIM-'+repeatKey;
 repeat.details.allocations[0].allocationId='ws3-new-allocation-one';
 repeat.details.allocations[1].allocationId='ws3-new-allocation-two';
 const copiedDraft={sourcePaymentId:sourceId,formPayload:repeat.details};
 assert.equal(store.size,1);assert.equal(office.size,1);
 assert.equal(copiedDraft.sourcePaymentId,sourceId);
 const submittedAgain=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',repeat);
 assert.equal(submittedAgain.status,200);
 const newParentId=submittedAgain.data.id;
 assert.notEqual(newParentId,sourceId);
 assert.equal(office.get(newParentId).data.details.sourcePaymentId,sourceId);
 assert.equal(office.get(newParentId).data.details.receiptReference,'SIM-'+repeatKey);
 assert.deepEqual(office.get(sourceId).data.details.allocations,payload.details.allocations);
 assert.equal(office.get(sourceId).data.details.sourcePaymentId,undefined);
 assert.equal(office.get(newParentId).data.details.allocations[0].allocationId,'ws3-new-allocation-one');
 const repeatAck=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',repeat);
 assert.equal(repeatAck.status,200);assert.equal(repeatAck.data.id,newParentId);
 assert.equal(repeatAck.data.replayed,true);
 assert.equal(office.size,2);assert.equal(store.size,2);

 // A submitted Travel Tax record is independent from an unsubmitted draft.
 const travelKey=randomUUID();
 const travel={
  idempotencyKey:travelKey,sessionId:randomUUID(),service:'TRAVEL_TAX',
  amountMinor:150000,origin:'TAXPAY_UI',details:{
   payerName:'WS3 travel passenger',travelDate:'2026-11-14',
   passengers:[{name:'Passenger A',passportNumberMasked:'••••1234',amountMinor:100000},
    {name:'Passenger B',passportNumberMasked:'••••5678',amountMinor:50000}],
   receiptReference:'SIM-'+travelKey,receiptSnapshot:{
    challanNo:'SIM-'+travelKey,totalAmount:1500,
    travelDetails:{passengers:[{name:'Passenger A',passportNumberMasked:'••••1234'},
     {name:'Passenger B',passportNumberMasked:'••••5678'}]}}}
 };
 const submitted=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',travel);
 assert.equal(submitted.status,200);
 const mirrored=office.get(submitted.data.id);
 assert.ok(mirrored);assert.deepEqual(mirrored.data.details.passengers,travel.details.passengers);
 assert.equal(JSON.stringify(mirrored).includes('PASSPORT-UNMASKED'),false);
 const replay=await post('TAXPAY_SQL','/demo-story1-taxpay/payments',travel);
 assert.equal(replay.status,200);assert.equal(replay.data.id,submitted.data.id);
 assert.equal(office.size,3);assert.equal(store.size,3);
 console.log('PASS WS3 Story 1 Edge HTTP: Office requires signed proof, forged/missing proof denied, source signed proof verified on fetch, same-parent source-outage retry and single Office mirror, original v3 allocation/receipt IDs, Pay Again distinct parent/source parent lineage, and submitted masked Travel Tax passengers; RPC persistence is isolated stand-in, not production SQL');
}finally{await Promise.all(servers.map(s=>new Promise(ok=>s.close(ok))));}
