import { expect, test } from '@playwright/test';

test('citizen design locks the primary blue and gives each existing payment type a distinct palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.public-info-topic[data-taxpay-service]')).toHaveCount(4);

  const styles = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.taxpay-citizen-shell');
    if (!shell) throw new Error('Citizen shell missing');
    const types = ['return', 'advance', 'withholding', 'other'];
    const cards = types.map(tone => {
      const element = document.querySelector<HTMLElement>(`[data-taxpay-service="${tone}"]`);
      if (!element) throw new Error(`Service palette missing: ${tone}`);
      const style = getComputedStyle(element);
      return { tone, background: style.backgroundColor, border: style.borderColor, shadow: style.boxShadow };
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
  expect(new Set(styles.cards.map(card => card.border)).size).toBe(4);
  for (const card of styles.cards) expect(card.shadow).not.toBe('none');
});

test('Bangla text uses Noto Sans Bengali while keeping the same four tax-service categories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.locator('.public-info-topic[data-taxpay-service]')).toHaveCount(4);
  const font = await page.locator('.taxpay-citizen-shell').evaluate(element => getComputedStyle(element).fontFamily);
  expect(font).toMatch(/^['"]?Noto Sans Bengali/);
});

test('Sobaike-level flat elevation is consistent across the public hero, section cards and mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const checkElevation = async () => page.evaluate(() => {
    const selectors = [
      '.public-information-hub .public-info-section',
      '.public-info-topic[data-taxpay-service="return"]',
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
