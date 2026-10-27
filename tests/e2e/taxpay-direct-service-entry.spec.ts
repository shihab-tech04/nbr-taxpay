import { expect, test } from '@playwright/test';

// A service banner already identifies its service. Requiring a second choice
// after taxpayer relationship is a redundant navigation step.
for (const { slide, cta, selected } of [
  { slide: 'return', cta: 'Pay Tax with Return', selected: 'TAX_WITH_RETURN' },
  { slide: 'advance', cta: 'Pay Advance Income Tax', selected: 'ADVANCE_TAX' },
  { slide: 'withholding', cta: 'Deposit Source Tax', selected: 'SOURCE_TAX_DEPOSIT' },
] as const) {
  test(`direct ${slide} banner skips repeated tax-type decision and preserves selected service`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await carousel.focus();
    for (let i = 0; i < ({ return: 1, advance: 2, withholding: 3 } as const)[slide]; i++) {
      await page.keyboard.press('ArrowRight');
    }
    const selectedSlide = carousel.locator(`[data-banner-service="${slide}"]`);
    await expect(selectedSlide).not.toHaveAttribute('inert', '');
    await selectedSlide.getByRole('button', { name: cta, exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(modal).toBeVisible();
    await modal.locator('[data-payer-relationship="OTHER"]').click();
    await modal.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(modal.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(0);
    await expect(modal.locator('[data-payment-service]').first()).toHaveAttribute('data-payment-service', selected);
    await modal.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back', exact: true }).click();
    await expect(modal.getByRole('heading', { name: 'Who are you paying for?' })).toBeVisible();
    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  });
}
