import {acceptPaymentRequestSize,MAX_COMBINED_PAYMENT_PAYLOAD_CHARS,officeMirrorIdentity} from "./combinedPaymentRequest.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {createOfficeMirrorProof,verifyOfficeMirrorProof} from "./mirrorProof.ts";
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
const office="https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office/mirror";
const officeAuthorization="https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office/authorization/mirror";
async function mirrorAuthorization(id:string){
 const res=await fetch(officeAuthorization,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});
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
     okay=await mirrorAuthorization(item.id);
    }else if(item.type==="PAYMENT"&&item.sessionId){
     const proof=await createOfficeMirrorProof(serviceKey,item.id,item.sessionId);
     const response=await fetch(office,{method:"POST",headers:{"Content-Type":"application/json",
       "x-taxpay-office-mirror-proof":proof},
      body:JSON.stringify({id:item.id,sessionId:item.sessionId}),signal:AbortSignal.timeout(10000)});
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
     authorized=!configError&&config?.enabled===true&&
      typeof config.dispatchToken==="string"&&dispatch===config.dispatchToken;
    }
   }
   if(!authorized)return respond({success:false,error:"SERVICE_ROLE_REQUIRED"},401);
   try{return respond({success:true,data:await reconcileMirrors(url,serviceKey)});}
   catch(e){console.error("Story1 reconciliation",e);return respond({success:false,error:"MIRROR_RECONCILIATION_FAILED"},503);}
  }
  if(req.method==="GET"&&path==="/authorizations"){
   const actor=u.searchParams.get("actor");
   if(!actor||!/^user([1-9]|10)$/.test(actor))return respond({success:false,error:"INVALID_DEMO_USER"},400);
   const {data,error}=await db.rpc("demo_auth_list",{p_actor:actor});
   if(error)return respond({success:false,error:"AUTHORIZATION_READ_FAILED"},503);
   return respond({success:true,data,simulationOnly:true});
  }
  const snapshotPath=path.match(new RegExp("^/authorizations/([0-9a-fA-F-]{36})/snapshot$"));
  if(req.method==="GET"&&snapshotPath&&uuid.test(snapshotPath[1])){
   const {data,error}=await db.rpc("demo_auth_public_snapshot",{p_request:snapshotPath[1]});
   if(error)return respond({success:false,error:"REQUEST_NOT_FOUND"},404);
   return respond({success:true,data,simulationOnly:true});
  }
  if(req.method==="POST"&&(path==="/authorizations"||path==="/authorizations/sync")){
   const raw=await req.text();if(raw.length>1000)return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
   const input=JSON.parse(raw),action=path.endsWith("/sync")?"sync":input.action;
   let result:{id:string;status:string;consentCode?:string|null;attempts?:number};
   if(action==="sync"){
    if(!uuid.test(input.id))return respond({success:false,error:"INVALID_ID"},400);
    const check=await db.rpc("demo_auth_public_snapshot",{p_request:input.id});
    if(check.error)return respond({success:false,error:"REQUEST_NOT_FOUND"},404);
    result=check.data;
   }else{
    if(!["request","accept","confirm","decline","revoke","resend","delete"].includes(action)||
       !/^user([1-9]|10)$/.test(input.actor??""))
      return respond({success:false,error:"INVALID_AUTHORIZATION_ACTION"},400);
    const {data,error}=await db.rpc("demo_auth_transition",{
     p_action:action,p_actor:input.actor,p_request:input.id??null,
     p_target_tin:input.tin??null,p_code:input.code??null
    });
    if(error)return respond({success:false,error:error.message},409);
    result=data;
   }
   try{if(!await mirrorAuthorization(result.id))throw Error("OFFICE_AUTHORIZATION_MIRROR_FAILED");}
   catch(e){
    console.error("Authorization mirror pending",e);
    return respond({success:false,error:"OFFICE_SYNC_PENDING",requestId:result.id,retryable:true},503);
   }
   return respond({success:true,data:result,mirrored:true,simulationOnly:true});
  }
  if(req.method==="POST"&&path==="/payments"){
    const raw=await req.text();
    // Match the canonical combined-payment SQL contract; keep legacy services capped.
    if(raw.length>MAX_COMBINED_PAYMENT_PAYLOAD_CHARS)return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
    const body=JSON.parse(raw);
    if(!acceptPaymentRequestSize(raw.length,body))return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
    const p_capability_hash=await capabilityHash(req);
    const client=p_capability_hash?serviceClient(url):db;
    const {data,error}=p_capability_hash
      ?await client.rpc("taxpay_demo_story1_submit",{p_capability_hash,p_input:body})
      :await client.rpc("demo_story1_submit",{p_input:body});
    if(error){
      console.error("TaxPay simulation submit",error.message);
      if(error.message?.includes("LEGACY_SESSION_READ_ONLY"))
        return respond({success:false,error:"LEGACY_SESSION_READ_ONLY"},409);
      if(error.message?.includes("PROFILE_CAPABILITY_REQUIRED")||error.message?.includes("PROFILE_PAYMENT_SCOPE_MISMATCH"))
        return respond({success:false,error:"PROFILE_CAPABILITY_REQUIRED"},403);
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
        "x-taxpay-office-mirror-proof":proof},body:JSON.stringify(out),signal:AbortSignal.timeout(10000)});
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
