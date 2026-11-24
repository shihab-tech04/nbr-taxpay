import {expect, test, type Page} from '@playwright/test';

async function openGiftTax(page: Page, language: 'en' | 'bn') {
  const bn = language === 'bn';
  await page.goto('/?action=landing&lang=' + language);
  await page.locator('.public-hero-carousel__slide[data-active="true"]')
    .getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
  const access = page.locator('.taxpay-modal[data-public-service="login"]');
  await expect(access).toBeVisible();
  await access.getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
  await page.getByTestId('other-tax-chooser')
    .getByRole('button', {name: /Gift Tax|দানকর/}).click();
  const gift = page.getByRole('dialog', {name: bn ? 'দানকর' : 'Gift Tax'});
  await expect(gift).toBeVisible();
  return gift;
}

for (const sample of [
  {language: 'en' as const, width: 1280, height: 850},
  {language: 'bn' as const, width: 375, height: 812},
  {language: 'en' as const, width: 320, height: 720},
]) {
  test('Gift Tax shared TIN input, summary and disabled controls keep approved parity ' + sample.language + ' ' + sample.width, async ({page}) => {
    await page.setViewportSize({width: sample.width, height: sample.height});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const gift = await openGiftTax(page, sample.language);
    const bn = sample.language === 'bn';
    // Match the REAL approved Taxpayer workspace, not just the shell width.
    await expect(gift).toHaveAttribute('data-payment-stage', 'true');
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
    await expect(gift.locator('.taxpay-modal__subtitle')).toHaveText(bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment');
    await expect(gift.getByTestId('gift-tax-entry-form')).toHaveClass(/payment-flow-embedded--unified/);
    const editor = gift.locator('.unified-taxpayer-workspace__editor');
    const rail = gift.locator('.unified-taxpayer-workspace__rail');
    await expect(editor).toHaveCount(1);
    await expect(rail).toHaveCount(1);
    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('0');
    await expect(gift.getByTestId('gift-tax-identity-rail')).toContainText(bn ? 'কোনো দাতা বা গ্রহীতা যোগ করা হয়নি' : 'No donor or donee added');
    await expect(gift.locator('.unified-taxpayer-workspace__empty')).toHaveCount(2);
    const bounds = await gift.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {width:rect.width,height:rect.height};
    });
    if (sample.width > 650) {
      expect(bounds.width).toBeCloseTo(Math.min(1160, sample.width - 32), 0);
      expect(bounds.height).toBeLessThanOrEqual(Math.min(sample.height * .9, 800) + 1);
    } else {
      expect(bounds.width).toBeCloseTo(sample.width, 0);
      expect(bounds.height).toBeCloseTo(sample.height, 0);
    }
    if (sample.width > 900) {
      const [editorRect, railRect, bodyRect] = await Promise.all([
        editor.boundingBox(), rail.boundingBox(), gift.locator('.taxpay-modal__body').boundingBox(),
      ]);
      expect(editorRect && railRect && bodyRect).toBeTruthy();
      if (editorRect && railRect && bodyRect) {
        // No inset card/gap: full-height rail meets the editor at its edge.
        expect(Math.abs(editorRect.x + editorRect.width - railRect.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(bodyRect.x + bodyRect.width - (railRect.x + railRect.width))).toBeLessThanOrEqual(2);
        expect(Math.abs(editorRect.y - railRect.y)).toBeLessThanOrEqual(2);
      }
    }


    // TinyFish suggested clicking the digit row closed Gift Tax; verify a real
    // trusted pointer interaction rather than treating browser-agent inference as proof.
    const donor = gift.getByTestId('gift-donor-section');
    const digitRow = donor.getByTestId('taxpayer-tin-digits');
    await expect(digitRow.locator(':scope > span')).toHaveCount(12);
    await digitRow.click({position: {x: 12, y: 16}});
    await expect(gift).toBeVisible();
    await expect(donor.locator('#gift-donor-tin')).toBeFocused();
    await donor.locator('#gift-donor-tin').fill('111111111111');
    const searchDonor = donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/});
    await expect(searchDonor).toBeEnabled();
    await searchDonor.click();
    await expect(gift.getByTestId('gift-donor-result')).toBeVisible();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();

    const donee = gift.getByTestId('gift-donee-section');
    await donee.locator('#gift-donee-tin').fill('222222222222');
    await donee.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donee/}).click();
    await donee.locator('#gift-donee-relationship').click();
    await page.getByRole('option', {name: bn ? 'বাবা' : 'Father'}).click();
    await expect(donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'})).toBeEnabled();
    await donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'}).click();

    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('2');
    await expect(gift.getByTestId('gift-added-donee')).toContainText(bn ? 'বাবা' : 'Father');
    const header = gift.locator('.taxpay-modal__title');
    await expect(header).toHaveCSS('text-align', 'left');
    await expect(gift.locator('.gift-tax-aside').first()).toHaveClass(/payment-form-summary/);
    const continueButton = gift.getByRole('button', {name: bn ? 'দান ও করের তথ্যে এগিয়ে যান' : 'Continue to Gift & Tax Information'});
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    const details = gift.getByTestId('gift-tax-details-form');
    await expect(details).toBeVisible();
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
    await expect(details.locator('.gift-tax-field-control')).toHaveCount(4);
    await expect(details.locator('.gift-tax-field-label')).toHaveCount(4);
    await expect(details.locator('#gift-tax-amount')).toHaveCSS('font-size', '16px');
    await expect(gift.getByTestId('gift-tax-payment-summary')).toHaveClass(/payment-form-summary/);
    await expect(gift.getByTestId('gift-tax-estimate')).toHaveAttribute('aria-live', 'polite');

    await details.locator('#gift-tax-amount').fill('2500000');
    await details.locator('#gift-tax-date').fill('2025-01-15');
    await expect(gift.getByTestId('gift-tax-estimate')).toContainText(bn ? '২,৭২,০০০' : '2,72,000');
    await gift.getByRole('button', {name: bn ? 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান' : 'Continue to Final Preview'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toBeVisible();
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
    await expect(gift.getByTestId('gift-tax-review-complete')).toBeVisible();
    await expect(gift.getByRole('button', {name: /pay now|এখনই পরিশোধ/i})).toHaveCount(0);
    if (sample.width <= 520) {
      const rows = gift.locator('.gift-tax-approved-table tbody tr:not(.unified-v3-review__owner)');
      await expect(rows).toHaveCount(2);
      for (const row of await rows.all()) {
        const cells = row.locator('td');
        await expect(cells).toHaveCount(3);
        const [label, date, amount] = await Promise.all([0, 1, 2].map(i => cells.nth(i).boundingBox()));
        expect(label && date && amount, 'Gift Tax preview requires visible label, date and amount').toBeTruthy();
        if (label && date && amount) {
          expect(label.width).toBeGreaterThanOrEqual(160);
          expect(date.width).toBeGreaterThanOrEqual(70);
          expect(amount.width).toBeGreaterThanOrEqual(55);
          expect(label.y + label.height).toBeLessThanOrEqual(date.y + 2);
          expect(label.y + label.height).toBeLessThanOrEqual(amount.y + 2);
          expect(date.x + date.width).toBeLessThanOrEqual(amount.x + 2);
          expect(Math.abs(date.y - amount.y)).toBeLessThanOrEqual(2);
        }
      }
    }
    const overflow = await gift.locator('.taxpay-modal__body').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, 'Gift Tax modal body must not overflow at ' + sample.width + 'px').toBeLessThanOrEqual(2);
  });
}

test('Gift Tax uses the same approved payment footer action as Taxpayer Information', async ({page}) => {
  const gift = await openGiftTax(page, 'en');
  const button = gift.getByRole('button', {name: 'Continue to Gift & Tax Information'});
  await expect(button).toBeDisabled();
  await expect(button).toHaveClass(/tax-service-choice__continue/);
  await expect(button.locator('svg')).toHaveCount(1);
  // Approved v5 explicitly uses an opaque muted-blue fill for disabled primary actions.
  await expect(button).toHaveCSS('background-color', 'rgb(137, 166, 211)');
  await expect(button).toHaveCSS('opacity', '1');
  const footerRect = await gift.locator('.taxpay-modal__footer').boundingBox();
  const buttonRect = await button.boundingBox();
  expect(footerRect && buttonRect).toBeTruthy();
  if (footerRect && buttonRect) {
    expect(buttonRect.width).toBeGreaterThan(footerRect.width - 80);
  }
});
