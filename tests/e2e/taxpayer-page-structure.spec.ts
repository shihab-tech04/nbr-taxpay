import { expect, test } from '@playwright/test';

test.describe('signed-in page structure', () => {
  for (const route of ['taxpayer_home', 'history', 'verify', 'corrections', 'certificates', 'ledger', 'account_profile', 'account_notifications', 'account_settings'] as const) {
    test(`user1 ${route}: heading → optional tabs → content`, async ({ page }) => {
      await page.goto(`/?action=${route}&demoUser=user1`);
      const heading = page.locator('main .taxpayer-page-heading').first();
      await expect(heading.locator('h1')).toBeVisible();
      const tabs = page.getByRole('navigation', { name: 'Activity sections' });
      const requiresTabs = ['history', 'verify', 'corrections', 'certificates'].includes(route);
      await expect(tabs).toHaveCount(requiresTabs ? 1 : 0);
      if (requiresTabs) {
        expect(await heading.evaluate((node, next) =>
          Boolean(node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING),
          await tabs.elementHandle())).toBe(true);
        expect(await tabs.evaluate(node =>
          Boolean(node.nextElementSibling && node.nextElementSibling.tagName !== 'NAV'))).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    });
  }

  test('public receipt lookup has no signed-in activity tabs', async ({ page }) => {
    await page.goto('/?action=verify');
    await expect(page.getByRole('heading', {name: 'Receipt lookup'})).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Activity sections' })).toHaveCount(0);
  });
});
