/**
 * Focused regression for the existing Office-only command dispatcher.
 * Runs the real Taxpayer Edge handler with an isolated Supabase RPC stand-in.
 * No hosted endpoint, credentials, or SQL mutation is used.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,randomBytes,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const taxpayerHandlerPath=process.env.WS3_COMMAND_BRIDGE_SOURCE ||
  'supabase/functions/payment-command-bridge/index.ts';
const officeRoot=process.env.WS3_OFFICE_SOURCE;
assert.ok(officeRoot,'Pin the current Office #270 source with WS3_OFFICE_SOURCE');
const officeHandlerPath=officeRoot+'/supabase/functions/payment-command-bridge/index.ts';
const taxpayerDispatchToken='isolated-valid-taxpayer-token';
const officeDispatchToken='isolated-valid-office-token';
const signingSecret=randomBytes(32).toString('hex');
const command={schemaVersion:'1.0.0',messageId:'ws3-command-1',requestId:'ws3-request-1',
  origin:'OFFICE_SQL',action:'REVIEW',officerUid:'ws3-officer',officerRole:'MAKER',
  reason:null,expectedReviewState:'SUBMITTED',occurredAt:'2026-11-14T00:00:00.000Z'};

function loadHandler(handlerPath,origin,onRpc,onFetch){
  let handler=null;
  const config={origin,selfUrl:'https://'+origin.toLowerCase()+'.invalid/payment-command-bridge',
    peerUrl:'https://'+(origin==='OFFICE_SQL'?'taxpayer':'office')+'.invalid/payment-sync-bridge',
    dispatchToken:origin==='OFFICE_SQL'?officeDispatchToken:taxpayerDispatchToken,
    signingKey:signingSecret,enabled:true};
  const source=readFileSync(handlerPath,'utf8');
  const compiled=transformSync(source,{loader:'ts',format:'cjs',target:'es2022'}).code;
  const module={exports:{}};
  const context={
    module,exports:module.exports,console,TextEncoder,TextDecoder,Request,Response,Headers,URL,
    AbortSignal,crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,
    fetch:onFetch,
    require(name){
      assert.match(name,/^npm:@supabase\/supabase-js@/);
      return {createClient:()=>({rpc:async(name,args)=>{
        try{return {data:await onRpc(name,args,config),error:null};}
        catch(error){return {data:null,error:{message:String(error)}};}
      }})};
    },
    Deno:{env:{get(name){
      if(name==='SUPABASE_URL')return 'https://'+origin.toLowerCase()+'.invalid';
      if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:'isolated-local-secret'});
      return null;
    }},serve(fn){handler=fn;}},
  };
  vm.runInNewContext(compiled,context,{filename:handlerPath,timeout:5000});
  assert.equal(typeof handler,'function','real '+origin+' command Edge handler did not register');
  return handler;
}

const taxpayerRpcCalls=[],officeRpcCalls=[],peerRequests=[];
const taxpayerHandler=loadHandler(taxpayerHandlerPath,'TAXPAY_SQL',async(name)=>{
  taxpayerRpcCalls.push(name);
  return name==='payment_v1_internal_bridge_config'
    ? {origin:'TAXPAY_SQL',dispatchToken:taxpayerDispatchToken,enabled:true,
      signingKey:signingSecret,selfUrl:'https://taxpayer.invalid/payment-command-bridge',
      peerUrl:'https://office.invalid/payment-sync-bridge'} : [];
},async()=>{throw new Error('wrong-origin request reached peer');});
const denied=await taxpayerHandler(new Request('http://127.0.0.1/payment-command-bridge',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({mode:'dispatch',token:taxpayerDispatchToken}),
}));
assert.equal(denied.status,403,'valid token on Taxpayer origin must be explicitly forbidden');
assert.deepEqual(await denied.json(),{error:'Forbidden'});
assert.deepEqual(taxpayerRpcCalls,['payment_v1_internal_bridge_config'],
  'wrong-origin dispatch must stop before claiming or acknowledging Office commands');

const officeHandler=loadHandler(officeHandlerPath,'OFFICE_SQL',async(name,args)=>{
  officeRpcCalls.push({name,args});
  if(name==='payment_v1_internal_bridge_config')return {
    origin:'OFFICE_SQL',dispatchToken:officeDispatchToken,enabled:true,
    signingKey:signingSecret,selfUrl:'https://office.invalid/payment-command-bridge',
    peerUrl:'https://taxpayer.invalid/payment-sync-bridge'};
  if(name==='payment_v1_internal_claim_commands')
    return [{claimToken:'ws3-claim-1',command}];
  if(name==='payment_v1_internal_ack_command')return true;
  throw new Error('Unexpected Office RPC '+name);
},async(input,init)=>{
  peerRequests.push({url:String(input),init});
  const message=JSON.parse(init.body);
  assert.equal(message.mode,'ingest');
  assert.equal(message.commandText,JSON.stringify(command));
  assert.equal(message.signature,createHmac('sha256',Buffer.from(signingSecret,'hex'))
    .update(message.commandText).digest('hex'),'authorized dispatch must keep the signed command contract');
  return new Response(JSON.stringify({stored:true,messageId:command.messageId}),
    {status:200,headers:{'content-type':'application/json'}});
});
const unauthorized=await officeHandler(new Request('http://127.0.0.1/payment-command-bridge',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({mode:'dispatch',token:'wrong-token'}),
}));
assert.equal(unauthorized.status,401,'the existing token denial contract must remain unchanged');
assert.deepEqual(officeRpcCalls.map(call=>call.name),['payment_v1_internal_bridge_config'],
  'an invalid token must not claim Office commands');
const accepted=await officeHandler(new Request('http://127.0.0.1/payment-command-bridge',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({mode:'dispatch',token:officeDispatchToken}),
}));
assert.equal(accepted.status,200,'authorized Office dispatch must remain successful');
assert.deepEqual(await accepted.json(),{claimed:1,acknowledged:1,failed:0});
assert.deepEqual(officeRpcCalls.map(call=>call.name),[
  'payment_v1_internal_bridge_config','payment_v1_internal_bridge_config',
  'payment_v1_internal_claim_commands','payment_v1_internal_ack_command'
]);
assert.deepEqual(JSON.parse(JSON.stringify(officeRpcCalls.at(-1).args)),
  {p_message_id:command.messageId,p_claim_token:'ws3-claim-1',p_success:true,p_error:null});
assert.equal(peerRequests.length,1,'authorized command should reach the Taxpayer peer once');
assert.equal(peerRequests[0].url,'https://taxpayer.invalid/payment-command-bridge');
console.log('PASS: Taxpayer wrong-origin dispatch is HTTP 403 before claim; Office invalid-token denial remains 401; authorized Office dispatch retains signed HTTP, persistence ACK, and HTTP 200');
