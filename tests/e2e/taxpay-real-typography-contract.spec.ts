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

test('real homepage typography follows approved 12/16/20/24/28/32 tiers in EN/BN', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Single run samples all responsive breakpoints');
  test.setTimeout(120000);
  for (const width of [320,375,390,480,767,768,1024,1280,1920]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize({width,height:900});
      await page.goto('/?action=landing&lang='+lang);
      await expect(page.locator('.public-benefits__heading h2')).toBeVisible();
      await size(page,'.public-home-nav a',16);
      await size(page,'.public-home-language',16);
      await size(page,'.public-footer__identity p',16);
      await size(page,'.public-footer__bottom p',12);
      await expect(page.getByRole('button',{name:lang==='bn'?'অন্যান্য কর':'Other Tax',exact:true})).toBeVisible();
      await size(page,'.public-hero-carousel__travel',16);
      await size(page,'.public-guest-actions .public-guest-action',16);
      await size(page,'.public-benefits__heading h2',width>=768?24:20);
      await size(page,'.public-record-discovery__heading h2',20);
      await size(page,'.public-record-discovery__heading p',16);
      await size(page,'.public-benefits__copy p',16);
      await size(page,'.public-hero-carousel__slide.public-information-hero .citizen-public-hero__copy h2',width>=1024?32:width>=480?28:24);
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
    await page.goto('/?action=history&demoUser=user1&lang='+lang);
    const table=page.getByTestId('taxpayer-transaction-table');
    await expect(table).toBeVisible();
    await size(page,'[data-testid="taxpayer-transaction-table"] thead th',16);
    await size(page,'[data-testid="taxpayer-transaction-table"] tbody td',16);
    await noOverflow(page,1280,lang);
  }
});
