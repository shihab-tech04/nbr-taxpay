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
    await page.close();

    // Beneficiaries is a public feature with private per-browser persistence.
    const beneficiaries = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
    const beneficiariesUrl = new URL(base);
    beneficiariesUrl.searchParams.set('action', 'beneficiaries');
    await beneficiaries.goto(beneficiariesUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(beneficiaries.getByRole('heading', { name: 'Beneficiaries', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(beneficiaries.getByRole('button', { name: 'Use User ID (sample account)' })).toHaveCount(0);
    await expect(beneficiaries.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
    const beneficiaryPage = beneficiaries.getByTestId('beneficiaries-page');
    await expect(beneficiaryPage).toBeVisible();
    const beneficiaryActions = beneficiaries.locator('[data-testid="beneficiaries-page"] > header');
    await expect(beneficiaryActions).toHaveCount(1);
    // On a fresh guest browser, the approved empty state shows one Create list CTA.
    // Existing saved lists instead expose the three actions in the page header.
    await expect(beneficiaryPage.getByRole('button', { name: 'Create list', exact: true })).toHaveCount(1, { timeout: 30_000 });
    if (await beneficiaries.locator('#beneficiary-list').count()) {
      for (const label of ['Create list', 'Import Excel', 'Add beneficiary']) {
        await expect(beneficiaryActions.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
    } else {
      await expect(beneficiaryActions.getByRole('button', { name: 'Create list', exact: true })).toHaveCount(0);
      for (const label of ['Import Excel', 'Add beneficiary']) {
        await expect(beneficiaryPage.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      }
    }
    await expect(beneficiaryPage.getByRole('button', { name: 'Manage taxpayer authorizations', exact: true })).toHaveCount(0);
    for (const retiredLabel of ['Add single', 'Bulk add']) {
      await expect(beneficiaries.getByRole('button', { name: retiredLabel, exact: true })).toHaveCount(0);
    }
    await expect(beneficiaries.locator('.taxpayer-account-center, .taxpayer-account-panel')).toHaveCount(0);
    await expect(beneficiaries.getByRole('link', { name: 'Sign in with email' })).toHaveCount(0);
    await expect(beneficiaries.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    const beneficiaryOverflow = await beneficiaries.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (beneficiaryOverflow > 2) throw new Error(`Live ${name} Beneficiaries overflow: ${beneficiaryOverflow}px`);
    await beneficiaries.screenshot({ path: 'test-results/live-beneficiaries-' + name + '.png', fullPage: true });
    // On narrow screens the language switcher lives in the visible mobile menu.
    // Desktop keeps it in the header. Exercise the visible control for each layout.
    if (isMobile) {
      await beneficiaries.getByRole('button', { name: 'Open menu' }).click();
      const mobileMenu = beneficiaries.getByRole('dialog', { name: 'Services & menu' });
      await expect(mobileMenu).toBeVisible();
      await mobileMenu.getByRole('button', { name: 'বাংলা' }).click();
    } else {
      await beneficiaries.getByRole('button', { name: 'বাংলা' }).click();
    }
    await expect(beneficiaries).toHaveURL(/action=beneficiaries.*lang=bn/);
    await expect(beneficiaries.getByRole('heading', { name: 'উপকারভোগী', exact: true })).toBeVisible();
    const bengaliActions = beneficiaries.locator('[data-testid="beneficiaries-page"] > header');
    await expect(bengaliActions).toHaveCount(1);
    await expect(beneficiaryPage.getByRole('button', { name: 'তালিকা তৈরি', exact: true })).toHaveCount(1, { timeout: 30_000 });
    if (await beneficiaries.locator('#beneficiary-list').count()) {
      for (const label of ['তালিকা তৈরি', 'এক্সেল আমদানি', 'উপকারভোগী যোগ']) {
        await expect(bengaliActions.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
    } else {
      await expect(bengaliActions.getByRole('button', { name: 'তালিকা তৈরি', exact: true })).toHaveCount(0);
      for (const label of ['এক্সেল আমদানি', 'উপকারভোগী যোগ']) {
        await expect(beneficiaryPage.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      }
    }
    await expect(beneficiaryPage.getByRole('button', { name: 'করদাতার অনুমোদন পরিচালনা', exact: true })).toHaveCount(0);
    for (const retiredLabel of ['একজন যোগ করুন', 'একাধিক যোগ করুন']) {
      await expect(beneficiaries.getByRole('button', { name: retiredLabel, exact: true })).toHaveCount(0);
    }
    if (isMobile) {
      await beneficiaries.getByRole('button', { name: 'English' }).click();
    } else {
      await beneficiaries.getByRole('button', { name: 'EN' }).click();
    }
    await expect(beneficiaries).toHaveURL(/action=beneficiaries/);
    await expect(beneficiaries).not.toHaveURL(/lang=bn/);
    await expect(beneficiaries.getByRole('heading', { name: 'Beneficiaries', exact: true })).toBeVisible();
    await beneficiaries.close();

    // Exercise the *deployed* guest bell without changing hosted payment data.
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
    // Verify on an always-public CitizenNavigation page: public information pages
    // use a separate header, and the notification bell is owned by this shell.
    guestUrl.searchParams.set('action', 'head_catalogue');
    await guest.goto(guestUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // Both responsive layouts must provide the real guest notification bell.
    // Never substitute a direct deep-link for user-visible navigation.
    await expect(guest.locator('.citizen-header')).toBeVisible({ timeout: 15_000 });
    const notificationBell = guest.locator('.citizen-header__notification');
    await expect(notificationBell).toBeVisible();
    await notificationBell.click();
    await expect(guest).toHaveURL(/action=payment_notifications/);
    await expect(guest.getByRole('heading', { name: 'Payment notifications', level: 1 })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Payment record saved', level: 2 })).toBeVisible();
    await expect(guest.getByText('Amount: ৳1,250.50')).toBeVisible();
    await expect(guest.getByText(paymentId, { exact: false })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    await guest.screenshot({ path: `test-results/live-auth-notification-${name}.png`, fullPage: true });
    await guest.close();
  }
  console.log('PASS: private URL auth boundary, guest Beneficiaries EN/BN, and deployed guest bell route with mocked read-only SQL response at desktop/mobile widths');
} finally {
  await browser.close();
}
