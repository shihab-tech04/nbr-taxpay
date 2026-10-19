/** TaxPay v11 internal-handoff API. Every route is synthetic-only.
 * Protected payment_v1_* and sim_my_* APIs are unaffected.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const HEADERS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS',
  'Cache-Control':'no-store',
};
type RpcArgs=Record<string,unknown>;
const uuidRE=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function output(value:unknown,status=200):Response {
  return new Response(JSON.stringify(value),{status,headers:{
    ...HEADERS,'Content-Type':'application/json; charset=utf-8',
  }});
}
function errorStatus(message:string):number {
  if(/UNKNOWN_HANDOFF_REQUEST/.test(message))return 404;
  if(/IDEMPOTENCY_COLLISION|OUT_OF_SEQUENCE|SEPARATION|REVIEW_REQUIRED|RESOLVED|STATE_TRANSITION|NOT_AVAILABLE/.test(message))
    return 409;
  if(/INVALID_|REQUIRED|HAS_NO_ASSESSMENT_YEAR|RATE_LIMIT|REFERENCE_REQUIRED/.test(message))
    return 400;
  return 500;
}
async function parseBody(request:Request):Promise<Record<string,unknown>> {
  if(Number(request.headers.get('content-length')??'0')>4096)
    throw Error('INVALID_BODY_SIZE');
  const body=await request.text();
  if(body.length>4096)throw Error('INVALID_BODY_SIZE');
  const parsed=JSON.parse(body);
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')
    throw Error('INVALID_BODY');
  return parsed as Record<string,unknown>;
}
function route(request:Request,url:URL):{rpc:string;args:RpcArgs}|null {
  const path=url.pathname.replace(/^\/taxpay-handoff-api/,'')
    .replace(/^\/api\/v1/,'').replace(/\/$/,'')||'/';
  const queryId=url.searchParams.get('sessionId');
  const limit=Number(url.searchParams.get('limit')??'100');
  if(path==='/payments'&&request.method==='GET'){
    return{rpc:'taxpay_v11_handoff_history',
      args:{p_session_id:queryId,p_limit:limit}};
  }
  if(path==='/office/inbox'&&request.method==='GET'){
    return{rpc:'taxpay_v11_handoff_office_inbox',args:{p_limit:limit}};
  }
  if(path==='/notifications'&&request.method==='GET'){
    return{rpc:'taxpay_v11_handoff_notifications',
      args:{p_session_id:queryId,p_limit:limit}};
  }
  const detail=path.match(/^\/payments\/([0-9a-fA-F-]{36})(\/summary)?$/);
  if(detail&&uuidRE.test(detail[1])&&request.method==='GET'){
    return detail[2]?
      {rpc:'taxpay_v11_handoff_summary',args:{p_request_id:detail[1]}}:
      {rpc:'taxpay_v11_handoff_get',args:{p_request_id:detail[1]}};
  }
  return null;
}
Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  const url=new URL(request.url);
  const path=url.pathname.replace(/^\/taxpay-handoff-api/,'')
    .replace(/^\/api\/v1/,'').replace(/\/$/,'')||'/';
  const apiUrl=Deno.env.get('SUPABASE_URL');
  const key=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if(!apiUrl||!key)return output({success:false,code:'BACKEND_NOT_CONFIGURED'},503);
  try{
    const client=createClient(apiUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let action=route(request,url);
    if(!action&&request.method==='POST'&&path==='/payments'){
      action={rpc:'taxpay_v11_handoff_submit',args:{p_input:await parseBody(request)}};
    }
    if(!action&&request.method==='POST'){
      const review=path.match(/^\/office\/payments\/([0-9a-fA-F-]{36})\/review$/);
      const state=path.match(/^\/office\/payments\/([0-9a-fA-F-]{36})\/state$/);
      const match=review??state;
      if(match&&uuidRE.test(match[1])){
        const body=await parseBody(request);
        action=review?{
          rpc:'taxpay_v11_handoff_office_action',
          args:{p_request_id:match[1],p_role:body.role,
            p_actor_code:body.actorCode,p_action:body.action,
            p_reason:body.reason,p_idempotency_key:body.idempotencyKey},
        }:{
          rpc:'taxpay_v11_handoff_finish',
          args:{p_request_id:match[1],p_actor_code:body.actorCode,
            p_action:body.action,p_idempotency_key:body.idempotencyKey},
        };
      }
    }
    if(!action&&request.method==='PATCH'){
      const notice=path.match(/^\/notifications\/([1-9][0-9]{0,15})$/);
      if(notice){
        const body=await parseBody(request);
        action={rpc:'taxpay_v11_handoff_notice_read',args:{
          p_session_id:body.sessionId,p_notice_id:Number(notice[1]),
          p_is_read:body.isRead??true,
        }};
      }
    }
    if(!action)return output({success:false,code:'NOT_FOUND'},404);
    if('p_limit' in action.args){
      const limit=action.args.p_limit;
      if(!Number.isInteger(limit)||Number(limit)<1||Number(limit)>100)
        return output({success:false,code:'INVALID_LIMIT'},400);
    }
    if('p_session_id' in action.args&&
       (typeof action.args.p_session_id!=='string'||
         !uuidRE.test(action.args.p_session_id)))
      return output({success:false,code:'INVALID_SESSION_ID'},400);
    const {data,error}=await client.rpc(action.rpc,action.args);
    if(error){
      const status=errorStatus(error.message);
      if(status===500)console.error('handoff API:',error.message);
      return output({success:false,code:status===500?'BACKEND_ERROR':error.message.split(':')[0]},status);
    }
    return output({success:true,data,origin:'SYNTHETIC_HANDOFF'});
  }catch(e){
    const msg=e instanceof Error?e.message:'INVALID_BODY';
    return output({success:false,code:msg.startsWith('INVALID_')?msg:'INVALID_BODY'},400);
  }
});
