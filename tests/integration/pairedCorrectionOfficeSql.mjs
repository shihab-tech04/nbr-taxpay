/**
 * WS3 correction round trip, exact source event and Office command IDs.
 * Two separate disposable databases; no hosted secrets or new SQL architecture.
 * Reuses the passing original Taxpayer correction creation fixture prefix.
 * Existing signed Edge handlers exchange correction events and decisions over
 * loopback HTTP while each RPC executes against its own disposable SQL DB.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const source=process.env.WS3_TAXPAYER_DB_URL,office=process.env.WS3_OFFICE_DB_URL;
const officeRoot=process.env.WS3_OFFICE_SOURCE;
assert.ok(source&&office);
assert.ok(officeRoot,'Pin the current Office #270 source with WS3_OFFICE_SOURCE');
for(const u of [source,office])assert.ok(['127.0.0.1','localhost'].includes(new URL(u).hostname));
assert.notEqual(new URL(source).port,new URL(office).port);
function db(url,script){
 const p=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],
  {input:script,encoding:'utf8',timeout:120000,maxBuffer:5000000});
 if(p.status!==0){
  const stderr=p.stderr??'';
  // PostgreSQL places the primary ERROR/SQLSTATE first; the function CONTEXT
  // can be much longer than the tail that was previously logged.
  throw Error('Disposable correction SQL (exit '+p.status+'):\n'+
    stderr.slice(0,2500)+(stderr.length>6000?'\n... [context truncated] ...\n':'\n')+
    (stderr.length>2500?stderr.slice(-3500):''));
 }
 const s=p.stdout.trim().split('\n').filter(Boolean).at(-1);
 if(s==='t')return true;if(s==='f')return false;
 try{return JSON.parse(s);}catch{throw Error('Non-JSON disposable SQL: '+p.stdout.slice(-800));}
}
const pgJSON=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const sqlText=v=>"'"+String(v).replaceAll("'","''")+"'";
const auth=(actor,statement)=>[
 'BEGIN;SET LOCAL ROLE authenticated;',
 "SELECT set_config('request.jwt.claim.sub','"+actor+"',true);",
 statement,'COMMIT;'
].join('\n');
const bridgeKey='ab'.repeat(32);
const dispatchTokens={TAXPAY_SQL:'11'.repeat(32),OFFICE_SQL:'22'.repeat(32)};
const projectHosts={TAXPAY_SQL:'eyqhoavnitkrajvyqvxn',OFFICE_SQL:'ihbtabrvmyiwikqqbhrf'};
const bridgeServers={};
let failNextOfficeSync=true;
let failNextTaxpayerCommand=true;
function bridgeConfig(origin){
 const peer=origin==='TAXPAY_SQL'?'OFFICE_SQL':'TAXPAY_SQL';
 return {origin,selfUrl:'https://'+projectHosts[origin]+'.supabase.co/functions/v1/payment-sync-bridge',
  peerUrl:'https://'+projectHosts[peer]+'.supabase.co/functions/v1/payment-sync-bridge',
  dispatchToken:dispatchTokens[origin],signingKey:bridgeKey,enabled:true};
}
function installBridgeSettings(origin,root,hostedPath){
 const hosted=readFileSync(resolve(root,hostedPath),'utf8');
 const marker='create table payment_sync.settings (';
 const start=hosted.indexOf(marker);
 const end=start<0?-1:hosted.indexOf('insert into payment_sync.settings',start);
 assert.ok(start>=0&&end>start,'Existing payment_sync.settings SQL contract is unavailable: '+hostedPath);
 const table=hosted.slice(start,end).replace(marker,'create table if not exists payment_sync.settings (');
 db(origin==='TAXPAY_SQL'?source:office,'BEGIN;'+table+
  'INSERT INTO payment_sync.settings(singleton,origin) VALUES(true,'+sqlText(origin)+
  ") ON CONFLICT(singleton) DO UPDATE SET origin=excluded.origin;SELECT 'true'::jsonb;COMMIT;");
}
function installBridgeConfig(origin,root,hostedPath){
 const hosted=readFileSync(resolve(root,hostedPath),'utf8');
 const start=hosted.indexOf('create table payment_sync.bridge_config (');
 const end=start<0?-1:hosted.indexOf('-- pg_net transmits only after the inserting transaction commits.',start);
 assert.ok(start>=0&&end>start,'Existing hosted bridge config SQL contract is unavailable: '+hostedPath);
 const config=bridgeConfig(origin);
 const setup=hosted.slice(start,end)+
  'INSERT INTO payment_sync.settings(singleton,origin) VALUES(true,'+sqlText(origin)+
  ') ON CONFLICT(singleton) DO UPDATE SET origin=excluded.origin;'+
  'INSERT INTO payment_sync.bridge_config(singleton,self_url,peer_url,dispatch_token,signing_key,enabled) VALUES(true,'+
  sqlText(config.selfUrl)+','+sqlText(config.peerUrl)+','+sqlText(config.dispatchToken)+','+
  sqlText(config.signingKey)+',true) ON CONFLICT(singleton) DO UPDATE SET self_url=excluded.self_url,'+
  'peer_url=excluded.peer_url,dispatch_token=excluded.dispatch_token,signing_key=excluded.signing_key,enabled=true;'+
  "SELECT 'true'::jsonb;";
 db(origin==='TAXPAY_SQL'?source:office,'BEGIN;'+setup+'COMMIT;');
}
function sqlRpc(origin,name,args){
 const calls={
  TAXPAY_SQL:{
   payment_v1_internal_bridge_config:()=> 'public.payment_v1_internal_bridge_config()',
   taxpay_correction_internal_claim:()=> 'public.taxpay_correction_internal_claim('+args.p_limit+'::integer)',
   taxpay_correction_internal_ack:()=> 'public.taxpay_correction_internal_ack('+sqlText(args.p_event_id)+'::uuid,'+
    sqlText(args.p_claim_token)+'::uuid,'+args.p_success+','+(args.p_error===null?'NULL':sqlText(args.p_error))+')',
   taxpay_correction_record_office_decision:()=> 'public.taxpay_correction_record_office_decision('+pgJSON(args.p_command)+')',
  },
  OFFICE_SQL:{
   payment_v1_internal_bridge_config:()=> 'public.payment_v1_internal_bridge_config()',
   payment_v1_internal_ingest_correction:()=> 'public.payment_v1_internal_ingest_correction('+pgJSON(args.p_event)+')',
   payment_v1_internal_claim_commands:()=> 'public.payment_v1_internal_claim_commands('+args.p_limit+'::integer)',
   // Office Main #298 queries persisted source provenance even for legacy corrections.
   // Run the real guarded SQL route (NULL means original Taxpayer), never a mock success.
   payment_v1_demo_correction_route:()=> 'coalesce(to_jsonb(public.payment_v1_demo_correction_route('+sqlText(args.p_id)+'::uuid)),\'null\'::jsonb)',
   payment_v1_internal_ack_correction_command:()=> 'public.payment_v1_internal_ack_correction_command('+
    sqlText(args.p_message_id)+'::uuid,'+sqlText(args.p_claim_token)+'::uuid,'+args.p_success+','+
    (args.p_review_state===null?'NULL':sqlText(args.p_review_state))+','+
    (args.p_error===null?'NULL':sqlText(args.p_error))+')',
  },
 };
 const expression=calls[origin]?.[name]?.();
 if(!expression)throw Error('Unexpected correction bridge RPC '+origin+'.'+name);
 return db(origin==='TAXPAY_SQL'?source:office,
  'BEGIN;SET LOCAL ROLE service_role;SELECT '+expression+';COMMIT;');
}
async function bridgeFetch(input,init){
 const raw=typeof input==='string'?input:input.url;
 const url=new URL(raw);
 const origin=Object.keys(projectHosts).find(key=>url.hostname===projectHosts[key]+'.supabase.co');
 if(!origin||!url.pathname.startsWith('/functions/v1/'))
  throw Error('Blocked external URL in disposable correction Edge test: '+url.origin);
 const path=url.pathname.replace('/functions/v1','')+url.search;
 if(origin==='OFFICE_SQL'&&path==='/payment-sync-bridge'&&failNextOfficeSync){
  failNextOfficeSync=false;
  return new Response(JSON.stringify({error:'DISPOSABLE_OFFICE_OUTAGE'}),
   {status:503,headers:{'content-type':'application/json'}});
 }
 if(origin==='TAXPAY_SQL'&&path==='/payment-command-bridge'&&failNextTaxpayerCommand){
  failNextTaxpayerCommand=false;
  return new Response(JSON.stringify({error:'DISPOSABLE_TAXPAY_COMMAND_OUTAGE'}),
   {status:503,headers:{'content-type':'application/json'}});
 }
 return fetch(bridgeServers[origin]+path,init);
}
function loadBridge(file,origin){
 let handler=null;
 const compiled=transformSync(readFileSync(file,'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
 const module={exports:{}};
 const context={module,exports:module.exports,console,TextEncoder,TextDecoder,Request,Response,Headers,URL,
  AbortSignal,crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,fetch:bridgeFetch,
  require(spec){
   assert.match(spec,/^npm:@supabase\/supabase-js@/);
   return {createClient:()=>({rpc:async(name,args)=>{
    // No ordinary payment outbox rows are part of this correction fixture;
    // every correction-specific RPC below runs against its actual SQL.
    if(origin==='TAXPAY_SQL'&&name==='payment_v1_internal_claim')return {data:[],error:null};
    try{return {data:sqlRpc(origin,name,args),error:null};}
    catch(error){return {data:null,error:{message:error instanceof Error?error.message:String(error)}};}
   }})};
  },
  Deno:{env:{get(name){
   if(name==='SUPABASE_URL')return 'https://'+projectHosts[origin]+'.supabase.co';
   if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:'disposable-service-key'});
   if(name==='SUPABASE_SERVICE_ROLE_KEY')return 'disposable-service-key';
   return null;
  }},serve(callback){handler=callback;}},
 };
 vm.runInNewContext(compiled,context,{filename:file,timeout:5000});
 assert.equal(typeof handler,'function','Correction bridge handler did not register: '+file);
 return handler;
}
async function startBridge(origin,root){
 const routes={
  '/payment-sync-bridge':loadBridge(resolve(root,'supabase/functions/payment-sync-bridge/index.ts'),origin),
  '/payment-command-bridge':loadBridge(resolve(root,'supabase/functions/payment-command-bridge/index.ts'),origin),
 };
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  const handler=routes[path];
  if(!handler){res.writeHead(404);res.end();return;}
  let body='';for await(const part of req)body+=part;
  try{
   const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,
    body:req.method==='POST'?body:undefined});
   const response=await handler(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end(JSON.stringify({error:String(error)}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 bridgeServers[origin]='http://127.0.0.1:'+server.address().port;
 return server;
}
async function postBridge(origin,path,body){
 const response=await fetch(bridgeServers[origin]+path,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function signBridgePayload(text){
 const key=await webcrypto.subtle.importKey('raw',Uint8Array.from(bridgeKey.match(/../g),x=>parseInt(x,16)),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
function installOfficeCommandClaim(){
 const hosted=readFileSync(resolve(officeRoot,
  'supabase/hosted_migration_history/20261017103132_payment_v1_phase4_officer_command.sql'),'utf8');
 const marker='create or replace function public.payment_v1_internal_claim_commands';
 const start=hosted.indexOf(marker);
 const end=start<0?-1:hosted.indexOf('$function$;',start)+'$function$;'.length;
 assert.ok(start>=0&&end>start,'Existing Office command claim contract is unavailable');
 db(office,'BEGIN;'+hosted.slice(start,end)+
  'REVOKE ALL ON FUNCTION public.payment_v1_internal_claim_commands(integer) FROM PUBLIC,anon,authenticated;'+
  'GRANT EXECUTE ON FUNCTION public.payment_v1_internal_claim_commands(integer) TO service_role;'+
  "SELECT 'true'::jsonb;COMMIT;");
}
const owner='80000000-0000-4000-8000-000000000001';
const outsider='80000000-0000-4000-8000-000000000002';
// This paired source/Office round trip exercises F-094's explicit allegation
// classification; the underlying base SQL acceptance still tests the legacy
// correction default separately. No hosted SQL data is used.
const originalCorrectionFixture=readFileSync('tests/integration/correctionOfficeReadback.sql','utf8');
const fixtureColumns='(requester_uid,original_reference,reason,requested_outcome,change_kind,old_value,new_value)';
const fixtureValues="'CIRCLE','Circle A','Circle B')";
assert.equal(originalCorrectionFixture.split(fixtureColumns).length,2);
assert.equal(originalCorrectionFixture.split(fixtureValues).length,2);
const correctionFixture=originalCorrectionFixture
 .replace(fixtureColumns,'(requester_uid,original_reference,reason,requested_outcome,change_kind,old_value,new_value,case_kind)')
 .replace(fixtureValues,"'CIRCLE','Circle A','Circle B','UNSOLICITED_PAYMENT_REPORT')");
const cut=correctionFixture.indexOf('DO $owner_initial$\n');
assert.ok(cut>0,'Passing correction fixture anchor missing');
const initial=correctionFixture.slice(0,cut)+[
 'RESET ROLE;',
 'SELECT jsonb_build_object(',
 " 'inquiryId',i.inquiry_id,'sourcePaymentId',i.original_payment_id,",
 " 'sourcePaymentKind',i.original_payment_kind,'ownerUid',i.requester_uid,'caseKind',i.case_kind,",
 " 'originalPayment',(SELECT data FROM demo_payment.story_payments p WHERE p.id=i.original_payment_id),",
 " 'eventId',o.event_id,'outboxState',o.delivery_state)",
 ' FROM public.taxpay_correction_inquiries i',
 ' JOIN payment_sync.correction_outbox o ON o.inquiry_id=i.inquiry_id',
 ' WHERE i.inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);',
 'COMMIT;'
].join('\n');
const started=db(source,initial);
assert.equal(started.ownerUid,owner);
assert.equal(started.sourcePaymentKind,'TAXPAY_STORY_PAYMENT');
assert.equal(started.caseKind,'UNSOLICITED_PAYMENT_REPORT');
assert.equal(started.sourcePaymentId,'80000000-0000-4000-8000-000000000041');
assert.equal(started.outboxState,'PENDING');
assert.equal(started.originalPayment.details.receiptReference,'SYN-REF-003');
installBridgeSettings('TAXPAY_SQL',resolve('.'),
 'supabase/hosted_migration_history/20261016222840_payment_v1_taxpayer_requests.sql');
installBridgeSettings('OFFICE_SQL',officeRoot,
 'supabase/hosted_migration_history/20261016222757_payment_v1_office_requests.sql');
installBridgeConfig('TAXPAY_SQL',resolve('.'),
 'supabase/hosted_migration_history/20261017063603_payment_v1_hosted_bridge.sql');
installBridgeConfig('OFFICE_SQL',officeRoot,
 'supabase/hosted_migration_history/20261017063621_payment_v1_hosted_bridge.sql');
const [taxpayerBridgeServer,officeBridgeServer]=await Promise.all([
 startBridge('TAXPAY_SQL',resolve('.')),startBridge('OFFICE_SQL',officeRoot),
]);
let deferredCorrectionEvents=[];
try{
 // The shared disposable Taxpayer database may contain pending corrections
 // from earlier Phase 02 steps. Keep only this fixture's event claimable so the
 // injected outage and retry assertions remain scoped to the current inquiry.
 deferredCorrectionEvents=db(source,
  "SELECT coalesce(jsonb_agg(jsonb_build_object('eventId',event_id,'nextAttemptAt',next_attempt_at)),'[]'::jsonb) "+
  "FROM payment_sync.correction_outbox WHERE inquiry_id<> '"+started.inquiryId+"'::uuid "+
  "AND delivery_state<>'ACKNOWLEDGED';");
 for(const event of deferredCorrectionEvents){
  db(source,"UPDATE payment_sync.correction_outbox SET next_attempt_at=now()+interval '2 hours' "+
   "WHERE event_id='"+event.eventId+"'::uuid;SELECT 'true'::jsonb;");
 }
 const failedDispatch=await postBridge('TAXPAY_SQL','/payment-sync-bridge',
  {mode:'dispatch',token:dispatchTokens.TAXPAY_SQL});
 assert.equal(failedDispatch.status,200);
 assert.deepEqual(failedDispatch.data,{claimed:1,acknowledged:0,failed:1},
  'The existing source Edge must retain an Office outage as a retryable correction delivery');
const failed=db(source,
 "SELECT jsonb_build_object('state',delivery_state,'attempts',attempts,'later',next_attempt_at>now()) FROM payment_sync.correction_outbox WHERE inquiry_id='"+started.inquiryId+"'::uuid;");
assert.equal(failed.state,'FAILED');assert.equal(failed.attempts,1);
assert.equal(failed.later,true);
db(source,"UPDATE payment_sync.correction_outbox SET next_attempt_at=now()-interval '1 second' WHERE inquiry_id='"+started.inquiryId+"'::uuid RETURNING to_jsonb(delivery_state);");
const retryDispatch=await postBridge('TAXPAY_SQL','/payment-sync-bridge',
 {mode:'dispatch',token:dispatchTokens.TAXPAY_SQL});
assert.equal(retryDispatch.status,200);
assert.deepEqual(retryDispatch.data,{claimed:1,acknowledged:1,failed:0},
 'The existing signed Edge must deliver and acknowledge the retry against separate Office SQL');
const outboxAfterRetry=db(source,
 "SELECT jsonb_build_object('state',delivery_state,'attempts',attempts,'eventId',event_id,'payload',event_payload,'createdAt',created_at) FROM payment_sync.correction_outbox WHERE inquiry_id='"+started.inquiryId+"'::uuid;");
assert.equal(outboxAfterRetry.state,'ACKNOWLEDGED');assert.equal(outboxAfterRetry.attempts,2);
assert.equal(outboxAfterRetry.eventId,started.eventId);
const retryEvent={schemaVersion:'1.0.0',eventId:outboxAfterRetry.eventId,requestId:started.inquiryId,
 origin:'TAXPAY_SQL',eventType:'CORRECTION_SUBMITTED',revision:1,occurredAt:outboxAfterRetry.createdAt,
 payload:outboxAfterRetry.payload};
assert.equal(retryEvent.payload.originalPaymentId,started.sourcePaymentId);
assert.equal(retryEvent.payload.originalPaymentKind,'TAXPAY_STORY_PAYMENT');
assert.equal(retryEvent.payload.caseKind,'UNSOLICITED_PAYMENT_REPORT');
assert.ok(!('requesterUid' in retryEvent.payload),'Private owner identity leaked to Office');

const maker='80000000-0000-4000-8000-000000000011';
const reviewer='80000000-0000-4000-8000-000000000012';
const approver='80000000-0000-4000-8000-000000000013';
const bootstrap=[
 'BEGIN;',
 'CREATE TABLE IF NOT EXISTS payment_sync.control_outbox(',
 ' message_id uuid PRIMARY KEY,request_id uuid NOT NULL,target_origin text NOT NULL,',
 " payload jsonb NOT NULL,delivery_state text NOT NULL DEFAULT 'PENDING',",
 ' attempts integer NOT NULL DEFAULT 0,acknowledged_at timestamptz,last_error text,',
 ' next_attempt_at timestamptz NOT NULL DEFAULT now(),claim_token uuid,',
 ' created_at timestamptz NOT NULL DEFAULT now());',
 'ALTER TABLE payment_sync.control_outbox ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();',
 'CREATE TABLE IF NOT EXISTS payment_sync.officer_decisions(',
 ' request_id uuid NOT NULL,officer_uid uuid NOT NULL,officer_role text NOT NULL,',
 ' action_code text NOT NULL,reason text NOT NULL,idempotency_key uuid NOT NULL,',
 ' message_id uuid NOT NULL,UNIQUE(request_id,officer_uid,idempotency_key));',
 'INSERT INTO auth.users(id,email) VALUES',
 " ('"+maker+"','maker-ws3@example.invalid'),",
 " ('"+reviewer+"','reviewer-ws3@example.invalid'),",
 " ('"+approver+"','approver-ws3@example.invalid') ON CONFLICT(id) DO NOTHING;",
 'INSERT INTO payment_sync.officer_roles(user_uid,role,active) VALUES',
 " ('"+maker+"','MAKER',true),('"+reviewer+"','REVIEWER',true),",
 " ('"+approver+"','APPROVER',true) ON CONFLICT(user_uid) DO UPDATE SET role=excluded.role,active=excluded.active;",
 "SELECT 'true'::jsonb;COMMIT;"
].join('\n');
assert.equal(db(office,bootstrap),true);
installOfficeCommandClaim();
// Office #298 added provenance-scoped V2 corrections without replacing the
// original Office review queue. Install the actual companion migration in the
// disposable Office database so this legacy round-trip verifies compatibility.
const officeV2Migration=readFileSync(resolve(officeRoot,
 'supabase/migrations/20261124060500_office_v2_demo_correction_sync.sql'),'utf8');
assert.match(officeV2Migration,/create function public\.payment_v1_demo_correction_route\(p_id uuid\)/);
const officeHasV2Route=db(office,
 "SELECT to_jsonb(to_regprocedure('public.payment_v1_demo_correction_route(uuid)') IS NOT NULL);");
if(!officeHasV2Route)db(office,officeV2Migration+"\nSELECT 'true'::jsonb;");
const correctionReplayText=JSON.stringify(retryEvent);
const correctionReplay=await postBridge('OFFICE_SQL','/payment-sync-bridge',
 {mode:'ingest',eventText:correctionReplayText,signature:await signBridgePayload(correctionReplayText)});
assert.equal(correctionReplay.status,200);
assert.equal(correctionReplay.data.stored,true);assert.equal(correctionReplay.data.duplicate,true,
 'The Office SQL inbox must accept exact signed replay without duplicating the correction mirror');
const queue=db(office,auth(maker,'SELECT public.payment_v1_correction_queue_page(200,NULL,NULL);'));
const item=queue.items.find(v=>v.requestId===started.inquiryId);
assert.ok(item);assert.equal(item.sourcePaymentId,started.sourcePaymentId);
assert.equal(item.caseKind,'UNSOLICITED_PAYMENT_REPORT',
 'Original source case category must survive signed Edge delivery to separate Office SQL');
assert.equal(item.sourceEventId,started.eventId);
assert.equal(item.reviewState,'PENDING_OFFICER');
assert.equal(db(office,"SELECT coalesce(to_jsonb(public.payment_v1_demo_correction_route('"+
 started.inquiryId+"'::uuid)),'null'::jsonb);"),null,
 'Original Office correction must not be misrouted to Taxpayer-v2');
assert.deepEqual(item.availableActions,['MAKER_ACKNOWLEDGE']);

const blocked=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',office],
 {input:auth(outsider,'SELECT public.payment_v1_correction_queue_page(200,NULL,NULL);'),encoding:'utf8'});
assert.notEqual(blocked.status,0,'Non-officer must not read Office correction queue');
const stages=[
 {actor:maker,role:'MAKER',action:'MAKER_ACKNOWLEDGE',state:'MAKER_ACKNOWLEDGED'},
 {actor:reviewer,role:'REVIEWER',action:'REVIEWER_VERIFY',state:'REVIEWER_VERIFIED'},
 {actor:approver,role:'APPROVER',action:'APPROVER_CLOSE',state:'APPROVER_CLOSED'}
];
for(const stage of stages){
 const key=randomUUID();
 const call="SELECT public.payment_v1_correction_officer_action('"+
    started.inquiryId+"'::uuid,'"+stage.action+
    "','WS3 disposable correction review','"+
    key+"'::uuid);";
 const saved=db(office,auth(stage.actor,call));
 const duplicate=db(office,auth(stage.actor,call));
 assert.equal(saved.queued,true);assert.equal(saved.replayed,false);
 assert.equal(duplicate.replayed,true);assert.equal(saved.messageId,duplicate.messageId);
 const command=db(office,"SELECT payload FROM payment_sync.control_outbox WHERE message_id='"+saved.messageId+"'::uuid;");
 assert.equal(command.origin,'OFFICE_SQL');assert.equal(command.requestId,started.inquiryId);
 assert.equal(command.officerRole,stage.role);
 const firstCommandAttempt=await postBridge('OFFICE_SQL','/payment-command-bridge',
  {mode:'dispatch',token:dispatchTokens.OFFICE_SQL});
 assert.equal(firstCommandAttempt.status,200);
 if(stage===stages[0]){
  assert.deepEqual(firstCommandAttempt.data,{claimed:1,acknowledged:0,failed:1},
   'An unreachable Taxpayer command endpoint must leave the Office correction decision retryable');
  const commandFailed=db(office,"SELECT jsonb_build_object('state',delivery_state,'attempts',attempts,'later',next_attempt_at>now()) FROM payment_sync.control_outbox WHERE message_id='"+saved.messageId+"'::uuid;");
  assert.equal(commandFailed.state,'FAILED');assert.equal(commandFailed.attempts,1);
  assert.equal(commandFailed.later,true);
  const sourceBeforeRetry=db(source,"SELECT to_jsonb(office_review_state) FROM public.taxpay_correction_inquiries WHERE inquiry_id='"+started.inquiryId+"'::uuid;");
  assert.equal(sourceBeforeRetry,'PENDING_OFFICER',
   'A failed command transport must not claim that Taxpayer SQL accepted the Office decision');
  db(office,"UPDATE payment_sync.control_outbox SET next_attempt_at=now()-interval '1 second' WHERE message_id='"+saved.messageId+"'::uuid RETURNING to_jsonb(delivery_state);");
 }
 const delivered=stage===stages[0]?await postBridge('OFFICE_SQL','/payment-command-bridge',
  {mode:'dispatch',token:dispatchTokens.OFFICE_SQL}):firstCommandAttempt;
 assert.equal(delivered.status,200);
 assert.deepEqual(delivered.data,{claimed:1,acknowledged:1,failed:0},
  'The existing Office command Edge must deliver the signed review to Taxpayer SQL');
 const commandOutbox=db(office,"SELECT jsonb_build_object('state',delivery_state,'attempts',attempts) FROM payment_sync.control_outbox WHERE message_id='"+saved.messageId+"'::uuid;");
 assert.equal(commandOutbox.state,'ACKNOWLEDGED');
 assert.equal(commandOutbox.attempts,stage===stages[0]?2:1);
 const commandText=JSON.stringify(command);
 const commandReplay=await postBridge('TAXPAY_SQL','/payment-command-bridge',
  {mode:'ingest',commandText,signature:await signBridgePayload(commandText)});
 assert.equal(commandReplay.status,200);
 assert.equal(commandReplay.data.stored,true);
 assert.equal(commandReplay.data.duplicate,true);
 assert.equal(commandReplay.data.reviewState,stage.state,
  'A signed command replay must preserve the Taxpayer decision without applying it twice');
 const noPendingCommand=await postBridge('OFFICE_SQL','/payment-command-bridge',
  {mode:'dispatch',token:dispatchTokens.OFFICE_SQL});
 assert.equal(noPendingCommand.status,200);
 assert.deepEqual(noPendingCommand.data,{claimed:0,acknowledged:0,failed:0},
  'Acknowledged Office command must not be redelivered on a retry sweep');
 const officeReview=db(office,"SELECT jsonb_build_object('state',review_state,'revision',review_revision) FROM payment_sync.correction_mirrors WHERE inquiry_id='"+
  started.inquiryId+"'::uuid;");
 assert.equal(officeReview.state,stage.state);
 const sourceReview=db(source,"SELECT jsonb_build_object('state',office_review_state,'revision',office_review_revision) FROM public.taxpay_correction_inquiries WHERE inquiry_id='"+
  started.inquiryId+"'::uuid;");
 assert.equal(sourceReview.state,stage.state);
 const adminReadback=db(office,auth(maker,
  "SELECT public.payment_v1_correction_queue_page(200,NULL,NULL);"));
 const adminItem=adminReadback.items.find(v=>v.requestId===started.inquiryId);
 assert.equal(adminItem.reviewState,stage.state);
assert.equal(adminItem.caseKind,'UNSOLICITED_PAYMENT_REPORT');
}
const completed=db(source,"SELECT jsonb_build_object("+
 " 'state',i.office_review_state,'revision',i.office_review_revision,"+
 " 'payment',(SELECT data FROM demo_payment.story_payments p WHERE p.id=i.original_payment_id),"+
 " 'notifications',(SELECT count(*) FROM public.taxpay_in_app_notifications n WHERE n.correction_inquiry_id=i.inquiry_id),"+
 " 'decisions',(SELECT count(*) FROM public.taxpay_correction_review_decisions d WHERE d.inquiry_id=i.inquiry_id)"+
 ") FROM public.taxpay_correction_inquiries i WHERE i.inquiry_id='"+started.inquiryId+"'::uuid;");
assert.equal(completed.state,'APPROVER_CLOSED');assert.equal(completed.revision,4);
assert.equal(completed.decisions,3);assert.equal(completed.notifications,3);
assert.deepEqual(completed.payment,started.originalPayment);
const history=db(source,auth(owner,
 "SELECT coalesce(jsonb_agg(jsonb_build_object('kind',event_kind,'source',source_system,'action',action_code) ORDER BY revision),'[]'::jsonb) FROM public.taxpay_correction_my_history(50) WHERE inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.equal(history.length,4);
assert.deepEqual(history.map(x=>x.source),['TAXPAY_SQL','OFFICE_SQL','OFFICE_SQL','OFFICE_SQL']);
const otherHistory=db(source,auth(outsider,
 "SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM public.taxpay_correction_my_history(50) v WHERE inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.equal(otherHistory.length,0);
const readResult=db(source,auth(owner,
 "UPDATE public.taxpay_in_app_notifications SET is_read=true WHERE correction_inquiry_id='"+
 started.inquiryId+"'::uuid AND message_code='CORRECTION_APPROVER_CLOSED' RETURNING jsonb_build_object('isRead',is_read,'decision',correction_decision_id);"));
assert.equal(readResult.isRead,true);
const readAgain=db(source,auth(owner,
 "SELECT jsonb_build_object('count',count(*),'read',count(*) FILTER(WHERE is_read)) FROM public.taxpay_in_app_notifications WHERE correction_inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.deepEqual(readAgain,{count:3,read:1});
console.log('PASS: original Taxpayer correction SQL -> signed payment-sync Edge -> separate Office correction SQL and authorized officer queue -> signed command Edge -> Taxpayer status/history/recipient notifications; Office outage retry, signed event/command replay, source parent immutability and outsider isolation');
}finally{
 for(const event of deferredCorrectionEvents){
  db(source,"UPDATE payment_sync.correction_outbox SET next_attempt_at="+sqlText(event.nextAttemptAt)+
   "::timestamptz WHERE event_id='"+event.eventId+"'::uuid;SELECT 'true'::jsonb;");
 }
 await Promise.all([taxpayerBridgeServer,officeBridgeServer].map(server=>new Promise(resolve=>server.close(resolve))));
}
