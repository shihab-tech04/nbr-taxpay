import {test,expect} from '@playwright/test';

/**
 * Public fictional accounts are UI-only. Authenticated SQL writes/readback and
 * Office reconciliation run separately against real disposable Auth/PostgREST.
 */
async function start(page:import('@playwright/test').Page){
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await page.locator('.citizen-taxpayer-hero__actions').getByRole('button',{name:'Make Payment'}).click();
  await expect(page.getByRole('heading',{name:'Make Payment'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment category'})).toBeVisible();
  await page.locator('.taxpay-guided-category').filter({hasText:'Advance Tax'}).click();
  await expect(page.locator('.taxpay-guided-category').filter({hasText:'Advance Tax'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Category information'})).toBeVisible();
  await expect(page.getByText(/Public demo previews run only in browser memory/)).toBeVisible();
  await page.getByRole('button',{name:/Make payment/i}).last().click();
  await expect(page.getByRole('heading',{name:'Make payment',exact:true})).toBeVisible();
}
test('public five-stage guided preview completes locally with no SQL grants or government payment',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Representative mobile viewport');
  const paymentRequests:string[]=[];
  page.on('request',r=>{if(r.url().includes('/rest/v1/rpc/sim_'))paymentRequests.push(r.url());});
  await start(page);
  await page.getByRole('textbox',{name:/Amount \(BDT\)/}).fill('120.50');
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Payment simulation'})).toBeVisible();
  await expect(page.getByText('৳120.50').first()).toBeVisible();
  expect(paymentRequests).toEqual([]);
  await page.getByRole('button',{name:'Run payment simulation',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Result'})).toBeVisible();
  await expect(page.getByText('Demo preview created',{exact:true})).toBeVisible();
  await expect(page.locator('.taxpay-guided-reference')).toHaveText(/^DEMO-/);
  await expect(page.getByText(/Nothing saved to shared SQL; no funds moved or tax credit was created/)).toBeVisible();
  await expect(page.getByText('LOCAL_PREVIEW_ONLY')).toBeVisible();
  expect(paymentRequests,'Never call anon or authenticated SQL from public demo').toEqual([]);
  await expect(page.locator('.taxpay-guided-payment')).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
});
test('public preview rejects missing and zero amounts; never creates SQL or official receipts',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Negative financial gate');
  const paymentRequests:string[]=[];
  page.on('request',r=>{if(r.url().includes('/rest/v1/rpc/sim_'))paymentRequests.push(r.url());});
  await start(page);
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('positive amount');
  await expect(page.getByRole('heading',{name:'Make payment',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:/Amount \(BDT\)/}).fill('0');
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('positive amount');
  await page.getByRole('textbox',{name:/Amount \(BDT\)/}).fill('120.50');
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await page.getByRole('button',{name:'Run payment simulation',exact:true}).click();
  await expect(page.getByText('Demo preview created',{exact:true})).toBeVisible();
  await expect(page.getByText('Simulation saved successfully')).toHaveCount(0);
  await expect(page.locator('.taxpay-guided-reference')).toHaveText(/^DEMO-/);
  expect(paymentRequests).toEqual([]);
});