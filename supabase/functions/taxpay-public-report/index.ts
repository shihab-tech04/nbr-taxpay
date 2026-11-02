/** Server-mediated non-financial problem reports; no payment or settlement calls. */
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const allowedOrigins = new Set(['https://shihab-tech04.github.io','http://localhost:3000','http://127.0.0.1:4173']);
function respond(origin: string|null,body:Record<string,unknown>,status:number) {
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store'};
 if(origin&&allowedOrigins.has(origin)){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
 return new Response(JSON.stringify(body),{status,headers});
}
// Stable server-only rate-limit fingerprint. HMAC protects IPs even if source hashes leak.
async function sourceFingerprint(secret:string,ip:string) {
 const material=new TextEncoder().encode(secret);
 const key=await crypto.subtle.importKey('raw',material,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('taxpay-public-report-ip:v1:'+ip));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async request=>{
 const origin=request.headers.get('Origin');
 if(request.method==='OPTIONS'){
   const result=respond(origin,{ok:true},200);
   result.headers.set('Access-Control-Allow-Headers','authorization, apikey, x-client-info, content-type');
   result.headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
   return result;
 }
 if(request.method!=='POST'||!origin||!allowedOrigins.has(origin))
   return respond(origin,{error:'Request not allowed.'},403);
 if((request.headers.get('content-type')||'').split(';')[0]!=='application/json')
   return respond(origin,{error:'Expected JSON.'},415);
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 // Prefer a dedicated pepper, but managed Supabase already injects a private
 // service-role key. HMAC domain separation prevents exposing or persisting that key.
 const dedicatedPepper=Deno.env.get('TAXPAY_PUBLIC_REPORT_PEPPER');
 const fingerprintKey=dedicatedPepper&&dedicatedPepper.length>=32?dedicatedPepper:key;
 if(!url||!key||!fingerprintKey||fingerprintKey.length<32)
   return respond(origin,{error:'Reporting temporarily unavailable.'},503);
 let body:Record<string,unknown>;
 try {body=await request.json();}catch{return respond(origin,{error:'Invalid request.'},400);}
 const category=body.category;
 const details=typeof body.details==='string'?body.details.trim():'';
 const submissionKey=body.submissionKey;
 if(body.action!=='status' && (!['payment','reference','security'].includes(String(category))
    ||details.length<10||details.length>500||typeof submissionKey!=='string'
    ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)))
   return respond(origin,{error:'Check the issue details and retry.'},400);
 // Only trust the platform gateway's client-address header; never persist IP.
 // This managed gateway supplies cf-connecting-ip. Do not trust caller-controlled
 // x-real-ip or x-forwarded-for fallbacks for production abuse limits.
 const ip=request.headers.get('cf-connecting-ip');
 if(!ip||ip.length>64||!/^[0-9a-f:.]+$/i.test(ip))
   return respond(origin,{error:'Unable to verify request.'},503);
 const hash=await sourceFingerprint(fingerprintKey,ip);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 if(body.action==='status'){
   const reference=body.reference;
   if(typeof reference!=='string'||!/^KRB-[A-F0-9]{12}$/.test(reference))
     return respond(origin,{error:'Enter a valid report reference.'},400);
   const {data:report,error:lookupError}=await admin.from('taxpay_public_issue_reports')
     .select('status,updated_at').eq('reference',reference).maybeSingle();
   if(lookupError)return respond(origin,{error:'Status temporarily unavailable.'},503);
   if(!report)return respond(origin,{error:'No matching report.'},404);
   return respond(origin,{reference,status:report.status,updatedAt:report.updated_at},200);
 }

 const {data,error}=await admin.rpc('taxpay_record_public_issue',{
   p_category:category,p_details:details,p_submission_key:submissionKey,p_source_hash:hash
 });
 if(error){
   if(error.code==='P0001') return respond(origin,{error:'Too many reports. Retry later.'},429);
   return respond(origin,{error:'Report not sent. Please retry.'},503);
 }
 return respond(origin,{reference:data.reference,status:data.status},201);
});