/**
 * R08/R14: actual source and Office Edge handlers, real separate disposable
 * Taxpayer/Office SQL, two source-origin configurations and separate keys.
 * Each source lane has its own independent, loopback-only disposable PostgreSQL instance.
 * No hosted network access or production credentials; existing role fixture.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const sourceDbs={original:process.env.WS3_TAXPAYER_DB_URL,v2:process.env.WS3_REPLACEMENT_DB_URL},officeDb=process.env.WS3_OFFICE_DB_URL;
const officeRoot=process.env.WS3_V7_OFFICE_SOURCE;
assert.ok(sourceDbs.original&&sourceDbs.v2&&officeDb&&officeRoot,'Three independent disposable DBs required');
const urls=[sourceDbs.original,sourceDbs.v2,officeDb];
for(const url of urls)assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));
assert.equal(new Set(urls.map(url=>new URL(url).port)).size,3,'Three distinct local instance ports required');
const hosts={original:'eyqhoavnitkrajvyqvxn.supabase.co',v2:'gmuhitmaynfhipcvbvkh.supabase.co',office:'ihbtabrvmyiwikqqbhrf.supabase.co'};
const keys={original:'ab'.repeat(32),v2:'cd'.repeat(32)};
const directAdmin=process.env.WS5_DIRECT_SUPER_ADMIN==='true';
const adminFixture=process.env.WS5_DIRECT_ADMIN_FIXTURE;
if(directAdmin)assert.match(adminFixture,/^[0-9a-f-]{36}$/i);
const maker='80000000-0000-4000-8000-000000000011',reviewer='80000000-0000-4000-8000-000000000012',approver='80000000-0000-4000-8000-000000000013';
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
  taxpay_demo_correction_office_initiation:'public.taxpay_demo_correction_office_initiation('+j(a.p_command)+')',
 };
 const office={
  payment_v1_internal_bridge_config:source.payment_v1_internal_bridge_config,
  payment_v1_demo_correction_key:source.payment_v1_demo_correction_key,
  payment_v1_internal_ingest_demo_correction:'public.payment_v1_internal_ingest_demo_correction('+j(a.p_event)+')',
  payment_v1_demo_correction_route:"coalesce(to_jsonb(public.payment_v1_demo_correction_route("+u(a.p_id)+")),'null'::jsonb)",
  payment_v1_internal_claim_commands:'public.payment_v1_internal_claim_commands('+Number(a.p_limit)+')',
  payment_v1_internal_ack_correction_command:'public.payment_v1_internal_ack_correction_command('+u(a.p_message_id)+','+u(a.p_claim_token)+','+a.p_success+','+(a.p_review_state===null?'NULL':t(a.p_review_state))+','+(a.p_error===null?'NULL':t(a.p_error))+')',
  payment_v1_internal_ack_typed_office_correction:'public.payment_v1_internal_ack_typed_office_correction('+u(a.p_message_id)+','+u(a.p_claim_token)+','+j(a.p_applied_correction)+')',
  payment_v1_internal_ack_command:'public.payment_v1_internal_ack_command('+u(a.p_message_id)+','+u(a.p_claim_token)+','+a.p_success+','+(a.p_error===null?'NULL':t(a.p_error))+')',
 };
 const expression=(origin==='office'?office:source)[name];
 if(!expression)throw Error('Unexpected disposable report RPC '+origin+'.'+name);
 return sql(origin==='office'?officeDb:sourceDbs[origin],'BEGIN; SET LOCAL ROLE service_role; SELECT '+expression+'; COMMIT;');
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
// Only synthetic, already provisioned local identities and keys are used.
const profile=(db,id)=>sql(db,'SELECT public.taxpay_demo_profile_login('+t(id)+','+t(id)+');');
const capHash=c=>createHash('sha256').update(c).digest('hex');
const seed=sql(sourceDbs.original,"SELECT data FROM demo_payment.story_payments WHERE data#>>'{details,allocations,0,allocationId}'='ws3-edge-sql-allocation-2' ORDER BY created_at DESC LIMIT 1;");
assert.ok(seed?.details?.allocations?.length>=2,'Existing validated disposable payload template required');
const instanceIds=urls.map(db=>sql(db,'SELECT to_jsonb(system_identifier::text) FROM pg_control_system();'));
assert.equal(new Set(instanceIds).size,3,'Independent PostgreSQL cluster identities required');
const keyConfig=sql(sourceDbs.original,'SELECT public.payment_v1_internal_bridge_config();');
const officeConfig=sql(officeDb,'SELECT public.payment_v1_internal_bridge_config();');
assert.equal(keyConfig.signingKey,keys.original);assert.equal(officeConfig.signingKey,keys.original);
for(const db of [sourceDbs.original,sourceDbs.v2,officeDb])sql(db,'INSERT INTO payment_sync.demo_correction_bridge_key(singleton,signing_key) VALUES(true,'+t(keys.v2)+') ON CONFLICT(singleton) DO UPDATE SET signing_key=excluded.signing_key; SELECT true;');
if(!directAdmin)for(const [actor,role] of [[maker,'MAKER'],[reviewer,'REVIEWER'],[approver,'APPROVER']]){
 assert.equal(sql(officeDb,'SELECT to_jsonb(role) FROM payment_sync.officer_roles WHERE active AND user_uid='+u(actor)),role,'Use only existing disposable fixture roles');
}
for(const origin of ['original','v2'])handlers[origin+'|source']=load(resolve('supabase/functions/demo-story1-taxpay/index.ts'),origin);
handlers['office|sync']=load(resolve(officeRoot,'supabase/functions/payment-sync-bridge/index.ts'),'office');
handlers['office|command']=load(resolve(officeRoot,'supabase/functions/payment-command-bridge/index.ts'),'office');
const sourcePath='/demo-story1-taxpay/corrections';
const fingerprint=db=>sql(db,"SELECT jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id))) FROM demo_payment.story_payments p;");
for(const origin of ['original','v2']){
 const sourceDb=sourceDbs[origin],otherDb=sourceDbs[origin==='original'?'v2':'original'];
 const payer=profile(sourceDb,'user1'),recipient=profile(sourceDb,'user2'),outsider=profile(sourceDb,'user3');
 assert.ok(payer.capability&&recipient.capability&&outsider.capability);
 // Fresh V2 has its own capabilities, beneficiary membership and payment session.
 // Reuse the validated payload shape, not any original DB records or session.
 if(origin==='v2'&&!directAdmin){
  const hash=capHash(payer.capability),list=sql(sourceDb,'SELECT public.taxpay_guest_beneficiary_create_list('+t(hash)+','+t('Disposable independent recipient fixture')+');');
  assert.ok(list?.id);
  const people=seed.details.allocations.map(a=>({tin:a.taxpayerTin,display_name:a.taxpayerName,tag:'clients'}));
  assert.equal(sql(sourceDb,'SELECT public.taxpay_guest_beneficiary_add('+t(hash)+','+u(list.id)+','+j(people)+');'),people.length);
 }
 const beforeSource=fingerprint(sourceDb),beforeOffice=fingerprint(officeDb),beforeOther=fingerprint(otherDb);
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
 const messageIds=new Set();
 async function review(reportId,cap,actor,action,state){
  const queued=sql(officeDb,"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',"+t(actor)+",true); SELECT public.payment_v1_correction_officer_action("+u(reportId)+","+t(action)+","+t('Disposable recipient status verification')+","+u(randomUUID())+"); COMMIT;");
  assert.equal(queued.queued,true);
  const dispatched=await call('office','command','/payment-command-bridge',{mode:'dispatch',token:officeConfig.dispatchToken});
  assert.equal(dispatched.status,200);
  const cmd=decisions.find(x=>{const value=JSON.parse(x.body.commandText);return value.requestId===reportId&&value.action===action;});
  assert.equal(cmd?.origin,origin);
  const value=JSON.parse(cmd.body.commandText);
  assert.equal(value.sourceProject,origin);assert.equal(value.officerUid,actor);if(directAdmin)assert.equal(value.officerRole,'SUPER_ADMIN');assert.ok(!messageIds.has(value.messageId));messageIds.add(value.messageId);
  const read=await call(origin,'source',sourcePath+'?limit=100&offset=0',undefined,cap);
  const current=read.data.data.find(x=>x.id===reportId);
  assert.equal(current.reviewState,state);assert.equal(current.paymentCompleted,false);
  const notices=await call(origin,'source',sourcePath+'/notices?limit=100&offset=0',undefined,cap);
  assert.ok(notices.data.data.items.some(x=>x.requestId===reportId&&x.code==='REPORT_'+state));
  const wrongSource=await call(origin==='original'?'v2':'original','source',sourcePath+'/office-decision',cmd.body);
  assert.ok([401,403].includes(wrongSource.status));
  assert.equal(sql(officeDb,'SELECT to_jsonb(review_state) FROM payment_sync.correction_mirrors WHERE inquiry_id='+u(reportId)),state);
  assert.equal(sql(otherDb,'SELECT count(*) FROM taxpay_guest_private.story_correction_requests WHERE id='+u(reportId)),0);
  const decisionReplay=await call(origin,'source',sourcePath+'/office-decision',cmd.body);
  assert.equal(decisionReplay.status,200);
  assert.equal(sql(sourceDb,'SELECT count(*) FROM taxpay_guest_private.story_correction_decisions WHERE message_id='+u(value.messageId)),1);
  assert.deepEqual(fingerprint(sourceDb),beforeSource);assert.deepEqual(fingerprint(officeDb),beforeOffice);
 }
 if(directAdmin){
  assert.throws(()=>sql(officeDb,"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',"+t(maker)+",true); SELECT public.payment_v1_correction_officer_action("+u(id)+",'APPROVE','Disposable denial check',"+u(randomUUID())+"); COMMIT;"),/Verified Office Super Admin required/);
  await review(id,recipient.capability,adminFixture,'APPROVE','APPROVED');
 }else{
  await review(id,recipient.capability,maker,'MAKER_ACKNOWLEDGE','MAKER_ACKNOWLEDGED');
  await review(id,recipient.capability,reviewer,'REVIEWER_VERIFY','REVIEWER_VERIFIED');
  await review(id,recipient.capability,approver,'APPROVER_CLOSE','APPROVER_CLOSED');
 }
 // The second allocation belongs to the other fictional recipient and is a
 // distinct report, allowing an independently authorized terminal rejection.
 const event3=staged.id+':allocation:2';
 const rejected=await call(origin,'source',sourcePath,{...input,eventId:event3,requestKey:randomUUID()},outsider.capability);
 assert.equal(rejected.status,200);assert.equal(rejected.data.data.paymentCompleted,false);assert.equal(rejected.data.data.officeSyncState,'ACKNOWLEDGED');
 const rejectedId=rejected.data.data.id;assert.notEqual(rejectedId,id);
 await review(rejectedId,outsider.capability,directAdmin?adminFixture:reviewer,'REJECT','REJECTED');
 const own=await call(origin,'source',sourcePath+'?limit=100&offset=0',undefined,recipient.capability);
 assert.ok(!own.data.data.some(x=>x.id===rejectedId),'Recipient cannot read another allocation report');
 assert.deepEqual(fingerprint(sourceDb),beforeSource);assert.deepEqual(fingerprint(officeDb),beforeOffice);assert.deepEqual(fingerprint(otherDb),beforeOther);
 if(directAdmin&&origin==='v2'){
  // Completion of the already validated local initiation is independent of report handling.
  const completed=sql(sourceDb,'SELECT public.taxpay_demo_story1_submit('+t(capHash(payer.capability))+','+j(payload)+');');
  assert.equal(completed.id,staged.id);assert.equal(completed.status,'SIMULATED_SUCCESS');
  // The disposable Office SQL parent must be the exact immutable source row, not a
  // fabricated correction result. Existing separate mirror tests cover its transport.
  const parent=sql(sourceDb,'SELECT to_jsonb(p) FROM demo_payment.story_payments p WHERE p.id='+u(staged.id));
  assert.equal(parent.status,'SIMULATED_SUCCESS');
  sql(officeDb,'INSERT INTO demo_payment.story_payments(id,session_id,service_code,amount_minor,data,status,created_at) VALUES('+u(parent.id)+','+u(parent.session_id)+','+t(parent.service_code)+','+Number(parent.amount_minor)+','+j(parent.data)+','+t(parent.status)+','+t(parent.created_at)+'::timestamptz) ON CONFLICT(id) DO NOTHING; SELECT true;');
  const mirroredParent=sql(officeDb,'SELECT to_jsonb(p) FROM demo_payment.story_payments p WHERE p.id='+u(staged.id));
  assert.deepEqual(mirroredParent.data,parent.data);assert.equal(mirroredParent.amount_minor,parent.amount_minor);
  const d=parent.data.details,s=d.receiptSnapshot??{},a=d.allocations[0],sa=s.allocationItems?.[0],line=d.lines?.[0];
  const currentAY=a.assessmentYear||sa?.assessmentYear||line?.assessmentYear||s.assessmentYear||d.assessmentYear||'';
  const currentCircle=s.taxCircle??d.taxCircle??'';
  const currentHeadCode=sa?.economicCode||line?.economicCode||s.items?.[0]?.economicCode||'';
  const correction={allocationIndex:0,allocationId:a.allocationId,currentAY,currentCircle,currentHeadCode,
    proposedAY:currentAY==='2024-2025'?'2023-2024':'2024-2025',proposedCircle:currentCircle,proposedHeadCode:currentHeadCode};
  const typedBefore=fingerprint(sourceDb),typedOfficeBefore=fingerprint(officeDb);
  const queued=sql(officeDb,"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',"+t(adminFixture)+",true); SELECT public.payment_v1_office_initiate_correction("+u(staged.id)+","+t(a.taxpayerTin)+","+t(d.receiptReference)+","+t('Disposable exact typed correction reason')+","+t('Correct the assessment year')+","+t('Verified disposable evidence note')+","+u(randomUUID())+","+j(correction)+"); COMMIT;");
  assert.equal(queued.queued,true);
  const dispatched=await call('office','command','/payment-command-bridge',{mode:'dispatch',token:officeConfig.dispatchToken});
  assert.equal(dispatched.status,200);
  const cmd=decisions.find(x=>JSON.parse(x.body.commandText).messageId===queued.caseId);
  assert.equal(cmd?.origin,'v2');
  const result=await call('v2','source',sourcePath+'/office-decision',cmd.body);
  assert.equal(result.status,200);assert.equal(result.data.reviewState,'APPROVED');assert.equal(result.data.appliedCorrection.assessmentYear,correction.proposedAY);
  const ownerRows=await call('v2','source',sourcePath+'?limit=100&offset=0',undefined,recipient.capability);
  const applied=ownerRows.data.data.find(x=>x.id===queued.caseId);
  assert.deepEqual(applied?.appliedCorrection,result.data.appliedCorrection);
  const otherRows=await call('v2','source',sourcePath+'?limit=100&offset=0',undefined,outsider.capability);
  assert.ok(!otherRows.data.data.some(x=>x.id===queued.caseId));
  const ack=sql(officeDb,'SELECT jsonb_build_object(\'applied\',c.source_applied_correction,\'delivery\',o.delivery_state) FROM payment_sync.office_initiated_corrections c JOIN payment_sync.control_outbox o ON o.message_id=c.case_id WHERE c.case_id='+u(queued.caseId));
  assert.equal(ack.delivery,'ACKNOWLEDGED');assert.deepEqual(ack.applied,result.data.appliedCorrection);
  assert.deepEqual(fingerprint(sourceDb),typedBefore);assert.deepEqual(fingerprint(officeDb),typedOfficeBefore);assert.deepEqual(fingerprint(otherDb),beforeOther);
  console.log('PASS V2 actual signed typed Office initiation, owner readback, exact ACK, replay and immutable original record');
 }
 console.log('PASS '+origin+' independent disposable cluster, actual signed immediate report/ACK/'+(directAdmin?'direct Super Admin approve/reject':'historical Maker/Reviewer/Approver/rejection')+', retry/replay, cross-source denial and immutable payment ledgers');
}
