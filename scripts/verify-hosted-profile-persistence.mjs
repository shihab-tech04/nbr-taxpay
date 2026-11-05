import assert from 'node:assert/strict';

/** Read-only hosted acceptance for the approved public User ID preview workflow.
 * No service key, private account identity, payment submission, or SQL mutation.
 * Token values are NEVER logged.
 */
const base=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!base || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))
  throw new Error('Hosted public endpoint configuration is missing or invalid');
const endpoint=base+'/functions/v1/taxpay-guest-beneficiaries';
const paymentsEndpoint=base+'/functions/v1/demo-story1-taxpay/payments';
const capPattern=/^[A-Za-z0-9_-]{43}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function post(action,fields={},capability) {
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',
    headers:{apikey:key,'content-type':'application/json',
      ...(capability?{'x-taxpay-guest-capability':capability}:{})},
    body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(25000)
  });
  if(!response.ok)throw new Error('Hosted preview '+action+' HTTP '+response.status);
  const envelope=await response.json();
  assert.equal(envelope?.success,true,'Hosted preview action did not succeed');
  return envelope.data;
}
async function openProfile(userId) {
  const value=await post('demo-login',{userId,password:userId});
  assert.equal(value?.profileId,userId);
  assert.match(value?.capability??'',capPattern);
  assert.match(value?.paymentSessionId??'',uuid);
  assert.ok(value?.language==='bn'||value?.language==='en');
  return value;
}
async function snapshot(profile) {
  const [settings,lists,people]=await Promise.all([
    post('demo-settings',{},profile.capability),
    post('lists',{},profile.capability),
    post('people',{offset:0,limit:500},profile.capability)
  ]);
  assert.equal(settings.paymentSessionId,profile.paymentSessionId);
  assert.ok(Array.isArray(lists)&&Array.isArray(people));
  assert.ok(settings.selectedListId===null ||
    lists.some(item=>item.id===settings.selectedListId),
    'Saved list selection must belong to the same demo profile');
  const listIds=new Set(lists.map(item=>item.id));
  for(const person of people)assert.ok(listIds.has(person.list_id),
    'Beneficiary must refer to an owned list');
  return {settings,lists,people};
}
async function paymentsFor(sessionId) {
  const url=new URL(paymentsEndpoint);
  url.searchParams.set('sessionId',sessionId);
  url.searchParams.set('page','1');
  url.searchParams.set('perPage','100');
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('Hosted Story1 payment history HTTP '+response.status);
  const data=await response.json();
  assert.equal(data?.success,true);
  assert.ok(Array.isArray(data?.data?.items));
  assert.ok(Number.isSafeInteger(data.data.total)&&data.data.total>=data.data.items.length);
  return {total:data.data.total,ids:data.data.items.map(row=>row.id)};
}
const [a1,a2,b1]=await Promise.all([openProfile('user1'),openProfile('user1'),openProfile('user2')]);
assert.equal(a1.capability,a2.capability,'Two browsers must receive same server profile');
assert.equal(a1.paymentSessionId,a2.paymentSessionId,'Payment session must be stable');
assert.notEqual(a1.capability,b1.capability,'Distinct profiles must not share capability');
assert.notEqual(a1.paymentSessionId,b1.paymentSessionId,'Distinct profiles must not share payment session');
const [first,second,other]=await Promise.all([snapshot(a1),snapshot(a2),snapshot(b1)]);
assert.deepEqual(first,second,'Server preferences and saved beneficiaries must read back identically');
const [history1,history2,historyOther]=await Promise.all([
  paymentsFor(a1.paymentSessionId),paymentsFor(a2.paymentSessionId),paymentsFor(b1.paymentSessionId)
]);
assert.deepEqual(history1,history2,'Cross-browser payment history must be identical');
console.log('PASS: hosted demo profile cross-browser readback, independent owner scope, language, saved-list setting, beneficiary rows, and payment chronology. Profiles: 2; account passwords/capabilities hidden. History totals:',history1.total,historyOther.total);
