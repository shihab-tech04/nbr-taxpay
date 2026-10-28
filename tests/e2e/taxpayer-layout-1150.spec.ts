import { expect, test } from '@playwright/test';

const url = (route: string) => '/?action=' + route + '&demoUser=user1';

test('User1 dashboard omits the redundant register and lengthy data notice but preserves Activity records', async ({page}) => {
  await page.goto(url('taxpayer_home'));
  await expect(page.getByRole('heading', {name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await expect(page.locator('summary[aria-label="About Sample"]')).toHaveCount(0);
  await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
  await expect(page.getByText('Taxpayer workspace / Synthetic scenario user1')).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Transaction history'})).toHaveCount(0);
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  await page.getByRole('button', {name:'Open transaction history'}).click();
  await expect(page.getByRole('heading', {name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('searchbox', {name:'Search transaction reference'})).toBeVisible();
  await expect(page.getByRole('combobox', {name:'Transaction status'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
});

test('User1 charts use TaxPay blue tokens, and category filters work by keyboard', async ({page}) => {
  await page.goto(url('taxpayer_home'));
  const active = page.getByRole('button', {name:'Income tax', exact:true});
  await expect(active).toHaveCSS('background-color','rgb(234, 242, 255)');
  const travel = page.getByRole('button', {name:'Travel tax', exact:true});
  await travel.focus();
  await page.keyboard.press('Space');
  await expect(travel).toHaveAttribute('aria-pressed','true');
  await expect(travel).toHaveCSS('background-color','rgb(234, 242, 255)');
  await expect(page.getByRole('heading',{name:'Tax coverage'})).toBeVisible();
});

test('User1 overview fits narrow phones, tablets and large desktops, using Sobaike Public's 900px reading column', async ({page},info) => {
  test.skip(info.project.name !== 'mobile-375','One worker measures eleven explicit viewport widths');
  test.setTimeout(120000);
  for (const width of [320,360,375,390,600,768,900,1024,1280,1440,1600,1920]) {
    await page.setViewportSize({width,height:850});
    await page.goto(url('taxpayer_home'));
    await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
    const dims = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement;
      return {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: el.getBoundingClientRect().width};
    });
    expect(dims.overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    expect(dims.width,'too wide at '+width).toBeLessThanOrEqual(width);
    if (width>=1600) {
      expect(dims.width,'too narrow at '+width).toBeGreaterThanOrEqual(890);
      expect(dims.width,'exceeds Sobaike 900px target at '+width).toBeLessThanOrEqual(902);
    }
    if (width<=390) {
      await expect(page.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Open transaction history'})).toBeVisible();
    }
  }
});

test('All taxpayer inner pages preserve responsive access without a full-width sample warning', async ({page},info) => {
  test.skip(info.project.name !== 'desktop-1280','Representative route and viewport matrix');
  test.setTimeout(120000);
  for (const width of [375,768,1280,1600]) {
    await page.setViewportSize({width,height:850});
    for (const route of ['taxpayer_home','dashboard','history','ledger','journey','certificates','corrections','account_profile','account_notifications','account_settings']) {
      await page.goto(url(route));
      await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
      if(['account_profile','account_settings'].includes(route))
        await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(0);
      else await expect(page.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
      const dims=await page.evaluate(() => ({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        content:(document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement).getBoundingClientRect().width}));
      expect(dims.overflow,route+' overflow at '+width).toBeLessThanOrEqual(2);
      if(width>=1600) {
        expect(dims.content,route+' too narrow at '+width).toBeGreaterThanOrEqual(890);
        expect(dims.content,route+' exceeds Sobaike target at '+width).toBeLessThanOrEqual(902);
      }
      await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
    }
  }
});
