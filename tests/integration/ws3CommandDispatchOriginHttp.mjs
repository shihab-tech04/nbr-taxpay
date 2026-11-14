/**
 * Focused regression for the existing Office-only command dispatcher.
 * Runs the real Taxpayer Edge handler with an isolated Supabase RPC stand-in.
 * No hosted endpoint, credentials, or SQL mutation is used.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const handlerPath=process.env.WS3_COMMAND_BRIDGE_SOURCE ||
  'supabase/functions/payment-command-bridge/index.ts';
const dispatchToken='isolated-valid-taxpayer-token';
const signingSecret=randomBytes(32).toString('hex');
const rpcCalls=[];
let peerCalls=0,handler=null;
const config={origin:'TAXPAY_SQL',selfUrl:'https://taxpayer.invalid/payment-command-bridge',
  peerUrl:'https://office.invalid/payment-sync-bridge',dispatchToken,
  signingKey:signingSecret,enabled:true};
const source=readFileSync(handlerPath,'utf8');
const compiled=transformSync(source,{loader:'ts',format:'cjs',target:'es2022'}).code;
const module={exports:{}};
const context={
  module,exports:module.exports,console,TextEncoder,TextDecoder,Request,Response,Headers,URL,
  AbortSignal,crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,
  fetch:async()=>{peerCalls++;throw new Error('wrong-origin request reached peer');},
  require(name){
    assert.match(name,/^npm:@supabase\/supabase-js@/);
    return {createClient:()=>({rpc:async(name)=>{
      rpcCalls.push(name);
      return name==='payment_v1_internal_bridge_config'
        ? {data:config,error:null}
        : {data:[],error:null};
    }})};
  },
  Deno:{env:{get(name){
    if(name==='SUPABASE_URL')return 'https://taxpayer.invalid';
    if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:'isolated-local-secret'});
    return null;
  }},serve(fn){handler=fn;}},
};
vm.runInNewContext(compiled,context,{filename:handlerPath,timeout:5000});
assert.equal(typeof handler,'function','real Taxpayer command Edge handler did not register');

const response=await handler(new Request('http://127.0.0.1/payment-command-bridge',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({mode:'dispatch',token:dispatchToken}),
}));
const body=await response.json();

assert.equal(response.status,403,'valid token on Taxpayer origin must be an explicit forbidden response');
assert.deepEqual(body,{error:'Forbidden'});
assert.deepEqual(rpcCalls,['payment_v1_internal_bridge_config'],
  'wrong-origin dispatch must stop before claiming or acknowledging Office commands');
assert.equal(peerCalls,0,'wrong-origin dispatch must not call the Office peer');
console.log('PASS: actual Taxpayer command Edge rejects wrong-origin dispatch with HTTP 403 before command claim, acknowledgement, or peer call');
