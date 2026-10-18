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

  for (const route of ['history', 'verify', 'corrections', 'certificates'] as const) {
    test(`user1 ${route}: uniform spacing between heading, tabs and content`, async ({ page }) => {
      await page.goto(`/?action=${route}&demoUser=user1`);
      const heading = page.locator('main .taxpayer-page-heading').first();
      const tabs = page.getByRole('navigation', { name: 'Activity sections' });
      const firstContent = tabs.locator('xpath=following-sibling::*[1]');
      await expect(firstContent).toBeVisible();

      const headingBounds = await heading.boundingBox();
      const tabBounds = await tabs.boundingBox();
      const contentBounds = await firstContent.boundingBox();
      expect(headingBounds && tabBounds && contentBounds).toBeTruthy();
      if (!headingBounds || !tabBounds || !contentBounds) return;

      const afterHeading = tabBounds.y - (headingBounds.y + headingBounds.height);
      const afterTabs = contentBounds.y - (tabBounds.y + tabBounds.height);
      expect(afterHeading).toBeGreaterThanOrEqual(14);
      expect(afterHeading).toBeLessThanOrEqual(18);
      expect(afterTabs).toBeGreaterThanOrEqual(14);
      expect(afterTabs).toBeLessThanOrEqual(18);
      expect(Math.abs(headingBounds.x - tabBounds.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(tabBounds.x - contentBounds.x)).toBeLessThanOrEqual(2);

      if (route === 'verify') {
        const content = page.locator('.receipt-lookup--page .receipt-lookup__content');
        const form = content.locator('.receipt-lookup__form');
        const contentBox = await content.boundingBox();
        const formBox = await form.boundingBox();
        expect(contentBox && formBox).toBeTruthy();
        if (!contentBox || !formBox) return;
        const inset = formBox.x - contentBox.x;
        const expectedInset = (page.viewportSize()?.width ?? 1280) <= 800 ? 17 : 21;
        expect(Math.abs(inset - expectedInset)).toBeLessThanOrEqual(2);
      }
    });
  }
});
