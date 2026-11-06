import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';

/** Hosted acceptance from the ACTUAL published browser origin. It creates a
 * uniquely named synthetic list/beneficiary and removes only those exact rows
 * in finally; it never creates a payment or uses a service key.
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
let cleanupAction=null;
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
  async function paymentsFor(page,profile,view) {
    const rows=[];
    let beforeAt=null,beforeId=null,complete=false;
    for(let request=0;request<10000;request++){
      const result=await page.evaluate(async ({base,key,profile,view,beforeAt,beforeId})=>{
        const query=new URLSearchParams({view,pageSize:'100'});
        if(beforeAt&&beforeId){query.set('beforeCreatedAt',beforeAt);query.set('beforeId',beforeId);}
        const response=await fetch(base+'/functions/v1/demo-story1-taxpay/profile-history?'+query,{
          cache:'no-store',headers:{apikey:key,'x-taxpay-guest-capability':profile.capability}
        });
        if(!response.ok)return {status:response.status};
        return {status:response.status,body:await response.json()};
      },{base,key,profile,view,beforeAt,beforeId});
      assert.equal(result.status,200,'Hosted Story1 payment history HTTP '+result.status);
      assert.equal(result.body?.success,true);
      assert.equal(result.body?.simulationOnly,true);
      assert.ok(Array.isArray(result.body?.data));
      assert.ok(result.body.data.length<=100);
      rows.push(...result.body.data);
      if(result.body.data.length<100){complete=true;break;}
      const last=result.body.data[result.body.data.length-1];
      assert.ok(typeof last.createdAt==='string'&&Number.isFinite(Date.parse(last.createdAt)),
        'Cursor timestamp must come from a valid database row');
      assert.ok(typeof last.transactionId==='string','Cursor payment ID must be present');
      beforeAt=last.createdAt;beforeId=last.transactionId;
    }
    assert.ok(complete,'Hosted payment history did not reach its final cursor page');
    assert.equal(new Set(rows.map(row=>row.transactionId)).size,rows.length,
      'Hosted payment history must not duplicate rows between cursor pages');
    return rows.map(row=>({
      id:row.transactionId,totalMinor:row.totalMinor,payer:row.payer,
      allocations:Array.isArray(row.allocations)?row.allocations.map(line=>({
        beneficiary:line.beneficiary,amountMinor:line.amountMinor
      })):[]
    }));
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
  const listName='Acceptance verification '+randomUUID().slice(0,8);
  const testTin='9'+randomUUID().replace(/\D/g,'').slice(0,11).padEnd(11,'8');
  const cleanup={profile:a1,original:first.settings,listId:null,tin:testTin};
  cleanupAction=async()=>{
    let failure=null;
    try{
      if(cleanup.listId){
        const current=await post(pages[0],'snapshot',{},cleanup.profile.capability);
        const person=current.people.find(x=>x.tin===cleanup.tin);
        if(person)await post(pages[0],'remove',{id:person.id},cleanup.profile.capability);
        if(current.lists.some(x=>x.id===cleanup.listId))
          await post(pages[0],'delete-list',{id:cleanup.listId},cleanup.profile.capability);
      }
    }catch(error){failure=error;}
    try{await post(pages[0],'demo-settings',{key:'language',value:cleanup.original.language},cleanup.profile.capability);}
    catch(error){failure??=error;}
    try{await post(pages[0],'demo-settings',{key:'selected-list',value:cleanup.original.selectedListId??''},cleanup.profile.capability);}
    catch(error){failure??=error;}
    if(failure)throw failure;
  };
  const created=await post(pages[0],'create-list',{name:listName},a1.capability);
  cleanup.listId=created?.id??null;
  assert.match(cleanup.listId??'',uuid);
  assert.equal(await post(pages[0],'add',{listId:created.id,rows:[{
    tin:testTin,display_name:'Synthetic persistence acceptance record',tag:'clients'
  }]},a1.capability),1);
  await post(pages[0],'demo-settings',{key:'language',value:'bn'},a1.capability);
  await post(pages[0],'demo-settings',{key:'selected-list',value:created.id},a1.capability);
  const persistedFirst=await snapshot(pages[0],a1);
  const persistedSecond=await snapshot(pages[1],a2);
  assert.deepEqual(persistedFirst,persistedSecond,'Nonempty SQL list, tagged beneficiary, selected list and language must match across browsers');
  assert.equal(persistedFirst.settings.language,'bn');
  assert.ok(persistedFirst.lists.some(x=>x.id===created.id&&x.name===listName));
  assert.ok(persistedFirst.people.some(x=>x.tin===testTin&&x.list_id===created.id&&x.tag==='clients'));
  const isolated=await snapshot(pages[2],b1);
  assert.ok(!isolated.lists.some(x=>x.id===created.id));
  assert.ok(!isolated.people.some(x=>x.tin===testTin));
  const [history1,history2,historyOther]=await Promise.all([
    paymentsFor(pages[0],a1,'payer'),
    paymentsFor(pages[1],a2,'payer'),
    paymentsFor(pages[2],b1,'beneficiary')
  ]);
  assert.deepEqual(history1,history2,'Cross-browser payment IDs and counts must match');
  assert.ok(history1.every(row=>row.payer==='user1'&&row.totalMinor>0),
    'Payer activity must be explicitly scoped to user1');
  assert.ok(historyOther.every(row=>row.payer===null&&row.totalMinor>0&&
    row.allocations.every(line=>line.beneficiary==='user2')),
    'Beneficiary activity must contain only user2 allocations and amounts');
  const counts={lists:persistedFirst.lists.length,beneficiaries:persistedFirst.people.length,
    user1PayerActivities:history1.length,user2BeneficiaryActivities:historyOther.length};
  assert.ok(counts.lists>0,'UNVERIFIED: hosted account has no nonempty beneficiary list');
  assert.ok(counts.beneficiaries>0,'UNVERIFIED: hosted account has no nonempty saved beneficiary');
  assert.ok(counts.user1PayerActivities>0,'UNVERIFIED: user1 payer activity is empty');
  assert.ok(counts.user2BeneficiaryActivities>0,'UNVERIFIED: user2 beneficiary activity is empty');
  console.log('PASS: hosted nonempty account persistence, activity scoping and separate-browser readback. Counts:',JSON.stringify(counts));
} finally {
  try { await cleanupAction?.(); }
  finally { await browser.close(); }
}
