import { expect, test } from '@playwright/test';

/**
 * WS5 release gate for the explicitly approved All Tax Payments three-stage UI.
 * Does not submit payment, create a receipt, or mutate hosted records.
 */
test('unified walk-in retains final payer fields, remarks, amounts and three-step progress', async ({ page }) => {
    await page.goto('/?action=landing&lang=en');
    await page.locator('.citizen-public-hero__actions').getByRole('button', { name: 'Pay Tax' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    await dialog.locator('#guest-tin').fill('222222222222');
    await dialog.locator('.taxpayer-tin-lookup__search').first().click();
    await dialog.getByRole('button', { name: 'Add taxpayer' }).first().click();
    await expect(dialog.locator('#tax-type-primary')).toHaveValue('NON_COMPANY');
    await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
    const companyTaxpayer = dialog.getByTestId('other-tax-taxpayer').first();
    await companyTaxpayer.locator('input[id^="other-tax-tin-"]').fill('333333333333');
    await companyTaxpayer.locator('.taxpayer-tin-lookup__search').click();
    await companyTaxpayer.getByRole('button', { name: 'Add taxpayer' }).click();
    await expect(dialog.locator('select[id^="tax-type-"]').last()).toHaveValue('COMPANY');
    await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByRole('progressbar', { name: 'Payment progress' })).toHaveAttribute('aria-valuemax', '3');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    const batch = dialog.getByTestId('other-tax-batch');
    const advanceTaxGroup = batch.locator('[data-head-group="Advance Tax"]');
    const select68A = batch.getByRole('checkbox', { name: /Select 68A/ });
    const ensureAdvanceTaxOpen = async () => {
      if (await advanceTaxGroup.getAttribute('open') === null) {
        await advanceTaxGroup.locator('summary').click();
      }
      await expect(select68A).toBeVisible();
    };
    await ensureAdvanceTaxOpen();
    await select68A.check();
    await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('3500');
    const taxpayerTabs = batch.getByTestId('other-tax-taxpayer-tabs').locator('button[data-taxpayer-id]');
    await expect(taxpayerTabs).toHaveCount(2);
    await taxpayerTabs.nth(1).click();
    await ensureAdvanceTaxOpen();
    await select68A.check();
    await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('3500');

    const calculation = dialog.getByTestId('grouped-taxpayer-calculation');
    const taxpayerSummaries = calculation.locator('.payment-form-summary__taxpayer');
    const mobileCalculation = dialog.getByTestId('mobile-payment-calculation');
    if (await mobileCalculation.count() && await mobileCalculation.getAttribute('open') === null) {
      await mobileCalculation.getByTestId('mobile-payment-calculation-toggle').click();
    }
    await expect(taxpayerSummaries).toHaveCount(2);
    await expect(taxpayerSummaries.nth(0).locator('summary')).toContainText('1 payment line');
    await expect(taxpayerSummaries.nth(1).locator('summary')).toContainText('1 payment line');
    await taxpayerSummaries.nth(1).locator('summary').click();
    const personLine = taxpayerSummaries.nth(0).locator('.payment-form-summary__taxpayer-label').first();
    const companyLine = taxpayerSummaries.nth(1).locator('.payment-form-summary__taxpayer-label').first();
    await expect(personLine).not.toContainText(/Code/i);
    await expect(companyLine).toContainText('Code 1112101');
    await dialog.getByRole('button', { name: 'Continue to final preview' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(dialog.getByTestId('payment-review')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Payer and receipt details' })).toBeVisible();
    await expect(dialog.locator('#guest-phone')).toHaveCount(1);
    await expect(dialog.locator('#guest-payment-remarks')).toBeVisible();

    await dialog.locator('#guest-payer-name').fill('Test Walk-in Payer');
    await dialog.locator('#guest-phone').fill('01712345678');
    await dialog.locator('#guest-payment-remarks').fill('Assessment payment for sample user 2');
    await dialog.locator('.taxpay-modal__back').click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]')).toHaveValue('3500');
    await dialog.getByRole('button', { name: 'Continue to final preview' }).click();
    await expect(dialog.locator('#guest-payer-name')).toHaveValue('Test Walk-in Payer');
    await expect(dialog.locator('#guest-phone')).toHaveValue('01712345678');
    await expect(dialog.locator('#guest-payment-remarks')).toHaveValue('Assessment payment for sample user 2');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
});
