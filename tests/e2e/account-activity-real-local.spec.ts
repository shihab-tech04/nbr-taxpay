import {test,expect} from '@playwright/test';
import {randomUUID,randomBytes} from 'node:crypto';

test('verified account activity persists in SQL and isolates different users after fresh browser login',async({browser})=>{
  test.setTimeout(120000);
  const url=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('Disposable Supabase credentials required');
  const api=new URL(url);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Never run account activity test against hosted service');
  const signup=async()=>{
    const res=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email:'activity-'+randomUUID()+'@example.invalid',
        password:randomBytes(32).toString('base64url')})
    });
    expect(res.status).toBe(200);
    const payload=await res.json();
    const session=payload.session??payload;
    expect(session.access_token).toBeTruthy();
    const me=await fetch(new URL('/auth/v1/user',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+session.access_token}});
    expect(me.status).toBe(200);
    return {uid:(await me.json()).id as string,session};
  };
  const a=await signup(),b=await signup();
  const auth=(token:string)=>({apikey:key,Authorization:'Bearer '+token});
  const store=async(token:string,body:unknown)=>{
    return fetch(new URL('/rest/v1/taxpay_account_activity',api.origin),{
      method:'POST',headers:{...auth(token),'content-type':'application/json',
        Prefer:'return=representation'},body:JSON.stringify(body)});
  };
  const saved=await store(a.session.access_token,{
    owner_uid:a.uid,event_type:'PAGE_OPENED',route:'beneficiaries'});
  expect(saved.status).toBe(201);
  const rows=await saved.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].owner_uid).toBe(a.uid);
  const spoof=await store(b.session.access_token,{
    owner_uid:a.uid,event_type:'PAGE_OPENED',route:'beneficiaries'});
  expect(spoof.status).toBeGreaterThanOrEqual(400);
  const forged=await store(a.session.access_token,{
    owner_uid:a.uid,event_type:'PAYMENT_CONFIRMED',route:'history'});
  expect(forged.status).toBeGreaterThanOrEqual(400);
  const listing=async(token:string)=>fetch(new URL('/rest/v1/taxpay_account_activity?select=id,owner_uid,event_type,route&order=occurred_at.desc',api.origin),{
    headers:auth(token)});
  const own=await listing(a.session.access_token);
  expect(own.status).toBe(200);
  expect((await own.json()).map((row:{id:string})=>row.id)).toContain(rows[0].id);
  const other=await listing(b.session.access_token);
  expect(other.status).toBe(200);
  expect(await other.json()).toEqual([]);
  const fragment=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=account_profile#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const page=await context.newPage();
  await page.goto(fragment(a.session));
  await expect(page.getByRole('heading',{name:'My recent activity'})).toBeVisible({timeout:15000});
  await expect(page.getByText('Opened page · beneficiaries')).toBeVisible();
  await context.close();
  const different=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const second=await different.newPage();
  await second.goto(fragment(b.session));
  await expect(second.getByRole('heading',{name:'My recent activity'})).toBeVisible({timeout:15000});
  await expect(second.getByText('Opened page · beneficiaries')).toHaveCount(0);
  await different.close();
});
