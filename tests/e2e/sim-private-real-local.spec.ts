import {test,expect} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

/** Real disposable Supabase Auth + PostgREST + React/Playwright journey, no mocked transport. */
test('two bound simulated taxpayers and officer reconcile a new multi-beneficiary payment',async({browser})=>{
 const root=process.env.TAXPAY_LOCAL_SUPABASE_URL;
 const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
 const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
 if(!root||!key||!dsn)throw Error('Local Supabase required');
 const anonKey=key;
 const u=new URL(root),db=new URL(dsn);
 if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||
    !['localhost','127.0.0.1'].includes(db.hostname))throw Error('Remote writes forbidden');
 function psql(sql:string){
  const r=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',timeout:10000,
   env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGUSER:decodeURIComponent(db.username),
   PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:db.pathname.slice(1)}});
  if(r.status!==0)throw Error(r.stderr.slice(0,450));
  return r.stdout.trim();
 }
 async function request(path:string,data:Record<string,unknown>,token?:string){
  const response=await fetch(u.origin+path,{method:'POST',
   headers:{apikey:anonKey,Authorization:'Bearer '+(token||anonKey),'Content-Type':'application/json'},
   body:JSON.stringify(data)});
  const raw=await response.text();
  let result:unknown;try{result=JSON.parse(raw)}catch{result=raw}
  return {status:response.status,data:result};
 }
 async function account(name:string){
  const email=name+'-'+randomUUID()+'@example.invalid';
  const password=randomBytes(25).toString('base64url');
  const result=await request('/auth/v1/signup',{email,password});
  expect(result.status).toBe(200);
  const info=result.data as {user:{id:string};access_token:string;refresh_token:string;expires_at:number};
  expect(info.user.id).toBeTruthy();
  expect(info.access_token).toBeTruthy();
  psql("update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id='"+info.user.id+"'::uuid");
  return {id:info.user.id,email,session:info};
 }
 const payer=await account('sim-ui-user6'),beneficiary=await account('sim-ui-user7'),approver=await account('sim-ui-approver');
 psql("insert into public.taxpay_officer_roles(user_uid,role) values('"+approver.id+"'::uuid,'APPROVER')");
 for(const [profile,who] of [['user6',payer],['user7',beneficiary]] as const){
  const b=await request('/rest/v1/rpc/sim_bind_taxpayer_email',{p_user_id:profile,p_email:who.email},approver.session.access_token);
  expect(b.status,JSON.stringify(b.data)).toBe(200);
  expect(b.data).toBe(profile);
 }
 const visit=async(who:typeof payer,route:string,viewport:{width:number;height:number})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport});
  const page=await context.newPage();
  const session=who.session;
  await page.goto('/?action='+route+'#access_token='+encodeURIComponent(session.access_token)+
   '&refresh_token='+encodeURIComponent(session.refresh_token)+
   '&token_type=bearer&expires_in=3600&expires_at='+(session.expires_at||Math.floor(Date.now()/1000)+3600));
  return {page,context};
 };
 const one=await visit(payer,'history',{width:375,height:812});
 await expect(one.page.getByRole('heading',{name:'Payments and transaction history'})).toBeVisible({timeout:15000});
 await expect(one.page.getByText('User ID: user6')).toBeVisible();
 await expect(one.page.getByRole('heading',{name:'Choose payment category'})).toBeVisible();
 await one.page.getByRole('button',{name:/TAX WITH RETURN/i}).click();
 await expect(one.page.getByRole('heading',{name:'Information before payment'})).toBeVisible();
 await one.page.getByRole('button',{name:'Make Payment →'}).click();
 await one.page.getByLabel('Amount (BDT)').first().fill('150.25');
 await one.page.getByRole('button',{name:'Add beneficiary / category'}).click();
 await one.page.getByLabel('Pay for').nth(1).selectOption('user7');
 await one.page.getByLabel('Payment category').nth(1).selectOption('PENALTY');
 await one.page.getByLabel('Assessment year').nth(1).selectOption('2025-26');
 await one.page.getByLabel('Amount (BDT)').nth(1).fill('23.50');
 await one.page.getByRole('button',{name:'Simulate and save payment'}).click();
 await expect(one.page.getByRole('heading',{name:'Payment simulation completed'})).toBeVisible({timeout:15000});
 const author=await request('/rest/v1/rpc/sim_my_payment_history',{p_view:'payer'},payer.session.access_token);
 expect(author.status).toBe(200);
 const tx=(author.data as Array<{transactionId:string;id:string;totalMinor:number;allocations:Array<{beneficiary:string;amountMinor:number}>}>)
  .find(t=>t.totalMinor===17375 && t.allocations.some(a=>a.beneficiary==='user7'));
 expect(tx).toBeTruthy();
 expect(tx!.allocations.reduce((sum,a)=>sum+a.amountMinor,0)).toBe(17375);
 const admin=await request('/rest/v1/rpc/sim_payment_history',{p_user_id:null,p_view:'all'},approver.session.access_token);
 expect(admin.status).toBe(200);
 expect((admin.data as Array<{transactionId:string}>).some(t=>t.transactionId===tx!.transactionId)).toBe(true);
 const two=await visit(beneficiary,'history',{width:320,height:730});
 await expect(two.page.getByRole('heading',{name:'Payments and transaction history'})).toBeVisible({timeout:15000});
 await expect(two.page.getByText(tx!.id).first()).toBeVisible({timeout:15000});
 await expect(two.page.getByText('৳23.50').first()).toBeVisible();
 await two.page.goto('/?action=notifications');
 await expect(two.page.getByRole('heading',{name:'Payment notifications'})).toBeVisible({timeout:15000});
 await expect(two.page.getByRole('button',{name:'Mark read'})).toBeVisible({timeout:15000});
 await two.page.getByRole('button',{name:'Mark read'}).click();
 await expect(two.page.getByRole('button',{name:'Mark unread'})).toBeVisible({timeout:10000});
 const notices=await request('/rest/v1/rpc/sim_my_payment_notices',{},beneficiary.session.access_token);
 expect(notices.status).toBe(200);
 const own=(notices.data as Array<{transactionId:string;isRead:boolean}>).find(n=>n.transactionId===tx!.transactionId);
 expect(own?.isRead).toBe(true);
 await one.context.close();await two.context.close();
});
