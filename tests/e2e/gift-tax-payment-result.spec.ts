import {expect,test} from '@playwright/test';

/** Production without official gateway must never manufacture paid/credited evidence. */
for(const sample of [
  {lang:'en' as const,width:1280,height:850},
  {lang:'bn' as const,width:375,height:812},
]) {
  test('Gift Tax Confirm & Pay fails closed with an honest Screen 4 and preserves edits '+sample.lang,async({page})=>{
    await page.setViewportSize({width:sample.width,height:sample.height});
    await page.goto('/?action=landing&lang='+sample.lang);
    const bn=sample.lang==='bn';
    await page.locator('.public-hero-carousel__slide[data-active="true"]')
      .getByRole('button',{name:bn?'অন্যান্য কর':'Other Tax'}).click();
    await page.locator('.taxpay-modal[data-public-service="login"]')
      .getByRole('button',{name:bn?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser')
      .getByRole('button',{name:/Gift Tax|দানকর/}).click();
    const gift=page.getByRole('dialog',{name:bn?'দানকর':'Gift Tax'});
    const donor=gift.getByTestId('gift-donor-section');
    await donor.locator('#gift-donor-tin').fill('111111111111');
    await donor.getByRole('button',{name:bn?/খুঁজুন:/:/Search Donor/}).click();
    await donor.getByRole('button',{name:bn?'দাতা যোগ করুন':'Add Donor'}).click();
    const donee=gift.getByTestId('gift-donee-section');
    await donee.locator('#gift-donee-tin').fill('222222222222');
    await donee.getByRole('button',{name:bn?/খুঁজুন:/:/Search Donee/}).click();
    await donee.locator('#gift-donee-relationship').click();
    await gift.getByRole('option',{name:bn?'বাবা':'Father'}).click();
    await donee.getByRole('button',{name:bn?'গ্রহীতা যোগ করুন':'Add Donee'}).click();
    await gift.getByRole('button',{name:bn?'দান ও করের তথ্যে এগিয়ে যান':'Continue to Gift & Tax Information'}).click();
    await gift.locator('#gift-tax-amount').fill('2500000');
    await gift.locator('#gift-tax-date').fill('2025-01-15');
    await gift.locator('#gift-tax-remarks').fill('Test gift remarks');
    await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় এগিয়ে যান':'Continue to Final Preview'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toContainText('Test gift remarks');
    await gift.getByRole('button',{name:bn?'নিশ্চিত করুন ও পরিশোধ করুন':'Confirm & Pay'}).click();
    await expect(gift.getByTestId('gift-tax-payment-result')).toBeVisible();
    await expect(gift.getByTestId('gift-tax-payment-result')).toContainText(bn?'পেমেন্ট শুরু হয়নি':'Payment not started');
    await expect(gift.locator('.receipt-view')).toHaveCount(0);
    await expect(gift.getByTestId('gift-tax-settled-documents')).toHaveCount(0);
    await expect(gift.getByRole('link',{name:/Download|ডাউনলোড/})).toHaveCount(0);
    await expect(gift.getByTestId('gift-tax-result-workspace')).toContainText(bn?'বাবা':'Father');
    await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় ফিরুন':'Back to Final Preview'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toContainText('Test gift remarks');
    await gift.getByRole('button',{name:bn?'দানের তথ্য সম্পাদনা':'Edit gift information'}).click();
    await expect(gift.locator('#gift-tax-amount')).toHaveValue('2500000');
    await expect(gift.locator('#gift-tax-remarks')).toHaveValue('Test gift remarks');
  });
}
