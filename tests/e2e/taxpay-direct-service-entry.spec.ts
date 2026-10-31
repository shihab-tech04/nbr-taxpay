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
    // Source copy parity: payer liability and authorization stay visible in the existing cards.
    await expect(modal.locator('[data-payer-relationship="SELF"]')).toContainText('My Tax Liability');
    await expect(modal.locator('[data-payer-relationship="SELF"]')).toContainText('Pay tax for myself.');
    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toContainText('Facilitate another taxpayer’s payment');
    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toContainText('Pay on behalf of another taxpayer.');
    await modal.locator('[data-payer-relationship="OTHER"]').click();
    // Direct banner service remains preselected, with no redundant second modal.
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(2);
    const taxChoice = selected === 'TAX_WITH_RETURN' ? 'TAX_WITH_RETURN' : 'OTHER_TAX';
    await expect(modal.locator(`[data-payment-entry="${taxChoice}"]`)).toHaveAttribute('aria-pressed', 'true');
    await modal.locator('[data-payment-access="GUEST"]').click();
    await modal.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(modal.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(0);
    await expect(modal.locator('[data-payment-service]').first()).toHaveAttribute('data-payment-service', selected);
    await modal.locator('.taxpay-modal__back').click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Pay Tax');
    await expect(modal.locator('[data-payment-access="GUEST"]')).toHaveAttribute('aria-pressed', 'true');

    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  });
}
