import { expect, test } from '@playwright/test';

test('citizen design locks the primary blue, differentiated icons and the preserved financial service identities', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.public-info-topic[data-taxpay-service]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const payerCards = dialog.locator('.tax-service-choice__card[data-payer-relationship]');
  await expect(payerCards).toHaveCount(2);
  const colors = await payerCards.evaluateAll(nodes => nodes.map(node => ({
    primary: getComputedStyle(node).getPropertyValue('--choice-primary').trim(),
    background: getComputedStyle(node.querySelector('.tax-service-choice__icon')!).backgroundColor,
    icon: getComputedStyle(node.querySelector('.tax-service-choice__icon')!).color,
  })));
  expect(new Set(colors.map(c => c.primary)).size).toBe(2);
  expect(new Set(colors.map(c => c.icon)).size).toBe(2);

  const shell = page.locator('.taxpay-citizen-shell');
  expect((await shell.evaluate(el => getComputedStyle(el).getPropertyValue('--citizen-primary').trim())).toLowerCase()).toBe('#2c5ead');
  expect(await shell.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Poppins');
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('Bangla text uses Noto Sans Bengali in the new payer-first service flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'যেভাবে কর পরিশোধ করবেন' })).toBeVisible();
  await page.getByRole('button', { name: 'কর পরিশোধ', exact: true }).click();
  await expect(page.locator('[data-payer-relationship]')).toHaveCount(2);
  await page.locator('[data-payer-relationship="OTHER"]').click();
  await expect(page.locator('[data-payment-entry]')).toHaveCount(2);
  const font = await page.locator('.taxpay-citizen-shell').evaluate(element => getComputedStyle(element).fontFamily);
  expect(font).toMatch(/^['"]?Noto Sans Bengali/);
});

test('Sobaike-level flat elevation is consistent across the public hero, section cards and mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const checkElevation = async () => page.evaluate(() => {
    const selectors = [
      '.public-information-hub .public-payment-path',
      '.public-information-hub .public-faq-layout',
    ];
    const shadows = selectors.map(selector => {
      const surface = document.querySelector<HTMLElement>(selector);
      if (!surface) throw new Error(`Missing public surface: ${selector}`);
      return getComputedStyle(surface).boxShadow;
    });
    const header = document.querySelector<HTMLElement>('.public-home-header');
    if (!header) throw new Error('Missing public header');
    const hero = document.querySelector<HTMLElement>('.public-information-hero');
    if (!hero) throw new Error('Missing public hero');
    return { shadows, headerShadow: getComputedStyle(header).boxShadow, heroShadow: getComputedStyle(hero).boxShadow };
  });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const elevation = await checkElevation();
    expect(elevation.heroShadow).toBe('none');
    expect(elevation.shadows[0]).toContain('0px 1px 0px');
    expect(elevation.shadows[0]).toContain('0.05');
    expect(new Set(elevation.shadows).size).toBe(1);
    expect(elevation.headerShadow).toBe('none');
  }
  await expect(page.locator('[data-banner-service="intro"] .public-information-hero__image')).toBeVisible();
  await expect(page.locator('.public-information-hero .public-information-guide')).toHaveCount(0);
});
