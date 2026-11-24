import {expect,test,type Page} from '@playwright/test';

const GIFT_ID='10000000-0000-4000-8000-000000000901';
async function mockGiftSql(page:Page){
 const calls:Record<string,any>[]=[];
 const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'*'};
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await page.route('**/functions/v1/demo-story1-taxpay/payments**',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(req.method()==='POST'){
   calls.push(req.postDataJSON());
   return route.fulfill({status:200,headers,json:{success:true,id:GIFT_ID,status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true}});
  }
  const saved=calls.at(-1);
  if(req.method()==='GET'&&saved&&new URL(req.url()).pathname.endsWith('/'+GIFT_ID))
   return route.fulfill({status:200,headers,json:{success:true,simulationOnly:true,data:{id:GIFT_ID,status:'SIMULATED_SUCCESS',createdAt:'2026-11-24T06:00:00Z',data:{...saved,origin:'TAXPAY_UI'}}}});
  return route.fulfill({status:200,headers,json:{success:true,simulationOnly:true,data:{items:[],total:0}}});
 });
 return calls;
}

/** Gift Tax uses the shared payment channel, lifecycle and receipt components;
 * all simulated records remain visibly nonfinancial and browser-local. */
for(const sample of [
  {lang:'en' as const,width:1280,height:850},
  {lang:'en' as const,width:1024,height:768},
  {lang:'bn' as const,width:375,height:812},
  {lang:'en' as const,width:1600,height:900,signedIn:true},
  {lang:'bn' as const,width:1600,height:900,signedIn:true},
  {lang:'en' as const,width:375,height:812,signedIn:true},
  {lang:'bn' as const,width:375,height:812,signedIn:true},
]) {
  test('Gift Tax shared simulated payment, sample receipt and edit recovery '+sample.lang+' '+sample.width+('signedIn' in sample?' signed in':' guest'),async({page})=>{
    await page.setViewportSize({width:sample.width,height:sample.height});
    const signedIn='signedIn' in sample && sample.signedIn;
    const calls=signedIn?await mockGiftSql(page):[];
    await page.goto((signedIn?'/?action=taxpayer_home&demoUser=user1&lang=':'/?action=landing&lang=')+sample.lang);
    const bn=sample.lang==='bn';
    if(signedIn){
      if(sample.width>=1600){
        const rail=page.getByRole('complementary',{name:bn?'করদাতা ডেস্কটপ নেভিগেশন':'Taxpayer desktop navigation'});
        await rail.getByRole('button',{name:bn?'লেনদেন':'Activity',exact:true}).click();
        await rail.getByRole('button',{name:bn?'কর পরিশোধের মেনু':'Pay Tax menu'}).click();
      }else await page.getByRole('button',{name:bn?'কর পরিশোধের ধরন নির্বাচন':'Pay — select payment type'}).click();
      const menu=page.getByRole('menu',{name:bn?(sample.width>=1600?'কর পরিশোধের বিকল্প':'পরিশোধের ধরন'):'Payment options'});
      await expect(menu.getByRole('menuitem')).toHaveText(bn?['কর পরিশোধ','ভ্রমণ কর','দানকর']:['Pay Tax','Travel Tax','Gift Tax']);
      await menu.getByRole('menuitem',{name:bn?'দানকর':'Gift Tax',exact:true}).click();
      await expect(menu).toHaveCount(0);
    }else{
    await page.locator('.public-hero-carousel__slide[data-active="true"]')
      .getByRole('button',{name:bn?'অন্যান্য কর':'Other Tax'}).click();
    await page.locator('.taxpay-modal[data-public-service="login"]')
      .getByRole('button',{name:bn?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser')
      .getByRole('button',{name:/Gift Tax|দানকর/}).click();
    }
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
    await expect(review.locator('#gift-tax-final-remarks')).toHaveValue('Test gift remarks');
    await expect(review.getByTestId('unified-v3-gift-payment-details')).toBeVisible();
    await expect(review.getByRole('heading',{name:bn?'পরিশোধকারী ও রসিদের তথ্য':'Payer and receipt details'})).toBeVisible();
    await expect(review.locator('.unified-taxpayer-workspace__rail')).toHaveCount(0);
    await review.locator('#gift-review-payer-name').fill('Sample Payer');
    await review.locator('#gift-review-phone').fill('01712345678');
    await gift.getByRole('button',{name:bn?'পেমেন্ট করুন':'Make Payment'}).click();
    await expect(gift.getByTestId('gift-tax-checkout')).toBeVisible();
    // Approved Taxpayer payment channel is full-width, with no Gift Tax split rail.
    await expect(gift.locator('.gift-tax-checkout .unified-taxpayer-workspace__rail')).toHaveCount(0);
    const channelRect=await gift.getByTestId('gift-tax-checkout').boundingBox();
    const dialogRect=await gift.boundingBox();
    expect(channelRect&&dialogRect).toBeTruthy();
    expect(channelRect!.width).toBeGreaterThan(dialogRect!.width-95);
    await gift.getByRole('button',{name:bn?'অনলাইনে পরিশোধ':'Pay online'}).click();
    await gift.getByRole('button',{name:bn?'মোবাইল ব্যাংকিং':'Mobile banking'}).click();
    await gift.getByRole('radio',{name:'bKash'}).check();
    await gift.locator('.payment-review__ack input[type=checkbox]').check();
    await gift.getByRole('button',{name:bn?'নমুনা পেমেন্ট নিশ্চিত করুন':'Confirm sample payment'}).click();
    await expect(gift.getByTestId('gift-tax-payment-result')).toBeVisible();
    await expect(gift.locator('.gift-tax-result-workspace .unified-taxpayer-workspace__rail')).toHaveCount(0);
    const bodyOverflow=await gift.locator('.taxpay-modal__body').evaluate(el=>el.scrollWidth-el.clientWidth);
    expect(bodyOverflow).toBeLessThanOrEqual(2);
    await expect(gift.getByTestId('gift-tax-payment-result'))
      .toContainText(bn?'পেমেন্ট রেকর্ড সংরক্ষিত':'Payment record saved');
    if(signedIn){
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({service:'GIFT_TAX',amountMinor:27200000,details:{challanRemarks:'Test gift remarks',giftDetails:{donor:{tin:'111111111111'},donee:{tin:'222222222222',relationship:'father'},giftAmountMinor:250000000,estimatedTaxMinor:27200000}}});
      expect(calls[0].details.receiptSnapshot.paymentCategory).toBe('GIFT_TAX');
      await expect(gift.getByTestId('gift-tax-payment-result')).toContainText(calls[0].details.receiptReference);
    }
    await expect(gift.getByTestId('gift-tax-settled-documents')).toHaveCount(0);
    await expect(gift.getByRole('link',{name:/Download challan|চালান ডাউনলোড/})).toHaveCount(0);
    await gift.getByRole('button',{name:bn?'নমুনা চালানের বিবরণ':'Sample Challan Details'}).click();
    await expect(gift.getByTestId('gift-tax-simulation-receipt')).toBeVisible();
    await expect(gift.locator('.gift-tax-workspace .gift-tax-aside')).toBeHidden();
    const receiptRect=await gift.getByTestId('gift-tax-result-workspace').boundingBox();
    const receiptDialogRect=await gift.boundingBox();
    expect(receiptRect&&receiptDialogRect).toBeTruthy();
    expect(receiptRect!.width).toBeGreaterThan(receiptDialogRect!.width-95);
    await expect(gift.getByTestId('gift-tax-sample-receipt')).toContainText('Test gift remarks');
    await expect(gift.getByTestId('gift-tax-sample-receipt')).toContainText(bn?'বাবা':'Father');
    await expect(gift.getByTestId('gift-tax-simulation-receipt')).toContainText(/SIM-GIFT-/);
    await gift.getByRole('button',{name:bn?'পেমেন্টের ফলে ফিরুন':'Back to payment result'}).click();
    // The approved walk-in result has independent lifecycle, receipt and benefits cards.
    await expect(gift.getByTestId('gift-tax-result-shell').locator('.payment-flow-embedded__confirmation-layout > .payment-lifecycle')).toBeVisible();
    const benefits=gift.getByTestId('walkin-result-benefits');
    await expect(gift.getByTestId('walkin-challan-action')).toBeVisible();
    if(!signedIn){
      await expect(benefits).toBeVisible();
      await benefits.getByRole('button',{name:bn?'সাইন ইন ছাড়াই চালিয়ে যান':'Continue without Login'}).click();
    }
    await expect(benefits).toHaveCount(0);
    await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় ফিরুন':'Back to Final Preview'}).click();
    await expect(review.locator('#gift-tax-final-remarks')).toHaveValue('Test gift remarks');
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


test('Gift Tax bank branch simulation completes with the approved result, then zero-tax recovery',async({page})=>{
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-hero-carousel__slide[data-active="true"]')
    .getByRole('button',{name:'Other Tax'}).click();
  await page.locator('.taxpay-modal[data-public-service="login"]')
    .getByRole('button',{name:'Walk-in Payment'}).click();
  await page.getByTestId('other-tax-chooser').getByRole('button',{name:'Gift Tax'}).click();
  const gift=page.getByRole('dialog',{name:'Gift Tax'});
  const donor=gift.getByTestId('gift-donor-section');
  await donor.locator('#gift-donor-tin').fill('111111111111');
  await donor.getByRole('button',{name:/Search Donor/}).click();
  await donor.getByRole('button',{name:'Add Donor'}).click();
  const donee=gift.getByTestId('gift-donee-section');
  await donee.locator('#gift-donee-tin').fill('222222222222');
  await donee.getByRole('button',{name:/Search Donee/}).click();
  await donee.locator('#gift-donee-relationship').click();
  await page.getByRole('option',{name:'Father'}).click();
  await donee.getByRole('button',{name:'Add Donee'}).click();
  await gift.getByRole('button',{name:'Continue to Gift & Tax Information'}).click();
  await gift.locator('#gift-tax-amount').fill('2500000');
  await gift.locator('#gift-tax-date').fill('2025-01-15');
  await gift.locator('#gift-tax-remarks').fill('Bank simulation reference sample only');
  await gift.getByRole('button',{name:'Continue to Final Preview'}).click();
  await gift.locator('#gift-review-payer-name').fill('Sample Bank Payer');
  await gift.locator('#gift-review-phone').fill('01712345678');
  await gift.getByRole('button',{name:'Make Payment'}).click();
  await gift.getByRole('button',{name:'Pay at a bank branch'}).click();
  await gift.locator('.payment-review__ack input[type=checkbox]').check();
  const writes:string[]=[];
  page.on('request',request=>{
    if(request.method()==='GET')return;
    try {const url=new URL(request.url());
      if(url.hostname.endsWith('.supabase.co')&&/payment|gift|challan|credit|ledger/i.test(url.pathname)) {
        writes.push(request.method()+' '+url.pathname);
      }
    }catch{/* ignore non-URL requests */}
  });
  await gift.getByRole('button',{name:'Confirm sample payment'}).click();
  const result=gift.getByTestId('gift-tax-payment-result');
  await expect(result.getByRole('heading',{name:'Bank payment slip ready'})).toBeVisible();
  await expect(result).toContainText('This is not tax paid yet');
  const ref=await result.locator('.payment-lifecycle__reference-value').innerText();
  expect(ref).toMatch(/^SIM-GIFT-/);
  await result.getByRole('button',{name:'Continue sample bank payment'}).click();
  await expect(result.getByRole('heading',{name:'Payment record saved'})).toBeVisible();
  await expect(result.locator('.payment-lifecycle__reference-value')).toHaveText(ref);
  await expect(gift.getByTestId('walkin-challan-action')).toBeVisible();
  await gift.getByRole('button',{name:'Sample Challan Details'}).click();
  await expect(gift.getByTestId('gift-tax-simulation-receipt')).toContainText('SIMULATION ONLY');
  await gift.getByRole('button',{name:'Back to payment result'}).click();
  expect(writes, 'Sample bank settlement must not write money or credit to SQL').toEqual([]);
  await gift.getByRole('button',{name:'Back to Final Preview'}).click();
  await gift.getByRole('button',{name:'Edit gift information'}).click();
  await gift.locator('#gift-tax-amount').fill('1');
  await gift.getByRole('button',{name:'Continue to Final Preview'}).click();
  await gift.getByRole('button',{name:'Finish no-tax review'}).click();
  const zero=gift.getByTestId('gift-tax-payment-result');
  await expect(zero.getByRole('heading',{name:'No Gift Tax payable'})).toBeVisible();
  await expect(zero).toContainText('No payment was initiated');
  await expect(gift.getByTestId('walkin-challan-action')).toHaveCount(0);
  await expect(gift.getByTestId('walkin-result-benefits')).toHaveCount(0);
  await zero.getByRole('button',{name:'Back to Final Preview'}).click();
  await expect(gift.locator('#gift-tax-final-remarks')).toHaveValue('Bank simulation reference sample only');
  expect(writes).toEqual([]);
});
