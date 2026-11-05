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
console.log('PASS same User ID loads one Supabase owner and persisted list in two sessions');
