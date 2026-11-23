import { expect, type Page } from '@playwright/test';

/** Travel Tax is available through the fixed Other Tax action on the hero.
 * Its route is independent of whichever illustration is currently visible. */
export async function openTravelTaxFromBanner(page: Page) {
  const carousel = page.locator('.public-hero-carousel');
  await expect(carousel).toBeVisible();
  await carousel.getByRole('button', { name: /^(?:Other Tax|অন্যান্য কর)$/ }).click();
  const access = page.locator('.taxpay-modal[data-public-service="login"]');
  await expect(access.locator('.taxpayer-login-dialog')).toBeVisible();
  await access.getByRole('button', { name: /^(?:Walk-in Payment|ওয়াক-ইন পেমেন্ট)$/ }).click();
  await page.getByTestId('other-tax-chooser').getByRole('button', { name: /^(?:Travel Tax|ভ্রমণ কর)/ }).click();
}
