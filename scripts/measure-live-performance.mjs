import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Post-deploy, read-only, synthetic monitoring. This never signs in or writes
// a payment. Report observed timings separately from unmet targets.
const site = process.env.TAXPAY_LIVE_URL;
if (!site) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(site);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Performance sampling must target the deployed Sohojkor production Pages site');
}

const scenarios = [
  { name: 'desktop-1280', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'mobile-375-synthetic-4g', viewport: { width: 375, height: 812 }, mobile: true },
];
const results = [];
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      isMobile: scenario.mobile,
      hasTouch: scenario.mobile,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const state = { lcp: null, cls: 0, events: [] };
      Object.defineProperty(window, '__sohojkorVitals', { value: state });
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) state.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* Unsupported metric will be UNVERIFIED, not PASS. */ }
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) state.cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch { /* Unavailable observer is reported separately. */ }
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (entry.duration > 0) state.events.push(entry.duration);
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch { /* This is an observed event sample, not field INP. */ }
    });
    if (scenario.mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150,
        downloadThroughput: 200 * 1024,
        uploadThroughput: 100 * 1024,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const url = new URL(base);
    url.searchParams.set('action', 'landing');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.public-hero-carousel').waitFor({ state: 'visible', timeout: 50_000 });
    // Exercise only public image navigation. Do not initiate payments or auth.
    const next = page.locator('.public-hero-carousel__arrow--next');
    if (await next.count()) await next.click({ timeout: 10_000 });
    await page.waitForTimeout(1_250);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const firstPaint = performance.getEntriesByName('first-contentful-paint')[0];
      const state = window.__sohojkorVitals;
      return {
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        firstContentfulPaintMs: firstPaint ? Math.round(firstPaint.startTime) : null,
        largestContentfulPaintMs: Number.isFinite(state?.lcp) ? Math.round(state.lcp) : null,
        cumulativeLayoutShift: Number.isFinite(state?.cls) ? Number(state.cls.toFixed(4)) : null,
        observedMaxEventDurationMs: state?.events?.length ? Math.max(...state.events) : null,
        // A single synthetic carousel click cannot establish field INP.
        fieldInpMs: null,
      };
    });
    const targets = {
      lcp: metrics.largestContentfulPaintMs === null ? 'UNVERIFIED' : metrics.largestContentfulPaintMs <= 2_500 ? 'PASS' : 'FAIL',
      cls: metrics.cumulativeLayoutShift === null ? 'UNVERIFIED' : metrics.cumulativeLayoutShift <= 0.1 ? 'PASS' : 'FAIL',
      inp: 'UNVERIFIED',
    };
    const result = { scenario: scenario.name, simulatedNetwork: scenario.mobile ? '150ms RTT / 200KiB/s / 4x CPU' : 'runner network and CPU', ...metrics, targets };
    console.log('SOHOJKOR_PRODUCTION_PERFORMANCE ' + JSON.stringify(result));
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile('test-results/sohojkor-live-performance.json', JSON.stringify({
  measuredAt: new Date().toISOString(),
  url: base.toString(),
  methodology: 'Read-only synthetic Chromium in a GitHub runner; not Bangladesh field RUM. LCP/CLS observer samples; INP not certified.',
  results,
}, null, 2) + '\n');
console.log('PASS: produced reproducible synthetic production performance evidence; missing or failed field targets are not misreported as passing');
