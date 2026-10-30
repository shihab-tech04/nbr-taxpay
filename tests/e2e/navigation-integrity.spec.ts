import {expect, test} from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';

test('public header, user-guide topics, footer links, language and browser history reach their intended destinations', async ({page}) => {
  await page.goto('/?action=landing');
  const publicNav = page.getByRole('navigation',{name:'Primary navigation'});
  if (page.viewportSize()!.width <= 900) await page.getByRole('button',{name:'Menu'}).click();
  await publicNav.getByRole('link',{name:'User guide'}).click();
  await expect(page).toHaveURL(/action=user_guide/);
  await expect(page.getByRole('heading',{name:'Korbritto user guide'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment basics'})).toBeVisible();
  await page.getByRole('button',{name:'Travel tax',exact:true}).click();
  await expect(page).toHaveURL(/action=user_guide&category=travel/);
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  // This destination is the same route with a different tab; it must select the target tab.
  await page.getByRole('contentinfo',{name:'Korbritto footer'}).getByRole('button',{name:'Security & support'}).click();
  await expect(page).toHaveURL(/action=user_guide&category=security/);
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/action=user_guide&category=travel/);
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).first().click();
  await expect(page).toHaveURL(/lang=bn/);
  await page.reload();
  await expect(page.getByRole('heading',{name:'করবৃত্ত ব্যবহার নির্দেশিকা'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'নিরাপত্তা ও সহায়তা'})).toBeVisible();
});

test('public footer utility links open their actual destinations without copying the top navigation', async ({page}) => {
  await page.goto('/?action=landing&lang=en');
  const footer = page.getByRole('contentinfo',{name:'Korbritto footer'});
  await footer.getByRole('button',{name:'Receipts & corrections'}).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('action')).toBe('user_guide');
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('records');
  await expect(page.getByRole('heading',{name:'Receipts & corrections'})).toBeVisible();
  await footer.getByRole('button',{name:'Payment status & receipt'}).click();
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('dialog',{name:'Payment status & receipt'})).toBeVisible();
});

test('public payment and receipt actions reach their dedicated flows', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?action=landing');
  const search=page.getByRole('searchbox',{name:'Search payment records by reference'});
  await expect(search).toBeVisible();
  await search.fill('NO-SUCH-REFERENCE-98765');
  await search.press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('dialog',{name:/Payment status & receipt/}).getByLabel('Challan, token or transaction reference')).toHaveValue('NO-SUCH-REFERENCE-98765');
  await expect(page.locator('.citizen-header')).toHaveCount(0);
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax'}).click();
  const services=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(services).toBeVisible();
  await enterTaxPayService(services, 'TAX_WITH_RETURN');
  await expect(page).toHaveURL(/action=landing/);
  await expect(services.getByText('Step 1 of 4')).toBeVisible();
  await expect(services.locator('.payment-form-section')).toHaveCount(1);
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  await expect(page.getByRole('dialog',{name:/Travel tax/})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close modal'}).click();

  await page.goto('/?action=verify');
  const receiptDialog = page.getByRole('dialog',{name:'Payment status & receipt'});
  await expect(receiptDialog).toBeVisible();
  await receiptDialog.getByRole('button',{name:/Use reference:/}).first().click();
  await expect(receiptDialog.locator('.receipt-view--embedded')).toBeVisible();
  await expect(receiptDialog.getByRole('button',{name:'Back to search'})).toHaveCount(0);
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  await receiptDialog.getByRole('button',{name:'Close modal'}).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('signed-in Track payment stays in the activity workspace and uses the existing lookup', async ({page}) => {
  await page.goto('/?action=history&demoUser=user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  const tabs=page.getByRole('navigation',{name:'Activity sections'});
  await tabs.getByRole('button',{name:'Track payment'}).click();

  await expect(page).toHaveURL(/action=history&trackPayment=1/);
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Track payment'})).toBeVisible();
  await expect(tabs.getByRole('button',{name:'Track payment'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Payment status & receipt'})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Challan, token or transaction reference'})).toBeVisible();

  await page.locator('.receipt-lookup__sample').first().click();
  const receiptDialog=page.getByRole('dialog',{name:/Receipt details/});
  await expect(receiptDialog.locator('.receipt-view--embedded')).toBeVisible();
  await receiptDialog.getByRole('button',{name:'Close modal'}).click();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
  await tabs.getByRole('button',{name:'Transactions'}).click();
  await expect(page).toHaveURL(/action=history/);
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
});

test('Track payment lookup keeps Bengali workspace labels', async ({page}) => {
  await page.goto('/?action=history&demoUser=user1&lang=bn');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  const tabs=page.getByRole('navigation',{name:'লেনদেনের বিভাগ'});
  await tabs.getByRole('button',{name:'পেমেন্ট অনুসন্ধান'}).click();

  await expect(page).toHaveURL(/action=history&trackPayment=1/);
  await expect(page.getByRole('heading',{name:'পেমেন্ট ও লেনদেন'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'পেমেন্ট অনুসন্ধান'})).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'চালান, টোকেন বা লেনদেনের রেফারেন্স'})).toBeVisible();
});

test('guest menus and bell route to their named services; contextual payment choices stay in the modal', async ({page}) => {
  await page.goto('/?action=head_catalogue');
  // Guest visitors use the actual header bell on desktop and mobile;
  // the protected account inbox remains sign-in gated.
  const guestBell = page.locator('.citizen-header__notification');
  await expect(guestBell).toBeVisible();
  await guestBell.click();
  await expect(page).toHaveURL(/action=payment_notifications/);
  await expect(page.getByRole('heading',{name:'Sign in to view payment notifications',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  const services=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(services, 'OTHER_TAX_PAYMENT');
  await expect(page).toHaveURL(/action=payment_notifications/);
  await expect(services.getByText('Step 1 of 4')).toBeVisible();
  await expect(services.locator('.tax-service-choice__selected-service')).toContainText('Other Tax Payment');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sign in to view payment notifications',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toHaveCount(0);
});

test('taxpayer desktop rail keeps compact primary navigation and its menu routes',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop sidebar is presented above 900px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  const pay=rail.getByRole('button',{name:'Pay — select payment type'});
  await expect(pay).toBeVisible();
  await expect(pay).toContainText('Pay Tax');
  await expect(page.locator('.citizen-pay')).toBeHidden();
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveCSS('font-size','16px');
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveCSS('min-height','44px');
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveCSS('box-shadow','none');
  await expect(rail.locator('.taxpayer-reference-links > button')).toHaveCount(5);
  await expect(rail.locator('.taxpayer-reference-links > button').nth(1)).toHaveText('Beneficiaries');
  const bottom=rail.locator('.taxpayer-reference-rail-bottom');
  await expect(bottom.getByRole('button')).toHaveCount(3);
  await expect(bottom.getByRole('button').first()).toHaveText('Profile');
  await expect(bottom.getByRole('button').last()).toHaveText('Exit workspace');
  for(const [label,route] of [
    ['Beneficiaries','beneficiaries'],['Activity','history'],['Tax ledger','ledger'],['Notifications','account_notifications']
  ] as const){
    await rail.getByRole('button',{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp('action='+route+'(?:&|$)'));
    await expect(page.locator('main h1').first()).toBeVisible();
  }
  // Activity stays a single primary destination. The approved compact rail does not add a second navigation level.
  await rail.getByRole('button',{name:'Activity',exact:true}).click();
  await expect(page).toHaveURL(/action=history(?:&|$)/);
  await bottom.getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page).toHaveURL(/action=account_profile(?:&|$)/);
  await expect(page.getByRole('heading',{name:'Profile',exact:true,level:1})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Help',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Payment services',exact:true})).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Payment guide',exact:true})).toHaveCount(0);
  await pay.click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
});

test('desktop sidebar Pay Tax action opens service choice then the embedded payment form',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Wide desktop payment-entry check');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await rail.getByRole('button',{name:'Pay — select payment type'}).click();
  const services=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(services, 'TAX_WITH_RETURN');
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(services.locator('.payment-form-section')).toHaveCount(1);
  await expect(services.getByText('Step 1 of 4')).toBeVisible();
  await expect(rail).toBeVisible();
  // The dashboard stays mounted, but its duplicate Pay actions are suppressed.
  await expect(rail.locator('.taxpayer-reference-main-action')).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
});

test('desktop guest account access keeps the existing payment type chooser',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop rail starts at 1440px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=secure_workspace');
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(rail.locator('.taxpayer-reference-main-action')).toHaveCount(0);
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
  await expect(page).toHaveURL(/action=secure_workspace/);
});

test('taxpayer mobile menu and payment action link to the correct routes in both languages',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Mobile navigation at 375px');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const open=()=>page.getByRole('button',{name:'Open menu'}).first().click();
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Activity'}).click();
  await expect(page).toHaveURL(/action=history/);
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Tax Ledger'}).click();
  await expect(page).toHaveURL(/action=ledger/);
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  const services=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(services, 'TAX_WITH_RETURN');
  // Payment services remain reachable through the Pay action without adding duplicate menu items.
  await expect(page).toHaveURL(/action=ledger/);
  await expect(services.locator('.payment-form-section')).toHaveCount(1);
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বিজ্ঞপ্তি',exact:true}).click();
  await expect(page).toHaveURL(/action=account_notifications/);
  await expect(page.locator('main h1').first()).toContainText('বিজ্ঞপ্তি');
});

test('taxpayer mobile menu matches the compact desktop destinations and keeps exit last',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Compact taxpayer menu is exercised at 375px');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const destinations=[
    ['Home','taxpayer_home'],['Activity','history'],['Tax Ledger','ledger'],
    ['Notifications','account_notifications'],['Profile','account_profile']
  ] as const;
  for(const [label,route] of destinations){
    await page.getByRole('button',{name:'Open menu'}).first().click();
    const dialog=page.getByRole('dialog',{name:'Services & menu'});
    await expect(dialog.locator('.citizen-dialog__link:visible')).toHaveCount(6);
    await expect(dialog.getByRole('button',{name:'Beneficiaries'})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Payment services'})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'Help'})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'Profile settings'})).toHaveCount(0);
    await dialog.getByRole('button',{name:label,exact:true}).first().click();
    await expect(page).toHaveURL(new RegExp('action='+route+'(?:&|$)'));
    await expect(page.locator('main h1').first()).toBeVisible();
  }
  await page.getByRole('button',{name:'Open menu'}).first().click();
  const dialog=page.getByRole('dialog',{name:'Services & menu'});
  await expect(dialog.locator('.citizen-dialog__account button').last()).toHaveText('Exit workspace');
  await dialog.getByRole('button',{name:'Exit workspace'}).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('unknown destination falls back to Home without leaving an incorrect URL',async({page})=>{
  await page.goto('/?action=missing_destination');
  await expect(page.locator('#public-home-title')).toBeVisible();
  await expect(page).toHaveURL(/action=landing/);
});

test('a sample taxpayer preview restores only its own browser-history entry',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  // The preview is not account authentication or a transferable URL credential.
  await page.goto('/?action=ledger');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
});

test('TaxPay rejects Office Management destinations at every direct route entry',async({page})=>{
  const routes=['officer_home','taxpayer_360','payment_search','correction_queue','case_management',
    'incident_investigation','offline_evidence','audit_trail','intelligence','monitoring'];
  for(const route of routes){
    await page.goto('/?action='+route);
    await expect(page).toHaveURL(/action=landing(?:&|$)/);
    await expect(page.locator('#public-home-title')).toBeVisible();
    await expect(page.locator('header.bg-emerald-950')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Officer review inbox'})).toHaveCount(0);
  }
});

test('Taxpayer receipt inspection is modal, preserves its deep link and returns to activity',async({page},info)=>{
  // The approved desktop reference rail appears at >=1440px, not at 1280px.
  if(info.project.name==='desktop-1280') await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=history');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Activity',exact:true}).first().click();
  await expect(page).toHaveURL(/action=history/);
  if(page.viewportSize()!.width >= 1440){
    await expect(page.getByRole('complementary',{name:'Taxpayer desktop navigation'})).toBeVisible();
    await page.getByRole('button',{name:'View',exact:true}).first().click();
  } else {
    await page.getByRole('button',{name:'View details'}).first().click();
  }
  await expect(page).toHaveURL(/action=payment_details&returnTo=history/);
  await expect(page.getByRole('dialog',{name:'Payment receipt details'}).locator('.receipt-view--embedded')).toBeVisible();
  await expect(page).toHaveURL(/demoReceipt=rcpt-101/);
  await page.reload();
  const modal = page.getByRole('dialog',{name:'Payment receipt details'});
  await expect(modal.locator('.receipt-view--embedded')).toContainText('AC-2025-09-DEMO-REF-001');
  await expect(page.locator('.citizen-header')).toHaveCount(0);
  await expect(page.locator('.public-home-header')).toBeVisible();
  await modal.getByRole('button',{name:'Close modal'}).click();
  await expect(page).toHaveURL(/action=history/);
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});

test('ontology choices are keyboard-operable',async({page})=>{
  await page.goto('/?action=ontology');
  const payer=page.getByRole('button',{name:/Payer \(Ortho-prodan-kari\)/});
  await expect(payer).toHaveAttribute('aria-pressed','false');
  await payer.focus();
  await page.keyboard.press('Space');
  await expect(payer).toHaveAttribute('aria-pressed','true');
});
