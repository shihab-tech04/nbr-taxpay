import { expect, test } from '@playwright/test';

const url = (route: string) => '/?action=' + route + '&demoUser=user1&qaScenario=1';

test('User1 dashboard omits the redundant register and lengthy data notice but preserves Activity records', async ({page}) => {
  await page.goto(url('taxpayer_home'));
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await expect(page.locator('summary[aria-label="About Sample"]')).toHaveCount(0);
  await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
  await expect(page.getByText('Taxpayer workspace / Synthetic scenario user1')).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Transaction history'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
  await expect(page.getByTestId('dashboard-chart-source')).toBeVisible();
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await page.getByRole('button', {name:'View all activity'}).click();
  await expect(page.getByRole('heading', {name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('searchbox', {name:'Search transaction reference'})).toBeVisible();
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await expect(page.getByRole('combobox', {name:'Transaction status'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').filter({visible:true}).first()).toBeVisible();
});

test('User1 bento retains the approved blue surface and keyboard-operable service bars',async({page})=>{
  await page.goto(url('taxpayer_home'));
  const hero=page.locator('.taxpay-bento-hero');
  await expect(hero).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(hero.locator('.taxpay-summary-metric').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('.taxpay-bento-position__highlight')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await page.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await page.getByTestId('dashboard-payment-extra').locator('summary').click();
  const bar=page.getByTestId('dashboard-service-breakdown').locator('[data-service="income"]');
  await bar.focus();
  await page.keyboard.press('Space');
  await expect(bar).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{name:'By payment service'})).toBeVisible();
  await expect(page.locator('.taxpay-bento-hero__actions').getByRole('button',{name:'Travel tax',exact:true})).toHaveCount(0);
});

test('User1 preview preserves its own responsive reading width and narrow-screen access', async ({page},info) => {
  test.skip(info.project.name !== 'mobile-375','One worker measures the full breakpoint matrix');
  test.setTimeout(120000);
  for (const width of [320,360,375,390,600,768,900,901,1024,1280,1399,1400,1401,1440,1600,1920,2560]) {
    await page.setViewportSize({width,height:850});
    await page.goto(url('taxpayer_home'));
    await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
    const dims = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement;
      const main = document.querySelector('#main-content') as HTMLElement;
      const styles = getComputedStyle(main);
      return {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: el.getBoundingClientRect().width,
        available: main.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)};
    });
    expect(dims.overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    expect(dims.width,'too wide at '+width).toBeLessThanOrEqual(width);
    // Direct URL-selected fictional previews are not authenticated sessions.
    // Their approved reading column stays independent of the signed-in width rule.
    if (width >= 1400) {
      expect(dims.width,'large preview did not expand at '+width).toBeGreaterThan(width * .7);
      expect(dims.width,'preview exceeds viewport at '+width).toBeLessThan(width);
    } else if (width >= 1280) {
      expect(dims.width,'preview reading column changed at '+width).toBeLessThanOrEqual(902);
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
  for (const width of [375,768,1280,1600,1920]) {
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
      const dims=await page.evaluate(() => {
        const main = document.querySelector('#main-content') as HTMLElement;
        const style = getComputedStyle(main);
        return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          content:(document.querySelector('[data-testid="user1-synthetic-workspace"]') as HTMLElement).getBoundingClientRect().width,
          available:main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)};
      });
      expect(dims.overflow,route+' overflow at '+width).toBeLessThanOrEqual(2);
      if (width >= 1400) {
        expect(dims.content,route+' preview did not expand at '+width).toBeGreaterThan(width * .7);
      } else if (width === 1280) {
        if (['history','ledger','certificates','corrections'].includes(route))
          expect(dims.content,route+' record register width').toBeGreaterThan(940);
        else
          expect(dims.content,route+' preview reading width').toBeLessThanOrEqual(902);
      }
      await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
    }
  }
});

test('both signed-in taxpayer profiles use the available width capped at 1300px', async ({page},info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One worker checks both signed-in profiles and breakpoints');
  test.setTimeout(120000);
  for (const account of ['user1','user2']) {
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(account);
    await page.getByLabel('Password',{exact:true}).fill(account);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
    for (const viewport of [1280,1399,1400,1401,1440,1600,1920,2560]) {
      await page.setViewportSize({width:viewport,height:900});
      const size = await page.evaluate(() => {
        const main = document.querySelector('#main-content') as HTMLElement;
        const content = main.firstElementChild as HTMLElement;
        const style = getComputedStyle(main);
        return {
          available: main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          content: content.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(size.overflow,`${account} overflow at ${viewport}px`).toBeLessThanOrEqual(2);
      const expected = Math.min(size.available, viewport > 1400 ? 1300 : Number.POSITIVE_INFINITY);
      expect(Math.abs(size.content - expected),`${account} responsive width at ${viewport}px`).toBeLessThanOrEqual(2);
      expect(size.content,`${account} exceeds the 1300px cap at ${viewport}px`).toBeLessThanOrEqual(1300);
    }
  }
});

test('Phase 8 keeps English and Bengali signed-in navigation without overflow', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One worker checks both languages');
  test.setTimeout(120000);
  // Authenticate through the existing browser-local sample-account journey;
  // an unsigned ?demoUser URL is intentionally not an authenticated account.
  await page.goto('/?action=taxpayer_login');
  await page.locator('#taxpayer-login-user-id').fill('user1');
  await page.locator('#taxpayer-login-password').fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.locator('.taxpay-citizen-shell.taxpay-authenticated-content')).toBeVisible();
  for (const language of ['en', 'bn']) {
    for (const width of [375, 1280, 1400, 1920]) {
      await page.setViewportSize({width, height:900});
      if (await page.locator('.taxpay-citizen-shell').getAttribute('lang') !== language) {
        await page.setViewportSize({width:1280,height:900});
        await page.locator('.taxpayer-reference-rail-bottom button').filter({hasText:language==='bn'?'বাংলা':'English'}).click();
        await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang',language);
      }
      await page.setViewportSize({width,height:900});
      await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
      const results = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mobileDock: getComputedStyle(document.querySelector('.citizen-bottom-nav') as HTMLElement).display
      }));
      expect(results.overflow,language+' overflow at '+width).toBeLessThanOrEqual(2);
      if (width <= 900) expect(results.mobileDock,language+' mobile dock').not.toBe('none');
      if (width > 1400) await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
    }
  }
});
