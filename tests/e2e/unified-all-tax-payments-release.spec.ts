import { expect, test } from '@playwright/test';

/**
 * WS5 release gate for the explicitly approved All Tax Payments three-stage UI.
 * Does not submit payment, create a receipt, or mutate hosted records.
 */
test('unified walk-in directly replaces any TIN digit and keeps only the Continue footer CTA', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();
  // The subtitle is flow context, not a non-clickable breadcrumb.
  await expect(dialog.locator('.taxpay-modal__subtitle')).toHaveText('Walk-in Payment');
  await expect(dialog.locator('.taxpay-modal__subtitle')).not.toContainText('›');
  const tin = dialog.getByTestId('unified-tin-input');
  const digits = dialog.getByTestId('unified-v5-tin-blocks').locator('span');
  await tin.fill('111111111111');
  await expect(digits).toHaveCount(12);
  const selectDigit = async (index: number) => {
    const bounds = await digits.nth(index).boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(digits.nth(index)).toHaveClass(/is-active/);
  };
  await selectDigit(2);
  await page.keyboard.type('3');
  await expect(tin).toHaveValue('113111111111');
  await selectDigit(6);
  await page.keyboard.type('7');
  await expect(tin).toHaveValue('113111711111');
  // Full TIN paste and search must keep the original owner-scoped lookup and add flow.
  await tin.fill('222222222222');
  await expect(dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__cancel')).toHaveCount(0);
  await expect(dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__continue')).toHaveCount(1);
  await expect(dialog.locator('.taxpay-modal__back')).toBeVisible();
  await dialog.getByRole('button', { name: 'Search taxpayer TIN' }).click();
  await expect(dialog.getByTestId('unified-taxpayer-search-result')).toBeVisible();
});

test('unified walk-in retains final payer fields, remarks, amounts and three-step progress', async ({ page }) => {
    await page.goto('/?action=landing&lang=en');
    await page.locator('.public-benefits__item[data-benefit="payments"]').click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();
    // Compare the CTA with its own footer action row rather than the viewport.
    // This runs in the payment-wizard matrix at 320, 375 and 1280px.
    const expectFullWidthCta = async (label: string) => {
      const actions = dialog.locator('.taxpay-modal__footer .payment-flow-embedded__footer-actions');
      const button = actions.getByRole('button', { name: label });
      await expect(button).toBeVisible();
      // Portal footer geometry settles after the stage/date/draft effects.
      // Poll the measured state rather than assert during an intermediate frame;
      // keep the same original 2px acceptance tolerance.
      await expect.poll(async () => {
        const [row, cta] = await Promise.all([actions.boundingBox(), button.boundingBox()]);
        if (!row || !cta) return Infinity;
        return Math.max(Math.abs(cta.x - row.x), Math.abs(cta.width - row.width));
      }, { timeout: 7000 }).toBeLessThanOrEqual(2);
    };
    await expectFullWidthCta('Continue to Payment Head');

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    // Frozen v3 uses a single TIN search and selected-taxpayer rail instead
    // of the legacy confirmation rows and editable tax-type dropdowns.
    const add = async (tin: string) => {
      await dialog.getByTestId('unified-tin-input').fill(tin);
      await dialog.getByRole('button', { name: 'Search taxpayer TIN' }).click();
      await expect(dialog.getByTestId('unified-taxpayer-search-result')).toBeVisible();
      await dialog.getByRole('button', { name: 'Add taxpayer' }).click();
    };
    await add('222222222222');
    await expect(dialog.getByTestId('unified-taxpayer-count')).toHaveText('1');
    await expect(dialog.getByTestId('unified-taxpayer-workspace')).toContainText('User 2');
    await add('333333333333');
    await expect(dialog.getByTestId('unified-taxpayer-count')).toHaveText('2');
    await expect(dialog.getByTestId('unified-taxpayer-workspace')).toBeVisible();
    if (page.viewportSize()?.width === 1280) await dialog.screenshot({path:'test-results/sohojkor-v5-candidate-stage1-desktop.png'});
    await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.locator('.taxpay-modal__subtitle')).toHaveText('Walk-in Payment');
    await expectFullWidthCta('Continue to Final Preview');
    // Keep the original modal header and thin progress; do not render extra visible step text.
    await expect(dialog.locator('.tax-service-choice__eyebrow')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Continue to Final Preview' })
      .locator('.payment-flow-embedded__action-long')).toHaveText('Continue to Final Preview');
    await expect(dialog.getByRole('button', { name: 'Continue to Final Preview' })
      .locator('.payment-flow-embedded__action-short')).toHaveText('Preview');
    await expect(dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__cancel')).toHaveCount(0);
    await expect(dialog.locator('.payment-flow-embedded__footer-actions > button')).toHaveCount(1);
    await dialog.locator('.taxpay-modal__back').click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
    await expect(dialog.getByTestId('unified-taxpayer-count')).toHaveText('2');
    await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByRole('progressbar', { name: 'Payment progress' })).toHaveAttribute('aria-valuemax', '3');
    await expect(dialog.locator('#guest-phone')).toHaveCount(0);
    await expect(dialog.locator('#guest-payment-remarks')).toHaveCount(0);

    const batch = dialog.getByTestId('other-tax-batch');
    // The approved directory is the only overview; open the Advance Tax
    // editor through View heads rather than a second always-visible list.
    await batch.locator('[data-head-group="Advance Tax"] > summary').click();
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
    // The editable total is the sum of ENTERED amounts, not a false payable
    // grand total: the second selected head still has no required amount.
    await expect(dialog.locator('.payment-form-summary__total')).toContainText('3,500');
    await expect(dialog.getByTestId('v5-compact-taxpayer-summary')).toContainText('Enter amounts for 1 selected head');
    await expect(dialog.getByRole('button', { name: 'Continue to Final Preview' })).toBeDisabled();
    await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('3500');

    // Approved v5 calculation is a compact subtotal by taxpayer. Keep the
    // complete editable allocations in the Payment Head composer instead.
    const mobileCalculation = dialog.getByTestId('mobile-payment-calculation');
    if (await mobileCalculation.count() && await mobileCalculation.getAttribute('open') === null) {
      await mobileCalculation.getByTestId('mobile-payment-calculation-toggle').click();
    }
    const calculation = dialog.getByTestId('v5-compact-taxpayer-summary');
    const taxpayerSummaries = calculation.locator('.payment-form-summary__compact-owner');
    await expect(taxpayerSummaries).toHaveCount(2);
    await expect(taxpayerSummaries.nth(0)).toContainText('User 2');
    await expect(taxpayerSummaries.nth(1)).toContainText('User 3');
    await expect(taxpayerSummaries.nth(0)).toContainText('3,500');
    await expect(taxpayerSummaries.nth(1)).toContainText('3,500');
    if (page.viewportSize()?.width === 1280) await dialog.screenshot({path:'test-results/sohojkor-v5-candidate-stage2-desktop.png'});
    await expect(calculation).not.toContainText('Show all');
    await expect(dialog.getByRole('button', { name: 'Copy TIN' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'টিআইএন কপি করুন' })).toHaveCount(0);
    // The selected head data remains in the composer despite not duplicating it in the sidebar.
    await expect(batch.getByTestId('other-tax-line')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Continue to Final Preview' }).click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(dialog.locator('.taxpay-modal__subtitle')).toHaveText('Walk-in Payment');
    await expectFullWidthCta('Make Payment');
    await expect(dialog.getByTestId('payment-review')).toBeVisible();
    // Frozen v3 Step 3 uses one taxpayer-grouped payment table and working
    // edit actions, with the existing calculation rail kept separately.
    const reviewTable = dialog.getByTestId('unified-v3-payment-details');
    await expect(reviewTable).toBeVisible();
    await expect(reviewTable.getByRole('heading', {name: 'Payment details'})).toBeVisible();
    await expect(reviewTable.locator('tbody tr.unified-v3-review__owner')).toHaveCount(2);
    const editTaxpayers = reviewTable.getByRole('button', {name: 'Edit taxpayers'});
    const editHeads = reviewTable.getByRole('button', {name: 'Edit heads & amounts'});
    await expect(editTaxpayers).toBeVisible();
    await expect(editHeads).toBeVisible();
    // Exact locked v5 visible copy (ARIA still exposes explicit edit actions).
    await expect(editTaxpayers).toHaveText('Taxpayers');
    await expect(editHeads).toHaveText('Heads & amounts');
    await expect(reviewTable.locator('.unified-v3-review__owner strong').first()).toContainText('Individual');
    await expect(reviewTable.locator('.unified-v3-review__owner span').first()).toContainText('222*********');
    await expect(dialog.locator('.payment-flow-embedded__footer-actions > .tax-service-choice__cancel')).toHaveCount(0);
    await expect(dialog.locator('.payment-flow-embedded__footer-actions > button')).toHaveCount(1);
    await expect(dialog.locator('.payment-flow-embedded__footer-actions > .tax-service-choice__continue')).toHaveText(/Make Payment/);
    await expect(dialog.getByRole('heading', { name: 'Payer and receipt details' })).toBeVisible();
    await expect(dialog.getByText('Payer information will appear on the receipt.')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Payment Remarks / Invoice Reference' })).toBeVisible();
    await expect(dialog.locator('#guest-phone')).toHaveCount(1);
    await expect(dialog.locator('#guest-payment-remarks')).toBeVisible();
    // Payer TIN is optional: hide the redundant matched-name input until Search.
    const payerLookup = dialog.getByTestId('walkin-payer-tin');
    await expect(payerLookup.locator('#guest-payer-tin-name')).toHaveCount(0);
    await expect(dialog.getByTestId('unified-v5-payer-result')).toHaveCount(0);
    await payerLookup.locator('#guest-payer-tin').fill('111111111111');
    await payerLookup.getByRole('button', {name: 'Search payer TIN'}).click();
    await expect(dialog.getByTestId('unified-v5-payer-result')).toContainText('User 1');
    await expect(dialog.getByTestId('unified-v5-payer-result')).toContainText('Individual');
    await payerLookup.locator('#guest-payer-tin').fill('222222222222');
    await expect(dialog.getByTestId('unified-v5-payer-result')).toHaveCount(0);
    await payerLookup.locator('#guest-payer-tin').clear();


    await dialog.locator('#guest-payer-name').fill('Test Walk-in Payer');
    await dialog.locator('#guest-phone').fill('01712345678');
    await dialog.locator('#guest-payment-remarks').fill('Assessment payment for sample user 2');
    await dialog.locator('.taxpay-modal__back').click();

    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
    await expect(dialog.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]')).toHaveValue('3500');
    await dialog.getByRole('button', { name: 'Continue to Final Preview' }).click();
    await expect(dialog.locator('#guest-payer-name')).toHaveValue('Test Walk-in Payer');
    await expect(dialog.locator('#guest-phone')).toHaveValue('01712345678');
    await expect(dialog.locator('#guest-payment-remarks')).toHaveValue('Assessment payment for sample user 2');
    if (page.viewportSize()?.width === 1280) await dialog.screenshot({path:'test-results/sohojkor-v5-candidate-stage3-desktop.png'});

    // Locked v5 review does not contain payment selection.
    await expect(dialog.getByRole('heading', { name: 'Choose payment channel' })).toHaveCount(0);
    await expect(dialog.getByTestId('unified-v5-payment-channel-screen')).toHaveCount(0);
    await expect(dialog.locator('.payment-review--unified-v5 .payment-review__aside')).toHaveCount(0);
    const finalPreview = dialog.getByTestId('unified-v3-payment-details');
    await expect(finalPreview).toBeVisible();

    // Make Payment opens a DISTINCT checkout screen, never another preview panel.
    await dialog.getByRole('button', { name: 'Make Payment' }).click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment channel');
    await expectFullWidthCta('Confirm payment');
    await expect(dialog.getByTestId('unified-v5-payment-channel-screen')).toBeVisible();
    await expect(finalPreview).toHaveCount(0);
    await expect(dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__cancel')).toHaveCount(0);
    await expect(dialog.locator('.payment-flow-embedded__footer-actions > button')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Confirm payment' })).toBeDisabled();
    await dialog.locator('.taxpay-modal__back').click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(dialog.locator('#guest-payer-name')).toHaveValue('Test Walk-in Payer');
    await dialog.getByRole('button', { name: 'Make Payment' }).click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment channel');
    await expect(dialog.getByRole('progressbar', { name: 'Payment progress' })).toHaveCount(0);
    // No duplicate footer Back: the modal header is the only backward control.
    await expect(dialog.locator('.payment-flow-embedded__footer-actions .tax-service-choice__cancel')).toHaveCount(0);
    await dialog.locator('.taxpay-modal__back').click();
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(finalPreview).toBeVisible();
    await expect(dialog.locator('#guest-phone')).toHaveValue('01712345678');
    await expect(dialog.locator('#guest-payment-remarks')).toHaveValue('Assessment payment for sample user 2');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
});
