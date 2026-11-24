import {chromium, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

/**
 * Nonfinancial, signed-out production acceptance for the approved Gift Tax UI.
 * Do not replace this with source-only fixtures: the point is to test deployed
 * HTML, real pointer/keyboard interaction, viewport geometry and sample receipt.
 */
const target=process.env.TAXPAY_LIVE_URL;
if(!target)throw new Error('TAXPAY_LIVE_URL is required');
const base=new URL(target);
if(base.protocol!=='https:'||base.hostname!=='shihab-tech04.github.io'||
    !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Gift Tax browser acceptance must target actual Sohojkor Pages production');
}
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const sample of [
    {name:'desktop-en',width:1280,height:850,lang:'en'},
    {name:'mobile-375-bn',width:375,height:812,lang:'bn'},
    {name:'mobile-320-en',width:320,height:720,lang:'en'},
  ]){
    const bn=sample.lang==='bn';
    const mobile=sample.width<=650;
    const page=await browser.newPage({
      viewport:{width:sample.width,height:sample.height},isMobile:mobile,hasTouch:mobile,
    });
    let financialWrites=[];
    let watchWrites=false;
    page.on('request',request=>{
      if(!watchWrites||request.method()==='GET')return;
      try{
        const url=new URL(request.url());
        if(url.hostname.endsWith('.supabase.co')&&
            /payment|gift|challan|credit|ledger|receipt/i.test(url.pathname)) {
          financialWrites.push(request.method()+' '+url.pathname);
        }
      }catch{}
    });
    try{
      await page.emulateMedia({reducedMotion:'reduce'});
      // Prevent legacy CMS image downloads from affecting the geometry test.
      await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
        route=>route.abort('blockedbyclient'));
      const url=new URL(base);
      url.searchParams.set('action','landing');
      url.searchParams.set('lang',sample.lang);
      await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
      const hero=page.locator('.public-hero-carousel__slide[data-active="true"]');
      await hero.getByRole('button',{name:bn?'অন্যান্য কর':'Other Tax'}).click();
      const access=page.locator('.taxpay-modal[data-public-service="login"]');
      await expect(access).toBeVisible({timeout:20000});
      await access.getByRole('button',{name:bn?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
      await page.getByTestId('other-tax-chooser')
        .getByRole('button',{name:/Gift Tax|দানকর/}).click();
      const gift=page.getByRole('dialog',{name:bn?'দানকর':'Gift Tax'});
      await expect(gift.getByTestId('gift-tax-entry-form')).toBeVisible();
      await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
      await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute(
        'aria-label',bn?'পেমেন্টের অগ্রগতি':'Payment progress');
      const modalBox=await gift.boundingBox();
      if(!modalBox)throw new Error('Gift Tax production dialog has no bounds');
      if(mobile&&Math.abs(modalBox.width-sample.width)>2) {
        throw new Error('Mobile Gift Tax modal does not fill viewport: '+JSON.stringify(modalBox));
      }
      const donor=gift.getByTestId('gift-donor-section');
      const donee=gift.getByTestId('gift-donee-section');
      const donorInput=donor.locator('#gift-donor-tin');
      await expect(donorInput).toBeVisible();
      await donorInput.fill('111111111111');
      await donor.getByRole('button',{name:bn?/খুঁজুন:/:/Search Donor/}).click();
      await expect(gift.getByTestId('gift-donor-result')).toBeVisible();
      await donor.getByRole('button',{name:bn?'দাতা যোগ করুন':'Add Donor'}).click();
      await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('1');
      await donee.locator('#gift-donee-tin').fill('222222222222');
      await donee.getByRole('button',{name:bn?/খুঁজুন:/:/Search Donee/}).click();
      await expect(gift.getByTestId('gift-donee-result')).toBeVisible();
      const classification=donee.locator('#gift-donee-relationship');
      await classification.click();
      const popup=page.locator('[data-searchable-popup-id="gift-donee-relationship"]');
      await expect(popup).toBeVisible();
      const popBox=await popup.boundingBox();
      if(!popBox||popBox.x<0||popBox.y<0||
          popBox.x+popBox.width>sample.width+2||
          popBox.y+popBox.height>sample.height+2) {
        throw new Error('Viewport-portal relationship options clipped: '+JSON.stringify(popBox));
      }
      await page.getByRole('option',{name:bn?'বাবা':'Father'}).click();
      await donee.getByRole('button',{name:bn?'গ্রহীতা যোগ করুন':'Add Donee'}).click();
      await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('2');
      await expect(gift.getByTestId('gift-rail-donor')).toBeVisible();
      await expect(gift.getByTestId('gift-rail-donee')).toContainText(bn?'বাবা':'Father');
      await expect(donor.getByTestId('gift-confirmed-donor')).toBeVisible();
      await expect(donee.getByTestId('gift-confirmed-donee')).toBeVisible();
      // Guard against the previously observed gap between confirmed identities.
      const editor=gift.getByTestId('gift-tax-entry-form').locator('.gift-tax-main');
      await expect(editor).toHaveCSS('display','flex');
      const [donorBounds,doneeBounds]=await Promise.all([
        donor.boundingBox(),donee.boundingBox()
      ]);
      if(!donorBounds||!doneeBounds||
         doneeBounds.y-donorBounds.y-donorBounds.height>28) {
        throw new Error('Gift Tax donor/donee stretched apart in production: '+
          JSON.stringify({donorBounds,doneeBounds}));
      }
      const body=gift.locator('.taxpay-modal__body');
      const footer=gift.locator('.taxpay-modal__footer');
      const [bodyBox,footerBox]=await Promise.all([body.boundingBox(),footer.boundingBox()]);
      if(!bodyBox||!footerBox||bodyBox.y+bodyBox.height>footerBox.y+2) {
        throw new Error('Gift Tax footer obscures scrollable body');
      }
      const overflow=await body.evaluate(element=>element.scrollWidth-element.clientWidth);
      if(overflow>2)throw new Error('Horizontal overflow in selected Gift Tax state: '+overflow);
      await gift.screenshot({path:'test-results/live-gift-tax-identities-'+sample.name+'.png',
        animations:'disabled'});
      if(sample.name==='desktop-en'){
        await donor.getByRole('button',{name:'Edit Donor'}).click();
        await donor.locator('#gift-donor-tin').fill('333333333333');
        await expect(gift.getByTestId('gift-tax-selected-count')).toHaveText('2');
        await donor.getByRole('button',{name:'Cancel editing'}).click();
        await expect(donor.getByTestId('gift-confirmed-donor')).toBeVisible();
      }
      await gift.getByRole('button',{name:bn?'দান ও করের তথ্যে এগিয়ে যান':
        'Continue to Gift & Tax Information'}).click();
      const details=gift.getByTestId('gift-tax-details-form');
      await expect(details).toBeVisible();
      await details.locator('#gift-tax-amount').fill('2500000');
      await details.locator('#gift-tax-description').fill('Synthetic family gift');
      await details.locator('#gift-tax-remarks').fill('Gift Tax production UX acceptance only');
      await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় এগিয়ে যান':
        'Continue to Final Preview'}).click();
      await expect(details.locator('#gift-tax-date')).toBeFocused();
      await expect(details.locator('#gift-tax-date')).toHaveAttribute('aria-invalid','true');
      await expect(details.locator('#gift-tax-date-error')).toBeVisible();
      await details.locator('#gift-tax-date').fill('2025-01-15');
      await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় এগিয়ে যান':
        'Continue to Final Preview'}).click();
      const review=gift.getByTestId('gift-tax-review');
      await expect(review).toBeVisible();
      await expect(gift.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
      await expect(review.getByTestId('unified-v3-gift-payment-details')).toBeVisible();
      await expect(review.getByRole('heading',{name:bn?'পরিশোধকারী ও রসিদের তথ্য':'Payer and receipt details'})).toBeVisible();
      await expect(review.locator('#gift-tax-final-remarks')).toHaveValue('Gift Tax production UX acceptance only');
      await expect(review.locator('.gift-tax-approved-table')).not.toContainText('111111111111');
      await expect(review.locator('.unified-taxpayer-workspace__rail')).toHaveCount(0);
      await review.locator('#gift-review-payer-name').fill('Sample Payer');
      await review.locator('#gift-review-phone').fill('01712345678');
      await review.locator('#gift-review-email').fill('sample@example.com');
      await review.locator('#gift-review-reference').fill('GIFT-UX-ACCEPTANCE');
      const previewOverflow=await body.evaluate(element=>element.scrollWidth-element.clientWidth);
      if(previewOverflow>2)throw new Error('Final review horizontal overflow: '+previewOverflow);
      await gift.screenshot({path:'test-results/live-gift-tax-preview-'+sample.name+'.png',
        animations:'disabled'});
      await gift.getByRole('button',{name:bn?'পেমেন্ট করুন':'Make Payment'}).click();
      await expect(gift.getByTestId('gift-tax-checkout')).toBeVisible();
      await gift.getByRole('button',{name:bn?'অনলাইনে পরিশোধ':'Pay online'}).click();
      await gift.getByRole('button',{name:bn?'মোবাইল ব্যাংকিং':'Mobile banking'}).click();
      await gift.getByRole('radio',{name:'bKash'}).check();
      await gift.locator('.payment-review__ack input[type=checkbox]').check();
      watchWrites=true;
      await gift.getByRole('button',{name:bn?'নমুনা পেমেন্ট নিশ্চিত করুন':'Confirm sample payment'}).click();
      watchWrites=false;
      const result=gift.getByTestId('gift-tax-payment-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText(bn?'পেমেন্ট রেকর্ড সংরক্ষিত':'Payment record saved');
      await expect(gift.getByTestId('gift-tax-settled-documents')).toHaveCount(0);
      if(financialWrites.length)throw new Error('Sample Gift Tax submitted financial API writes: '+
        financialWrites.join(', '));
      await gift.getByRole('button',{name:bn?'নমুনা চালানের বিবরণ':'Sample Challan Details'}).click();
      const receipt=gift.getByTestId('gift-tax-simulation-receipt');
      await expect(receipt).toBeVisible();
      await expect(receipt).toContainText('SIM-GIFT-');
      await expect(receipt).toContainText('Gift Tax production UX acceptance only');
      await expect(receipt).toContainText(bn?'শুধু সিমুলেশন':'SIMULATION ONLY');
      await gift.screenshot({path:'test-results/live-gift-tax-receipt-'+sample.name+'.png',
        animations:'disabled'});
      await gift.getByRole('button',{name:bn?'পেমেন্টের ফলে ফিরুন':
        'Back to payment result'}).click();
      await gift.getByRole('button',{name:bn?'চূড়ান্ত পর্যালোচনায় ফিরুন':
        'Back to Final Preview'}).click();
      await expect(review).toBeVisible();
      await expect(review.locator('#gift-review-payer-name')).toHaveValue('Sample Payer');
      await expect(review.locator('#gift-review-phone')).toHaveValue('01712345678');
      console.log('PASS: deployed Gift Tax '+sample.name+
        ' entry, roles, selector bounds, recovery, validation, preview, simulated method and marked receipt');
    }catch(error){
      await page.screenshot({path:'test-results/live-gift-tax-failure-'+sample.name+'.png',
        animations:'disabled'}).catch(()=>{});
      throw error;
    }finally{
      await page.close();
    }
  }
}finally{
  await browser.close();
}
console.log('PASS: complete nonfinancial Gift Tax production UX at desktop 1280, mobile 375 Bengali and mobile 320 English');
