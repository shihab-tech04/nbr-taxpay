import { expect, test } from '@playwright/test';

test('payer relationship is required at entry and head choice is still validated in Step 2', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  await expect(dialog.getByLabel('Your name')).toBeVisible();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Sample Agent');
  await expect(dialog.locator('#other-tax-primary-name')).toHaveValue('');
  await expect(dialog.locator('#other-tax-primary-name')).toHaveAttribute('readonly', '');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await expect(batch).toBeVisible();
  await expect(batch).toContainText('42 available Other Tax heads');
  await expect(batch.locator('[data-head-group]')).toHaveCount(5);
  await expect(batch.locator('[data-head-group="Tax with Return"]')).toHaveCount(0);
  await expect(batch.locator('#other-tax-target')).toHaveCount(0);
  await expect(dialog.getByText('Income tax type', { exact: true })).toHaveCount(0);
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(batch.getByTestId('other-tax-validation-summary')).toContainText('Select at least one payment head to continue.');
});

test('sample v11 notices validate the TIN pair and prefill locked AY and amount', async ({ page }) => {
  // A legacy v11 category is still testable through its explicit guest deep link.
  await page.goto('/?action=guest&initialCategory=PENALTY');
  const dialog = page;
  await dialog.getByRole('radio', { name: 'My tax liability' }).check();
  await expect(dialog.getByRole('radio', { name: 'My tax liability' })).toBeChecked();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#guest-notice-ref').fill('DN-2026-001187');
  await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not confirm');
  await dialog.locator('#guest-notice-ref').fill('pn-2026-000392');
  await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();

  const year = dialog.locator('#guest-assessment-year');
  await expect(year).toHaveValue('2025-26');
  await expect(year).toBeDisabled();
  await expect(dialog.locator('.payment-head-options input:checked')).toHaveCount(0);
  await dialog.locator('.payment-head-options input').first().check();
  await expect(dialog.locator('#guest-tax-amount')).toHaveValue('10000');
  await expect(dialog.locator('#guest-tax-amount')).toHaveAttribute('readonly', '');
});

test('standalone travel form requires explicit payment method and acknowledgement', async ({ page }) => {
  await page.goto('/?action=travel');
  const travel = page.locator('.travel-flow');
  await travel.locator('#travel-tax-route-1').check();
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await travel.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport number').fill('EXAMPLE123');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByLabel('Travel date').fill('2026-10-25');
  await travel.getByRole('button', { name: 'Continue to review' }).click();

  const submit = travel.getByRole('button', { name: 'Continue payment' });
  await expect(submit).toBeDisabled();
  const online = travel.getByRole('button', { name: 'Pay online' });
  await expect(online).toHaveAttribute('aria-pressed', 'false');
  await online.click();
  await expect(submit).toBeDisabled();
  await travel.getByRole('button', { name: 'Mobile banking' }).click();
  await travel.getByRole('radio', { name: 'bKash' }).check();
  await expect(submit).toBeDisabled();
  await travel.getByRole('checkbox', { name: 'The journey, passenger details and amount are correct.' }).check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(travel.locator('.travel-flow__receipt')).toContainText('Payment reference', { timeout: 10000 });
});

for (const locale of ['en', 'bn'] as const) {
  test('Other Tax payer and taxpayer sections use concise grouped copy (' + locale + ')', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing');
    await page.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax', exact: true }).first().click();
    const modal = page.getByRole('dialog', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax' });
    await modal.locator('[data-payer-relationship="OTHER"]').click();
    await modal.locator('[data-payment-entry="OTHER_TAX"]').click();
    await modal.locator('[data-payment-access="GUEST"]').click();
    await modal.locator('.tax-service-choice__actions').getByRole('button', {
      name: locale === 'bn' ? 'এগিয়ে যান' : 'Continue', exact: true,
    }).click();

    const payer = modal.locator('.payment-form-section--static').filter({ has: modal.locator('#guest-payer-name') });
    const taxpayers = modal.locator('.payment-form-section--static').filter({ has: modal.getByTestId('other-tax-taxpayer-list') });
    await expect(payer.getByRole('heading', { name: locale === 'bn' ? 'পরিশোধকারীর তথ্য' : 'Payer details' })).toBeVisible();
    await expect(payer.getByRole('heading', { name: locale === 'bn' ? 'রসিদের তথ্য' : 'Receipt details' })).toBeVisible();
    await expect(taxpayers.getByRole('heading', { name: locale === 'bn' ? 'করদাতারা' : 'Taxpayers', exact: true })).toBeVisible();
    await expect(payer.locator('.payment-form-section__heading-copy p')).toHaveCount(0);
    await expect(taxpayers.locator('.payment-form-section__heading-copy p')).toHaveCount(0);
    await expect(payer.locator('#guest-payer-name')).toBeVisible();
    await expect(payer.locator('#guest-phone')).toBeVisible();
    await expect(payer.locator('#guest-notice-ref')).toBeVisible();
    await expect(payer.locator('#guest-tin')).toHaveCount(0);
    await expect(taxpayers.locator('#guest-tin')).toBeVisible();
    await expect(taxpayers.locator('#other-tax-primary-name')).toHaveAttribute('readonly', '');
    await expect(modal.getByTestId('other-tax-taxpayer-list').locator('p.sr-only')).toHaveCount(1);
    await taxpayers.getByRole('button', { name: locale === 'bn' ? 'আরেকজন করদাতা যোগ করুন' : 'Add another taxpayer' }).click();
    await expect(taxpayers.getByTestId('other-tax-taxpayer')).toHaveCount(1);
    const horizontalOverflow = await modal.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(2);
  });
}
