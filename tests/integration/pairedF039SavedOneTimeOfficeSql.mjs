import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=process.env.WS3_TAXPAYER_DB_URL;
const office=process.env.WS3_OFFICE_DB_URL;
assert.ok(source&&office);
for(const url of [source,office])
  assert.ok(['localhost','127.0.0.1'].includes(new URL(url).hostname),'Disposable local SQL only');
assert.notEqual(new URL(source).port,new URL(office).port,'Separate source and Office databases');

function query(url,sql){
  const result=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],{
    input:sql,encoding:'utf8',timeout:90000,maxBuffer:6000000,
  });
  if(result.status!==0)throw Error('Disposable SQL failed: '+result.stderr.slice(-3000));
  const last=result.stdout.trim().split('\n').filter(Boolean).at(-1);
  if(last==='t')return true;
  if(last==='f')return false;
  try{return JSON.parse(last);}catch{throw Error('Non-JSON SQL result: '+result.stdout.slice(-1400));}
}
function json(value){return "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";}

// Reuse the original F-039 SQL acceptance fixture. Its negative, retry and
// saved-list checks execute before the exact same parent is committed locally.
const acceptance=readFileSync('tests/integration/combinedOtherTaxSqlAcceptance.sql','utf8');
const marker='-- F-039 / US-014 T04 original Taxpayer SQL:';
const start=acceptance.indexOf(marker);
const finish=acceptance.indexOf('$f039$;',start)+'$f039$;'.length;
assert.ok(start>0&&finish>start,'Original F-039 SQL fixture is required');
// The fixture creates its saved list under a capability owner hash, not the
// payment session UUID. Match its uniquely named disposable fixture list
// and include *all* members so an auto-saved one-time TIN fails below.
const capture=`SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'sessionId',p.session_id,'service',p.service_code,
  'amountMinor',p.amount_minor,'status',p.status,'createdAt',p.created_at,'data',p.data,
  'saved',(
    SELECT coalesce(jsonb_agg(jsonb_build_object('tin',b.tin,'name',b.display_name)), '[]'::jsonb)
    FROM taxpay_guest_private.beneficiaries b
    JOIN taxpay_guest_private.lists l ON l.id=b.list_id
    WHERE l.name='F039 saved + one-time'
  ),
  'outbox',(
    SELECT jsonb_build_object('status',o.status,'attempts',o.attempts)
    FROM demo_payment.mirror_outbox o WHERE o.entity_type='PAYMENT' AND o.entity_id=p.id
  )
)), '[]'::jsonb)
FROM demo_payment.story_payments p
WHERE p.data->'details'->'allocations'->0->>'allocationId'='ws3-f039-saved'
  AND p.data->'details'->'allocations'->1->>'allocationId'='ws3-f039-onetime';`;
const parents=query(source,'BEGIN;\n'+acceptance.slice(start,finish)+'\n'+capture+'\nCOMMIT;');
assert.equal(parents.length,1,'Exactly one original F-039 parent');
const parent=parents[0],details=parent.data.details;
assert.equal(parent.status,'SIMULATED_SUCCESS');
assert.equal(parent.service,'OTHER_TAX_PAYMENT');
assert.equal(parent.amountMinor,3000);
assert.equal(parent.outbox.status,'PENDING');
assert.deepEqual(parent.saved,[{tin:'222222222222',name:'Saved Taxpayer Two'}]);
assert.equal(details.allocationContractVersion,3);
assert.deepEqual(details.allocations.map(a=>a.allocationId),['ws3-f039-saved','ws3-f039-onetime']);
assert.deepEqual(details.allocations.map(a=>a.taxpayerTin),['222222222222','444444444444']);
assert.deepEqual(details.allocations.map(a=>a.assessmentYear),['2026-27','2025-26']);
assert.deepEqual(details.allocations.map(a=>a.amountMinor),[1000,2000]);
assert.deepEqual(details.receiptSnapshot.allocationItems.map(a=>a.allocationId),
  ['ws3-f039-saved','ws3-f039-onetime']);
assert.equal(details.receiptReference,details.receiptSnapshot.challanNo);

const claims=query(source,`BEGIN;SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.demo_story1_mirror_claim(50);COMMIT;`);
const claim=claims.find(x=>x.type==='PAYMENT'&&x.id===parent.id);
assert.ok(claim,'The original F-039 parent must enter the source outbox');
assert.equal(claim.sessionId,parent.sessionId);
const mirror={id:parent.id,sessionId:parent.sessionId,service:parent.service,
  amountMinor:parent.amountMinor,status:parent.status,createdAt:parent.createdAt,data:parent.data};
const call='SELECT public.demo_story1_mirror('+json(mirror)+');';
const anon=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',office],{
  input:'BEGIN;SET LOCAL ROLE anon;'+call+'COMMIT;',encoding:'utf8',timeout:90000,
});
assert.notEqual(anon.status,0,'Anonymous Office mirror must be denied');
const first=query(office,'BEGIN;SET LOCAL ROLE service_role;'+call+'COMMIT;');
const replay=query(office,'BEGIN;SET LOCAL ROLE service_role;'+call+'COMMIT;');
assert.equal(first.id,parent.id);assert.equal(first.replayed,false);
assert.equal(replay.id,parent.id);assert.equal(replay.replayed,true);
assert.equal(query(source,`BEGIN;SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.demo_story1_mirror_finish('PAYMENT','${parent.id}'::uuid,
'${claim.claimToken}'::uuid,true,NULL);COMMIT;`),true);

const page=query(office,'BEGIN;SET LOCAL ROLE authenticated;SELECT public.demo_story1_office_payment_page(1,100);COMMIT;');
const row=page.items.find(item=>item.id===parent.id);
assert.ok(row,'Authenticated Office page must contain the exact F-039 parent');
assert.equal(Number(row.amountMinor),3000);
assert.equal(row.certificateReference,'SK-PC-'+parent.id);
assert.equal(row.details.payerTin,details.payerTin);
assert.equal(row.details.receiptReference,details.receiptReference);
assert.deepEqual(row.details.allocations,details.allocations);
assert.deepEqual(row.details.receiptSnapshot,details.receiptSnapshot);
const readback=query(office,`SELECT jsonb_build_object(
  'parents',(SELECT count(*) FROM demo_payment.story_payments WHERE id='${parent.id}'::uuid),
  'notices',(SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id='${parent.id}'::uuid),
  'data',(SELECT data FROM demo_payment.story_payments WHERE id='${parent.id}'::uuid));`);
assert.equal(readback.parents,1);assert.equal(readback.notices,1);
assert.deepEqual(readback.data,parent.data);
const unchanged=query(source,`SELECT jsonb_build_object(
  'data',p.data,
  'outbox',(SELECT jsonb_build_object('status',o.status,'attempts',o.attempts)
    FROM demo_payment.mirror_outbox o WHERE o.entity_type='PAYMENT' AND o.entity_id=p.id),
  'saved',(SELECT coalesce(jsonb_agg(jsonb_build_object('tin',b.tin,'name',b.display_name)), '[]'::jsonb)
    FROM taxpay_guest_private.beneficiaries b
    JOIN taxpay_guest_private.lists l ON l.id=b.list_id
    WHERE l.name='F039 saved + one-time')
) FROM demo_payment.story_payments p WHERE p.id='${parent.id}'::uuid;`);
assert.deepEqual(unchanged.data,parent.data);
assert.deepEqual(unchanged.outbox,{status:'ACKED',attempts:0});
assert.deepEqual(unchanged.saved,parent.saved,'One-time TIN must remain unsaved');
console.log('PASS F-039/US-014 T04: one original saved-plus-one-time source parent, unchanged saved list, exact independent Office SQL parent/allocations/receipt, authenticated Office page, denied anon mirror and idempotent replay');
