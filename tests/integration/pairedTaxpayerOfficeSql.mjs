import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const src=process.env.WS3_TAXPAYER_DB_URL, dst=process.env.WS3_OFFICE_DB_URL;
assert.ok(src&&dst);
for(const url of [src,dst])assert.ok(['localhost','127.0.0.1'].includes(new URL(url).hostname),'Local SQL only');
assert.notEqual(new URL(src).port,new URL(dst).port);
function psql(url,sql){
 const r=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],{input:sql,encoding:'utf8',timeout:90000,maxBuffer:6000000});
 if(r.status!==0)throw Error('Disposable SQL failed: '+r.stderr.slice(-3000));
 const lines=r.stdout.trim().split('\n').filter(Boolean);
 if(lines.at(-1)==='t')return true;
 if(lines.at(-1)==='f')return false;
 try{return JSON.parse(lines.at(-1));}catch{throw Error('Non-JSON result: '+r.stdout.slice(-1400));}
}
function lit(v){return "'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";}
const fixture=readFileSync('tests/integration/demoRecipientNotices.sql','utf8');
assert.match(fixture,/^BEGIN;/m);assert.match(fixture,/WS3 disposable payer/);assert.match(fixture,/ROLLBACK;\s*$/);
const capture=[
 'SELECT coalesce(jsonb_agg(jsonb_build_object(',
 "  'id',p.id,'sessionId',p.session_id,'service',p.service_code,",
 "  'amountMinor',p.amount_minor,'status',p.status,'createdAt',p.created_at,",
 "  'data',p.data,'sourceNotices',(SELECT count(*) FROM demo_payment.story_notifications n WHERE n.payment_id=p.id),",
 "  'outbox',(SELECT jsonb_build_object('status',o.status,'attempts',o.attempts) FROM demo_payment.mirror_outbox o",
 "    WHERE o.entity_type='PAYMENT' AND o.entity_id=p.id)",
 ")),'[]'::jsonb) FROM demo_payment.story_payments p",
 " WHERE p.data->'details'->>'payerName'='WS3 disposable payer';",
 'COMMIT;'
].join('\n');
const parents=psql(src,fixture.replace(/ROLLBACK;\s*$/,capture));
assert.equal(parents.length,1,'One original Taxpayer SQL v3 parent required');
const payment=parents[0],details=payment.data.details;
assert.equal(payment.status,'SIMULATED_SUCCESS');assert.equal(payment.amountMinor,5000);
assert.equal(payment.service,'OTHER_TAX_PAYMENT');assert.equal(payment.outbox.status,'PENDING');
assert.equal(payment.sourceNotices,1);assert.equal(payment.data.origin,'TAXPAY_UI');
assert.equal(details.allocationContractVersion,3);
assert.deepEqual(details.allocations.map(a=>a.allocationId),['ws3-recipient-2','ws3-recipient-3']);
assert.deepEqual(details.allocations.map(a=>a.taxpayerTin),['222222222222','333333333333']);
assert.deepEqual(details.allocations.map(a=>a.headId),[121,145]);
assert.deepEqual(details.allocations.map(a=>a.assessmentYear),['2026-27','2025-26']);
assert.deepEqual(details.allocations.map(a=>a.amountMinor),[1500,3500]);
assert.equal(details.receiptSnapshot.challanNo,'SIM-'+payment.data.idempotencyKey);
function claim(){return psql(src,[
 'BEGIN;',"SELECT set_config('request.jwt.claim.role','service_role',true);",
 'SELECT public.demo_story1_mirror_claim(50);','COMMIT;'
].join('\n'));}
function ownClaim(){for(let i=0;i<40;i++){
 const found=claim().find(c=>c.type==='PAYMENT'&&c.id===payment.id);
 if(found)return found;
}throw Error('Payment missing from service-only SQL outbox');}
function finish(token,ok){
 const sql=[ 'BEGIN;',"SELECT set_config('request.jwt.claim.role','service_role',true);",
 "SELECT public.demo_story1_mirror_finish('PAYMENT','"+payment.id+"'::uuid,'"+token+"'::uuid,"+(ok?'true':'false')+","+(ok?'NULL':"'DISPOSABLE_OFFICE_OUTAGE'")+');',
 'COMMIT;' ].join('\n');
 assert.equal(psql(src,sql),true);
}
const firstClaim=ownClaim();assert.equal(firstClaim.sessionId,payment.sessionId);
finish(firstClaim.claimToken,false);
const outage=psql(src,"SELECT jsonb_build_object('status',status,'attempts',attempts,'backoff',next_attempt_at>now()) FROM demo_payment.mirror_outbox WHERE entity_type='PAYMENT' AND entity_id='"+payment.id+"'::uuid;");
assert.deepEqual(outage,{status:'PENDING',attempts:1,backoff:true});
// Advance only the disposable outbox clock, never the source payment.
psql(src,"UPDATE demo_payment.mirror_outbox SET next_attempt_at=now()-interval '1 second' WHERE entity_type='PAYMENT' AND entity_id='"+payment.id+"'::uuid RETURNING to_jsonb(status);");
const retryClaim=ownClaim();assert.notEqual(firstClaim.claimToken,retryClaim.claimToken);
const mirror={id:payment.id,sessionId:payment.sessionId,service:payment.service,amountMinor:payment.amountMinor,status:payment.status,createdAt:payment.createdAt,data:payment.data};
const invoke='SELECT public.demo_story1_mirror('+lit(mirror)+');';
const unauth=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',dst],{input:'BEGIN;SET LOCAL ROLE anon;'+invoke+'COMMIT;',encoding:'utf8'});
assert.notEqual(unauth.status,0,'Anonymous Office mirror bypass');
const mirrorOnce=psql(dst,'BEGIN;SET LOCAL ROLE service_role;'+invoke+'COMMIT;');
const mirrorRetry=psql(dst,'BEGIN;SET LOCAL ROLE service_role;'+invoke+'COMMIT;');
assert.equal(mirrorOnce.id,payment.id);assert.equal(mirrorOnce.replayed,false);
assert.equal(mirrorRetry.id,payment.id);assert.equal(mirrorRetry.replayed,true);
finish(retryClaim.claimToken,true);
const admin=psql(dst,'BEGIN;SET LOCAL ROLE authenticated;SELECT public.demo_story1_office_payment_page(1,100);COMMIT;');
const row=admin.items.find(x=>x.id===payment.id);assert.ok(row);
assert.equal(Number(row.amountMinor),5000);assert.equal(row.certificateReference,'SK-PC-'+payment.id);
assert.deepEqual(row.details.allocations,details.allocations);
assert.deepEqual(row.details.lines,details.lines);
assert.deepEqual(row.details.receiptSnapshot,details.receiptSnapshot);
assert.equal(row.details.receiptReference,details.receiptReference);
assert.equal(row.details.payerId,details.payerId);
const office=psql(dst,[
 'SELECT jsonb_build_object(',
 "'parents',(SELECT count(*) FROM demo_payment.story_payments WHERE id='"+payment.id+"'::uuid),",
 "'notices',(SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id='"+payment.id+"'::uuid),",
 "'data',(SELECT data FROM demo_payment.story_payments WHERE id='"+payment.id+"'::uuid),",
 "'noticeId',(SELECT id::text FROM demo_payment.story_notifications WHERE payment_id='"+payment.id+"'::uuid));"
].join('\n'));
assert.equal(office.parents,1);assert.equal(office.notices,1);assert.deepEqual(office.data,payment.data);
const officer=randomUUID(),outsider=randomUUID();
const setup=[
 'BEGIN;','CREATE SCHEMA IF NOT EXISTS auth;',
 "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path TO '' AS $fn$",
 "SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;",
 'CREATE TABLE IF NOT EXISTS payment_sync.settings(singleton boolean PRIMARY KEY,origin text NOT NULL);',
 'CREATE TABLE IF NOT EXISTS payment_sync.officer_roles(user_uid uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL,active boolean NOT NULL);',
 "INSERT INTO auth.users(id,email) VALUES ('"+officer+"','maker@example.invalid'),('"+outsider+"','outsider@example.invalid');",
 "INSERT INTO payment_sync.settings(singleton,origin) VALUES(true,'OFFICE_SQL') ON CONFLICT(singleton) DO UPDATE SET origin=excluded.origin;",
 "INSERT INTO payment_sync.officer_roles(user_uid,role,active) VALUES('"+officer+"','MAKER',true);",
 "SELECT 'true'::jsonb;",'COMMIT;'
].join('\n');psql(dst,setup);
const event=office.noticeId;
function asOfficer(actor,statement){return psql(dst, 'BEGIN;SET LOCAL ROLE authenticated;SELECT set_config(\'request.jwt.claim.sub\',\''+actor+'\',true);'+statement+'COMMIT;');}
assert.equal(asOfficer(officer,"SELECT public.payment_v1_office_story_notice_read_state(ARRAY['"+event+"']);")[0].isRead,false);
assert.equal(asOfficer(officer,"SELECT public.payment_v1_office_set_story_notice_read('"+event+"',true);").isRead,true);
assert.equal(asOfficer(officer,"SELECT public.payment_v1_office_story_notice_read_state(ARRAY['"+event+"']);")[0].isRead,true);
const denied=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',dst],{
 input:'BEGIN;SET LOCAL ROLE authenticated;SELECT set_config(\'request.jwt.claim.sub\',\''+outsider+'\',true);SELECT public.payment_v1_office_story_notice_read_state(ARRAY[\''+event+'\']);COMMIT;',encoding:'utf8'});
assert.notEqual(denied.status,0,'Unassigned officer must be rejected');
const after=psql(src,[
 'SELECT jsonb_build_object(',
 "'data',data,'status',status,'amountMinor',amount_minor,",
 "'outbox',(SELECT jsonb_build_object('status',o.status,'attempts',o.attempts) FROM demo_payment.mirror_outbox o WHERE o.entity_type='PAYMENT' AND o.entity_id=p.id)",
 ") FROM demo_payment.story_payments p WHERE id='"+payment.id+"'::uuid;"
].join('\n'));
assert.deepEqual(after.data,payment.data);assert.equal(after.status,payment.status);
assert.equal(after.amountMinor,payment.amountMinor);assert.deepEqual(after.outbox,{status:'ACKED',attempts:1});
console.log('PASS: isolated Taxpayer SQL -> separate Office SQL, v3 parent, allocations, payer, recipients, heads, years, receipt/certificate, retry, idempotency, officer notices and immutable source');
