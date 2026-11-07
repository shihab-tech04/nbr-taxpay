import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Account = 'user23' | 'user24';

/** Full React Save Draft → another browser → Continue Draft acceptance.
 * Uses the disposable local Supabase/Edge service, not intercepted REST routes.
 * Never connects to hosted taxpayer data.
 */
test('payment form drafts survive another browser, protect owner isolation and reject stale edits', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('Disposable local Supabase is required.');
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Refusing hosted SQL draft browser test.');
  }
  const contexts: BrowserContext[] = [];
  const viewport = info.project.name.startsWith('mobile')
    ? { width: 375, height: 812 } : { width: 1280, height: 800 };
  const open = async (id: Account): Promise<Page> => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(9_000);
    page.setDefaultNavigationTimeout(20_000);
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill(id);
    await page.getByLabel('Password', { exact: true }).fill(id);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=guest');
    await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeVisible();
    // The approved form intentionally starts with no payer relationship chosen.
    // Select self before using the receipt-reference input; do not bypass this UX gate.
    await page.locator('#guest-payer-self').check();
    await expect(page.locator('#guest-notice-ref')).toBeVisible();
    return page;
  };
  try {
    const a = await open('user23');
    const marker = 'CROSS-BROWSER-DRAFT-' + Date.now();
    await a.locator('#guest-notice-ref').fill(marker);
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByText('Draft saved to your account. You can continue in another browser.')).toBeVisible();

    const b = await open('user23');
    await b.getByRole('button', { name: /Continue Draft/ }).click();
    await expect(b.getByRole('button', { name: 'Continue', exact: true }).first()).toBeVisible();
    await b.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await expect(b.locator('#guest-notice-ref')).toHaveValue(marker);
    await b.locator('#guest-notice-ref').fill(marker + '-UPDATED');
    await b.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(b.getByText('Draft saved to your account. You can continue in another browser.')).toBeVisible();

    // Browser A is still at the older revision; no silent loss of Browser B's changes.
    await a.locator('#guest-notice-ref').fill(marker + '-STALE');
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByRole('alert').filter({ hasText: /changed in another session/ })).toBeVisible();

    const unrelated = await open('user24');
    await unrelated.getByRole('button', { name: /Continue Draft/ }).click();
    await expect(unrelated.getByText('Payment draft', { exact: true })).toHaveCount(0);
    await expect(unrelated.locator('#guest-notice-ref')).not.toHaveValue(marker + '-UPDATED');

    await b.getByRole('button', { name: /Continue Draft/ }).click();
    await b.getByRole('button', { name: 'Delete', exact: true }).click();
    await b.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await expect(b.getByText('Draft deleted.')).toBeVisible();

    // A fresh same-account browser does not recover a deleted draft.
    const fresh = await open('user23');
    await fresh.getByRole('button', { name: /Continue Draft/ }).click();
    await expect(fresh.getByText('Payment draft', { exact: true })).toHaveCount(0);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
