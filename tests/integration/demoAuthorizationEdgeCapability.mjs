// Disposable localhost-only Edge -> SQL demo-authorization identity test.
// Must never target a hosted project, submit a payment, or alter Office data.
import assert from 'node:assert/strict';
import {localSupabaseEndpoints} from './localSupabaseEndpoints.mjs';
const {origin} = localSupabaseEndpoints();
const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
if(!process.env.TAXPAY_LOCAL_SUPABASE_URL||!key)
  throw new Error('LOCAL_ONLY_AUTHORIZATION_TEST');
const endpoint = origin.replace(/\/$/,'')+'/functions/v1/demo-story1-taxpay';
const profileEndpoint = origin.replace(/\/$/,'')+'/functions/v1/taxpay-guest-beneficiaries';
const headers={apikey:key,origin:'http://127.0.0.1:4173'};
const login=await fetch(profileEndpoint,{
  method:'POST',headers:{...headers,'content-type':'application/json'},
  body:JSON.stringify({action:'demo-login',userId:'user1',password:'user1'})
});
assert.equal(login.status,200,'preview account must be available locally');
const logged=await login.json();
const capability=logged?.data?.capability;
assert.match(capability,/^[A-Za-z0-9_-]{43}$/);
async function check(path,{actor,method='GET',body,expected,withCapability=false}){
  const response=await fetch(endpoint+path,{
    method,headers:{...headers,
      ...(withCapability?{'x-taxpay-guest-capability':capability}:{}),
      ...(body?{'content-type':'application/json'}:{})
    },...(body?{body:JSON.stringify(body)}:{})
  });
  const json=await response.json();
  assert.equal(response.status,expected,
    JSON.stringify({path,method,actor,expected,actual:response.status,code:json?.error}));
  return json;
}
await check('/authorizations?actor=user1',{actor:'user1',expected:403});
await check('/authorizations?actor=user2',{actor:'user2',expected:403,withCapability:true});
const inbox=await check('/authorizations?actor=user1',{actor:'user1',expected:200,withCapability:true});
assert.ok(Array.isArray(inbox.data));
await check('/authorizations',{actor:'user1',method:'POST',expected:403,
  body:{actor:'user1',action:'request',tin:'2222222222222'}});
await check('/authorizations',{actor:'user2',method:'POST',expected:403,withCapability:true,
  body:{actor:'user2',action:'request',tin:'1111111111111'}});
await check('/authorizations/sync',{actor:'user2',method:'POST',expected:403,withCapability:true,
  body:{actor:'user2',id:'00000000-0000-4000-8000-000000000001'}});
// A direct anon PostgREST call must be refused even if actor=user1 is known.
const direct=await fetch(origin.replace(/\/$/,'')+'/rest/v1/rpc/demo_auth_list',{
  method:'POST',headers:{...headers,Authorization:'Bearer '+key,'content-type':'application/json'},
  body:JSON.stringify({p_actor:'user1'})
});
assert.ok([401,403,404].includes(direct.status),
  'Public SQL consent RPC is still executable: HTTP '+direct.status);
console.log('PASS: local Edge accepts only exact issued actor capability; anonymous and cross-actor consent/sync denied; direct RPC private');
