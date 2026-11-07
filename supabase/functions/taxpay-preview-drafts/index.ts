import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

/** Preview-only form drafts. No payment, settlement, taxpayer identity or credit writes. */
const origins = new Set([
  'https://shihab-tech04.github.io',
  'http://localhost:3000','http://127.0.0.1:3000',
  'http://localhost:4173','http://127.0.0.1:4173',
  'http://localhost:4175','http://127.0.0.1:4175',
]);
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
type DraftAction = 'list' | 'get' | 'create' | 'update' | 'delete';

function respond(body:unknown,status:number,origin:string):Response {
  return new Response(JSON.stringify(body),{
    status,headers:{
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Headers':'apikey, content-type, x-client-info, x-taxpay-guest-capability',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Max-Age':'600',
      'Cache-Control':'no-store',
      'Content-Type':'application/json; charset=utf-8',
      'Vary':'Origin',
    },
  });
}
function admin() {
  const url=Deno.env.get('SUPABASE_URL');
  const secrets=Deno.env.get('SUPABASE_SECRET_KEYS');
  const key=(secrets ? (JSON.parse(secrets) as Record<string,string>).default : '') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw new Error('SERVICE_UNAVAILABLE');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
function safeError(error:unknown):{status:number;code:string} {
  const message=error instanceof Error ? error.message : '';
  if(/DRAFT_CONFLICT/.test(message))return {status:409,code:'DRAFT_CONFLICT'};
  if(/DRAFT_NOT_FOUND/.test(message))return {status:404,code:'DRAFT_NOT_FOUND'};
  if(/DRAFT_LIMIT_REACHED/.test(message))return {status:409,code:'DRAFT_LIMIT_REACHED'};
  if(/INVALID_DRAFT_STATE|INVALID_DRAFT_REQUEST|INVALID_BODY/.test(message))
    return {status:400,code:'INVALID_DRAFT_REQUEST'};
  if(/INVALID_CAPABILITY|GUEST_SESSION_UNAVAILABLE|INVALID_DEMO_PROFILE/.test(message))
    return {status:401,code:'SESSION_EXPIRED'};
  return {status:503,code:'SERVICE_UNAVAILABLE'};
}
Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  if(!origins.has(origin))return new Response(null,{status:403});
  if(request.method==='OPTIONS')return respond({},200,origin);
  if(request.method!=='POST')return respond({success:false,code:'METHOD_NOT_ALLOWED'},405,origin);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return respond({success:false,code:'INVALID_BODY'},415,origin);
  try{
    const cap=request.headers.get('x-taxpay-guest-capability')||'';
    if(!capabilityPattern.test(cap))throw new Error('INVALID_CAPABILITY');
    const declared=Number(request.headers.get('content-length')||'0');
    if(declared>32768)throw new Error('INVALID_BODY');
    const bodyText=await request.text();
    if(bodyText.length>32768)throw new Error('INVALID_BODY');
    let body:Record<string,unknown>;
    try{body=JSON.parse(bodyText) as Record<string,unknown>;}catch{throw new Error('INVALID_BODY');}
    if(!body||Array.isArray(body)||typeof body!=='object')throw new Error('INVALID_BODY');
    const action=body.action;
    if(!['list','get','create','update','delete'].includes(String(action)))
      throw new Error('INVALID_DRAFT_REQUEST');
    const a=action as DraftAction;
    const id=body.id??null;
    if(id!==null&&(typeof id!=='string'||!uuidPattern.test(id)))
      throw new Error('INVALID_DRAFT_REQUEST');
    const expectedVersion=body.expectedVersion??null;
    if(expectedVersion!==null&&(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<1))
      throw new Error('INVALID_DRAFT_REQUEST');
    if((a==='get'||a==='update'||a==='delete')&&!id)
      throw new Error('INVALID_DRAFT_REQUEST');
    if((a==='update'||a==='delete')&&expectedVersion===null)
      throw new Error('INVALID_DRAFT_REQUEST');
    if(a==='create'&&(id!==null||expectedVersion!==null))
      throw new Error('INVALID_DRAFT_REQUEST');
    const state=body.formState??null;
    if((a==='create'||a==='update')&&
      (!state||typeof state!=='object'||Array.isArray(state)))
      throw new Error('INVALID_DRAFT_REQUEST');
    const digest=await crypto.subtle.digest('SHA-256',encoder.encode(cap));
    const capabilityHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const {data,error}=await admin().rpc('taxpay_demo_payment_drafts',{
      p_capability_hash:capabilityHash,
      p_action:a,p_draft_id:id,
      p_journey:a==='create'||a==='update'?(body.journey==='guest_payment'||body.journey==='travel_tax'?body.journey:null):null,
      p_form_state:a==='create'||a==='update'?state:null,
      p_expected_version:expectedVersion
    });
    if(error)throw new Error(error.message);
    return respond({success:true,data},200,origin);
  }catch(error){
    const failure=safeError(error);
    return respond({success:false,code:failure.code},failure.status,origin);
  }
});
