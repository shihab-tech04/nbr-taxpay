import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

type OwnerSession = {
  profileId: 'user1' | 'user2';
  capability: string;
  paymentSessionId: string;
};
type ReferenceFixture = {
  owner: OwnerSession;
  other: OwnerSession;
  reference: string;
  mobile: string;
  paymentId: string;
};

const fixturePath = process.env.TAXPAY_LOCAL_GUEST_REFERENCE_FIXTURE_FILE;
const fixture: ReferenceFixture | null = fixturePath
  ? JSON.parse(readFileSync(fixturePath, 'utf8')) as ReferenceFixture
  : null;
const baseURL = 'http://127.0.0.1:4173';
const sessionKey = 'korbritto.demo-profile-session.v1';
const userKey = 'taxpay-taxpayer-preview-user';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function installOwnerSession(page: Page, session: OwnerSession) {
  await page.addInitScript(({ value, sessionKey, userKey }) => {
    sessionStorage.setItem(userKey, value.profileId);
    sessionStorage.setItem(sessionKey, JSON.stringify({
      ...value,
      language: 'en',
      selectedListId: null,
    }));
  }, { value: session, sessionKey, userKey });
}

async function openLookup(page: Page) {
  await page.goto('/?action=verify');
  return page.getByRole('dialog', { name: 'Payment status & receipt' });
}

async function expectPreviewSession(page: Page, session: OwnerSession) {
  const observed = await page.evaluate(({ sessionKey, userKey, profileId, paymentSessionId }) => {
    const value = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') as
      { profileId?: string; capability?: string; paymentSessionId?: string } | null;
    return {
      userMatches: sessionStorage.getItem(userKey) === profileId,
      profileMatches: value?.profileId === profileId,
      capabilityPresent: typeof value?.capability === 'string' && value.capability.length === 43,
      paymentSessionMatches: value?.paymentSessionId === paymentSessionId,
    };
  }, { sessionKey, userKey, profileId: session.profileId, paymentSessionId: session.paymentSessionId });
  expect(observed).toEqual({
    userMatches: true,
    profileMatches: true,
    capabilityPresent: true,
    paymentSessionMatches: true,
  });
}

function captureReferenceRequests(page: Page, expectedCapability?: string) {
  const calls: Array<{ method: string; reference: string; scoped: boolean; hasCapability: boolean }> = [];
  const paymentMutations: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/demo-story1-taxpay/payments/reference')) {
      calls.push({
        method: request.method(),
        reference: url.searchParams.get('reference') ?? '',
        hasCapability: Boolean(request.headers()['x-taxpay-guest-capability']),
        scoped: expectedCapability
          ? request.headers()['x-taxpay-guest-capability'] === expectedCapability
          : !request.headers()['x-taxpay-guest-capability'],
      });
    }
    if (url.pathname.includes('/demo-story1-taxpay/payments') && request.method() !== 'GET') {
      paymentMutations.push(request.method());
    }
  });
  return { calls, paymentMutations };
}

async function createIsolatedPage(browser: Browser, session?: OwnerSession, viewport?: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  if (session) await installOwnerSession(page, session);
  return { context, page };
}

test.describe('F-129 / US-050 real local Taxpayer UI → Edge → SQL recovery', () => {
  test.skip(!fixture, 'Requires the short-lived fixture created by disposable local Auth/SQL/Edge acceptance.');

  test('owner retrieves the original receipt and certificate again after reload without creating a payment', async ({ browser, page }) => {
    const owned = await createIsolatedPage(browser, fixture!.owner, page.viewportSize() ?? { width: 1280, height: 800 });
    const ownerPage = owned.page;
    const { calls, paymentMutations } = captureReferenceRequests(ownerPage, fixture!.owner.capability);
    try {
    const dialog = await openLookup(ownerPage);
    await expectPreviewSession(ownerPage, fixture!.owner);

    const referenceField = dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' });
    await referenceField.fill(fixture!.reference);
    await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
    await expect(referenceField).toHaveValue(fixture!.reference);
    await dialog.getByRole('button', { name: 'Search records' }).click();
    const paper = dialog.locator('.receipt-view__paper');
    await expect(paper).toContainText(fixture!.reference);
    await expect(paper).toContainText('123.45');

    await dialog.getByRole('button', { name: 'View payment certificate' }).click();
    await expect(dialog.getByRole('heading', { name: 'Payment Certificate', exact: true })).toBeVisible();
    await expect(dialog.getByTestId('payment-certificate-reference'))
      .toContainText('SK-PC-' + fixture!.paymentId);
    await dialog.getByRole('button', { name: 'View receipt' }).click();

    // SessionStorage retains the server-issued profile capability across reload.
    // A second GET must recover the same SQL parent; lookup itself is read-only.
    await ownerPage.reload();
    const refreshed = ownerPage.getByRole('dialog', { name: 'Payment status & receipt' });
    await expectPreviewSession(ownerPage, fixture!.owner);
    await refreshed.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
    await refreshed.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
    await refreshed.getByRole('button', { name: 'Search records' }).click();
    await expect(refreshed.locator('.receipt-view__paper')).toContainText(fixture!.reference);
    await expect(refreshed.locator('.receipt-view__paper')).toContainText('123.45');

    expect(calls.length).toBe(2);
    expect(calls.every(call => call.method === 'GET' &&
      call.reference.toUpperCase() === fixture!.reference.toUpperCase() && call.scoped)).toBe(true);
    expect(paymentMutations).toEqual([]);
    } finally {
      await owned.context.close().catch(() => undefined);
    }
  });

  test('transient lookup outage keeps the reference and retries the same owned source', async ({ browser, page }) => {
    const owned = await createIsolatedPage(browser, fixture!.owner, page.viewportSize() ?? { width: 1280, height: 800 });
    const ownerPage = owned.page;
    const { calls, paymentMutations } = captureReferenceRequests(ownerPage, fixture!.owner.capability);
    let attempts = 0;
    await ownerPage.route(/\/demo-story1-taxpay\/payments\/reference\?/, async route => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'PAYMENT_LOOKUP_UNAVAILABLE' }) });
        return;
      }
      await route.continue();
    });
    try {
    const dialog = await openLookup(ownerPage);
    await expectPreviewSession(ownerPage, fixture!.owner);
    const referenceField = dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' });
    await referenceField.fill(fixture!.reference);
    await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
    await dialog.getByRole('button', { name: 'Search records' }).click();
    await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(dialog.getByRole('heading', { name: 'No matching record' })).toHaveCount(0);
    await expect(referenceField).toHaveValue(fixture!.reference);

    await dialog.getByRole('button', { name: 'Search records' }).click();
    await expect(dialog.locator('.receipt-view__paper')).toContainText(fixture!.reference);
    await expect(dialog.locator('.receipt-view__paper')).toContainText('123.45');
    expect(attempts).toBe(2);
    expect(calls.filter(call => call.method === 'GET' && call.scoped).length).toBe(2);
    expect(paymentMutations).toEqual([]);
    } finally {
      await owned.context.close();
    }
  });

  test('another demo owner cannot recover the row, and anonymous lookup reveals no receipt', async ({ browser, page }) => {
    const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
    const other = await createIsolatedPage(browser, fixture!.other, viewport);
    const otherRequests = captureReferenceRequests(other.page, fixture!.other.capability);
    try {
      const dialog = await openLookup(other.page);
      await expectPreviewSession(other.page, fixture!.other);
      await dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
      await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
      await dialog.getByRole('button', { name: 'Search records' }).click();
      await expect(dialog.getByRole('heading', { name: 'No matching record' })).toBeVisible();
      await expect(dialog.locator('.receipt-view')).toHaveCount(0);
      await expect(dialog.getByText('WS3 isolated fictional payer')).toHaveCount(0);
      expect(otherRequests.calls.map(call => ({
        method: call.method,
        referenceMatches: call.reference.toUpperCase() === fixture!.reference.toUpperCase(),
        scoped: call.scoped,
        hasCapability: call.hasCapability,
      }))).toContainEqual({ method: 'GET', referenceMatches: true, scoped: true, hasCapability: true });
    } finally {
      await other.context.close();
    }

    const anonymous = await createIsolatedPage(browser, undefined, viewport);
    try {
      const { calls } = captureReferenceRequests(anonymous.page);
      const dialog = await openLookup(anonymous.page);
      await dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
      await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
      await dialog.getByRole('button', { name: 'Search records' }).click();
      await expect(dialog.locator('.receipt-view')).toHaveCount(0);
      await expect(dialog.getByText('WS3 isolated fictional payer')).toHaveCount(0);
      expect(calls).toEqual([]);
    } finally {
      await anonymous.context.close();
    }
  });
});
