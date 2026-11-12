// Office Admin reads TaxPay's canonical SQL rows; no Office database copy.
import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
const OFFICE_URL='https://ihbtabrvmyiwikqqbhrf.supabase.co';
const OFFICE_PUBLISHABLE_KEY='sb_publishable_PyxzQzcf77wnlJQFepowrA_0MfhqGd5';
const OFFICE_ADMIN_UID='a05f8fc6-a134-4a43-9b94-54881d858783';
const OFFICE_ADMIN_EMAIL='shihabshajib01@gmail.com';
const ORIGINS=new Set(['https://shihab-tech04.github.io','http://localhost:3000','http://127.0.0.1:3000']);
const cors=(origin:string)=>({
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'GET,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Vary':'Origin','Cache-Control':'no-store',
});
function respond(value:unknown,status:number,origin:string){
 return Response.json(value,{status,headers:cors(origin)});
}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')??'';
 if(!ORIGINS.has(origin))return Response.json({success:false,code:'ORIGIN_FORBIDDEN'},{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(request.method!=='GET')return respond({success:false,code:'METHOD_NOT_ALLOWED'},405,origin);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.{12,8192})$/i)?.[1];
 if(!token)return respond({success:false,code:'OFFICE_SIGN_IN_REQUIRED'},401,origin);
 try {
   const office=createClient(OFFICE_URL,OFFICE_PUBLISHABLE_KEY,{
     auth:{persistSession:false,autoRefreshToken:false}
   });
   const {data,error}=await office.auth.getUser(token);
   const user=data?.user;
   if(error||!user||user.is_anonymous||user.id!==OFFICE_ADMIN_UID ||
       user.email?.toLowerCase()!==OFFICE_ADMIN_EMAIL||!user.email_confirmed_at)
     return respond({success:false,code:'OFFICE_ADMIN_REQUIRED'},403,origin);
   const url=Deno.env.get('SUPABASE_URL');
   const key=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')['default']
     ||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   if(!url||!key)return respond({success:false,code:'PROFILE_SOURCE_UNAVAILABLE'},503,origin);
   const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const filter=new URL(request.url).searchParams.get('tin');
   if(filter!==null && !/^[0-9]{12}$/.test(filter))
     return respond({success:false,code:'INVALID_TIN'},400,origin);
   // Keyset pagination protects the authorized Office read from silent 100-row loss.
   // No Office-side copy: every request reads the canonical TaxPay SQL.
   const PAGE_SIZE=100,MAX_PROFILES=10000;
   let cursor:string|null=null;
   const profiles:Array<{accountId:string;tin:string;profile:unknown;revision:number;updatedAt:string}>=[];
   while(true){
     let page=db.from('taxpay_taxpayer_registration_profiles')
       .select('account_id,tin,profile,revision,updated_at')
       .order('account_id',{ascending:true}).limit(PAGE_SIZE);
     if(filter)page=page.eq('tin',filter);
     if(cursor)page=page.gt('account_id',cursor);
     const {data:rows,error:readError}=await page;
     if(readError)throw readError;
     if(!rows?.length)break;
     if(profiles.length+rows.length>MAX_PROFILES)
       return respond({success:false,code:'PROFILE_RESULT_LIMIT'},503,origin);
     for(const item of rows){
       profiles.push({accountId:item.account_id,tin:item.tin,profile:item.profile,
         revision:item.revision,updatedAt:item.updated_at});
     }
     cursor=rows[rows.length-1].account_id;
     if(rows.length<PAGE_SIZE)break;
   }
   return respond({success:true,profiles},200,origin);
 }catch(error){
   console.error('taxpayer profile Office read failed',error instanceof Error?error.message:'Unknown');
   return respond({success:false,code:'PROFILE_SOURCE_UNAVAILABLE'},503,origin);
 }
});