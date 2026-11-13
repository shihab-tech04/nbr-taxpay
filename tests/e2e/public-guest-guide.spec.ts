import { fillTravelDetails, fillForeignPassenger } from './travel-tax-test-helper';
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
 await expect(travel.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
 await expect(travel.locator('.public-service-dialog__notice')).toHaveCount(0);
 await expect(travel.getByText('Rates and exemptions are not verified.',{exact:false})).toHaveCount(0);
 await expect(travel.locator('.travel-flow__summary')).toBeHidden();
 await fillTravelDetails(travel);
 await expect(travel.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
 await travel.getByRole('button',{name:'Continue to review'}).click();
 await expect(travel.getByRole('heading',{name:'Review & payment'})).toBeVisible();
  await travel.getByRole('button',{name:'Pay online'}).click();
  await travel.getByRole('button',{name:'Mobile banking'}).click();
 await travel.getByRole('radio',{name:'bKash'}).check();
 await travel.locator('.travel-flow__channel-option input[type="checkbox"]').check();
 await travel.getByRole('button',{name:'Confirm preview payment'}).click();
 await expect(travel.getByRole('heading',{name:'Combined Travel Tax details'})).toBeVisible();
 await expect(travel.getByText('Not valid for travel or proof of payment.',{exact:false})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(travel).toHaveCount(0);
 expect(hosted).toEqual([]);
});

test('user guide supports responsive search, FAQs and languages',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Guide journey on mobile');
 await page.goto('/?action=user_guide');
 await expect(page.getByRole('heading',{name:'Sohojkor user guide'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Payment basics'})).toHaveAttribute('aria-current','true');
 await expect(page.locator('.public-guide-topics')).toHaveCSS('display', 'grid');
 await page.getByRole('button',{name:'Travel tax'}).click();
 await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Mobile'}).click();
 await expect(page.getByRole('button',{name:'Mobile'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox',{name:'Search the guide'}).fill('rates');
 await expect(page.getByText('Are the rates final?')).toBeVisible();
 await setWorkspaceLanguage(page,'bn');
 await expect(page.getByRole('heading',{name:'সহজকর ব্যবহার নির্দেশিকা'})).toBeVisible();
 await page.getByRole('button',{name:'মুছুন'}).click();
 await expect(page.getByRole('button',{name:'মোবাইল'})).toHaveAttribute('aria-pressed','true');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('Help Center typography and interactions remain usable at each viewport', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const guide = page.locator('.public-guide-page');
  await expect(guide.getByRole('heading', { name: 'Sohojkor user guide' })).toBeVisible();
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

  await guide.locator('.public-guide-topics').getByRole('button', { name: 'Travel tax', exact: true }).click();
  await expect(guide.getByRole('heading', { name: 'Travel tax', exact: true })).toBeVisible();
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
  await expect(guide.getByText('On Home, choose Pay Tax', { exact: false })).toBeVisible();
  await guide.getByRole('button', { name: 'Mobile', exact: true }).click();
  await expect(guide.getByText('Tap Pay Tax on Home', { exact: false })).toBeVisible();
  await expect(guide.getByText('On Home, choose Pay Tax', { exact: false })).toHaveCount(0);

  const search = guide.getByRole('searchbox', { name: 'Search the guide' });
  await search.fill('rates');
  const travelQuestion = guide.locator('.public-guide-result-faq').filter({ hasText: 'Are the rates final?' });
  await expect(travelQuestion).toBeVisible();
  await expect(guide.locator('.public-guide-result-group').getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  await search.fill('this-question-does-not-exist');
  await expect(guide.getByText('No results found')).toBeVisible();
  await search.fill('');
  await expect(guide.getByText('What should I check before payment?')).toBeVisible();
  await expect(travelQuestion).toHaveCount(0);

  await setWorkspaceLanguage(page,'bn');
  await expect(guide.getByText('আপনার ডিভাইস অনুযায়ী নির্দেশনা দেখুন।')).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'সহজকর ব্যবহার নির্দেশিকা' })).toBeVisible();
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
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('Find and add passengers');
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('not government passport verification');
  await expect(guide.locator('.public-guide-layout')).toHaveCount(0);
  await field.fill('tap Pay Tax');
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('Step 1 · Mobile');
  await expect(guide.locator('.public-guide-result-step').first()).toContainText('Tap Pay Tax on Home');
  const clear=guide.getByRole('button',{name:'Clear search'});
  await expect(clear).toHaveCount(1);
  await expect(guide.locator('.public-guide-find-controls > .public-guide-clear')).toHaveCount(0);
  await clear.click();
  await expect(field).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(guide.getByRole('navigation',{name:'Guide topics'})).toBeVisible();
  await guide.locator('.public-guide-topics').getByRole('button',{name:'Travel tax',exact:true}).click();
  await expect(guide.locator('.public-guide-questions')).toContainText('Are the rates final?');
  await expect(guide.locator('.public-guide-topics').getByRole('button',{name:'Travel tax',exact:true})).toHaveAttribute('aria-current','true');
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

test('Home, Guide and Report retain the same approved desktop width and alignment', async ({ page }) => {
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
    // No route-specific widening of the approved public 1100px canvas.
    expect(box!.width).toBeGreaterThanOrEqual(1099);
    expect(box!.width).toBeLessThanOrEqual(1101);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Horizontal overflow on ${view.path}`).toBeLessThanOrEqual(2);
  }
  for (const item of bounds) {
    expect(Math.abs(item.x + item.width / 2 - 800), 'Public page should remain centered').toBeLessThanOrEqual(2);
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
 await expect(page.getByRole('heading',{name:'Sohojkor user guide'})).toBeVisible();
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
test('help chat answers the matched FAQ in both languages and retains the conversation after close/reopen',async({page})=>{
 await page.goto('/?action=landing');
 const launch=page.getByRole('button',{name:'Chat support'});
 await launch.click();
 await expect(page.getByRole('button',{name:'Payment status',exact:true})).toBeVisible();
 const question=page.getByLabel('Your question');
 await question.fill('Why is my reference not found?');
 await page.getByRole('button',{name:'Send'}).click();
 const answers=page.locator('.public-help-message--assistant');
 await expect(answers.last()).toContainText('Check the reference for typing errors');

 // Mobile help is an aria-modal dialog with a focus trap. Close it before
 // changing the page language, then reopen and verify the English answer
 // stayed in the conversation.
 await page.getByRole('button',{name:'Close chat'}).click();
 await setWorkspaceLanguage(page,'bn');
 const banglaLaunch=page.getByRole('button',{name:'চ্যাট সহায়তা'});
 await banglaLaunch.click();
 await expect(answers.last()).toContainText('Check the reference for typing errors');

 const banglaQuestion=page.getByLabel('আপনার প্রশ্ন');
 await banglaQuestion.fill('রেফারেন্স পাওয়া যাচ্ছে না কেন?');
 await page.getByRole('button',{name:'পাঠান'}).click();
 await expect(answers.last()).toContainText('রেফারেন্সটি সঠিকভাবে লেখা হয়েছে কি না দেখুন');

 await page.getByRole('button',{name:'চ্যাট বন্ধ করুন'}).click();
 await expect(banglaLaunch).toBeFocused();
 await banglaLaunch.click();
 await expect(answers.last()).toContainText('রেফারেন্সটি সঠিকভাবে লেখা হয়েছে কি না দেখুন');
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
  await expect(header.getByRole('heading',{name:'Passengers and receipt details',level:2})).toBeVisible();
  await expect(closeIcon).toBeVisible();
  await expect(header).toHaveCSS('border-bottom-style','solid');
  await expect(footer).toHaveCSS('border-top-style','solid');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(modal.locator('.travel-flow__steps')).toHaveCount(0);
  if (page.viewportSize()!.width <= 650) {
    await expect(footer.locator('[data-testid="mobile-payment-calculation"]')).toHaveCount(0);
    await expect(body.locator('.travel-flow__summary')).toBeHidden();
  } else {
    await expect(body.locator('.travel-flow__summary')).toBeHidden();
  }
  await expect(footer.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(footer.getByRole('button',{name:'Continue to travel details'})).toBeVisible();
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
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(modal.locator('.taxpay-modal__header')).toHaveCSS('border-bottom-style','solid');
  await expect(modal.locator('.taxpay-modal__footer')).toHaveCSS('border-top-style','solid');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(modal.locator('.travel-flow__steps')).toHaveCount(0);
  if (page.viewportSize()!.width <= 650) {
    await expect(modal.locator('.taxpay-modal__footer [data-testid="mobile-payment-calculation"]')).toHaveCount(0);
  } else {
    await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  }
    await fillTravelDetails(modal);
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await expect(modal.locator('#travel-tax-route-results')).toBeVisible();
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
  await expect(side).toBeHidden();
    await fillTravelDetails(modal);
  await expect(side.getByRole('heading',{name:'Payment calculation'})).toBeVisible();
  const initial=await side.evaluate(el=>el.getBoundingClientRect().top);
  await left.evaluate(el=>el.scrollTop=el.scrollHeight);
  expect(Math.abs((await side.evaluate(el=>el.getBoundingClientRect().top))-initial)).toBeLessThan(2);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'bKash'}).check();
  await modal.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await modal.getByRole('button',{name:'Confirm preview payment'}).click();
  await expect(modal.getByRole('heading',{name:'Combined Travel Tax details'})).toBeVisible({timeout:12000});
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
 await expect(modal.locator('.taxpay-modal__title')).toHaveText('যাত্রী ও রসিদের তথ্য');
 await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
 await expect(modal.locator('.travel-flow__steps')).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'ভ্রমণের তথ্য দিতে এগিয়ে যান'})).toBeVisible();
 await expect(modal.locator('.public-service-dialog__notice')).toHaveCount(0);
   await fillTravelDetails(modal);
 await expect(modal.locator('.taxpay-modal__title')).toHaveText('ভ্রমণের তথ্য');
 await expect(modal.locator('#travel-tax-route-results')).toBeVisible();

 await modal.getByRole('button',{name:'পেমেন্ট পর্যালোচনায় যান'}).click();
 await expect(modal.getByRole('heading',{name:'পর্যালোচনা ও পেমেন্ট'})).toBeVisible();
 const width=await modal.evaluate(el=>({viewport:innerWidth,paper:el.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth}));
 expect(width.paper).toBeLessThanOrEqual(width.viewport);
 expect(width.scroll).toBeLessThanOrEqual(width.viewport+2);
 await expect(modal.locator('.travel-flow__summary')).toBeHidden();
 await expect(modal.locator('.taxpay-modal__footer [data-testid="mobile-payment-calculation"]')).toBeVisible();
});


test('Travel Tax keeps workflow actions separate from receipt Download and Print',async({page})=>{
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const footer=modal.locator('.taxpay-modal__footer');
  const actions=footer.locator('.taxpay-modal__footer-actions');
  await expect(footer.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(actions.getByRole('button',{name:'Continue to travel details'})).toBeVisible();
    await fillTravelDetails(modal);
  await actions.getByRole('button',{name:'Continue to review'}).click();

    // Receipt mobile was collected in the passenger stage.
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'bKash'}).check();
  await modal.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await actions.getByRole('button',{name:'Confirm preview payment'}).click();
  await expect(modal.getByRole('heading',{name:'Combined Travel Tax details'})).toBeVisible({timeout:12000});
  await expect(footer.locator('.travel-flow__footer-actions')).toHaveCount(0);
  await expect(footer.locator('.receipt-view__actions')).toHaveCount(1);
  await expect(actions.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'Print receipt'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'New payment'})).toHaveCount(0);
});

test('Travel Tax displays only two mode cards without fixed prices and calculates after passport lookup',async({page})=>{
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const routes=modal.locator('#travel-tax-route-results');
  const summary=modal.locator('.travel-flow__summary');
  await expect(routes).toHaveCount(0);
  await expect(summary.locator('.travel-flow__total')).toContainText('—');
  await fillTravelDetails(modal,{mode:'WATER'});
  await expect(routes.locator('input[type="radio"]')).toHaveCount(2);
  await expect(routes.locator('#travel-tax-route-1')).toBeChecked();
  await expect(routes).toContainText('By water');
  await expect(routes).not.toContainText('1,000');
  await expect(summary.locator('.travel-flow__total')).toContainText('1,000');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Review & payment');
});

test('Travel Tax Bengali passenger tabs remain accessible at 320px',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Small mobile Bengali mode and tabs');
  await page.goto('/?action=landing');
  await setWorkspaceLanguage(page,'bn');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
  const routes=modal.locator('#travel-tax-route-results');
  await expect(routes).toHaveCount(0);
  await expect(modal.getByRole('tab',{name:'বাংলাদেশি যাত্রী'})).toHaveAttribute('aria-selected','true');
  await modal.getByRole('tab',{name:'বিদেশি যাত্রী'}).click();
  await expect(modal.locator('#travel-country-first')).toBeVisible();
  await fillForeignPassenger(modal);
  await fillTravelDetails(modal);
  await expect(routes.locator('input[type="radio"]')).toHaveCount(2);
  await expect(routes.locator('#travel-tax-route-0')).toBeChecked();
  await expect(routes).not.toContainText('By land');
  await expect(routes).toContainText('স্থলপথে');
  const sizes=await routes.evaluate(el=>{
    const box=el.getBoundingClientRect();
    return {left:box.left,right:box.right,width:window.innerWidth,scroll:document.documentElement.scrollWidth};
  });
  expect(sizes.left).toBeGreaterThanOrEqual(-1);
  expect(sizes.right).toBeLessThanOrEqual(sizes.width+1);
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+2);
});

// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });
