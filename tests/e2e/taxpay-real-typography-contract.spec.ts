import { expect, test } from '@playwright/test';
import { mockPublishedBannerCms } from './mock-published-banners';
test.beforeEach(async ({page}) => { await mockPublishedBannerCms(page); });

/**
 * Real rendered Taxpayer surfaces — never substitute probe elements for
 * actual navigation, headings, payment labels, buttons or register cells.
 * English/Bengali; 320px phone through 1920px desktop.
 * Read-only: no payment submission or hosted data writes.
 */
const px = async (page: import('@playwright/test').Page, selector: string) => {
  const element = page.locator(selector).first();
  await expect(element, 'Missing rendered element: ' + selector).toHaveCount(1);
  return element.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
};
const size = async (page: import('@playwright/test').Page, selector: string, expected: number) =>
  expect(await px(page, selector), selector).toBe(expected);
const noOverflow = async (page: import('@playwright/test').Page, width: number, lang: string) => {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal page overflow: ' + width + '/' + lang).toBeLessThanOrEqual(2);
};

test('public homepage uses balanced lighter type roles without crowding footer in EN/BN', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Single run samples all responsive breakpoints');
  test.setTimeout(120000);
  for (const width of [320,375,390,480,767,768,1024,1280,1920]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize({width,height:900});
      await page.goto('/?action=landing&lang='+lang);
      await expect(page.locator('.public-benefits__heading h2')).toBeVisible();
      await size(page,'.public-home-nav a',14);
      // Below 901px the desktop PublicHomeHeader is hidden; the visible mobile
      // shell uses CitizenNavigation. Never assert a hidden desktop duplicate.
      if (width >= 901) await size(page,'.public-home-language',14);
      await size(page,'.public-footer__identity p',width>=1121?13:12);
      await size(page,'.public-footer__bottom p',12);
      await expect(page.getByRole('button',{name:lang==='bn'?'অন্যান্য কর':'Other Tax',exact:true})).toBeVisible();
      await size(page,'.public-hero-carousel__travel',14);
      await size(page,'.public-guest-actions .public-guest-action',14);
      await size(page,'.public-benefits__heading h2',width>=768?20:18);
      await size(page,'.public-record-discovery__heading h2',width>=768?20:18);
      await size(page,'.public-record-discovery__heading p',14);
      await size(page,'.public-benefits__copy h3',15);
      await size(page,'.public-benefits__copy p',14);
      await size(page,'.public-footer__navs a',width>=1121?14:13);
      await size(page,'.public-hero-carousel__slide.public-information-hero .citizen-public-hero__copy h2',width>=1024?28:width>=768?26:width>=480?24:22);
      await size(page,'.public-hero-carousel__slide.public-information-hero .citizen-public-hero__copy > p:not(.citizen-public-hero__eyebrow)',15);
      // On phones Help is an icon-only 44px control: its label span is hidden.
      if (width >= 901) await size(page,'.public-help-launch',14);
      await noOverflow(page,width,lang);
    }
  }
});

test('real payment chooser, stage titles and form controls are readable at narrow widths', async ({page},info) => {
  test.skip(info.project.name !== 'mobile-375', 'Single run covers both languages and width classes');
  test.setTimeout(120000);
  for(const width of [320,375,768,1280]) {
    for(const lang of ['en','bn']){
      await page.setViewportSize({width,height:900});
      await page.goto('/?action=landing&lang='+lang);
      await page.locator('.public-benefits__item[data-benefit="payments"]').click();
      const dialog=page.getByRole('dialog').last();
      await expect(dialog).toBeVisible();
      await size(page,'.taxpay-modal__title',20);
      const walkin = dialog.locator('.taxpay-unified-entry__walkin');
      await expect(walkin).toBeVisible();
      await size(page,'.taxpay-unified-entry__walkin',16);
      await walkin.click();
      await expect(dialog.locator('.taxpay-modal__title')).toBeVisible();
      await size(page,'.taxpay-modal__title',20);
      const firstInput = dialog.locator('input:not([type="checkbox"]):not([type="radio"])').first();
      await expect(firstInput).toBeVisible();
      expect(await firstInput.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(16);
      await noOverflow(page,width,lang);
    }
  }
});

test('real authenticated history keeps 16px tabular headers and cells', async ({page},info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Render actual 9-column register at desktop');
  for(const lang of ['en','bn']){
    await page.goto('/?action=history&demoUser=user1&qaScenario=1&scenarioYear=2025-2026&lang='+lang);
    const table=page.getByTestId('taxpayer-transaction-table');
    await expect(table).toBeVisible();
    await size(page,'[data-testid="taxpayer-transaction-table"] thead th',16);
    await size(page,'[data-testid="taxpayer-transaction-table"] tbody td',16);
    await noOverflow(page,1280,lang);
  }
});


/* Real-element font-weight acceptance complements the preceding size-only
 * contract. Avoid style probes and protect signed-in plus public EN/BN UI. */
const fontWeight = async (page: import('@playwright/test').Page, selector: string) => {
  const element = page.locator(selector).first();
  await expect(element, 'Missing visible typography target: ' + selector).toBeVisible();
  return element.evaluate(node => Number(getComputedStyle(node).fontWeight));
};

test('public semantic font weights stay hierarchical across EN/BN phones, tablets and desktops', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Explicitly exercises all six viewport widths');
  test.setTimeout(120000);
  for (const width of [320,375,480,768,1024,1920]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize({width,height:900});
      await page.goto('/?action=landing&lang='+lang);
      await expect(page.locator('.public-benefits__heading h2')).toBeVisible();
      expect(await fontWeight(page,'.public-hero-carousel__slide.public-information-hero .citizen-public-hero__copy h2')).toBe(600);
      expect(await fontWeight(page,'.public-benefits__heading h2')).toBe(600);
      expect(await fontWeight(page,'.public-record-discovery__heading h2')).toBe(600);
      expect(await fontWeight(page,'.public-benefits__copy h3')).toBe(500);
      expect(await fontWeight(page,'.public-record-discovery__heading p')).toBe(400);
      expect(await fontWeight(page,'.public-record-discovery__heading h2')).toBe(600);
      expect(await fontWeight(page,'.public-benefits__copy p')).toBe(400);
      if (width >= 901) expect(await fontWeight(page,'.public-footer__navs a')).toBe(500);
      if (width >= 901) expect(await fontWeight(page,'.public-help-launch')).toBe(500);
      // Desktop nav is visible at >=901px; the public mobile-shell may hide
      // this duplicate desktop header and use its own accessible navigation.
      if (width >= 901) expect(await fontWeight(page,'.public-home-nav a')).toBe(500);
      await noOverflow(page,width,lang);
    }
  }
});

test('real taxpayer history preserves label/record weight contrast', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Test actual register cells, not fixture classes');
  for (const lang of ['en','bn']) {
    await page.goto('/?action=history&demoUser=user1&qaScenario=1&scenarioYear=2025-2026&lang='+lang);
    await expect(page.getByTestId('taxpayer-transaction-table')).toBeVisible();
    expect(await fontWeight(page,'[data-testid="taxpayer-transaction-table"] thead th')).toBe(600);
    expect(await fontWeight(page,'[data-testid="taxpayer-transaction-table"] tbody td')).toBe(400);
  }
});


/**
 * Deep post-release audit of signed-in typography on REAL routes.
 * The prior baseline sampled public home at all widths but inspected
 * authenticated font weights primarily on desktop History.
 * Sign in through the existing approved local demo account and use the
 * actual persisted session; query parameters alone aren't authentication.
 * No mutation of beneficiary, payment or SQL data is allowed.
 */
test('signed-in headings and navigation retain semantic hierarchy on every viewport in EN and BN', async ({page},info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One real session covers all widths and locales');
  test.setTimeout(360000);
  await page.goto('/?action=taxpayer_login');
  await page.locator('#taxpayer-login-user-id').fill('user1');
  await page.locator('#taxpayer-login-password').fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.locator('.taxpay-citizen-shell.taxpay-authenticated-content')).toBeVisible();

  const widths = [320,375,480,768,1024,1440,1920];
  const routes = ['taxpayer_home','history','ledger','beneficiaries','account_profile','corrections'] as const;
  for (const lang of ['en','bn'] as const) {
    await page.setViewportSize({width:1280,height:900});
    const shell = page.locator('.taxpay-citizen-shell');
    if (await shell.getAttribute('lang') !== lang) {
      await page.locator('.taxpayer-reference-rail-bottom button')
        .filter({hasText:lang==='bn'?'বাংলা':'English'}).click();
      await expect(shell).toHaveAttribute('lang',lang);
    }
    for (const width of widths) {
      await page.setViewportSize({width,height:900});
      for (const route of routes) {
        await page.goto('/?action='+route+(route==='history'?'&qaScenario=1&scenarioYear=2025-2026':''));
        // Account Profile and Beneficiaries deliberately render their own
        // approved components; never use an Overview-only test ID for them.
        const root = route === 'beneficiaries'
          ? page.getByTestId('beneficiaries-page')
          : route === 'account_profile'
            ? page.getByTestId('taxpayer-unified-profile-page')
            : page.getByTestId('user1-synthetic-workspace');
        await expect(root,route+' at '+width+'/'+lang).toBeVisible();
        const h1=page.locator('main .taxpayer-page-heading h1').first();
        await expect(h1,route+' heading at '+width+'/'+lang).toBeVisible();
        await page.evaluate(async () => { await document.fonts.ready; });
        const style=await h1.evaluate(node=>{
          const css=getComputedStyle(node);
          return {size:parseFloat(css.fontSize),weight:Number(css.fontWeight),
            line:parseFloat(css.lineHeight)};
        });
        const expected=width>=1024?32:width>=480?28:24;
        expect(style.size,route+' heading size at '+width+'/'+lang).toBe(expected);
        expect(style.weight,route+' heading weight at '+width+'/'+lang).toBe(700);
        expect(style.line,route+' line height at '+width+'/'+lang).toBeGreaterThanOrEqual(style.size*1.25);
        await noOverflow(page,width,lang+' '+route);

        // Compare the same real navigation item across device classes without
        // relying on hidden duplicate desktop UI at phone/tablet widths.
        if(route==='taxpayer_home' && width>=901){
          const nav=page.locator('.taxpayer-reference-links > button').nth(1);
          await expect(nav).toBeVisible();
          expect(await nav.evaluate(el=>Number(getComputedStyle(el).fontWeight)),
            'inactive navigation action at '+width+'/'+lang).toBe(600);
        }

        if(route==='taxpayer_home'){
          const hero=page.locator('[data-testid="taxpayer-overview-bento"] .taxpay-bento-tasks__heading h2').first();
          await expect(hero).toBeVisible();
          expect(await hero.evaluate(el=>Number(getComputedStyle(el).fontWeight)),
            'visible Follow-ups section weight at '+width+'/'+lang).toBe(600);
          expect(await hero.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),
            'visible Follow-ups section size at '+width+'/'+lang).toBe(width>=768?24:20);
        }
        // Check the actual authenticated taxpayer profile, not a signed-out
        // URL preview: unauthorized sessions intentionally hide its details.
        if(route==='account_profile' && (width===375 || width===1024)){
          const profile=page.getByTestId('user1-taxpayer-profile');
          const label=profile.locator('.taxpay-profile-field-label').first();
          const value=profile.locator('.taxpay-profile-field-value').first();
          const section=profile.locator('.taxpay-profile-section-heading').first();
          await expect(label).toBeVisible();
          await expect(value).toBeVisible();
          await expect(section).toBeVisible();
          expect(await label.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(16);
          expect(await value.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(16);
          expect(await value.evaluate(el=>Number(getComputedStyle(el).fontWeight))).toBe(500);
          expect(await section.evaluate(el=>Number(getComputedStyle(el).fontWeight))).toBe(600);
        }
        if(route==='history' && width>=768){
          const register=page.getByTestId('taxpayer-transaction-table');
          await expect(register).toBeVisible();
          expect(await fontWeight(page,'[data-testid="taxpayer-transaction-table"] thead th')).toBe(600);
          expect(await fontWeight(page,'[data-testid="taxpayer-transaction-table"] tbody td')).toBe(400);
        }
      }
    }
  }
});
