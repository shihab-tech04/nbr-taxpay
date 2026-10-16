import {test,expect,type Browser} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

/**
 * Real disposable cross-application browser acceptance, never hosted taxpayer access:
 * TaxPay React → PostgreSQL → Office React (three distinct officers) → beneficiary notice.
 * Starts both original Vite applications, no route/network mocks.
 */
test('taxpayer → shared SQL → Maker/Reviewer/Approver Office UI → beneficiary notice',async({browser})=>{
 test.setTimeout(150_000);
 const root=process.env.TAXPAY_LOCAL_SUPABASE_URL;
 const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
 const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
 if(!root||!key||!dsn)throw Error('Missing disposable Auth/PostgreSQL environment');
 const api=new URL(root),db=new URL(dsn);
 if(api.protocol!=='http:'||!['localhost','127.0.0.1'].includes(api.hostname)||
    !['localhost','127.0.0.1'].includes(db.hostname))throw Error('Refuse non-loopback E2E targets');
 const runSQL=(sql:string)=>{
  const r=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',sql],{
    encoding:'utf8',timeout:12000,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',
    PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGDATABASE:db.pathname.slice(1)}
  });
  if(r.status!==0)throw Error('Disposable SQL failed: '+r.stderr.slice(0,600));
  return r.stdout.trim();
 };
 const post=async(path:string,body:Record<string,unknown>,token?:string)=>{
  const response=await fetch(api.origin+path,{method:'POST',
   headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const raw=await response.text();let data:any;try{data=JSON.parse(raw)}catch{data=raw}
  return {status:response.status,data};
 };
 const rpc=(name:string,body:Record<string,unknown>,token?:string)=>post('/rest/v1/rpc/'+name,body,token);
 async function account(label:string){
  const email=label+'-'+randomUUID()+'@example.invalid',password=randomBytes(28).toString('base64url');
  const r=await post('/auth/v1/signup',{email,password});
  expect(r.status,JSON.stringify(r.data)).toBe(200);
  const u=r.data as {user:{id:string},access_token:string,refresh_token:string,expires_at:number};
  expect(u.user?.id).toBeTruthy();expect(u.access_token).toBeTruthy();
  runSQL("update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id='"+u.user.id+"'::uuid");
  return {...u,email,id:u.user.id};
 }
 const payer=await account('taxpay-e2e-payer'),beneficiary=await account('taxpay-e2e-beneficiary');
 const maker=await account('taxpay-e2e-maker'),reviewer=await account('taxpay-e2e-reviewer'),approver=await account('taxpay-e2e-approver');
 for(const [person,role] of [[maker,'MAKER'],[reviewer,'REVIEWER'],[approver,'APPROVER']] as const){
  runSQL("insert into public.taxpay_officer_roles(user_uid,role) values('"+person.id+"'::uuid,'"+role+"')");
 }
 // Profiles 8/9 are deliberately disjoint from the previously executed 1/2 and 6/7 local test fixtures.
 for(const [user,profile] of [[payer,'user8'],[beneficiary,'user9']] as const){
  const bound=await rpc('sim_bind_taxpayer_email',{p_user_id:profile,p_email:user.email},approver.access_token);
  expect(bound.status,JSON.stringify(bound.data)).toBe(200);
  expect(bound.data).toBe(profile);
 }
 type Identity=typeof payer;
 async function visit(identity:Identity,url:string,viewport={width:375,height:812}){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.goto(url+'#access_token='+encodeURIComponent(identity.access_token)+
    '&refresh_token='+encodeURIComponent(identity.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+(identity.expires_at||Math.floor(Date.now()/1000)+3600));
  return {context,page};
 }
 const taxpayer=await visit(payer,'http://127.0.0.1:4173/?action=history');
 await expect(taxpayer.page.getByRole('heading',{name:'Payments and transaction history'})).toBeVisible({timeout:16000});
 await expect(taxpayer.page.getByText('User ID: user8')).toBeVisible();
 await expect(taxpayer.page.getByRole('heading',{name:'Choose payment category'})).toBeVisible();
 await taxpayer.page.getByRole('button',{name:/TAX WITH RETURN/i}).click();
 await expect(taxpayer.page.getByRole('heading',{name:'Information before payment'})).toBeVisible();
 await taxpayer.page.getByRole('button',{name:'Make Payment →'}).click();
 await taxpayer.page.getByLabel('Amount (BDT)').first().fill('123.45');
 await taxpayer.page.getByRole('button',{name:'Add beneficiary / category'}).click();
 await taxpayer.page.getByLabel('Pay for').nth(1).selectOption('user9');
 await taxpayer.page.getByLabel('Payment category').nth(1).selectOption('PENALTY');
 await taxpayer.page.getByLabel('Amount (BDT)').nth(1).fill('6.55');
 await taxpayer.page.getByRole('button',{name:'Simulate and save payment'}).click();
 await expect(taxpayer.page.getByRole('heading',{name:'Payment simulation completed'})).toBeVisible({timeout:18000});
 const own=await rpc('sim_my_payment_history',{p_view:'payer'},payer.access_token);
 expect(own.status,JSON.stringify(own.data)).toBe(200);
 const item=(own.data as Array<{id:string;transactionId:string;totalMinor:number;reviewStatus:string;
     allocations:Array<{beneficiary:string;amountMinor:number}>}>)
     .find(x=>x.totalMinor===13000&&x.allocations.some(a=>a.beneficiary==='user9'&&a.amountMinor===655));
 expect(item).toBeTruthy();expect(item!.allocations.length).toBe(2);
 expect(item!.reviewStatus).toBe('PENDING_OFFICER');
 console.log('CROSS_APP E1 PASS: taxpayer UI SQL submission and exact payer/beneficiary allocations');

 const strangerShell=await browser.newContext({viewport:{width:1280,height:900}});
 await strangerShell.addInitScript(()=>{
   localStorage.setItem('gov_ui_auth',JSON.stringify({isAuthenticated:true,userId:'forged-admin'}));
 });
 const forgeryPage=await strangerShell.newPage();
 await forgeryPage.goto('http://127.0.0.1:4174/payments/transactions');
 await expect(forgeryPage.getByLabel('User ID')).toBeVisible({timeout:20000});
 await expect(forgeryPage.getByRole('heading',{name:'Officer review inbox'})).toHaveCount(0);
 await strangerShell.close();
 console.log('CROSS_APP E2 PASS: forged localStorage Office login does not authorize connected Admin shell');

 const stages=[
  {person:maker,role:'MAKER',button:'Maker: acknowledge',after:'MAKER_ACKNOWLEDGED',reason:'Maker confirms fictional taxpayer request'},
  {person:reviewer,role:'REVIEWER',button:'Reviewer: verify',after:'REVIEWER_VERIFIED',reason:'Independent Reviewer confirms beneficiary and totals'},
  {person:approver,role:'APPROVER',button:'Approver: close review',after:'APPROVER_CLOSED',reason:'Approver closes fictional simulation after review'}
 ];
 for(const stage of stages){
  const office=await visit(stage.person,'http://127.0.0.1:4174/payments/transactions',{width:1280,height:900});
  const inbox=office.page.getByRole('region',{name:'Connected officer review'});
  await expect(inbox.getByRole('heading',{name:'Officer review inbox'})).toBeVisible({timeout:20000});
  await expect(inbox.getByText('Authorized role: '+stage.role)).toBeVisible({timeout:20000});
  const panel=office.page.getByRole('region',{name:'Simulation review actions'});
  await expect(panel.getByRole('heading',{name:'Shared SQL — simulated transaction decisions'})).toBeVisible({timeout:20000});
  await panel.getByRole('button',{name:new RegExp(item!.id)}).click();
  await expect(panel.getByText('Status: '+(stage.role==='MAKER'?'PENDING_OFFICER':
      stage.role==='REVIEWER'?'MAKER_ACKNOWLEDGED':'REVIEWER_VERIFIED'))).toBeVisible();
  await panel.locator('#sim-review-reason').fill(stage.reason);
  await panel.getByRole('button',{name:stage.button}).click();
  await expect(panel.getByText('Status: '+stage.after)).toBeVisible({timeout:15000});
  const current=await rpc('sim_payment_history',{p_user_id:null,p_view:'all'},stage.person.access_token);
  expect(current.status,JSON.stringify(current.data)).toBe(200);
  expect(current.data.find((x:any)=>x.transactionId===item!.transactionId)?.reviewStatus).toBe(stage.after);
  await office.context.close();
  console.log('CROSS_APP E2 PASS: '+stage.role+' UI action, server transition and read-back');
 }
 const beneficiaryUI=await visit(beneficiary,'http://127.0.0.1:4173/?action=notifications',{width:320,height:730});
 await expect(beneficiaryUI.page.getByRole('heading',{name:'Payment notifications'})).toBeVisible({timeout:20000});
 await expect(beneficiaryUI.page.getByText('Officer Approver closed the review').first()).toBeVisible({timeout:17000});
 const notices=await rpc('sim_my_payment_notices',{},beneficiary.access_token);
 expect(notices.status).toBe(200);
 expect((notices.data as Array<{transactionId:string;messageCode:string}>).filter(n=>n.transactionId===item!.transactionId).length).toBe(4);
 expect((notices.data as Array<{transactionId:string;messageCode:string}>).some(n=>n.transactionId===item!.transactionId&&n.messageCode==='SIM_OFFICER_APPROVER_CLOSED')).toBe(true);
 const final=await rpc('sim_my_payment_history',{p_view:'payer'},payer.access_token);
 const tx=final.data.find((x:any)=>x.transactionId===item!.transactionId);
 expect(tx.reviewStatus).toBe('APPROVER_CLOSED');
 expect(tx.state).toBe('SIMULATED');
 expect(tx.totalMinor).toBe(13000);
 expect(tx.events.slice(-3).map((e:any)=>e.action)).toEqual(['OFFICER_MAKER_ACKNOWLEDGED','OFFICER_REVIEWER_VERIFIED','OFFICER_APPROVER_CLOSED']);
 expect(runSQL("select count(*) from public.sim_payment_officer_decisions where transaction_id='"+item!.transactionId+"'::uuid")).toBe('3');
 expect(runSQL("select count(distinct officer_uid) from public.sim_payment_officer_decisions where transaction_id='"+item!.transactionId+"'::uuid")).toBe('3');
 expect(runSQL("select (simulation_only and state='SIMULATED' and review_status='APPROVER_CLOSED') from public.sim_payment_transactions where id='"+item!.transactionId+"'::uuid")).toBe('t');
 console.log('CROSS_APP E3 PASS: beneficiary React notifications, three distinct officer audits, no statutory credit');
 await taxpayer.context.close();await beneficiaryUI.context.close();
});
