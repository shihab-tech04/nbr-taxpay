import { mockPublishedBannerCms } from './mock-published-banners';
import { expect, test } from '@playwright/test';

test('public homepage explains the payment path without duplicating service categories', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const mobile = testInfo.project.name !== 'desktop-1280';
  await expect(page.getByRole('heading', { name: mobile ? 'Pay tax with confidence' : 'Tax payments, without the confusion' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How your payment works' })).toBeVisible();
  await expect(page.locator('.public-payment-path__steps > li')).toHaveCount(4);
  await expect(page.locator('.public-payment-path__steps > li .public-payment-path__symbol svg')).toHaveCount(4);
  for (const [index, stage] of ['Input taxpayer details', 'Select purpose & amount', 'Choose payment method', 'Review & confirm payment'].entries()) {
    await expect(page.locator('.public-payment-path__steps > li').nth(index)).toContainText(stage);
  }
  await expect(page.locator('.public-info-topic')).toHaveCount(0);
  await expect(page.locator('.public-info-guides')).toHaveCount(0);
  await expect(page.locator('.public-more-link')).toHaveCount(0);
  const surfaces = await page.locator('.public-payment-path__starter, .public-payment-path__steps li, .public-payment-path__symbol').evaluateAll(elements =>
    elements.map(element => ({gradient: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).backgroundColor})),
  );
  expect(surfaces.every(surface => surface.gradient === 'none'), 'Steps should not use gradients').toBe(true);
  expect(new Set(surfaces.slice(2).map(surface => surface.color)).size).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' }).locator('.tax-service-choice__card')).toHaveCount(2);
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
  await expect(firstQuestion).toHaveCSS('background-image', 'none');

  const gap = await page.evaluate(() => {
    const section = document.querySelector('#public-faq')!;
    const footer = document.querySelector('.public-footer')!;
    return footer.getBoundingClientRect().top - section.getBoundingClientRect().bottom;
  });
  expect(gap, 'FAQ and footer should have a compact transition').toBeLessThanOrEqual(80);
  await faq.getByRole('button', { name: 'Open user guide' }).click();
  await expect(page.getByRole('heading', { name: 'Korbritto user guide' })).toBeVisible();
});

test('Report follows heading then compact content with no redundant warnings', async ({ page }) => {
  await page.setViewportSize({ width: 1792, height: 1400 });
  await page.goto('/?action=incident');
  const report = page.locator('.public-report-page');
  await expect(report.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await expect(report.locator('.citizen-hub-eyebrow')).toHaveCount(0);
  await expect(report.getByText('This form does not send reports or create official tickets.')).toHaveCount(0);
  await expect(report.getByText('If money was debited, contact your bank or payment provider.')).toHaveCount(0);
  await expect(report.getByLabel('Issue type')).toBeVisible();
  await expect(report.getByLabel('Short description')).toBeVisible();
  const layout = await page.evaluate(() => {
    const main = document.querySelector('#main-content')!.getBoundingClientRect();
    const section = document.querySelector('.public-report-page')!.getBoundingClientRect();
    const card = document.querySelector('.public-report-card')!.getBoundingClientRect();
    const footer = document.querySelector('.public-footer')!.getBoundingClientRect();
    return {
      cardWidth: card.width,
      horizontalOffset: Math.abs(card.left + card.width / 2 - main.left - main.width / 2),
      topGap: section.top - main.top,
      footerHeight: footer.height,
      footerBottom: footer.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.cardWidth).toBeLessThanOrEqual(820);
  expect(layout.horizontalOffset, 'Report form must be horizontally centered').toBeLessThanOrEqual(2);
  expect(layout.topGap, 'Report heading must start near the top of the page').toBeGreaterThanOrEqual(24);
  expect(layout.topGap, 'Report must not be vertically centered on tall screens').toBeLessThanOrEqual(48);
  expect(layout.footerHeight, 'Footer itself must remain compact rather than filling the viewport').toBeLessThanOrEqual(130);
  expect(Math.abs(layout.footerBottom - layout.viewportHeight), 'Short report pages must retain a bottom-aligned footer').toBeLessThanOrEqual(4);
  await report.getByLabel('Short description').fill('A payment reference does not match my record.');
  await report.getByRole('button', { name: 'Review details' }).click();
  await expect(report.getByRole('heading', { name: 'Review your details' })).toBeVisible();
});

test('Report remains readable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?action=incident');
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await expect(page.getByLabel('Short description')).toBeVisible();
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cardWidth: document.querySelector('.public-report-card')!.getBoundingClientRect().width,
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(2);
  expect(geometry.cardWidth).toBeLessThanOrEqual(358);
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

test('mobile banner keeps all five approved conceptual illustrations, one-line copy and no arrows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);
  const expectedAssets = ['intro-v9', 'return-v9', 'advance-v9', 'withholding-v9', 'travel-v9'];
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

// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });
