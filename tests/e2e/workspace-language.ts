import { expect, type Page } from '@playwright/test';

/**
 * Use the actually visible language control at each viewport.
 * The mobile utility lives in the two-section Services menu, not the header.
 * Preserve responsive behavior, keyboard-accessible dialog controls, and
 * the existing tests' legal, ownership and persistence assertions.
 */
export async function setWorkspaceLanguage(page: Page, language: 'en' | 'bn') {
  const mobile = (page.viewportSize()?.width ?? 1280) <= 900;
  if (!mobile) {
    await page.locator('.citizen-header').getByRole('button', {
      name: language === 'bn' ? 'বাংলা' : 'EN', exact: true,
    }).click();
    return;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
  await page.locator('.citizen-mobile-menu-trigger').click();
  const before = page.getByRole('dialog', { name: language === 'bn' ? 'Services & menu' : 'সেবা ও মেনু' });
  await before.getByRole('button', { name: language === 'bn' ? 'বাংলা' : 'English', exact: true }).click();
  const after = page.getByRole('dialog', { name: language === 'bn' ? 'সেবা ও মেনু' : 'Services & menu' });
  await after.getByRole('button', { name: language === 'bn' ? 'বন্ধ করুন' : 'Close' }).click();
  await expect(after).toHaveCount(0);
}
