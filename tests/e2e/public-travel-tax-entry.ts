import { expect, type Page } from '@playwright/test';

/** The permanent introductory banner offers Travel Tax regardless of the current artwork. */
export async function openTravelTaxFromBanner(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = page.locator('.public-hero-carousel');
  await expect(carousel).toBeVisible();
  // Artwork rotates independently; the permanent Travel Tax CTA retains
  // the same dedicated passenger-payment flow on every image.
  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
}
