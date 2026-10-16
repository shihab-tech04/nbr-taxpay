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
    const dialog = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'User ID' })).toBeVisible();
    await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type','password');
    await dialog.getByRole('textbox', { name: 'User ID' }).fill('user1');
    await dialog.getByLabel('Password', { exact: true }).fill('user1');
    await dialog.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
    await expect(page).not.toHaveURL(/demoUser=/);
    await page.close();
  }
  console.log('PASS: fresh private URLs gated; desktop/mobile TaxPay popup enters the isolated user1 profile');
} finally {
  await browser.close();
}
