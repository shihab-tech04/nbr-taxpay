import {createClient} from 'npm:@supabase/supabase-js@2.57.0';

// These ten public sample identities contain fictional tax data only. They are
// not taxpayer identity verification, government credentials or officer access.
// The privileged Auth key stays inside this function and never reaches a client.
const allowedOrigins=new Set([
  'https://shihab-tech04.github.io',
  'http://localhost:3000','http://127.0.0.1:3000',
  'http://localhost:4173','http://127.0.0.1:4173',
]);
const idPattern=/^user(?:10|[1-9])$/;
const alias=(id:string)=>`taxpay-sample-${id}@example.com`;
const localAuthPassword=(id:string)=>`korbritto-public-demo-${id}`;
function reply(status:number,code:string,origin:string){
  return new Response(JSON.stringify({ok:status===200,code}),{status,headers:{
    'content-type':'application/json','cache-control':'no-store',
    'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'apikey,content-type,x-client-info,authorization',
    'vary':'Origin',
  }});
}
function adminClient(){
  const url=Deno.env.get('SUPABASE_URL');
  const keys=Deno.env.get('SUPABASE_SECRET_KEYS');
  let secret='';
  try{secret=keys?(JSON.parse(keys) as Record<string,string>).default??'':'';}catch{/* legacy fallback */}
  secret||=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!url||!secret)throw Error('SERVICE_UNAVAILABLE');
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')??'';
  if(!allowedOrigins.has(origin))return new Response(null,{status:403,headers:{'cache-control':'no-store'}});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'apikey,content-type,x-client-info,authorization',
    'vary':'Origin',
  }});
  if(req.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED',origin);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,'INVALID_REQUEST',origin);
  try{
    const raw=await req.text();
    if(raw.length>512)return reply(400,'INVALID_REQUEST',origin);
    const body=JSON.parse(raw) as Record<string,unknown>;
    const id=typeof body?.userId==='string'?body.userId.toLowerCase().trim():'';
    // Credentials are bounded to the fictional user1-user10 set; never accept
    // arbitrary account names or grant a role supplied by the client.
    if(!idPattern.test(id)||body?.password!==id)return reply(401,'INVALID_CREDENTIALS',origin);
    const {error}=await adminClient().auth.admin.createUser({
      email:alias(id),password:localAuthPassword(id),email_confirm:true,
      app_metadata:{taxpay_synthetic_id:id,taxpay_account_class:'public_synthetic'},
    });
    if(error && !/already (?:been )?registered|already exists|email_exists|duplicate/i.test(error.message)){
      console.error('Synthetic Auth provisioning failed:',error.code??'unknown',error.message);
      return reply(503,'SERVICE_UNAVAILABLE',origin);
    }
    // An existing account is never overwritten or given a new password.
    // Client Auth still verifies the password and immutable app_metadata.
    return reply(200,'READY',origin);
  }catch(error){console.error('Synthetic Auth bootstrap failed:',error instanceof Error?error.message:'unknown');return reply(503,'SERVICE_UNAVAILABLE',origin);}
});
