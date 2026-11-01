import { mockPublishedBannerCms } from './mock-published-banners';
import { setWorkspaceLanguage } from './workspace-language';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';

test('public hero opens receipt lookup and its Travel Tax banner starts the journey',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Full guest modal journey in desktop suite');
 const hosted:string[]=[];
 page.on('request',r=>{if(new URL(r.url()).hostname.endsWith('.supabase.co'))hosted.push(r.url());});
 await page.goto('/?action=landing');
 const header=page.locator('.public-home-header');
 await expect(header.getByRole('link',{name:'Login'})).toHaveAttribute('href','?action=taxpayer_login');
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
 const homeSearch=page.getByRole('searchbox',{name:'Search payment records by reference'});
 await expect(homeSearch).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Payment status & receipt'})).toHaveCount(0);
 await homeSearch.fill('NO-SUCH-DEMO-REFERENCE-12345');
 await page.locator('.public-record-search').getByRole('button',{name:'Search records'}).click();
 await expect(page).toHaveURL(/action=verify/);
 await expect(page.getByRole('heading',{name:'No matching record'})).toBeVisible();
 await page.goto('/?action=landing');
 await openTravelTaxFromBanner(page);
 const travel=page.getByRole('dialog',{name:'Travel tax'});
 await expect(travel.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
 await expect(travel.locator('.public-service-dialog__notice')).toHaveCount(0);
 await expect(travel.getByText('Rates and exemptions are not verified.',{exact:false})).toHaveCount(0);
 await expect(travel.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
 await travel.locator('#travel-tax-route-0').check();
 await travel.getByRole('button',{name:'Continue to passenger details'}).click();
 await travel.getByLabel('Passenger name').fill('TEST PASSENGER');
 await travel.getByLabel('Passport number').fill('DEMO1234');
 await travel.getByLabel('Mobile number for receipt').fill('01712345678');
 await travel.getByLabel('Travel date').fill('2026-10-25');
 await travel.getByRole('button',{name:'Continue to review'}).click();
 await expect(travel.getByRole('heading',{name:'Review travel details'})).toBeVisible();
  await travel.getByRole('button',{name:'Pay online'}).click();
  await travel.getByRole('button',{name:'Mobile banking'}).click();
 await travel.getByRole('radio',{name:'bKash'}).check();
 await travel.locator('.travel-flow__channel-option input[type="checkbox"]').check();
 await travel.getByRole('button',{name:'Continue payment'}).click();
 await expect(travel.getByRole('heading',{name:'Receipt details'})).toBeVisible();
 await expect(travel.getByText('Not valid for travel or proof of payment.',{exact:false})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(travel).toHaveCount(0);
 expect(hosted).toEqual([]);
});

test('user guide supports responsive search, FAQs and languages',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Guide journey on mobile');
 await page.goto('/?action=user_guide');
 await expect(page.getByRole('heading',{name:'Korbritto user guide'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Payment basics'})).toHaveAttribute('aria-current','true');
 await expect(page.locator('.public-guide-topics')).toHaveCSS('display', 'grid');
 await page.getByRole('button',{name:'Travel tax'}).click();
 await expect(page.getByRole('heading',{name:'Travel tax'})).toBeVisible();
 await page.getByRole('button',{name:'Mobile'}).click();
 await expect(page.getByRole('button',{name:'Mobile'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox',{name:'Search the guide'}).fill('rates');
 await expect(page.getByText('Are the rates final?')).toBeVisible();
 await setWorkspaceLanguage(page,'bn');
 await expect(page.getByRole('heading',{name:'করবৃত্ত ব্যবহার নির্দেশিকা'})).toBeVisible();
 await page.getByRole('button',{name:'মুছুন'}).click();
 await expect(page.getByRole('button',{name:'মোবাইল'})).toHaveAttribute('aria-pressed','true');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('Help Center typography and interactions remain usable at each viewport', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide = page.locator('.public-guide-page');
  await expect(guide.getByRole('heading', { name: 'Korbritto user guide' })).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Back to home' })).toHaveCount(0);
  const homeLink = page.locator('.public-home-nav a').filter({ hasText: 'Home' });
  await expect(homeLink).toHaveCount(1);
  await expect(homeLink).toHaveAttribute('href', /\/$/);

  const fontSizes = await guide.evaluate(element => {
    const selectors = [
      '.public-guide-topics button',
      '.public-guide-steps li p',
      '.public-guide-search input',
      '.public-guide-questions summary',
    ];
    return selectors.map(selector => Number.parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize));
  });
  expect(fontSizes.every(size => size >= 16), `Small UI text: ${fontSizes.join(', ')}`).toBe(true);

  await guide.getByRole('button', { name: 'Travel tax' }).click();
  await expect(guide.getByRole('heading', { name: 'Travel tax' })).toBeVisible();
  await guide.getByRole('searchbox', { name: 'Search the guide' }).fill('rates');
  await expect(guide.getByText('Are the rates final?')).toBeVisible();
  await guide.getByText('Are the rates final?').click();
  await expect(guide.getByText('Rates and exemptions must be checked', { exact: false })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('User guide search and text weights follow the citizen typography contract', async ({ page }, info) => {
  await page.goto('/?action=user_guide');
  const guide = page.locator('.public-guide-page');
  const typography = await guide.evaluate(element => {
    const style = (selector: string) => getComputedStyle(element.querySelector(selector)!);
    return {
      fontFamily: style('.public-guide-content').fontFamily,
      title: style('.public-guide-intro h1').fontWeight,
      topic: style('.public-guide-topics button:not([aria-current="true"])').fontWeight,
      stepTitle: style('.public-guide-steps h4').fontWeight,
      stepBody: style('.public-guide-steps p').fontWeight,
      faq: style('.public-guide-questions summary').fontWeight,
      search: style('.public-guide-search input').fontWeight,
    };
  });
  expect(typography.fontFamily).toContain('Poppins');
  expect(typography).toMatchObject({title:'700',topic:'500',stepTitle:'600',stepBody:'400',faq:'600',search:'400'});

  const field = guide.locator('.public-guide-search');
  const fieldBox = await field.boundingBox();
  const findBox = await guide.locator('.public-guide-find-controls').boundingBox();
  expect(fieldBox).not.toBeNull();
  expect(findBox).not.toBeNull();
  expect(fieldBox!.width).toBeGreaterThanOrEqual(findBox!.width - 2);
  if (info.project.name === 'desktop-1280') {
    expect(fieldBox!.width).toBeGreaterThan(700);
  }
  const introBox = await guide.locator('.public-guide-intro').boundingBox();
  const searchSectionBox = await guide.locator('.public-guide-find').boundingBox();
  const overviewBox = await guide.locator('.public-guide-overview').boundingBox();
  const layoutBox = await guide.locator('.public-guide-layout').boundingBox();
  expect(introBox && searchSectionBox && overviewBox && layoutBox).toBeTruthy();
  expect(searchSectionBox!.y).toBeGreaterThanOrEqual(introBox!.y + introBox!.height - 1);
  expect(layoutBox!.y).toBeGreaterThan(overviewBox!.y + overviewBox!.height);

  const input = guide.getByRole('searchbox', { name: 'Search the guide' });
  await field.locator('svg').first().click();
  await expect(input).toBeFocused();
  await expect(field).toHaveCSS('border-color', 'rgb(44, 94, 173)');
  await expect(input).toHaveCSS('outline-style', 'none');
  await input.fill('receipt');
  await expect(guide.getByText('Does a receipt confirm tax credit?')).toBeVisible();
  await expect(guide.locator('.public-guide-layout')).toHaveCount(0);
});


test('User guide has real platform-specific steps and searches across all topics', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide = page.locator('.public-guide-page');
  await expect(guide.getByText('On Home, click Pay Tax', { exact: false })).toBeVisible();
  await guide.getByRole('button', { name: 'Mobile', exact: true }).click();
  await expect(guide.getByText('On Home, tap Pay Tax', { exact: false })).toBeVisible();
  await expect(guide.getByText('On Home, click Pay Tax', { exact: false })).toHaveCount(0);

  const search = guide.getByRole('searchbox', { name: 'Search the guide' });
  await search.fill('rates');
  const travelQuestion = guide.locator('.public-guide-result-faq').filter({ hasText: 'Are the rates final?' });
  await expect(travelQuestion).toBeVisible();
  await expect(guide.locator('.public-guide-result-group').getByRole('heading',{name:'Travel tax'})).toBeVisible();
  await search.fill('this-question-does-not-exist');
  await expect(guide.getByText('No results found')).toBeVisible();
  await search.fill('');
  await expect(guide.getByText('What should I check before payment?')).toBeVisible();
  await expect(travelQuestion).toHaveCount(0);

  await setWorkspaceLanguage(page,'bn');
  await expect(guide.getByText('আপনার ডিভাইস অনুযায়ী নির্দেশনা দেখুন।')).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'করবৃত্ত ব্যবহার নির্দেশিকা' })).toBeVisible();
});

test('Guide search covers steps and answers, while topic FAQs stay contextual', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide=page.locator('.public-guide-page');
  await expect(guide.locator('.public-guide-questions details')).toHaveCount(1);
  await expect(guide.getByText('Are the rates final?')).toHaveCount(0);
  const field=guide.getByRole('searchbox',{name:'Search the guide'});
  await field.fill('passport');
  await expect(guide.getByRole('heading',{name:'Search results'})).toBeVisible();
  await expect(guide.getByRole('link',{name:'NBR publications'})).toBeVisible();
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('Enter passenger details');
  await expect(guide.locator('.public-guide-layout')).toHaveCount(0);
  await field.fill('tap Pay Tax');
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('Step 1 · Mobile');
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('On Home, tap Pay Tax');
  const clear=guide.getByRole('button',{name:'Clear search'});
  await expect(clear).toHaveCount(1);
  await expect(guide.locator('.public-guide-find-controls > .public-guide-clear')).toHaveCount(0);
  await clear.click();
  await expect(field).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(guide.getByRole('navigation',{name:'Guide topics'})).toBeVisible();
  await guide.getByRole('button',{name:'Travel tax'}).click();
  await expect(guide.locator('.public-guide-questions')).toContainText('Are the rates final?');
  await expect(guide.getByRole('button',{name:'Travel tax'})).toHaveAttribute('aria-current','true');
});

test('User guide official reference belongs to the reading card, not a separate floating strip', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide=page.locator('.public-guide-page');
  const article=guide.locator('.public-guide-content');
  await expect(guide.locator(':scope > .public-guide-source')).toHaveCount(0);
  await expect(article.locator('.public-guide-source').getByRole('heading',{name:'Official information'})).toBeVisible();
  await expect(article.locator('.public-guide-source').getByRole('link',{name:'NBR publications'})).toBeVisible();
  await guide.getByRole('searchbox',{name:'Search the guide'}).fill('challan');
  await expect(guide.locator('.public-guide-results .public-guide-source')).toBeVisible();
  await expect(guide.locator('.public-guide-content')).toHaveCount(0);
});

test('Selecting a topic takes mobile readers directly to its instructions', async ({ page }, info) => {
  test.skip(info.project.name!=='mobile-375','Mobile reading flow');
  await page.goto('/?action=user_guide');
  const topic=page.locator('.public-guide-topics').getByRole('button',{name:'Receipts & corrections'});
  await topic.click();
  await expect(page.locator('.public-guide-content-head').getByRole('heading',{name:'Receipts & corrections'})).toBeInViewport();
  await expect(topic).toHaveAttribute('aria-current','true');
});

test('Home, User guide and Report use matching content widths and alignment', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const views = [
    { path: '/?action=landing', selector: '.public-information-hub' },
    { path: '/?action=user_guide', selector: '.public-guide-page' },
    { path: '/?action=incident', selector: '.public-report-page' },
  ];
  const bounds: { x: number; width: number }[] = [];
  for (const view of views) {
    await page.goto(view.path);
    const box = await page.locator(view.selector).boundingBox();
    expect(box, `${view.path} should have a content container`).not.toBeNull();
    bounds.push({ x: box!.x, width: box!.width });
    expect(box!.width, `${view.path} must respect the 1100px cap`).toBeGreaterThanOrEqual(1099);
    expect(box!.width, `${view.path} must respect the 1100px cap`).toBeLessThanOrEqual(1101);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Horizontal overflow on ${view.path}`).toBeLessThanOrEqual(2);
  }
  for (const item of bounds.slice(1)) {
    expect(Math.abs(item.x - bounds[0].x), 'Content left edges should align').toBeLessThanOrEqual(2);
    expect(Math.abs(item.width - bounds[0].width), 'Content widths should match').toBeLessThanOrEqual(2);
  }
  await page.goto('/?action=landing');
  const headerBrand = await page.locator('.public-home-brand').boundingBox();
  const footerLogo = await page.locator('.public-footer__wordmark').boundingBox();
  expect(headerBrand).not.toBeNull();
  expect(footerLogo).not.toBeNull();
  expect(Math.abs(headerBrand!.x - bounds[0].x), 'Header aligns with main content').toBeLessThanOrEqual(2);
  expect(Math.abs(footerLogo!.x - bounds[0].x), 'Footer aligns with main content').toBeLessThanOrEqual(2);
});

test('floating help uses guide answers and report offers an editable review without extra notices',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','One assistant and report E2E journey');
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Chat support'}).click();
 await expect(page.getByRole('heading',{name:'Korbritto help'})).toBeVisible();
 await page.getByRole('button',{name:'Payment status',exact:true}).click();
 await expect(page.locator('.public-help-message--assistant')).toContainText('verified reconciliation');
 await page.getByRole('link',{name:'Open user guide'}).click();
 await expect(page.getByRole('heading',{name:'Korbritto user guide'})).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Report'}).click();
 await expect(page.getByRole('heading',{name:'Report a problem'})).toBeVisible();
 await expect(page.getByText('This form does not send reports or create official tickets.')).toHaveCount(0);
 await expect(page.getByText('If money was debited, contact your bank or payment provider.')).toHaveCount(0);
 await page.getByLabel('Short description').fill('Example payment record mismatch, using fake data.');
 await page.getByRole('button',{name:'Review details'}).click();
 await expect(page.getByRole('heading',{name:'Review your details'})).toBeVisible();
 await expect(page.locator('.public-report-review')).toContainText('Example payment record mismatch, using fake data.');
 await page.getByRole('button',{name:'Edit details'}).click();
 await expect(page.getByLabel('Short description')).toHaveValue('Example payment record mismatch, using fake data.');
});
test('public guide and guest launcher pass WCAG automated A/AA',async({page},info)=>{
 test.skip(info.project.name==='desktop-1280','Mobile a11y suite');
 await page.goto('/?action=user_guide');
 const results=await new AxeBuilder({page}).include('.public-guide-page').include('.taxpay-public-mobile-navigation .citizen-header').include('.public-footer').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(results.violations).toEqual([]);
});


test('guest receipt search is under the banner and opens receipt results in the shared modal',async({page})=>{
 await page.goto('/?action=landing');
 const search=page.getByRole('searchbox',{name:'Search payment records by reference'});
 await expect(search).toBeVisible();
 await expect(page.locator('[data-banner-service="intro"] .public-guest-action')).toHaveCount(2);
 await expect(page.getByRole('dialog',{name:'Payment status & receipt'})).toHaveCount(0);
 await search.fill('NO-SUCH-DEMO-REFERENCE-12345');
 await page.locator('.public-record-search').getByRole('button',{name:'Search records'}).click();
 await expect(page).toHaveURL(/action=verify/);
 const lookup=page.getByRole('dialog',{name:'Payment status & receipt'});
 await expect(lookup).toBeVisible();
 await expect(lookup.getByLabel('Challan, token or transaction reference')).toHaveValue('NO-SUCH-DEMO-REFERENCE-12345');
 await expect(lookup.getByRole('heading',{name:'No matching record'})).toBeVisible();
 const samples=lookup.locator('.receipt-lookup__sample');
 await expect(samples).toHaveCount(3);
 await samples.first().click();
 await expect(lookup.locator('.receipt-view--embedded')).toBeVisible();
 await expect(lookup.getByRole('button',{name:'Print receipt'})).toBeVisible();
 await expect(lookup.getByRole('button',{name:'Download',exact:true})).toBeVisible();
 await expect(lookup.locator('.receipt-view__paper')).toBeVisible();
 await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toHaveCount(1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('Bangla homepage reference search keeps keyboard access and modal receipt details',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Bilingual modal receipt at smallest viewport');
 await page.goto('/?action=landing');
 await setWorkspaceLanguage(page,'bn');
 const search=page.getByRole('searchbox',{name:'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন'});
 await expect(search).toBeVisible();
 await expect(page.locator('[data-banner-service="intro"] .public-guest-action')).toHaveCount(2);
 await expect(page.getByRole('dialog',{name:'পেমেন্টের অবস্থা ও রসিদ'})).toHaveCount(0);
 await search.fill('SYNTHETIC-NO-MATCH-2026');
 await search.press('Enter');
 await expect(page).toHaveURL(/action=verify/);
 const lookup=page.getByRole('dialog',{name:'পেমেন্টের অবস্থা ও রসিদ'});
 await expect(lookup).toBeVisible();
 await expect(lookup.getByLabel('চালান, টোকেন বা লেনদেনের রেফারেন্স')).toHaveValue('SYNTHETIC-NO-MATCH-2026');
 await expect(lookup.getByText('কোনো মিল পাওয়া যায়নি')).toBeVisible();
 await lookup.locator('.receipt-lookup__sample').first().click();
 await expect(lookup.getByRole('button',{name:'রসিদ প্রিন্ট'})).toBeVisible();
 await expect(lookup.locator('.receipt-view__paper')).toBeVisible();
 const dimensions=await lookup.locator('.receipt-view__paper').evaluate(el=>({paper:el.getBoundingClientRect().width,viewport:innerWidth}));
 expect(dimensions.paper).toBeLessThanOrEqual(dimensions.viewport);
 const a11y=await new AxeBuilder({page}).include('.receipt-modal').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(a11y.violations).toEqual([]);
 await expect(lookup).toBeVisible();
});

test('Travel Tax modal has a top-right close and one fixed workflow action footer',async({page})=>{
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const header=modal.locator('.taxpay-modal__header');
  const body=modal.locator('.taxpay-modal__body');
  const footer=modal.locator('.taxpay-modal__footer');
  const closeIcon=header.getByRole('button',{name:'Close modal'});
  await expect(header.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
  await expect(closeIcon).toBeVisible();
  await expect(header).toHaveCSS('border-bottom-style','solid');
  await expect(footer).toHaveCSS('border-top-style','solid');
  await expect(body.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
  await expect(footer.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(footer.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
  const positions=await modal.evaluate(el=>{
    const h=el.querySelector('.taxpay-modal__header')!.getBoundingClientRect();
    const f=el.querySelector('.taxpay-modal__footer')!.getBoundingClientRect();
    const b=el.querySelector('.taxpay-modal__body')!.getBoundingClientRect();
    return {headerBottom:h.bottom,bodyTop:b.top,bodyBottom:b.bottom,footerTop:f.top};
  });
  expect(positions.headerBottom).toBeLessThanOrEqual(positions.bodyTop+1);
  expect(positions.bodyBottom).toBeLessThanOrEqual(positions.footerTop+1);
  await closeIcon.click();
  await expect(modal).toHaveCount(0);
});

test('travel tax uses same modal header/body/footer without changing its flow',async({page})=>{
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await expect(modal.getByRole('heading',{name:'Travel tax',level:2})).toBeVisible();
  await expect(modal.locator('.taxpay-modal__header')).toHaveCSS('border-bottom-style','solid');
  await expect(modal.locator('.taxpay-modal__footer')).toHaveCSS('border-top-style','solid');
  await expect(modal.getByRole('navigation',{name:'Travel tax steps'})).toBeVisible();
  await expect(modal.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
  await modal.locator('#travel-tax-route-0').check();
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await expect(modal.getByLabel('Passenger name')).toBeVisible();
  await expect(modal.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});


test('travel tax desktop summary stays anchored during the wizard, then full-width receipt takes over',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop split-view geometry');
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const left=modal.locator('.travel-flow__main');
  const side=modal.locator('.travel-flow__summary');
  await expect(side.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
  await modal.locator('#travel-tax-route-0').check();
  const initial=await side.evaluate(el=>el.getBoundingClientRect().top);
  await left.evaluate(el=>el.scrollTop=el.scrollHeight);
  expect(Math.abs((await side.evaluate(el=>el.getBoundingClientRect().top))-initial)).toBeLessThan(2);
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await modal.getByLabel('Passenger name').fill('SYNTHETIC USER');
  await modal.getByLabel('Passport number').fill('FAKE0001');
  await modal.getByLabel('Mobile number for receipt').fill('01712345678');
  await modal.getByLabel('Travel date').fill('2026-10-25');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'bKash'}).check();
  await modal.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await modal.getByRole('button',{name:'Continue payment'}).click();
  await expect(modal.getByRole('heading',{name:'Receipt details'})).toBeVisible({timeout:12000});
  await expect(modal.locator('.travel-flow__summary')).toHaveCount(0);
  await expect(modal.locator('.taxpay-modal__body > .receipt-view--embedded')).toBeVisible();
  await expect(modal.getByRole('button',{name:'Print receipt'})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Download'})).toBeVisible();
});

test('travel tax mobile keeps a compact anchored estimate and Bengali step navigation',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Smallest viewport EN/BN stepper');
 await page.goto('/?action=landing');
 await setWorkspaceLanguage(page,'bn');
 await openTravelTaxFromBanner(page);
 const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 await expect(modal.getByRole('navigation',{name:'ভ্রমণ করের ধাপ'})).toBeVisible();
 await expect(modal.getByRole('button',{name:'যাত্রীর তথ্য দিন'})).toBeVisible();
 await expect(modal.locator('.public-service-dialog__notice')).toHaveCount(0);
 await modal.locator('#travel-tax-route-0').check();
 await modal.getByRole('button',{name:'যাত্রীর তথ্য দিন'}).click();
 await expect(modal.getByLabel('যাত্রীর নাম')).toBeVisible();
 await modal.getByLabel('যাত্রীর নাম').fill('DEMO NAME');
 await modal.getByLabel('পাসপোর্ট নম্বর').fill('FAKE001');
 await modal.getByLabel('রসিদের জন্য মোবাইল নম্বর').fill('01712345678');
 await modal.getByLabel('ভ্রমণের তারিখ').fill('2026-10-25');
 await modal.getByRole('button',{name:'পর্যালোচনায় যান'}).click();
 await expect(modal.getByRole('heading',{name:'তথ্য পর্যালোচনা'})).toBeVisible();
 const width=await modal.evaluate(el=>({viewport:innerWidth,paper:el.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth}));
 expect(width.paper).toBeLessThanOrEqual(width.viewport);
 expect(width.scroll).toBeLessThanOrEqual(width.viewport+2);
 await expect(modal.locator('.travel-flow__summary')).toBeVisible();
});


test('Travel Tax keeps workflow actions separate from receipt Download and Print',async({page})=>{
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const footer=modal.locator('.taxpay-modal__footer');
  const actions=footer.locator('.taxpay-modal__footer-actions');
  await expect(footer.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(actions.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
  await modal.locator('#travel-tax-route-0').check();
  await actions.getByRole('button',{name:'Continue to passenger details'}).click();
  await modal.getByLabel('Passenger name').fill('SYNTHETIC PASSENGER');
  await modal.getByLabel('Passport number').fill('DEMOFAKE01');
  await modal.getByLabel('Mobile number for receipt').fill('01712345678');
  await modal.getByLabel('Travel date').fill('2026-10-25');
  await actions.getByRole('button',{name:'Continue to review'}).click();
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'bKash'}).check();
  await modal.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await actions.getByRole('button',{name:'Continue payment'}).click();
  await expect(modal.getByRole('heading',{name:'Receipt details'})).toBeVisible({timeout:12000});
  await expect(footer.locator('.travel-flow__footer-actions')).toHaveCount(0);
  await expect(footer.locator('.receipt-view__actions')).toHaveCount(1);
  await expect(actions.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'Print receipt'})).toBeVisible();
  await actions.getByRole('button',{name:'New payment'}).click();
  await expect(actions.getByRole('button',{name:'Continue to passenger details'})).toBeVisible();
  await expect(modal.locator('.receipt-view__actions')).toHaveCount(0);
});

test('Travel Tax route search filters English and Bangla and preserves selected payment amount',async({page})=>{
 await page.goto('/?action=landing');
 await openTravelTaxFromBanner(page);
 const modal=page.getByRole('dialog',{name:'Travel tax'});
 const search=modal.getByRole('searchbox',{name:'Search destination or travel mode'});
 const routes=modal.locator('#travel-tax-route-results');
 const summary=modal.locator('.travel-flow__summary');
 await expect(search).toBeVisible();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(6);
 await search.fill('saARc');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('By air to a SAARC country',{exact:false})).toBeVisible();
 await routes.locator('input[type="radio"]').check();
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await search.fill('জাপান');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('By air to North America, South America',{exact:false})).toBeVisible();
 // Filtering does not silently replace the selected rate.
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await search.fill('somewhere-invalid-999');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(0);
 await expect(routes.getByRole('status')).toContainText('No matching routes');
 await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
 await routes.getByRole('button',{name:'Show all routes'}).click();
 await expect(search).toHaveValue('');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(6);
 await expect(routes.locator('#travel-tax-route-1')).toBeChecked();
 await search.fill('land');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(2); // New Zealand and land both match.
 await search.fill('By land');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await modal.getByRole('button',{name:'Clear route search'}).click();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(6);
 await expect(search).toHaveValue('');
 await modal.getByRole('button',{name:'Continue to passenger details'}).click();
 await expect(modal.getByRole('heading',{name:'Passenger information'})).toBeVisible();
});

test('Travel Tax Bangla route search is accessible and fits mobile viewport',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','Small mobile search and Bangla names');
 await page.goto('/?action=landing');
 await setWorkspaceLanguage(page,'bn');
 await openTravelTaxFromBanner(page);
 const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 const search=modal.getByRole('searchbox',{name:'গন্তব্য বা যাতায়াতের ধরন খুঁজুন'});
 const routes=modal.locator('#travel-tax-route-results');
 await search.fill('স্থল');
 await expect(routes.locator('input[type="radio"]')).toHaveCount(1);
 await expect(routes.getByText('স্থল পথে',{exact:false})).toBeVisible();
 const sizes=await search.evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {left:box.left,right:box.right,width:window.innerWidth,scroll:document.documentElement.scrollWidth};
 });
 expect(sizes.left).toBeGreaterThanOrEqual(-1);
 expect(sizes.right).toBeLessThanOrEqual(sizes.width+1);
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+2);
 await modal.getByRole('button',{name:'অনুসন্ধান মুছুন'}).click();
 await expect(routes.locator('input[type="radio"]')).toHaveCount(6);
});

// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });
