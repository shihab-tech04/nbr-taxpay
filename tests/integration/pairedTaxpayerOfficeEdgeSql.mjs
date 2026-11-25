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
// Use an identity outside the seeded MAKER/REVIEWER/APPROVER identities.
const unauthorizedOfficerId=randomUUID();
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
      // Guest submission is the original anonymous-authorized RPC. Unlike
      // preview-profile submit it must not gain service-role privileges.
      demo_story1_submit:`public.demo_story1_submit(${sqlJson(args.p_input)})`,
      taxpay_demo_story1_submit:`public.taxpay_demo_story1_submit(${sqlText(args.p_capability_hash)},${sqlJson(args.p_input)})`,
      taxpay_demo_story1_session_payments:`public.taxpay_demo_story1_session_payments(${sqlText(args.p_capability_hash)},${args.p_page}::integer,${args.p_per_page}::integer)`,
      taxpay_demo_story1_session_payment:`public.taxpay_demo_story1_session_payment(${sqlText(args.p_capability_hash)},${sqlText(args.p_payment_id)}::uuid)`,
      taxpay_office_story1_mirror_read:`public.taxpay_office_story1_mirror_read(${sqlText(args.p_id)}::uuid,${sqlText(args.p_session)}::uuid)`,
      taxpay_demo_received_payment_notices:`public.taxpay_demo_received_payment_notices(${sqlText(args.p_capability_hash)},${sqlText(args.p_action)},${args.p_event_id===null?'NULL::text':sqlText(args.p_event_id)},${args.p_offset}::integer,${args.p_limit}::integer)`,
    },
    OFFICE_SQL:{
      demo_story1_mirror:`public.demo_story1_mirror(${sqlJson(args.p_input)})`,
      payment_v1_office_guarded_story_page:`public.payment_v1_office_guarded_story_page(${args.p_page}::integer,${args.p_per_page}::integer)`,
      payment_v1_office_guarded_pay_again_lineage:`public.payment_v1_office_guarded_pay_again_lineage(${sqlText(args.p_payment_id)}::uuid)`,
    },
  };
  const expression=definitions[databaseOrigin]?.[name];
  if(!expression)throw Error('Unexpected SQL RPC '+origin+'.'+name);
  const role=name==='demo_story1_submit'?'anon'
    :databaseOrigin==='OFFICE_SQL'&&['payment_v1_office_guarded_story_page','payment_v1_office_guarded_pay_again_lineage'].includes(name)
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
const challanRemarks='বাংলা মন্তব্য: করের অতিরিক্ত তথ্য\nEnglish challan context longer than twenty characters.';
const receiptSnapshot={paymentCategory:'OTHER_TAX_PAYMENT',totalAmount:50,challanNo:'SIM-'+idempotencyKey,
  paymentRemarks:challanRemarks,
  items:lines,allocationItems:allocations.map((item,index)=>({allocationId:item.allocationId,
    taxpayerTin:item.taxpayerTin,assessmentYear:item.assessmentYear,amountMinor:item.amountMinor,
    paymentServiceEn:lines[index].headNameEn,economicCode:lines[index].economicCode})),isSimulatedDemo:true};
const payload={origin:'TAXPAY_UI',idempotencyKey,sessionId:profile.paymentSessionId,
  service:'OTHER_TAX_PAYMENT',amountMinor:5000,details:{payerId:'user1',payerName:'WS3 Edge SQL payer',
    payerMode:'OTHER',combinedPayment:true,allocationContractVersion:3,allocationCount:2,taxpayerCount:2,
    receiptReference:'SIM-'+idempotencyKey,totalAmount:50,assessmentYear:'2026-27, 2025-26',
    taxpayerTin:'',paymentRemarks:challanRemarks,challanRemarks,
    lines,receiptLines:lines,allocations,receiptSnapshot}};

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
  assert.equal(sourceRow.data.details.challanRemarks,challanRemarks,
    'The original Taxpayer SQL parent must preserve the exact BN/EN multiline challan remarks');
  assert.equal(sourceRow.data.details.receiptSnapshot.paymentRemarks,challanRemarks,
    'The original receipt snapshot must preserve the same printable remarks');
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
  assert.equal(history.data.data.data.details.challanRemarks,challanRemarks,
    'Capability-scoped Taxpayer API readback must preserve the exact original remarks');
  assert.equal(history.data.data.data.details.receiptSnapshot.paymentRemarks,challanRemarks);

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
  assert.equal(row.details.challanRemarks,challanRemarks,
    'Office payment feed must retain the immutable original challan remarks');
  assert.equal(row.details.receiptSnapshot.paymentRemarks,challanRemarks);
  assert.deepEqual(row.details.allocations.map(item=>item.allocationId),allocationIds);
  assert.deepEqual(row.details.allocations.map(item=>item.taxpayerTin),['222222222222','333333333333']);
  assert.deepEqual(row.details.allocations.map(item=>item.headId),[121,145]);
  assert.deepEqual(row.details.allocations.map(item=>item.assessmentYear),['2026-27','2025-26']);
  assert.deepEqual(row.details.allocations.map(item=>item.amountMinor),[1500,3500]);
  const guardedRemarks=psql(officeDb,[
    'BEGIN;','SET LOCAL ROLE authenticated;',
    `SELECT set_config('request.jwt.claim.sub',${sqlText(officerId)},true);`,
    `SELECT public.payment_v1_office_guarded_challan_remarks(${sqlText(sourceId)}::uuid);`,
    'COMMIT;'
  ].join('\n'));
  assert.equal(guardedRemarks.paymentId,sourceId,
    'The guarded Office SQL readback must bind remarks to the immutable mirrored payment ID');
  assert.equal(guardedRemarks.challanRemarks,challanRemarks,
    'The active Office officer SQL function must return the exact multiline BN/EN remarks');
  assert.equal(guardedRemarks.receiptReference,'SIM-'+idempotencyKey);
  const unauthorizedRemarks=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',officeDb],{
    input:[
      'BEGIN;','SET LOCAL ROLE authenticated;',
      `SELECT set_config('request.jwt.claim.sub',${sqlText(unauthorizedOfficerId)},true);`,
      `SELECT public.payment_v1_office_guarded_challan_remarks(${sqlText(sourceId)}::uuid);`,
      'COMMIT;'
    ].join('\n'),encoding:'utf8'
  });
  const outsiderRoleCount=psql(officeDb,
    `SELECT count(*) FROM payment_sync.officer_roles WHERE user_uid=${sqlText(unauthorizedOfficerId)}::uuid AND active AND role IN ('MAKER','REVIEWER','APPROVER');`);
  assert.equal(outsiderRoleCount,0,'The denial fixture must have no active privileged Office role');
  assert.notEqual(unauthorizedRemarks.status,0,
    'A non-officer must not read Office challan remarks');
  assert.match(unauthorizedRemarks.stderr,/Active authorized Office payment officer required/,
    'The guarded Office SQL RPC must fail at its active-role check');
  assert.ok(!unauthorizedRemarks.stdout.includes(challanRemarks),
    'A denied officer read must not return taxpayer remarks');
  const officeUiFixtureOut=process.env.WS3_OFFICE_UI_FIXTURE_OUT;
  assert.ok(officeUiFixtureOut,'The paired Office browser fixture path is required');
  const officeUiFixture={
    payment:row,
    expected:{id:sourceId,status:sourceRow.status,payerId:'user1',
      receiptReference:'SIM-'+idempotencyKey,allocationIds,allocationTins:['222222222222','333333333333'],
      headIds:[121,145],assessmentYears:['2026-27','2025-26'],amountsMinor:[1500,3500],
      totalMinor:5000,challanRemarks:guardedRemarks.challanRemarks},
  };
  assert.equal(typeof officeUiFixture.expected.challanRemarks,'string',
    'The guarded Office SQL response must be included in the browser fixture');
  assert.equal(officeUiFixture.expected.challanRemarks,challanRemarks,
    'The browser fixture must carry the exact guarded SQL remarks');
  assert.equal(officeUiFixture.payment.details.challanRemarks,challanRemarks,
    'The browser fixture must retain the original Office SQL parent remarks');
  writeFileSync(officeUiFixtureOut,JSON.stringify(officeUiFixture),{mode:0o600});
  const writtenOfficeUiFixture=JSON.parse(readFileSync(officeUiFixtureOut,'utf8'));
  assert.equal(writtenOfficeUiFixture.expected.challanRemarks,challanRemarks,
    'The serialized browser fixture must retain the exact guarded SQL remarks');
  assert.equal(writtenOfficeUiFixture.payment.details.challanRemarks,challanRemarks,
    'The serialized browser fixture must retain the original SQL parent remarks');
  console.log('PASS: paired Office browser fixture contains exact officer-guarded multiline remarks ('+
    Array.from(writtenOfficeUiFixture.expected.challanRemarks).length+' code points)');


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

  // Gift Tax: real isolated source Edge -> source PostgreSQL -> signed Office
  // readback -> separate Office PostgreSQL. These are not mocked receipts.
  const giftKey=randomUUID(),giftReference='SIM-GIFT-'+giftKey;
  const giftRemarks='দানকরের মন্তব্য\nExact Gift Tax mirror acceptance';
  const giftDetails={
    donor:{tin:'111111111111',name:'User 1'},
    donee:{tin:'222222222222',name:'User 2',tag:'friends_family',relationship:'father',otherLabel:null},
    giftAmountMinor:250000000,estimatedTaxMinor:27200000,
    giftDate:'2025-01-15',description:'Disposable Gift Tax acceptance',remarks:giftRemarks,
  };
  const giftLine={headId:0,economicCode:'SIM-GIFT',headNameEn:'Gift Tax',taxAmount:272000,
    penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:272000};
  const giftSnapshot={id:giftReference,challanNo:giftReference,tokenNumber:'SIMULATION',paymentCategory:'GIFT_TAX',
    assessmentYear:'2025-26',payerName:'Sample Payer',payerTin:giftDetails.donor.tin,
    taxpayerName:giftDetails.donor.name,taxpayerTin:giftDetails.donor.tin,
    receiptMobile:'01712345678',receiptEmail:'',noticeReference:'',paymentRemarks:giftRemarks,giftDetails,
    isRepresentativePayment:false,taxZone:'—',taxCircle:'—',isWithholding:false,items:[giftLine],
    totalAmount:272000,paymentMethod:'BKASH',gatewayTransactionId:giftReference,
    treasuryStatus:'INITIATED',taxCreditStatus:'NOT_APPLICABLE',createdAt:'2025-01-15T00:00:00.000Z',isSimulatedDemo:true};
  const giftPayload={origin:'TAXPAY_UI',idempotencyKey:giftKey,sessionId:profile.paymentSessionId,service:'GIFT_TAX',
    amountMinor:27200000,details:{sampleOnly:true,payerId:'user1',payerMode:'SELF',
      payerName:giftSnapshot.payerName,payerTin:giftSnapshot.payerTin,
      taxpayerName:giftSnapshot.taxpayerName,taxpayerTin:giftSnapshot.taxpayerTin,
      assessmentYear:giftSnapshot.assessmentYear,receiptReference:giftReference,
      receiptMobile:giftSnapshot.receiptMobile,receiptEmail:'',noticeReference:'',
      challanRemarks:giftRemarks,paymentMethod:'BKASH',giftDetails,receiptLines:[giftLine],
      lines:[{beneficiary:'user1',category:'GIFT_TAX',assessmentYear:'2025-26',amountMinor:27200000}],
      receiptSnapshot:giftSnapshot}};
  const giftSubmit=await request('TAXPAY_SQL','/payments','POST',giftPayload,headers);
  assert.equal(giftSubmit.status,200,'Gift Tax must persist and acknowledge the actual Office mirror');
  assert.equal(giftSubmit.data.mirrored,true);
  const giftId=giftSubmit.data.id;
  assert.ok(giftId);
  const giftSql="SELECT jsonb_build_object('id',id,'service',service_code,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id="+sqlText(giftId)+"::uuid;";
  const giftSource=psql(sourceDb,giftSql),giftOffice=psql(officeDb,giftSql);
  assert.deepEqual(giftOffice,giftSource,'Gift Tax must preserve the same immutable parent, ID, amount and status in both SQL databases');
  assert.deepEqual(giftSource.data,giftPayload);
  const giftReadback=await request('TAXPAY_SQL','/payments/'+giftId+'?sessionId='+profile.paymentSessionId,'GET',undefined,headers);
  assert.equal(giftReadback.status,200);
  assert.equal(giftReadback.data.data.id,giftId);
  assert.deepEqual(giftReadback.data.data.data,giftPayload);
  const giftActivity=await request('TAXPAY_SQL','/payments?sessionId='+profile.paymentSessionId+'&page=1&perPage=100','GET',undefined,headers);
  assert.equal(giftActivity.status,200);
  const giftActivityRow=giftActivity.data.data.items.find(item=>item.id===giftId);
  assert.ok(giftActivityRow,'Account-scoped Activity must list the original Gift Tax payment');
  assert.equal(giftActivityRow.service,'GIFT_TAX');
  assert.equal(Number(giftActivityRow.amountMinor),27200000);
  const unrelatedGiftActivity=await request('TAXPAY_SQL','/payments?sessionId='+unrelatedProfile.paymentSessionId+'&page=1&perPage=100','GET',undefined,{'x-taxpay-guest-capability':unrelatedProfile.capability});
  assert.equal(unrelatedGiftActivity.status,200);
  assert.equal(unrelatedGiftActivity.data.data.items.some(item=>item.id===giftId),false);
  const giftOfficePage=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,{authorization:'Bearer '+officeToken});
  assert.equal(giftOfficePage.status,200);
  const giftOfficeItem=giftOfficePage.data.data.items.find(item=>item.id===giftId);
  assert.ok(giftOfficeItem,'Authorized Office register must return Gift Tax');
  assert.equal(giftOfficeItem.service,'GIFT_TAX');
  assert.equal(Number(giftOfficeItem.amountMinor),27200000);
  assert.deepEqual(giftOfficeItem.details.giftDetails,giftDetails);
  assert.equal(giftOfficeItem.details.challanRemarks,giftRemarks);
  assert.deepEqual(giftOfficeItem.details.receiptSnapshot.giftDetails,giftDetails);
  const giftReplay=await request('TAXPAY_SQL','/payments','POST',giftPayload,headers);
  assert.equal(giftReplay.status,200);assert.equal(giftReplay.data.id,giftId);assert.equal(giftReplay.data.replayed,true);
  for(const db of [sourceDb,officeDb]){
    assert.equal(Number(psql(db,"SELECT count(*) FROM demo_payment.story_payments WHERE id="+sqlText(giftId)+"::uuid;")),1);
    assert.equal(Number(psql(db,"SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id="+sqlText(giftId)+"::uuid;")),1);
  }
  // Altered tax, donor identity or receipt must never create a second record.
  for(const mutate of [
    bad=>{bad.amountMinor++},
    bad=>{bad.details.giftDetails.donee.tin=bad.details.giftDetails.donor.tin},
    bad=>{bad.details.receiptSnapshot.paymentRemarks='tampered'},
    bad=>{bad.details.lines[0].beneficiary='user2'},
    bad=>{bad.details.receiptSnapshot.payerTin='222222222222'},
  ]){
    const bad=structuredClone(giftPayload);bad.idempotencyKey=randomUUID();
    bad.details.receiptReference='SIM-GIFT-'+bad.idempotencyKey;
    bad.details.receiptSnapshot.challanNo=bad.details.receiptReference;
    mutate(bad);
    const rejected=await request('TAXPAY_SQL','/payments','POST',bad,headers);
    assert.equal(rejected.status,400,'Reject mismatched Gift Tax data before any persistence');
    assert.equal(Number(psql(sourceDb,"SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key="+sqlText(bad.idempotencyKey)+"::uuid;")),0);
    assert.equal(Number(psql(officeDb,"SELECT count(*) FROM demo_payment.story_payments WHERE data->>'idempotencyKey'="+sqlText(bad.idempotencyKey)+";")),0);
  }
  console.log('PASS Gift Tax: exact source/Office SQL parent, capability readback, authorized Office register, remarks, idempotency, notifications and rejected mismatches');

  // Candidate is deliberately not a hosted migration. Apply and exercise it only
  // here, after the loopback/separate-database checks at the start of this harness.
  const giftLineageSql=readFileSync(resolve('scripts/recovery/gift-tax-pay-again-lineage.sql'),'utf8');
  psql(sourceDb,giftLineageSql);
  psql(sourceDb,giftLineageSql); // idempotent definition update
  const newGiftRepeat=(parent=giftId)=>{
    const next=structuredClone(giftPayload);
    next.idempotencyKey=randomUUID();
    next.details.sourcePaymentId=parent;
    const ref='SIM-GIFT-'+next.idempotencyKey;
    next.details.receiptReference=ref;
    Object.assign(next.details.receiptSnapshot,{id:ref,challanNo:ref,gatewayTransactionId:ref,tokenNumber:ref});
    next.details.challanRemarks='Edited repeat remarks: বাংলা';
    next.details.giftDetails.remarks=next.details.challanRemarks;
    next.details.receiptSnapshot.paymentRemarks=next.details.challanRemarks;
    next.details.receiptSnapshot.giftDetails=structuredClone(next.details.giftDetails);
    return next;
  };
  const giftRepeat=newGiftRepeat();
  const giftRepeatResult=await request('TAXPAY_SQL','/payments','POST',giftRepeat,headers);
  assert.equal(giftRepeatResult.status,200,'Gift Tax repeat must reach both disposable SQL projects');
  assert.equal(giftRepeatResult.data.mirrored,true);
  const giftRepeatId=giftRepeatResult.data.id;
  assert.ok(giftRepeatId);
  assert.notEqual(giftRepeatId,giftId);
  const repeatGiftSql="SELECT jsonb_build_object('id',id,'service',service_code,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id="+sqlText(giftRepeatId)+"::uuid;";
  const giftRepeatSource=psql(sourceDb,repeatGiftSql);
  assert.deepEqual(giftRepeatSource.data,giftRepeat);
  assert.deepEqual(psql(officeDb,repeatGiftSql),giftRepeatSource);
  assert.deepEqual(psql(sourceDb,giftSql),giftSource,'Original Gift Tax parent must remain immutable');
  assert.deepEqual(psql(officeDb,giftSql),giftOffice);
  const giftLineage=await request('OFFICE_SQL','/payments/'+giftRepeatId+'/lineage','GET',undefined,{authorization:'Bearer '+officeToken});
  assert.equal(giftLineage.status,200);
  assert.equal(giftLineage.data.data.sourceMirrored,true);
  assert.equal(giftLineage.data.data.sourcePaymentId,giftId);
  assert.equal(giftLineage.data.data.paymentId,giftRepeatId);
  assert.equal(giftLineage.data.data.sourceReceiptReference,giftReference);
  assert.equal(giftLineage.data.data.repeatReceiptReference,giftRepeat.details.receiptReference);
  const giftRepeatReplay=await request('TAXPAY_SQL','/payments','POST',giftRepeat,headers);
  assert.equal(giftRepeatReplay.status,200);
  assert.equal(giftRepeatReplay.data.id,giftRepeatId);
  assert.equal(giftRepeatReplay.data.replayed,true);
  for(const db of [sourceDb,officeDb]){
    assert.equal(Number(psql(db,"SELECT count(*) FROM demo_payment.story_payments WHERE id="+sqlText(giftRepeatId)+"::uuid;")),1);
    assert.equal(Number(psql(db,"SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id="+sqlText(giftRepeatId)+"::uuid;")),1);
  }
  const rejectedGiftRepeats=[
    {payload:newGiftRepeat(randomUUID()),auth:headers},
    {payload:newGiftRepeat(sourceId),auth:headers},
    {payload:newGiftRepeat(null),auth:headers},
    {payload:newGiftRepeat('malformed'),auth:headers},
  ];
  const badToken=newGiftRepeat();badToken.details.receiptSnapshot.tokenNumber='SIMULATION';
  rejectedGiftRepeats.push({payload:badToken,auth:headers});
  const crossPayer=newGiftRepeat();
  crossPayer.sessionId=unrelatedProfile.paymentSessionId;
  crossPayer.details.payerId='user4';
  crossPayer.details.giftDetails.donor={tin:'444444444444',name:'User 4'};
  crossPayer.details.receiptSnapshot.giftDetails=structuredClone(crossPayer.details.giftDetails);
  for(const fields of [crossPayer.details,crossPayer.details.receiptSnapshot]){
    fields.payerTin='444444444444';fields.taxpayerTin='444444444444';fields.taxpayerName='User 4';
  }
  crossPayer.details.lines[0].beneficiary='user4';
  rejectedGiftRepeats.push({payload:crossPayer,auth:{'x-taxpay-guest-capability':unrelatedProfile.capability}});
  for(const {payload:bad,auth} of rejectedGiftRepeats){
    const rejected=await request('TAXPAY_SQL','/payments','POST',bad,auth);
    assert.equal(rejected.status,400,'Invalid Gift Tax repeat must fail before persistence');
    assert.equal(Number(psql(sourceDb,"SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key="+sqlText(bad.idempotencyKey)+"::uuid;")),0);
    assert.equal(Number(psql(officeDb,"SELECT count(*) FROM demo_payment.story_payments WHERE data->>'idempotencyKey'="+sqlText(bad.idempotencyKey)+";")),0);
  }
  console.log('PASS Gift Tax Pay Again: owned source, distinct parent and tokens, Office lineage, immutable original, idempotent retry, six rejected invalid requests');

  const payAgainKey=randomUUID();
  const payAgainAllocationIds=['ws3-pay-again-allocation-2','ws3-pay-again-allocation-3'];
  const payAgainPayload=structuredClone(payload);
  payAgainPayload.idempotencyKey=payAgainKey;
  payAgainPayload.details.sourcePaymentId=sourceId;
  const payAgainRemarks='নতুন চালানের মন্তব্য\nEdited independently for this separate Pay Again record.';
  payAgainPayload.details.paymentRemarks=payAgainRemarks;
  payAgainPayload.details.challanRemarks=payAgainRemarks;
  payAgainPayload.details.receiptReference='SIM-'+payAgainKey;
  payAgainPayload.details.receiptSnapshot.challanNo='SIM-'+payAgainKey;
  payAgainPayload.details.receiptSnapshot.paymentRemarks=payAgainRemarks;
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
  assert.equal(payAgainSource.data.details.challanRemarks,payAgainRemarks,
    'Pay Again must preserve the independently edited remarks on the new parent');
  assert.equal(payAgainSource.data.details.receiptSnapshot.paymentRemarks,payAgainRemarks);
  assert.deepEqual(payAgainSource.data.details.allocations.map(item=>item.allocationId),payAgainAllocationIds);
  const originalAfterPayAgain=psql(sourceDb,`SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`);
  assert.deepEqual(originalAfterPayAgain,sourceRow,'Pay Again must preserve the original Taxpayer parent and allocations');
  assert.equal(originalAfterPayAgain.data.details.challanRemarks,challanRemarks,
    'Editing Pay Again remarks must not mutate the original Taxpayer parent');
  const payAgainOfficeStored=psql(officeDb,`SELECT jsonb_build_object('id',id,'data',data) FROM demo_payment.story_payments WHERE id=${sqlText(payAgainId)}::uuid;`);
  assert.equal(payAgainOfficeStored.id,payAgainId);
  assert.deepEqual(payAgainOfficeStored.data,payAgainSource.data,
    'Separate Office SQL must retain Pay Again parent, source lineage and allocation snapshot');
  assert.equal(payAgainOfficeStored.data.details.challanRemarks,payAgainRemarks,
    'Separate Office SQL must preserve the new Pay Again remarks exactly');
  const payAgainGuardedRemarks=psql(officeDb,[
    'BEGIN;','SET LOCAL ROLE authenticated;',
    `SELECT set_config('request.jwt.claim.sub',${sqlText(officerId)},true);`,
    `SELECT public.payment_v1_office_guarded_challan_remarks(${sqlText(payAgainId)}::uuid);`,
    'COMMIT;'
  ].join('\n'));
  assert.equal(payAgainGuardedRemarks.paymentId,payAgainId);
  assert.equal(payAgainGuardedRemarks.challanRemarks,payAgainRemarks,
    'The Office SQL guard must read the independently edited Pay Again remarks');
  assert.equal(payAgainGuardedRemarks.receiptReference,'SIM-'+payAgainKey);
  const payAgainReadback=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
    {authorization:'Bearer '+officeToken});
  assert.equal(payAgainReadback.status,200);
  const payAgainItem=payAgainReadback.data.data.items.find(item=>item.id===payAgainId);
  assert.ok(payAgainItem,'Authorized Office/Admin readback must return the Pay Again parent');
  assert.equal(payAgainItem.certificateReference,'SK-PC-'+payAgainId);
  assert.equal(payAgainItem.details.sourcePaymentId,sourceId);
  assert.equal(payAgainItem.details.receiptReference,'SIM-'+payAgainKey);
  assert.equal(payAgainItem.details.receiptSnapshot.challanNo,'SIM-'+payAgainKey);
  assert.equal(payAgainItem.details.challanRemarks,payAgainRemarks);
  assert.equal(payAgainItem.details.receiptSnapshot.paymentRemarks,payAgainRemarks);
  assert.deepEqual(payAgainItem.details.allocations.map(item=>item.allocationId),payAgainAllocationIds);
  const payAgainReplay=await request('TAXPAY_SQL','/payments','POST',payAgainPayload,headers);
  assert.equal(payAgainReplay.status,200);
  assert.equal(payAgainReplay.data.id,payAgainId);
  assert.equal(payAgainReplay.data.replayed,true);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=${sqlText(payAgainKey)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(payAgainId)}::uuid;`),1);
  assert.equal(psql(sourceDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(payAgainId)}::uuid;`),1);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=${sqlText(payAgainId)}::uuid;`),1);



  const deniedLineage=await request('OFFICE_SQL',
    '/payments/'+payAgainId+'/lineage');
  assert.equal(deniedLineage.status,401,
    'Office Pay Again source ledger must require an authenticated officer');
  const originalLineage=await request('OFFICE_SQL',
    '/payments/'+payAgainId+'/lineage','GET',undefined,
    {authorization:'Bearer '+officeToken});
  assert.equal(originalLineage.status,200,
    'Existing authorized Office officer must retrieve original Pay Again lineage');
  const lineage=originalLineage.data.data;
  assert.equal(lineage.sourceMirrored,true);
  assert.equal(lineage.paymentId,payAgainId);
  assert.equal(lineage.sourcePaymentId,sourceId);
  assert.equal(lineage.payerId,'user1');
  assert.equal(lineage.sourceReceiptReference,'SIM-'+idempotencyKey);
  assert.equal(lineage.sourceCertificateReference,'SK-PC-'+sourceId);
  assert.equal(lineage.repeatReceiptReference,'SIM-'+payAgainKey);
  assert.equal(lineage.repeatCertificateReference,'SK-PC-'+payAgainId);
  assert.deepEqual(lineage.sourceAllocations.map(a=>a.allocationId),allocationIds);
  assert.deepEqual(lineage.repeatAllocations.map(a=>a.allocationId),payAgainAllocationIds);
  assert.deepEqual(lineage.sourceAllocations.map(a=>a.taxpayerTin),
    ['222222222222','333333333333']);
  assert.deepEqual(lineage.repeatAllocations.map(a=>a.assessmentYear),
    ['2026-27','2025-26']);
  assert.equal(lineage.sourceAmountMinor,'5000');
  assert.equal(lineage.repeatAmountMinor,'5000');

  // P0 Pay Again: protect the original recorded parent and prove a repeat is
  // independently identified. The original allocations remain historically
  // recoverable, while new allocations are distinct and may be user-edited.
  assert.notEqual(payAgainKey,idempotencyKey,'Pay Again idempotency identity must be new');
  assert.equal(payAgainSource.data.details.sourcePaymentId,sourceId);
  assert.deepEqual(payAgainSource.data.details.allocations.map(x=>x.allocationId),payAgainAllocationIds);
  assert.ok(payAgainAllocationIds.every(id=>!allocationIds.includes(id)),
    'Repeat allocations must not reuse immutable source allocation IDs');
  const originalOfficeReadback=payAgainReadback.data.data.items.find(item=>item.id===sourceId);
  assert.ok(originalOfficeReadback,'Officer must retain the historic original payment');
  assert.deepEqual(originalOfficeReadback.details.allocations.map(x=>x.allocationId),allocationIds);
  assert.equal(originalOfficeReadback.details.receiptReference,'SIM-'+idempotencyKey);
  assert.equal(originalOfficeReadback.certificateReference,'SK-PC-'+sourceId);
  assert.notEqual(payAgainItem.certificateReference,originalOfficeReadback.certificateReference);
  assert.notEqual(payAgainItem.details.receiptReference,originalOfficeReadback.details.receiptReference);
  assert.deepEqual(payAgainItem.details.allocations.map(x=>x.allocationId),payAgainAllocationIds);
  assert.deepEqual(payAgainItem.details.allocations.map(x=>x.taxpayerTin),['222222222222','333333333333']);
  assert.deepEqual(payAgainItem.details.allocations.map(x=>x.assessmentYear),['2026-27','2025-26']);
  assert.deepEqual(payAgainItem.details.allocations.map(x=>x.amountMinor),[1500,3500]);

  // Invalid lineage attempts must fail BEFORE they can create a source
  // payment, notification or Office mirror. The retry key is always unique.
  async function rejectRepeat(label,mutate){
    const bad=structuredClone(payAgainPayload);
    const badKey=randomUUID();
    bad.idempotencyKey=badKey;
    bad.details.receiptReference='SIM-'+badKey;
    bad.details.receiptSnapshot.challanNo='SIM-'+badKey;
    mutate(bad);
    const result=await request('TAXPAY_SQL','/payments','POST',bad,headers);
    assert.equal(result.status,400,'Pay Again must reject '+label+': '+JSON.stringify(result.data));
    assert.equal(Number(psql(sourceDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key='+
      sqlText(badKey)+'::uuid;')),0,'Rejected repeat must not persist: '+label);
    assert.equal(Number(psql(sourceDb,
      "SELECT count(*) FROM demo_payment.story_payments WHERE data->>'idempotencyKey'="+
      sqlText(badKey)+';')),0,'Rejected repeat must not create outbox work: '+label);
  }
  await rejectRepeat('missing historical source',bad=>{bad.details.sourcePaymentId=randomUUID();});
  await rejectRepeat('malformed historical source',bad=>{bad.details.sourcePaymentId='not-a-uuid';});
  await rejectRepeat('different payment category',bad=>{bad.details.sourcePaymentId=travelId;});
  await rejectRepeat('reused historical allocation identity',bad=>{
    bad.details.allocations[0].allocationId=allocationIds[0];
    bad.details.receiptSnapshot.allocationItems[0].allocationId=allocationIds[0];
  });
  await rejectRepeat('reused historical receipt',bad=>{
    bad.details.receiptReference='SIM-'+idempotencyKey;
    bad.details.receiptSnapshot.challanNo='SIM-'+idempotencyKey;
  });

  const foreignKey=randomUUID();
  // A second account has a valid exclusive Return parent; cross-owner Pay Again
  // must still fail. Keep this isolation fixture canonical under M04 instead of
  // relaxing the source ownership or Return validation.
  const foreignPayload={
    origin:'TAXPAY_UI',sessionId:unrelatedProfile.paymentSessionId,
    idempotencyKey:foreignKey,service:'TAX_WITH_RETURN',amountMinor:700,
    details:{payerId:'user4',payerName:'Other disposable account',payerMode:'SELF',
      taxpayerTin:'444444444444',payerTin:'444444444444',assessmentYear:'2026-27',
      receiptReference:'SIM-'+foreignKey,
      receiptSnapshot:{challanNo:'SIM-'+foreignKey,totalAmount:7,
        payerTin:'444444444444',taxpayerTin:'444444444444',
        assessmentYear:'2026-27',paymentCategory:'TAX_WITH_RETURN',
        items:[{headId:125,totalAmount:7}]},
      lines:[{beneficiary:'user4',category:'TAX_WITH_RETURN',headId:125,
        assessmentYear:'2026-27',amountMinor:700,totalAmount:7}]}
  };
  const foreignHash=createHash('sha256').update(unrelatedProfile.capability).digest('hex');
  const foreignSource=psql(sourceDb,
    'SELECT public.taxpay_demo_story1_submit('+sqlText(foreignHash)+','+
      sqlJson(foreignPayload)+');');
  assert.ok(foreignSource.id,'Disposable second payer must have its own stored parent');
  await rejectRepeat('another payer account source',bad=>{
    bad.details.sourcePaymentId=foreignSource.id;
  });
  assert.deepEqual(psql(sourceDb,
    "SELECT jsonb_build_object('id',id,'sessionId',session_id,'amountMinor',amount_minor,'status',status,'data',data)"+
    ' FROM demo_payment.story_payments WHERE id='+sqlText(sourceId)+'::uuid;'),
    sourceRow,'Invalid lineage requests must not mutate the historical source');
  assert.equal(Number(psql(officeDb,
    'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(payAgainId)+'::uuid;')),
    1,'Approved new Pay Again must mirror once and only once');
  console.log('PASS P0 Pay Again lineage: same owner/history source, original payer and allocation IDs immutable, fresh repeat transaction/idempotency/receipt/certificate/allocations, separate Office readback, 6 invalid source/reuse attempts rejected before persistence');

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
  // The Work A and F-039 browser acceptance helpers also write Office UI
  // fixtures. Restore the F-178 SQL-backed parent after they finish so the
  // guarded remarks UI test reads this payment ID and the exact SQL value
  // verified above, rather than an unrelated payment without remarks.
  writeFileSync(officeUiFixtureOut,JSON.stringify(officeUiFixture),{mode:0o600});
  const finalOfficeUiFixture=JSON.parse(readFileSync(officeUiFixtureOut,'utf8'));
  assert.equal(finalOfficeUiFixture.payment.id,sourceId,
    'The Office UI must receive the same F-178 Taxpayer/Office SQL parent');
  assert.equal(finalOfficeUiFixture.expected.challanRemarks,challanRemarks,
    'The final Office UI fixture must retain the exact guarded SQL remarks');
  console.log('PASS: separate disposable Taxpayer and Office SQL through existing Edge handlers; combined multi-recipient v3 allocations, distinct Pay Again parent lineage and separate Travel Tax passengers, exact amounts/years/heads, payer, receipt/certificate, authorized readback and passport redaction, recipient notice isolation, Office outage recovery, idempotent replay/conflict immutability, and single source/Office notices');
}finally{
  await Promise.all([taxpayerServer,officeServer,recipientServer].map(server=>new Promise(resolve=>server.close(resolve))));
}
