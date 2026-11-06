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
  await page.goto(url('taxpayer_login'),{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#taxpayer-login-user-id')).toBeVisible({timeout:30000});
  await page.locator('#taxpayer-login-user-id').fill('user1');
  await page.locator('#taxpayer-login-password').fill('user1');
  await page.locator('button[form="taxpay-standalone-login-form"]').click();
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible({timeout:30000});
  // Same tab keeps the existing account session. Direct anonymous history links
  // must continue to show the approved sign-in boundary.
  await page.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
  const panel=page.locator('.taxpayer-transaction-panel');
  await expect(panel.getByTestId('convay-table-toolbar')).toBeVisible({timeout:30000});
  await expect(panel.getByTestId('convay-table-filters')).toBeVisible();
  await expect(panel.getByTestId('taxpayer-transaction-table').locator('thead th'))
    .toHaveText(['Payment','Reference','Payment type','Date','Amount','Status','Actions']);
  const rows=panel.getByTestId('taxpayer-transaction-table').locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(panel.getByRole('navigation',{name:'Page navigation'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Export CSV'})).toBeVisible();
  const action=rows.first().getByRole('button',{name:'Details for Pending bank reconciliation'});
  const [viewportBox,actionBox]=await Promise.all([
    panel.locator('.taxpay-table-viewport').boundingBox(),action.boundingBox()
  ]);
  if(!viewportBox||!actionBox||actionBox.x+actionBox.width>viewportBox.x+viewportBox.width+2)
    throw new Error('Published desktop Transactions Details action is cut off');
  await expect(rows.first().getByText('DEMO-PAY-PEND-01')).toBeVisible();
  await page.screenshot({path:'test-results/live-table-desktop.png',fullPage:true});
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Next'}).click();
  await expect(rows).toHaveCount(4);
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Previous'}).click();
  await expect(rows).toHaveCount(10);
  await page.setViewportSize({width:375,height:812});
  const cards=panel.getByTestId('taxpayer-transaction-mobile-cards');
  await expect(cards).toBeVisible();
  await expect(cards.locator(':scope > li')).toHaveCount(10);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>2)throw new Error('Published mobile page overflows by '+overflow+' pixels');
  await page.screenshot({path:'test-results/live-table-mobile.png',fullPage:true});
  console.log('PASS: published TaxPay user1 login, integrated toolbar, seven-column Transactions, paging, 375px mobile cards');
}finally{
  await browser.close();
}
