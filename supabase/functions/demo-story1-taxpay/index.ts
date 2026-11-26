import {acceptPaymentRequestSize,MAX_COMBINED_PAYMENT_PAYLOAD_CHARS,officeMirrorIdentity} from "./combinedPaymentRequest.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {createOfficeMirrorProof,verifyOfficeMirrorProof,createOfficeAuthorizationProof,verifyOfficeAuthorizationProof} from "./mirrorProof.ts";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,authorization,apikey,x-taxpay-guest-capability","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const capabilityPattern=/^[A-Za-z0-9_-]{43}$/;
const encoder=new TextEncoder();
async function capabilityHash(request:Request):Promise<string|null>{
 const token=request.headers.get("x-taxpay-guest-capability");
 if(token===null)return null;
 if(!capabilityPattern.test(token))throw Error("INVALID_PROFILE_CAPABILITY");
 const digest=await crypto.subtle.digest("SHA-256",encoder.encode(token));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
function serviceCredential():string {
 const configured=Deno.env.get("SUPABASE_SECRET_KEYS");
 const secret=(configured&&(JSON.parse(configured) as Record<string,string>).default)||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!secret)throw Error("PROFILE_SERVICE_UNAVAILABLE");
 return secret;
}
function serviceClient(url:string){
 return createClient(url,serviceCredential(),{auth:{persistSession:false,autoRefreshToken:false}});
}
async function verifiedDemoAuthorizationActor(req:Request,url:string,actor:unknown):Promise<boolean>{
 if(typeof actor!=="string"||!/^user([1-9]|[12][0-9]|30)$/.test(actor))return false;
 let hash:string|null=null;
 try{hash=await capabilityHash(req);}catch{return false;}
 if(!hash)return false;
 const {data,error}=await serviceClient(url).rpc("taxpay_demo_authorization_actor",{p_capability_hash:hash});
 return !error&&data===actor;
}
// The source selector is derived only from the server's configured Supabase URL.
// Office verifies a separate payment+session-bound proof at that exact source.
function officeMirrorSource(url:string):'original'|'v2'{
 const origin=new URL(url).origin;
 if(origin==='https://gmuhitmaynfhipcvbvkh.supabase.co')return 'v2';
 if(origin==='https://eyqhoavnitkrajvyqvxn.supabase.co')return 'original';
 throw Error('UNRECOGNIZED_TAXPAY_SOURCE');
}
const office="https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office/mirror";
const officeAuthorization="https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office/authorization/mirror";
const v2Origin='https://gmuhitmaynfhipcvbvkh.supabase.co';
const correctionOfficeEndpoint='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/payment-sync-bridge';
const originalOrigin='https://eyqhoavnitkrajvyqvxn.supabase.co';
async function correctionKey(url:string,admin:ReturnType<typeof serviceClient>){
 const origin=new URL(url).origin;
 let secret:unknown;
 if(origin===v2Origin){
  const {data,error}=await admin.rpc('payment_v1_demo_correction_key');
  if(error)return null;secret=data;
 }else if(origin===originalOrigin){
  // Reuse only the already enabled original↔Office HMAC contract.
  const {data,error}=await admin.rpc('payment_v1_internal_bridge_config');
  if(error||data?.enabled!==true||data.origin!=='TAXPAY_SQL'||data.selfUrl!==originalOrigin+'/functions/v1/payment-sync-bridge'||data.peerUrl!==correctionOfficeEndpoint)return null;
  secret=data.signingKey;
 }else return null;
 if(typeof secret!=='string'||!/^[0-9a-f]{64}$/.test(secret))return null;
 return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,s=>parseInt(s,16)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function deliverCorrections(url:string,admin:ReturnType<typeof serviceClient>,id:string|null=null){
 const origin=new URL(url).origin;
 if(origin!==v2Origin&&origin!==originalOrigin)return {claimed:0,acknowledged:0,failed:0};
 const source=origin===v2Origin?'v2':'original';
 const key=await correctionKey(url,admin);
 if(!key)return {claimed:0,acknowledged:0,failed:0};
 const {data,error}=await admin.rpc(source==='v2'?'taxpay_demo_correction_claim':'taxpay_demo_original_report_claim',{p_limit:id?1:20,p_id:id});
 if(error||!Array.isArray(data))throw Error('CORRECTION_CLAIM_FAILED');
 let acknowledged=0,failed=0;
 for(let offset=0;offset<data.length;offset+=5){
  await Promise.all(data.slice(offset,offset+5).map(async item=>{
   let okay=false;
   try{
    if(item.event?.sourceProject!==source||source==='original'&&item.event?.payload?.caseKind!=='UNSOLICITED_PAYMENT_REPORT')throw Error('CORRECTION_SOURCE_MISMATCH');
    const eventText=JSON.stringify(item.event);
    const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(eventText))),x=>x.toString(16).padStart(2,'0')).join('');
    const response=await fetch(correctionOfficeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({mode:'ingestDemoCorrection',eventText,signature}),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    okay=response.ok&&result?.stored===true&&result.eventId===item.event.eventId&&result.requestId===item.event.requestId;
   }catch{/* A durable pending request is retried by reconciliation. */}
   const ack=await admin.rpc('taxpay_demo_correction_ack',{p_id:item.event.requestId,p_claim_token:item.claimToken,p_success:okay});
   if(ack.error||ack.data!==true)throw Error('CORRECTION_ACK_FAILED');
   if(okay)acknowledged++;else failed++;
  }));
 }
 return {claimed:data.length,acknowledged,failed};
}
async function mirrorAuthorization(id:string,sourceUrl:string){
 const proof=await createOfficeAuthorizationProof(serviceCredential(),id);
 const res=await fetch(officeAuthorization,{method:"POST",headers:{"Content-Type":"application/json",
  "x-taxpay-office-authorization-proof":proof},
  body:JSON.stringify({id,sourceProject:officeMirrorSource(sourceUrl)}),signal:AbortSignal.timeout(10000)});
 const receipt=await res.json();
 return res.ok&&receipt.success&&receipt.data?.id===id;
}
type MirrorClaim={type:"PAYMENT"|"AUTHORIZATION";id:string;claimToken:string;sessionId?:string|null};
async function reconcileMirrors(url:string,serviceKey:string){
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.rpc("demo_story1_mirror_claim",{p_limit:20});
 if(error)throw Error("MIRROR_CLAIM_FAILED: "+error.message);
 const claimed=data as MirrorClaim[];
 if(!Array.isArray(claimed))throw Error("MIRROR_CLAIM_INVALID");
 let acknowledged=0,failed=0;
 // Bound concurrency so a single outage does not overload either project.
 for(let offset=0;offset<claimed.length;offset+=5){
  await Promise.all(claimed.slice(offset,offset+5).map(async item=>{
   let okay=false,reason="DELIVERY_FAILED";
   try{
    if(item.type==="AUTHORIZATION"){
     okay=await mirrorAuthorization(item.id,url);
    }else if(item.type==="PAYMENT"&&item.sessionId){
     const proof=await createOfficeMirrorProof(serviceKey,item.id,item.sessionId);
     const response=await fetch(office,{method:"POST",headers:{"Content-Type":"application/json",
       "x-taxpay-office-mirror-proof":proof},
      body:JSON.stringify({id:item.id,sessionId:item.sessionId,sourceProject:officeMirrorSource(url)}),signal:AbortSignal.timeout(10000)});
     const result=await response.json();
     okay=response.ok&&result.success===true&&result.data?.id===item.id;
    }
    if(!okay)reason="OFFICE_MIRROR_NOT_ACKNOWLEDGED";
   }catch(e){reason=e instanceof Error?e.message:"DELIVERY_FAILED";}
   const {data:finished,error:finishError}=await admin.rpc("demo_story1_mirror_finish",{
    p_type:item.type,p_id:item.id,p_claim_token:item.claimToken,
    p_success:okay,p_error:okay?null:reason.slice(0,250)
   });
   if(finishError||finished!==true)throw Error("MIRROR_ACK_FAILED");
   if(okay)acknowledged++;else failed++;
  }));
 }
 return {claimed:claimed.length,acknowledged,failed,simulationOnly:true};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 const u=new URL(req.url),path=u.pathname.replace(/^\/demo-story1-taxpay/,"");
 const key=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),url=Deno.env.get("SUPABASE_URL");
 if(!key||!url)return respond({success:false,error:"BACKEND_UNAVAILABLE"},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(path==='/corrections/office-decision'&&req.method==='POST'){
   const origin=new URL(url).origin;
   if(origin!==v2Origin&&origin!==originalOrigin)return respond({error:'INVALID_CORRECTION_ROUTE'},403);
   const source=origin===v2Origin?'v2':'original';
   const raw=await req.text();
   if(raw.length>24000)return respond({error:'INVALID_CORRECTION_COMMAND'},400);
   let input:Record<string,unknown>;
   try{input=JSON.parse(raw);}catch{return respond({error:'INVALID_CORRECTION_COMMAND'},400);}
   if(input?.mode!=='ingest'||typeof input.commandText!=='string'||typeof input.signature!=='string'||
      !/^[0-9a-f]{64}$/.test(input.signature))return respond({error:'INVALID_CORRECTION_COMMAND'},400);
   const admin=serviceClient(url),secret=await correctionKey(url,admin);
   if(!secret||!await crypto.subtle.verify('HMAC',secret,Uint8Array.from(input.signature.match(/../g)!,s=>parseInt(s,16)),encoder.encode(input.commandText)))
     return respond({error:'UNAUTHORIZED_CORRECTION_COMMAND'},401);
   const command=JSON.parse(input.commandText);
   if(command?.sourceProject!==source||source==='original'&&command?.commandType!=='CORRECTION_REVIEW')return respond({error:'INVALID_CORRECTION_ROUTE'},403);
   const initiation=command?.commandType==='OFFICE_CORRECTION_INITIATED';
   const {data,error}=await admin.rpc(initiation?'taxpay_demo_correction_office_initiation':'taxpay_demo_correction_office_decision',{p_command:command});
   if(error)return respond({error:'CORRECTION_DECISION_NOT_ACCEPTED'},409);
   if(initiation&&data?.stored===true)try{await deliverCorrections(url,admin,command.requestId);}catch{/* existing durable reconciler retries */}
   return respond(data);
  }
  if(path==="/corrections/notices"&&(req.method==="GET"||req.method==="POST")){
   const p_capability_hash=await capabilityHash(req);
   if(!p_capability_hash)return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},401);
   const admin=serviceClient(url);
   if(req.method==="GET"){
    const p_limit=Number(u.searchParams.get("limit")??"100"),p_offset=Number(u.searchParams.get("offset")??"0");
    if(!Number.isSafeInteger(p_limit)||p_limit<1||p_limit>100||!Number.isSafeInteger(p_offset)||p_offset<0||p_offset>1000000)return respond({success:false,error:"INVALID_NOTICE_PAGE"},400);
    const {data,error}=await admin.rpc("taxpay_demo_correction_notices",{p_capability_hash,p_limit,p_offset});
    return error?respond({success:false,error:"CORRECTION_NOTICES_UNAVAILABLE"},503):respond({success:true,data,simulationOnly:true});
   }
   const raw=await req.text();
   if(raw.length>1000)return respond({success:false,error:"INVALID_NOTICE"},400);
   let input;try{input=JSON.parse(raw);}catch{return respond({success:false,error:"INVALID_NOTICE"},400);}
   if(typeof input?.eventId!=="string"||!/^(submitted|office|decision):[0-9a-f-]{36}$/i.test(input.eventId))return respond({success:false,error:"INVALID_NOTICE"},400);
   const {data,error}=await admin.rpc("taxpay_demo_correction_notice_read",{p_capability_hash,p_event_id:input.eventId});
   return error?respond({success:false,error:"CORRECTION_NOTICE_NOT_AVAILABLE"},403):respond({success:true,data,simulationOnly:true});
  }
  if(path==="/corrections"&&(req.method==="GET"||req.method==="POST")){
   const p_capability_hash=await capabilityHash(req);
   if(!p_capability_hash)return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},401);
   const admin=serviceClient(url);
   if(req.method==="GET"){
    const p_limit=Number(u.searchParams.get("limit")??"100");
    const p_offset=Number(u.searchParams.get("offset")??"0");
    if(!Number.isSafeInteger(p_limit)||p_limit<1||p_limit>100||!Number.isSafeInteger(p_offset)||p_offset<0||p_offset>1000000)
     return respond({success:false,error:"INVALID_CORRECTION_PAGE"},400);
    const {data,error}=await admin.rpc("taxpay_demo_correction_list",{p_capability_hash,p_limit,p_offset});
    if(error)return respond({success:false,error:"CORRECTION_HISTORY_UNAVAILABLE"},503);
    return respond({success:true,data,simulationOnly:true});
   }
   const raw=await req.text();
   if(raw.length>12000)return respond({success:false,error:"INVALID_CORRECTION_REQUEST"},400);
   let input:Record<string,unknown>;
   try{input=JSON.parse(raw);}catch{return respond({success:false,error:"INVALID_CORRECTION_REQUEST"},400);}
   if(!input||typeof input!=="object"||Array.isArray(input)||typeof input.requestKey!=="string"||!uuid.test(input.requestKey))
    return respond({success:false,error:"INVALID_CORRECTION_REQUEST"},400);
   const report=input.caseKind==='UNSOLICITED_PAYMENT_REPORT';
   if(report&&(typeof input.eventId!=='string'||typeof input.reason!=='string'))return respond({success:false,error:'INVALID_CORRECTION_REQUEST'},400);
   const historical=input.paymentId===null&&typeof input.historicalReference==="string"&&/^DEMO-[A-Z0-9-]{3,70}$/.test(input.historicalReference);
   if(!report&&!historical&&(typeof input.paymentId!=="string"||!uuid.test(input.paymentId)||input.historicalReference!==undefined))
    return respond({success:false,error:"INVALID_CORRECTION_REQUEST"},400);
   const {data,error}=report?await admin.rpc('taxpay_demo_received_payment_report_save',{p_capability_hash,p_event_id:input.eventId,p_request_key:input.requestKey,p_reason:input.reason}):historical
     ?await admin.rpc("taxpay_demo_historical_correction_save",{p_capability_hash,p_reference:input.historicalReference,p_request_key:input.requestKey,p_input:input})
     :await admin.rpc("taxpay_demo_correction_save",{p_capability_hash,p_payment_id:input.paymentId,p_request_key:input.requestKey,p_input:input});
   if(error){
    const code=error.message??"";
    if(/INVALID_CORRECTION|CORRECTION_NO_CHANGE/.test(code))return respond({success:false,error:"INVALID_CORRECTION_REQUEST"},400);
    if(/CORRECTION_REQUEST_CONFLICT/.test(code))return respond({success:false,error:"CORRECTION_REQUEST_CONFLICT"},409);
    if(/NOT_FOUND|INVALID_DEMO_PROFILE|INVALID_PROFILE_CAPABILITY|GUEST_SESSION_UNAVAILABLE|CORRECTION_PAYMENT_UNAVAILABLE/.test(code))
     return respond({success:false,error:"CORRECTION_PAYMENT_UNAVAILABLE"},403);
    return respond({success:false,error:"CORRECTION_SAVE_UNAVAILABLE"},503);
   }
   // The local request is already durable. Attempt only its exact Office
   // delivery, and report pending rather than pretending an ACK on failure.
   try{
    await deliverCorrections(url,admin,data.id);
    const refreshed=await admin.rpc('taxpay_demo_correction_get',{p_id:data.id});
    if(!refreshed.error&&refreshed.data?.id===data.id)return respond({success:true,data:refreshed.data,simulationOnly:true});
   }catch{/* the scheduled reconciler retries the immutable event */}
   return respond({success:true,data,simulationOnly:true});
  }
  if(req.method==="GET"&&path==="/profile-history"){
   const p_capability_hash=await capabilityHash(req);
   if(!p_capability_hash)return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},401);
   const view=u.searchParams.get("view");
   const pageSize=Number(u.searchParams.get("pageSize")??"100");
   const beforeCreatedAt=u.searchParams.get("beforeCreatedAt");
   const beforeId=u.searchParams.get("beforeId");
   if((view!=="payer"&&view!=="beneficiary")||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||
      Boolean(beforeCreatedAt)!==Boolean(beforeId)||
      beforeCreatedAt!==null&&!Number.isFinite(Date.parse(beforeCreatedAt))||
      beforeId!==null&&!uuid.test(beforeId))return respond({success:false,error:"INVALID_HISTORY_CURSOR"},400);
   const {data,error}=await serviceClient(url).rpc("taxpay_demo_story1_history_page",{
    p_capability_hash,p_view:view,p_before_created_at:beforeCreatedAt,
    p_before_id:beforeId,p_page_size:pageSize
   });
   if(error){console.error("Profile payment history",error.message);return respond({success:false,error:"PAYMENT_HISTORY_UNAVAILABLE"},503);}
   return respond({success:true,data,simulationOnly:true});
  }
  if(req.method==="POST"&&path==="/sync/reconcile"){
   const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
   if(!serviceKey)return respond({success:false,error:"BACKEND_UNAVAILABLE"},503);
   let authorized=req.headers.get("Authorization")==="Bearer "+serviceKey;
   // The existing private SQL bridge token allows a credential-free cron job
   // definition: pg_net looks up the current token at runtime inside SQL.
   if(!authorized){
    const dispatch=req.headers.get("X-Dispatch-Token");
    if(dispatch){
     const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
     const {data:config,error:configError}=await admin.rpc("payment_v1_internal_bridge_config");
     // V2's payment_v1/Office command bridge remains disabled. The dedicated
     // simulation-only Story 1 mirror may still use its private dispatch token
     // when BOTH fixed project identities match the approved pair. This does
     // not enable financial bridge events, user-auth bypass or arbitrary hosts.
     const simulationOnlyDispatch=!configError&&
       officeMirrorSource(url)==='v2'&&config?.enabled===false&&
       config.origin==='TAXPAY_SQL'&&
       config.selfUrl==='https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/payment-sync-bridge'&&
       config.peerUrl==='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/payment-sync-bridge';
     authorized=!configError&&typeof config?.dispatchToken==="string"&&
       dispatch===config.dispatchToken&&
       (config.enabled===true||simulationOnlyDispatch);
    }
   }
   if(!authorized)return respond({success:false,error:"SERVICE_ROLE_REQUIRED"},401);
   try{
    const mirrors=await reconcileMirrors(url,serviceKey);
    const corrections=await deliverCorrections(url,serviceClient(url)).catch(()=>({claimed:0,acknowledged:0,failed:1}));
    return respond({success:true,data:{...mirrors,corrections}});
   }
   catch(e){console.error("Story1 reconciliation",e);return respond({success:false,error:"MIRROR_RECONCILIATION_FAILED"},503);}
  }
  if(req.method==="GET"&&path==="/authorizations"){
   const actor=u.searchParams.get("actor");
   if(!await verifiedDemoAuthorizationActor(req,url,actor))
     return respond({success:false,error:"AUTHORIZATION_ACTOR_NOT_VERIFIED"},403);
   const {data,error}=await serviceClient(url).rpc("demo_auth_list",{p_actor:actor});
   if(error)return respond({success:false,error:"AUTHORIZATION_READ_FAILED"},503);
   return respond({success:true,data,simulationOnly:true});
  }
  const snapshotPath=path.match(new RegExp("^/authorizations/([0-9a-fA-F-]{36})/snapshot$"));
  if(req.method==="GET"&&snapshotPath&&uuid.test(snapshotPath[1])){
   // This snapshot is for the Office mirror, not a public UUID lookup.
   // Validate a distinct, 120-second signed proof BEFORE invoking privileged SQL.
   const proof=req.headers.get("x-taxpay-office-authorization-proof")??"";
   if(!await verifyOfficeAuthorizationProof(serviceCredential(),snapshotPath[1],proof))
     return respond({success:false,error:"UNAUTHORIZED_AUTHORIZATION_MIRROR_PROOF"},403);
   const {data,error}=await serviceClient(url).rpc("demo_auth_public_snapshot",{p_request:snapshotPath[1]});
   if(error)return respond({success:false,error:"REQUEST_NOT_FOUND"},404);
   return respond({success:true,data,simulationOnly:true});
  }
  if(req.method==="POST"&&(path==="/authorizations"||path==="/authorizations/sync")){
   const raw=await req.text();if(raw.length>1000)return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
   const input=JSON.parse(raw),action=path.endsWith("/sync")?"sync":input.action;
   // Neither an actor label nor a UUID provides access to a consent record.
   if(!await verifiedDemoAuthorizationActor(req,url,input.actor))
     return respond({success:false,error:"AUTHORIZATION_ACTOR_NOT_VERIFIED"},403);
   let result:{id:string;status:string;consentCode?:string|null;attempts?:number};
   if(action==="sync"){
    if(!uuid.test(input.id))return respond({success:false,error:"INVALID_ID"},400);
    const check=await serviceClient(url).rpc("demo_auth_public_snapshot",{p_request:input.id});
    if(check.error)return respond({success:false,error:"REQUEST_NOT_FOUND"},404);
    if(check.data?.payerId!==input.actor&&check.data?.taxpayerId!==input.actor)
      return respond({success:false,error:"AUTHORIZATION_ACTOR_NOT_VERIFIED"},403);
    result=check.data;
   }else{
    if(!["request","accept","confirm","decline","revoke","resend","delete"].includes(action)||
       !/^user([1-9]|[12][0-9]|30)$/.test(input.actor??""))
      return respond({success:false,error:"INVALID_AUTHORIZATION_ACTION"},400);
    const {data,error}=await serviceClient(url).rpc("demo_auth_transition",{
     p_action:action,p_actor:input.actor,p_request:input.id??null,
     p_target_tin:input.tin??null,p_code:input.code??null
    });
    if(error)return respond({success:false,error:error.message},409);
    result=data;
   }
   try{if(!await mirrorAuthorization(result.id,url))throw Error("OFFICE_AUTHORIZATION_MIRROR_FAILED");}
   catch(e){
    console.error("Authorization mirror pending",e);
    return respond({success:false,error:"OFFICE_SYNC_PENDING",requestId:result.id,retryable:true},503);
   }
   // Public retry needs only an acknowledgement. Never return a private
   // authorization snapshot to a caller who merely knows its request UUID.
   const returned=action==="sync"?{id:result.id}:result;
   return respond({success:true,data:returned,mirrored:true,simulationOnly:true});
  }
  if(req.method==="POST"&&path==="/payments"){
    const raw=await req.text();
    // Match the canonical combined-payment SQL contract; keep legacy services capped.
    if(raw.length>MAX_COMBINED_PAYMENT_PAYLOAD_CHARS)return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
    const body=JSON.parse(raw);
    if(!acceptPaymentRequestSize(raw.length,body))return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
    const p_capability_hash=await capabilityHash(req);
    const client=p_capability_hash?serviceClient(url):db;
    const initiated=body?.origin==='TAXPAY_UI'
      ?(p_capability_hash
        ?await client.rpc('taxpay_demo_story1_initiate',{p_capability_hash,p_input:body})
        :await client.rpc('demo_story1_initiate',{p_input:body}))
      :null;
    // Stage and completion are separate SQL transactions. A lost connection
    // leaves a durable initiated event; the same key resumes without replay.
    const {data,error}=initiated?.error?initiated:p_capability_hash
      ?await client.rpc("taxpay_demo_story1_submit",{p_capability_hash,p_input:body})
      :await client.rpc("demo_story1_submit",{p_input:body});
    if(error){
      console.error("TaxPay simulation submit",error.message);
      if(error.message?.includes("LEGACY_SESSION_READ_ONLY"))
        return respond({success:false,error:"LEGACY_SESSION_READ_ONLY"},409);
      if(error.message?.includes("PROFILE_CAPABILITY_REQUIRED")||error.message?.includes("PROFILE_PAYMENT_SCOPE_MISMATCH"))
        return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},403);
      // Expose only these non-sensitive, permanent field-validation codes.
      // Never echo raw Postgres errors, payer names, TINs or SQL diagnostics.
      const payerRejections=["INVALID_WALKIN_PAYER_TIN","UNMATCHED_WALKIN_PAYER_TIN","UNCONFIRMED_WALKIN_PAYER"] as const;
      const payerReject=payerRejections.find(code=>error.message?.includes(code));
      if(payerReject)return respond({success:false,error:payerReject,retryable:false},422);
      return respond({success:false,error:"SUBMISSION_FAILED"},400);
    }
    // Office independently reads the SQL record using the signed proof. Send only
    // identifiers so a large combined request never trips Office's 16k edge gate.
    const out=officeMirrorIdentity(data.id,body.sessionId);
    try{
      // Sign only after TaxPay SQL has returned a durable, idempotent payment ID.
      // No client profile capability or service credential crosses to Office.
      const proof=await createOfficeMirrorProof(serviceCredential(),data.id,body.sessionId);
      const res=await fetch(office,{method:"POST",headers:{"Content-Type":"application/json",
        "x-taxpay-office-mirror-proof":proof},body:JSON.stringify({...out,sourceProject:officeMirrorSource(url)}),signal:AbortSignal.timeout(10000)});
      const receipt=await res.json();
      if(!res.ok||!receipt.success||receipt.data?.id!==data.id)throw Error("OFFICE_MIRROR_NOT_ACKNOWLEDGED");
      return respond({success:true,id:data.id,status:"SIMULATED_SUCCESS",mirrored:true,replayed:data.replayed,simulationOnly:true});
    }catch(e){console.error("Office mirror pending",e);return respond({success:false,error:"OFFICE_SYNC_PENDING",requestId:data.id,retryable:true,simulationOnly:true},503);}
  }
  // Office verification is an independent server-to-server capability: unlike
  // the retired public session read, this signed 120-second proof can only be
  // minted by TaxPay Edge after SQL has acknowledged a synthetic payment.
  // Readback is service-role only and never makes private profile data public.
  const proof=req.headers.get("x-taxpay-office-mirror-proof");
  if(proof!==null){
   const m=path.match(/^\/payments\/([0-9a-fA-F-]{36})$/);
   const session=u.searchParams.get("sessionId");
   if(req.method!=="GET"||!m||!uuid.test(m[1])||!session||!uuid.test(session))
     return respond({success:false,error:"NOT_FOUND"},404);
   if(!await verifyOfficeMirrorProof(serviceCredential(),m[1],session,proof))
     return respond({success:false,error:"UNAUTHORIZED_MIRROR_PROOF"},403);
   const {data,error}=await serviceClient(url).rpc("taxpay_office_story1_mirror_read",{p_id:m[1],p_session:session});
   if(error||data?.id!==m[1]||data?.status!=="SIMULATED_SUCCESS")
     return respond({success:false,error:"SOURCE_RECORD_NOT_FOUND"},404);
   return respond({success:true,data,simulationOnly:true});
  }
  // A refresh-safe original SQL lookup for an *existing approved profile*
  // capability. Public references and receipt mobiles are identifiers only:
  // they are never substitutes for an active possession capability.
  if(req.method==="GET"&&path==="/payments/reference"){
   const p_capability_hash=await capabilityHash(req);
   if(!p_capability_hash)
     return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},401);
   const p_reference=u.searchParams.get("reference");
   const p_receipt_mobile=u.searchParams.get("receiptMobile");
   if(!p_reference||p_reference.length>200||!p_reference.trim()||
     (p_receipt_mobile!==null&&p_receipt_mobile!==""&&!/^01[0-9]{9}$/.test(p_receipt_mobile)))
     return respond({success:false,error:"INVALID_REFERENCE"},400);
   const {data,error}=await serviceClient(url).rpc("taxpay_demo_story1_reference_payment",{
    p_capability_hash,p_reference,p_receipt_mobile
   });
   if(error){
    if(/GUEST_SESSION_UNAVAILABLE|INVALID_CAPABILITY|INVALID_DEMO_PROFILE/.test(error.message??""))
     return respond({success:false,error:"PROFILE_CAPABILITY_UNAVAILABLE"},403);
    if(/INVALID_REFERENCE|INVALID_RECEIPT_MOBILE/.test(error.message??""))
     return respond({success:false,error:"INVALID_REFERENCE"},400);
    // Never turn a SQL outage or ambiguous reference into a false missing row.
    return respond({success:false,error:"PAYMENT_LOOKUP_UNAVAILABLE"},503);
   }
   if(data===null)return respond({success:false,error:"NOT_FOUND"},404);
   if(!data||typeof data!=="object"||!uuid.test(data.id)||data.status!=="SIMULATED_SUCCESS")
     return respond({success:false,error:"PAYMENT_LOOKUP_UNAVAILABLE"},503);
   return respond({success:true,data,simulationOnly:true});
  }
  let rpc:string,args:Record<string,unknown>;
  if(req.method==="GET"&&path==="/payments"){
    const session=u.searchParams.get("sessionId");if(!session||!uuid.test(session))return respond({success:false,error:"INVALID_SESSION"},400);
    if(u.searchParams.has("page")||u.searchParams.has("perPage")){
      const page=Number(u.searchParams.get("page")??"1");
      const size=Number(u.searchParams.get("perPage")??"100");
      if(!Number.isSafeInteger(page)||!Number.isSafeInteger(size)||page<1||page>10000||size<1||size>100)
        return respond({success:false,error:"INVALID_PAGE"},400);
      rpc="demo_story1_list_page";args={p_session:session,p_page:page,p_per_page:size};
    }else{
      // Original array contract remains unchanged for existing clients.
      rpc="demo_story1_list";args={p_session:session};
    }
  }else if(req.method==="GET"&&path==="/notifications"){
    const session=u.searchParams.get("sessionId");if(!session||!uuid.test(session))return respond({success:false,error:"INVALID_SESSION"},400);
    rpc="demo_story1_notices";args={p_session:session};
  }else{
    const m=path.match(/^\/payments\/([0-9a-fA-F-]{36})$/),session=u.searchParams.get("sessionId");
    if(req.method!=="GET"||!m||!uuid.test(m[1])||!session||!uuid.test(session))return respond({success:false,error:"NOT_FOUND"},404);
    rpc="demo_story1_get";args={p_id:m[1],p_session:session};
  }
  const p_capability_hash=await capabilityHash(req);
  if(p_capability_hash){
   const admin=serviceClient(url);
   if(req.method==="GET"&&path==="/payments"){
    const page=Number(u.searchParams.get("page")??"1");
    const size=Number(u.searchParams.get("perPage")??"100");
    const {data,error}=await admin.rpc("taxpay_demo_story1_session_payments",{
     p_capability_hash,p_page:page,p_per_page:size
    });
    if(error)return respond({success:false,error:"PAYMENT_HISTORY_UNAVAILABLE"},503);
    return respond({success:true,data:u.searchParams.has("page")||u.searchParams.has("perPage")?data:data.items,simulationOnly:true});
   }
   if(req.method==="GET"&&path==="/notifications"){
    const {data,error}=await admin.rpc("taxpay_demo_story1_session_notices",{p_capability_hash});
    if(error)return respond({success:false,error:"NOTIFICATION_HISTORY_UNAVAILABLE"},503);
    return respond({success:true,data,simulationOnly:true});
   }
   if(req.method==="GET"&&/^\/payments\/[0-9a-fA-F-]{36}$/.test(path)){
    const paymentId=path.split("/").pop();
    const {data,error}=await admin.rpc("taxpay_demo_story1_session_payment",{
     p_capability_hash,p_payment_id:paymentId
    });
    if(error)return respond({success:false,error:"NOT_FOUND"},404);
    return respond({success:true,data,simulationOnly:true});
   }
  }
  const {data,error}=await db.rpc(rpc,args);
  if(error)return respond({success:false,error:"NOT_FOUND"},404);
  return respond({success:true,data,simulationOnly:true});
 }catch(e){console.error("TaxPay simulated request",e);return respond({success:false,error:"INVALID_INPUT"},400);}
});
