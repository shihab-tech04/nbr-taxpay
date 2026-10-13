import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const url=process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anon=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
if(!url||!anon||!dsn)throw Error('Disposable local Supabase required');
const api=new URL(url),db=new URL(dsn);
if(api.protocol!=='http:'||!['127.0.0.1','localhost'].includes(api.hostname)||
   !['127.0.0.1','localhost'].includes(db.hostname)||
   !['postgresql:','postgres:'].includes(db.protocol))throw Error('Refuse non-loopback test target');
function psql(sql){
 const p=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',sql],{
   env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:decodeURIComponent(db.pathname.slice(1))},
   encoding:'utf8',timeout:10000
 });
 if(p.status!==0)throw Error('Postgres test failed: '+p.stderr?.slice(0,500));
 return p.stdout.trim();
}
async function req(path,body,token){
 const result=await fetch(api.origin+path,{
   method:'POST',headers:{apikey:anon,Authorization:'Bearer '+(token||anon),'Content-Type':'application/json'},body:JSON.stringify(body)
 });
 const raw=await result.text();let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:result.status,data};
}
async function newUser(){
 const email='demo-office-'+randomUUID()+'@example.invalid',password=randomBytes(32).toString('base64url');
 const signup=await req('/auth/v1/signup',{email,password});
 assert.equal(signup.status,200,JSON.stringify(signup.data));
 const session=signup.data.access_token?signup.data:
 (await req('/auth/v1/token?grant_type=password',{email,password})).data;
 assert.ok(session.access_token);
 const uid=signup.data.user?.id||signup.data.id;
 assert.match(uid,/^[a-f0-9-]{36}$/i);
 return {id:uid,token:session.access_token};
}
const maker=await newUser(),reviewer=await newUser(),approver=await newUser(),outsider=await newUser();
const payer=await newUser(),otherBeneficiary=await newUser();
for(const [who,role] of [[maker,'MAKER'],[reviewer,'REVIEWER'],[approver,'APPROVER']]){
 assert.ok(psql(`insert into public.taxpay_officer_roles(user_uid,role) values('${who.id}'::uuid,'${role}') returning role`).startsWith(role));
}
// Assign two distinct verified fictional profiles through controlled local DB fixtures.
for(const [profile,identity] of [['user1',payer],['user2',otherBeneficiary]]){
 assert.ok(psql(`insert into public.sim_payment_account_bindings(user_id,owner_uid,assigned_by) values('${profile}','${identity.id}'::uuid,'${approver.id}'::uuid) returning user_id`).startsWith(profile));
}
const originalReviewRequests=psql('select count(*) from public.taxpay_payment_requests');
const nonce=randomUUID();
const lines=[
 {beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:11900},
 {beneficiary:'user2',category:'PENALTY',assessmentYear:'2026-27',amountMinor:1100}
];
assert.ok((await req('/rest/v1/rpc/sim_submit_payment',{p_payer_id:'user1',p_lines:lines,p_idempotency_key:nonce})).status>=400,
 'Anonymous legacy payment submission MUST be disabled');
assert.ok((await req('/rest/v1/rpc/sim_my_payment_history',{p_view:'beneficiary'},outsider.token)).status>=400,
 'Unbound outsider may not inspect private payment histories');
const create=await req('/rest/v1/rpc/sim_submit_my_payment',{p_lines:lines,p_idempotency_key:nonce},payer.token);
assert.equal(create.status,200,JSON.stringify(create.data));
const txid=create.data.transactionId;
assert.match(txid,/^[a-f0-9-]{36}$/i);
const first=(await req('/rest/v1/rpc/sim_payment_history',{p_user_id:null,p_view:'all'},reviewer.token)).data.find(x=>x.transactionId===txid);
assert.equal(first.reviewStatus,'PENDING_OFFICER');
assert.equal(first.totalMinor,13000);
assert.equal(first.allocations.length,2);
assert.equal(first.state,'SIMULATED');
console.log('PASS: multi-beneficiary simulated intake and independent SQL review state');

const act=(token,action,reason,key=randomUUID())=>req('/rest/v1/rpc/sim_payment_officer_action',{
 p_transaction_id:txid,p_action:action,p_reason:reason,p_idempotency_key:key
},token);
assert.ok((await act(null,'MAKER_ACKNOWLEDGE','Anonymous cannot act')).status>=400);
assert.ok((await act(outsider.token,'MAKER_ACKNOWLEDGE','Unauthorized synthetic user')).status>=400);
assert.ok((await act(reviewer.token,'REVIEWER_VERIFY','Cannot skip maker action')).status>=400);
assert.ok((await act(maker.token,'APPROVER_CLOSE','Wrong role must be rejected')).status>=400);
console.log('PASS: anonymous/outsider/wrong role/out-of-order actions fail closed');
const mkKey=randomUUID();
const mk=await act(maker.token,'MAKER_ACKNOWLEDGE','Maker confirms demo request',mkKey);
assert.equal(mk.status,200,JSON.stringify(mk.data));
assert.equal(mk.data,'MAKER_ACKNOWLEDGED');
const retry=await act(maker.token,'MAKER_ACKNOWLEDGE','Maker confirms demo request',mkKey);
assert.equal(retry.status,200);assert.equal(retry.data,mk.data);
assert.ok((await act(maker.token,'MAKER_ACKNOWLEDGE','Different reason on same key',mkKey)).status>=400);
assert.ok((await act(maker.token,'REVIEWER_VERIFY','Maker cannot review themselves')).status>=400);
const rv=await act(reviewer.token,'REVIEWER_VERIFY','Independent reviewer confirms demo history');
assert.equal(rv.status,200,JSON.stringify(rv.data));assert.equal(rv.data,'REVIEWER_VERIFIED');
const ap=await act(approver.token,'APPROVER_CLOSE','Approver closes simulation review after checking');
assert.equal(ap.status,200,JSON.stringify(ap.data));assert.equal(ap.data,'APPROVER_CLOSED');
assert.ok((await act(approver.token,'APPROVER_CLOSE','Cannot change closed review')).status>=400);
console.log('PASS: Maker, Reviewer and Approver distinct sequential SQL transitions with exact idempotency');

const final=(await req('/rest/v1/rpc/sim_payment_history',{p_user_id:null,p_view:'all'},reviewer.token)).data.find(x=>x.transactionId===txid);
assert.equal(final.state,'SIMULATED');assert.equal(final.reviewStatus,'APPROVER_CLOSED');
assert.deepEqual(final.events.slice(-3).map(e=>e.action),[
 'OFFICER_MAKER_ACKNOWLEDGED','OFFICER_REVIEWER_VERIFIED','OFFICER_APPROVER_CLOSED'
]);
assert.equal(psql(`select count(*) from public.sim_payment_officer_decisions where transaction_id='${txid}'::uuid`),'3');
for(const [beneficiary,owner] of [['user1',payer],['user2',otherBeneficiary]]){
 const notices=(await req('/rest/v1/rpc/sim_my_payment_notices',{},owner.token)).data
  .filter(n=>n.transactionId===txid);
 assert.equal(notices.length,4,'one creation notice plus three officer decisions');
}
assert.equal(psql(`select (state='SIMULATED' and review_status='APPROVER_CLOSED' and simulation_only) from public.sim_payment_transactions where id='${txid}'::uuid`),'t');
assert.equal(psql('select count(*) from public.taxpay_payment_requests'),originalReviewRequests);
console.log('RESULT SIM_OFFICER_REVIEW PASS: owner/beneficiary notices, no government credit, no Treasury mutation, audit read-back');
