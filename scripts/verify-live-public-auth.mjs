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
try {
  for (const [name, viewport, isMobile] of [
    ['desktop', { width: 1280, height: 850 }, false],
    ['mobile', { width: 375, height: 812 }, true]
  ]) {
    const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
    const url = new URL(base);
    url.searchParams.set('action','account_profile');
    await page.goto(url.toString(), {waitUntil:'domcontentloaded',timeout:45_000});
    await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible({timeout:30_000});
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>2)throw new Error('Private entry overflow: '+overflow+'px');

    {
      // Current published baseline and candidate both use the approved User ID/password flow.
      const userIdEntry=page.getByRole('link',{name:'Sign In'});
      await expect(userIdEntry).toHaveAttribute('href',/action=taxpayer_login/);
      await userIdEntry.click();
      const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
      await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
      await expect(dialog.getByRole('textbox',{name:'Email address'})).toHaveCount(0);
      await dialog.getByRole('textbox',{name:'User ID'}).fill('user1');
      await dialog.getByLabel('Password',{exact:true}).fill('user1');
      await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
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
      await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
      // Only a deployed build can certify the NEW dashboard UI. PR preflight
      // runs against the older published version and must not pre-approve it.
      if(process.env.GITHUB_EVENT_NAME!=='pull_request'){
        const spending=page.getByTestId('beneficiary-spending-breakdown');
        await expect(spending).toBeVisible({timeout:30_000});
        await expect(spending.getByTestId('beneficiary-spending-segments')).toBeVisible();
        await expect(spending.getByTestId('tag-spend-own')).toBeVisible();
        await expect(spending.getByTestId('tag-spend-needs-tag')).toBeVisible();
        await expect(spending.getByTestId('tag-spend-no-link')).toBeVisible();
        await expect(spending.getByTestId('tag-spend-unassigned')).toHaveCount(0);
        // A real Pages login must show a complete, reconciled breakdown in
        // the user's current EN/BN preference. No backend writes or mocks.
        const numbers=await spending.evaluate(root=>{
          const read=id=>{
            const text=root.querySelector('[data-testid="'+id+'"]')?.textContent??'';
            const bengali='০১২৩৪৫৬৭৮৯';
            const normal=text.replace(/[০-৯]/g,d=>String(bengali.indexOf(d))).replace(/[^0-9.-]/g,'');
            return normal?Number(normal):NaN;
          };
          const total=read('tagged-payment-total');
          const rows=[...root.querySelectorAll('[data-testid^="tag-spend-"]')];
          const amounts=rows.map(row=>{
            const strong=row.querySelector('strong')?.textContent??'';
            const bengali='০১২৩৪৫৬৭৮৯';
            return Number(strong.replace(/[০-৯]/g,d=>String(bengali.indexOf(d))).replace(/[^0-9.-]/g,''));
          });
          return {total,sum:amounts.reduce((a,b)=>a+b,0),count:rows.length};
        });
        if(!Number.isFinite(numbers.total)||numbers.total!==numbers.sum||numbers.count<7)
          throw new Error('Live beneficiary spending breakdown does not reconcile: '+JSON.stringify(numbers));
        await page.screenshot({path:'test-results/live-dashboard-category-breakdown-'+name+'.png',fullPage:true});
      }
      const beneficiaryUrl=new URL(base);
      beneficiaryUrl.searchParams.set('action','beneficiaries');
      await page.goto(beneficiaryUrl.toString(),{waitUntil:'domcontentloaded',timeout:45_000});
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
      await page.screenshot({path:'test-results/live-auth-restored-'+name+'.png',fullPage:true});
    }
    await page.close();

    // Only the already-published Pages bundle can certify MOBILE public navigation LIVE.
    // PR preflight must not assert this against the previously published version.
    if (isMobile && process.env.GITHUB_EVENT_NAME !== 'pull_request') {
      const publicMobile = await browser.newPage({ viewport, isMobile, hasTouch: true });
      const mobileUrl = new URL(base);
      mobileUrl.searchParams.set('action','landing');
      await publicMobile.goto(mobileUrl.toString(), {waitUntil:'domcontentloaded',timeout:45_000});
      const mobileNav = publicMobile.locator('.taxpay-public-mobile-navigation');
      const menu = mobileNav.getByRole('button',{name:'Open menu'});
      const wordmark = mobileNav.getByRole('button',{name:'Korbritto home'});
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
        const overlaps = help && pay && help.left < pay.right && help.right > pay.left && help.top < pay.bottom && help.bottom > pay.top;
        return {center:Math.abs(logo.x+logo.width/2-header.x-header.width/2),
          order:menu.x < logo.x,overlaps,
          payClearsDock:Boolean(pay && dock && pay.bottom <= dock.top-2),
          dockAtBottom:Boolean(dock && Math.abs(dock.bottom-innerHeight)<=2),
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      if(frame.center>3 || !frame.order || frame.overlaps || !frame.payClearsDock || !frame.dockAtBottom || frame.overflow>2)
        throw new Error('Live public mobile navigation parity regression: '+JSON.stringify(frame));
      // Approved mobile Help UI is now a content-sized, bottom-fixed sheet,
      // not the former floating card above the dock. Check the actual released
      // sheet geometry, its close action and restored navigation/Pay entry.
      await helpButton.click();
      const helpPanel=publicMobile.locator('#public-help-panel');
      await expect(helpPanel).toBeVisible();
      const helpBox=await helpPanel.boundingBox();
      if(!helpBox || helpBox.y < -2 ||
         Math.abs(helpBox.y+helpBox.height-viewport.height)>2 ||
         helpBox.height>viewport.height-10)
        throw new Error('Live mobile Help bottom sheet is not viewport-safe: '+JSON.stringify(helpBox));
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
      const guestPayment = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
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
    const beneficiaries = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
    const beneficiariesUrl = new URL(base);
    beneficiariesUrl.searchParams.set('action', 'beneficiaries');
    await beneficiaries.goto(beneficiariesUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const beneficiaryModal = beneficiaries.locator('.taxpay-modal.taxpayer-login-modal');
    const requireBeneficiaryModal = process.env.TAXPAY_REQUIRE_BENEFICIARIES_MODAL === '1';
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
    const guest = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
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
