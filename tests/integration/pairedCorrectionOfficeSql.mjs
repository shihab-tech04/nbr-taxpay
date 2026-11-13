/**
 * WS3 correction round trip, exact source event and Office command IDs.
 * Two separate disposable databases; no hosted secrets or new SQL architecture.
 * Reuses the passing original Taxpayer correction creation fixture prefix.
 * HMAC HTTP transport must still be tested independently.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const source=process.env.WS3_TAXPAYER_DB_URL,office=process.env.WS3_OFFICE_DB_URL;
assert.ok(source&&office);
for(const u of [source,office])assert.ok(['127.0.0.1','localhost'].includes(new URL(u).hostname));
assert.notEqual(new URL(source).port,new URL(office).port);
function db(url,script){
 const p=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],
  {input:script,encoding:'utf8',timeout:120000,maxBuffer:5000000});
 if(p.status!==0)throw Error('Disposable correction SQL: '+p.stderr.slice(-3500));
 const s=p.stdout.trim().split('\n').filter(Boolean).at(-1);
 if(s==='t')return true;if(s==='f')return false;
 try{return JSON.parse(s);}catch{throw Error('Non-JSON disposable SQL: '+p.stdout.slice(-800));}
}
const pgJSON=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const auth=(actor,statement)=>[
 'BEGIN;SET LOCAL ROLE authenticated;',
 "SELECT set_config('request.jwt.claim.sub','"+actor+"',true);",
 statement,'COMMIT;'
].join('\n');
const owner='80000000-0000-4000-8000-000000000001';
const outsider='80000000-0000-4000-8000-000000000002';
const correctionFixture=readFileSync('tests/integration/correctionOfficeReadback.sql','utf8');
const cut=correctionFixture.indexOf('DO $owner_initial$;');
assert.ok(cut>0,'Passing correction fixture anchor missing');
const initial=correctionFixture.slice(0,cut)+[
 'RESET ROLE;',
 'SELECT jsonb_build_object(',
 " 'inquiryId',i.inquiry_id,'sourcePaymentId',i.original_payment_id,",
 " 'sourcePaymentKind',i.original_payment_kind,'ownerUid',i.requester_uid,",
 " 'originalPayment',(SELECT data FROM demo_payment.story_payments p WHERE p.id=i.original_payment_id),",
 " 'eventId',o.event_id,'outboxState',o.delivery_state)",
 ' FROM public.taxpay_correction_inquiries i',
 ' JOIN payment_sync.correction_outbox o ON o.inquiry_id=i.inquiry_id',
 ' WHERE i.inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);',
 'COMMIT;'
].join('\n');
const started=db(source,initial);
assert.equal(started.ownerUid,owner);
assert.equal(started.sourcePaymentKind,'TAXPAY_STORY_PAYMENT');
assert.equal(started.sourcePaymentId,'80000000-0000-4000-8000-000000000041');
assert.equal(started.outboxState,'PENDING');
assert.equal(started.originalPayment.details.receiptReference,'SYN-REF-003');
const sourceClaim=()=>db(source,[
 'BEGIN;SET LOCAL ROLE service_role;','SELECT public.taxpay_correction_internal_claim(20);','COMMIT;'
].join('\n'));
const first=sourceClaim().find(v=>v.event?.requestId===started.inquiryId);
assert.ok(first,'Original Taxpayer correction not claimed');
assert.equal(first.event.eventId,started.eventId);
assert.equal(first.event.payload.originalPaymentId,started.sourcePaymentId);
assert.equal(first.event.payload.originalPaymentKind,'TAXPAY_STORY_PAYMENT');
assert.equal(first.event.origin,'TAXPAY_SQL');
assert.ok(!('requesterUid' in first.event.payload),'Private owner identity leaked to Office');
const ackSource=(item,success)=>db(source,[
 'BEGIN;SET LOCAL ROLE service_role;',
 'SELECT public.taxpay_correction_internal_ack('+
 pgJSON(item.event.eventId).replace(/::jsonb$/,'::jsonb')+'::text::uuid,'+
 pgJSON(item.claimToken)+'::text::uuid,'+(success?'true':'false')+','+
 (success?'NULL':"'DISPOSABLE_OFFICE_OUTAGE'")+');','COMMIT;'
].join('\n'));
// Use the existing source retry path instead of accepting a fabricated Office event.
ackSource(first,false);
const failed=db(source,
 "SELECT jsonb_build_object('state',delivery_state,'attempts',attempts,'later',next_attempt_at>now()) FROM payment_sync.correction_outbox WHERE inquiry_id='"+started.inquiryId+"'::uuid;");
assert.equal(failed.state,'FAILED');assert.equal(failed.attempts,1);
assert.equal(failed.later,true);
db(source,"UPDATE payment_sync.correction_outbox SET next_attempt_at=now()-interval '1 second' WHERE inquiry_id='"+started.inquiryId+"'::uuid RETURNING to_jsonb(delivery_state);");
const retry=sourceClaim().find(v=>v.event?.requestId===started.inquiryId);
assert.ok(retry);assert.notEqual(retry.claimToken,first.claimToken);

const maker='80000000-0000-4000-8000-000000000011';
const reviewer='80000000-0000-4000-8000-000000000012';
const approver='80000000-0000-4000-8000-000000000013';
const bootstrap=[
 'BEGIN;',
 'CREATE TABLE IF NOT EXISTS payment_sync.control_outbox(',
 ' message_id uuid PRIMARY KEY,request_id uuid NOT NULL,target_origin text NOT NULL,',
 " payload jsonb NOT NULL,delivery_state text NOT NULL DEFAULT 'PENDING',",
 ' attempts integer NOT NULL DEFAULT 0,acknowledged_at timestamptz,last_error text,',
 ' next_attempt_at timestamptz NOT NULL DEFAULT now(),claim_token uuid);',
 'CREATE TABLE IF NOT EXISTS payment_sync.officer_decisions(',
 ' request_id uuid NOT NULL,officer_uid uuid NOT NULL,officer_role text NOT NULL,',
 ' action_code text NOT NULL,reason text NOT NULL,idempotency_key uuid NOT NULL,',
 ' message_id uuid NOT NULL,UNIQUE(request_id,officer_uid,idempotency_key));',
 'INSERT INTO auth.users(id,email) VALUES',
 " ('"+maker+"','maker-ws3@example.invalid'),",
 " ('"+reviewer+"','reviewer-ws3@example.invalid'),",
 " ('"+approver+"','approver-ws3@example.invalid') ON CONFLICT(id) DO NOTHING;",
 'INSERT INTO payment_sync.officer_roles(user_uid,role,active) VALUES',
 " ('"+maker+"','MAKER',true),('"+reviewer+"','REVIEWER',true),",
 " ('"+approver+"','APPROVER',true) ON CONFLICT(user_uid) DO UPDATE SET role=excluded.role,active=excluded.active;",
 "SELECT 'true'::jsonb;COMMIT;"
].join('\n');
assert.equal(db(office,bootstrap),true);
const eventArg=pgJSON(retry.event);
const ingestSql='SELECT public.payment_v1_internal_ingest_correction('+eventArg+');';
const ingested=db(office,'BEGIN;SET LOCAL ROLE service_role;'+ingestSql+'COMMIT;');
const replay=db(office,'BEGIN;SET LOCAL ROLE service_role;'+ingestSql+'COMMIT;');
assert.equal(ingested.stored,true);assert.equal(ingested.duplicate,false);
assert.equal(replay.duplicate,true);
ackSource(retry,true);
const queue=db(office,auth(maker,'SELECT public.payment_v1_correction_queue_page(200,NULL,NULL);'));
const item=queue.items.find(v=>v.requestId===started.inquiryId);
assert.ok(item);assert.equal(item.sourcePaymentId,started.sourcePaymentId);
assert.equal(item.sourceEventId,started.eventId);
assert.equal(item.reviewState,'PENDING_OFFICER');
assert.deepEqual(item.availableActions,['MAKER_ACKNOWLEDGE']);

const blocked=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',office],
 {input:auth(outsider,'SELECT public.payment_v1_correction_queue_page(200,NULL,NULL);'),encoding:'utf8'});
assert.notEqual(blocked.status,0,'Non-officer must not read Office correction queue');
const stages=[
 {actor:maker,role:'MAKER',action:'MAKER_ACKNOWLEDGE',state:'MAKER_ACKNOWLEDGED'},
 {actor:reviewer,role:'REVIEWER',action:'REVIEWER_VERIFY',state:'REVIEWER_VERIFIED'},
 {actor:approver,role:'APPROVER',action:'APPROVER_CLOSE',state:'APPROVER_CLOSED'}
];
for(const stage of stages){
 const key=randomUUID();
 const call="SELECT public.payment_v1_correction_officer_action('"+
    started.inquiryId+"'::uuid,'"+stage.action+
    "','WS3 disposable correction review','"+
    key+"'::uuid);";
 const saved=db(office,auth(stage.actor,call));
 const duplicate=db(office,auth(stage.actor,call));
 assert.equal(saved.queued,true);assert.equal(saved.replayed,false);
 assert.equal(duplicate.replayed,true);assert.equal(saved.messageId,duplicate.messageId);
 const command=db(office,"SELECT payload FROM payment_sync.control_outbox WHERE message_id='"+saved.messageId+"'::uuid;");
 assert.equal(command.origin,'OFFICE_SQL');assert.equal(command.requestId,started.inquiryId);
 assert.equal(command.officerRole,stage.role);
 const accepted=db(source,'BEGIN;SET LOCAL ROLE service_role;'+
  'SELECT public.taxpay_correction_record_office_decision('+pgJSON(command)+');COMMIT;');
 const again=db(source,'BEGIN;SET LOCAL ROLE service_role;'+
  'SELECT public.taxpay_correction_record_office_decision('+pgJSON(command)+');COMMIT;');
 assert.equal(accepted.stored,true);assert.equal(accepted.duplicate,false);
 assert.equal(again.duplicate,true);assert.equal(accepted.reviewState,stage.state);
 const claimToken=randomUUID();
 db(office,"UPDATE payment_sync.control_outbox SET delivery_state='IN_FLIGHT',claim_token='"+
  claimToken+"'::uuid,attempts=attempts+1 WHERE message_id='"+saved.messageId+"'::uuid RETURNING to_jsonb(delivery_state);");
 assert.equal(db(office,'BEGIN;SET LOCAL ROLE service_role;'+
  "SELECT public.payment_v1_internal_ack_correction_command('"+saved.messageId+
  "'::uuid,'"+claimToken+"'::uuid,true,'"+stage.state+"',NULL);COMMIT;"),true);
 const officeReview=db(office,"SELECT jsonb_build_object('state',review_state,'revision',review_revision) FROM payment_sync.correction_mirrors WHERE inquiry_id='"+
  started.inquiryId+"'::uuid;");
 assert.equal(officeReview.state,stage.state);
}
const completed=db(source,"SELECT jsonb_build_object("+
 " 'state',i.office_review_state,'revision',i.office_review_revision,"+
 " 'payment',(SELECT data FROM demo_payment.story_payments p WHERE p.id=i.original_payment_id),"+
 " 'notifications',(SELECT count(*) FROM public.taxpay_in_app_notifications n WHERE n.correction_inquiry_id=i.inquiry_id),"+
 " 'decisions',(SELECT count(*) FROM public.taxpay_correction_review_decisions d WHERE d.inquiry_id=i.inquiry_id)"+
 ") FROM public.taxpay_correction_inquiries i WHERE i.inquiry_id='"+started.inquiryId+"'::uuid;");
assert.equal(completed.state,'APPROVER_CLOSED');assert.equal(completed.revision,4);
assert.equal(completed.decisions,3);assert.equal(completed.notifications,3);
assert.deepEqual(completed.payment,started.originalPayment);
const history=db(source,auth(owner,
 "SELECT coalesce(jsonb_agg(jsonb_build_object('kind',event_kind,'source',source_system,'action',action_code) ORDER BY revision),'[]'::jsonb) FROM public.taxpay_correction_my_history(50) WHERE inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.equal(history.length,4);
assert.deepEqual(history.map(x=>x.source),['TAXPAY_SQL','OFFICE_SQL','OFFICE_SQL','OFFICE_SQL']);
const otherHistory=db(source,auth(outsider,
 "SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM public.taxpay_correction_my_history(50) v WHERE inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.equal(otherHistory.length,0);
const readResult=db(source,auth(owner,
 "UPDATE public.taxpay_in_app_notifications SET is_read=true WHERE correction_inquiry_id='"+
 started.inquiryId+"'::uuid AND message_code='CORRECTION_APPROVER_CLOSED' RETURNING jsonb_build_object('isRead',is_read,'decision',correction_decision_id);"));
assert.equal(readResult.isRead,true);
const readAgain=db(source,auth(owner,
 "SELECT jsonb_build_object('count',count(*),'read',count(*) FILTER(WHERE is_read)) FROM public.taxpay_in_app_notifications WHERE correction_inquiry_id='"+started.inquiryId+"'::uuid;"));
assert.deepEqual(readAgain,{count:3,read:1});
console.log('PASS: original owner-linked Taxpayer correction -> separate Office SQL authenticated 3-officer decisions -> source notifications/readback, outbox retry, exact parent, idempotence, immutable payment and outsider isolation');
