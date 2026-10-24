import {test,expect} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

/** Real TaxPay private review → original Office React UI → private account notifications.
 * This test refuses hosted endpoints, uses only disposable local Auth/PostgREST/PostgreSQL,
 * and never simulates a statutory payment or grants a real tax credit.
 * All positive decisions require read-back from the disposable SQL database.
 */
test('general authenticated taxpayer private draft to officer decisions to owner notification',async({browser})=>{
 test.setTimeout(135_000);
 const root=process.env.TAXPAY_LOCAL_SUPABASE_URL;
 const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
 const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
 if(!root||!key||!dsn)throw Error('Disposable local Auth/DB required');
 const u=new URL(root),db=new URL(dsn);
 if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||
  !['127.0.0.1','localhost'].includes(db.hostname))throw Error('Refusing hosted or remote E2E');
 function sql(query:string){
  const r=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',timeout:12000,
   env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',
    PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),
    PGDATABASE:decodeURIComponent(db.pathname.slice(1))}});
  if(r.status!==0)throw Error('Local SQL read-back failed: '+r.stderr.slice(0,600));
  return r.stdout.trim();
 }
 async function account(label:string){
  const email='review-ui-'+label+'-'+randomUUID()+'@example.invalid';
  const password=randomBytes(28).toString('base64url');
  const response=await fetch(u.origin+'/auth/v1/signup',{method:'POST',
   headers:{apikey:key!,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const body=await response.json();
  expect(response.status,JSON.stringify(body)).toBe(200);
  expect(body.user?.id).toBeTruthy();expect(body.access_token).toBeTruthy();
  return {...body,email,id:body.user.id} as {id:string;email:string;access_token:string;refresh_token:string;expires_at:number};
 }
 const payer=await account('payer'),outsider=await account('outsider');
 const maker=await account('maker'),reviewer=await account('reviewer'),approver=await account('approver');
 for(const [u,role] of [[maker,'MAKER'],[reviewer,'REVIEWER'],[approver,'APPROVER']] as const)
  sql("insert into public.taxpay_officer_roles(user_uid,role) values('"+u.id+"'::uuid,'"+role+"')");
 async function rpc(user:typeof payer,method:string,body:Record<string,unknown>){
  const z=await fetch(u.origin+'/rest/v1/rpc/'+method,{method:'POST',
   headers:{apikey:key!,Authorization:'Bearer '+user.access_token,'Content-Type':'application/json'},
   body:JSON.stringify(body)});
  return {status:z.status,data:await z.json()};
 }
 async function enter(person:typeof payer,url:string){
  const context=await browser.newContext({viewport:{width:375,height:812}});
  const page=await context.newPage();
  await page.goto(url+'#access_token='+encodeURIComponent(person.access_token)+
   '&refresh_token='+encodeURIComponent(person.refresh_token)+
   '&token_type=bearer&expires_in=3600&expires_at='+(person.expires_at||Math.floor(Date.now()/1000)+3600));
  return {page,context};
 }
 const ownerUI=await enter(payer,'http://127.0.0.1:4173/?action=secure_workspace');
 await expect(ownerUI.page.getByRole('heading',{name:'Signed-in application user'})).toBeVisible({timeout:16000});
 const draftForm=ownerUI.page.locator('.taxpayer-reference-secure form').filter({has:ownerUI.page.getByRole('heading',{name:'Save a private planning draft'})});
 await draftForm.getByLabel('Assessment-year label (not verified)').fill('2026-27');
 await draftForm.getByLabel('Proposed amount (BDT)').fill('134.75');
 const nonce='ISOLATED-PRIVATE-REVIEW-'+randomUUID().slice(0,6);
 await draftForm.getByLabel('Private note (optional)').fill(nonce);
 await draftForm.getByRole('button',{name:'Save draft to database'}).click();
 await expect(ownerUI.page.getByRole('status').filter({hasText:'Private draft saved to Supabase'})).toBeVisible({timeout:16000});
 await expect(ownerUI.page.getByText(nonce)).toBeVisible();
 const submitRegion=ownerUI.page.getByRole('region',{name:'Shared review requests'});
 await expect(submitRegion.getByRole('heading',{name:'Officer review requests'})).toBeVisible({timeout:14000});
 await submitRegion.getByRole('button',{name:'Send for review'}).click();
 await expect(submitRegion.getByText('Submitted for officer review')).toBeVisible({timeout:18000});
 const ids=sql("select id::text from public.taxpay_payment_requests where owner_uid='"+payer.id+"'::uuid and amount_minor=13475");
 const requestId=ids.split('\n').find(x=>/^[a-f0-9-]{36}$/.test(x));
 expect(requestId).toBeTruthy();
 const owner=await fetch(u.origin+'/rest/v1/taxpay_payment_requests?select=id,owner_uid,request_status,amount_minor,financial_receipt_status,tax_credit_status&id=eq.'+requestId,
  {headers:{apikey:key!,Authorization:'Bearer '+payer.access_token}});
 expect(owner.status).toBe(200);
 const rows=await owner.json();
 expect(rows).toEqual([{id:requestId,owner_uid:payer.id,request_status:'SUBMITTED_FOR_REVIEW',amount_minor:13475,financial_receipt_status:'NOT_VERIFIED',tax_credit_status:'NOT_VERIFIED'}]);
 const forbidden=await fetch(u.origin+'/rest/v1/taxpay_payment_requests?select=id&id=eq.'+requestId,
  {headers:{apikey:key!,Authorization:'Bearer '+outsider.access_token}});
 expect(forbidden.status).toBe(200);expect(await forbidden.json()).toEqual([]);
 console.log('PRIVATE_CROSSAPP E1 PASS: taxpayer UI draft and review submission, ownership and financial locks');

 const phases=[
  {person:maker,role:'MAKER',label:'Acknowledge',reason:'Maker verifies nonfinancial request',status:'ACKNOWLEDGED'},
  {person:reviewer,role:'REVIEWER',label:'Request information',reason:'Reviewer requests supporting simulation details',status:'INFO_REQUESTED'},
  {person:approver,role:'APPROVER',label:'Close review',reason:'Approver closes the nonfinancial simulation review',status:'REVIEW_CLOSED'}
 ];
 for(const stage of phases){
  const office=await enter(stage.person,'http://127.0.0.1:4174/payments/transactions');
  const inbox=office.page.getByRole('region',{name:'Connected officer review'});
  await expect(inbox.getByRole('heading',{name:'Officer review inbox'})).toBeVisible({timeout:20000});
  await expect(inbox.getByText('Authorized role: '+stage.role)).toBeVisible({timeout:20000});
  await inbox.getByRole('button',{name:new RegExp(requestId!)}).click();
  await expect(inbox.getByText(requestId!,{exact:true})).toBeVisible();
  await inbox.locator('#office-review-reason').fill(stage.reason);
  await inbox.getByRole('button',{name:stage.label,exact:true}).click();
  await expect(inbox.getByRole('status').filter({hasText:'Action recorded in SQL'})).toBeVisible({timeout:14000});
  const status=sql("select request_status from public.taxpay_payment_requests where id='"+requestId+"'::uuid");
  expect(status).toBe(stage.status);
  await office.context.close();
  console.log('PRIVATE_CROSSAPP E2 PASS: '+stage.role+' action via original Office UI and SQL');
 }
 await ownerUI.page.reload();
 await expect(ownerUI.page.getByRole('heading',{name:'Signed-in application user'})).toBeVisible({timeout:17000});
 const reviewAfter=ownerUI.page.getByRole('region',{name:'Shared review requests'});
 await expect(reviewAfter.getByText('Review closed')).toBeVisible({timeout:18000});
 await expect(reviewAfter.getByText('Officer completed the review')).toBeVisible({timeout:18000});
 const final=sql("select request_status||','||financial_receipt_status||','||tax_credit_status from public.taxpay_payment_requests where id='"+requestId+"'::uuid");
 expect(final).toBe('REVIEW_CLOSED,NOT_VERIFIED,NOT_VERIFIED');
 expect(sql("select count(*) from public.taxpay_review_decisions where request_id='"+requestId+"'::uuid")).toBe('3');
 expect(sql("select count(distinct officer_uid) from public.taxpay_review_decisions where request_id='"+requestId+"'::uuid")).toBe('3');
 expect(sql("select count(*) from public.taxpay_in_app_notifications where request_id='"+requestId+"'::uuid and recipient_uid='"+payer.id+"'::uuid")).toBe('4');
 const accountPage=await ownerUI.context.newPage();
 await accountPage.goto('http://127.0.0.1:4173/?action=account_notifications');
 await expect(accountPage.getByRole('heading',{name:'Account notifications'})).toBeVisible({timeout:16000});
 await expect(accountPage.getByText('Officer completed the review')).toBeVisible({timeout:17000});
 // The global Notifications entry must resolve to this owner-only inbox even
 // when a real authenticated TaxPay user has no fictional demo-payment profile.
 const globalNotificationsPage=await ownerUI.context.newPage();
 await globalNotificationsPage.goto('http://127.0.0.1:4173/?action=notifications');
 await expect(globalNotificationsPage.getByRole('heading',{name:'Account notifications'})).toBeVisible({timeout:18000});
 await expect(globalNotificationsPage.getByText('Officer completed the review')).toBeVisible({timeout:18000});
 await globalNotificationsPage.close();
 console.log('PRIVATE_CROSSAPP E3 PASS: taxpayer review status and notification read-back, no receipt/credit');
 await accountPage.close();await ownerUI.context.close();
});