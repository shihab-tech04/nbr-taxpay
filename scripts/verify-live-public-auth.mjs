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
    url.searchParams.set('action', 'account_profile');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 2) throw new Error(`Live ${name} private-entry overflow: ${overflow}px`);
    const emailEntry = page.getByRole('link', { name: 'Sign in with email' });
    await expect(emailEntry).toBeVisible();
    await expect(emailEntry).toHaveAttribute('href', /returnTo=account_profile/);
    await emailEntry.click();
    await expect(page).toHaveURL(/action=secure_workspace.*returnTo=account_profile/);
    await expect(page.getByRole('heading', { name: 'Secure Korbritto workspace' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email sign-in link' })).toBeVisible();
    // Do not send an OTP here; this read-only acceptance verifies the visible
    // email-auth route and the safe return target without using a mailbox.
    await page.screenshot({ path: 'test-results/live-auth-email-' + name + '.png', fullPage: true });

    // Keep the explicitly labeled synthetic sample journey separate from
    // verified email auth, and exercise it only through its visible control.
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const sampleEntry = page.getByRole('button', { name: 'Use User ID (sample account)' });
    await expect(sampleEntry).toBeVisible();
    await sampleEntry.click();
    await expect(page).toHaveURL(/action=taxpayer_login/);
    const dialog = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
    await expect(dialog).toBeVisible();
    // Production must render the same reusable TaxPayModal as payment entry.
    await expect(dialog).toHaveClass(/taxpay-modal/);
    await expect(dialog.locator('.taxpay-modal__header')).toBeVisible();
    await expect(dialog.locator('.taxpay-modal__body .taxpayer-login-dialog--embedded')).toBeVisible();
    await expect(dialog.locator('.taxpay-modal__footer').getByRole('button', { name: 'Sign In' })).toBeDisabled();
    await expect(dialog.locator('.taxpay-modal__close')).toBeVisible();
    await expect(dialog.locator('.taxpay-modal__back')).toHaveCount(0);
    await expect(page.locator('.taxpayer-login-backdrop')).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: 'User ID' })).toBeVisible();
    await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type','password');
    await dialog.getByRole('textbox', { name: 'User ID' }).fill('user1');
    await dialog.getByLabel('Password', { exact: true }).fill('user1');
    await dialog.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
    await expect(page).not.toHaveURL(/demoUser=/);
    await page.screenshot({ path: 'test-results/live-auth-sample-' + name + '.png', fullPage: true });
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
      // Verify the *deployed* signed-in navigation, not just a compiled preview.
      if (isMobile) {
        await page.getByRole('button', { name: 'Open menu' }).first().click();
        const menu = page.getByRole('dialog', { name: 'Services & menu' });
        await menu.getByRole('button', { name: 'Beneficiaries', exact: true }).click();
      } else {
        await page.setViewportSize({ width: 1600, height: 900 });
        const rail = page.getByRole('complementary', { name: 'Taxpayer desktop navigation' });
        await expect(rail).toBeVisible();
        await rail.getByRole('button', { name: 'Beneficiaries', exact: true }).click();
        await expect(rail.getByRole('button', { name: 'Beneficiaries', exact: true })).toHaveAttribute('aria-current', 'page');
        const mainLeft = await page.locator('main').evaluate(element => Math.round(element.getBoundingClientRect().left));
        expect(mainLeft).toBe(250);
      }
      await expect(page).toHaveURL(/action=beneficiaries/);
      await expect(page.getByRole('heading', { name: 'Beneficiaries', exact: true })).toBeVisible();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.screenshot({ path: 'test-results/live-auth-beneficiaries-' + name + '.png', fullPage: true });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Beneficiaries', exact: true })).toBeVisible();
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
      const dock = publicMobile.getByRole('navigation',{name:'Mobile primary navigation'});
      await expect(dock).toBeVisible();
      await expect(dock.getByRole('button',{name:'Payment Status'})).toBeVisible();
      await expect(dock.getByRole('button',{name:'Beneficiaries'})).toHaveCount(0);
      await expect(publicMobile.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
      const frame = await publicMobile.evaluate(()=>{
        const header = document.querySelector('.taxpay-public-mobile-navigation .citizen-header').getBoundingClientRect();
        const logo = document.querySelector('.taxpay-public-mobile-navigation .citizen-brand').getBoundingClientRect();
        const menu = document.querySelector('.taxpay-public-mobile-navigation .citizen-mobile-menu-trigger').getBoundingClientRect();
        const help = document.querySelector('.public-help-launch')?.getBoundingClientRect();
        const pay = document.querySelector('.citizen-pay')?.getBoundingClientRect();
        const overlaps = help && pay && help.left < pay.right && help.right > pay.left && help.top < pay.bottom && help.bottom > pay.top;
        return {center:Math.abs(logo.x+logo.width/2-header.x-header.width/2),
          order:menu.x < logo.x,overlaps,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      if(frame.center>3 || !frame.order || frame.overlaps || frame.overflow>2)
        throw new Error('Live public mobile navigation parity regression: '+JSON.stringify(frame));
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
    await expect(beneficiaries.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible({ timeout: 30_000 });
    await expect(beneficiaries.getByRole('link', { name: 'Sign in with email' })).toHaveAttribute('href', /returnTo=beneficiaries/);
    await expect(beneficiaries.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(beneficiaries.locator('.taxpayer-reference-rail')).toHaveCount(0);
    await expect(beneficiaries.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Beneficiaries' })).toHaveCount(0);
    beneficiariesUrl.searchParams.set('lang', 'bn');
    await beneficiaries.goto(beneficiariesUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(beneficiaries.getByRole('heading', { name: 'করদাতার ব্যক্তিগত তথ্য' })).toBeVisible({ timeout: 30_000 });
    await expect(beneficiaries.getByRole('link', { name: 'ইমেইলে সাইন ইন' })).toHaveAttribute('href', /returnTo=beneficiaries/);
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
    await expect(guest.getByText('Amount: ৳1,250.50')).toBeVisible();
    await expect(guest.getByText(paymentId, { exact: false })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    await guest.screenshot({ path: `test-results/live-auth-guest-session-record-${name}.png`, fullPage: true });
    await guest.close();
  }
  console.log('PASS: private route auth boundary, guest notification controls hidden, signed-out Beneficiaries gate, and session-only payment record readback at desktop/mobile widths');
} finally {
  await browser.close();
}
