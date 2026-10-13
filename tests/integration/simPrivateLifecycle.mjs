import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const url=process.env.TAXPAY_LOCAL_SUPABASE_URL,anon=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY,dsn=process.env.TAXPAY_LOCAL_PG_DSN;
if(!url||!anon||!dsn)throw Error('Disposable Supabase required');
const api=new URL(url),db=new URL(dsn);
if(api.protocol!=='http:'||!['127.0.0.1','localhost'].includes(api.hostname)||!['127.0.0.1','localhost'].includes(db.hostname))throw Error('No hosted test writes');
function psql(sql){
 const r=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',sql],{env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:db.pathname.slice(1)},encoding:'utf8',timeout:10000});
 if(r.status!==0)throw Error('Local PG: '+r.stderr.slice(0,350));
 return r.stdout.trim();
}
async function post(path,payload,token){
 const r=await fetch(api.origin+path,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+(token||anon),'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:r.status,data};
}
const rpc=(name,payload={},token)=>post('/rest/v1/rpc/'+name,payload,token);
async function account(label){
 const email=label+'-'+randomUUID()+'@example.invalid',password=randomBytes(28).toString('base64url');
 const s=await post('/auth/v1/signup',{email,password});
 assert.equal(s.status,200,JSON.stringify(s.data));
 const id=s.data.user?.id||s.data.id;
 const token=s.data.access_token||(await post('/auth/v1/token?grant_type=password',{email,password})).data.access_token;
 assert.match(id,/^[a-f0-9-]{36}$/i);assert.ok(token);
 psql("update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id='"+id+"'::uuid");
 return {id,token};
}
const maker=await account('maker'),reviewer=await account('reviewer'),approver=await account('approver');
const payer=await account('payer'),beneficiary=await account('beneficiary'),stranger=await account('stranger');
for(const [u,role] of [[maker,'MAKER'],[reviewer,'REVIEWER'],[approver,'APPROVER']])
 assert.ok(psql("insert into public.taxpay_officer_roles(user_uid,role) values('"+u.id+"'::uuid,'"+role+"') returning role").startsWith(role));
assert.ok((await rpc('sim_my_taxpayer_profile',{},payer.token)).status>=400);
assert.ok((await rpc('sim_bind_taxpayer_account',{p_user_id:'user1',p_owner_uid:payer.id})).status>=400);
assert.ok((await rpc('sim_bind_taxpayer_account',{p_user_id:'user1',p_owner_uid:payer.id},stranger.token)).status>=400);
assert.equal((await rpc('sim_bind_taxpayer_account',{p_user_id:'user1',p_owner_uid:payer.id},approver.token)).status,200);
assert.equal((await rpc('sim_bind_taxpayer_account',{p_user_id:'user2',p_owner_uid:beneficiary.id},approver.token)).status,200);
assert.ok((await rpc('sim_bind_taxpayer_account',{p_user_id:'user1',p_owner_uid:stranger.id},approver.token)).status>=400);
assert.equal((await rpc('sim_my_taxpayer_profile',{},payer.token)).data,'user1');
assert.equal((await rpc('sim_my_taxpayer_profile',{},beneficiary.token)).data,'user2');

assert.ok((await rpc('sim_payment_history',{p_user_id:'user1',p_view:'beneficiary'})).status>=400,
 'Anonymous browser must not read an assigned identity');
assert.ok((await rpc('sim_payment_notices',{p_user_id:'user2'})).status>=400,
 'Anonymous browser must not read protected notifications');
assert.ok((await rpc('sim_submit_payment',{p_payer_id:'user1',
  p_lines:[{beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:100}],
  p_idempotency_key:randomUUID()})).status>=400,
 'Anonymous browser must not impersonate a bound payer');
assert.ok((await rpc('sim_submit_payment',{p_payer_id:'user3',
  p_lines:[{beneficiary:'user2',category:'PENALTY',assessmentYear:'2026-27',amountMinor:100}],
  p_idempotency_key:randomUUID()})).status>=400,
 'Anonymous unbound payer must not target a bound beneficiary');

assert.ok((await rpc('sim_my_payment_history',{p_view:'all'},payer.token)).status>=400);
assert.ok((await rpc('sim_my_payment_history',{p_view:'payer'})).status>=400);
const lines=[{beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:25125},{beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:575}],key=randomUUID();
assert.ok((await rpc('sim_submit_my_payment',{p_lines:lines,p_idempotency_key:key})).status>=400);
const creation=await rpc('sim_submit_my_payment',{p_lines:lines,p_idempotency_key:key},payer.token);
assert.equal(creation.status,200,JSON.stringify(creation.data));assert.equal(creation.data.totalMinor,25700);
const id=creation.data.transactionId;
const repeat=await rpc('sim_submit_my_payment',{p_lines:lines,p_idempotency_key:key},payer.token);
assert.equal(repeat.status,200);assert.equal(repeat.data.replayed,true);assert.equal(repeat.data.transactionId,id);
assert.ok((await rpc('sim_submit_my_payment',{p_lines:lines,p_idempotency_key:key},beneficiary.token)).status>=400);
const publicHistory=await rpc('sim_payment_history',{p_user_id:null,p_view:'all'});
assert.equal(publicHistory.status,200);
assert.ok(!publicHistory.data.some(tx=>tx.transactionId===id),'Bound payment leaked to public all view');
const officerHistory=await rpc('sim_payment_history',{p_user_id:null,p_view:'all'},approver.token);
assert.equal(officerHistory.status,200);
assert.ok(officerHistory.data.some(tx=>tx.transactionId===id),'Authorized officer missing full ledger');

const h1=await rpc('sim_my_payment_history',{p_view:'payer'},payer.token);
assert.equal(h1.status,200);
const tx=h1.data.find(t=>t.transactionId===id);
assert.ok(tx);assert.equal(tx.totalMinor,25700);assert.equal(tx.allocations.length,2);
const h2=await rpc('sim_my_payment_history',{p_view:'beneficiary'},beneficiary.token);
assert.equal(h2.status,200);
const allocation=h2.data.find(t=>t.transactionId===id);
assert.equal(allocation.allocations.length,1);
assert.equal(allocation.allocations[0].beneficiary,'user2');
const notes=await rpc('sim_my_payment_notices',{},beneficiary.token);
assert.equal(notes.status,200);
const notice=notes.data.find(n=>n.transactionId===id);
assert.ok(notice);assert.equal(notice.isRead,false);
assert.ok((await rpc('sim_set_my_notice_read',{p_notice_id:notice.id,p_is_read:true},payer.token)).status>=400);
assert.ok((await rpc('sim_set_my_notice_read',{p_notice_id:notice.id,p_is_read:true})).status>=400);
const read=await rpc('sim_set_my_notice_read',{p_notice_id:notice.id,p_is_read:true},beneficiary.token);
assert.equal(read.status,200);assert.equal(read.data.isRead,true);
assert.equal((await rpc('sim_my_payment_notices',{},beneficiary.token)).data.find(n=>n.id===notice.id).isRead,true);
assert.equal((await rpc('sim_set_my_notice_read',{p_notice_id:notice.id,p_is_read:false},beneficiary.token)).data.isRead,false);
console.log('PASS: private account binding, scoped payer+beneficiary, idempotency, notice read/unread');
async function review(user,action,reason){
 return rpc('sim_payment_officer_action',{p_transaction_id:id,p_action:action,p_reason:reason,p_idempotency_key:randomUUID()},user.token);
}
assert.equal((await review(maker,'MAKER_ACKNOWLEDGE','Maker verifies fictional request')).status,200);
assert.equal((await review(reviewer,'REVIEWER_VERIFY','Reviewer checks allocation records')).status,200);
assert.equal((await review(approver,'APPROVER_CLOSE','Approver confirms review complete')).status,200);
const reason='Controlled fictional reversal without financial settlement',stateKey=randomUUID();
const request={p_transaction_id:id,p_action:'REVERSE_SIMULATION',p_reason:reason,p_idempotency_key:stateKey};
assert.ok((await rpc('sim_payment_status_action',request)).status>=400);
assert.ok((await rpc('sim_payment_status_action',request,stranger.token)).status>=400);
const reversal=await rpc('sim_payment_status_action',request,approver.token);
assert.equal(reversal.status,200,JSON.stringify(reversal.data));assert.equal(reversal.data.state,'REVERSED');
const replay=await rpc('sim_payment_status_action',request,approver.token);
assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);
assert.ok((await rpc('sim_payment_status_action',{...request,p_reason:'Different reason'},approver.token)).status>=400);
assert.ok((await rpc('sim_payment_status_action',{...request,p_idempotency_key:randomUUID()},approver.token)).status>=400);
const final=(await rpc('sim_my_payment_history',{p_view:'payer'},payer.token)).data.find(t=>t.transactionId===id);
assert.equal(final.state,'REVERSED');assert.equal(final.totalMinor,25700);assert.equal(final.events.at(-1).action,'REVERSED');
assert.ok((await rpc('sim_my_payment_notices',{},beneficiary.token)).data.some(n=>n.transactionId===id&&n.messageCode==='SIM_STATE_REVERSED'));
assert.equal(psql("select count(*) from public.sim_payment_state_decisions where transaction_id='"+id+"'::uuid"),'1');
console.log('SIM_PRIVATE_LIFECYCLE PASS: bound users, notice controls, idempotency, review+reversal, no official credit');
