import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const target = process.env.TAXPAY_LIVE_URL;
if (!target) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(target);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' ||
    !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Travel Tax acceptance must use the actual production GitHub Pages URL');
}
const cases = [
  {name:'desktop-en',viewport:{width:1280,height:800},mobile:false,bn:false},
  {name:'phone-375-en',viewport:{width:375,height:812},mobile:true,bn:false},
  {name:'phone-320-bn',viewport:{width:320,height:700},mobile:true,bn:true},
];
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for (const c of cases) {
    const page=await browser.newPage({viewport:c.viewport,isMobile:c.mobile,hasTouch:c.mobile});
    // Avoid any unrelated external CMS image bytes without substituting payment behavior.
    await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
      route=>route.abort('blockedbyclient'));
    const url=new URL(base);
    url.searchParams.set('action','landing');
    if (c.bn) url.searchParams.set('lang','bn');
    await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
    const hero=page.locator('.public-hero-carousel');
    await expect(hero).toBeVisible({timeout:30000});
    await hero.getByRole('button',{name:c.bn?/Pay Travel Tax|ভ্রমণ কর/: 'Pay Travel Tax'}).click();
    const modal=page.getByRole('dialog',{name:c.bn?'ভ্রমণ কর':'Travel tax'});
    await expect(modal).toBeVisible();
    const title=modal.locator('.taxpay-modal__title');
    await expect(title).toHaveText(c.bn?'যাত্রীর তথ্য':'Passenger Information');
    await expect(modal.locator('.taxpay-modal__subtitle'))
      .toHaveText(c.bn?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment');
    const progress=modal.locator('.taxpay-modal__progress');
    await expect(progress).toHaveAttribute('aria-valuemax','3');
    await expect(progress).toHaveAttribute('aria-valuenow','1');
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await expect(modal.locator('.travel-flow__summary')).toBeHidden();
    if (!c.mobile) {
      const expectedWidth=Math.min(1160,c.viewport.width-32);
      await expect.poll(async()=>Math.abs((await modal.boundingBox())?.width-expectedWidth),
        {timeout:7000}).toBeLessThanOrEqual(2);
    }

    const first=modal.locator('.travel-passenger-workspace__entry[data-passenger-id="first"]');
    await expect(first).toBeVisible();
    const medical=first.locator('#travel-medical-first');
    await expect(medical).not.toBeChecked();
    const pendingMedical=first.locator('.travel-passenger-workspace__medical');
    await expect(pendingMedical).toBeVisible();
    const [medicalBox,entryBox]=await Promise.all([pendingMedical.boundingBox(),first.boundingBox()]);
    if (!medicalBox || !entryBox || medicalBox.width<entryBox.width*.8) {
      throw new Error('Manual assessment must belong to the passenger identity area');
    }
    const add=first.getByRole('button',{name:c.bn?'যাত্রী যোগ করুন':'Add passenger',exact:true});
    const next=modal.getByRole('button',{name:c.bn?'ভ্রমণের তথ্য দিতে এগিয়ে যান':'Continue to travel details'});
    await expect(add).toHaveCount(0);
    await expect(next).toBeDisabled();
    await expect(first.locator('#travel-lookup-first')).toBeDisabled();
    await first.locator('#travel-passport-first').focus();
    const suggestions=first.locator('#travel-passport-suggestions-first');
    await expect(suggestions.getByRole('option')).toHaveCount(10);
    const scroll=await suggestions.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
    if(scroll.scroll<=scroll.height)throw new Error('Ten passport suggestions must have independent scrolling');
    await suggestions.getByRole('option').filter({hasText:'TEST230005'}).click();
    await expect(first.locator('#travel-lookup-first')).toBeEnabled();
    await first.locator('#travel-lookup-first').click();
    await expect(first.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
    await expect(first.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
    await expect(add).toBeEnabled();

    // Medical review is inside the checked identity card, never outside it.
    const checkedCard=first.locator('.travel-flow__identity-card');
    await expect(checkedCard).toBeVisible();
    await expect(checkedCard.locator('#travel-medical-first')).toHaveCount(1);
    await medical.check();
    await expect(add).toBeDisabled();
    await expect(next).toBeDisabled();
    await medical.uncheck();
    await expect(add).toBeEnabled();

    // A changed passport revokes the previous lookup; reconfirm the new identity.
    await first.locator('#travel-passport-first').fill('TEST230001');
    await expect(add).toHaveCount(0);
    await expect(first.getByTestId('travel-passenger-name-first')).toHaveCount(0);
    await first.locator('#travel-lookup-first').click();
    await expect(first.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
    await expect(first.getByTestId('travel-passenger-birth-first')).toHaveText('1988-11-10');
    await add.click();
    await expect(first).toHaveCount(0);
    await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
    await expect(modal.locator('.travel-passenger-workspace__person')).toContainText('SAMPLE PASSENGER TWO');
    await expect(modal.locator('#travel-new-passport')).toBeVisible();
    await expect(next).toBeEnabled();
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    await expect(modal.getByText('This is a fictional passport for UX testing, not a government lookup.')).toHaveCount(0);
    await expect(modal.getByText(/All tax rates and age bands are illustrative app-preview values/)).toHaveCount(0);

    // Duplicate prevention, then remove only the unfinished second entry.
    await modal.getByRole('button',{name:c.bn?'বাংলাদেশি':'Bangladeshi',exact:true}).click();
    const second=modal.locator('.travel-passenger-workspace__entry');
    await expect(second).toBeVisible();
    await second.locator('input[role="combobox"]').fill('TEST230001');
    await expect(second.getByText(c.bn?'পাসপোর্ট ইতিমধ্যে যোগ করা হয়েছে।':'Passport already added.',{exact:true})).toBeVisible();
    await expect(next).toBeDisabled();
    await second.locator('.travel-passenger-workspace__remove-editor').click();
    await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
    await expect(next).toBeEnabled();
    await next.click();

    await expect(title).toHaveText(c.bn?'ভ্রমণের তথ্য':'Travel Details');
    await expect(progress).toHaveAttribute('aria-valuenow','2');
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    const modes=modal.locator('#travel-tax-route-results');
    await expect(modes.locator('input[type=radio]')).toHaveCount(2);
    await expect(modes.locator('#travel-tax-route-0')).toBeChecked();
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    const future=new Date(Date.now()+2*86400000);
    const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Dhaka'}).format(future);
    await modal.locator('#travel-departure-date').fill(date);
    await modal.getByRole('button',{name:c.bn?'পেমেন্ট পর্যালোচনায় যান':'Continue to review'}).click();
    await expect(title).toHaveText(c.bn?'চূড়ান্ত পর্যালোচনা':'Final Preview');
    await expect(progress).toHaveAttribute('aria-valuenow','3');
    const contact=modal.getByTestId('travel-preview-receipt-contact');
    await expect(contact).toBeVisible();
    const receiptMobile=contact.locator('#travel-mobile');
    await expect(receiptMobile).toHaveValue('');
    await receiptMobile.fill('017');
    await expect(receiptMobile).toHaveAttribute('aria-invalid','true');
    await receiptMobile.fill('01712345678');
    await expect(receiptMobile).not.toHaveAttribute('aria-invalid','true');
    await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
    await expect(modal.locator('.travel-flow__primary')).toContainText(c.bn?'পেমেন্ট করুন':'Make Payment');
    await modal.locator('.travel-flow__primary').click();
    await expect(title).toHaveText(c.bn?'পেমেন্ট চ্যানেল':'Payment channel');
    await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
    // Do not submit/settle any payment: live acceptance is read-only.
    const back=modal.locator('.taxpay-modal__header .taxpay-modal__back');
    await back.click();
    await expect(title).toHaveText(c.bn?'চূড়ান্ত পর্যালোচনা':'Final Preview');
    await expect(receiptMobile).toHaveValue('01712345678');
    if (c.mobile) {
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      if(overflow>2)throw new Error('Live Travel Tax horizontal page overflow '+overflow+'px');
    }
    await page.screenshot({path:'test-results/live-travel-passport-'+c.name+'.png',fullPage:false});
    await page.close();
    console.log('PASS: published Travel Tax '+c.name+' three stages, sample lookup, medical card, duplicate guard, receipt preview and checkout back');
  }
} finally {
  await browser.close();
}
