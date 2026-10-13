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
 await expect(status.getByText('No government payment or verified receipt is issued.',{exact:false})).toBeVisible();
 await status.getByPlaceholder('Enter a reference').fill('NO-SUCH-DEMO-REFERENCE-12345');
 await status.getByRole('button',{name:'Search records'}).click();
 await expect(status.getByText('No matching record')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(status).toHaveCount(0);
 await page.getByRole('button',{name:'Pay travel tax'}).click();
 const travel=page.getByRole('dialog',{name:'Travel tax'});
 await expect(travel.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
 await expect(travel.getByText('Rates and exemptions are not verified.',{exact:false})).toBeVisible();
 await travel.getByLabel('Passenger name (as in passport)').fill('TEST PASSENGER');
 await travel.getByLabel('Passport number (synthetic data only)').fill('DEMO1234');
 await travel.getByRole('button',{name:'Run payment simulation'}).click();
 await expect(travel.getByText('Travel tax preview ready.')).toBeVisible();
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
 await expect(dialog.getByRole('heading',{name:'Sample receipt found'})).toBeVisible();
 await expect(dialog.getByText('not verified',{exact:false}).first()).toBeVisible();
 await dialog.getByPlaceholder('Enter a reference').fill('NO-SUCH-DEMO-REFERENCE-12345');
 await expect(dialog.getByRole('heading',{name:'Sample receipt found'})).toHaveCount(0);
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
 const a11y=await new AxeBuilder({page}).include('.public-service-dialog[data-public-service="status"]').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(a11y.violations).toEqual([]);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
});
