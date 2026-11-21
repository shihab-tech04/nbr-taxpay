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

function captureReferenceRequests(page: Page, expectedCapability?: string) {
  const calls: Array<{ method: string; reference: string; scoped: boolean }> = [];
  const paymentMutations: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/demo-story1-taxpay/payments/reference')) {
      calls.push({
        method: request.method(),
        reference: url.searchParams.get('reference') ?? '',
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
  test.use({ trace: 'off', screenshot: 'off', video: 'off' });

  test('owner retrieves the original receipt and certificate again after reload without creating a payment', async ({ page }) => {
    await installOwnerSession(page, fixture!.owner);
    const { calls, paymentMutations } = captureReferenceRequests(page, fixture!.owner.capability);
    const dialog = await openLookup(page);

    await dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
    await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
    await dialog.getByRole('button', { name: 'Search records' }).click();
    const paper = dialog.locator('.receipt-view__paper');
    await expect(paper).toContainText(fixture!.reference);
    await expect(paper).toContainText('123.45');

    await dialog.getByRole('button', { name: 'View payment certificate' }).click();
    await expect(dialog.locator('.receipt-view__paper h3')).toContainText('Payment Certificate');
    await expect(dialog.getByTestId('payment-certificate-reference'))
      .toContainText('SK-PC-' + fixture!.paymentId);
    await dialog.getByRole('button', { name: 'View receipt' }).click();

    // SessionStorage retains the server-issued profile capability across reload.
    // A second GET must recover the same SQL parent; lookup itself is read-only.
    await page.reload();
    const refreshed = page.getByRole('dialog', { name: 'Payment status & receipt' });
    await refreshed.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
    await refreshed.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
    await refreshed.getByRole('button', { name: 'Search records' }).click();
    await expect(refreshed.locator('.receipt-view__paper')).toContainText(fixture!.reference);
    await expect(refreshed.locator('.receipt-view__paper')).toContainText('123.45');

    expect(calls.length).toBe(2);
    expect(calls.every(call => call.method === 'GET' && call.reference === fixture!.reference && call.scoped)).toBe(true);
    expect(paymentMutations).toEqual([]);
  });

  test('transient lookup outage keeps the reference and retries the same owned source', async ({ page }) => {
    await installOwnerSession(page, fixture!.owner);
    const { calls, paymentMutations } = captureReferenceRequests(page, fixture!.owner.capability);
    let attempts = 0;
    await page.route(/\/demo-story1-taxpay\/payments\/reference\?/, async route => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'PAYMENT_LOOKUP_UNAVAILABLE' }) });
        return;
      }
      await route.continue();
    });
    const dialog = await openLookup(page);
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
    expect(calls.filter(call => call.method === 'GET' && call.scoped).length).toBe(1);
    expect(paymentMutations).toEqual([]);
  });

  test('another demo owner cannot recover the row, and anonymous lookup reveals no receipt', async ({ browser, page }) => {
    const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
    const other = await createIsolatedPage(browser, fixture!.other, viewport);
    const otherRequests = captureReferenceRequests(other.page, fixture!.other.capability);
    try {
      const dialog = await openLookup(other.page);
      await dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(fixture!.reference);
      await dialog.getByRole('textbox', { name: 'Receipt mobile number' }).fill(fixture!.mobile);
      await dialog.getByRole('button', { name: 'Search records' }).click();
      await expect(dialog.getByRole('heading', { name: 'No matching record' })).toBeVisible();
      await expect(dialog.locator('.receipt-view')).toHaveCount(0);
      await expect(dialog.getByText('WS3 isolated fictional payer')).toHaveCount(0);
      expect(otherRequests.calls.some(call => call.method === 'GET' && call.reference === fixture!.reference && call.scoped)).toBe(true);
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
      expect(calls.every(call => !call.scoped)).toBe(true);
    } finally {
      await anonymous.context.close();
    }
  });
});
