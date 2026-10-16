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
    await expect(page).toHaveURL(/action=office_login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Account email address' })).toBeVisible();
    await expect(page.getByText(/Example account access: user1/)).toHaveCount(0);
    await page.close();
  }
  console.log('PASS: live desktop/mobile auth gating, sign-in destination and no synthetic dashboard exposure');
} finally {
  await browser.close();
}
