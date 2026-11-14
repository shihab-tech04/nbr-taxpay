/**
 * Runs the current Taxpayer and Office payment Edge handlers over real, separate
 * disposable SQL databases. Only the Supabase client transport is adapted:
 * every RPC is executed by psql against the local databases and the handlers
 * still exchange the existing signed HTTP requests. No hosted URL is contacted.
 */
import assert from 'node:assert/strict';
import {createHash,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
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
const officerId=randomUUID();
const officeToken='ws3-disposable-authorized-office-session';
const servers={};
const officeFailure={next:true};

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

const roleSetup=[
  'BEGIN;',
  `INSERT INTO auth.users(id,email) VALUES(${sqlText(officerId)}::uuid,${sqlText('ws3-'+officerId+'@example.invalid')});`,
  "INSERT INTO payment_sync.settings(singleton,origin) VALUES(true,'OFFICE_SQL') ON CONFLICT(singleton) DO UPDATE SET origin=excluded.origin;",
  `INSERT INTO payment_sync.officer_roles(user_uid,role,active) VALUES(${sqlText(officerId)}::uuid,'MAKER',true);`,
  'COMMIT;',
].join('\n');
psql(officeDb,roleSetup);

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
  assert.equal(history.data.data.idempotencyKey,idempotencyKey);
  assert.deepEqual(history.data.data.details.allocations,allocations);

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

  const replay=await request('TAXPAY_SQL','/payments','POST',payload,headers);
  assert.equal(replay.status,200);
  assert.equal(replay.data.id,sourceId);
  assert.equal(replay.data.replayed,true);
  assert.equal(psql(officeDb,`SELECT count(*) FROM demo_payment.story_payments WHERE id=${sqlText(sourceId)}::uuid;`),1,
    'Office replay must remain a single immutable parent');
  console.log('PASS: Taxpayer/Office Edge handlers over separate disposable SQL DBs; multi-recipient v3 parent and allocation readback, exact amounts/AYs/heads, payer, receipt/certificate, payer history, authorized Office readback, recipient-notice API isolation/ack replay, Office outage recovery, same-key replay, and single source/Office payment notice');
}finally{
  await Promise.all([taxpayerServer,officeServer,recipientServer].map(server=>new Promise(resolve=>server.close(resolve))));
}
