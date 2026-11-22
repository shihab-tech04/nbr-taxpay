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
  let remarksRequests = 0;
  let missingBearer = false;
  let missingRemarksBearer = false;
  let wrongRemarksPaymentId = false;
  let failFirstRemarksRead = true;
  let routeError = null;
  const remarksRouteResults = [];
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
  await page.route('https://ihbtabrvmyiwikqqbhrf.supabase.co/rest/v1/rpc/payment_v1_office_guarded_challan_remarks', async (route) => {
    try {
      const request = route.request();
      const requestHeaders = request.headers();
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': requestHeaders['access-control-request-headers'] ||
          'authorization, apikey, content-type, x-client-info, prefer',
      };
      if (request.method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers: corsHeaders });
      const authorization = requestHeaders.authorization;
      const body = request.postDataJSON();
      if (!authorization || !authorization.startsWith('Bearer ')) {
        missingRemarksBearer = true;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Verified Office officer required' }) });
      }
      if (body?.p_payment_id !== payment.id) {
        wrongRemarksPaymentId = true;
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Payment identity mismatch' }) });
      }
      remarksRequests++;
      if (failFirstRemarksRead) {
        failFirstRemarksRead = false;
        remarksRouteResults.push({ attempt: remarksRequests, status: 503 });
        return route.fulfill({ status: 503, headers: corsHeaders, contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary Office SQL read outage' }) });
      }
      const response = {
        paymentId: fixture.expected.id,
        challanRemarks: fixture.expected.challanRemarks,
        receiptReference: fixture.expected.receiptReference,
      };
      const remarksType = typeof response.challanRemarks;
      remarksRouteResults.push({ attempt: remarksRequests, status: 200, keys: Object.keys(response),
        remarksType,
        remarksCodePoints: remarksType === 'string' ? Array.from(response.challanRemarks).length : null });
      if (remarksType !== 'string')
        throw new TypeError('Paired Office UI fixture must supply exact remarks text as a string');
      return route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    } catch (error) {
      routeError = error instanceof Error ? error.message : String(error);
      return route.abort();
    }
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error).slice(0, 450)));
  await page.goto(baseUrl + '/payments/transactions');
  const screen = page.locator('[data-testid="payment-transactions"]');
  try {
    await screen.waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    // Diagnostic only: retain the mandatory screen assertion without bypassing it.
    // Never log bearer tokens, storage, request headers, fixture TINs or account data.
    const snapshot = await page.evaluate(() => ({
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1,h2')).slice(0,6).map(x => x.textContent?.trim().slice(0,100)),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).slice(0,4).map(x => x.textContent?.trim().slice(0,100)),
      testids: Array.from(document.querySelectorAll('[data-testid]')).slice(0,15).map(x => x.getAttribute('data-testid')),
      visibleText: document.body?.innerText?.slice(0,700),
    })).catch(() => ({ unavailable: true }));
    console.error('Office UI route diagnostic:', JSON.stringify({
      path: new URL(page.url()).pathname,
      paymentRequests,
      missingBearer,
      routeError: Boolean(routeError),
      pageErrors: pageErrors.slice(0,5),
      snapshot,
    }));
    throw error;
  }
  assert.ok(paymentRequests > 0, 'Office UI must request the existing authorized payments endpoint');
  assert.equal(missingBearer, false);
  assert.equal(routeError, null, routeError || undefined);
  await page.getByRole('button', { name: 'View Details' }).first().click();
  const drawer = page.locator('.dynamic-drawer:visible');
  await drawer.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await drawer.count(), 1, 'Office details must have one visible transaction drawer');
  const guardedRemarksControl = drawer.locator('[data-testid="office-guarded-challan-remarks"]');
  try {
    await guardedRemarksControl.getByRole('alert').waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    const snapshot = await guardedRemarksControl.evaluate(node => ({
      text: node.textContent?.trim().slice(0, 180) ?? null,
      alertCount: node.querySelectorAll('[role="alert"]').length,
      retryButtonCount: node.querySelectorAll('button').length,
    })).catch(() => ({ unavailable: true }));
    console.error('Office remarks retry diagnostic:', JSON.stringify({
      paymentRequests,
      remarksRequests,
      missingBearer,
      missingRemarksBearer,
      wrongRemarksPaymentId,
      routeError: routeError ? String(routeError).slice(0, 180) : null,
      pageErrorCount: pageErrors.length,
      snapshot,
    }));
    throw error;
  }
  const requestsBeforeRetry = remarksRequests;
  assert.deepEqual(remarksRouteResults.map(result => result.status), [503],
    'The first authorized Office SQL read must fail before retry');
  const remarksRetryButton = guardedRemarksControl.getByRole('button', { name: 'Retry', exact: true });
  assert.equal(await remarksRetryButton.count(), 1,
    'Office must expose a retry after the authorized SQL read fails');
  await remarksRetryButton.click();
  try {
    const visibleRemarksText = guardedRemarksControl.locator('span');
    await visibleRemarksText.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await visibleRemarksText.textContent(), fixture.expected.challanRemarks,
      'Visible Office drawer must render the exact guarded SQL remarks after retry');
  } catch (error) {
    const visibleState = await guardedRemarksControl.evaluate(node => ({
      text: node.textContent?.trim().slice(0, 180) ?? null,
      alert: node.querySelector('[role="alert"]')?.textContent?.trim().slice(0, 120) ?? null,
      spans: Array.from(node.querySelectorAll('span')).map(span => span.textContent?.trim().slice(0, 100)),
    })).catch(() => ({ unavailable: true }));
    console.error('Office visible remarks retry diagnostic:', JSON.stringify({
      requestsBeforeRetry, remarksRequests, remarksRouteResults,
      missingRemarksBearer, wrongRemarksPaymentId, routeError: Boolean(routeError),
      routeErrorMessage: routeError ? String(routeError).slice(0, 180) : null,
      visibleDrawerCount: await drawer.count(), visibleState,
    }));
    throw error;
  }
  assert.equal(remarksRequests, requestsBeforeRetry + 1,
    'Office retry must issue exactly one fresh officer-guarded SQL read');
  assert.deepEqual(remarksRouteResults.map(result => result.status), [503, 200],
    'Office must recover from the failed guarded SQL read without reusing its error result');
  const drawerText = await drawer.innerText();
  // The same drawer must work for both the original fixed SQL fixture and
  // a current Work A browser-generated payment. Never assert that a real
  // browser's selected 68A/68B source heads are the older 121/145 fixture.
  const sourceAllocations = payment.details.allocations;
  const sourceLines = payment.details.lines;
  assert.equal(sourceAllocations.length, 2, 'Both original allocations must survive Office readback');
  assert.ok(Array.isArray(sourceLines) && sourceLines.length === sourceAllocations.length,
    'Immutable source receipt lines must correspond one-to-one with allocations');
  assert.deepEqual(sourceAllocations.map(item => item.allocationId), fixture.expected.allocationIds);
  assert.deepEqual(sourceAllocations.map(item => item.taxpayerTin), fixture.expected.allocationTins);
  assert.deepEqual(sourceAllocations.map(item => item.headId), fixture.expected.headIds);
  assert.deepEqual(sourceAllocations.map(item => item.assessmentYear), fixture.expected.assessmentYears);
  assert.deepEqual(sourceAllocations.map(item => item.amountMinor), fixture.expected.amountsMinor);
  assert.equal(sourceAllocations.reduce((sum, item) => sum + item.amountMinor, 0),
    payment.amountMinor, 'Original allocations must reconcile to parent in minor units');
  const expectedAllocations = sourceAllocations.map((allocation, index) => {
    const line = sourceLines[index];
    assert.equal(line?.headId, allocation.headId, 'Head ID must match source line at allocation index ' + index);
    assert.ok(typeof line?.headNameEn === 'string' && line.headNameEn.trim(),
      'Source line must carry the authentic display name for head ' + allocation.headId);
    assert.ok(typeof allocation.taxpayerName === 'string' && allocation.taxpayerName.trim());
    assert.match(allocation.taxpayerTin, /^\d{12,13}$/);
    return {
      name: allocation.taxpayerName,
      tin: allocation.taxpayerTin,
      head: line.headNameEn.trim(),
      year: allocation.assessmentYear,
      minor: allocation.amountMinor,
    };
  });
  for (const value of [
    payment.id, fixture.expected.payerId, 'Payment record saved',
    'SIMULATED SUCCESS', fixture.expected.receiptReference,
    payment.certificateReference,
    ...expectedAllocations.flatMap(item => [item.name, item.tin, item.head, item.year]),
  ]) {
    assert.ok(drawerText.includes(value),
      'Office drawer must render original source-backed field: ' + value);
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
    const guardedRemarks = visibleDrawer.locator('[data-testid="office-guarded-challan-remarks"]');
    await guardedRemarks.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(({ selector, expected }) =>
      document.querySelector(selector)?.querySelector('span')?.textContent === expected,
    { selector: '.dynamic-drawer [data-testid="office-guarded-challan-remarks"]',
      expected: fixture.expected.challanRemarks }, { timeout: 10000 });
    assert.equal(await guardedRemarks.locator('span').textContent(), fixture.expected.challanRemarks,
      language + ' Office drawer must render the exact officer-guarded multilingual remarks, including line breaks');
    const remarksField = visibleDrawer.locator('.drawer-field:has([data-testid="office-guarded-challan-remarks"])');
    assert.equal(await remarksField.locator('.drawer-field__label').innerText(),
      language === 'bn' ? 'চালানের মন্তব্য' : 'Challan remarks',
      language + ' Office remarks label must follow the selected language');
    const rows = visibleDrawer.locator('.office-shared-allocation-list__item');
    assert.equal(await rows.count(), expectedAllocations.length,
      language + ' drawer must render exactly two source-backed allocation lines');
    // :has() is relative to each field; a drawer-rooted Playwright has-locator
    // cannot match descendants when its selector also includes the parent drawer.
    const field = visibleDrawer.locator('.drawer-field:has(.office-shared-allocation-list__item)');
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
  const priorRemarksRequests = remarksRequests;
  await page.evaluate(() => sessionStorage.setItem('ws3_office_test_language', 'bn'));
  const bengaliReadback = page.waitForResponse(response =>
    response.url().includes('/functions/v1/demo-story1-office/payments') && response.status() === 200);
  await page.reload();
  await bengaliReadback;
  await screen.waitFor({ state: 'visible', timeout: 30000 });
  assert.ok(paymentRequests > priorRequests, 'Bengali refresh must re-read the authorized Office endpoint');
  assert.equal(missingBearer, false);
  assert.equal(missingRemarksBearer, false);
  assert.equal(wrongRemarksPaymentId, false);
  assert.equal(routeError, null, routeError || undefined);
  // Refresh closes the details drawer. Reopen the same payment in BN, then
  // require a new guarded SQL RPC instead of expecting a closed drawer to poll.
  await page.locator('.payment-module__table-card .card-table__action-btn').first().click();
  await verifyVisibleAllocations('bn');
  assert.ok(remarksRequests > priorRemarksRequests,
    'Reopening after Bengali refresh must re-read remarks through the separate officer-guarded SQL RPC');
  console.log('PASS Office #270 UI readback EN/BN refresh and error/retry: paired parent ' + payment.id +
    ', exact officer-guarded BN/EN multiline remarks, two individually verified immutable allocations, payer, beneficiaries, heads/years/exact amounts, original receipt/certificate references and authorized Office readback');
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
