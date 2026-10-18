import { expect, test } from '@playwright/test';

test('citizen design locks the primary blue and retains category identities inside the real service chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.public-info-topic[data-taxpay-service]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  await expect(page.locator('.tax-service-choice__card')).toHaveCount(8);

  const styles = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.taxpay-citizen-shell');
    if (!shell) throw new Error('Citizen shell missing');
    const services = ['TAX_WITH_RETURN', 'ADVANCE_TAX', 'SOURCE_TAX_DEPOSIT', 'OTHER_TAX_PAYMENT'];
    const cards = services.map(service => {
      const icon = document.querySelector<HTMLElement>(`.tax-service-choice__card[data-payment-service="${service}"] .tax-service-choice__icon`);
      if (!icon) throw new Error(`Service palette missing: ${service}`);
      const style = getComputedStyle(icon);
      return { service, background: style.backgroundColor, color: style.color };
    });
    return {
      primary: getComputedStyle(shell).getPropertyValue('--citizen-primary').trim(),
      font: getComputedStyle(shell).fontFamily,
      cards,
    };
  });

  expect(styles.primary.toLowerCase()).toBe('#2c5ead');
  expect(styles.font).toContain('Poppins');
  expect(new Set(styles.cards.map(card => card.background)).size).toBe(4);
  expect(new Set(styles.cards.map(card => card.color)).size).toBe(4);
});

test('Bangla text uses Noto Sans Bengali and the same eight actual services', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'যেভাবে কর পরিশোধ করবেন' })).toBeVisible();
  await page.getByRole('button', { name: 'কর পরিশোধ', exact: true }).click();
  await expect(page.locator('.tax-service-choice__card')).toHaveCount(8);
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
