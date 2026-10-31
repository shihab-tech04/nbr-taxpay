import { expect, type Page } from '@playwright/test';

/** Travel Tax is a permanent action on the fixed left side of the hero.
 * Its route is independent of whichever illustration is currently visible. */
export async function openTravelTaxFromBanner(page: Page) {
  const carousel = page.locator('.public-hero-carousel');
  await expect(carousel).toBeVisible();
  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
}
