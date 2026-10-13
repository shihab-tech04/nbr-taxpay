import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const url = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anonKey = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
const dsn = process.env.TAXPAY_LOCAL_PG_DSN;
if (!url || !anonKey || !dsn) throw Error('Local Supabase/Postgres required');
const api = new URL(url), sql = new URL(dsn);
if (api.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(api.hostname) ||
    !['127.0.0.1','localhost','[::1]'].includes(sql.hostname) ||
    !['postgresql:','postgres:'].includes(sql.protocol)) throw Error('Only disposable loopback Supabase is allowed');

function psql(query) {
  const r = spawnSync('psql', ['-X','-At','-v','ON_ERROR_STOP=1','-c',query], {
    env:{...process.env,PGHOST:sql.hostname,PGPORT:sql.port||'5432',PGDATABASE:decodeURIComponent(sql.pathname.slice(1)),PGUSER:decodeURIComponent(sql.username),PGPASSWORD:decodeURIComponent(sql.password)},
    encoding:'utf8',timeout:12000
  });
  if(r.status!==0) throw Error('Direct PostgreSQL failed: '+r.stderr?.slice(0,400));
  return r.stdout.trim();
}
const base = api.origin;
async function http(path,{method='GET',token,body,prefer}={}) {
  const response=await fetch(base+path,{method,headers:{apikey:anonKey,...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body===undefined?{}:{'Content-Type':'application/json'}),...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data=raw}
  return {code:response.status,data};
}
async function user() {
  const email=`sync-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
  const signup=await http('/auth/v1/signup',{method:'POST',body:{email,password}});
  assert.equal(signup.code,200,JSON.stringify(signup.data));
  const token=signup.data.access_token?signup.data:signup.data.session || (await http('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})).data;
  assert.ok(token.access_token,'Token missing');
  const id=signup.data.user?.id || signup.data.id;
  assert.match(id,/^[0-9a-f-]{36}$/i);
  return {id,token:token.access_token};
}
function pass(s){console.log('PASS '+s)}
const a=await user(),b=await user(),officer=await user();
assert.notEqual(a.id,b.id);assert.notEqual(a.id,officer.id);
assert.equal(psql(`insert into public.taxpay_officer_roles(user_uid,role) values('${officer.id}'::uuid,'REVIEWER') returning role`),'REVIEWER');
pass('three independent synthetic identities; officer role assigned only by direct DB authority');

const anon=await http('/rest/v1/taxpay_payment_requests?select=id');
assert.ok([401,403].includes(anon.code));
const forbiddenInsert=await http('/rest/v1/taxpay_payment_requests',{method:'POST',token:a.token,body:{owner_uid:a.id,purpose:'TAX_LIABILITY_PAYMENT',category:'ADVANCE_TAX',assessment_year:'2026-27',amount_minor:11500,request_status:'REVIEW_CLOSED'}});
assert.ok([400,401,403].includes(forbiddenInsert.code));
const wrongOwner=await http('/rest/v1/taxpay_payment_requests',{method:'POST',token:a.token,body:{owner_uid:b.id,purpose:'TAX_LIABILITY_PAYMENT',category:'ADVANCE_TAX',assessment_year:'2026-27',amount_minor:11500}});
assert.ok([401,403].includes(wrongOwner.code));
const wrongPurpose=await http('/rest/v1/taxpay_payment_requests',{method:'POST',token:a.token,body:{owner_uid:a.id,purpose:'WITHHOLDING_TAX_DEPOSIT',category:'ADVANCE_TAX',assessment_year:'2026-27',amount_minor:11500}});
assert.equal(wrongPurpose.code,400);
pass('anonymous, cross-owner, financial status override and invalid purpose/category rejected');

const created=await http('/rest/v1/taxpay_payment_requests?select=id,owner_uid,request_status,financial_receipt_status,tax_credit_status,processing_mode,amount_minor',{method:'POST',token:a.token,prefer:'return=representation',body:{owner_uid:a.id,purpose:'TAX_LIABILITY_PAYMENT',category:'ADVANCE_TAX',assessment_year:'2026-27',amount_minor:11500,memo:'Synthetic intake'}});
assert.equal(created.code,201,JSON.stringify(created.data));
const req=created.data[0];assert.equal(req.owner_uid,a.id);assert.equal(req.request_status,'SUBMITTED_FOR_REVIEW');assert.equal(req.financial_receipt_status,'NOT_VERIFIED');assert.equal(req.tax_credit_status,'NOT_VERIFIED');assert.equal(req.processing_mode,'NON_FINANCIAL_REVIEW');
assert.equal(psql(`select count(*) from public.taxpay_payment_requests where id='${req.id}'::uuid and owner_uid='${a.id}'::uuid`),'1');
const bRows=await http(`/rest/v1/taxpay_payment_requests?select=id&id=eq.${req.id}`,{token:b.token});assert.equal(bRows.code,200);assert.deepEqual(bRows.data,[]);
const officerRows=await http(`/rest/v1/taxpay_payment_requests?select=id,request_status&id=eq.${req.id}`,{token:officer.token});assert.equal(officerRows.code,200);assert.equal(officerRows.data[0].id,req.id);
pass('taxpayer request visible to authorized officer, hidden from unrelated taxpayer and read back from PostgreSQL');

const firstNotes=await http(`/rest/v1/taxpay_in_app_notifications?select=id,recipient_uid,message_code,request_id,is_read&request_id=eq.${req.id}`,{token:a.token});
assert.equal(firstNotes.code,200);assert.equal(firstNotes.data.length,1);assert.equal(firstNotes.data[0].recipient_uid,a.id);
const officerNotes=await http(`/rest/v1/taxpay_in_app_notifications?select=id,message_code&request_id=eq.${req.id}`,{token:officer.token});assert.equal(officerNotes.code,200);assert.equal(officerNotes.data.length,1);assert.equal(officerNotes.data[0].message_code,'OFFICER_NEW_REQUEST');
const otherNotes=await http(`/rest/v1/taxpay_in_app_notifications?select=id&request_id=eq.${req.id}`,{token:b.token});assert.deepEqual(otherNotes.data,[]);
const ownerRPC=await http('/rest/v1/rpc/taxpay_record_officer_review',{method:'POST',token:a.token,body:{p_request_id:req.id,p_action:'ACKNOWLEDGE',p_reason:'Unauthorized owner officer action',p_idempotency_key:randomUUID()}});assert.ok(ownerRPC.code>=400);
pass('recipient-scoped officer/taxpayer notifications; owner cannot impersonate officer');

async function review(action,reason,key=randomUUID()) {return http('/rest/v1/rpc/taxpay_record_officer_review',{method:'POST',token:officer.token,body:{p_request_id:req.id,p_action:action,p_reason:reason,p_idempotency_key:key}})}
const idem=randomUUID();const acknowledged=await review('ACKNOWLEDGE','Synthetic reviewer confirmed intake',idem);assert.equal(acknowledged.code,200,JSON.stringify(acknowledged.data));assert.equal(acknowledged.data,'ACKNOWLEDGED');
const retry=await review('ACKNOWLEDGE','Synthetic reviewer confirmed intake',idem);assert.equal(retry.code,200);assert.equal(retry.data,'ACKNOWLEDGED');
const reuse=await review('REQUEST_INFORMATION','A different review transition attempt',idem);assert.ok(reuse.code>=400);
assert.equal(psql(`select count(*) from public.taxpay_review_decisions where request_id='${req.id}'::uuid`),'1');
pass('officer action, idempotent retry and mismatched idempotency failure');
const info=await review('REQUEST_INFORMATION','Please add nonfinancial supporting details');assert.equal(info.code,200,JSON.stringify(info.data));assert.equal(info.data,'INFO_REQUESTED');
const closed=await review('CLOSE_REVIEW','Review closed without payment or tax credit');assert.equal(closed.code,200,JSON.stringify(closed.data));assert.equal(closed.data,'REVIEW_CLOSED');
const closedAgain=await review('CLOSE_REVIEW','Do not reopen a closed review');assert.ok(closedAgain.code>=400);
const current=await http(`/rest/v1/taxpay_payment_requests?select=request_status,financial_receipt_status,tax_credit_status&id=eq.${req.id}`,{token:a.token});
assert.equal(current.code,200);assert.deepEqual(current.data,[{request_status:'REVIEW_CLOSED',financial_receipt_status:'NOT_VERIFIED',tax_credit_status:'NOT_VERIFIED'}]);
const events=await http(`/rest/v1/taxpay_request_events?select=event_type,status_after&request_id=eq.${req.id}&order=id.asc`,{token:a.token});assert.equal(events.code,200);assert.deepEqual(events.data.map(x=>x.event_type),['REQUEST_SUBMITTED','OFFICER_ACKNOWLEDGED','OFFICER_INFO_REQUESTED','OFFICER_REVIEW_CLOSED']);
const notices=await http(`/rest/v1/taxpay_in_app_notifications?select=id,message_code,is_read&request_id=eq.${req.id}&order=created_at.asc`,{token:a.token});assert.equal(notices.code,200);assert.equal(notices.data.length,4);
pass('officer review state/events/notifications atomically visible to taxpayer; funds and credits never verified');

const mark=await http(`/rest/v1/taxpay_in_app_notifications?id=eq.${notices.data[0].id}&select=id,is_read`,{method:'PATCH',token:a.token,prefer:'return=representation',body:{is_read:true}});assert.equal(mark.code,200);assert.deepEqual(mark.data,[{id:notices.data[0].id,is_read:true}]);
const readOther=await http(`/rest/v1/taxpay_in_app_notifications?id=eq.${notices.data[0].id}&select=id`,{method:'PATCH',token:b.token,prefer:'return=representation',body:{is_read:true}});assert.equal(readOther.code,200);assert.deepEqual(readOther.data,[]);
const cannotEdit=await http(`/rest/v1/taxpay_payment_requests?id=eq.${req.id}`,{method:'PATCH',token:officer.token,body:{financial_receipt_status:'RECEIVED'}});assert.ok(cannotEdit.code>=400);
assert.equal(psql(`select count(*) from public.taxpay_payment_requests where id='${req.id}'::uuid and financial_receipt_status='NOT_VERIFIED' and tax_credit_status='NOT_VERIFIED'`),'1');
pass('own notification read marker persists, other user isolated, officer cannot forge payment or credit');
console.log('RESULT NONFINANCIAL_SYNC: all controlled assertions passed (synthetic identities; no real payment)');