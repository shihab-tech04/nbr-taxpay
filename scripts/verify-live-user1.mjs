import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Public smoke test must target the approved TaxPay GitHub Pages URL');
}

const destination = new URL(base.toString());
destination.searchParams.set('action', 'taxpayer_home');
destination.searchParams.set('demoUser', 'user1');
destination.searchParams.set('release', (process.env.GITHUB_SHA || '').slice(0, 8));
await mkdir('test-results', {recursive:true});

const browser = await chromium.launch({headless:true});
try {
  const desktop = await browser.newPage({viewport:{width:1280,height:850}});
  await desktop.goto(destination.toString(), {waitUntil:'domcontentloaded',timeout:45000});
  const workspace = desktop.getByTestId('user1-synthetic-workspace');
  await expect(workspace).toBeVisible({timeout:30000});
  await expect(desktop.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(desktop.getByText('৳ 180,000').first()).toBeVisible();
  await expect(desktop.getByText('৳ 80,000').first()).toBeVisible();
  await expect(desktop.getByText('৳ 75,000').first()).toBeVisible();
  await expect(desktop.getByText('৳ 25,000').first()).toBeVisible();
  await expect(workspace).toHaveAttribute('data-dashboard-view','true');
  await desktop.screenshot({path:'test-results/live-user1-desktop.png',fullPage:true});
  await desktop.getByRole('button',{name:'Open transaction history'}).click();
  await expect(desktop.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(desktop.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
  await desktop.getByRole('button',{name:'Ledger',exact:true}).click();
  await expect(desktop.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(desktop.getByText('৳ 25,000').first()).toBeVisible();

  const mobile = await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  await mobile.goto(destination.toString(),{waitUntil:'domcontentloaded',timeout:45000});
  await expect(mobile.getByTestId('user1-synthetic-workspace')).toBeVisible({timeout:30000});
  await expect(mobile.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error('Live user1 mobile page overflows by '+overflow+' pixels');
  await mobile.screenshot({path:'test-results/live-user1-mobile.png',fullPage:true});
  console.log('PASS: LIVE user1 desktop dashboard, sample figures, transactions, ledger and mobile responsive browser verification:',destination.toString());
} finally {
  await browser.close();
}
