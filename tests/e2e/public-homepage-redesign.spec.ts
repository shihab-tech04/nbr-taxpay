import { expect, test } from '@playwright/test';

test('public homepage explains the payment path without duplicating service categories', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const mobile = testInfo.project.name !== 'desktop-1280';
  await expect(page.getByRole('heading', { name: mobile ? 'Pay tax with confidence' : 'Tax payments, without the confusion.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How your payment works' })).toBeVisible();
  await expect(page.locator('.public-payment-path__steps > li')).toHaveCount(4);
  await expect(page.locator('.public-payment-path__steps > li .public-payment-path__symbol svg')).toHaveCount(4);
  for (const [index, stage] of ['Taxpayer details', 'Purpose & amount', 'Payment channel', 'Confirmation'].entries()) {
    await expect(page.locator('.public-payment-path__steps > li').nth(index)).toContainText(stage);
  }
  await expect(page.locator('.public-info-topic')).toHaveCount(0);
  await expect(page.locator('.public-info-guides')).toHaveCount(0);
  await expect(page.locator('.public-more-link')).toHaveCount(0);

  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' }).locator('.tax-service-choice__card')).toHaveCount(8);
});

test('public FAQ offers readable answers and the full guide without a large footer gap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing');
  const faq = page.locator('#public-faq');
  await expect(faq.getByRole('heading', { name: 'Common questions' })).toBeVisible();
  await expect(faq.locator('details')).toHaveCount(4);
  const firstQuestion = faq.locator('details').first();
  await firstQuestion.locator('summary').click();
  await expect(firstQuestion).toHaveAttribute('open', '');
  await expect(firstQuestion.getByText('It depends on the service.', { exact: false })).toBeVisible();

  const gap = await page.evaluate(() => {
    const section = document.querySelector('#public-faq')!;
    const footer = document.querySelector('.public-footer')!;
    return footer.getBoundingClientRect().top - section.getBoundingClientRect().bottom;
  });
  expect(gap, 'FAQ and footer should have a compact transition').toBeLessThanOrEqual(80);
  await faq.getByRole('button', { name: 'Open user guide' }).click();
  await expect(page.getByRole('heading', { name: 'Amar Kor user guide' })).toBeVisible();
});

test('top navigation uses the approved blue pill for the current public route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?action=landing');

  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  const home = nav.getByRole('link', { name: 'Home' });
  const guide = nav.getByRole('link', { name: 'User guide' });
  const report = nav.getByRole('link', { name: 'Report' });
  await expect(home).toHaveAttribute('aria-current', 'page');
  const selectedStyle = await home.evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, shadow: style.boxShadow };
  });
  expect(selectedStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(selectedStyle.shadow).toBe('none');

  await guide.click();
  await expect(guide).toHaveAttribute('aria-current', 'page');
  await expect(home).not.toHaveAttribute('aria-current', 'page');
  await report.click();
  await expect(report).toHaveAttribute('aria-current', 'page');
  await expect(guide).not.toHaveAttribute('aria-current', 'page');
});

test('mobile banner keeps five original illustrations, one-line copy and no arrows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);
  const expectedAssets = ['payment-v3', 'return-v3', 'advance-v3', 'withholding-v3', 'travel-v6'];
  const images = await carousel.locator('.public-information-hero__image').evaluateAll(elements =>
    elements.map(element => (element as HTMLImageElement).src),
  );
  expectedAssets.forEach((name, index) => expect(images[index]).toContain(`taxpay-hero-${name}`));

  const shortHeading = carousel.locator('[data-banner-service="intro"] .public-hero-copy--mobile').first();
  await expect(shortHeading).toBeVisible();
  await expect(shortHeading.locator('xpath=..')).toHaveCSS('white-space', 'nowrap');
  await expect(carousel.locator('.public-hero-carousel__arrow').first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
