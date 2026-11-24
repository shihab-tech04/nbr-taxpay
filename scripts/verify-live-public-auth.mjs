import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Live readback must target the configured TaxPay Pages site');
}
await mkdir('test-results', { recursive: true });

const browser = await chromium.launch({ headless: true });
 
// Repeated CI smoke runs must not download megabytes of public CMS artwork.
// This guard applies only to verification browsers, not to the published app.
// The image onError path uses the existing bundled fallback artwork; all
// payment/API/auth traffic remains subject to the existing test assertions.
const openBudgetSafePage = async options => {
  const page = await browser.newPage(options);
  await page.route(
    'https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
    route => route.abort('blockedbyclient'),
  );
  return page;
};
try {
  for (const [name, viewport, isMobile] of [
    ['desktop', { width: 1280, height: 850 }, false],
    ['mobile', { width: 375, height: 812 }, true]
  ]) {
    const page = await openBudgetSafePage({ viewport, isMobile, hasTouch: isMobile });
    const url = new URL(base);
    url.searchParams.set('action','taxpayer_home');
    await page.goto(url.toString(), {waitUntil:'domcontentloaded',timeout:45_000});
    await expect(page.locator('#public-home-title')).toBeVisible({timeout:30_000});
    await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
    const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
    await expect(dialog).toBeVisible({timeout:30_000});
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>2)throw new Error('Private entry overflow: '+overflow+'px');

    {
      // The published private-route entry now opens the existing approved
      // sign-in dialog directly; there is no duplicate intermediate gate.
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
      await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
      await expect(dialog.getByRole('textbox',{name:'Email address'})).toHaveCount(0);
      await dialog.getByRole('textbox',{name:'User ID'}).fill('user1');
      await dialog.getByLabel('Password',{exact:true}).fill('user1');
      await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
      // The approved first-sign-in OTP checkpoint must complete before
      // verifying the private dashboard route; never bypass the login flow.
      const demoOtp = dialog.getByTestId('demo-otp-input');
      await expect.poll(async () =>
        await demoOtp.isVisible().catch(() => false) || /action=taxpayer_home/.test(page.url()),
        {timeout:15_000}
      ).toBe(true);
      if (await demoOtp.isVisible().catch(() => false)) {
        await demoOtp.fill('111111');
        await dialog.getByRole('button',{name:'Verify code'}).click();
      }
      // A real edge-backed preview login may take longer than Playwright's
      // default five seconds on a cold mobile session. Do not skip login:
      // require successful navigation, and preserve visible failure evidence.
      try {
        await expect(page).toHaveURL(/action=taxpayer_home/,{timeout:30_000});
      } catch(error) {
        const messages=await dialog.getByRole('alert').allTextContents().catch(()=>[]);
        const buttonDisabled=await dialog.getByRole('button',{name:'Sign In',exact:true}).isDisabled().catch(()=>false);
        await page.screenshot({path:'test-results/live-auth-login-failure-'+name+'.png',fullPage:true}).catch(()=>{});
        throw new Error('Live '+name+' sign-in did not complete: '+JSON.stringify({
          url:page.url(),messages,buttonDisabled
        }),{cause:error});
      }
      await expect(page.getByRole('heading',{name:/^(Your tax overview|আপনার করের সারসংক্ষেপ)$/})).toBeVisible();
      // Only a deployed build can certify the NEW dashboard UI. PR preflight
      // runs against the older published version and must not pre-approve it.
      if(process.env.GITHUB_EVENT_NAME!=='pull_request'){
        // Production-only: assert the CURRENT approved fictional-account overview,
        // not removed legacy bento metrics or unverified Treasury totals.
        const workspace=page.getByTestId('user1-synthetic-workspace');
        await expect(workspace).toBeVisible({timeout:30_000});
        await expect(workspace).toHaveAttribute('data-dashboard-view','true');
        await expect(page.getByRole('region',{name:/Payment and request summary|পেমেন্ট ও আবেদনের সারসংক্ষেপ/})).toBeVisible();
        await expect(workspace).toHaveAttribute('data-payment-source-state','ready',{timeout:30000});
        const analytics=page.getByTestId('dashboard-payment-analytics');
        await expect(analytics).toBeVisible();
        await expect(analytics).toHaveAttribute('data-chart-source','recorded');
        await expect(analytics.getByTestId('dashboard-chart-source')).toHaveCount(0);
        // Populated SQL retains its existing chart layout; empty SQL uses its
        // approved empty state, never hardcoded example totals or identities.
        if(await analytics.getAttribute('data-empty')==='true'){
          await expect(analytics.getByText(/No itemized account payments|চার্টে দেখানোর মতো/)).toBeVisible();
        }else{
          await expect(page.getByTestId('dashboard-beneficiary-breakdown')).toBeVisible();
          await expect(page.getByRole('heading',{name:/Payment relationships|পেমেন্টের সম্পর্ক/})).toBeVisible();
        }
        await expect(workspace.getByText(/DEMO-PAY-|DEMO-ETDS-|DEMO-REFUND-/)).toHaveCount(0);
        await expect(page.getByRole('heading',{name:/My Tax Journey|আমার কর যাত্রা/})).toBeVisible();
        const yearSelect=page.getByRole('combobox',{name:/Assessment year|করবর্ষ/});
        await yearSelect.selectOption('2025-2026');
        await expect(yearSelect).toHaveValue('2025-2026');
        await page.screenshot({path:'test-results/live-dashboard-category-breakdown-'+name+'.png',fullPage:true});
      }
      const beneficiaryUrl=new URL(base);
      beneficiaryUrl.searchParams.set('action','beneficiaries');
      await page.goto(beneficiaryUrl.toString(),{waitUntil:'domcontentloaded',timeout:45_000});
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toHaveCount(0);
      await page.screenshot({path:'test-results/live-auth-restored-'+name+'.png',fullPage:true});
    }
    await page.close();

    // Only the already-published Pages bundle can certify MOBILE public navigation LIVE.
    // PR preflight must not assert this against the previously published version.
    if (isMobile && process.env.GITHUB_EVENT_NAME !== 'pull_request') {
      const publicMobile = await openBudgetSafePage({ viewport, isMobile, hasTouch: true });
      const mobileUrl = new URL(base);
      mobileUrl.searchParams.set('action','landing');
      await publicMobile.goto(mobileUrl.toString(), {waitUntil:'domcontentloaded',timeout:45_000});
      const mobileNav = publicMobile.locator('.taxpay-public-mobile-navigation');
      const menu = mobileNav.getByRole('button',{name:'Open menu'});
      const wordmark = mobileNav.getByRole('button',{name:'Sohojkor home'});
      const guestBell = mobileNav.getByRole('button',{name:'Notifications'});
      await expect(menu).toBeVisible({timeout:30_000});
      await expect(wordmark).toBeVisible();
      await expect(guestBell).toHaveCount(0);
      await expect(publicMobile.locator('.public-home-header')).toBeHidden();
      // Preserve the original public bottom navigation, separate from Help chat
      // and the floating Pay now action (the previous removal was unrequested).
      const publicDock=publicMobile.getByRole('navigation',{name:'Mobile primary navigation'});
      await expect(publicDock).toBeVisible();
      for(const item of ['Home','Payment Status','Help'])
        await expect(publicDock.getByRole('button',{name:item})).toBeVisible();
      await expect(publicDock.locator('.citizen-bottom-nav__item')).toHaveCount(3);
      const helpButton = publicMobile.getByRole('button',{name:'Chat support'});
      await expect(helpButton).toBeVisible();
      const payButton = publicMobile.getByRole('button',{name:'Pay — select payment type'});
      await expect(payButton).toBeVisible();
      await expect(payButton).toHaveClass(/citizen-pay--guest-floating/);
      await menu.click();
      const mobileMenu = publicMobile.getByRole('dialog',{name:'Services & menu'});
      await expect(mobileMenu.getByRole('button',{name:'Payment Status'})).toBeVisible();
      await expect(mobileMenu.getByRole('button',{name:'Help'})).toBeVisible();
      await expect(mobileMenu.getByRole('button',{name:'Beneficiaries'})).toHaveCount(0);
      await publicMobile.keyboard.press('Escape');
      await expect(mobileMenu).toHaveCount(0);
      const frame = await publicMobile.evaluate(()=>{
        const header = document.querySelector('.taxpay-public-mobile-navigation .citizen-header').getBoundingClientRect();
        const logo = document.querySelector('.taxpay-public-mobile-navigation .citizen-brand').getBoundingClientRect();
        const menu = document.querySelector('.taxpay-public-mobile-navigation .citizen-mobile-menu-trigger').getBoundingClientRect();
        const help = document.querySelector('.public-help-launch')?.getBoundingClientRect();
        const pay = document.querySelector('.citizen-pay')?.getBoundingClientRect();
        const dock = document.querySelector('.citizen-bottom-nav')?.getBoundingClientRect();
        const paySpace = document.querySelector('.citizen-bottom-nav__pay-space')?.getBoundingClientRect();
        const navTargets = [...document.querySelectorAll('.citizen-bottom-nav__item')]
          .map(item=>item.getBoundingClientRect());
        const overlaps = help && pay && help.left < pay.right && help.right > pay.left && help.top < pay.bottom && help.bottom > pay.top;
        const payInsideReservedDock = Boolean(pay && dock && paySpace &&
          pay.left >= paySpace.left-2 && pay.right <= paySpace.right+2 &&
          pay.top >= dock.top-2 && pay.bottom <= dock.bottom+2);
        const payClearsNavTargets = Boolean(pay && navTargets.length===3 &&
          navTargets.every(target=>pay.left >= target.right+2));
        return {center:Math.abs(logo.x+logo.width/2-header.x-header.width/2),
          order:menu.x < logo.x,overlaps,
          payInsideReservedDock,payClearsNavTargets,
          dockAtBottom:Boolean(dock && Math.abs(dock.bottom-innerHeight)<=2),
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      if(frame.center>3 || !frame.order || frame.overlaps ||
         !frame.payInsideReservedDock || !frame.payClearsNavTargets ||
         !frame.dockAtBottom || frame.overflow>2)
        throw new Error('Live public mobile navigation parity regression: '+JSON.stringify(frame));
      // Mobile Help is an approved bottom-anchored modal sheet with a
      // backdrop, not the old floating panel above the dock. The unchanged
      // bottom navigation remains mounted beneath the modal and is restored
      // as soon as Help closes.
      await helpButton.click();
      const helpPanel=publicMobile.locator('#public-help-panel');
      await expect(helpPanel).toBeVisible();
      await expect(helpPanel).toHaveAttribute('aria-modal','true');
      await expect(publicMobile.locator('.public-help-backdrop')).toBeVisible();
      await expect.poll(async()=>{
        const rect=await helpPanel.boundingBox();
        return rect ? Math.abs(rect.y+rect.height-viewport.height) : Infinity;
      },{timeout:5000}).toBeLessThanOrEqual(2);
      const helpBox=await helpPanel.boundingBox();
      if(!helpBox || helpBox.height>=viewport.height)
        throw new Error('Live mobile Help sheet overflows available viewport');
      await helpPanel.getByRole('button',{name:'Close chat'}).click();
      await expect(helpPanel).toHaveCount(0);
      await expect(publicDock).toBeVisible();
      await expect(payButton).toBeVisible();
      await payButton.click();
      const payChoice=publicMobile.getByRole('dialog',{name:'Pay Tax'});
      await expect(payChoice).toBeVisible();
      await expect(payChoice.locator('[data-payer-relationship]')).toHaveCount(2);
      const choiceBox=await payChoice.boundingBox();
      if(!choiceBox || choiceBox.height>=viewport.height*.8)
        throw new Error('Live mobile Pay Tax first choice has excessive blank height');
      await payChoice.getByRole('button',{name:'Close payment services'}).click();
      await publicMobile.screenshot({path:'test-results/live-auth-public-mobile-nav-'+name+'.png',fullPage:false});
      await publicMobile.close();
    }

    // A post-deploy check of the actual published bundle, not a PR preview.
    // Keep the pre-merge readback compatible with the older currently-live UI.
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
      const guestPayment = await openBudgetSafePage({ viewport, isMobile, hasTouch: isMobile });
      const guestPaymentUrl = new URL(base);
      guestPaymentUrl.searchParams.set('action', 'guest');
      await guestPayment.goto(guestPaymentUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await guestPayment.locator('#guest-payer-other').check();
      await expect(guestPayment.getByTestId('saved-beneficiary-picker')).toHaveCount(0);
      await expect(guestPayment.locator('#guest-tin')).toBeVisible();
      await guestPayment.screenshot({ path: `test-results/live-auth-guest-no-beneficiaries-${name}.png`, fullPage: true });
      await guestPayment.close();
    }

    // Beneficiaries are private in the already-live baseline as well as the
    // candidate release. Enforce the same signed-out boundary in both PR
    // preflight and the deployed production browser check.
    const beneficiaries = await openBudgetSafePage({ viewport, isMobile, hasTouch: isMobile });
    const beneficiariesUrl = new URL(base);
    beneficiariesUrl.searchParams.set('action', 'beneficiaries');
    await beneficiaries.goto(beneficiariesUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const beneficiaryModal = beneficiaries.locator('.taxpay-modal.taxpayer-login-modal');
    const requireBeneficiaryModal = process.env.TAXPAY_REQUIRE_BENEFICIARIES_MODAL === '1';
    // Lazy-loaded private routes may show a loading fallback after
    // DOMContentLoaded. Wait for an actual authenticated-entry boundary
    // before checking the required newer modal or approved older gate.
    if (!requireBeneficiaryModal) {
      await expect.poll(async () => await beneficiaryModal.isVisible() ||
        await beneficiaries.getByRole('heading', { name: 'Private taxpayer workspace' }).isVisible(),
        { timeout: 30_000, message: 'Signed-out Beneficiaries require a login gate' }).toBe(true);
    }
    if (requireBeneficiaryModal || await beneficiaryModal.isVisible()) {
      await expect(beneficiaryModal).toBeVisible({ timeout: 30_000 });
      await expect(beneficiaryModal).toHaveCount(1);
      await expect(beneficiaryModal.getByRole('textbox', { name: 'User ID' })).toBeVisible();
      await expect(beneficiaries.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    } else {
      // PR preflight checks the previous live version; it may still show the
      // legacy gate. The deployed production check *requires* the modal.
      await expect(beneficiaries.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible({ timeout: 30_000 });
      await expect(beneficiaries.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', /action=taxpayer_login/);
    }
    await expect(beneficiaries.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(beneficiaries.locator('.taxpayer-reference-rail')).toHaveCount(0);
    await expect(beneficiaries.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Beneficiaries' })).toHaveCount(0);
    beneficiariesUrl.searchParams.set('lang', 'bn');
    await beneficiaries.goto(beneficiariesUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!requireBeneficiaryModal) {
      await expect.poll(async () => await beneficiaryModal.isVisible() ||
        await beneficiaries.getByRole('heading', { name: 'করদাতার ব্যক্তিগত তথ্য' }).isVisible(),
        { timeout: 30_000, message: 'Signed-out Bengali Beneficiaries require a login gate' }).toBe(true);
    }
    if (requireBeneficiaryModal || await beneficiaryModal.isVisible()) {
      await expect(beneficiaryModal).toBeVisible({ timeout: 30_000 });
      await expect(beneficiaryModal.getByRole('textbox', { name: 'ইউজার আইডি' })).toBeVisible();
      await expect(beneficiaries.getByRole('heading', { name: 'করদাতার ব্যক্তিগত তথ্য' })).toHaveCount(0);
    } else {
      await expect(beneficiaries.getByRole('heading', { name: 'করদাতার ব্যক্তিগত তথ্য' })).toBeVisible({ timeout: 30_000 });
      await expect(beneficiaries.getByRole('link', { name: 'সাইন ইন' })).toHaveAttribute('href', /action=taxpayer_login/);
    }
    await expect(beneficiaries.getByTestId('beneficiaries-page')).toHaveCount(0);
    const beneficiaryOverflow = await beneficiaries.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (beneficiaryOverflow > 2) throw new Error(`Live ${name} Beneficiaries gate overflow: ${beneficiaryOverflow}px`);
    await beneficiaries.screenshot({ path: 'test-results/live-beneficiaries-' + name + '.png', fullPage: true });
    await beneficiaries.close();

    // Check the signed-out navigation without changing hosted payment data.
    // Keep session-scoped event reads available by direct link, not a guest bell.
    // Mock only the two SQL-backed read endpoints; never emulate a settlement.
    const guest = await openBudgetSafePage({ viewport, isMobile, hasTouch: isMobile });
    const sessionId = '22222222-2222-4222-8222-222222222222';
    const paymentId = '33333333-3333-4333-8333-333333333333';
    await guest.addInitScript(session => {
      sessionStorage.setItem('taxpay-guest-simulation-session', session);
      sessionStorage.setItem('taxpay-guest-story-payment', 'true');
    }, sessionId);
    await guest.route('**/functions/v1/demo-story1-taxpay/notifications?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ id: 10, paymentId, type: 'SIMULATED_PAYMENT_SUCCESS', createdAt: '2026-10-24T10:00:00Z' }] })
    }));
    await guest.route('**/functions/v1/demo-story1-taxpay/payments?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [{ id: paymentId, service: 'TAX_WITH_RETURN', amountMinor: 125050, status: 'SIMULATED_SUCCESS', createdAt: '2026-10-24T10:00:00Z' }], total: 1 } })
    }));
    const guestUrl = new URL(base);
    // Verify the public shell shows no notification entry at any viewport.
    guestUrl.searchParams.set('action', 'head_catalogue');
    await guest.goto(guestUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(guest.locator('.citizen-header')).toBeVisible({ timeout: 15_000 });
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
      await expect(guest.locator('.citizen-header__notification')).toHaveCount(0);
      await expect(guest.locator('.citizen-corner--top-right')).toHaveCount(0);
    }
    // A direct route retains historical session-only payment records without
    // displaying private account notifications in the signed-out navigation.
    guestUrl.searchParams.set('action', 'payment_notifications');
    await guest.goto(guestUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(guest).toHaveURL(/action=payment_notifications/);
    await expect(guest.getByRole('heading', { name: 'Payment notifications', level: 1 })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Payment record saved', level: 2 })).toBeVisible();
    await expect(guest.locator('p:visible').filter({ hasText: 'Amount: ৳1,250.50' }).first()).toBeVisible();
    await expect(guest.locator('p:visible').filter({ hasText: paymentId }).first()).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    await guest.screenshot({ path: `test-results/live-auth-guest-session-record-${name}.png`, fullPage: true });
    await guest.close();
  }
  console.log('PASS: private route auth boundary, guest notification controls hidden, signed-out Beneficiaries gate, and session-only payment record readback at desktop/mobile widths');
} finally {
  await browser.close();
}
