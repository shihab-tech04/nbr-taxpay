import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';

test('Travel Tax passport suggestions recover on keyboard Escape and outside pointer or Tab', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  const passport = modal.locator('#travel-passport-first');
  const list = modal.locator('#travel-passport-suggestions-first');
  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  await passport.press('ArrowDown');
  await expect(list.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(list.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(passport).toBeFocused();
  await expect(modal).toBeVisible(); // Escape never closes the payment dialog.

  // Focusing elsewhere dismisses an open picker without changing identity.
  await modal.getByRole('tab', { name: 'Bangladeshi passenger' }).focus();
  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  await modal.locator('.travel-passenger-workspace__editor h2').click();
  await expect(list).toHaveCount(0);
  await expect(passport).toHaveValue('');

  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  await passport.press('Tab');
  await expect(list).toHaveCount(0);
});
