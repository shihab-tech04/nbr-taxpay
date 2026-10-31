import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const capabilityKey = 'korbritto.guest-beneficiaries.capability.v1';
const initializedKey = 'korbritto.guest-beneficiaries.initialized.v1';
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const isPaymentMutationUrl = (rawUrl: string) => {
  const pathname = new URL(rawUrl).pathname;
  return /\/(?:payments?|gateways?|challans?|intents?|slips?|checkouts?|transactions?|payment-requests?)(?:\/|$)/i.test(pathname)
    || /(?:payment|gateway|challan|intent|slip|checkout|transaction)[-_]?submit/i.test(pathname);
};

test('live hosted guest Beneficiaries CRUD, import, isolation, and non-submitted payment allocation', async ({ browser, request }) => {
  const liveUrl = process.env.TAXPAY_HOSTED_BENEFICIARIES_URL;
  const manifestPath = process.env.TAXPAY_HOSTED_BENEFICIARIES_MANIFEST;
  if (!liveUrl || !manifestPath) throw new Error('Hosted URL and cleanup manifest path are required.');
  const target = new URL(liveUrl);
  if (target.protocol !== 'https:' || target.hostname !== 'shihab-tech04.github.io' || target.pathname !== '/nbr-taxpay/') {
    throw new Error('Refusing hosted acceptance outside the exact TaxPay GitHub Pages deployment.');
  }

  const capabilities = [randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url')];
  const hashes = capabilities.map(sha256);
  const runId = process.env.GITHUB_RUN_ID ?? `manual-${Date.now()}`;
  const manifest = {
    schemaVersion: 1,
    target: target.href,
    runId,
    generatedAt: new Date().toISOString(),
    capabilitySha256: hashes,
  };
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  // The capability values themselves are never logged or written to the manifest.
  for (const hash of hashes) console.log(`HOSTED_ACCEPTANCE_CLEANUP_SHA256=${hash}`);

  const prefix = `Hosted QA ${runId.slice(-8)}`;
  const familyList = `${prefix} Family`;
  const workList = `${prefix} Work`;
  const isolationList = `${prefix} Isolated`;
  const recordedActions: string[] = [];
  const ownerTableRequests: string[] = [];
  const paymentRequests: string[] = [];
  let supabaseApiOrigin = '';
  let publishableKey = '';
  let primaryBeneficiaryId = '';

  const observeRequest = (request: import('@playwright/test').Request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/taxpay-guest-beneficiaries') && request.method() === 'POST') {
      try {
        const action = (request.postDataJSON() as { action?: unknown } | null)?.action;
        if (typeof action === 'string') recordedActions.push(action);
      } catch { /* Do not capture request bodies or capability values in test output. */ }
      supabaseApiOrigin = url.origin;
      publishableKey ||= request.headers()['apikey'] ?? '';
    }
    if (/\/rest\/v1\/taxpay_beneficiary_(lists|beneficiaries)(?:\?|$)/.test(url.pathname + url.search)) {
      ownerTableRequests.push(url.pathname);
    }
    if (isPaymentMutationUrl(request.url())) paymentRequests.push(url.pathname);
  };

  const createContext = async (capability: string) => {
    const context = await browser.newContext({
      baseURL: target.href,
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    await context.route('**/*', async route => {
      const requestUrl = route.request().url();
      if (isPaymentMutationUrl(requestUrl)) {
        paymentRequests.push(new URL(requestUrl).pathname);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    await context.addInitScript(({ value, key, initialized }) => {
      const savedCapability = localStorage.getItem(key);
      if (savedCapability === null) {
        // Seed a blank browser context once; keep the successful registration marker on reload.
        localStorage.setItem(key, value);
        localStorage.removeItem(initialized);
      } else if (savedCapability !== value) {
        throw new Error('Test browser context already contains a different guest capability.');
      }
      const nativeFetch = window.fetch.bind(window);
      let capabilityChecked = false;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        let body: { action?: unknown } | null = null;
        try {
          if (typeof init?.body === 'string') body = JSON.parse(init.body);
        } catch { /* Leave malformed requests to the original fetch implementation. */ }
        if (!capabilityChecked && requestUrl.endsWith('/functions/v1/taxpay-guest-beneficiaries') && method === 'POST' && body?.action === 'open') {
          const probe = await nativeFetch(input, { ...init, body: JSON.stringify({ action: 'lists' }) });
          const probeBody = await probe.clone().json().catch(() => null) as { code?: unknown } | null;
          if (probe.status !== 410 || probeBody?.code !== 'GUEST_SESSION_UNAVAILABLE') {
            throw new Error('Refusing to open a capability that did not fail its exact-session preflight.');
          }
          capabilityChecked = true;
        }
        return nativeFetch(input, init);
      };
    }, { value: capability, key: capabilityKey, initialized: initializedKey });
    return context;
  };

  const firstContext = await createContext(capabilities[0]);
  const secondContext = await createContext(capabilities[1]);
  try {
    const page = await firstContext.newPage();
    page.on('request', observeRequest);
    page.on('response', async response => {
      const req = response.request();
      const url = new URL(response.url());
      if (url.pathname.endsWith('/functions/v1/taxpay-guest-beneficiaries') && req.method() === 'POST') {
        try {
          if ((req.postDataJSON() as { action?: unknown } | null)?.action !== 'people') return;
          const payload = await response.json() as { data?: Array<{ id?: unknown; tin?: unknown }> };
          const first = payload.data?.find(row => row.tin === '012345678901');
          if (typeof first?.id === 'string') primaryBeneficiaryId = first.id;
        } catch { /* Keep response bodies and capability values out of logs and artifacts. */ }
      }
    });

    await page.goto('?action=beneficiaries', { waitUntil: 'domcontentloaded' });
    const pageRoot = page.getByTestId('beneficiaries-page');
    const pageRows = pageRoot.locator('ul li');
    await expect(pageRoot).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create your first list' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in with email' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manage taxpayer authorizations' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Create list', exact: true }).first().click();
    let listDialog = page.getByRole('dialog', { name: 'Create list' });
    await listDialog.locator('#beneficiary-create-list-name').fill(familyList);
    await listDialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(page.getByText(new RegExp(`${familyList}.*is empty`))).toBeVisible();

    await page.getByRole('button', { name: 'Create list', exact: true }).first().click();
    listDialog = page.getByRole('dialog', { name: 'Create list' });
    await listDialog.locator('#beneficiary-create-list-name').fill(workList);
    await listDialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(page.getByText(new RegExp(`${workList}.*is empty`))).toBeVisible();
    await page.locator('#beneficiary-list').selectOption({ label: familyList });

    await page.getByRole('button', { name: 'Add beneficiary', exact: true }).first().click();
    let entryDialog = page.getByRole('dialog', { name: 'Beneficiary entry' });
    await entryDialog.locator('#beneficiary-tin').fill('012345678901');
    await entryDialog.locator('#beneficiary-name').fill('Hosted Synthetic Alpha');
    await entryDialog.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    await expect(pageRows.getByText('Hosted Synthetic Alpha', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Beneficiary saved.')).toBeVisible();

    await page.reload();
    await expect(pageRows.getByText('Hosted Synthetic Alpha', { exact: true })).toHaveCount(1);
    await expect(page.locator('#beneficiary-list')).toContainText(familyList);

    await page.getByRole('button', { name: 'Import Excel', exact: true }).first().click();
    const workbook = readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64', 'utf8').trim();
    await page.locator('#beneficiary-file').setInputFiles({
      name: 'hosted-synthetic-beneficiaries.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(workbook, 'base64'),
    });
    entryDialog = page.getByRole('dialog', { name: 'Beneficiary entry' });
    await entryDialog.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(entryDialog.getByText('Already saved in this list.')).toBeVisible();
    await entryDialog.getByRole('button', { name: 'Next', exact: true }).click();
    await entryDialog.getByRole('button', { name: 'Finish import' }).click();
    await expect(page.getByText('1 beneficiaries added to the list.')).toBeVisible();
    await expect(pageRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(1);

    // A separate browser context has its own capability and must not see the first guest's data.
    const isolated = await secondContext.newPage();
    isolated.on('request', observeRequest);
    await isolated.goto('?action=beneficiaries', { waitUntil: 'domcontentloaded' });
    const isolatedRoot = isolated.getByTestId('beneficiaries-page');
    const isolatedRows = isolatedRoot.locator('ul li');
    await expect(isolated.getByRole('heading', { name: 'Create your first list' })).toBeVisible();
    await expect(isolatedRows.getByText('Hosted Synthetic Alpha', { exact: true })).toHaveCount(0);
    await expect(isolatedRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(0);
    await expect(isolatedRoot.getByText(familyList, { exact: true })).toHaveCount(0);

    await isolated.getByRole('button', { name: 'Create list', exact: true }).first().click();
    const isolatedListDialog = isolated.getByRole('dialog', { name: 'Create list' });
    await isolatedListDialog.locator('#beneficiary-create-list-name').fill(isolationList);
    await isolatedListDialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(isolated.getByText(new RegExp(`${isolationList}.*is empty`))).toBeVisible();
    await isolated.getByRole('button', { name: 'Add beneficiary', exact: true }).first().click();
    const isolatedEntry = isolated.getByRole('dialog', { name: 'Beneficiary entry' });
    await isolatedEntry.locator('#beneficiary-tin').fill('000000123456');
    await isolatedEntry.locator('#beneficiary-name').fill('Hosted Synthetic Isolated');
    await isolatedEntry.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    await expect(isolatedRows.getByText('Hosted Synthetic Isolated', { exact: true })).toHaveCount(1);

    // A second capability cannot edit or remove the first guest's exact row ID.
    await expect.poll(() => primaryBeneficiaryId).toMatch(/^[0-9a-f-]{36}$/i);
    const updateFromOtherGuest = await request.post(`${supabaseApiOrigin}/functions/v1/taxpay-guest-beneficiaries`, {
      headers: {
        apikey: publishableKey,
        Origin: target.origin,
        'x-taxpay-guest-capability': capabilities[1],
      },
      data: { action: 'update', id: primaryBeneficiaryId, name: 'Unauthorised cross-guest edit' },
    });
    expect(updateFromOtherGuest.status()).toBe(404);
    const removeFromOtherGuest = await request.post(`${supabaseApiOrigin}/functions/v1/taxpay-guest-beneficiaries`, {
      headers: {
        apikey: publishableKey,
        Origin: target.origin,
        'x-taxpay-guest-capability': capabilities[1],
      },
      data: { action: 'remove', id: primaryBeneficiaryId },
    });
    // The remove RPC is intentionally idempotent for an ID outside the capability.
    expect(removeFromOtherGuest.status()).toBe(200);

    // The first guest must remain unchanged after the second guest's write and denied cross-guest edit/remove.
    await page.reload();
    await expect(pageRows.getByText('Hosted Synthetic Alpha', { exact: true })).toHaveCount(1);
    await expect(pageRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(1);
    await expect(pageRows.getByText('Hosted Synthetic Isolated', { exact: true })).toHaveCount(0);
    await expect(page.getByText(isolationList, { exact: true })).toHaveCount(0);
    await expect(pageRows.getByText('Unauthorised cross-guest edit', { exact: true })).toHaveCount(0);

    const savedRows = pageRows;
    const firstTinRow = savedRows.filter({ has: page.getByText('012345678901', { exact: true }) });
    const secondTinRow = savedRows.filter({ has: page.getByText('987654321098', { exact: true }) });
    await expect(firstTinRow).toHaveCount(1);
    await expect(secondTinRow).toHaveCount(1);
    await expect(firstTinRow.getByText('012345678901', { exact: true })).toHaveCount(1);
    await expect(secondTinRow.getByText('987654321098', { exact: true })).toHaveCount(1);
    const sourceRowMatches = {
      firstHasExpectedName: await firstTinRow.getByText('Hosted Synthetic Alpha', { exact: true }).count() === 1,
      firstHasOtherName: await firstTinRow.getByText('Local Beneficiary Two', { exact: true }).count() > 0,
      secondHasExpectedName: await secondTinRow.getByText('Local Beneficiary Two', { exact: true }).count() === 1,
      secondHasOtherName: await secondTinRow.getByText('Hosted Synthetic Alpha', { exact: true }).count() > 0,
    };
    console.log('HOSTED_ACCEPTANCE_PREFILL_ROW_MATCHES=' + JSON.stringify(sourceRowMatches));
    expect(sourceRowMatches).toEqual({
      firstHasExpectedName: true,
      firstHasOtherName: false,
      secondHasExpectedName: true,
      secondHasOtherName: false,
    });
    const firstRow = firstTinRow;
    const secondRow = secondTinRow;
    await firstRow.getByRole('button', { name: 'Pay Tax for Others' }).click();
    let payment = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(payment.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    await payment.locator('[data-payment-entry="OTHER_TAX"]').click();
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(payment.locator('[data-payment-access="GUEST"]')).toHaveAttribute('aria-pressed', 'true');
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    const observedSinglePrefillMatches = {
      tinMatchesExpected: (await payment.locator('#guest-tin').inputValue()) === '012345678901',
      nameMatchesExpected: (await payment.locator('#other-tax-primary-name').inputValue()) === 'Hosted Synthetic Alpha',
    };
    console.log('HOSTED_ACCEPTANCE_SINGLE_PREFILL_MATCHES=' + JSON.stringify(observedSinglePrefillMatches));
    expect(observedSinglePrefillMatches).toEqual({ tinMatchesExpected: true, nameMatchesExpected: true });
    await expect(payment.getByText('Sign-in Payment')).toHaveCount(0);
    await payment.getByRole('button', { name: 'Close payment services' }).click();

    await firstRow.getByRole('checkbox').check();
    await secondRow.getByRole('checkbox').check();
    const selectionBar = page.getByText('2 selected', { exact: true }).locator('..');
    const bulkPayButton = selectionBar.getByRole('button', { name: 'Pay Tax for Others', exact: true });
    await expect(selectionBar).toBeVisible();
    await expect(bulkPayButton).toHaveCount(1);
    await bulkPayButton.click();
    payment = page.getByRole('dialog', { name: 'Pay Tax' });
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(payment.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();
    const additional = payment.getByTestId('other-tax-taxpayer');
    const primaryTin = await payment.locator('#guest-tin').inputValue();
    const primaryName = await payment.locator('#other-tax-primary-name').inputValue();
    const additionalTin = await additional.locator('input[id^="other-tax-tin-"]').inputValue();
    const additionalName = await additional.locator('input[id^="other-tax-name-"]').inputValue();
    const primaryMatchesAlpha = primaryTin === '012345678901' && primaryName === 'Hosted Synthetic Alpha';
    const primaryMatchesLocal = primaryTin === '987654321098' && primaryName === 'Local Beneficiary Two';
    const additionalMatchesAlpha = additionalTin === '012345678901' && additionalName === 'Hosted Synthetic Alpha';
    const additionalMatchesLocal = additionalTin === '987654321098' && additionalName === 'Local Beneficiary Two';
    const multiPrefillMatches = {
      primaryMatchesSelectedBeneficiary: primaryMatchesAlpha || primaryMatchesLocal,
      additionalMatchesSelectedBeneficiary: additionalMatchesAlpha || additionalMatchesLocal,
      bothSelectedBeneficiariesMatch: (primaryMatchesAlpha && additionalMatchesLocal) || (primaryMatchesLocal && additionalMatchesAlpha),
    };
    console.log('HOSTED_ACCEPTANCE_MULTI_PREFILL_MATCHES=' + JSON.stringify(multiPrefillMatches));
    expect(multiPrefillMatches).toEqual({
      primaryMatchesSelectedBeneficiary: true,
      additionalMatchesSelectedBeneficiary: true,
      bothSelectedBeneficiariesMatch: true,
    });
    const primaryNameForTabs = primaryMatchesAlpha ? 'Hosted Synthetic Alpha' : 'Local Beneficiary Two';
    const additionalNameForTabs = primaryMatchesAlpha ? 'Local Beneficiary Two' : 'Hosted Synthetic Alpha';
    await payment.getByLabel('Your name (payer)').fill('Synthetic QA Payer');
    await payment.getByLabel('Mobile number for receipt').fill('01700000000');
    await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();

    const batch = payment.getByTestId('other-tax-batch');
    const tabs = batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button');
    await expect(tabs).toHaveCount(2);
    await batch.locator('[data-head-group="Advance Tax"] summary').click();
    await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
    await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
    await tabs.nth(1).click();
    await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
    await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
    await expect(tabs.nth(1).getByText(additionalNameForTabs, { exact: true })).toHaveCount(1);
    await expect(tabs.nth(1)).toContainText('1 selected');
    await expect(batch.getByTestId('other-tax-line')).toContainText('68B');
    await tabs.first().click();
    await expect(tabs.first().getByText(primaryNameForTabs, { exact: true })).toHaveCount(1);
    await expect(tabs.first()).toContainText('1 selected');
    await expect(batch.getByTestId('other-tax-line')).toContainText('68A');
    await expect(batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]')).toHaveValue('15');
    await tabs.nth(1).click();
    await expect(batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]')).toHaveValue('35');
    await expect(batch.getByTestId('other-tax-combined-total')).toContainText('50');
    await payment.getByRole('button', { name: 'Continue to payment channel' }).click();
    await expect(payment.getByTestId('payment-review')).toBeVisible();
    // Stop at review. Do not choose a gateway, acknowledge, request a slip, or submit payment.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(paymentRequests, 'No payment, gateway, challan, intent, slip, checkout, or transaction endpoint may be requested').toEqual([]);
    await payment.getByRole('button', { name: 'Close payment services' }).click();

    await firstRow.getByRole('button', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit beneficiary' });
    await editDialog.locator('#beneficiary-edit-name').fill('Hosted Synthetic Alpha Edited');
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(pageRows.getByText('Hosted Synthetic Alpha Edited', { exact: true })).toHaveCount(1);

    await secondRow.getByRole('button', { name: 'Remove beneficiary' }).click();
    const removeDialog = page.getByRole('dialog', { name: 'Confirm beneficiary removal' });
    await removeDialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(pageRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(0);
    await expect(pageRows.getByText('Hosted Synthetic Alpha Edited', { exact: true })).toHaveCount(1);

    for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 768, height: 900 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `Hosted Beneficiaries overflow at ${viewport.width}px`).toBeLessThanOrEqual(2);
    }
    await page.goto('?action=beneficiaries&lang=bn', { waitUntil: 'domcontentloaded' });
    const bengaliRoot = page.getByTestId('beneficiaries-page');
    const bengaliRows = bengaliRoot.locator('ul li');
    await expect(bengaliRoot).toHaveAttribute('lang', 'bn');
    await expect(page.getByRole('heading', { name: 'উপকারভোগী' })).toBeVisible();
    await expect(bengaliRows.getByText('Hosted Synthetic Alpha Edited', { exact: true })).toHaveCount(1);
    await expect(bengaliRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(0);

    await page.goto('?action=beneficiaries', { waitUntil: 'domcontentloaded' });
    await expect(pageRoot).toHaveAttribute('lang', 'en');
    await expect(pageRows.getByText('Hosted Synthetic Alpha Edited', { exact: true })).toHaveCount(1);
    await expect(pageRows.getByText('Local Beneficiary Two', { exact: true })).toHaveCount(0);

    // Anonymous reads against owner-only tables must be denied.
    // No populated owner row exists in the hosted baseline, so row-level privacy for an existing account record is not tested.
    expect(supabaseApiOrigin).toBe('https://eyqhoavnitkrajvyqvxn.supabase.co');
    expect(publishableKey).toBeTruthy();
    for (const table of ['taxpay_beneficiary_lists', 'taxpay_beneficiaries']) {
      const response = await request.head(`${supabaseApiOrigin}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
      });
      expect([401, 403], `Anonymous owner-table HEAD must be denied for ${table}`).toContain(response.status());
    }

    // The signed-in workspace remains behind its existing auth boundary in the guest context.
    await page.goto('?action=secure_workspace', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in with email' })).toBeVisible();
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);

    expect(ownerTableRequests, 'Guest route must not read or write account-owned private tables').toEqual([]);
    expect(paymentRequests, 'No payment API call may occur during acceptance').toEqual([]);
    expect(recordedActions).toEqual(expect.arrayContaining(['open', 'lists', 'people', 'create-list', 'add', 'update', 'remove']));
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
