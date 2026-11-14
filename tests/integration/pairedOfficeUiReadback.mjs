import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { chromium } from '@playwright/test';
import { transformSync } from 'esbuild';

const officeRoot = process.env.WS3_OFFICE_SOURCE;
const fixturePath = process.env.WS3_OFFICE_UI_FIXTURE_OUT;
assert.ok(officeRoot && fixturePath, 'Exact Office #270 source and paired API fixture are required');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const payment = fixture.payment;
assert.ok(payment?.id && payment.details?.allocations?.length === 2);
assert.equal(payment.id, fixture.expected.id);
assert.equal(payment.status, fixture.expected.status);
assert.equal(payment.certificateReference, 'SK-PC-' + payment.id);
assert.deepEqual(payment.details.allocations.map((item) => item.allocationId), fixture.expected.allocationIds);

const helperPath = resolve(officeRoot, 'qa/isolated-office-officer.ts');
const helperSource = readFileSync(helperPath, 'utf8');
const helperCode = transformSync(helperSource, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
const helperModule = { exports: {} };
vm.runInNewContext(helperCode, {
  module: helperModule,
  exports: helperModule.exports,
  Buffer,
  JSON,
}, { timeout: 5000 });
const installIsolatedOfficeOfficer = helperModule.exports.installIsolatedOfficeOfficer;
assert.equal(typeof installIsolatedOfficeOfficer, 'function', 'Reuse the existing Office QA officer fixture');

const baseUrl = 'http://127.0.0.1:3000';
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
  cwd: officeRoot,
  env: { ...process.env, VITE_OFFICE_PUBLIC_UI_ONLY: 'false', VITE_TAXPAY_REVIEW_DISABLED: 'false' },
  stdio: 'ignore',
});
let browser;
try {
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Office #270 Vite server exited before readiness');
    try {
      const response = await fetch(baseUrl + '/payments/transactions');
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  assert.ok(ready, 'Existing Office #270 UI did not become ready');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let paymentRequests = 0;
  let missingBearer = false;
  let routeError = null;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
  await installIsolatedOfficeOfficer(page);
  // Fix the language explicitly, rather than inheriting the runner's
  // i18next setting. The same authenticated officer checks EN and BN.
  await page.addInitScript(() => {
    const language = sessionStorage.getItem('ws3_office_test_language') === 'bn' ? 'bn' : 'en';
    sessionStorage.setItem('office_ui_entered', 'admin');
    localStorage.setItem('gov_ui_settings', JSON.stringify({
      assessmentYear: '2027-28',
      themeId: 'indigo-blue',
      fontId: 'inter',
      fontSizeId: 'standard',
      languageId: language,
    }));
    localStorage.setItem('i18nextLng', language);
  });
  await page.route('https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office/**', async (route) => {
    try {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/payments')) {
        const authorization = route.request().headers().authorization;
        if (!authorization || !authorization.startsWith('Bearer ')) {
          missingBearer = true;
          return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
        }
        paymentRequests++;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [payment], total: 1, page: 1, perPage: 100 },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    } catch (error) {
      routeError = error instanceof Error ? error.message : String(error);
      return route.abort();
    }
  });

  await page.goto(baseUrl + '/payments/transactions');
  const screen = page.locator('[data-testid="payment-transactions"]');
  await screen.waitFor({ state: 'visible', timeout: 30000 });
  assert.ok(paymentRequests > 0, 'Office UI must request the existing authorized payments endpoint');
  assert.equal(missingBearer, false);
  assert.equal(routeError, null, routeError || undefined);
  await page.getByRole('button', { name: 'View Details' }).first().click();
  const drawer = page.locator('.dynamic-drawer');
  await drawer.waitFor({ state: 'visible', timeout: 10000 });
  const drawerText = await drawer.innerText();
  const expectedValues = [
    payment.id,
    'user1',
    '222222222222',
    'WS3 recipient 2',
    'Advance Tax',
    '2026-27',
    '৳15.00',
    '333333333333',
    'WS3 recipient 3',
    'Tax on notice of demand',
    '2025-26',
    '৳35.00',
    'Payment record saved',
    'SIMULATED SUCCESS',
    fixture.expected.receiptReference,
    payment.certificateReference,
  ];
  for (const value of expectedValues) {
    assert.ok(drawerText.includes(value), 'Office drawer must render paired field: ' + value);
  }
  // Office may render the parent with or without trailing .00;
  // allocation lines display two decimals. Both represent the same paisa.
  // Verify the parent value numerically instead of imposing one UI format.
  const renderedAmountMinor = [...drawerText.matchAll(/৳\s*([0-9][0-9,]*)(?:\.([0-9]{1,2}))?(?![0-9,.])/g)]
    .map(([, whole, fraction = '']) =>
      Number(whole.replaceAll(',', '')) * 100 + Number(fraction.padEnd(2, '0')));
  assert.ok(renderedAmountMinor.includes(payment.amountMinor),
    'Office drawer must render the exact paired parent amount in paisa');
  // Prove the allocation field itself is present, not merely a collection of
  // matching strings elsewhere in the drawer. Each beneficiary must retain
  // their own immutable head, assessment year and amount in both languages.
  const expectedAllocations = [
    { name: 'WS3 recipient 2', tin: '222222222222', head: 'Advance Tax', year: '2026-27', minor: 1500 },
    { name: 'WS3 recipient 3', tin: '333333333333', head: 'Tax on notice of demand', year: '2025-26', minor: 3500 },
  ];
  const normalizeDigits = (value) => value.replace(/[০-৯]/g,
    digit => String(digit.charCodeAt(0) - 0x09e6));
  const parseAmountMinor = (value) => {
    const match = /^৳\s*([0-9][0-9,]*)(?:\.([0-9]{1,2}))?$/.exec(normalizeDigits(value.trim()));
    assert.ok(match, 'Allocation must display a valid localized taka amount: ' + value);
    return Number(match[1].replaceAll(',', '')) * 100 +
      Number((match[2] ?? '').padEnd(2, '0'));
  };
  const verifyVisibleAllocations = async (language) => {
    const visibleDrawer = page.locator('.dynamic-drawer');
    await visibleDrawer.waitFor({ state: 'visible', timeout: 10000 });
    const rows = visibleDrawer.locator('.office-shared-allocation-list__item');
    assert.equal(await rows.count(), expectedAllocations.length,
      language + ' drawer must render exactly two source-backed allocation lines');
    const field = visibleDrawer.locator('.drawer-field').filter({ has: rows.first() });
    assert.equal(await field.count(), 1, 'Allocation breakdown must use the approved shared drawer field');
    const expectedLabel = language === 'bn' ? 'করদাতা অনুযায়ী বণ্টন' : 'Taxpayer allocations';
    assert.equal((await field.locator('.drawer-field__label').innerText()).trim(), expectedLabel,
      'Allocation label must resolve in the selected Office language');
    for (const [index, expected] of expectedAllocations.entries()) {
      const row = rows.nth(index);
      const text = await row.innerText();
      for (const value of [expected.name, expected.tin, expected.head, expected.year])
        assert.ok(text.includes(value), language + ' allocation ' + (index + 1) + ' missing ' + value);
      const amounts = row.locator('strong');
      assert.equal(await amounts.count(), 2, 'Each allocation must show a party and one amount');
      assert.equal(parseAmountMinor(await amounts.nth(1).innerText()), expected.minor,
        language + ' allocation must retain exact immutable source paisa');
    }
    const text = normalizeDigits(await visibleDrawer.innerText());
    assert.ok([...text.matchAll(/৳\s*([0-9][0-9,]*)(?:\.([0-9]{1,2}))?(?![0-9,.])/g)]
      .some(([, whole, fraction = '']) =>
        Number(whole.replaceAll(',', '')) * 100 + Number(fraction.padEnd(2, '0')) === payment.amountMinor),
    language + ' drawer must retain the exact payment parent total');
    for (const value of [payment.id, fixture.expected.receiptReference, payment.certificateReference])
      assert.ok(text.includes(value), language + ' drawer must retain source-backed reference ' + value);
  };
  await verifyVisibleAllocations('en');
  const priorRequests = paymentRequests;
  await page.evaluate(() => sessionStorage.setItem('ws3_office_test_language', 'bn'));
  await page.reload();
  await screen.waitFor({ state: 'visible', timeout: 30000 });
  assert.ok(paymentRequests > priorRequests, 'Bengali refresh must re-read the authorized Office endpoint');
  assert.equal(missingBearer, false);
  assert.equal(routeError, null, routeError || undefined);
  await page.locator('.payment-module__table-card .card-table__action-btn').first().click();
  await verifyVisibleAllocations('bn');
  console.log('PASS Office #270 UI readback EN/BN refresh: paired parent ' + payment.id +
    ', two individually verified immutable allocations, payer, beneficiaries, heads/years/exact amounts, original receipt/certificate references and authorized Office readback');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolvePromise) => {
      const timeout = setTimeout(resolvePromise, 10000);
      server.once('exit', () => { clearTimeout(timeout); resolvePromise(); });
    });
  }
}
