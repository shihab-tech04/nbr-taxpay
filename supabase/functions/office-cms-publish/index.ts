// TaxPay writes originate only from this server-side integration.
// The authenticated user belongs to the independent Office Supabase project.
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const OFFICE_URL = 'https://ihbtabrvmyiwikqqbhrf.supabase.co';
const OFFICE_PUBLIC_KEY = 'sb_publishable_PyxzQzcf77wnlJQFepowrA_0MfhqGd5';
const OFFICE_PUBLISHER_UID = 'a05f8fc6-a134-4a43-9b94-54881d858783';
const OFFICE_PUBLISHER_EMAIL = 'shihabshajib01@gmail.com';
const ALLOWED_ORIGINS = new Set(['https://shihab-tech04.github.io','http://localhost:3000']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VALID_SERVICES = new Set(['TAX_WITH_RETURN','ADVANCE_TAX','SOURCE_TAX_DEPOSIT','TRAVEL_TAX']);
const COPY = ['heading_en','heading_bn','description_en','description_bn','mobile_heading_en','mobile_heading_bn','mobile_description_en','mobile_description_bn','action_en','action_bn'];

function response(data: unknown, status = 200, origin = '') {
  return Response.json(data, {status,headers:{
    'Access-Control-Allow-Origin': origin || 'https://shihab-tech04.github.io',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Vary':'Origin',
    'Cache-Control':'no-store',
  }});
}
function fail(message: string, status = 400): never {throw Object.assign(new Error(message),{status});}
function str(v: unknown): string {return typeof v==='string' ? v : '';}
function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')['default'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) fail('Publishing service is not configured',503);
  return createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function officeIdentity(req:Request) {
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ') || header.length > 8192) fail('An authorized Office sign-in is required',401);
  const token = header.slice(7);
  const office = createClient(OFFICE_URL,OFFICE_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await office.auth.getUser(token);
  const u = data?.user;
  if(error || !u || u.is_anonymous || u.id!==OFFICE_PUBLISHER_UID ||
      u.email?.toLowerCase()!==OFFICE_PUBLISHER_EMAIL || !u.email_confirmed_at)
    fail('This Office account cannot publish TaxPay content',403);
  return u.id;
}
async function readImage(v: FormDataEntryValue|null):Promise<File|null> {
  if(v===null) return null;
  if(!(v instanceof File) || v.size<=0 || v.size>MAX_IMAGE_SIZE ||
     !['image/png','image/jpeg'].includes(v.type)) fail('PNG/JPEG image up to 5MB required');
  const b = new Uint8Array(await v.slice(0,12).arrayBuffer());
  const png = b.length>=8 && [137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n);
  const jpg = b.length>=3 && b[0]===255 && b[1]===216 && b[2]===255;
  if (!(v.type==='image/png'?png:jpg)) fail('Image format does not match its contents');
  return v;
}
async function upload(db:ReturnType<typeof serviceClient>, bucket:'taxpay-branding'|'taxpay-banners',path:string,file:File) {
  const {error}=await db.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(error) throw error;
  const publicUrl = db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const check=await fetch(publicUrl,{method:'GET',headers:{Range:'bytes=0-23'}}).catch(()=>null);
  if(!check?.ok) fail('Uploaded image is not publicly accessible',502);
  return path;
}
async function removeUnused(db:ReturnType<typeof serviceClient>,bucket:'taxpay-branding'|'taxpay-banners',paths:string[]) {
  if(!paths.length) return;
  if(bucket==='taxpay-branding') {
    const {data}=await db.from('taxpay_site_logo').select('image_path').eq('id','primary').single();
    const unused=paths.filter(p=>p!==data?.image_path);
    if(unused.length) await db.storage.from(bucket).remove(unused);
  } else {
    const {data,error}=await db.from('taxpay_site_banners').select('desktop_image_path,mobile_image_path');
    if(error) return;
    const unused=paths.filter(p=>!(data||[]).some(row=>row.desktop_image_path===p || row.mobile_image_path===p));
    if(unused.length) await db.storage.from(bucket).remove(unused);
  }
}

// Keep only high-contrast, light-background palettes from the verified Office publisher.
function luminance(hex:string):number {
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a:string,b:string):number {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
// Match Office's client-side palette rule on the authenticated publisher.
// A readable blue-on-amber palette is still visually mismatched.
function paletteHue(hex:string):number|null {
  if(!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const hi=Math.max(...c),lo=Math.min(...c),d=hi-lo;
  if(d<.025) return null;
  let h=0;
  if(hi===c[0]) h=((c[1]-c[2])/d)%6;
  else if(hi===c[1]) h=(c[2]-c[0])/d+2;
  else h=(c[0]-c[1])/d+4;
  return ((h*60)%360+360)%360;
}
function hueDistance(a:string,b:string):number|null {
  const x=paletteHue(a),y=paletteHue(b);
  return x===null||y===null?null:Math.min(Math.abs(x-y),360-Math.abs(x-y));
}

function validatePalette(p:Record<string,unknown>) {
  const names=['background_color','heading_color','body_color','outline_color'];
  const present=names.map(n=>p[n]!==undefined&&p[n]!==null);
  if(!present.some(Boolean)) return;
  if(!present.every(Boolean)||!names.every(n=>/^#[0-9a-fA-F]{6}$/.test(str(p[n]))))
    fail('Provide all four hex banner colors.');
  const bg=str(p.background_color);
  if(luminance(bg)<.72||names.slice(1).some(n=>contrast(bg,str(p[n]))<4.5))
    fail('Banner palette must have a light background and readable dark text/outline.');
  const heading=str(p.heading_color);
  const ink=names.slice(1).map(n=>str(p[n]));
  if(ink.some(color=>{
    const distance=hueDistance(heading,color);
    return distance!==null && distance>32;
  }) || ink.some(color=>{
    const distance=hueDistance(bg,color);
    return distance!==null && distance>35;
  })) fail('Banner colors must share one color family.');
}

function validateBanner(p:Record<string,unknown>) {
  if(!/^[a-z][a-z0-9_-]{0,39}$/.test(str(p.id))) fail('Invalid banner ID');
  if(p.service_code!==null && p.service_code!=='' && !VALID_SERVICES.has(str(p.service_code))) fail('Invalid banner category');
  if(typeof p.published!=='boolean') fail('Invalid banner publication flag');
  if(p.id==='intro' && (p.published!==true || (p.service_code!==null && p.service_code!==''))) fail('Main banner must stay published');
  validatePalette(p);
  for(const key of COPY) if(typeof p[key]!=='string' || !str(p[key]).trim() || str(p[key]).length>2400) fail('Missing or invalid banner field '+key);
  for(const key of ['mobile_heading_en','mobile_heading_bn']) if(Array.from(str(p[key])).length>24) fail('Mobile heading is too long');
  for(const key of ['mobile_description_en','mobile_description_bn']) if(Array.from(str(p[key])).length>34) fail('Mobile description is too long');
  for(const key of ['desktop_image_path','mobile_image_path']) {
    if (p[key]!==null && p[key]!==undefined &&
       (typeof p[key]!=='string' || !str(p[key]).startsWith('banners/'+p.id+'/'))) fail('Invalid banner image path');
  }
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('Origin')||'';
  if(origin && !ALLOWED_ORIGINS.has(origin)) return response({error:'Origin is not allowed'},403);
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin || 'https://shihab-tech04.github.io',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Vary':'Origin'
  }});
  if(req.method!=='POST') return response({error:'Method not allowed'},405,origin);
  try {
    // Mandatory server-side verification, NEVER a browser role flag or TaxPay token.
    const officeUid=await officeIdentity(req);
    const db=serviceClient();
    const body=await req.formData();
    const action=str(body.get('action'));
    if(action==='status') return response({authorized:true,officeUid},200,origin);
    if(action==='list-banners') {
      const {data,error}=await db.from('taxpay_site_banners').select('*').order('sort_order').order('id');
      if(error) throw error;
      return response({banners:data},200,origin);
    }
    if(action==='publish-logo' || action==='restore-logo') {
      const expected=Number(body.get('expectedVersion'));
      if(!Number.isSafeInteger(expected) || expected<=0) fail('Invalid logo version');
      const old=(await db.from('taxpay_site_logo').select('*').eq('id','primary').single());
      if(old.error || !old.data) throw old.error||new Error('Logo missing');
      if(old.data.version!==expected) fail('Logo changed in another session. Refresh before publishing',409);
      const file=action==='publish-logo'?await readImage(body.get('image')):null;
      if(action==='publish-logo' && !file) fail('Select a cropped logo');
      let path:string|null=null;let committed=false;
      try {
        if(file) path=await upload(db,'taxpay-branding','logos/'+crypto.randomUUID()+(file.type==='image/png'?'.png':'.jpg'),file);
        const width=file?1469:null, height=file?496:null;
        const {data,error}=await db.from('taxpay_site_logo')
          .update({image_path:path,image_width:width,image_height:height})
          .eq('id','primary').eq('version',expected).select('*').maybeSingle();
        if(error) throw error;
        if(!data || data.version!==expected+1 || data.image_path!==path) fail('Logo changed before SQL commit',409);
        committed=true;
        const {data:confirmed,error:readErr}=await db.from('taxpay_site_logo').select('*').eq('id','primary').single();
        if(readErr || confirmed?.version!==data.version || confirmed?.image_path!==path) fail('Logo SQL read-back failed',502);
        await removeUnused(db,'taxpay-branding',[old.data.image_path].filter(Boolean));
        return response({logo:confirmed},200,origin);
      }catch(e){if(!committed && path) await removeUnused(db,'taxpay-branding',[path]);throw e;}
    }
    if(action==='publish-banner') {
      let raw:Record<string,unknown>;
      try{raw=JSON.parse(str(body.get('banner')))}catch{fail('Invalid banner data')}
      validateBanner(raw!);
      const expectedString=str(body.get('expectedVersion'));
      const expected=expectedString===''?null:Number(expectedString);
      if(expected!==null && (!Number.isSafeInteger(expected)||expected<1)) fail('Invalid banner version');
      const position=Number(body.get('position'));
      if(!Number.isSafeInteger(position)||position<1||position>1000) fail('Invalid banner position');
      const {data:prior}=await db.from('taxpay_site_banners').select('*').eq('id',raw!.id).maybeSingle();
      if((prior?.version??null)!==expected) fail('Banner changed in another session',409);
      const uploads:string[]=[];let committed=false;
      try {
        for (const device of ['desktop','mobile'] as const) {
          const file=await readImage(body.get(device));
          if(!file) continue;
          const path='banners/'+raw!.id+'/'+crypto.randomUUID()+(file.type==='image/png'?'.png':'.jpg');
          await upload(db,'taxpay-banners',path,file);
          uploads.push(path);
          raw![device+'_image_path']=path;
        }
        const {data,error}=await db.rpc('taxpay_office_save_banner',{
          p_banner:raw!,p_expected_version:expected,p_position:position,
        });
        if(error) {if(error.code==='40001' || error.code==='PT409') fail('Banner changed in another session',409);throw error;}
        committed=true;
        const {data:confirmed,error:checkErr}=await db.from('taxpay_site_banners').select('*').eq('id',raw!.id).single();
        if(checkErr || !confirmed || confirmed.version!==data?.version || confirmed.sort_order!==position-1)
          fail('Banner SQL read-back failed',502);
        if(prior) await removeUnused(db,'taxpay-banners',[prior.desktop_image_path,prior.mobile_image_path]
          .filter((p):p is string=>!!p && p!==confirmed.desktop_image_path && p!==confirmed.mobile_image_path));
        return response({banner:confirmed},200,origin);
      } catch(e) {if(!committed) await removeUnused(db,'taxpay-banners',uploads);throw e;}
    }
    if(action==='delete-banner') {
      const id=str(body.get('bannerId')),version=Number(body.get('expectedVersion'));
      if(!/^[a-z][a-z0-9_-]{0,39}$/.test(id)||id==='intro'||!Number.isSafeInteger(version)||version<1)
        fail('Invalid banner deletion request');
      const {data:prior}=await db.from('taxpay_site_banners').select('*').eq('id',id).eq('version',version).single();
      if(!prior) fail('Banner changed in another session',409);
      const {data,error}=await db.from('taxpay_site_banners').delete().eq('id',id).eq('version',version).select('id').maybeSingle();
      if(error) throw error;
      if(!data) fail('Banner changed in another session',409);
      await removeUnused(db,'taxpay-banners',[prior.desktop_image_path,prior.mobile_image_path].filter(Boolean));
      return response({removed:id},200,origin);
    }
    return response({error:'Unknown CMS operation'},400,origin);
  }catch(e){
    const status=Number((e as {status?:number})?.status)||500;
    const detail=status<500 ? (e as Error).message : 'Publishing service failed. No success was reported.';
    return response({error:detail},status,origin);
  }
});