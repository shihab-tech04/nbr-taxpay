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
    // Pixel-equivalent modal geometry with the approved Taxpayer Information
    // payment stage: 1160px width cap, 90dvh height, shared stepper and
    // 100dvh mobile sheet. Compare at the same viewport, not screenshots
    // captured at different browser dimensions.
    await expect(gift).toHaveAttribute('data-payment-stage', 'true');
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
    const bounds = await gift.evaluate(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {width:rect.width,height:rect.height,
        maxHeight:style.maxHeight,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight};
    });
    if (sample.width > 650) {
      expect(bounds.width).toBeCloseTo(Math.min(1160, sample.width - 32), 0);
      expect(bounds.height).toBeCloseTo(Math.min(sample.height * .9, 900), 0);
    } else {
      expect(bounds.width).toBeCloseTo(sample.width, 0);
      expect(bounds.height).toBeCloseTo(sample.height, 0);
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
    await donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'}).click();

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
    const overflow = await gift.locator('.taxpay-modal__body').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, 'Gift Tax modal body must not overflow at ' + sample.width + 'px').toBeLessThanOrEqual(2);
  });
}

test('Gift Tax disabled Continue uses the shared legible neutral style, not translucent white on blue', async ({page}) => {
  const gift = await openGiftTax(page, 'en');
  const button = gift.getByRole('button', {name: 'Continue to Gift & Tax Information'});
  await expect(button).toBeDisabled();
  await expect(button).toHaveCSS('opacity', '1');
  await expect(button).toHaveCSS('background-color', 'rgb(228, 234, 242)');
  await expect(button).toHaveCSS('color', 'rgb(82, 102, 129)');
});
