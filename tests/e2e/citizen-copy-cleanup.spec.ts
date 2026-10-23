import { expect, test } from '@playwright/test';

const routes = ['taxpayer_home','dashboard','history','ledger','journey','certificates','corrections','account_profile','account_notifications','account_settings'];
const banned = /\b(sample|synthetic|fictional|illustrative)\b|নমুনা|কাল্পনিক/i;

test('taxpayer dashboard contains no repeated demonstration badges, tooltips or captions', async ({page}) => {
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  const main=page.getByTestId('user1-synthetic-workspace');
  await expect(main.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(main.locator('summary[aria-label="About Sample"]')).toHaveCount(0);
  expect(await main.innerText()).not.toMatch(banned);
  await expect(main.getByRole('heading',{name:'Tax coverage'})).toBeVisible();
  await expect(main.getByRole('heading',{name:'Monthly activity'})).toBeVisible();
  await expect(main.getByRole('heading',{name:'Needs review'})).toBeVisible();
  for (const number of ['৳ 180,000','৳ 80,000','৳ 75,000','৳ 25,000']) {
    await expect(main.getByText(number).first()).toBeVisible();
  }
  // This boundary remains visible: records are fictional and must not be mistaken for an authenticated account.
  await expect(page.getByRole('button',{name:'Exit workspace'})).toBeVisible();
});

test('ten user1 routes avoid repetitive example labels and keep relevant year controls', async ({page},info) => {
  test.skip(info.project.name!=='desktop-1280','One representative route matrix');
  for(const route of routes) {
    await page.goto('/?action='+route+'&demoUser=user1');
    const main=page.getByTestId('user1-synthetic-workspace');
    await expect(main).toBeVisible();
    if (['account_profile','account_settings'].includes(route))
      await expect(main.getByRole('combobox',{name:'Assessment year'})).toHaveCount(0);
    else await expect(main.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
    expect(await main.innerText(), route+' exposes repetitive jargon').not.toMatch(banned);
  }
});

test('retired connection-status page is replaced by two entry choices with preserved tax purpose coverage',async({page})=>{
  await page.goto('/?action=services&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Choose a tax payment service'})).toBeVisible();
  await expect(page.locator('.taxpayer-service-directory__card')).toHaveCount(2);
   await expect(page.locator('.taxpayer-service-directory__card[data-payment-service="TAX_WITH_RETURN"]')).toBeVisible();
   await expect(page.locator('.taxpayer-service-directory__card[data-payment-service="OTHER_TAX"]')).toBeVisible();
  await expect(page.getByText('Not connected',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/visual preview|verified application session|SQL-backed service scenarios|fictional examples/i)).toHaveCount(0);
});

test('read-only receipt remains clearly non-official even after copy reduction',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Receipt status');
  await page.goto('/?action=history&demoUser=user1');
  const main=page.getByTestId('user1-synthetic-workspace');
  await expect(main.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await main.getByRole('button',{name:'Details'}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Not a government challan')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('DEMO-PAY-PEND-01')).toBeVisible();
});
