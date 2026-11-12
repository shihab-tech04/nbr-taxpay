import { expect, test } from '@playwright/test';

test('public homepage explains six citizen benefits without duplicate CTAs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing&lang=en');

  const benefits = page.locator('.public-benefits');
  await expect(benefits.getByRole('heading', { name: 'Why use Korbritto?' })).toBeVisible();
  await expect(benefits.locator('.public-benefits__heading p')).toHaveText('Pay, organize and track your taxes in one place.');
  await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
  const expectedCards = [
    ['payments', 'All Tax Payments', 'Pay taxes for yourself, family or clients.'],
    ['corrections', 'Corrections & Requests', 'Request corrections and follow their progress.'],
    ['certificates', 'Tax Certificates', 'Find and download available tax certificates.'],
    ['history', 'Payment History', 'See past payments, tax years and receipts.'],
    ['beneficiaries', 'Beneficiary Management', 'Keep people and their payment records organized.'],
    ['repeat-drafts', 'Pay Again & Saved Drafts', 'Reuse a payment or resume a saved draft.'],
  ] as const;
  for (const [index, [id, heading, description]] of expectedCards.entries()) {
    const card = benefits.locator('.public-benefits__item').nth(index);
    await expect(card).toHaveAttribute('data-benefit', id);
    await expect(card.getByRole('heading', { name: heading })).toBeVisible();
    await expect(card.locator('p')).toHaveText(description);
    await expect(card.locator('svg')).toHaveCount(1);
    await expect(card.locator('p')).toHaveCSS('font-size', '14px');
  }
  await expect(benefits.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Find a payment record' })).toBeVisible();

  const positions = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(positions[0].y).toBe(positions[1].y);
  expect(positions[1].y).toBe(positions[2].y);
  expect(positions[0].x).toBeLessThan(positions[1].x);
  expect(positions[1].x).toBeLessThan(positions[2].x);
  expect(positions[3].y).toBeGreaterThan(positions[0].y);
  expect(positions[3].x).toBe(positions[0].x);
  const heights = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => item.getBoundingClientRect().height)
  );
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  expect(Math.max(...heights)).toBeLessThanOrEqual(145);

  for (const card of await benefits.locator('.public-benefits__item').all()) {
    const icon = card.locator('.public-benefits__icon');
    const copy = card.locator('.public-benefits__copy');
    await expect(card).toHaveCSS('display', 'grid');
    const iconBox = await icon.boundingBox();
    const copyBox = await copy.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox!.x).toBeGreaterThan(iconBox!.x + iconBox!.width + 6);
    expect(Math.abs((iconBox!.y + iconBox!.height / 2) - (copyBox!.y + copyBox!.height / 2))).toBeLessThanOrEqual(2);
  }
});

test('existing hero Pay Tax and Travel Tax actions still open separate journeys', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');

  await page.locator('.public-hero-carousel .citizen-public-primary.public-guest-action').first().click();
  const tax = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(tax).toBeVisible();
  await tax.getByRole('button', { name: 'Close payment services' }).click();

  await page.getByRole('button', { name: 'Pay Travel Tax', exact: true }).first().click();
  const travel = page.getByRole('dialog', { name: /Travel tax/i });
  await expect(travel).toBeVisible();
  await travel.getByRole('button', { name: 'Close modal' }).click();
});

test('benefit cards adapt to tablet and keep Bengali mobile bottom navigation intact', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('/?action=landing&lang=en');
  const benefits = page.locator('.public-benefits');
  const tablet = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(tablet[0].y).toBe(tablet[1].y);
  expect(tablet[0].x).toBeLessThan(tablet[1].x);
  expect(tablet[2].y).toBeGreaterThan(tablet[0].y);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=landing&lang=bn');
  await expect(benefits.getByRole('heading', { name: 'করবৃত্ত কেন ব্যবহার করবেন?' })).toBeVisible();
  await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
  await expect(benefits.getByRole('heading', { name: 'সুবিধাভোগী ব্যবস্থাপনা' })).toBeVisible();
  await expect(benefits.locator('[data-benefit="certificates"] h3')).toHaveText('কর সনদ');
  await expect(benefits.locator('[data-benefit="repeat-drafts"] h3')).toHaveText('আবার পরিশোধ ও সংরক্ষিত খসড়া');
  await expect(benefits.locator('[data-benefit="repeat-drafts"] p')).toHaveText('আগের পেমেন্টের তথ্য ব্যবহার করুন বা খসড়া চালিয়ে যান।');
  await expect(benefits.locator('.public-benefits__heading p')).toHaveText('কর পরিশোধ, তথ্য গুছিয়ে রাখা ও অগ্রগতি দেখা—সব এক জায়গায়।');
  await expect(page.getByRole('navigation', { name: 'মোবাইল প্রধান নেভিগেশন' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট রেকর্ড খুঁজুন' })).toBeVisible();
  const mobile = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(mobile[0].x).toBe(mobile[1].x);
  expect(mobile[1].y).toBeGreaterThan(mobile[0].y);
  const iconBounds = await benefits.locator('.public-benefits__item').first().locator('.public-benefits__icon').boundingBox();
  const copyBounds = await benefits.locator('.public-benefits__item').first().locator('.public-benefits__copy').boundingBox();
  expect(iconBounds).not.toBeNull();
  expect(copyBounds).not.toBeNull();
  expect(copyBounds!.x).toBeGreaterThan(iconBounds!.x + iconBounds!.width);
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(sizes.document - sizes.viewport).toBeLessThanOrEqual(2);
});
