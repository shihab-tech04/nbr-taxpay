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
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
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
  await page.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
  const panel=page.locator('.taxpayer-transaction-panel');
  await expect(panel.getByTestId('convay-table-toolbar')).toBeVisible({timeout:30000});
  await expect(panel.getByRole('searchbox',{name:'Search transaction reference'})).toBeVisible();
  const filterButton=panel.getByRole('button',{name:'Filter',exact:true});
  await expect(filterButton).toHaveAttribute('aria-expanded','false');
  await filterButton.click();
  await expect(filterButton).toHaveAttribute('aria-expanded','true');
  await expect(panel.getByTestId('convay-table-filters')).toBeVisible();
  await expect(panel.getByRole('combobox',{name:'Transaction category'})).toBeVisible();
  await expect(panel.getByTestId('taxpayer-transaction-table').locator('thead th'))
    .toHaveText(['Payment','Paid by','Paid for','Reference','Payment type','Date','Amount','Status','Actions']);
  const rows=panel.getByTestId('taxpayer-transaction-table').locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(panel.getByRole('navigation',{name:'Page navigation'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Export CSV'})).toBeVisible();
  const action=rows.first().getByRole('button',{name:'Details for Pending bank reconciliation'});
  await panel.locator('.taxpay-table-viewport').evaluate(el=>{el.scrollLeft=el.scrollWidth;});
  const [viewportBox,actionBox]=await Promise.all([
    panel.locator('.taxpay-table-viewport').boundingBox(),action.boundingBox()
  ]);
  if(!viewportBox||!actionBox||actionBox.x+actionBox.width>viewportBox.x+viewportBox.width+2)
    throw new Error('Published desktop Transactions Details action is cut off');
  // Desktop has a dedicated Reference column; the duplicate inline metadata is hidden.
  await expect(rows.first().locator('td').nth(3).getByText('DEMO-PAY-PEND-01')).toBeVisible();
  await page.screenshot({path:'test-results/live-table-desktop.png',fullPage:true});
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Next'}).click();
  await expect(rows).toHaveCount(4);
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Previous'}).click();
  await expect(rows).toHaveCount(10);
  await page.setViewportSize({width:375,height:812});
  const cards=panel.getByTestId('taxpayer-transaction-mobile-cards');
  await expect(cards).toBeVisible();
  await expect(cards.locator(':scope > li')).toHaveCount(10);
  await expect(cards.locator(':scope > li').first().getByText('DEMO-PAY-PEND-01')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>2)throw new Error('Published mobile page overflows by '+overflow+' pixels');
  await page.screenshot({path:'test-results/live-table-mobile.png',fullPage:true});
  console.log('PASS: published TaxPay user1 login, integrated toolbar, nine-column Transactions, paging, 375px mobile cards');
  // User2 must use the very same approved Activity route and display either
  // verified account-scoped rows or the legitimate empty state. This catches
  // the previously observed live blank page (a hidden render error is FAIL).
  const user2=await browser.newPage({viewport:{width:1280,height:900}});
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
  await user2.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
  const historyHeading=user2.getByRole('heading',{name:'Payments and transaction history'});
  try{await expect(historyHeading).toBeVisible({timeout:30000});}
  catch(error){
    const details=await user2.evaluate(()=>({url:location.href,
      headings:[...document.querySelectorAll('h1,h2')].map(node=>node.textContent?.trim()).filter(Boolean).slice(0,14),
      signedOut:document.body?.textContent?.includes('Sign in to manage payments')??false,
      historyRecovery:!!document.querySelector('[data-testid="history-route-recovery"]')}));
    throw new Error('Live User2 History did not render after authenticated dashboard confirmation: '+JSON.stringify(details),{cause:error});
  }
  const activity2=user2.getByTestId('signed-in-payment-activity');
  await expect(activity2.getByRole('searchbox',{name:'Search transactions'})).toBeVisible();
  await expect.poll(async () => {
    if(await activity2.getByTestId('signed-in-payment-activity-table').isVisible().catch(()=>false))return true;
    if(await activity2.getByText('No transactions yet.').isVisible().catch(()=>false))return true;
    return false;
  },{timeout:30000}).toBe(true);
  await user2.reload({waitUntil:'domcontentloaded'});
  await expect(user2.getByRole('heading',{name:'Payments and transaction history'})).toBeVisible({timeout:30000});
  console.log('PASS: published user2 Activity renders persistent account-scoped History after reload');
}finally{
  await browser.close();
}
