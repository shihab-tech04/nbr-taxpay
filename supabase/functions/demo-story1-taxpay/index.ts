import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,authorization,apikey","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
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
     const response=await fetch(office,{method:"POST",headers:{"Content-Type":"application/json"},
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
  if(req.method==="POST"&&path==="/sync/reconcile"){
   const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
   if(!serviceKey||req.headers.get("Authorization")!=="Bearer "+serviceKey)
    return respond({success:false,error:"SERVICE_ROLE_REQUIRED"},401);
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
    const raw=await req.text();if(raw.length>12000)return respond({success:false,error:"PAYLOAD_TOO_LARGE"},400);
    const body=JSON.parse(raw);
    const {data,error}=await db.rpc("demo_story1_submit",{p_input:body});
    if(error){console.error("TaxPay simulation submit",error.message);return respond({success:false,error:"SUBMISSION_FAILED"},400);}
    const out={id:data.id,sessionId:body.sessionId,service:body.service,amountMinor:body.amountMinor,data:body,status:data.status,createdAt:data.createdAt};
    try{
      const res=await fetch(office,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(out),signal:AbortSignal.timeout(10000)});
      const receipt=await res.json();
      if(!res.ok||!receipt.success||receipt.data?.id!==data.id)throw Error("OFFICE_MIRROR_NOT_ACKNOWLEDGED");
      return respond({success:true,id:data.id,status:"SIMULATED_SUCCESS",mirrored:true,replayed:data.replayed,simulationOnly:true});
    }catch(e){console.error("Office mirror pending",e);return respond({success:false,error:"OFFICE_SYNC_PENDING",requestId:data.id,retryable:true,simulationOnly:true},503);}
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
  const {data,error}=await db.rpc(rpc,args);
  if(error)return respond({success:false,error:"NOT_FOUND"},404);
  return respond({success:true,data,simulationOnly:true});
 }catch(e){console.error("TaxPay simulated request",e);return respond({success:false,error:"INVALID_INPUT"},400);}
});
