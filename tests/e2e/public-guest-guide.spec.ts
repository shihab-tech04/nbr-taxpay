import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public hero offers two working guest modals and Login stays in the header',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Full guest modal journey in desktop suite');
 const hosted:string[]=[];
 page.on('request',r=>{if(new URL(r.url()).hostname.endsWith('.supabase.co'))hosted.push(r.url());});
 await page.goto('/?action=landing');
 const header=page.locator('.public-home-header');
 await expect(header.getByRole('link',{name:'Login'})).toHaveAttribute('href','https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions');
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
 await page.getByRole('button',{name:'Check payment status & receipt'}).click();
 const status=page.getByRole('dialog',{name:'Payment status & receipt'});
 await expect(status).toBeVisible();
 await expect(status.locator('.public-service-dialog__notice')).toHaveCount(0);
 await status.getByPlaceholder('Enter a reference').fill('NO-SUCH-DEMO-REFERENCE-12345');
 await status.getByRole('button',{name:'Search records'}).click();
 await expect(status.getByText('No matching record')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(status).toHaveCount(0);
 await page.getByRole('button',{name:'Pay travel tax'}).click();
 const travel=page.getByRole('dialog',{name:'Travel tax'});
 await expect(travel.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
 await expect(travel.locator('.public-service-dialog__notice')).toHaveCount(0);
 await expect(travel.getByText('Rates and exemptions are not verified.',{exact:false})).toBeVisible();
 await expect(travel.getByRole('heading',{name:'Payment summary'})).toBeVisible();
 await travel.getByRole('button',{name:'Continue to passenger details'}).click();
 await travel.getByLabel('Passenger name (as in passport)').fill('TEST PASSENGER');
 await travel.getByLabel('Passport number (synthetic data only)').fill('DEMO1234');
 await travel.getByRole('button',{name:'Continue to review'}).click();
 await expect(travel.getByRole('heading',{name:'Review travel details'})).toBeVisible();
 await travel.getByRole('button',{name:'Run payment simulation'}).click();
 await expect(travel.getByRole('heading',{name:'Travel tax preview ready.'})).toBeVisible();
 await expect(travel.getByText('Not valid for travel or proof of payment.',{exact:false})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(travel).toHaveCount(0);
 expect(hosted).toEqual([]);
});

test('see-more links open topic guide with responsive search, FAQs and languages',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Guide journey on mobile');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'See more'}).first().click();
 await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Payment basics'})).toHaveAttribute('aria-current','true');
 await page.getByRole('button',{name:'Travel tax'}).click();
 await expect(page.getByRole('heading',{name:'Travel tax'})).toBeVisible();
 await page.getByRole('button',{name:'Mobile'}).click();
 await expect(page.getByRole('button',{name:'Mobile'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox',{name:'Search questions'}).fill('rates');
 await expect(page.getByText('Are the rates final?')).toBeVisible();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('heading',{name:'TaxPay ব্যবহার নির্দেশিকা'})).toBeVisible();
 await expect(page.getByRole('button',{name:'মোবাইল'})).toHaveAttribute('aria-pressed','true');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('floating help uses guide answers and report form never sends an official ticket',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','One assistant and report E2E journey');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Chat support'}).click();
 await expect(page.getByRole('heading',{name:'TaxPay help'})).toBeVisible();
 await page.getByRole('button',{name:'Payment status',exact:true}).click();
 await expect(page.locator('.public-help-message--assistant')).toContainText('verified reconciliation');
 await page.getByRole('link',{name:'Open user guide'}).click();
 await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Report'}).click();
 await expect(page.getByRole('heading',{name:'Report a problem'})).toBeVisible();
 await expect(page.getByText('No report is sent and no official ticket is created.',{exact:false})).toBeVisible();
 await page.getByLabel('Short description').fill('Example payment record mismatch, using fake data.');
 await page.getByRole('button',{name:'Review demo form'}).click();
 await expect(page.getByRole('heading',{name:'Preview complete'})).toBeVisible();
 await expect(page.getByText('Nothing was submitted.',{exact:false})).toBeVisible();
});
test('public guide and guest launcher pass WCAG automated A/AA',async({page},info)=>{
 test.skip(info.project.name==='desktop-1280','Mobile a11y suite');
 await page.goto('/?action=user_guide');
 const results=await new AxeBuilder({page}).include('.public-guide-page').include('.public-home-header').include('.public-footer').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(results.violations).toEqual([]);
});


test('guest receipt lookup keeps a compact accessible layout and honest demo results',async({page})=>{
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Check payment status & receipt'}).click();
 const dialog=page.getByRole('dialog',{name:'Payment status & receipt'});
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('.receipt-lookup--embedded')).toHaveCount(1);
 await expect(dialog.locator('.receipt-lookup__page-header')).toHaveCount(0);
 await expect(dialog.getByLabel('Challan, token or transaction reference')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Search records'})).toBeDisabled();
 const dialogBox=await dialog.boundingBox();
 expect(dialogBox).not.toBeNull();
 expect(dialogBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
 const samples=dialog.locator('.receipt-lookup__sample');
 await expect(samples).toHaveCount(3);
 await samples.first().click();
 await expect(dialog.getByRole('heading',{name:'Receipt details'})).toBeVisible();
 await expect(dialog.getByText('Sample record · Not an official challan')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Back to records'})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Print preview'})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Download JSON'})).toBeVisible();
 await expect(dialog.locator('.receipt-view__paper')).toBeVisible();
 await expect(dialog.locator('.receipt-view__table')).toBeHidden();
 await expect(dialog.locator('.receipt-view__cards')).toBeVisible();
 const cardWidth=await dialog.locator('.receipt-view__paper').evaluate(el=>el.getBoundingClientRect().width);
 expect(cardWidth).toBeLessThanOrEqual(dialogBox!.width);
 await expect(dialog.locator('.receipt-lookup__result--found')).toHaveCount(0);
 await expect(dialog.getByText('Sample record · Not an official challan')).toHaveCount(1);
 await dialog.getByPlaceholder('Enter a reference').fill('NO-SUCH-DEMO-REFERENCE-12345');
 await expect(dialog.locator('.receipt-view--embedded')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Search records'}).click();
 await expect(dialog.getByRole('heading',{name:'No matching record'})).toBeVisible();
 await expect(dialog.getByText('If money was debited, contact your bank or payment provider.')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
});

test('guest receipt modal localizes labels and remains keyboard accessible',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Bilingual guest modal at smallest viewport');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'বাংলা'}).click();
 await page.getByRole('button',{name:'পেমেন্টের অবস্থা ও রসিদ দেখুন'}).click();
 const dialog=page.getByRole('dialog',{name:'পেমেন্টের অবস্থা ও রসিদ'});
 await expect(dialog.getByLabel('চালান, টোকেন বা লেনদেনের রেফারেন্স')).toBeVisible();
 await expect(dialog.getByPlaceholder('রেফারেন্স লিখুন')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'রেকর্ড খুঁজুন'})).toBeDisabled();
 await dialog.locator('.receipt-lookup__sample').first().click();
 await expect(dialog.getByText('নমুনা রেকর্ড · সরকারি চালান নয়')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'রেকর্ডে ফিরুন'})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'প্রিন্ট প্রিভিউ'})).toBeVisible();
 await expect(dialog.locator('.receipt-view__paper')).toBeVisible();
 const dimensions=await dialog.locator('.receipt-view__paper').evaluate(el=>({paper:el.getBoundingClientRect().width,viewport:window.innerWidth}));
 expect(dimensions.paper).toBeLessThanOrEqual(dimensions.viewport);
 const a11y=await new AxeBuilder({page}).include('.public-service-dialog[data-public-service="status"]').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(a11y.violations).toEqual([]);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
});

test('shared modal uses left title, close icon, header divider, content and fixed footer',async({page})=>{
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Check payment status & receipt'}).click();
  const modal=page.getByRole('dialog',{name:'Payment status & receipt'});
  const header=modal.locator('.taxpay-modal__header');
  const body=modal.locator('.taxpay-modal__body');
  const footer=modal.locator('.taxpay-modal__footer');
  const title=header.getByRole('heading',{name:'Payment status & receipt',level:2});
  const closeIcon=header.getByRole('button',{name:'Close modal'});
  const footerClose=footer.getByRole('button',{name:'Close',exact:true});

  await expect(title).toBeVisible();
  await expect(closeIcon).toBeVisible();
  await expect(header).toHaveCSS('border-bottom-style','solid');
  await expect(footer).toHaveCSS('border-top-style','solid');
  await expect(body.getByLabel('Challan, token or transaction reference')).toBeVisible();
  await expect(footerClose).toBeVisible();
  const positions=await modal.evaluate(el=>{
    const h=el.querySelector('.taxpay-modal__header')!.getBoundingClientRect();
    const f=el.querySelector('.taxpay-modal__footer')!.getBoundingClientRect();
    const body=el.querySelector('.taxpay-modal__body')!.getBoundingClientRect();
    const title=el.querySelector('.taxpay-modal__title')!.getBoundingClientRect();
    const close=el.querySelector('.taxpay-modal__close')!.getBoundingClientRect();
    return {titleLeft:title.left,closeLeft:close.left,headerBottom:h.bottom,bodyTop:body.top,bodyBottom:body.bottom,footerTop:f.top};
  });
  expect(positions.titleLeft).toBeLessThan(positions.closeLeft);
  expect(positions.headerBottom).toBeLessThanOrEqual(positions.bodyTop+1);
  expect(positions.bodyBottom).toBeLessThanOrEqual(positions.footerTop+1);
  await modal.locator('.receipt-lookup__sample').first().click();
  await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(header).toBeVisible();
  await expect(footerClose).toBeVisible();
  await footerClose.click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Check payment status & receipt'})).toBeFocused();
});

test('travel tax uses same modal header/body/footer without changing its flow',async({page})=>{
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay travel tax'}).click();
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await expect(modal.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
  await expect(modal.locator('.taxpay-modal__header')).toHaveCSS('border-bottom-style','solid');
  await expect(modal.locator('.taxpay-modal__footer')).toHaveCSS('border-top-style','solid');
  await expect(modal.getByRole('navigation',{name:'Travel tax steps'})).toBeVisible();
  await expect(modal.getByRole('heading',{name:'Payment summary'})).toBeVisible();
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await expect(modal.getByLabel('Passenger name (as in passport)')).toBeVisible();
  await expect(modal.locator('.taxpay-modal__footer').getByRole('button',{name:'Close',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});


test('travel tax desktop stepper scrolls left while payment summary stays anchored right',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Desktop split-view geometry');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Pay travel tax'}).click();
 const modal=page.getByRole('dialog',{name:'Travel tax'});
 const left=modal.locator('.travel-flow__main');
 const side=modal.locator('.travel-flow__summary');
 await expect(modal.locator('.public-service-dialog__notice')).toHaveCount(0);
 await expect(modal.getByRole('navigation',{name:'Travel tax steps'})).toBeVisible();
 await expect(side.getByRole('heading',{name:'Payment summary'})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
 const position=await modal.evaluate(el=>{
   const rect=(name:string)=>el.querySelector(name)!.getBoundingClientRect();
   const a=rect('.travel-flow__main'),b=rect('.travel-flow__summary');
   return {leftRight:a.right,asideLeft:b.left,leftHeight:a.height,asideHeight:b.height,asideTop:b.top};
 });
 expect(position.leftRight).toBeLessThanOrEqual(position.asideLeft+1);
 expect(position.leftHeight).toBeGreaterThan(100);
 expect(position.asideHeight).toBeGreaterThan(100);
 await left.evaluate(el=>el.scrollTop=el.scrollHeight);
 const positionAfter=await side.evaluate(el=>el.getBoundingClientRect().top);
 expect(Math.abs(positionAfter-position.asideTop)).toBeLessThan(2);
 await expect(modal.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
 await modal.getByRole('button',{name:'Continue to passenger details'}).click();
 await expect(modal.getByRole('heading',{name:'Passenger information'})).toBeVisible();
 await modal.getByRole('button',{name:'Continue to review'}).click();
 await expect(modal.getByRole('alert')).toContainText('Enter the passenger name shown on the passport.');
 await modal.getByLabel('Passenger name (as in passport)').fill('SYNTHETIC USER');
 await modal.getByLabel('Passport number (synthetic data only)').fill('FAKE0001');
 await modal.getByRole('button',{name:'Continue to review'}).click();
 await expect(modal.getByRole('heading',{name:'Review travel details'})).toBeVisible();
 await expect(modal.getByText('Preview ready',{exact:true})).toHaveCount(0);
 await expect(side.getByText('Illustrative total')).toBeVisible();
 await expect(modal.getByRole('button',{name:'Run payment simulation'})).toBeVisible();
 await modal.getByRole('button',{name:'Run payment simulation'}).click();
 await expect(modal.getByRole('heading',{name:'Travel tax preview ready.'})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Print preview'})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Download JSON'})).toBeVisible();
 await expect(side.getByText('No payment processed')).toBeVisible();
});

test('travel tax mobile keeps a compact anchored estimate and Bengali step navigation',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Smallest viewport EN/BN stepper');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'বাংলা'}).click();
 await page.getByRole('button',{name:'ভ্রমণ কর পরিশোধ'}).click();
 const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 await expect(modal.getByRole('navigation',{name:'ভ্রমণ করের ধাপ'})).toBeVisible();
 await expect(modal.getByRole('button',{name:'যাত্রীর তথ্য দিন'})).toBeVisible();
 await expect(modal.locator('.public-service-dialog__notice')).toHaveCount(0);
 await modal.getByRole('button',{name:'যাত্রীর তথ্য দিন'}).click();
 await expect(modal.getByLabel('পাসপোর্ট অনুযায়ী যাত্রীর নাম')).toBeVisible();
 await modal.getByLabel('পাসপোর্ট অনুযায়ী যাত্রীর নাম').fill('DEMO NAME');
 await modal.getByLabel('পাসপোর্ট নম্বর (শুধু কৃত্রিম তথ্য)').fill('FAKE001');
 await modal.getByRole('button',{name:'পর্যালোচনায় যান'}).click();
 await expect(modal.getByRole('heading',{name:'তথ্য পর্যালোচনা'})).toBeVisible();
 const width=await modal.evaluate(el=>({viewport:innerWidth,paper:el.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth}));
 expect(width.paper).toBeLessThanOrEqual(width.viewport);
 expect(width.scroll).toBeLessThanOrEqual(width.viewport+2);
 await expect(modal.locator('.travel-flow__summary')).toBeVisible();
});


test('Travel Tax primary action lives in fixed modal footer across all steps',async({page})=>{
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Pay travel tax'}).click();
 const modal=page.getByRole('dialog',{name:'Travel tax'});
 const footer=modal.locator('.taxpay-modal__footer');
 const actions=footer.locator('.taxpay-modal__footer-actions');
 const summary=modal.locator('.travel-flow__summary');
 const left=modal.locator('.travel-flow__main');
 await expect(footer.getByRole('button',{name:'Close',exact:true})).toBeVisible();
 await expect(actions.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
 await expect(summary.locator('button')).toHaveCount(0);
 const positions=async()=>modal.evaluate(el=>{
   const rect=(selector:string)=>el.querySelector(selector)!.getBoundingClientRect();
   const f=rect('.taxpay-modal__footer'),c=rect('.taxpay-modal__footer-close'),
     a=rect('.taxpay-modal__footer-actions .travel-flow__primary'),
     s=rect('.travel-flow__summary');
   return {footerTop:f.top,footerBottom:f.bottom,closeLeft:c.left,actionLeft:a.left,
      actionTop:a.top,actionBottom:a.bottom,summaryBottom:s.bottom,
      actionRight:a.right,viewport:window.innerWidth};
 });
 let p=await positions();
 expect(p.closeLeft).toBeLessThan(p.actionLeft);
 expect(p.actionTop).toBeGreaterThanOrEqual(p.footerTop-1);
 expect(p.actionBottom).toBeLessThanOrEqual(p.footerBottom+1);
 expect(p.actionRight).toBeLessThanOrEqual(p.viewport+1);
 await left.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await expect(actions.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
 await actions.getByRole('button',{name:'Continue to passenger details'}).click();
 await expect(actions.getByRole('button',{name:'Continue to review'})).toBeVisible();
 await modal.getByLabel('Passenger name (as in passport)').fill('SYNTHETIC PASSENGER');
 await modal.getByLabel('Passport number (synthetic data only)').fill('DEMOFAKE01');
 await actions.getByRole('button',{name:'Continue to review'}).click();
 await expect(modal.getByRole('heading',{name:'Review travel details'})).toBeVisible();
 await expect(actions.getByRole('button',{name:'Run payment simulation'})).toBeVisible();
 await actions.getByRole('button',{name:'Run payment simulation'}).click();
 await expect(modal.getByRole('heading',{name:'Travel tax preview ready.'})).toBeVisible();
 await expect(actions.getByRole('button',{name:'Start a new preview'})).toBeVisible();
 await expect(summary.locator('button')).toHaveCount(0);
 p=await positions();
 expect(p.actionBottom).toBeLessThanOrEqual(p.footerBottom+1);
 await actions.getByRole('button',{name:'Start a new preview'}).click();
 await expect(actions.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
});


test('Travel Tax route search filters English and Bangla and preserves selected payment amount',async({page})=>{
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Pay travel tax'}).click();
 const modal=page.getByRole('dialog',{name:'Travel tax'});
 const search=modal.getByRole('searchbox',{name:'Search destination or travel mode'});
 const routes=modal.locator('#travel-tax-route-results');
 const summary=modal.locator('.travel-flow__summary');
 await expect(search).toBeVisible();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(5);
 await search.fill('saARc');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('Air - SAARC Member Countries',{exact:false})).toBeVisible();
 await routes.locator('input[type="radio"]').check();
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await search.fill('জাপান');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('Air - North America',{exact:false})).toBeVisible();
 // Filtering does not silently replace the selected rate.
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await search.fill('somewhere-invalid-999');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(0);
 await expect(routes.getByRole('status')).toContainText('No matching routes');
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await routes.getByRole('button',{name:'Show all routes'}).click();
 await expect(search).toHaveValue('');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(5);
 await expect(routes.locator('#travel-tax-route-1')).toBeChecked();
 await search.fill('land');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(2); // New Zealand and Land checkpoints both match.
 await search.fill('Border Checkposts');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await modal.getByRole('button',{name:'Clear route search'}).click();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(5);
 await expect(search).toHaveValue('');
 await modal.getByRole('button',{name:'Continue to passenger details'}).click();
 await expect(modal.getByRole('heading',{name:'Passenger information'})).toBeVisible();
});

test('Travel Tax Bangla route search is accessible and fits mobile viewport',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Small mobile search and Bangla names');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'বাংলা'}).click();
 await page.getByRole('button',{name:'ভ্রমণ কর পরিশোধ'}).click();
 const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 const search=modal.getByRole('searchbox',{name:'গন্তব্য বা যাতায়াতের ধরন খুঁজুন'});
 const routes=modal.locator('#travel-tax-route-results');
 await search.fill('বেনাপোল');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('স্থলপথ',{exact:false})).toBeVisible();
 const sizes=await search.evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {left:box.left,right:box.right,width:window.innerWidth,scroll:document.documentElement.scrollWidth};
 });
 expect(sizes.left).toBeGreaterThanOrEqual(-1);
 expect(sizes.right).toBeLessThanOrEqual(sizes.width+1);
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+2);
 await modal.getByRole('button',{name:'অনুসন্ধান মুছুন'}).click();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(5);
});
