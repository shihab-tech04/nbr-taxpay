import { expect, type Page } from '@playwright/test';

/** The redesigned Home page offers Travel Tax on banner five, not in a separate list. */
export async function openTravelTaxFromBanner(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = page.locator('.public-hero-carousel');
  await expect(carousel).toBeVisible();
  const activeIndex = Number(await carousel.getAttribute('data-active-slide'));
  expect(Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < 5).toBe(true);
  const moves = (4 - activeIndex + 5) % 5;
  for (let i = 0; i < moves; i++) {
    await carousel.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String((activeIndex + i + 1) % 5));
  }
  await expect(carousel).toHaveAttribute('data-payment-service', 'TRAVEL_TAX');
  await carousel.locator('[data-banner-service="travel"] .citizen-public-primary').click();
}
