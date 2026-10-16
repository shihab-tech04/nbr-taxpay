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
