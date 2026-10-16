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
    url.searchParams.set('action', 'taxpayer_home');
    url.searchParams.set('demoUser', 'user1');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 2) throw new Error(`Live ${name} private-entry overflow: ${overflow}px`);
    await page.screenshot({ path: `test-results/live-auth-${name}.png`, fullPage: true });
    await page.locator('.citizen-account-gate').getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/action=taxpayer_login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Account email address' })).toBeVisible();
    await expect(page.getByText(/Example account access: user1/)).toHaveCount(0);

    // Replay the public guest journey on the actual deployment. This action
    // only prepares a local unsent preview; no gateway or Treasury API is called.
    await page.goto(base.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const payment = page.getByRole('dialog', { name: 'Pay Tax' });
    await payment.getByRole('button', { name: /Advance Tax/ }).click();
    await payment.getByRole('button', { name: /Continue/ }).click();
    await payment.locator('#guest-tin').fill('123456789012');
    await payment.locator('#guest-phone').fill('01712345678');
    await payment.locator('#guest-tax-amount').fill('12500');
    await payment.getByRole('button', { name: 'Continue to Review & Pay' }).click();
    await expect(payment.getByTestId('payment-review')).toBeVisible();
    await payment.getByRole('button', { name: 'Online method preview' }).click();
    await payment.getByRole('radio', { name: 'bKash' }).check();
    await payment.getByRole('checkbox', { name: /I checked the TIN/ }).check();
    await payment.getByRole('button', { name: 'Prepare payment preview' }).click();
    await expect(payment.getByRole('heading', { name: 'Payment preview prepared' })).toBeVisible({ timeout: 12_000 });
    await expect(payment.getByTestId('payment-lifecycle').getByText('SIMULATION_NOT_SENT', { exact: true })).toBeVisible();
    await expect(payment.getByText(/PREVIEW-\d{4}-PAY-/)).toBeVisible();
    for (const forbidden of ['AUTHORIZED', 'ACS_REFERENCE_CREATED', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED']) {
      await expect(payment.getByTestId('payment-lifecycle').getByText(forbidden, { exact: true })).toHaveCount(0);
    }
    await page.screenshot({ path: `test-results/live-guest-${name}.png`, fullPage: true });
    await page.close();
  }
  console.log('PASS: live desktop/mobile auth gate and guest preview; no synthetic account access or payment sent');
} finally {
  await browser.close();
}
