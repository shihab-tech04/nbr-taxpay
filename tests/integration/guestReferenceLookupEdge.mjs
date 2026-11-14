// F-129 / US-050: original Taxpayer SQL -> actual local Edge guest reference.
// One approved synthetic profile-capability owner, never public reference alone.
// Local Docker/Supabase only; no production data, credentials or Office writes.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const base='http://127.0.0.1:54321/functions/v1/demo-story1-taxpay/payments/reference';
const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
assert.ok(key,'Disposable Supabase public key required');
function lit(v){return "'"+String(v).replaceAll("'","''")+"'";}
function sqlJson(statement){
 const p=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'54322',
    PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:'postgres'}
 });
 assert.equal(p.status,0,'Local SQL test fixture failed: '+(p.stderr||'').slice(0,1000));
 return JSON.parse(p.stdout.trim());
}
const owner=sqlJson("SELECT public.taxpay_demo_profile_login('user1','user1');");
const other=sqlJson("SELECT public.taxpay_demo_profile_login('user2','user2');");
assert.match(owner.capability,/^[A-Za-z0-9_-]{43}$/);
assert.match(other.capability,/^[A-Za-z0-9_-]{43}$/);
const hash=createHash('sha256').update(owner.capability).digest('hex');
const keyId=randomUUID();
const ref='WS3-HTTP-REF-'+keyId;
const payload={
 origin:'TAXPAY_UI',service:'TAX_WITH_RETURN',amountMinor:12345,
 sessionId:owner.paymentSessionId,idempotencyKey:keyId,
 details:{payerId:'user1',payerName:'WS3 isolated fictional payer',
  receiptReference:ref,receiptMobile:'01700000000',
  tokenNumber:'WS3-HTTP-TOKEN-'+keyId,
  lines:[{beneficiary:'user1',category:'TAX_WITH_RETURN',
   assessmentYear:'2026-27',amountMinor:12345}]}
};
const payment=sqlJson('SELECT public.taxpay_demo_story1_submit('+
 lit(hash)+','+lit(JSON.stringify(payload))+'::jsonb);');
assert.match(payment.id,/^[0-9a-f-]{36}$/i);
assert.equal(payment.replayed,false);

async function lookup(capability,reference,mobile,expect,extra={}){
 const url=new URL(base);
 url.searchParams.set('reference',reference);
 if(mobile!==null)url.searchParams.set('receiptMobile',mobile);
 for(const [k,v] of Object.entries(extra))url.searchParams.set(k,v);
 const headers={'apikey':key,'origin':'http://127.0.0.1:4173'};
 if(capability!==null)headers['x-taxpay-guest-capability']=capability;
 const response=await fetch(url,{method:'GET',headers,signal:AbortSignal.timeout(10000)});
 const body=await response.json();
 assert.equal(response.status,expect,JSON.stringify({expect,actual:response.status,error:body.error}));
 assert.equal(body.success,expect===200);
 return body;
}
const valid=(await lookup(owner.capability,ref,'01700000000',200)).data;
assert.equal(valid.id,payment.id);
assert.equal(valid.status,'SIMULATED_SUCCESS');
assert.equal(valid.service,'TAX_WITH_RETURN');
assert.equal(valid.amountMinor,12345);
assert.equal(valid.details.receiptReference,ref);
const retry=(await lookup(owner.capability,ref,'01700000000',200)).data;
assert.deepEqual(retry,valid,'Repeated read must preserve immutable receipt');
const certificate=(await lookup(owner.capability,'SK-PC-'+payment.id,null,200)).data;
assert.equal(certificate.id,payment.id);
await lookup(null,ref,'01700000000',401);
await lookup(other.capability,ref,'01700000000',404);
await lookup(owner.capability,ref,'01700000001',404);
await lookup(owner.capability,'WS3-NOT-FOUND-'+keyId,null,404);
await lookup('A'.repeat(43),ref,null,403);
await lookup(owner.capability,ref,'0123',400);
await lookup(other.capability,'SK-PC-'+payment.id,null,404);
await lookup(owner.capability,ref,null,200,{sessionId:randomUUID()});
console.log('PASS: real isolated Taxpayer Edge + SQL reference recovery, refresh, wrong owner/mobile/capability, missing proof and certificate ID; no Office or hosted access');
