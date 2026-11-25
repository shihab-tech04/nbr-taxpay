import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createOfficeMirrorProof,verifyOfficeMirrorProof} from '../supabase/functions/demo-story1-taxpay/mirrorProof.ts';

const key='test-only-synthetic-edge-secret-not-a-real-credential';
const id='11111111-2222-4333-8444-555555555555';
const session='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const now=1794105000000;

test('authenticated proof binds one existing synthetic payment and session',async()=>{
  const proof=await createOfficeMirrorProof(key,id,session,now);
  assert.match(proof,/^v1\.\d{10}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,proof,now+90000),true);
  assert.equal(await verifyOfficeMirrorProof(key,'99999999-2222-4333-8444-555555555555',session,proof,now),false);
  assert.equal(await verifyOfficeMirrorProof(key,id,'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',proof,now),false);
  assert.equal(await verifyOfficeMirrorProof(key+'!',id,session,proof,now),false);
});
test('expired, future, malformed and forged proofs are denied',async()=>{
  const proof=await createOfficeMirrorProof(key,id,session,now);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,proof,now+121000),false);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,proof,now-11000),false);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,proof.slice(0,-1)+'A',now),false);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,'',now),false);
  assert.equal(await verifyOfficeMirrorProof(key,id,session,'v1.0.fake',now),false);
  await assert.rejects(()=>createOfficeMirrorProof(key,'not-uuid',session,now));
});
