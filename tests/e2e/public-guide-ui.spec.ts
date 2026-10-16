import { expect, test } from '@playwright/test';

test('Help Center keeps readable content and working topics at each viewport', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide = page.locator('.public-guide-page');
  await expect(guide.getByRole('heading', { name: 'Amar Kor user guide' })).toBeVisible();

  const fontSizes = await guide.evaluate(element => {
    const selectors = [
      '.public-guide-topics button',
      '.public-guide-steps li p',
      '.public-guide-search input',
      '.public-guide-questions summary',
    ];
    return selectors.map(selector => Number.parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize));
  });
  expect(fontSizes.every(size => size >= 16), `Small UI text: ${fontSizes.join(', ')}`).toBe(true);

  await guide.getByRole('button', { name: 'Travel tax' }).click();
  await expect(guide.getByRole('heading', { name: 'Travel tax' })).toBeVisible();
  await guide.getByRole('searchbox', { name: 'Search questions' }).fill('rates');
  await expect(guide.getByText('Are the rates final?')).toBeVisible();
  await guide.getByText('Are the rates final?').click();
  await expect(guide.getByText('Rates and exemptions must be checked', { exact: false })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
