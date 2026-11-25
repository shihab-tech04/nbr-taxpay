// F-129 / US-050: expire only the approved disposable local fixture after the
// real UI recovery test. No hosted project or other owner session is touched.
import assert from 'node:assert/strict';
import {localSupabaseEndpoints} from './localSupabaseEndpoints.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const {origin,dbPort}=localSupabaseEndpoints();
const fixturePath=process.env.TAXPAY_LOCAL_GUEST_REFERENCE_FIXTURE_FILE;
const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
assert.ok(fixturePath,'Disposable reference fixture path is required');
assert.ok(key,'Disposable Supabase public key is required');
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
assert.equal(fixture.owner?.profileId,'user1');
assert.match(fixture.owner?.capability,/^[A-Za-z0-9_-]{43}$/);
assert.match(fixture.paymentId,/^[0-9a-f-]{36}$/i);

function lit(value){return "'"+String(value).replaceAll("'","''")+"'";}
function sqlJson(statement){
 const result=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
   PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:'postgres'}
 });
 assert.equal(result.status,0,'Local capability expiry failed: '+(result.stderr||'').slice(0,500));
 return JSON.parse(result.stdout.trim());
}

const capabilityHash=createHash('sha256').update(fixture.owner.capability).digest('hex');
const expired=sqlJson(`WITH changed AS (
 UPDATE taxpay_guest_private.sessions
 SET expires_at=now()-interval '1 minute'
 WHERE capability_hash=${lit(capabilityHash)}
 RETURNING 1
) SELECT jsonb_build_object('count',count(*)) FROM changed;`);
assert.equal(expired.count,1,'Exactly the disposable owner capability must be expired');

const url=new URL(origin+'/functions/v1/demo-story1-taxpay/payments/reference');
url.searchParams.set('reference',fixture.reference);
url.searchParams.set('receiptMobile',fixture.mobile);
const response=await fetch(url,{method:'GET',headers:{
 apikey:key,origin:'http://127.0.0.1:4173',
 'x-taxpay-guest-capability':fixture.owner.capability,
},signal:AbortSignal.timeout(10000)});
const body=await response.json();
assert.equal(response.status,403,'Expired capability must be denied');
assert.equal(body.success,false);
assert.equal(body.data,undefined,'Denied lookup must not return a payment payload');
console.log('PASS: expired disposable profile capability denied without receipt data');
