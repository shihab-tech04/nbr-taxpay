import { expect, test } from '@playwright/test';

const dashboard = '/?action=taxpayer_home&demoUser=user1';

test('income chart uses actual posted YYYY-MM date range, not twelve generic months', async ({ page }) => {
  await page.goto(dashboard);
  const chart = page.getByRole('group', { name: /Income tax: Jun 2026/ });
  await expect(chart).toBeVisible();
  await expect(page.getByText('Jun ’26–Sep ’26')).toBeVisible();
  await expect(chart.getByRole('button', { name: /Income tax, Jun 2026:.*30,000/ })).toBeVisible();
  await expect(chart.getByRole('button', { name: /Income tax, Sep 2026:.*45,000/ })).toBeVisible();
  await expect(chart.locator(':scope > div')).toHaveCount(4);
  await expect(chart.getByRole('button', { name: /Income tax, Jan/ })).toHaveCount(0);
});

test('withholding category does not mix September 2025 with the same month in 2026', async ({ page }) => {
  await page.goto(dashboard);
  await page.getByRole('button', { name: 'TDS / withholding' }).click();
  const chart = page.getByRole('group', { name: /TDS \/ withholding: Sep 2025/ });
  await expect(chart).toBeVisible();
  await expect(page.getByText('Sep ’25–Mar ’26')).toBeVisible();
  await expect(chart.locator(':scope > div')).toHaveCount(7);
  await expect(chart.getByRole('button', { name: /TDS \/ withholding, Sep 2025:.*27,000/ })).toBeVisible();
  await expect(chart.getByRole('button', { name: /TDS \/ withholding, Jan 2026:.*9,000/ })).toBeVisible();
  await expect(chart.getByRole('button', { name: /TDS \/ withholding, Mar 2026:.*12,000/ })).toBeVisible();
  await expect(chart.getByRole('button', { name: /TDS \/ withholding, Sep 2026/ })).toHaveCount(0);
});

test('travel tax category does not affect separate income-tax liability balance', async ({ page }) => {
  await page.goto(dashboard);
  await page.getByRole('button', { name: 'Travel tax', exact: true }).click();
  const chart = page.getByRole('group', { name: /Travel tax: Apr 2026/ });
  await expect(chart.getByRole('button', { name: /Travel tax, Apr 2026:.*6,500/ })).toBeVisible();
  await expect(chart.locator(':scope > div')).toHaveCount(1);
  await expect(page.locator('.taxpayer-dashboard-kpi').last()).toContainText('৳ 25,000');
  await expect(page.locator('.taxpayer-travel-tax-summary')).toContainText('৳ 6,500');
});

test('mobile year-month timeline is keyboard scrollable without document overflow', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-320', 'Narrow-mobile scroll acceptance');
  await page.goto(dashboard);
  await page.getByRole('button', { name: 'TDS / withholding' }).click();
  const scroller = page.locator('.taxpayer-monthly-scroll');
  await expect(scroller).toHaveAttribute('tabindex','0');
  await scroller.focus();
  await expect(scroller).toBeFocused();
  const geometry = await scroller.evaluate(el => ({ visible: el.clientWidth, full: el.scrollWidth }));
  expect(geometry.full).toBeGreaterThan(geometry.visible);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
