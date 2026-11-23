import {expect,test} from '@playwright/test';

/** Gift Tax uses the shared payment channel, lifecycle and receipt components;
 * all simulated records remain visibly nonfinancial and browser-local. */
for(const sample of [
  {lang:'en' as const,width:1280,height:850},
  {lang:'en' as const,width:1024,height:768},
  {lang:'bn' as const,width:375,height:812},
]) {
  test('Gift Tax shared simulated payment, sample receipt and edit recovery '+sample.lang+' '+sample.width,async({page})=>{
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
    await page.getByRole('option',{name:bn?'বাবা':'Father'}).click();
    await donee.getByRole('button',{name:bn?'গ্রহীতা যোগ করুন':'Add Donee'}).click();
    await expect(gift.getByTestId('gift-rail-donor')).toContainText(bn?'ইউজার 1':'User 1');
    await expect(gift.getByTestId('gift-rail-donee')).toContainText(bn?'ইউজার 2':'User 2');
    await expect(donor.getByTestId('gift-confirmed-donor')).not.toContainText(bn?'ইউজার 1':'User 1');
    await gift.getByRole('button',{name:bn?'দান ও করের তথ্যে এগিয়ে যান':'Continue to Gift & Tax Information'}).click();
    await gift.locator('#gift-tax-amount').fill('2500000');
    await gift.locator('#gift-tax-date').fill('2025-01-15');
    await gift.locator('#gift-tax-remarks').fill('Test gift remarks');
    const remarkBox=await gift.locator('#gift-tax-remarks').boundingBox();
    const giftAmountBox=await gift.locator('#gift-tax-amount').boundingBox();
    expect(remarkBox!.width).toBeGreaterThanOrEqual(giftAmountBox!.width);
    await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় এগিয়ে যান':'Continue to Final Preview'}).click();
    const review=gift.getByTestId('gift-tax-review');
    await expect(review).toContainText('Test gift remarks');
    await expect(review.getByTestId('unified-v3-gift-payment-details')).toBeVisible();
    await gift.getByRole('button',{name:bn?'নিশ্চিত করুন ও পরিশোধ করুন':'Confirm & Pay'}).click();
    await expect(gift.getByTestId('gift-tax-checkout')).toBeVisible();
    // The approved desktop checkout must retain a separate summary rail,
    // even though v5 review cards flatten their own inner grid.
    if(sample.width>900) {
      const [editor,rail,dialog]=await Promise.all([
        gift.locator('.gift-tax-workspace .gift-tax-main').boundingBox(),
        gift.locator('.gift-tax-workspace .gift-tax-aside').boundingBox(),
        gift.boundingBox(),
      ]);
      expect(editor&&rail&&dialog).toBeTruthy();
      expect(dialog!.width).toBeGreaterThan(900);
      expect(Math.abs(editor!.x+editor!.width-rail!.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(editor!.y-rail!.y)).toBeLessThanOrEqual(2);
    }
    await gift.getByRole('button',{name:bn?'অনলাইনে পরিশোধ':'Pay online'}).click();
    await gift.getByRole('button',{name:bn?'মোবাইল ব্যাংকিং':'Mobile banking'}).click();
    await gift.getByRole('radio',{name:'bKash'}).check();
    await gift.locator('.payment-review__ack input[type=checkbox]').check();
    await gift.getByRole('button',{name:bn?'পেমেন্ট সিমুলেশন করুন':'Simulate payment'}).click();
    await expect(gift.getByTestId('gift-tax-payment-result')).toBeVisible();
    if(sample.width>900) {
      const [editor,rail]=await Promise.all([
        gift.locator('.gift-tax-workspace .gift-tax-main').boundingBox(),
        gift.locator('.gift-tax-workspace .gift-tax-aside').boundingBox(),
      ]);
      expect(Math.abs(editor!.x+editor!.width-rail!.x)).toBeLessThanOrEqual(2);
    }
    const bodyOverflow=await gift.locator('.taxpay-modal__body').evaluate(el=>el.scrollWidth-el.clientWidth);
    expect(bodyOverflow).toBeLessThanOrEqual(2);
    await expect(gift.getByTestId('gift-tax-payment-result'))
      .toContainText(bn?'সিমুলেশন সম্পন্ন':'Simulation completed');
    await expect(gift.getByTestId('gift-tax-settled-documents')).toHaveCount(0);
    await expect(gift.getByRole('link',{name:/Download challan|চালান ডাউনলোড/})).toHaveCount(0);
    await gift.getByRole('button',{name:bn?'নমুনা রসিদ দেখুন':'View sample receipt'}).click();
    await expect(gift.getByTestId('gift-tax-simulation-receipt')).toBeVisible();
    await expect(gift.locator('.gift-tax-workspace .gift-tax-aside')).toBeHidden();
    if(sample.width>900) {
      const [editor,dialog]=await Promise.all([
        gift.locator('.gift-tax-workspace .gift-tax-main').boundingBox(),
        gift.boundingBox(),
      ]);
      expect(editor!.width).toBeGreaterThan(dialog!.width-70);
    }
    await expect(gift.getByTestId('gift-tax-sample-receipt')).toContainText('Test gift remarks');
    await expect(gift.getByTestId('gift-tax-sample-receipt')).toContainText(bn?'বাবা':'Father');
    await expect(gift.getByTestId('gift-tax-simulation-receipt')).toContainText(/SIM-GIFT-/);
    await gift.getByRole('button',{name:bn?'পেমেন্টের ফলে ফিরুন':'Back to payment result'}).click();
    await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় ফিরুন':'Back to Final Preview'}).click();
    await expect(review).toContainText('Test gift remarks');
    await gift.getByRole('button',{name:bn?'দানের তথ্য সম্পাদনা':'Edit gift information'}).click();
    await expect(gift.locator('#gift-tax-amount')).toHaveValue('2500000');
    await expect(gift.locator('#gift-tax-remarks')).toHaveValue('Test gift remarks');
  });
}

test('Gift Tax relationship popup escapes modal, flips above footer, and preserves keyboard selection',async({page})=>{
  await page.setViewportSize({width:1280,height:780});
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-hero-carousel__slide[data-active="true"]').getByRole('button',{name:'Other Tax'}).click();
  await page.locator('.taxpay-modal[data-public-service="login"]').getByRole('button',{name:'Walk-in Payment'}).click();
  await page.getByTestId('other-tax-chooser').getByRole('button',{name:'Gift Tax'}).click();
  const gift=page.getByRole('dialog',{name:'Gift Tax'});
  const donee=gift.getByTestId('gift-donee-section');
  await donee.locator('#gift-donee-tin').fill('222222222222');
  await donee.getByRole('button',{name:/Search Donee/}).click();
  await donee.locator('#gift-donee-relationship').click();
  const popup=page.locator('[data-searchable-popup-id="gift-donee-relationship"]');
  await expect(popup).toBeVisible();
  expect(await popup.evaluate(el=>el.parentElement===document.body)).toBe(true);
  const box=await popup.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y+box!.height).toBeLessThanOrEqual(780);
  await popup.getByRole('combobox',{name:'Search relationships'}).fill('Siblings');
  await popup.getByRole('combobox',{name:'Search relationships'}).press('Enter');
  await expect(donee.locator('#gift-donee-relationship')).toHaveAttribute('data-value','friends_family:siblings');
  await expect(donee.getByRole('button',{name:'Add Donee'})).toBeEnabled();
});
