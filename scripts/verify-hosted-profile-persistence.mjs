import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

/** Read-only verification from the ACTUAL published browser origin.
 * This honors, rather than bypasses, the Edge Function's strict Origin allowlist.
 * All user IDs are fictional; no service key or private account is used.
 * Do not log session capabilities, passwords or payment payloads.
 */
const site='https://shihab-tech04.github.io/nbr-taxpay/';
const base=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!base || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))
  throw new Error('Hosted public endpoint configuration is missing or invalid');
const capPattern=/^[A-Za-z0-9_-]{43}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const browser=await chromium.launch({headless:true});
try {
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  const pages=await Promise.all(contexts.map(async ctx=>{
    const page=await ctx.newPage();
    await page.goto(site,{waitUntil:'domcontentloaded',timeout:30000});
    if(!new URL(page.url()).origin.startsWith('https://shihab-tech04.github.io'))
      throw new Error('Browser is not running from the authorized public origin');
    return page;
  }));
  async function post(page,action,fields={},capability) {
    const result=await page.evaluate(async ({base,key,action,fields,capability})=>{
      const response=await fetch(base+'/functions/v1/taxpay-guest-beneficiaries',{
        method:'POST',cache:'no-store',
        headers:{apikey:key,'content-type':'application/json',
          ...(capability?{'x-taxpay-guest-capability':capability}:{})},
        body:JSON.stringify({action,...fields})
      });
      if(!response.ok)return {status:response.status};
      return {status:response.status,body:await response.json()};
    },{base,key,action,fields,capability});
    assert.equal(result.status,200,'Hosted browser '+action+' returned HTTP '+result.status);
    assert.equal(result.body?.success,true,'Hosted browser '+action+' was not successful');
    return result.body.data;
  }
  async function openProfile(page,userId) {
    const value=await post(page,'demo-login',{userId,password:userId});
    assert.equal(value?.profileId,userId);
    assert.match(value?.capability??'',capPattern);
    assert.match(value?.paymentSessionId??'',uuid);
    assert.ok(value?.language==='bn'||value?.language==='en');
    return value;
  }
  async function snapshot(page,profile) {
    const [settings,lists,people]=await Promise.all([
      post(page,'demo-settings',{},profile.capability),
      post(page,'lists',{},profile.capability),
      post(page,'people',{offset:0,limit:500},profile.capability)
    ]);
    assert.equal(settings.paymentSessionId,profile.paymentSessionId);
    assert.ok(Array.isArray(lists)&&Array.isArray(people));
    assert.ok(settings.selectedListId===null || lists.some(x=>x.id===settings.selectedListId));
    const listIds=new Set(lists.map(x=>x.id));
    for(const person of people)assert.ok(listIds.has(person.list_id),
      'Every returned beneficiary must belong to this profile');
    return {settings,lists,people};
  }
  async function paymentsFor(page,sessionId) {
    const result=await page.evaluate(async ({base,sessionId})=>{
      const url=new URL(base+'/functions/v1/demo-story1-taxpay/payments');
      url.searchParams.set('sessionId',sessionId);
      url.searchParams.set('page','1');
      url.searchParams.set('perPage','100');
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return {status:response.status};
      return {status:response.status,body:await response.json()};
    },{base,sessionId});
    assert.equal(result.status,200,'Hosted Story1 payment history HTTP '+result.status);
    assert.equal(result.body?.success,true);
    assert.ok(Array.isArray(result.body?.data?.items));
    assert.ok(Number.isSafeInteger(result.body.data.total)&&
      result.body.data.total>=result.body.data.items.length);
    return {total:result.body.data.total,ids:result.body.data.items.map(row=>row.id)};
  }
  const [a1,a2,b1]=await Promise.all([
    openProfile(pages[0],'user1'),openProfile(pages[1],'user1'),openProfile(pages[2],'user2')
  ]);
  assert.equal(a1.capability,a2.capability,'Same profile must recover across independent browsers');
  assert.equal(a1.paymentSessionId,a2.paymentSessionId,'Same profile payment session must persist');
  assert.notEqual(a1.capability,b1.capability,'Different profiles must remain isolated');
  assert.notEqual(a1.paymentSessionId,b1.paymentSessionId,'Payment sessions must remain separate');
  const [first,second,other]=await Promise.all([
    snapshot(pages[0],a1),snapshot(pages[1],a2),snapshot(pages[2],b1)
  ]);
  assert.deepEqual(first,second,'Beneficiaries, selected-list and language must recover across browsers');
  const [history1,history2,historyOther]=await Promise.all([
    paymentsFor(pages[0],a1.paymentSessionId),
    paymentsFor(pages[1],a2.paymentSessionId),
    paymentsFor(pages[2],b1.paymentSessionId)
  ]);
  assert.deepEqual(history1,history2,'Cross-browser payment IDs and counts must match');
  const nonempty={lists:first.lists.length,people:first.people.length,payments:history1.total};
  if(nonempty.lists===0||nonempty.people===0||nonempty.payments===0){
    console.warn('UNVERIFIED NONEMPTY DATA: hosted readback is consistent but at least one of lists, beneficiaries or payment history has zero records.');
    console.warn('Nonempty write/read/isolation is independently tested in disposable PostgreSQL; never report empty hosted snapshots as restored account data.');
  }
  console.log('PASS: hosted same-User-ID transport and cross-browser equality; different User IDs remain distinct. Counts:',JSON.stringify(nonempty));
} finally {
  await browser.close();
}
