import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';

// A real local Auth + PostgREST/browser test. No intercepted requests or mock sessions.
// This file is excluded from public-Preview CI, and refuses all hosted URLs.
const localUrl = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anonKey = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
test('two genuine synthetic app accounts retain separated drafts across browser sessions', async ({ browser }) => {
  if (!localUrl || !anonKey) throw new Error('BLOCKED: local Supabase credentials required');
  const url = new URL(localUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to use a hosted or non-loopback Supabase endpoint');
  }
  const createOwner = async () => {
    const email = 'taxpay-synthetic-' + randomUUID() + '@example.invalid';
    const password = randomBytes(32).toString('base64url');
    const response = await fetch(new URL('/auth/v1/signup', url.origin), {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user?.id).toBeTruthy();
    expect(body.access_token || body.session?.access_token).toBeTruthy();
    return { id: body.user.id as string, email, session: body.session ?? body };
  };
  const ownerA = await createOwner();
  const ownerB = await createOwner();
  const contextA = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 375, height: 812 } });
  const pageA = await contextA.newPage();
  const s = ownerA.session;
  await pageA.goto('/?action=secure_workspace#access_token=' + encodeURIComponent(s.access_token) +
    '&refresh_token=' + encodeURIComponent(s.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' + (s.expires_at ?? Math.floor(Date.now() / 1000) + 3600));
  await expect(pageA.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  // Visual acceptance under real synthetic Auth, not mocked transport or a Guest role.
  const referenceA = pageA.locator('.taxpay-taxpayer-reference');
  await expect(referenceA).toBeVisible();
  await expect(pageA.locator('.taxpayer-reference-secure')).toBeVisible();
  await expect(referenceA).toHaveCSS('background-color', 'rgb(246, 249, 254)');
  expect((await referenceA.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim())).toUpperCase()).toBe('#2C5EAD');
  await expect(pageA.locator('.taxpayer-reference-secure input').first()).toHaveCSS('border-color', 'rgb(221, 231, 245)');
  expect(await pageA.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await pageA.getByLabel('Assessment-year label (not verified)').fill('2026-27');
  await pageA.getByLabel('Proposed amount (BDT)').fill('123.45');
  await pageA.getByLabel('Private note (optional)').fill('SYNTHETIC-OWNER-A-PERSISTENCE');
  await pageA.getByRole('button', { name: 'Save draft to database' }).click();
  await expect(pageA.getByRole('status').filter({ hasText: 'Private draft saved to Supabase' })).toBeVisible();
  await expect(pageA.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toBeVisible();

  const ownResponse = await fetch(new URL('/rest/v1/taxpay_payment_drafts?select=id,owner_uid,amount_minor,record_status', url.origin), {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + s.access_token },
  });
  expect(ownResponse.status).toBe(200);
  const created = await ownResponse.json();
  expect(created).toHaveLength(1);
  expect(created[0].owner_uid).toBe(ownerA.id);
  expect(created[0].amount_minor).toBe(12345);
  expect(created[0].record_status).toBe('DRAFT');
  const draftId = created[0].id as string;
  // Account notifications are generated from the real owner's persisted drafts.
  // They are not fabricated legal notices or mock network responses.
  const accountTab = await contextA.newPage();
  await accountTab.goto('/?action=account_notifications');
  await expect(accountTab.getByRole('heading', { name: 'Account notifications' })).toBeVisible();
  await expect(accountTab.getByText('Draft saved')).toBeVisible();
  await expect(accountTab.getByText('No payment made.')).toBeVisible();
  await expect(accountTab.getByText(/Demand Notice DN-|BDT 47,400/)).toHaveCount(0);
  await accountTab.getByRole('button', { name: 'Mark all as viewed' }).click();
  await expect(accountTab.getByRole('status').filter({ hasText: 'Notification viewing status saved' })).toBeVisible();
  await accountTab.getByRole('navigation', { name: 'Account pages' }).getByRole('button', { name: 'Profile settings' }).click();
  await accountTab.getByLabel('Display name').fill('Synthetic test account A');
  await accountTab.getByRole('button', { name: 'Save preferences' }).click();
  await expect(accountTab.getByRole('status').filter({ hasText: 'Preferences saved' })).toBeVisible();
  await accountTab.reload();
  await expect(accountTab.getByLabel('Display name')).toHaveValue('Synthetic test account A');
  await accountTab.getByRole('navigation', { name: 'Account pages' }).getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(accountTab.getByText('Synthetic test account A')).toBeVisible();
  const metadataRead = await fetch(new URL('/auth/v1/user', url.origin), {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + s.access_token },
  });
  expect(metadataRead.status).toBe(200);
  const metadata = await metadataRead.json();
  expect(metadata.user_metadata?.taxpay_display_name).toBe('Synthetic test account A');
  expect(typeof metadata.user_metadata?.taxpay_notifications_read_at).toBe('string');
  await accountTab.close();


  // Revisit from a separate browser tab with the actual persisted session.
  // Hold a stale copy in another tab so a concurrent update cannot be silently overwritten.
  await pageA.getByRole('button', { name: 'Resume draft' }).click();
  const otherTab = await contextA.newPage();
  await otherTab.goto('/?action=secure_workspace');
  await expect(otherTab.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toBeVisible();
  await otherTab.getByRole('button', { name: 'Resume draft' }).click();
  await expect(otherTab.getByLabel('Proposed amount (BDT)')).toHaveValue('123.45');
  await otherTab.getByLabel('Proposed amount (BDT)').fill('124.50');
  await otherTab.getByRole('button', { name: 'Save draft changes' }).click();
  await expect(otherTab.getByRole('status').filter({ hasText: 'Private draft changes saved' })).toBeVisible();
  await otherTab.reload();
  await expect(otherTab.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toBeVisible();
  await expect(otherTab.getByText('BDT 124.50 · Private draft only')).toBeVisible();

  // Optimistic concurrency must fail closed when this first tab still holds old values.
  await pageA.getByLabel('Proposed amount (BDT)').fill('125.00');
  await pageA.getByRole('button', { name: 'Save draft changes' }).click();
  await expect(pageA.getByRole('status').filter({ hasText: 'changed in another session' })).toBeVisible();
  await pageA.getByRole('button', { name: 'Retry loading drafts' }).click();
  await expect(pageA.getByRole('status').filter({ hasText: 'Private drafts reloaded' })).toBeVisible();

  // New browser context rehydrates the real client session and reads the same saved record.
  const restored = await browser.newContext({ baseURL: 'http://127.0.0.1:4173',
    storageState: await contextA.storageState(), viewport: { width: 360, height: 740 } });
  const restoredPage = await restored.newPage();
  await restoredPage.goto('/?action=secure_workspace');
  await expect(restoredPage.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(restoredPage.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toBeVisible();
  await restored.close();

  const contextB = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 320, height: 720 } });
  const pageB = await contextB.newPage();
  const b = ownerB.session;
  await pageB.goto('/?action=secure_workspace#access_token=' + encodeURIComponent(b.access_token) +
    '&refresh_token=' + encodeURIComponent(b.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' + (b.expires_at ?? Math.floor(Date.now() / 1000) + 3600));
  await expect(pageB.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(pageB.locator('.taxpay-taxpayer-reference')).toHaveCSS('background-color', 'rgb(246, 249, 254)');
  expect(await pageB.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(pageB.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toHaveCount(0);
  const otherRead = await fetch(new URL('/rest/v1/taxpay_payment_drafts?select=id&id=eq.' + draftId, url.origin), {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + b.access_token },
  });
  expect(otherRead.status).toBe(200);
  expect(await otherRead.json()).toEqual([]);

  // Confirm deletion and requery through the real owner token, not a mocked success.
  await otherTab.getByRole('button', { name: 'Delete draft' }).click();
  await otherTab.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(otherTab.getByRole('status').filter({ hasText: 'Draft deleted' })).toBeVisible();
  const afterDelete = await fetch(new URL('/rest/v1/taxpay_payment_drafts?select=id&id=eq.' + draftId, url.origin), {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + s.access_token },
  });
  expect(afterDelete.status).toBe(200);
  expect(await afterDelete.json()).toEqual([]);

  await otherTab.getByRole('button', { name: 'Sign out' }).click();
  await expect(otherTab.getByRole('heading', { name: 'Sign in with email' })).toBeVisible();
  await expect(otherTab.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toHaveCount(0);
  // Mobile profile menu must execute actual local Auth sign-out, not a demo role switch.
  await pageB.goto('/?action=account_profile');
  await expect(pageB.getByRole('heading', { name: 'Profile', exact: true, level: 1 })).toBeVisible();
  await pageB.getByRole('button', { name: 'Open menu' }).click();
  await pageB.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'Sign out' }).click();
  await expect(pageB.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await pageB.goto('/?action=account_profile');
  await expect(pageB.getByText('Sign in to view your account.')).toBeVisible();

  await contextB.close();
  await contextA.close();
});
