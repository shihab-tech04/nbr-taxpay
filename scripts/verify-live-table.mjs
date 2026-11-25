import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

// Read-only production table acceptance through the existing User ID journey.
// Never bypass private-route gates or use a privileged backend credential.
const site=process.env.TAXPAY_LIVE_URL;
if(!site)throw new Error('TAXPAY_LIVE_URL is required');
const base=new URL(site);
if(base.protocol!=='https:'||base.hostname!=='shihab-tech04.github.io'||!base.pathname.startsWith('/nbr-taxpay/'))
  throw new Error('Expected the approved TaxPay Pages origin');
const url=(action)=>{const target=new URL(base);target.searchParams.set('action',action);return target.toString();};
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
// Isolate only the unrelated modal overlay for this transaction table regression.
// The dedicated live recipient smoke uses the real unread feed with no interception.
async function isolateTableOverlay(page){
 await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
  const request=route.request();
  let input;try{input=request.method()==='POST'?request.postDataJSON():null;}catch{}
  if(input?.action==='received-notices-unread')return route.fulfill({json:{success:true,data:{items:[],total:0,offset:input.offset,limit:input.limit,hasMore:false}}});
  return route.fallback();
 });
}
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await isolateTableOverlay(page);
  // Budget guard: live readback tests use bundled image fallback rather than remote CMS bytes.
  await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**', route => route.abort('blockedbyclient'));
  await page.goto(url('taxpayer_login'),{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#taxpayer-login-user-id')).toBeVisible({timeout:30000});
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await dialog.getByRole('textbox',{name:'User ID'}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  // Exercise the same user-visible OTP checkpoint as the verified live auth
  // smoke. Do not bypass OTP or assert a private table before login completes.
  const demoOtp=dialog.getByTestId('demo-otp-input');
  await expect.poll(async () =>
    await demoOtp.isVisible().catch(() => false) || /action=taxpayer_home/.test(page.url()),
    {timeout:15_000}
  ).toBe(true);
  if(await demoOtp.isVisible().catch(() => false)){
    await demoOtp.fill('111111');
    await dialog.getByRole('button',{name:'Verify code'}).click();
  }
  await expect(page).toHaveURL(/action=taxpayer_home/,{timeout:30_000});
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible({timeout:30_000});
  // Same tab keeps the existing account session. Direct anonymous history links
  // must continue to show the approved sign-in boundary.
  // Inspect the real, owner-capability-scoped list before filtering. The
  // default Activity view must never hide a successful payment's assessment year.
  const details=new Map();
  page.on('response',async r=>{
    if(r.request().method()!=='GET'||!r.ok()||!new URL(r.url()).pathname.includes('/demo-story1-taxpay/payments/'))return;
    try{const payload=await r.json();if(payload.success===true&&payload.data?.id)details.set(payload.data.id,payload);}catch{}
  });
  const ownerList=page.waitForResponse(r=>{
    const u=new URL(r.url());
    return u.pathname.endsWith('/demo-story1-taxpay/payments')&&u.searchParams.get('page')==='1'&&r.request().method()==='GET';
  },{timeout:45000});
  await page.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
  const panel=page.locator('.taxpayer-transaction-panel');
  const assessmentYear=page.getByRole('combobox',{name:'Assessment year'});
  await expect(assessmentYear).toHaveValue('all');
  const response=await ownerList;
  if(!response.ok())throw Error('Published owner payment list unavailable');
  const ownerPayments=await response.json();
  if(ownerPayments.success!==true||!Array.isArray(ownerPayments.data?.items))throw Error('Invalid owner payment list');
  const latest=ownerPayments.data.items[0];
  if(latest){
    // Parent batch reference can differ from a source payment ID. Capture
    // the same verified detail used by the existing register, not any
    // privileged backend data or fixture.
    await expect.poll(()=>details.has(latest.id),{timeout:30000}).toBe(true);
    const latestDetail=details.get(latest.id);
    const d=latestDetail.data?.data?.details;
    if(latestDetail.success!==true||latestDetail.data?.id!==latest.id||!d)throw Error('Latest owner payment detail mismatch');
    const validBatch=typeof d.batchId==='string'&&Number.isSafeInteger(d.batchItemIndex)&&d.batchItemIndex>0&&Number.isSafeInteger(d.batchItemCount)&&d.batchItemIndex<=d.batchItemCount;
    const reference=validBatch?d.batchId:latest.id;
    await expect(panel.getByTestId('taxpayer-transaction-table').locator('tbody tr').first().locator('td:nth-child(4)')).toContainText(reference,{timeout:30000});
    console.log('PASS: newest owner-scoped SQL payment is first in default all-year Activity');
  }
  await expect(panel.getByTestId('convay-table-toolbar')).toBeVisible({timeout:30000});
  await expect(panel.getByRole('searchbox',{name:'Search transaction reference'})).toBeVisible();
  const filterButton=panel.getByRole('button',{name:'Filter',exact:true});
  await filterButton.click();
  await expect(panel.getByTestId('convay-table-filters')).toBeVisible();
  await expect(panel.getByRole('combobox',{name:'Transaction category'})).toBeVisible();
  const rows=panel.getByTestId('taxpayer-transaction-table').locator('tbody tr');
  if(latest){
    await expect(panel.getByTestId('taxpayer-transaction-table').locator('thead th'))
      .toHaveText(['Payment','Paid by','Paid for','Reference','Payment type','Date','Amount','Status','Actions']);
    await expect(rows.first()).toBeVisible();
    await expect(panel.getByRole('button',{name:'Export CSV'})).toBeVisible();
    const firstRef=await rows.first().locator('td:nth-child(4)').innerText();
    const action=rows.first().getByRole('button',{name:/Details for/});
    await panel.locator('.taxpay-table-viewport').evaluate(el=>{el.scrollLeft=el.scrollWidth;});
    const [viewportBox,actionBox]=await Promise.all([panel.locator('.taxpay-table-viewport').boundingBox(),action.boundingBox()]);
    if(!viewportBox||!actionBox||actionBox.x+actionBox.width>viewportBox.x+viewportBox.width+2)
      throw new Error('Published desktop Transactions Details action is cut off');
    await page.screenshot({path:'test-results/live-table-desktop.png',fullPage:true});
    const next=panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Next'});
    if(await next.isVisible().catch(()=>false)&&await next.isEnabled()){
      await next.click();
      await expect(rows.first().locator('td:nth-child(4)')).not.toHaveText(firstRef);
      await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Previous'}).click();
      await expect(rows.first().locator('td:nth-child(4)')).toHaveText(firstRef);
    }
    await panel.getByRole('searchbox',{name:'Search transaction reference'}).fill('DEMO-');
    await expect(rows).toHaveCount(0);
    await panel.getByRole('searchbox',{name:'Search transaction reference'}).clear();
    await expect(rows.first().locator('td:nth-child(4)')).toHaveText(firstRef);
    await page.setViewportSize({width:375,height:812});
    const cards=panel.getByTestId('taxpayer-transaction-mobile-cards');
    await expect(cards).toBeVisible();
    await expect(cards.locator(':scope > li').first()).toContainText(firstRef);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>2)throw new Error('Published mobile page overflows by '+overflow+' pixels');
    await page.screenshot({path:'test-results/live-table-mobile.png',fullPage:true});
  }else await expect(panel.getByText('No transactions yet.',{exact:true})).toBeVisible();
  await expect(panel.getByText(/DEMO-PAY-|DEMO-ETDS-|DEMO-REFUND-/)).toHaveCount(0);
  console.log('PASS: published SQL-only User1 Activity, existing table and mobile cards, no bundled examples');
  // User2 must use the very same approved Activity route and display either
  // verified account-scoped rows or the legitimate empty state. This catches
  // the previously observed live blank page (a hidden render error is FAIL).
  const user2=await browser.newPage({viewport:{width:1280,height:900}});
  await isolateTableOverlay(user2);
  await user2.goto(url('taxpayer_login'),{waitUntil:'domcontentloaded',timeout:45000});
  const signIn2=user2.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await expect(signIn2.getByRole('textbox',{name:'User ID'})).toBeVisible({timeout:30000});
  await signIn2.getByRole('textbox',{name:'User ID'}).fill('user2');
  await signIn2.getByLabel('Password',{exact:true}).fill('user2');
  await signIn2.getByRole('button',{name:'Sign In',exact:true}).click();
  const otp2=signIn2.getByTestId('demo-otp-input');
  await expect.poll(async () =>
    await otp2.isVisible().catch(()=>false)||/action=taxpayer_home/.test(user2.url()),
    {timeout:15000}
  ).toBe(true);
  if(await otp2.isVisible().catch(()=>false)){
    await otp2.fill('111111');
    await signIn2.getByRole('button',{name:'Verify code'}).click();
  }
  await expect(user2).toHaveURL(/action=taxpayer_home/,{timeout:30000});
  // A pushState URL change can precede React's committed account dashboard.
  // Verify User2's rendered, owner-scoped workspace before History deep-linking.
  await expect(user2.getByTestId('dashboard-unified-preview')).toHaveAttribute('data-account-id','user2',{timeout:30000});
  await expect(user2.getByText('User ID: user2')).toBeVisible({timeout:30000});
  // Capture only scoped response shape/count and status, never credentials, TINs or payloads.
  const historyReads=new Map(), historyErrors=[];
  user2.on('pageerror',error=>{
    historyErrors.push({name:error.name,categoryLabelRead:/reading ['"](?:en|bn)['"]/.test(error.message)});
  });
  user2.on('response',async response=>{
    const u=new URL(response.url());
    if(!/action=history/.test(user2.url())||!u.pathname.endsWith('/demo-story1-taxpay/profile-history')||
       response.request().method()!=='GET'||!['payer','beneficiary'].includes(u.searchParams.get('view'))||
       u.searchParams.has('beforeId'))return;
    const view=u.searchParams.get('view');
    try{
      const body=await response.json();
      const valid=response.ok()&&body.success===true&&body.simulationOnly===true&&Array.isArray(body.data);
      historyReads.set(view,{status:response.status(),valid,count:valid?body.data.length:null,ids:valid?body.data.map(row=>row.id):[]});
    }catch{historyReads.set(view,{status:response.status(),valid:false,count:null,ids:[]});}
  });
  await user2.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
  const historyHeading=user2.getByRole('heading',{name:/^(Payments and transaction history|পেমেন্ট ও লেনদেনের ইতিহাস)$/});
  try{await expect(historyHeading).toBeVisible({timeout:30000});}
  catch(error){
    const details=await user2.evaluate(()=>({url:location.href,
      headings:[...document.querySelectorAll('h1,h2')].map(node=>node.textContent?.trim()).filter(Boolean).slice(0,14),
      signedOut:document.body?.textContent?.includes('Sign in to manage payments')??false,
      historyRecovery:!!document.querySelector('[data-testid="history-route-recovery"]')}));
    throw new Error('Live User2 History did not render after authenticated dashboard confirmation: '+JSON.stringify(details),{cause:error});
  }
  const activity2=user2.getByTestId('signed-in-payment-activity');
  await expect(activity2.getByRole('searchbox',{name:/^(Search transactions|লেনদেন খুঁজুন)$/})).toBeVisible();
  try{
    await expect.poll(async () => {
      if(await activity2.getByTestId('signed-in-payment-activity-table').isVisible().catch(()=>false))return true;
      if(await activity2.getByText(/^(No transactions yet\.|এখনও.*লেনদেন.*নেই[।.]?)$/).isVisible().catch(()=>false))return true;
      return false;
    },{timeout:30000}).toBe(true);
  }catch(error){
    const states=await user2.evaluate(()=>({
      language:document.documentElement.lang,viewport:[innerWidth,innerHeight],
      register:!!document.querySelector('[data-testid="signed-in-payment-activity"]'),
      table:!!document.querySelector('[data-testid="signed-in-payment-activity-table"]'),
      cards:!!document.querySelector('[data-testid="signed-in-payment-activity-cards"]'),
      loading:document.body.textContent?.includes('Loading transactions…')||document.body.textContent?.includes('লেনদেন লোড হচ্ছে…')||false,
      readError:document.body.textContent?.includes('Unable to load transactions.')||document.body.textContent?.includes('লেনদেন লোড করা যায়নি।')||false,
      recovery:!!document.querySelector('[data-testid="history-route-recovery"]')
    }));
    const reads=[...historyReads].map(([view,{status,valid,count}])=>({view,status,valid,count}));
    console.error('User2 redacted History diagnostics '+JSON.stringify({states,reads,historyErrors}));
    throw error;
  }
  // Keep the original table-or-empty assertion and additionally require successful
  // owner-scoped SQL evidence. Empty is legitimate only after both views read empty.
  await expect.poll(()=>historyReads.get('payer')?.valid===true,{timeout:30000}).toBe(true);
  if(historyReads.get('payer').count===0)
    await expect.poll(()=>historyReads.get('beneficiary')?.valid===true,{timeout:30000}).toBe(true);
  const selected=historyReads.get('payer').count>0?historyReads.get('payer'):historyReads.get('beneficiary');
  if(selected.count>0){
    const table=activity2.getByTestId('signed-in-payment-activity-table');
    await expect(table).toBeVisible();
    for(const id of selected.ids)await expect(table.getByText(id,{exact:true})).toBeVisible();
  }else{
    await expect(activity2.getByText(/^(No transactions yet\.|এখনো কোনো লেনদেন নেই।|এখনও.*লেনদেন.*নেই[।.]?)$/)).toBeVisible();
  }
  console.log('PASS: User2 owner-scoped SQL History response and rendered register reconcile');
  await user2.reload({waitUntil:'domcontentloaded'});
  await expect(user2.getByRole('heading',{name:/^(Payments and transaction history|পেমেন্ট ও লেনদেনের ইতিহাস)$/})).toBeVisible({timeout:30000});
  console.log('PASS: published user2 Activity renders persistent account-scoped History after reload');
}finally{
  await browser.close();
}
