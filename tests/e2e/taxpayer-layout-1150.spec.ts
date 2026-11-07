import { expect, test } from '@playwright/test';

const url = (route: string) => '/?action=' + route + '&demoUser=user1';

test('User1 dashboard omits the redundant register and lengthy data notice but preserves Activity records', async ({page}) => {
  await page.goto(url('taxpayer_home'));
  await expect(page.getByRole('heading', {name:'Overview'})).toBeVisible();
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await expect(page.locator('summary[aria-label="About Sample"]')).toHaveCount(0);
  await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
  await expect(page.getByText('Taxpayer workspace / Synthetic scenario user1')).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Transaction history'})).toHaveCount(0);
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  await page.getByRole('button', {name:'View all activity'}).click();
  await expect(page.getByRole('heading', {name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('searchbox', {name:'Search transaction reference'})).toBeVisible();
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await expect(page.getByRole('combobox', {name:'Transaction status'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').filter({visible:true}).first()).toBeVisible();
});

test('User1 bento keeps approved blue chart and accessible keyboard year selection',async({page})=>{
  await page.goto(url('taxpayer_home'));
  const hero=page.locator('.taxpay-bento-hero');
  await expect(hero).toHaveCSS('background-color','rgb(8, 85, 135)');
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const year=chart.getByRole('button',{name:/2024-2025: Total tax/});
  await year.focus();
  await page.keyboard.press('Space');
  await expect(year).toHaveAttribute('aria-current','true');
  await expect(page.getByRole('heading',{name:'How your tax is covered'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
});

test('User1 overview preserves narrow screens and expands fluidly at 1400px and wider', async ({page},info) => {
  test.skip(info.project.name !== 'mobile-375','One worker measures the full breakpoint matrix');
  test.setTimeout(120000);
  for (const width of [320,360,375,390,600,768,900,1024,1280,1399,1400,1440,1600,1920]) {
    await page.setViewportSize({width,height:850});
    await page.goto(url('taxpayer_home'));
    await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
    const dims = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement;
      return {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: el.getBoundingClientRect().width};
    });
    expect(dims.overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    expect(dims.width,'too wide at '+width).toBeLessThanOrEqual(width);
    if (width>=1400) {
      expect(dims.width,'large-desktop content did not expand at '+width).toBeGreaterThan(width * .7);
      expect(dims.width,'large-desktop content exceeds the viewport at '+width).toBeLessThan(width);
    } else if (width >= 1280) {
      expect(dims.width,'pre-1400px layout should retain its approved width').toBeLessThanOrEqual(902);
    }
    if (width<=390) {
      await expect(page.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
      await expect(page.getByRole('button',{name:'View all activity'})).toBeVisible();
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
      if(route==='ledger') {
        await expect(page.getByRole('combobox',{name:'Assessment year',exact:true})).toHaveCount(0);
        await page.getByTestId('event-tax-ledger').getByRole('button',{name:'Filter',exact:true}).click();
        await expect(page.getByRole('combobox',{name:'Filter ledger by year'})).toBeVisible();
      } else if(['account_profile','account_settings','journey'].includes(route))
        await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(0);
      else await expect(page.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
      const dims=await page.evaluate(() => ({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        content:(document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement).getBoundingClientRect().width}));
      expect(dims.overflow,route+' overflow at '+width).toBeLessThanOrEqual(2);
      if(width>=1400) {
        expect(dims.content,route+' content did not expand at '+width).toBeGreaterThan(width * .7);
      } else if(width===1280) {
        expect(dims.content,route+' should preserve its pre-1400px width').toBeLessThanOrEqual(902);
      }
      await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
    }
  }
});

test('both signed-in taxpayer profiles use available main width without horizontal overflow', async ({page},info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One worker checks both signed-in profiles and breakpoints');
  test.setTimeout(120000);
  for (const account of ['user1','user2']) {
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(account);
    await page.getByLabel('Password',{exact:true}).fill(account);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
    for (const viewport of [1280,1399,1400,1600,1920,2560]) {
      await page.setViewportSize({width:viewport,height:900});
      const size = await page.evaluate(() => {
        const main = document.querySelector('#main-content') as HTMLElement;
        const content = main.firstElementChild as HTMLElement;
        return {
          main: main.getBoundingClientRect().width,
          content: content.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(size.overflow,`${account} overflow at ${viewport}px`).toBeLessThanOrEqual(2);
      if (viewport < 1400) {
        expect(size.content,`${account} unexpectedly changed at ${viewport}px`).toBeLessThanOrEqual(1152);
      } else {
        expect(size.content,`${account} does not fill its flexible workspace at ${viewport}px`).toBeGreaterThan(size.main * .82);
        expect(size.content,`${account} exceeds main at ${viewport}px`).toBeLessThanOrEqual(size.main);
      }
    }
  }
});
