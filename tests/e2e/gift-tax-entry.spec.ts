import {expect, test} from '@playwright/test';

for (const locale of ['en', 'bn'] as const) {
  test('Other Tax routes to Gift Tax two-screen donor/donee journey in ' + locale, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing&lang=en');
    const bn = locale === 'bn';
    const hero = page.locator('.public-hero-carousel__slide[data-active="true"]');
    await hero.getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    const entry = page.locator('.taxpay-modal[data-public-service="login"]');
    await expect(entry.locator('.taxpayer-login-dialog')).toBeVisible();
    await entry.getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    const chooser = page.getByTestId('other-tax-chooser');
    const chooserDialog = page.getByRole('dialog', {name: bn ? 'অন্যান্য কর পরিশোধ' : 'Other tax payments'});
    await expect(chooserDialog.locator('.taxpay-modal__footer')).toHaveCount(0);
    await expect(chooserDialog.locator('.taxpay-modal__title')).toHaveCSS('text-align', 'left');
    await expect(chooser.getByRole('button', {name: /Travel Tax|ভ্রমণ কর/})).toBeVisible();
    await chooser.getByRole('button', {name: /Gift Tax|দানকর/}).click();

    const gift = page.getByRole('dialog', {name: bn ? 'দানকর' : 'Gift Tax'});
    await expect(gift.getByTestId('gift-tax-entry-form')).toBeVisible();
    await expect(gift.locator('#gift-tax-amount')).toHaveCount(0);
    const nextDetails = gift.getByRole('button', {name: bn ? 'দান ও করের তথ্যে এগিয়ে যান' : 'Continue to Gift & Tax Information'});
    await expect(nextDetails).toBeDisabled();

    const donor = gift.getByTestId('gift-donor-section');
    await donor.locator('#gift-donor-tin').fill('111111111111');
    await donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/}).click();
    await expect(gift.getByTestId('gift-donor-result')).toBeVisible();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();
    await expect(gift.getByTestId('gift-added-donor').first()).toContainText('111');
    await expect(donor.getByRole('heading', {name: bn ? 'দাতা যোগ হয়েছে' : 'Donor added'})).toBeVisible();
    await expect(donor.getByTestId('gift-confirmed-donor')).toBeVisible();
    await expect(gift.getByTestId('gift-rail-donor').locator('.gift-tax-role-group__status'))
      .toHaveText(bn ? 'যোগ হয়েছে' : 'Added');

    const donee = gift.getByTestId('gift-donee-section');
    await donee.locator('#gift-donee-tin').fill('222222222222');
    await donee.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donee/}).click();
    await expect(donee.getByTestId('gift-donee-next-step')).toContainText(
      bn ? 'সম্পর্ক নির্বাচন করুন' : 'Select a relationship');
    await expect(donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'})).toBeDisabled();
    await donee.locator('#gift-donee-relationship').click();
    await page.getByRole('option', {name: bn ? 'বাবা' : 'Father'}).click();
    await expect(donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'})).toBeEnabled();
    await expect(donee.getByTestId('gift-donee-next-step')).toContainText(
      bn ? 'সম্পর্ক নির্বাচন হয়েছে' : 'Relationship selected');
    await donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'}).click();
    await expect(donee.getByRole('heading', {name: bn ? 'গ্রহীতা যোগ হয়েছে' : 'Donee added'})).toBeVisible();
    await expect(gift.getByTestId('gift-rail-donee').locator('.gift-tax-role-group__status'))
      .toHaveText(bn ? 'যোগ হয়েছে' : 'Added');
    await expect(gift.getByTestId('gift-rail-donee').locator('.gift-tax-identity-card__relationship'))
      .toContainText(bn ? 'বাবা' : 'Father');
    // Keep both confirmed identity cards compact even when the rail is taller.
    const editor = gift.getByTestId('gift-tax-entry-form').locator('.gift-tax-main');
    await expect(editor).toHaveCSS('display', 'flex');
    const [donorBounds, doneeBounds] = await Promise.all([donor.boundingBox(), donee.boundingBox()]);
    expect(donorBounds && doneeBounds, 'Both donor and donee must render').toBeTruthy();
    if (donorBounds && doneeBounds) {
      expect(doneeBounds.y - donorBounds.y - donorBounds.height).toBeLessThanOrEqual(28);
    }
    await expect(nextDetails).toBeEnabled();
    await nextDetails.click();
    await expect(gift.getByTestId('gift-tax-details-form')).toBeVisible();
    await gift.locator('#gift-tax-amount').fill('2500000');
    await gift.locator('#gift-tax-description').fill('Gift of property');
    await gift.locator('#gift-tax-date').fill('2025-01-15');
    await gift.locator('#gift-tax-remarks').fill('Gift tax review');
    await expect(gift.getByTestId('gift-tax-estimate')).toContainText(bn ? '২,৭২,০০০' : '2,72,000');

    await gift.getByRole('button', {name: bn ? 'আগের দানকর স্ক্রিনে ফিরুন' : 'Back to previous Gift Tax screen'}).click();
    await expect(gift.getByTestId('gift-tax-entry-form')).toBeVisible();
    await gift.getByRole('button', {name: bn ? 'দান ও করের তথ্যে এগিয়ে যান' : 'Continue to Gift & Tax Information'}).click();
    await expect(gift.locator('#gift-tax-amount')).toHaveValue('2500000');
    await gift.getByRole('button', {name: bn ? 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান' : 'Continue to Final Preview'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toBeVisible();
    await expect(gift.getByTestId('gift-tax-review')).toContainText(bn ? 'বাবা' : 'Father');
    await expect(gift.getByRole('button', {name: bn ? 'দানের তথ্য সম্পাদনা' : 'Edit gift information'})).toBeVisible();
    await expect(gift.getByTestId('gift-tax-review')).toContainText(bn ? 'মাধ্যম' : 'Through');
    await expect(gift.getByTestId('gift-tax-review')).toContainText(bn ? 'যার পক্ষে' : 'On Behalf Of');
    await expect(gift.getByTestId('gift-tax-review-complete')).toContainText(bn ? 'কোনো টাকা কাটা হয়নি' : 'No money was charged');
    await expect(page.locator('.receipt-view')).toHaveCount(0);
    await gift.getByRole('button', {name: bn ? 'পর্যালোচনা বন্ধ করুন' : 'Close preview'}).click();
    const discard = page.getByTestId('walkin-payment-exit-overlay');
    await expect(discard).toBeVisible();
    await discard.getByRole('button', {name: bn ? 'সম্পাদনা চালিয়ে যান' : 'Keep editing'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toBeVisible();
    await gift.getByRole('button', {name: bn ? 'পর্যালোচনা বন্ধ করুন' : 'Close preview'}).click();
    await discard.getByRole('button', {name: bn ? 'কর পরিশোধ বাদ দিন' : 'Discard tax payment'}).click();
    await expect(gift).toHaveCount(0);

    await hero.getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    await entry.getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser').getByRole('button', {name: /Travel Tax|ভ্রমণ কর/}).click();
    await expect(page.getByRole('dialog', {name: bn ? /ভ্রমণ কর/ : /Travel tax/i})).toBeVisible();
  });

  test('Gift Tax does not accept missing or duplicated identities in ' + locale, async ({page}) => {
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing&lang=en');
    const bn = locale === 'bn';
    await page.locator('.public-hero-carousel__slide[data-active="true"]')
      .getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    await page.locator('.taxpay-modal[data-public-service="login"]')
      .getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser').getByRole('button', {name: /Gift Tax|দানকর/}).click();
    const gift = page.getByRole('dialog', {name: bn ? 'দানকর' : 'Gift Tax'});
    const donor = gift.getByTestId('gift-donor-section');
    const donee = gift.getByTestId('gift-donee-section');
    await donor.locator('#gift-donor-tin').fill('111111111111');
    await donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/}).click();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();
    await donee.locator('#gift-donee-tin').fill('111111111111');
    await donee.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donee/}).click();
    await donee.locator('#gift-donee-relationship').click();
    await page.getByRole('option', {name: bn ? 'বাবা' : 'Father'}).click();
    await expect(donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'})).toBeEnabled();
    await donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'}).click();
    await expect(donee.getByRole('alert')).toBeVisible();
    await expect(gift.getByRole('button', {name: bn ? 'দান ও করের তথ্যে এগিয়ে যান' : 'Continue to Gift & Tax Information'})).toBeDisabled();
  });
}


test('Gift Tax Others needs a description and close uses the shared walk-in confirmation', async ({page}) => {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-hero-carousel__slide[data-active="true"]').getByRole('button', {name:'Other Tax'}).click();
  await page.locator('.taxpay-modal[data-public-service="login"]').getByRole('button', {name:'Walk-in Payment'}).click();
  await page.getByTestId('other-tax-chooser').getByRole('button', {name:'Gift Tax'}).click();
  const gift = page.getByRole('dialog', {name:'Gift Tax'});
  const donee = gift.getByTestId('gift-donee-section');
  await donee.locator('#gift-donee-tin').fill('222222222222');
  await donee.getByRole('button', {name:/Search Donee/}).click();
  await donee.locator('#gift-donee-relationship').click();
  await page.getByRole('option', {name:/Others — specify/}).click();
  await expect(donee.getByRole('button', {name:'Add Donee'})).toBeDisabled();
  await donee.locator('#gift-donee-other').fill('Cousin');
  await expect(donee.getByRole('button', {name:'Add Donee'})).toBeEnabled();
  await donee.getByRole('button', {name:'Add Donee'}).click();
  await expect(gift.getByTestId('gift-added-donee')).toContainText('Cousin');
  await gift.getByRole('button', {name:'Close Gift Tax'}).click();
  const confirmation = page.getByTestId('walkin-payment-exit-overlay');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', {name:'Keep editing'}).click();
  await expect(gift.getByTestId('gift-added-donee')).toContainText('Cousin');
  await gift.getByRole('button', {name:'Close Gift Tax'}).click();
  await confirmation.getByRole('button', {name:'Discard tax payment'}).click();
  await expect(gift).toHaveCount(0);
});


for (const language of ['en', 'bn'] as const) {
  test('Gift Tax edit/Cancel/Undo never silently drops a selected identity (' + language + ')', async ({page}) => {
    const bn = language === 'bn';
    await page.goto('/?action=landing&lang=' + language);
    await page.locator('.public-hero-carousel__slide[data-active="true"]')
      .getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    await page.locator('.taxpay-modal[data-public-service="login"]')
      .getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser').getByRole('button', {name: /Gift Tax|দানকর/}).click();
    const gift = page.getByRole('dialog', {name: bn ? 'দানকর' : 'Gift Tax'});
    const donor = gift.getByTestId('gift-donor-section');
    const rail = gift.getByTestId('gift-tax-identity-rail');
    await donor.locator('#gift-donor-tin').fill('111111111111');
    await donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/}).click();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();
    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('1');
    await expect(rail.getByTestId('gift-added-donor')).toContainText(bn ? 'ইউজার 1' : 'User 1');

    await donor.getByRole('button', {name: bn ? 'সম্পাদনা করুন: দাতা' : 'Edit Donor'}).click();
    await expect(rail.getByTestId('gift-added-donor')).toHaveCount(1);
    await expect(donor.locator('#gift-donor-tin')).toHaveValue('111111111111');
    await donor.locator('#gift-donor-tin').fill('333333333333');
    await expect(rail.getByTestId('gift-added-donor')).toContainText(bn ? 'ইউজার 1' : 'User 1');
    await donor.getByRole('button', {name: bn ? 'সম্পাদনা বাতিল' : 'Cancel editing'}).click();
    await expect(donor.getByTestId('gift-confirmed-donor')).toBeVisible();
    await expect(rail.getByTestId('gift-added-donor')).toContainText(bn ? 'ইউজার 1' : 'User 1');

    await donor.getByRole('button', {name: bn ? 'সম্পাদনা করুন: দাতা' : 'Edit Donor'}).click();
    await donor.locator('#gift-donor-tin').fill('333333333333');
    await donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/}).click();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();
    await expect(rail.getByTestId('gift-added-donor')).toContainText(bn ? 'ইউজার 3' : 'User 3');
    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('1');
    await rail.getByRole('button', {name: bn ? 'সরান: দাতা' : 'Remove Donor'}).click();
    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('0');
    await expect(gift.getByTestId('gift-tax-undo')).toBeVisible();
    await gift.getByTestId('gift-tax-undo').click();
    await expect(rail.getByTestId('gift-added-donor')).toContainText(bn ? 'ইউজার 3' : 'User 3');
    await expect(gift.getByTestId('gift-tax-undo')).toHaveCount(0);
    await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('1');
  });

  test('Gift Tax date errors and relationship popup keyboard are accessible (' + language + ')', async ({page}) => {
    const bn = language === 'bn';
    await page.goto('/?action=landing&lang=' + language);
    await page.locator('.public-hero-carousel__slide[data-active="true"]')
      .getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    await page.locator('.taxpay-modal[data-public-service="login"]')
      .getByRole('button', {name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser').getByRole('button', {name: /Gift Tax|দানকর/}).click();
    const gift = page.getByRole('dialog', {name: bn ? 'দানকর' : 'Gift Tax'});
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-label',
      bn ? 'পেমেন্টের অগ্রগতি' : 'Payment progress');
    await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuetext',
      bn ? '৩ ধাপের ১ নম্বর ধাপ' : 'Step 1 of 3');
    const donor = gift.getByTestId('gift-donor-section');
    await donor.locator('#gift-donor-tin').fill('111111111111');
    await donor.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donor/}).click();
    await donor.getByRole('button', {name: bn ? 'দাতা যোগ করুন' : 'Add Donor'}).click();
    const donee = gift.getByTestId('gift-donee-section');
    await donee.locator('#gift-donee-tin').fill('222222222222');
    await donee.getByRole('button', {name: bn ? /খুঁজুন:/ : /Search Donee/}).click();
    const chooser = donee.locator('#gift-donee-relationship');
    await chooser.click();
    await page.getByRole('option', {name: bn ? 'বাবা' : 'Father'}).click();
    await chooser.click();
    const search = page.getByRole('combobox', {name: bn ? 'সম্পর্ক খুঁজুন' : 'Search relationships'});
    await expect(search).toBeFocused();
    await search.press('Tab');
    await expect(donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'})).toBeFocused();
    await chooser.click();
    await search.press('Shift+Tab');
    // Native reverse Tab reaches the adjacent search-result Reveal TIN control,
    // rather than skipping that keyboard-accessible identity privacy action.
    await expect(donee.getByRole('button', {name: bn ? 'টিআইএন দেখুন' : 'Reveal TIN'})).toBeFocused();
    await donee.getByRole('button', {name: bn ? 'গ্রহীতা যোগ করুন' : 'Add Donee'}).click();
    await gift.getByRole('button', {name: bn ? 'দান ও করের তথ্যে এগিয়ে যান' : 'Continue to Gift & Tax Information'}).click();
    await gift.locator('#gift-tax-amount').fill('2500000');
    await gift.getByRole('button', {name: bn ? 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান' : 'Continue to Final Preview'}).click();
    const date = gift.locator('#gift-tax-date');
    await expect(date).toBeFocused();
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(date).toHaveAttribute('aria-describedby', 'gift-tax-date-error');
    await expect(gift.locator('#gift-tax-date-error')).toBeVisible();
    await date.fill('2025-01-15');
    await expect(date).toHaveAttribute('aria-invalid', 'false');
    await gift.getByRole('button', {name: bn ? 'চূড়ান্ত পর্যালোচনায় এগিয়ে যান' : 'Continue to Final Preview'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toBeVisible();
  });
}
