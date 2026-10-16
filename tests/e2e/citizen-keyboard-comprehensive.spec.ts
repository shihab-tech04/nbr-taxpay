import { expect, test } from '@playwright/test';

test('Public skip link and FAQ disclosure work with keyboard alone', async ({ page }) => {
  await page.goto('/?action=landing');
  const skip = page.getByRole('link', { name: /Skip to main content/ });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();

  const faq = page.locator('.public-info-faq details').first();
  const summary = faq.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(faq).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(faq).not.toHaveAttribute('open');
});

test('Public mobile menu enters a real keyboard sequence and restores trigger focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=landing');
  const trigger = page.getByRole('button', { name: 'Menu' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Public service dialog has an accessible entry, close and focus return', async ({ page }) => {
  await page.goto('/?action=landing');
  const open = page.getByRole('button', { name: 'Check payment status & receipt' });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Payment status & receipt' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close modal' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('Taxpayer dashboard contains two-line section introductions and keyboard-operable filters', async ({ page }) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await expect(page.getByText('Taxpayer workspace / Dashboard')).toHaveCount(0);
  await expect(page.getByText('Currently showing assessment year')).toHaveCount(0);

  const income = page.getByRole('button', { name: 'Income tax', exact: true });
  await income.focus();
  await page.keyboard.press('Space');
  await expect(income).toHaveAttribute('aria-pressed', 'true');

  const all = page.getByRole('button', { name: 'All transactions' });
  await all.focus();
  await page.keyboard.press('Enter');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: 'Search transactions' })).toBeVisible();
});

test('Citizen route matrix never adds static text and containers to the Tab sequence', async ({ page }) => {
  for (const route of ['landing', 'user_guide', 'incident', 'guest', 'travel', 'verify', 'secure_workspace']) {
    await page.goto('/?action=' + route);
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('main h1[tabindex="0"],main h2[tabindex="0"],main p[tabindex="0"],main div[tabindex="0"]')).toHaveCount(0);
    const interactiveCount = await page.locator('main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main summary').count();
    expect(interactiveCount, 'No accessible native controls found for ' + route).toBeGreaterThan(0);
  }
});

test('Scrolled-away mobile header is inert rather than an invisible Tab trap', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  const header = page.locator('.citizen-header');
  await page.evaluate(() => window.scrollTo(0, 650));
  await expect(header).toHaveAttribute('inert', '');
  await expect(header).toHaveCSS('visibility', 'hidden');
  await header.locator('button').first().evaluate((button) => (button as HTMLButtonElement).focus());
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.citizen-header')))).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).not.toHaveAttribute('inert', '');
});
