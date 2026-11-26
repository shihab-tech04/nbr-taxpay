/**
 * R08/R14: actual source and Office Edge handlers, real separate disposable
 * Taxpayer/Office SQL, two source-origin configurations and separate keys.
 * The two source lanes reuse a local Taxpayer DB with distinct test records.
 * No hosted network access or production credentials; existing role fixture.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const sourceDb=process.env.WS3_TAXPAYER_DB_URL,officeDb=process.env.WS3_OFFICE_DB_URL;
const officeRoot=process.env.WS3_V7_OFFICE_SOURCE;
assert.ok(sourceDb&&officeDb&&officeRoot);
for(const url of [sourceDb,officeDb])assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));
assert.notEqual(new URL(sourceDb).port,new URL(officeDb).port);
const hosts={original:'eyqhoavnitkrajvyqvxn.supabase.co',v2:'gmuhitmaynfhipcvbvkh.supabase.co',office:'ihbtabrvmyiwikqqbhrf.supabase.co'};
const keys={original:'ab'.repeat(32),v2:'cd'.repeat(32)};
const maker='80000000-0000-4000-8000-000000000011';
const t=v=>"'"+String(v).replaceAll("'","''")+"'";
const j=v=>t(JSON.stringify(v))+'::jsonb';
const u=v=>t(v)+'::uuid';
function sql(url,query){
 const p=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],{input:query,encoding:'utf8',timeout:60000,maxBuffer:4000000});
 if(p.status!==0)throw Error('Disposable report SQL: '+String(p.stderr).slice(0,2400));
 const line=p.stdout.trim().split('\n').filter(Boolean).at(-1);
 if(!line)return null;if(line==='t')return true;if(line==='f')return false;return JSON.parse(line);
}
function rpc(origin,name,a={}){
 const source={
  payment_v1_internal_bridge_config:'public.payment_v1_internal_bridge_config()',
  payment_v1_demo_correction_key:"coalesce(to_jsonb(public.payment_v1_demo_correction_key()),'null'::jsonb)",
  taxpay_demo_received_payment_report_save:'public.taxpay_demo_received_payment_report_save('+t(a.p_capability_hash)+','+t(a.p_event_id)+','+u(a.p_request_key)+','+t(a.p_reason)+')',
  taxpay_demo_correction_claim:'public.taxpay_demo_correction_claim('+Number(a.p_limit)+','+(a.p_id?u(a.p_id):'NULL::uuid')+')',
  taxpay_demo_original_report_claim:'public.taxpay_demo_original_report_claim('+Number(a.p_limit)+','+(a.p_id?u(a.p_id):'NULL::uuid')+')',
  taxpay_demo_correction_ack:'public.taxpay_demo_correction_ack('+u(a.p_id)+','+u(a.p_claim_token)+','+a.p_success+')',
  taxpay_demo_correction_get:'public.taxpay_demo_correction_get('+u(a.p_id)+')',
  taxpay_demo_correction_list:'public.taxpay_demo_correction_list('+t(a.p_capability_hash)+','+Number(a.p_limit)+','+Number(a.p_offset)+')',
  taxpay_demo_correction_notices:'public.taxpay_demo_correction_notices('+t(a.p_capability_hash)+','+Number(a.p_limit)+','+Number(a.p_offset)+')',
  taxpay_demo_correction_office_decision:'public.taxpay_demo_correction_office_decision('+j(a.p_command)+')',
 };
 const office={
  payment_v1_internal_bridge_config:source.payment_v1_internal_bridge_config,
  payment_v1_demo_correction_key:source.payment_v1_demo_correction_key,
  payment_v1_internal_ingest_demo_correction:'public.payment_v1_internal_ingest_demo_correction('+j(a.p_event)+')',
  payment_v1_demo_correction_route:"coalesce(to_jsonb(public.payment_v1_demo_correction_route("+u(a.p_id)+")),'null'::jsonb)",
  payment_v1_internal_claim_commands:'public.payment_v1_internal_claim_commands('+Number(a.p_limit)+')',
  payment_v1_internal_ack_correction_command:'public.payment_v1_internal_ack_correction_command('+u(a.p_message_id)+','+u(a.p_claim_token)+','+a.p_success+','+(a.p_review_state===null?'NULL':t(a.p_review_state))+','+(a.p_error===null?'NULL':t(a.p_error))+')',
 };
 const expression=(origin==='office'?office:source)[name];
 if(!expression)throw Error('Unexpected disposable report RPC '+origin+'.'+name);
 return sql(origin==='office'?officeDb:sourceDb,'BEGIN; SET LOCAL ROLE service_role; SELECT '+expression+'; COMMIT;');
}
const captured=[],decisions=[],handlers={};let outage=null;
async function routedFetch(input,init){
 const url=new URL(typeof input==='string'?input:input.url);
 const origin=Object.keys(hosts).find(k=>hosts[k]===url.hostname);
 assert.ok(origin&&url.protocol==='https:'&&url.pathname.startsWith('/functions/v1/'),'No external URLs in report harness');
 const path=url.pathname.replace('/functions/v1','');
 const body=JSON.parse(init.body);
 if(path==='/payment-sync-bridge'){
  assert.equal(origin,'office');captured.push(body);
  if(outage===JSON.parse(body.eventText).sourceProject){outage=null;return new Response(JSON.stringify({error:'disposable outage'}),{status:503,headers:{'Content-Type':'application/json'}});}
 }else if(path==='/demo-story1-taxpay/corrections/office-decision'){
  assert.notEqual(origin,'office');decisions.push({origin,body});
 }else throw Error('Unexpected report transport '+path);
 const handler=handlers[origin+'|'+(origin==='office'?'sync':'source')];
 return handler(new Request('http://127.0.0.1'+path+url.search,init));
}
function load(file,origin){
 let handler=null;const cache=new Map();
 const context={console,TextEncoder,TextDecoder,Request,Response,Headers,URL,btoa,atob,AbortSignal,crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,structuredClone,fetch:routedFetch,
  Deno:{env:{get(name){if(name==='SUPABASE_URL')return 'https://'+hosts[origin];if(name==='SUPABASE_ANON_KEY')return 'disposable-anon';if(name==='SUPABASE_SERVICE_ROLE_KEY')return 'disposable-service';if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:'disposable-service'});return null;}},serve(fn){handler=fn;}}};
 function evaluate(path){
  const absolute=resolve(path);if(cache.has(absolute))return cache.get(absolute).exports;
  const module={exports:{}};cache.set(absolute,module);
  const code=transformSync(readFileSync(absolute,'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
  vm.runInNewContext(code,{...context,module,exports:module.exports,require(spec){
   if(spec.startsWith('.'))return evaluate(resolve(dirname(absolute),spec));
   assert.match(spec,/^npm:@supabase\/supabase-js@/);
   return {createClient:()=>({rpc:async(name,args)=>{try{return {data:rpc(origin,name,args),error:null};}catch(e){return {data:null,error:{message:String(e.message)}};}}})};
  }},{filename:absolute,timeout:5000});
  return module.exports;
 }
 evaluate(file);assert.equal(typeof handler,'function');return handler;
}
async function call(origin,kind,path,body,cap){
 const h=handlers[origin+'|'+kind];
 const response=await h(new Request('http://127.0.0.1'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cap?{'x-taxpay-guest-capability':cap}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 return {status:response.status,data:await response.json()};
}
const profile=id=>sql(sourceDb,'SELECT public.taxpay_demo_profile_login('+t(id)+','+t(id)+');');
const capHash=c=>createHash('sha256').update(c).digest('hex');
const payer=profile('user1'),recipient=profile('user2'),outsider=profile('user3');
assert.ok(payer.capability&&recipient.capability&&outsider.capability);
const seed=sql(sourceDb,"SELECT data FROM demo_payment.story_payments WHERE data#>>'{details,allocations,0,allocationId}'='ws3-edge-sql-allocation-2' ORDER BY created_at DESC LIMIT 1;");
assert.ok(seed?.details?.allocations?.length,'Existing validated paired fixture is required');
const keyConfig=sql(sourceDb,'SELECT public.payment_v1_internal_bridge_config();');
const officeConfig=sql(officeDb,'SELECT public.payment_v1_internal_bridge_config();');
assert.equal(keyConfig.signingKey,keys.original);assert.equal(officeConfig.signingKey,keys.original);
for(const db of [sourceDb,officeDb])sql(db,'INSERT INTO payment_sync.demo_correction_bridge_key(singleton,signing_key) VALUES(true,'+t(keys.v2)+') ON CONFLICT(singleton) DO UPDATE SET signing_key=excluded.signing_key; SELECT true;');
for(const origin of ['original','v2'])handlers[origin+'|source']=load(resolve('supabase/functions/demo-story1-taxpay/index.ts'),origin);
handlers['office|sync']=load(resolve(officeRoot,'supabase/functions/payment-sync-bridge/index.ts'),'office');
handlers['office|command']=load(resolve(officeRoot,'supabase/functions/payment-command-bridge/index.ts'),'office');
const sourcePath='/demo-story1-taxpay/corrections';
const fingerprint=db=>sql(db,"SELECT jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id))) FROM demo_payment.story_payments p;");
for(const origin of ['original','v2']){
 const beforeSource=fingerprint(sourceDb),beforeOffice=fingerprint(officeDb);
 const payload=structuredClone(seed),key=randomUUID();
 payload.idempotencyKey=key;payload.sessionId=payer.paymentSessionId;
 payload.details.receiptReference='SIM-'+key;payload.details.receiptSnapshot.challanNo='SIM-'+key;
 const staged=sql(sourceDb,'SELECT public.taxpay_demo_story1_initiate('+t(capHash(payer.capability))+','+j(payload)+');');
 assert.equal(staged.status,'SIMULATED_INITIATED');
 const eventId=staged.id+':allocation:1',input={caseKind:'UNSOLICITED_PAYMENT_REPORT',eventId,requestKey:randomUUID(),reason:'Disposable v7 recipient reported unfamiliar initiated payment'};
 const wrong=await call(origin,'source',sourcePath,input,outsider.capability);assert.equal(wrong.status,403);
 outage=origin;const failed=await call(origin,'source',sourcePath,input,recipient.capability);
 assert.equal(failed.status,200);assert.equal(failed.data.data.paymentCompleted,false);assert.equal(failed.data.data.officeSyncState,'PENDING');
 const report=failed.data.data,id=report.id;
 assert.equal(sql(officeDb,'SELECT count(*) FROM payment_sync.correction_mirrors WHERE inquiry_id='+u(id)),0);
 sql(sourceDb,'UPDATE taxpay_guest_private.story_correction_requests SET sync_next_at=now() WHERE id='+u(id)+'; SELECT true;');
 const retried=await call(origin,'source',sourcePath,{...input,requestKey:randomUUID()},recipient.capability);
 assert.equal(retried.status,200);assert.equal(retried.data.data.id,id);assert.equal(retried.data.data.officeSyncState,'ACKNOWLEDGED');assert.equal(retried.data.data.paymentCompleted,false);
 const events=captured.filter(x=>JSON.parse(x.eventText).requestId===id);assert.equal(events.length,2);assert.equal(events[0].eventText,events[1].eventText);
 const event=JSON.parse(events[1].eventText);
 assert.equal(event.sourceProject,origin);assert.equal(event.payload.recipientEventId,eventId);assert.equal(event.payload.recipientInitiation.state,'SIMULATED_INITIATED');assert.equal(event.payload.targetAllocationId,payload.details.allocations[0].allocationId);
 const mirrored=sql(officeDb,'SELECT jsonb_build_object(\'source\',s.source_project,\'id\',m.inquiry_id,\'payment\',m.source_payment_id,\'allocation\',m.target_allocation_id,\'payload\',m.inquiry_payload) FROM payment_sync.correction_mirrors m JOIN payment_sync.demo_correction_sources s ON s.inquiry_id=m.inquiry_id WHERE m.inquiry_id='+u(id));
 assert.equal(mirrored.source,origin);assert.equal(mirrored.id,id);assert.equal(mirrored.payment,staged.id);assert.equal(mirrored.allocation,event.payload.targetAllocationId);assert.deepEqual(mirrored.payload,event.payload);
 const forged=await call('office','sync','/payment-sync-bridge',{...events[1],eventText:JSON.stringify({...event,sourceProject:origin==='v2'?'original':'v2'})});
 assert.equal(forged.status,401);
 const replay=await call('office','sync','/payment-sync-bridge',events[1]);assert.equal(replay.status,200);assert.equal(replay.data.duplicate,true);
 const queued=sql(officeDb,"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',"+t(maker)+",true); SELECT public.payment_v1_correction_officer_action("+u(id)+",'MAKER_ACKNOWLEDGE','Received disposable recipient report',"+u(randomUUID())+"); COMMIT;");
 assert.equal(queued.queued,true);
 const dispatched=await call('office','command','/payment-command-bridge',{mode:'dispatch',token:officeConfig.dispatchToken});
 assert.equal(dispatched.status,200);
 const cmd=decisions.find(x=>JSON.parse(x.body.commandText).requestId===id);
 assert.equal(cmd?.origin,origin);assert.equal(JSON.parse(cmd.body.commandText).sourceProject,origin);
 const read=await call(origin,'source',sourcePath+'?limit=100&offset=0',undefined,recipient.capability);
 const current=read.data.data.find(x=>x.id===id);
 assert.equal(current.reviewState,'MAKER_ACKNOWLEDGED');assert.equal(current.paymentCompleted,false);
 const notices=await call(origin,'source',sourcePath+'/notices?limit=100&offset=0',undefined,recipient.capability);
 assert.ok(notices.data.data.items.some(x=>x.requestId===id&&x.code==='REPORT_MAKER_ACKNOWLEDGED'));
 const wrongSource=await call(origin==='original'?'v2':'original','source',sourcePath+'/office-decision',cmd.body);
 assert.ok([401,403].includes(wrongSource.status));
 assert.equal(sql(officeDb,'SELECT to_jsonb(review_state) FROM payment_sync.correction_mirrors WHERE inquiry_id='+u(id)),'MAKER_ACKNOWLEDGED');
 assert.deepEqual(fingerprint(sourceDb),beforeSource);assert.deepEqual(fingerprint(officeDb),beforeOffice);
 console.log('PASS '+origin+' actual signed report/ACK/decision before payment completion, exact allocation/provenance, retry, replay, cross-source denial and unchanged payment ledgers');
}
