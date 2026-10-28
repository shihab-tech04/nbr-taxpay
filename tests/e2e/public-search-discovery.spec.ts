import { expect, test } from '@playwright/test';

test('public search explains reference types and shows safe sample suggestions', async ({ page }) => {
  await page.goto('/?action=landing');
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await expect(section.getByRole('heading', { name: 'Find a payment record' })).toBeVisible();
  await expect(section.getByText(/challan number, payment token, or transaction reference/)).toBeVisible();
  await search.click();
  await expect(section.getByRole('heading', { name: 'Matching sample references' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Try a sample number' })).toBeVisible();
  await expect(section.getByRole('link', { name: /Try sample reference: AC-2025-09-DEMO-REF-001/ })).toBeVisible();

  await search.fill('DEMO-REF-001');
  const match = section.getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ });
  await expect(match).toBeVisible();
  await expect(section.getByText('Sample challan reference')).toBeVisible();
  await expect(section.getByText('Demonstration references only — not official payment evidence.')).toBeVisible();

  await search.fill('not-a-real-reference');
  await expect(section.getByText(/No sample suggestions match/)).toBeVisible();
  await expect(section.getByRole('link', { name: /Try sample reference: AC-2025-09-DEMO-REF-001/ })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Search records' })).toBeEnabled();
});

test('matched suggestions support keyboard selection and original in-memory verification route', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('TKN-882190');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'public-search-option-0');
  await search.press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('textbox', { name: /Challan, token or transaction reference/ })).toHaveValue('TKN-882190');
  await expect(page.getByText('TKN-882190').first()).toBeVisible();
});

test('sample links navigate without leaking reference into a URL', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('searchbox', { name: 'Search payment records by reference' }).click();
  await page.getByRole('link', { name: /Try sample reference: AC-2025-06-DEMO-REF-003/ }).click();
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain('DEMO-REF');
  await expect(page.getByRole('textbox', { name: /Challan, token or transaction reference/ })).toHaveValue('AC-2025-06-DEMO-REF-003');
});

test('dropdown closes on Escape and outside click, and Bangla labels remain usable', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('DEMO');
  await expect(page.locator('#public-record-suggestions')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('#public-record-suggestions')).toHaveCount(0);
  await search.click();
  await page.getByRole('heading', { name: 'How your payment works' }).click();
  await expect(page.locator('#public-record-suggestions')).toHaveCount(0);
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট রেকর্ড খুঁজুন' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন' }).click();
  await expect(page.getByRole('heading', { name: 'নমুনা নম্বর দিয়ে দেখুন' })).toBeVisible();
});

test('search section and dropdown stay within the viewport on narrow devices', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/?action=landing');
    const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
    await search.fill('DEMO');
    const dimensions = await page.locator('.public-record-suggestions').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(dimensions.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  }
});
