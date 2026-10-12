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
  const contextA = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageA = await contextA.newPage();
  const s = ownerA.session;
  await pageA.goto('/?action=secure_workspace#access_token=' + encodeURIComponent(s.access_token) +
    '&refresh_token=' + encodeURIComponent(s.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' + (s.expires_at ?? Math.floor(Date.now() / 1000) + 3600));
  await expect(pageA.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
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

  // Revisit from a separate browser tab with the actual persisted session.
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
  await expect(otherTab.getByText('124.50')).toBeVisible();

  const contextB = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const pageB = await contextB.newPage();
  const b = ownerB.session;
  await pageB.goto('/?action=secure_workspace#access_token=' + encodeURIComponent(b.access_token) +
    '&refresh_token=' + encodeURIComponent(b.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' + (b.expires_at ?? Math.floor(Date.now() / 1000) + 3600));
  await expect(pageB.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(pageB.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toHaveCount(0);
  const otherRead = await fetch(new URL('/rest/v1/taxpay_payment_drafts?select=id&id=eq.' + draftId, url.origin), {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + b.access_token },
  });
  expect(otherRead.status).toBe(200);
  expect(await otherRead.json()).toEqual([]);

  await otherTab.getByRole('button', { name: 'Sign out' }).click();
  await expect(otherTab.getByRole('heading', { name: 'Sign in with email' })).toBeVisible();
  await expect(otherTab.getByText('SYNTHETIC-OWNER-A-PERSISTENCE')).toHaveCount(0);
  await contextB.close();
  await contextA.close();
});