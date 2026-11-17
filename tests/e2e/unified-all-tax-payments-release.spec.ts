import { expect, test } from '@playwright/test';

/**
 * WS5 release gate for the explicitly approved All Tax Payments three-stage UI.
 * Does not submit payment, create a receipt, or mutate hosted records.
 */
for (const width of [375, 1280]) {
  test(`unified walk-in retains final payer fields, remarks, amounts and three-step progress at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?action=landing&lang=en');
    await page.locator('.public-benefits__item[data-benefit="payments"]').click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    await dialog.locator('#guest-tin').fill('222222222222');
    await dialog.locator('.taxpayer-tin-lookup__search').first().click();
    await dialog.getByRole('button', { name: 'Add taxpayer' }).first().click();
    await expect(dialog.locator('#tax-type-primary')).toHaveValue('NON_COMPANY');
    await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByRole('progressbar', { name: 'Payment progress' })).toHaveAttribute('aria-valuemax', '3');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    const batch = dialog.getByTestId('other-tax-batch');
    await batch.locator('[data-head-group="Advance Tax"] summary').click();
    await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
    await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('3500');
    await dialog.getByRole('button', { name: 'Continue to final preview' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(dialog.getByTestId('payment-review')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Payer and receipt details' })).toBeVisible();
    await expect(dialog.locator('#guest-phone')).toHaveCount(1);
    await expect(dialog.locator('#guest-payment-remarks')).toBeVisible();

    await dialog.locator('#guest-payer-name').fill('Test Walk-in Payer');
    await dialog.locator('#guest-phone').fill('01712345678');
    await dialog.locator('#guest-payment-remarks').fill('Assessment payment for sample user 2');
    await dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__cancel').click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]')).toHaveValue('3500');
    await dialog.getByRole('button', { name: 'Continue to final preview' }).click();
    await expect(dialog.locator('#guest-payer-name')).toHaveValue('Test Walk-in Payer');
    await expect(dialog.locator('#guest-phone')).toHaveValue('01712345678');
    await expect(dialog.locator('#guest-payment-remarks')).toHaveValue('Assessment payment for sample user 2');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
}
