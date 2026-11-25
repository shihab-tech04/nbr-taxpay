import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';

/** Hosted acceptance from the ACTUAL published browser origin. It creates a
 * uniquely named synthetic beneficiary, and a list only below capacity.
 * At capacity it checks the exact sixth-list denial and uses an existing list.
 * In finally it removes only its exact test rows; it never creates a payment or uses a service key.
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
  // Budget guard: manual hosted identity tests must not download production CMS artwork.
  await Promise.all(contexts.map(context => context.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**', route => route.abort('blockedbyclient'))));
  const pages=await Promise.all(contexts.map(async ctx=>{
    const page=await ctx.newPage();
    await page.goto(site,{waitUntil:'domcontentloaded',timeout:30000});
    if(new URL(page.url()).origin!==new URL(site).origin)
      throw new Error('Browser is not running from the authorized public origin');
    return page;
  }));
  async function postRaw(page,action,fields={},capability) {
    return page.evaluate(async ({base,key,action,fields,capability})=>{
      const response=await fetch(base+'/functions/v1/taxpay-guest-beneficiaries',{
        method:'POST',cache:'no-store',
        headers:{apikey:key,'content-type':'application/json',
          ...(capability?{'x-taxpay-guest-capability':capability}:{})},
        body:JSON.stringify({action,...fields})
      });
      const body=await response.json().catch(()=>null);
      return {status:response.status,body};
    },{base,key,action,fields,capability});
  }
  async function post(page,action,fields={},capability) {
    const result=await postRaw(page,action,fields,capability);
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
  assert.deepEqual(first,second,'Initial SQL snapshots must match across browsers');
  assert.ok(first.lists.length<=5,'User1 exceeds the approved five-list limit');
  assert.ok(first.people.length<500,'Refuse a mutation with an incomplete beneficiary snapshot');
  const listName='Acceptance verification '+randomUUID();
  const memberName='Synthetic persistence acceptance '+randomUUID();
  const testTin='9'+randomUUID().replace(/\D/g,'').slice(0,11).padEnd(11,'8');
  assert.ok(!first.lists.some(x=>x.name===listName)&&!first.people.some(x=>x.tin===testTin),
    'Refuse to touch a preexisting list or TIN');
  const atCapacity=first.lists.length===5;
  const cleanup={profile:a1,original:first.settings,listId:null,tin:testTin,
    memberName,listName,languageAttempted:false,selectionAttempted:false};
  cleanupAction=async()=>{
    let failure=null;
    try{
      const current=await snapshot(pages[0],cleanup.profile);
      assert.ok(current.people.length<500,'Cannot safely identify cleanup rows in a partial snapshot');
      const createdList=current.lists.find(x=>x.name===cleanup.listName);
      if(createdList&&!first.lists.some(x=>x.id===createdList.id))cleanup.listId=createdList.id;
      const matches=current.people.filter(x=>x.tin===cleanup.tin&&x.display_name===cleanup.memberName&&x.tag==='clients'&&x.list_id===cleanup.listId);
      assert.ok(matches.length<=1,'Unexpected duplicate smoke beneficiary');
      if(matches.length===1)await post(pages[0],'remove',{id:matches[0].id},cleanup.profile.capability);
      // Only remove the exact unique group created by this run, never an existing list.
      if(createdList&&createdList.id===cleanup.listId&&!first.lists.some(x=>x.id===createdList.id))
        await post(pages[0],'delete-list',{id:createdList.id},cleanup.profile.capability);
    }catch(error){failure=error;}
    try{
      if(cleanup.languageAttempted){
        const settings=await post(pages[0],'demo-settings',{},cleanup.profile.capability);
        if(settings.language==='bn')await post(pages[0],'demo-settings',{key:'language',value:cleanup.original.language},cleanup.profile.capability);
        else assert.equal(settings.language,cleanup.original.language,'Preference changed concurrently; leave it unchanged');
      }
    }catch(error){failure??=error;}
    try{
      if(cleanup.selectionAttempted){
        const settings=await post(pages[0],'demo-settings',{},cleanup.profile.capability);
        if(settings.selectedListId===cleanup.listId||settings.selectedListId===null)
          await post(pages[0],'demo-settings',{key:'selected-list',value:cleanup.original.selectedListId??''},cleanup.profile.capability);
        else assert.equal(settings.selectedListId,cleanup.original.selectedListId,'Selection changed concurrently; leave it unchanged');
      }
    }catch(error){failure??=error;}
    try{
      const restored=await snapshot(pages[0],cleanup.profile);
      assert.ok(!restored.lists.some(x=>x.name===cleanup.listName)&&!restored.people.some(x=>x.display_name===cleanup.memberName),
        'Synthetic acceptance records must be removed');
      const ordered=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
      assert.deepEqual(ordered(restored.lists),ordered(first.lists),'All original lists must survive');
      assert.deepEqual(ordered(restored.people),ordered(first.people),'All original beneficiary fields must survive');
      assert.equal(restored.settings.language,first.settings.language);
      assert.equal(restored.settings.selectedListId,first.settings.selectedListId);
    }catch(error){failure??=error;}
    if(failure)throw failure;
  };
  let target;
  if(atCapacity){
    const denied=await postRaw(pages[0],'create-list',{name:listName},a1.capability);
    assert.equal(denied.status,409,'Sixth group must be rejected');
    assert.equal(denied.body?.success,false);
    assert.equal(denied.body?.code,'BENEFICIARY_GROUP_LIMIT');
    const unchanged=await snapshot(pages[0],a1);
    assert.deepEqual(unchanged.lists,first.lists,'Sixth-group rejection must not change any list');
    assert.deepEqual(unchanged.people,first.people,'Sixth-group rejection must not change any person');
    target=first.lists.find(x=>x.id===first.settings.selectedListId)??first.lists[0];
  }else{
    target=await post(pages[0],'create-list',{name:listName},a1.capability);
  }
  cleanup.listId=target?.id??null;
  assert.match(cleanup.listId??'',uuid);
  assert.equal(await post(pages[0],'add',{listId:target.id,rows:[{
    tin:testTin,display_name:memberName,tag:'clients'
  }]},a1.capability),1);
  cleanup.languageAttempted=true;
  await post(pages[0],'demo-settings',{key:'language',value:'bn'},a1.capability);
  cleanup.selectionAttempted=true;
  await post(pages[0],'demo-settings',{key:'selected-list',value:target.id},a1.capability);
  const persistedFirst=await snapshot(pages[0],a1);
  const persistedSecond=await snapshot(pages[1],a2);
  assert.deepEqual(persistedFirst,persistedSecond,'Nonempty SQL list, tagged beneficiary, selected list and language must match across browsers');
  assert.equal(persistedFirst.settings.language,'bn');
  assert.equal(persistedFirst.settings.selectedListId,target.id);
  assert.equal(persistedFirst.lists.length,first.lists.length+(atCapacity?0:1));
  assert.ok(persistedFirst.lists.some(x=>x.id===target.id&&x.name===target.name));
  assert.ok(persistedFirst.people.some(x=>x.tin===testTin&&x.list_id===target.id&&x.display_name===memberName&&x.tag==='clients'));
  const isolated=await snapshot(pages[2],b1);
  assert.deepEqual(isolated,other,'Other profile must be unaffected by the smoke writes');
  assert.ok(!isolated.lists.some(x=>x.id===target.id));
  assert.ok(!isolated.people.some(x=>x.tin===testTin&&x.display_name===memberName));
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
  const counts={capacityDenialVerified:atCapacity,lists:persistedFirst.lists.length,beneficiaries:persistedFirst.people.length,
    user1PayerActivities:history1.length,user2BeneficiaryActivities:historyOther.length};
  assert.ok(counts.lists>0,'UNVERIFIED: hosted account has no nonempty beneficiary list');
  assert.ok(counts.beneficiaries>0,'UNVERIFIED: hosted account has no nonempty saved beneficiary');
  assert.ok(counts.user1PayerActivities>0,'UNVERIFIED: user1 payer activity is empty');
  assert.ok(counts.user2BeneficiaryActivities>0,'UNVERIFIED: user2 beneficiary activity is empty');
  await cleanupAction();
  cleanupAction=null;
  console.log('PASS: hosted nonempty account persistence, activity scoping, separate-browser readback and verified cleanup. Counts:',JSON.stringify(counts));
} finally {
  try { await cleanupAction?.(); }
  finally { await browser.close(); }
}
