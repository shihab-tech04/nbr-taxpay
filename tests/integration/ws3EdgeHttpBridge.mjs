/**
 * WS3 isolated HTTP contract: execute BOTH repos' real TypeScript Edge handlers,
 * not route mocks. Supabase RPC responses are isolated stand-ins; real SQL is
 * independently verified by existing paired tests and is NOT claimed here.
 * No hosted SQL, credentials, Finance, or production endpoints are accessed.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createHmac,randomBytes,randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const officeRoot=process.env.WS3_OFFICE_SOURCE;
assert.ok(officeRoot,'Pin original Office PR #270 source with WS3_OFFICE_SOURCE');
const payerRoot='.';
const key=randomBytes(32).toString('hex'),payerToken=randomUUID(),officeToken=randomUUID();
const states={
 TAXPAY_SQL:{origin:'TAXPAY_SQL',claims:[],corrections:[],commands:new Map(),acks:[],denied:false},
 OFFICE_SQL:{origin:'OFFICE_SQL',claims:[],commands:[],events:new Map(),corrections:new Map(),acks:[],denied:false},
};
const endpoints={},requestFailures={taxpayer:false,office:false};
const fixtureId=randomUUID(),eventId=randomUUID(),sourceParent=randomUUID();
const original={
 schemaVersion:'1.0.0',eventId,requestId:fixtureId,origin:'TAXPAY_SQL',revision:1,
 payload:{paymentParentId:sourceParent,service:'OTHER_TAX_PAYMENT',origin:'TAXPAY_UI',
  payerId:'ws3-isolated-payer',allocations:[
   {allocationId:'existing-a',recipientTin:'111111111111',headId:121,assessmentYear:'2026-27',amountMinor:1500},
   {allocationId:'existing-b',recipientTin:'222222222222',headId:145,assessmentYear:'2025-26',amountMinor:3500}
  ],receiptReference:'WS3-ISOLATED-RECEIPT',certificateReference:'SK-PC-'+sourceParent}
};
const sourceClaim={event:original,claimToken:randomUUID(),status:'PENDING',attempts:0};
states.TAXPAY_SQL.claims.push(sourceClaim);
function rpc(origin,name,args={}){
 const state=states[origin];
 if(name==='payment_v1_internal_bridge_config'){
  return {origin,selfUrl:endpoints[origin]+'/payment-sync-bridge',
   peerUrl:endpoints[origin==='TAXPAY_SQL'?'OFFICE_SQL':'TAXPAY_SQL']+'/payment-sync-bridge',
   dispatchToken:origin==='TAXPAY_SQL'?payerToken:officeToken,signingKey:key,enabled:true};
 }
 if(name==='payment_v1_internal_claim')
  return state.claims.filter(x=>x.status==='PENDING').map(x=>({event:x.event,claimToken:x.claimToken}));
 if(name==='taxpay_correction_internal_claim')return state.corrections.filter(x=>x.status==='PENDING').map(x=>({event:x.event,claimToken:x.claimToken}));
 if(name==='payment_v1_internal_claim_commands')return state.commands.filter(x=>x.status==='PENDING').map(x=>({command:x.command,claimToken:x.claimToken}));
 if(name==='payment_v1_internal_ack'||name==='taxpay_correction_internal_ack'){
  const claim=[...state.claims,...state.corrections].find(x=>x.event.eventId===args.p_event_id&&x.claimToken===args.p_claim_token);
  if(!claim)throw Error('Stale event claim');
  claim.status=args.p_success?'ACKED':'PENDING';if(!args.p_success){claim.claimToken=randomUUID();claim.attempts++;}
  state.acks.push({type:name,id:args.p_event_id,success:args.p_success});
  return true;
 }
 if(name==='payment_v1_internal_ingest'||name==='payment_v1_internal_ingest_correction'){
  const map=name==='payment_v1_internal_ingest'?state.events:state.corrections;
  if(!(map instanceof Map))throw Error('Wrong endpoint');
  const event=args.p_event;const prior=map.get(event.eventId);
  if(prior && JSON.stringify(prior)!==JSON.stringify(event))throw Error('Conflicting immutable event replay');
  if(!prior)map.set(event.eventId,structuredClone(event));
  return {eventId:event.eventId,stored:true,duplicate:Boolean(prior)};
 }
 if(name==='taxpay_correction_record_office_decision'){
  const command=args.p_command,prior=state.commands.get(command.messageId);
  if(prior && JSON.stringify(prior)!==JSON.stringify(command))throw Error('Conflicting command replay');
  if(!prior)state.commands.set(command.messageId,structuredClone(command));
  return {messageId:command.messageId,stored:true,duplicate:Boolean(prior),
   reviewState:command.action==='MAKER_ACKNOWLEDGE'?'MAKER_ACKNOWLEDGED':
    command.action==='REVIEWER_VERIFY'?'REVIEWER_VERIFIED':'APPROVER_CLOSED'};
 }
 if(name==='payment_v1_internal_ack_correction_command'||name==='payment_v1_internal_ack_command'){
  const item=state.commands.find(x=>x.command.messageId===args.p_message_id&&x.claimToken===args.p_claim_token);
  if(!item)throw Error('Stale command claim');
  item.status=args.p_success?'ACKED':'PENDING';
  if(!args.p_success){item.claimToken=randomUUID();item.attempts++;}
  state.acks.push({type:name,id:args.p_message_id,success:args.p_success,reviewState:args.p_review_state});
  return true;
 }
 if(name==='payment_v1_internal_ingest_command')return {messageId:args.p_command.messageId,stored:true};
 throw Error('Unrecognized isolated RPC: '+origin+' '+name);
}
function loadHandler(file,origin){
 const source=readFileSync(file,'utf8');
 const compiled=transformSync(source,{loader:'ts',format:'cjs',target:'es2022'}).code;
 const module={exports:{}},box={handler:null};
 const context={
  exports:module.exports,module,console,TextEncoder,TextDecoder,Request,Response,Headers,URL,AbortSignal,
  crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,
  structuredClone,fetch, setTimeout,clearTimeout,
  require(spec){assert.match(spec,/^npm:@supabase\/supabase-js@/);
   return {createClient:()=>({rpc:async(name,args)=>{try{return {data:rpc(origin,name,args)}}catch(e){return {data:null,error:{message:String(e)}}}}})};},
  Deno:{env:{get(name){if(name==='SUPABASE_URL')return 'https://'+origin.toLowerCase()+'.invalid';
   if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:'isolated-secret'});
   return null;}},serve(fn){box.handler=fn;}}
 };
 vm.runInNewContext(compiled,context,{filename:file,timeout:5000});
 assert.equal(typeof box.handler,'function','Real Edge handler was not registered');
 return box.handler;
}
async function start(origin,root){
 const handlers={
  '/payment-sync-bridge':loadHandler(root+'/supabase/functions/payment-sync-bridge/index.ts',origin),
  '/payment-command-bridge':loadHandler(root+'/supabase/functions/payment-command-bridge/index.ts',origin)
 };
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname,handler=handlers[path];
  if(!handler){res.writeHead(404);res.end();return;}
  if(origin==='OFFICE_SQL'&&requestFailures.office&&path==='/payment-sync-bridge'){
   requestFailures.office=false;res.writeHead(503);res.end('{}');return;
  }
  if(origin==='TAXPAY_SQL'&&requestFailures.taxpayer&&path==='/payment-command-bridge'){
   requestFailures.taxpayer=false;res.writeHead(503);res.end('{}');return;
  }
  let raw='';for await(const chunk of req)raw+=chunk;
  try{
   const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:raw});
   const response=await handler(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(JSON.stringify({error:String(e)}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 endpoints[origin]='http://127.0.0.1:'+server.address().port;
 return server;
}
async function post(origin,path,data){
 const r=await fetch(endpoints[origin]+path,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 return {status:r.status,body:await r.json()};
}
function signature(data,secret=key){return createHmac('sha256',Buffer.from(secret,'hex')).update(data).digest('hex');}
const servers=await Promise.all([start('TAXPAY_SQL',payerRoot),start('OFFICE_SQL',officeRoot)]);
try{
 const invalid=await post('OFFICE_SQL','/payment-sync-bridge',{
  mode:'ingest',eventText:JSON.stringify(original),signature:'a'.repeat(64)});
 assert.equal(invalid.status,401);assert.equal(states.OFFICE_SQL.events.size,0);
 assert.equal((await post('TAXPAY_SQL','/payment-sync-bridge',{mode:'dispatch',token:'wrong'})).status,401);
 const altered={...original,payload:{...original.payload,amountMinor:999999}};
 const mismatch=await post('OFFICE_SQL','/payment-sync-bridge',{
  mode:'ingest',eventText:JSON.stringify(altered),signature:signature(JSON.stringify(original))});
 assert.equal(mismatch.status,401);
 const originWrong=await post('TAXPAY_SQL','/payment-sync-bridge',{
  mode:'ingest',eventText:JSON.stringify(original),signature:signature(JSON.stringify(original))});
 assert.equal(originWrong.status,400);

 requestFailures.office=true;
 const outage=await post('TAXPAY_SQL','/payment-sync-bridge',{mode:'dispatch',token:payerToken});
 assert.deepEqual(outage.body,{claimed:1,acknowledged:0,failed:1});
 assert.equal(sourceClaim.status,'PENDING');assert.equal(sourceClaim.attempts,1);
 const recovered=await post('TAXPAY_SQL','/payment-sync-bridge',{mode:'dispatch',token:payerToken});
 assert.deepEqual(recovered.body,{claimed:1,acknowledged:1,failed:0});
 assert.equal(sourceClaim.status,'ACKED');assert.equal(states.OFFICE_SQL.events.size,1);
 assert.deepEqual(states.OFFICE_SQL.events.get(eventId).payload,original.payload);
 assert.equal((await post('TAXPAY_SQL','/payment-sync-bridge',{mode:'dispatch',token:payerToken})).body.claimed,0);

 // Valid signed replay must not create a second financial parent or allocation.
 const signedText=JSON.stringify(original);
 const replay=await post('OFFICE_SQL','/payment-sync-bridge',{
  mode:'ingest',eventText:signedText,signature:signature(signedText)});
 assert.equal(replay.status,200);assert.equal(replay.body.duplicate,true);
 assert.equal(states.OFFICE_SQL.events.size,1);
 const conflicting={...original,payload:{...original.payload,receiptReference:'MUTATED'}};
 const conflictText=JSON.stringify(conflicting);
 const conflict=await post('OFFICE_SQL','/payment-sync-bridge',{
  mode:'ingest',eventText:conflictText,signature:signature(conflictText)});
 assert.equal(conflict.status,500);assert.equal(states.OFFICE_SQL.events.size,1);

 const correction={schemaVersion:'1.0.0',eventId:randomUUID(),requestId:randomUUID(),
  origin:'TAXPAY_SQL',revision:1,eventType:'CORRECTION_SUBMITTED',
  payload:{originalPaymentId:sourceParent,originalPaymentKind:'TAXPAY_STORY_PAYMENT',
   reason:'Isolated Office correction inquiry',evidenceState:'PENDING_EVIDENCE'}};
 states.TAXPAY_SQL.corrections.push({event:correction,claimToken:randomUUID(),status:'PENDING',attempts:0});
 const forward=await post('TAXPAY_SQL','/payment-sync-bridge',{mode:'dispatch',token:payerToken});
 assert.deepEqual(forward.body,{claimed:1,acknowledged:1,failed:0});
 assert.equal(states.OFFICE_SQL.corrections.size,1);
 const command={schemaVersion:'1.0.0',messageId:randomUUID(),requestId:correction.requestId,
  origin:'OFFICE_SQL',commandType:'CORRECTION_REVIEW',action:'MAKER_ACKNOWLEDGE',
  officerUid:randomUUID(),officerRole:'MAKER',reason:'Authenticated isolated maker review',
  idempotencyKey:randomUUID(),expectedReviewState:'PENDING_OFFICER',
  occurredAt:new Date().toISOString()};
 const cmd={command,claimToken:randomUUID(),status:'PENDING',attempts:0};
 states.OFFICE_SQL.commands.push(cmd);
 assert.notEqual((await post('TAXPAY_SQL','/payment-command-bridge',{mode:'dispatch',token:payerToken})).status,200); // Only Office may dispatch; current handler returns 500 for wrong-origin dispatch.
 assert.equal((await post('TAXPAY_SQL','/payment-command-bridge',{
  mode:'ingest',commandText:JSON.stringify(command),signature:'0'.repeat(64)})).status,401);
 requestFailures.taxpayer=true;
 const cmdFailed=await post('OFFICE_SQL','/payment-command-bridge',{mode:'dispatch',token:officeToken});
 assert.deepEqual(cmdFailed.body,{claimed:1,acknowledged:0,failed:1});
 assert.equal(cmd.status,'PENDING');assert.equal(cmd.attempts,1);
 const cmdRetried=await post('OFFICE_SQL','/payment-command-bridge',{mode:'dispatch',token:officeToken});
 assert.deepEqual(cmdRetried.body,{claimed:1,acknowledged:1,failed:0});
 assert.equal(cmd.status,'ACKED');assert.equal(states.TAXPAY_SQL.commands.size,1);
 const t=JSON.stringify(command);
 const cmdReplay=await post('TAXPAY_SQL','/payment-command-bridge',{
  mode:'ingest',commandText:t,signature:signature(t)});
 assert.equal(cmdReplay.status,200);assert.equal(cmdReplay.body.duplicate,true);
 assert.equal(states.TAXPAY_SQL.commands.size,1);
 assert.equal(states.OFFICE_SQL.acks.filter(x=>x.success).length,1);
 console.log('PASS WS3 Edge-to-Edge HTTP handlers: real Taxpayer & Office source, HMAC auth, wrong-origin & tampering denial, payment/correction/decision forwarding, retries, immutable duplicate replay, single source/Office ACK; isolated RPC stand-ins, not production SQL or signed-in Admin acceptance');
}finally{await Promise.all(servers.map(x=>new Promise(resolve=>x.close(resolve))));}
