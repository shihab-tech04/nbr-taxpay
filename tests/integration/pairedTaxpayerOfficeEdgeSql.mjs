/**
 * Runs the current Taxpayer and Office payment Edge handlers over real, separate
 * disposable SQL databases. Only the Supabase client transport is adapted:
 * every RPC is executed by psql against the local databases and the handlers
 * still exchange the existing signed HTTP requests. No hosted URL is contacted.
 */
import assert from 'node:assert/strict';
import {createHash,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const sourceDb=process.env.WS3_TAXPAYER_DB_URL;
const officeDb=process.env.WS3_OFFICE_DB_URL;
const officeRoot=process.env.WS3_OFFICE_SOURCE;
assert.ok(sourceDb&&officeDb&&officeRoot,'Disposable Taxpayer/Office DBs and exact Office #270 source are required');
for(const value of [sourceDb,officeDb])
  assert.ok(['127.0.0.1','localhost'].includes(new URL(value).hostname),'Only loopback SQL is allowed');
assert.notEqual(new URL(sourceDb).port,new URL(officeDb).port,'Taxpayer and Office SQL must be separate databases');

const officeSecret='ws3-disposable-shared-mirror-secret';
// Reuse the active MAKER fixture installed by pairedCorrectionOfficeSql.mjs.
const officerId='80000000-0000-4000-8000-000000000011';
const officeToken='ws3-disposable-authorized-office-session';
const servers={};
const officeFailure={next:true};
const f137MatrixPath=process.env.WS3_F137_MATRIX_FIXTURE;
const f137Matrix=f137MatrixPath?JSON.parse(readFileSync(f137MatrixPath,'utf8')):null;
if(f137Matrix)assert.equal(f137Matrix.sourceSha,process.env.WS1_SOURCE_SHA,
  'F-137 matrix must use the exact current Work A #779 source SHA');

function psql(url,sql){
  const result=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url],{
    input:sql,encoding:'utf8',timeout:90000,maxBuffer:6000000,
  });
  if(result.status!==0)throw Error('Disposable SQL failed: '+result.stderr.slice(-3000));
  const lines=result.stdout.trim().split('\n').filter(Boolean);
  if(!lines.length)return null;
  try{return JSON.parse(lines.at(-1));}catch{throw Error('Expected JSON SQL result: '+result.stdout.slice(-1200));}
}
function sqlText(value){return "'"+String(value).replaceAll("'","''")+"'";}
function sqlJson(value){return sqlText(JSON.stringify(value))+'::jsonb';}

function sqlRpc(origin,name,args,authenticatedOffice=false){
  const databaseOrigin=origin==='OFFICE_SQL'?'OFFICE_SQL':'TAXPAY_SQL';
  const definitions={
    TAXPAY_SQL:{
      // The real browser preview/login and saved-beneficiary routes use their
      // existing server-issued capability through the same disposable Edge.
      // These RPCs run on Taxpayer SQL only, never on the Office database.
      taxpay_demo_profile_login:`public.taxpay_demo_profile_login(${sqlText(args.p_demo_id)},${sqlText(args.p_password)})`,
      taxpay_demo_profile_settings:`public.taxpay_demo_profile_settings(${sqlText(args.p_capability_hash)},${args.p_key==null?'NULL::text':sqlText(args.p_key)},${args.p_value==null?'NULL::text':sqlText(args.p_value)})`,
      taxpay_guest_beneficiary_open:`public.taxpay_guest_beneficiary_open(${sqlText(args.p_capability_hash)})`,
      taxpay_guest_beneficiary_lists:`public.taxpay_guest_beneficiary_lists(${sqlText(args.p_capability_hash)})`,
      taxpay_guest_beneficiary_snapshot:`public.taxpay_guest_beneficiary_snapshot(${sqlText(args.p_capability_hash)})`,
      taxpay_guest_beneficiary_rows:`public.taxpay_guest_beneficiary_rows(${sqlText(args.p_capability_hash)},${args.p_offset}::integer,${args.p_limit}::integer)`,
      // Preserve the exact existing draft owner/capability/RLS functions.
      // The browser's draft-entry gate must reach real disposable SQL, rather
      // than receiving a fake successful list or an unsupported RPC error.
      taxpay_demo_payment_form_drafts:`public.taxpay_demo_payment_form_drafts(${sqlText(args.p_capability_hash)},${sqlText(args.p_action)},${args.p_draft_id==null?'NULL::uuid':sqlText(args.p_draft_id)+'::uuid'},${args.p_service==null?'NULL::text':sqlText(args.p_service)},${args.p_payload==null?'NULL::jsonb':sqlJson(args.p_payload)},${args.p_revision==null?'NULL::integer':args.p_revision+'::integer'})`,
      taxpay_guest_payment_form_drafts:`public.taxpay_guest_payment_form_drafts(${sqlText(args.p_capability_hash)},${sqlText(args.p_action)},${args.p_draft_id==null?'NULL::uuid':sqlText(args.p_draft_id)+'::uuid'},${args.p_service==null?'NULL::text':sqlText(args.p_service)},${args.p_payload==null?'NULL::jsonb':sqlJson(args.p_payload)},${args.p_revision==null?'NULL::integer':args.p_revision+'::integer'})`,
      taxpay_demo_story1_submit:`public.taxpay_demo_story1_submit(${sqlText(args.p_capability_hash)},${sqlJson(args.p_input)})`,
      taxpay_demo_story1_session_payment:`public.taxpay_demo_story1_session_payment(${sqlText(args.p_capability_hash)},${sqlText(args.p_payment_id)}::uuid)`,
      taxpay_office_story1_mirror_read:`public.taxpay_office_story1_mirror_read(${sqlText(args.p_id)}::uuid,${sqlText(args.p_session)}::uuid)`,
      taxpay_demo_received_payment_notices:`public.taxpay_demo_received_payment_notices(${sqlText(args.p_capability_hash)},${sqlText(args.p_action)},${args.p_event_id===null?'NULL::text':sqlText(args.p_event_id)},${args.p_offset}::integer,${args.p_limit}::integer)`,
    },
    OFFICE_SQL:{
      demo_story1_mirror:`public.demo_story1_mirror(${sqlJson(args.p_input)})`,
      payment_v1_office_guarded_story_page:`public.payment_v1_office_guarded_story_page(${args.p_page}::integer,${args.p_per_page}::integer)`,
    },
  };
  const expression=definitions[databaseOrigin]?.[name];
  if(!expression)throw Error('Unexpected SQL RPC '+origin+'.'+name);
  const role=databaseOrigin==='OFFICE_SQL'&&name==='payment_v1_office_guarded_story_page'
    ?'authenticated':'service_role';
  const claims=role==='authenticated'
    ?`SELECT set_config('request.jwt.claim.sub',${sqlText(authenticatedOffice?officerId:randomUUID())},true);\n`
    :'';
  return psql(databaseOrigin==='TAXPAY_SQL'?sourceDb:officeDb,
    `BEGIN;\nSET LOCAL ROLE ${role};\n${claims}SELECT ${expression};\nCOMMIT;`);
}

function loadHandler(file,origin){
  let handler=null;
  const source=readFileSync(file,'utf8');
  const compiled=transformSync(source,{loader:'ts',format:'cjs',target:'es2022'}).code;
  const module={exports:{}};
  const context={
    module,exports:module.exports,console,TextEncoder,TextDecoder,Request,Response,Headers,URL,btoa,atob,
    AbortSignal,crypto:webcrypto,Uint8Array,ArrayBuffer,JSON,Date,Error,Number,Promise,RegExp,
    structuredClone,fetch:routedFetch,
    require(spec){
      if(spec.startsWith('.'))return evaluate(resolve(dirname(file),spec));
      assert.match(spec,/^npm:@supabase\/supabase-js@/);
      return {createClient:(_url,_key,options={})=>{
        const authorization=options.global?.headers?.Authorization;
        return {
          auth:{getUser:async token=>token===officeToken
            ?{data:{user:{id:officerId,is_anonymous:false}},error:null}
            :{data:{user:null},error:new Error('Invalid disposable Office session')}},
          rpc:async(name,args)=>{
            try{return {data:sqlRpc(origin,name,args,authorization==='Bearer '+officeToken),error:null};}
            catch(error){return {data:null,error:{message:error instanceof Error?error.message:String(error)}};}
          },
        };
      }};
    },
    Deno:{env:{get(name){
      if(name==='SUPABASE_URL')return origin.startsWith('TAXPAY')
        ?'https://eyqhoavnitkrajvyqvxn.supabase.co'
        :'https://ihbtabrvmyiwikqqbhrf.supabase.co';
      if(name==='SUPABASE_ANON_KEY')return 'disposable-anon-key';
      if(name==='SUPABASE_SERVICE_ROLE_KEY')return officeSecret;
      if(name==='SUPABASE_SECRET_KEYS')return JSON.stringify({default:officeSecret});
      return null;
    }},serve(callback){handler=callback;}},
  };
  const cache=new Map();
  function evaluate(path){
    const absolute=resolve(path);
    if(cache.has(absolute))return cache.get(absolute).exports;
    const src=readFileSync(absolute,'utf8'),mod={exports:{}};cache.set(absolute,mod);
    const code=transformSync(src,{loader:'ts',format:'cjs',target:'es2022'}).code;
    vm.runInNewContext(code,{...context,module:mod,exports:mod.exports},{filename:absolute,timeout:5000});
    return mod.exports;
  }
  vm.runInNewContext(compiled,context,{filename:file,timeout:5000});
  assert.equal(typeof handler,'function',origin+' Edge handler did not register');
  return handler;
}

function routedFetch(input,init){
  const raw=typeof input==='string'?input:input.url;
  const incoming=new URL(raw);
  let origin,route;
  if(incoming.hostname==='ihbtabrvmyiwikqqbhrf.supabase.co'&&
      incoming.pathname.startsWith('/functions/v1/demo-story1-office/')){
    origin='OFFICE_SQL';route=incoming.pathname.replace('/functions/v1','')+incoming.search;
  }else if(incoming.hostname==='eyqhoavnitkrajvyqvxn.supabase.co'&&
      incoming.pathname.startsWith('/functions/v1/demo-story1-taxpay/')){
    origin='TAXPAY_SQL';route=incoming.pathname.replace('/functions/v1','')+incoming.search;
  }else throw Error('Blocked external URL in disposable SQL/Edge test: '+incoming.origin);
  if(origin==='OFFICE_SQL'&&route.startsWith('/demo-story1-office/mirror')&&officeFailure.next){
    officeFailure.next=false;
    return Promise.resolve(new Response(JSON.stringify({success:false,error:'DISPOSABLE_OFFICE_OUTAGE'}),
      {status:503,headers:{'content-type':'application/json'}}));
  }
  return fetch(servers[origin]+route,init);
}

async function start(origin,root,name){
  const handler=loadHandler(root+'/supabase/functions/'+name+'/index.ts',origin);
  const server=createServer(async(req,res)=>{
    const requestPath=new URL(req.url,'http://127.0.0.1').pathname;
    if(!requestPath.startsWith('/'+name)){res.writeHead(404);res.end();return;}
    let body='';for await(const part of req)body+=part;
    try{
      const request=new Request('http://127.0.0.1'+req.url,{
        method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined,
      });
      const response=await handler(request);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){res.writeHead(500);res.end(JSON.stringify({error:String(error)}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  servers[origin]='http://127.0.0.1:'+server.address().port;
  return server;
}
async function request(origin,path,method='GET',body,headers={}){
  const name=origin==='TAXPAY_SQL'?'demo-story1-taxpay':origin==='TAXPAY_RECIPIENTS'
    ?'taxpay-guest-beneficiaries':'demo-story1-office';
  const response=await fetch(servers[origin]+'/'+name+path,{
    method,headers:{...headers,...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  return {status:response.status,data:await response.json()};
}

const profile=psql(sourceDb,
  "SELECT public.taxpay_demo_profile_login('user1','user1');");
assert.ok(profile?.capability&&profile.paymentSessionId,'Existing disposable User1 profile contract is unavailable');
const recipient2Profile=psql(sourceDb,"SELECT public.taxpay_demo_profile_login('user2','user2');");
const recipient3Profile=psql(sourceDb,"SELECT public.taxpay_demo_profile_login('user3','user3');");
const unrelatedProfile=psql(sourceDb,"SELECT public.taxpay_demo_profile_login('user4','user4');");
const capabilityHash=createHash('sha256').update(profile.capability).digest('hex');
const list=psql(sourceDb,
  `SELECT public.taxpay_guest_beneficiary_create_list(${sqlText(capabilityHash)},${sqlText('WS3 Edge SQL '+randomUUID())});`);
assert.ok(list?.id,'Could not create the disposable saved-beneficiary fixture');
const beneficiaries=[
  {tin:'222222222222',display_name:'WS3 recipient 2',tag:'clients'},
  {tin:'333333333333',display_name:'WS3 recipient 3',tag:'clients'},
];
assert.equal(psql(sourceDb,`SELECT public.taxpay_guest_beneficiary_add(${sqlText(capabilityHash)},${sqlText(list.id)}::uuid,${sqlJson(beneficiaries)});`),2);

const allocationIds=['ws3-edge-sql-allocation-2','ws3-edge-sql-allocation-3'];
const lines=[
  {headId:121,economicCode:'64',headNameEn:'Advance Tax',totalAmount:15,taxAmount:15,penaltyAmount:0,surchargeAmount:0,interestAmount:0},
  {headId:145,economicCode:'135',headNameEn:'Tax on notice of demand',totalAmount:35,taxAmount:35,penaltyAmount:0,surchargeAmount:0,interestAmount:0},
];
const allocations=[
  {allocationId:allocationIds[0],taxpayerTin:'222222222222',taxpayerName:'WS3 recipient 2',headId:121,
    assessmentYear:'2026-27',amountMinor:1500,serviceCode:'ADVANCE_TAX',isWithholding:false},
  {allocationId:allocationIds[1],taxpayerTin:'333333333333',taxpayerName:'WS3 recipient 3',headId:145,
    assessmentYear:'2025-26',amountMinor:3500,serviceCode:'ASSESSED_DEMAND',isWithholding:false},
];
const idempotencyKey=randomUUID();
const receiptSnapshot={paymentCategory:'OTHER_TAX_PAYMENT',totalAmount:50,challanNo:'SIM-'+idempotencyKey,
  items:lines,allocationItems:allocations.map((item,index)=>({allocationId:item.allocationId,
    taxpayerTin:item.taxpayerTin,assessmentYear:item.assessmentYear,amountMinor:item.amountMinor,
    paymentServiceEn:lines[index].headNameEn,economicCode:lines[index].economicCode})),isSimulatedDemo:true};
const payload={origin:'TAXPAY_UI',idempotencyKey,sessionId:profile.paymentSessionId,
  service:'OTHER_TAX_PAYMENT',amountMinor:5000,details:{payerId:'user1',payerName:'WS3 Edge SQL payer',
    payerMode:'OTHER',combinedPayment:true,allocationContractVersion:3,allocationCount:2,taxpayerCount:2,
    receiptReference:'SIM-'+idempotencyKey,totalAmount:50,assessmentYear:'2026-27, 2025-26',
    taxpayerTin:'',lines,receiptLines:lines,allocations,receiptSnapshot}};

const officeFixture=psql(officeDb,
  `SELECT jsonb_build_object('userExists',EXISTS(SELECT 1 FROM auth.users WHERE id=${sqlText(officerId)}::uuid),`+
  `'role',(SELECT role FROM payment_sync.officer_roles WHERE user_uid=${sqlText(officerId)}::uuid),`+
  `'active',(SELECT active FROM payment_sync.officer_roles WHERE user_uid=${sqlText(officerId)}::uuid));`);
assert.deepEqual(officeFixture,{userExists:true,role:'MAKER',active:true},
  'Use the existing authorized disposable Office maker identity; do not create a test role here');

const [taxpayerServer,officeServer,recipientServer]=await Promise.all([
  start('TAXPAY_SQL',resolve('.'),'demo-story1-taxpay'),
  start('OFFICE_SQL',resolve(officeRoot),'demo-story1-office'),
  start('TAXPAY_RECIPIENTS',resolve('.'),'taxpay-guest-beneficiaries'),
]);
try{
  const headers={'x-taxpay-guest-capability':profile.capability};
  const failed=await request('TAXPAY_SQL','/payments','POST',payload,headers);
  assert.equal(failed.status,503,'Office outage must remain retryable after source persistence');
  assert.equal(failed.data.error,'OFFICE_SYNC_PENDING');
  const sourceId=failed.data.requestId;
  assert.ok(sourceId,'Retry response must carry the original Taxpayer SQL parent ID');
  const sourceRow=psql(sourceDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.equal(sourceRow.id,sourceId);
  assert.equal(Number(sourceRow.amountMinor),5000);
  assert.equal(sourceRow.status,'SIMULATED_SUCCESS');
  assert.deepEqual(sourceRow.data.details.allocations,allocations);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`),0);

  const retry=await request('TAXPAY_SQL','/payments','POST',payload,headers);
  assert.equal(retry.status,200,'Replaying the same source key must recover the Office mirror');
  assert.equal(retry.data.id,sourceId,'Retry must preserve the original payment parent ID');
  assert.equal(retry.data.replayed,true);
  const history=await request('TAXPAY_SQL',`/payments/${sourceId}?sessionId=${encodeURIComponent(profile.paymentSessionId)}`,'GET',undefined,headers);
  assert.equal(history.status,200);
  assert.equal(history.data.data.id,sourceId);
  assert.equal(history.data.data.data.idempotencyKey,idempotencyKey);
  assert.deepEqual(history.data.data.data.details.allocations,allocations);

  const officeRow=psql(officeDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.equal(officeRow.id,sourceId);
  assert.deepEqual(officeRow.data,sourceRow.data,'Office SQL must store the exact original Taxpayer payload');
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=${sqlText(idempotencyKey)}::uuid;`),1);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(sourceId)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(sourceId)}::uuid;`),1);

  const noOfficeAuth=await request('OFFICE_SQL','/payments?page=1&perPage=100');
  assert.equal(noOfficeAuth.status,401,'Office payment readback must retain the existing officer-session gate');
  const readback=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
    {authorization:'Bearer '+officeToken});
  assert.equal(readback.status,200);
  const row=readback.data.data.items.find(item=>item.id===sourceId);
  assert.ok(row,'Authorized Office/Admin endpoint must return the mirrored parent');
  assert.equal(Number(row.amountMinor),5000);
  assert.equal(row.certificateReference,'SK-PC-'+sourceId);
  assert.equal(row.details.payerId,'user1');
  assert.equal(row.details.receiptReference,'SIM-'+idempotencyKey);
  assert.equal(row.details.receiptSnapshot.challanNo,'SIM-'+idempotencyKey);
  assert.deepEqual(row.details.allocations.map(item=>item.allocationId),allocationIds);
  assert.deepEqual(row.details.allocations.map(item=>item.taxpayerTin),['222222222222','333333333333']);
  assert.deepEqual(row.details.allocations.map(item=>item.headId),[121,145]);
  assert.deepEqual(row.details.allocations.map(item=>item.assessmentYear),['2026-27','2025-26']);
  assert.deepEqual(row.details.allocations.map(item=>item.amountMinor),[1500,3500]);
  const officeUiFixtureOut=process.env.WS3_OFFICE_UI_FIXTURE_OUT;
  if(officeUiFixtureOut)writeFileSync(officeUiFixtureOut,JSON.stringify({
    payment:row,
    expected:{id:sourceId,status:sourceRow.status,payerId:'user1',
      receiptReference:'SIM-'+idempotencyKey,allocationIds,allocationTins:['222222222222','333333333333'],
      headIds:[121,145],assessmentYears:['2026-27','2025-26'],amountsMinor:[1500,3500],
      totalMinor:5000},
  }),{mode:0o600});


  const notices=async(profile,action='received-notices-list',eventId)=>request(
    'TAXPAY_RECIPIENTS','', 'POST',
    {action,eventId:eventId??null,offset:0,limit:100},
    {origin:'http://127.0.0.1:4173','x-taxpay-guest-capability':profile.capability});
  const recipient2Notices=await notices(recipient2Profile);
  const recipient3Notices=await notices(recipient3Profile);
  const unrelatedNotices=await notices(unrelatedProfile);
  assert.equal(recipient2Notices.status,200);
  assert.equal(recipient3Notices.status,200);
  assert.equal(unrelatedNotices.status,200);
  const recipient2Item=recipient2Notices.data.data.items.find(item=>item.paymentId===sourceId);
  const recipient3Item=recipient3Notices.data.data.items.find(item=>item.paymentId===sourceId);
  assert.ok(recipient2Item&&recipient3Item,'Each beneficiary should receive only their allocated payment notice');
  assert.equal(recipient2Item.allocationId,allocationIds[0]);
  assert.equal(recipient2Item.recipientTin,'222222222222');
  assert.equal(recipient2Item.headId,'121');
  assert.equal(recipient2Item.assessmentYear,'2026-27');
  assert.equal(recipient2Item.amountMinor,1500);
  assert.equal(recipient2Item.receiptReference,'SIM-'+idempotencyKey);
  assert.equal(recipient3Item.allocationId,allocationIds[1]);
  assert.equal(recipient3Item.recipientTin,'333333333333');
  assert.equal(recipient3Item.headId,'145');
  assert.equal(recipient3Item.assessmentYear,'2025-26');
  assert.equal(recipient3Item.amountMinor,3500);
  assert.equal(recipient3Item.receiptReference,'SIM-'+idempotencyKey);
  assert.equal(unrelatedNotices.data.data.items.some(item=>item.paymentId===sourceId),false,
    'A profile outside the allocation must not see a recipient notice');
  const acknowledged=await notices(recipient2Profile,'received-notices-ack',recipient2Item.eventId);
  const repeatedAcknowledgement=await notices(recipient2Profile,'received-notices-ack',recipient2Item.eventId);
  assert.equal(acknowledged.status,200);
  assert.equal(acknowledged.data.data.isRead,true);
  assert.equal(repeatedAcknowledgement.data.data.acknowledgedAt,acknowledged.data.data.acknowledgedAt,
    'Repeated acknowledgement must preserve its original receipt time');
  const recipient2Unread=await notices(recipient2Profile,'received-notices-unread');
  const recipient3Unread=await notices(recipient3Profile,'received-notices-unread');
  assert.equal(recipient2Unread.data.data.items.some(item=>item.eventId===recipient2Item.eventId),false);
  assert.equal(recipient3Unread.data.data.items.some(item=>item.eventId===recipient3Item.eventId),true,
    'Acknowledging one allocation notice must not mark another recipient read');

  const conflictingPayload=structuredClone(payload);
  conflictingPayload.details={...conflictingPayload.details,payerName:'WS3 conflicting payer'};
  const conflict=await request('TAXPAY_SQL','/payments','POST',conflictingPayload,headers);
  assert.equal(conflict.status,400,'Reusing a payment idempotency key with changed data must be rejected');
  assert.equal(conflict.data.error,'SUBMISSION_FAILED');
  const sourceAfterConflict=psql(sourceDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.deepEqual(sourceAfterConflict,sourceRow,'A conflicting replay must not mutate the original Taxpayer parent');
  const officeAfterConflict=psql(officeDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.deepEqual(officeAfterConflict,officeRow,'A conflicting replay must not mutate the Office mirror');
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(sourceId)}::uuid;`),1,
    'A conflicting replay must not create a duplicate Taxpayer payment notice');
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(sourceId)}::uuid;`),1,
    'A conflicting replay must not create a duplicate Office payment notice');

  const replay=await request('TAXPAY_SQL','/payments','POST',payload,headers);
  assert.equal(replay.status,200);
  assert.equal(replay.data.id,sourceId);
  assert.equal(replay.data.replayed,true);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`),1,
    'Office replay must remain a single immutable parent');

  const travelKey=randomUUID();
  const rawPassport='WS3-DISPOSABLE-PASSPORT-XYZ';
  const travelPassengers=[
    {passengerName:'WS3 QA Passenger A',passportNumberMasked:'••••1234',nationality:'Bangladeshi',
      country:'Bangladesh',age:32,amountMinor:6000},
    {passengerName:'WS3 QA Passenger B',passportNumberMasked:'••••5678',nationality:'Bangladeshi',
      country:'Bangladesh',age:28,amountMinor:6000},
  ];
  const travelPayload={origin:'TAXPAY_UI',idempotencyKey:travelKey,sessionId:profile.paymentSessionId,
    service:'TRAVEL_TAX',amountMinor:12000,details:{payerId:'user1',payerName:'WS3 Edge SQL payer',
      travelMode:'AIR',departurePort:'DAC',destination:'KUL',travelDate:'2026-11-13',
      passportNumber:rawPassport,passengers:travelPassengers,
      lines:[{amountMinor:12000,note:'Passport: '+rawPassport}],
      receiptReference:'SIM-'+travelKey,totalAmount:120,
      receiptSnapshot:{paymentCategory:'TRAVEL_TAX',totalAmount:120,challanNo:'SIM-'+travelKey,
        travelDetails:{travelMode:'AIR',departurePort:'DAC',destination:'KUL',
          travelDate:'2026-11-13',passengers:travelPassengers}}}};
  const travelSubmit=await request('TAXPAY_SQL','/payments','POST',travelPayload,headers);
  assert.equal(travelSubmit.status,200,'Separate Travel Tax parent must mirror through the existing Edge path');
  assert.equal(travelSubmit.data.replayed,false);
  const travelId=travelSubmit.data.id;
  assert.ok(travelId);
  const travelSource=psql(sourceDb,`SELECT jsonb_build_object('id',id,'service',service_code,'amountMinor',amount_minor,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(travelId)}::uuid;`);
  assert.equal(travelSource.id,travelId);
  assert.equal(travelSource.service,'TRAVEL_TAX');
  assert.equal(Number(travelSource.amountMinor),12000);
  assert.equal(travelSource.data.details.payerId,'user1');
  assert.deepEqual(travelSource.data.details.passengers,travelPassengers);
  const travelOfficeStored=psql(officeDb,`SELECT jsonb_build_object('id',id,'service',service_code,'amountMinor',amount_minor,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(travelId)}::uuid;`);
  assert.equal(travelOfficeStored.id,travelId);
  assert.deepEqual(travelOfficeStored.data,travelSource.data,
    'Office SQL must retain the original Travel Tax parent and source snapshot');
  const travelReadback=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
    {authorization:'Bearer '+officeToken});
  assert.equal(travelReadback.status,200);
  const travelItem=travelReadback.data.data.items.find(item=>item.id===travelId);
  assert.ok(travelItem,'Authorized Office/Admin readback must return the separate Travel Tax parent');
  assert.equal(travelItem.service,'TRAVEL_TAX');
  assert.equal(Number(travelItem.amountMinor),12000);
  assert.equal(travelItem.certificateReference,'SK-PC-'+travelId);
  assert.equal(travelItem.details.payerId,'user1');
  assert.equal(travelItem.details.passportNumberMasked,'•'.repeat(rawPassport.length-3)+'XYZ');
  assert.deepEqual(travelItem.details.passengers,travelPassengers);
  assert.equal(JSON.stringify(travelItem).includes(rawPassport),false,
    'Office/Admin Travel Tax readback must not expose the source passport or passport-bearing line note');
  const travelReplay=await request('TAXPAY_SQL','/payments','POST',travelPayload,headers);
  assert.equal(travelReplay.status,200);
  assert.equal(travelReplay.data.id,travelId);
  assert.equal(travelReplay.data.replayed,true);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=${sqlText(travelKey)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(travelId)}::uuid;`),1);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(travelId)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(travelId)}::uuid;`),1);

  const payAgainKey=randomUUID();
  const payAgainAllocationIds=['ws3-pay-again-allocation-2','ws3-pay-again-allocation-3'];
  const payAgainPayload=structuredClone(payload);
  payAgainPayload.idempotencyKey=payAgainKey;
  payAgainPayload.details.sourcePaymentId=sourceId;
  payAgainPayload.details.receiptReference='SIM-'+payAgainKey;
  payAgainPayload.details.receiptSnapshot.challanNo='SIM-'+payAgainKey;
  payAgainPayload.details.allocations=payAgainPayload.details.allocations.map((allocation,index)=>
    ({...allocation,allocationId:payAgainAllocationIds[index]}));
  payAgainPayload.details.receiptSnapshot.allocationItems=
    payAgainPayload.details.receiptSnapshot.allocationItems.map((item,index)=>
      ({...item,allocationId:payAgainAllocationIds[index]}));
  const payAgain=await request('TAXPAY_SQL','/payments','POST',payAgainPayload,headers);
  assert.equal(payAgain.status,200,'Pay Again must create a distinct Taxpayer parent and mirror it through the existing Edge');
  assert.equal(payAgain.data.replayed,false);
  const payAgainId=payAgain.data.id;
  assert.ok(payAgainId);
  assert.notEqual(payAgainId,sourceId,'Pay Again must not overwrite the source payment parent');
  const payAgainSource=psql(sourceDb,`SELECT jsonb_build_object('id',id,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(payAgainId)}::uuid;`);
  assert.equal(payAgainSource.id,payAgainId);
  assert.equal(payAgainSource.data.details.sourcePaymentId,sourceId);
  assert.deepEqual(payAgainSource.data.details.allocations.map(item=>item.allocationId),payAgainAllocationIds);
  const originalAfterPayAgain=psql(sourceDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.deepEqual(originalAfterPayAgain,sourceRow,'Pay Again must preserve the original Taxpayer parent and allocations');
  const payAgainOfficeStored=psql(officeDb,`SELECT jsonb_build_object('id',id,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(payAgainId)}::uuid;`);
  assert.equal(payAgainOfficeStored.id,payAgainId);
  assert.deepEqual(payAgainOfficeStored.data,payAgainSource.data,
    'Separate Office SQL must retain Pay Again parent, source lineage and allocation snapshot');
  const payAgainReadback=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
    {authorization:'Bearer '+officeToken});
  assert.equal(payAgainReadback.status,200);
  const payAgainItem=payAgainReadback.data.data.items.find(item=>item.id===payAgainId);
  assert.ok(payAgainItem,'Authorized Office/Admin readback must return the Pay Again parent');
  assert.equal(payAgainItem.certificateReference,'SK-PC-'+payAgainId);
  assert.equal(payAgainItem.details.sourcePaymentId,sourceId);
  assert.equal(payAgainItem.details.receiptReference,'SIM-'+payAgainKey);
  assert.equal(payAgainItem.details.receiptSnapshot.challanNo,'SIM-'+payAgainKey);
  assert.deepEqual(payAgainItem.details.allocations.map(item=>item.allocationId),payAgainAllocationIds);
  const payAgainReplay=await request('TAXPAY_SQL','/payments','POST',payAgainPayload,headers);
  assert.equal(payAgainReplay.status,200);
  assert.equal(payAgainReplay.data.id,payAgainId);
  assert.equal(payAgainReplay.data.replayed,true);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=${sqlText(payAgainKey)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(payAgainId)}::uuid;`),1);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(payAgainId)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(payAgainId)}::uuid;`),1);


  if(f137Matrix){
    const rejectedKeys=f137Matrix.rejectedIdempotencyKeys;
    assert.ok(Array.isArray(rejectedKeys)&&rejectedKeys.length===f137Matrix.rejectedCases);
    assert.equal(new Set(rejectedKeys).size,rejectedKeys.length,
      'Every rejected composer combination must have a distinct non-submitted idempotency key');
    const rejectedArray='ARRAY['+rejectedKeys.map(sqlText).join(',')+']::text[]';
    assert.equal(Number(psql(sourceDb,
      `SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key::text=ANY(${rejectedArray});`)),0,
      'Rejected combinations must not create Taxpayer SQL payment parents');
    assert.equal(Number(psql(officeDb,
      `SELECT count(*) FROM demo_payment.story_payments WHERE data->>'idempotencyKey'=ANY(${rejectedArray});`)),0,
      'Rejected combinations must not create separate Office SQL parents');

    const matrixPayload=structuredClone(f137Matrix.validPayload);
    matrixPayload.origin='TAXPAY_UI';
    matrixPayload.sessionId=profile.paymentSessionId;
    assert.equal(matrixPayload.service,'OTHER_TAX_PAYMENT');
    assert.equal(matrixPayload.details.payerMode,'OTHER');
    assert.equal(matrixPayload.details.allocationContractVersion,3);
    assert.equal(matrixPayload.details.allocations.length,f137Matrix.validAllocationCount);
    const matrixIds=matrixPayload.details.allocations.map(item=>item.allocationId);
    assert.equal(new Set(matrixIds).size,matrixIds.length);
    const matrixHeads=[...new Set(matrixPayload.details.allocations.map(item=>item.headId))].sort((a,b)=>a-b);
    assert.deepEqual(matrixHeads,[...f137Matrix.eligibleHeadIds].sort((a,b)=>a-b),
      'The paired SQL/API payment must contain every currently eligible mapped non-Return head');
    assert.equal(new Set(matrixPayload.details.allocations.map(item=>item.taxpayerTin)).size,2,
      'The valid Other payment must preserve multiple beneficiaries');
    assert.equal(new Set(matrixPayload.details.allocations.map(item=>item.assessmentYear)).size,4,
      'The valid Other payment must preserve multiple assessment years');
    assert.equal(matrixPayload.details.allocations.reduce((sum,item)=>sum+item.amountMinor,0),
      matrixPayload.amountMinor,'Every allocation amount must reconcile to the combined parent total');

    const matrixSubmit=await request('TAXPAY_SQL','/payments','POST',matrixPayload,headers);
    assert.equal(matrixSubmit.status,200,'All mapped non-Return heads must pass the existing Taxpayer Edge/SQL contract');
    assert.equal(matrixSubmit.data.replayed,false);
    const matrixId=matrixSubmit.data.id;
    assert.ok(matrixId);
    const matrixSource=psql(sourceDb,
      `SELECT jsonb_build_object('id',id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(matrixId)}::uuid;`);
    assert.equal(matrixSource.id,matrixId);
    assert.equal(Number(matrixSource.amountMinor),matrixPayload.amountMinor);
    assert.equal(matrixSource.status,'SIMULATED_SUCCESS');
    assert.equal(matrixSource.data.details.payerId,'user1');
    assert.deepEqual(matrixSource.data.details.allocations,matrixPayload.details.allocations,
      'Original allocation IDs, beneficiaries, mapped heads, AYs, service codes and amounts must persist unchanged');
    assert.equal(matrixSource.data.details.receiptReference,matrixPayload.details.receiptReference);
    assert.deepEqual(matrixSource.data.details.receiptSnapshot.items,matrixPayload.details.receiptSnapshot.items);

    const matrixOffice=psql(officeDb,
      `SELECT jsonb_build_object('id',id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(matrixId)}::uuid;`);
    assert.equal(matrixOffice.id,matrixId);
    assert.deepEqual(matrixOffice.data,matrixSource.data,
      'Separate Office SQL must retain the exact combined source snapshot');
    const matrixReadback=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
      {authorization:'Bearer '+officeToken});
    assert.equal(matrixReadback.status,200);
    const matrixItem=matrixReadback.data.data.items.find(item=>item.id===matrixId);
    assert.ok(matrixItem,'Authorized Office/Admin readback must return the matrix parent');
    assert.equal(Number(matrixItem.amountMinor),matrixPayload.amountMinor);
    assert.equal(matrixItem.status,'SIMULATED_SUCCESS');
    assert.equal(matrixItem.certificateReference,'SK-PC-'+matrixId);
    assert.equal(matrixItem.details.payerId,'user1');
    assert.equal(matrixItem.details.receiptReference,matrixPayload.details.receiptReference);
    assert.deepEqual(matrixItem.details.allocations,matrixPayload.details.allocations);
    const matrixReplay=await request('TAXPAY_SQL','/payments','POST',matrixPayload,headers);
    assert.equal(matrixReplay.status,200);
    assert.equal(matrixReplay.data.id,matrixId);
    assert.equal(matrixReplay.data.replayed,true);
    assert.equal(Number(psql(sourceDb,
      `SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=${sqlText(matrixPayload.idempotencyKey)}::uuid;`)),1);
    assert.equal(Number(psql(officeDb,
      `SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(matrixId)}::uuid;`)),1);
    console.log('PASS F-137-T01 paired SQL/API: '+f137Matrix.eligibleHeadIds.length+
      ' mapped non-Return heads, '+f137Matrix.validAllocationCount+
      ' allocations, multiple beneficiaries and AYs, exact Taxpayer/Office identity, receipt/certificate/status and replay; '+
      f137Matrix.rejectedCases+' rejected composer cases have no SQL parents');
  }
  if(process.env.WS3_BROWSER_ORIGIN_ACCEPTANCE==='true'){
    // Keep both SQL/Edge servers alive while the genuine current WS1 browser
    // sends its own payment request; never substitute a fabricated payload.
    const {verifyWs3BrowserOrigin}=await import('./ws3BrowserOriginPayment.mjs');
    await verifyWs3BrowserOrigin({request,psql,sqlText,sourceDb,officeDb,officeToken,
      sourceSha:process.env.WS1_SOURCE_SHA});
  }
  console.log('PASS: separate disposable Taxpayer and Office SQL through existing Edge handlers; combined multi-recipient v3 allocations, distinct Pay Again parent lineage and separate Travel Tax passengers, exact amounts/years/heads, payer, receipt/certificate, authorized readback and passport redaction, recipient notice isolation, Office outage recovery, idempotent replay/conflict immutability, and single source/Office notices');
}finally{
  await Promise.all([taxpayerServer,officeServer,recipientServer].map(server=>new Promise(resolve=>server.close(resolve))));
}
