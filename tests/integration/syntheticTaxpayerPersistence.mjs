import assert from 'node:assert/strict';
const base=process.env.TAXPAY_LOCAL_SUPABASE_URL;
const apiKey=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
assert.ok(base && apiKey,'Local Supabase is required');
const url=new URL(base);
assert.equal(url.protocol,'http:');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
const json={'content-type':'application/json',apikey:apiKey};
const request=(path,options={})=>fetch(new URL(path,url.origin),options);
const provision=await request('/functions/v1/taxpay-synthetic-account',{
 method:'POST',headers:{...json,Origin:'http://127.0.0.1:4173'},
 body:JSON.stringify({userId:'user1',password:'user1'})});
assert.equal(provision.status,200,await provision.text());
const login=async()=> {
 const response=await request('/auth/v1/token?grant_type=password',{
  method:'POST',headers:json,
  body:JSON.stringify({email:'taxpay-sample-user1@example.com',password:'user1'})});
 assert.equal(response.status,200,await response.text());
 return response.json();
};
const first=await login(),second=await login();
const getUser=async(session)=> {
 const response=await request('/auth/v1/user',{
  headers:{apikey:apiKey,Authorization:'Bearer '+session.access_token}});
 assert.equal(response.status,200);
 return response.json();
};
const a=await getUser(first),b=await getUser(second);
assert.equal(a.id,b.id);
assert.equal(a.app_metadata.taxpay_synthetic_id,'user1');
const created=await request('/rest/v1/taxpay_beneficiary_lists',{
 method:'POST',headers:{...json,Authorization:'Bearer '+first.access_token,Prefer:'return=representation'},
 body:JSON.stringify({owner_uid:a.id,name:'Family'})});
assert.equal(created.status,201,await created.text());
const read=await request('/rest/v1/taxpay_beneficiary_lists?select=name',{
 headers:{apikey:apiKey,Authorization:'Bearer '+second.access_token}});
assert.equal(read.status,200);
assert.deepEqual(await read.json(),[{name:'Family'}]);
const entryHeaders={...json,Authorization:'Bearer '+first.access_token,Prefer:'return=representation'};
const state=await request('/rest/v1/taxpay_account_ui_state?on_conflict=owner_uid,preference_key',{
  method:'POST',headers:{...entryHeaders,Prefer:'resolution=merge-duplicates,return=representation'},
  body:JSON.stringify({owner_uid:a.id,preference_key:'beneficiary_tag_filter',value:'friends_family'})});
assert.equal(state.status,201,await state.text());
const stateRead=await request('/rest/v1/taxpay_account_ui_state?select=preference_key,value',{
  headers:{apikey:apiKey,Authorization:'Bearer '+second.access_token}});
assert.equal(stateRead.status,200);
assert.deepEqual(await stateRead.json(),[{preference_key:'beneficiary_tag_filter',value:'friends_family'}]);
const eventId=crypto.randomUUID();
const event=await request('/rest/v1/taxpay_account_interactions',{
  method:'POST',headers:entryHeaders,
  body:JSON.stringify({id:eventId,client_event_id:eventId,owner_uid:a.id,
    event_type:'BENEFICIARY_LIST_SELECTED',source:'beneficiaries'})});
assert.equal(event.status,201,await event.text());
const eventRead=await request('/rest/v1/taxpay_account_interactions?select=event_type,source',{
  headers:{apikey:apiKey,Authorization:'Bearer '+second.access_token}});
assert.equal(eventRead.status,200);
assert.deepEqual(await eventRead.json(),[{event_type:'BENEFICIARY_LIST_SELECTED',source:'beneficiaries'}]);
const otherReady=await request('/functions/v1/taxpay-synthetic-account',{
  method:'POST',headers:{...json,Origin:'http://127.0.0.1:4173'},
  body:JSON.stringify({userId:'user2',password:'user2'})});
assert.equal(otherReady.status,200,await otherReady.text());
const otherLogin=await request('/auth/v1/token?grant_type=password',{
  method:'POST',headers:json,
  body:JSON.stringify({email:'taxpay-sample-user2@example.com',password:'user2'})});
assert.equal(otherLogin.status,200,await otherLogin.text());
const other=await otherLogin.json();
for(const table of ['taxpay_beneficiary_lists','taxpay_account_ui_state','taxpay_account_interactions']){
  const isolated=await request('/rest/v1/'+table+'?select=*',{
    headers:{apikey:apiKey,Authorization:'Bearer '+other.access_token}});
  assert.equal(isolated.status,200);
  assert.deepEqual(await isolated.json(),[]);
}
console.log('PASS: two User IDs isolated; same User ID restores lists, UI filters and interactions');
