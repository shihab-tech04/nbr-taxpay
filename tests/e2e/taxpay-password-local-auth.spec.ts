import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const localUrl = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anonKey = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;

test('real disposable Supabase password login restores, signs out, and keeps private routes closed', async ({ page }) => {
  if (!localUrl || !anonKey) throw new Error('BLOCKED: loopback Supabase test credentials are required');
  const url = new URL(localUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to test password authentication against a hosted or non-loopback endpoint');
  }

  const email = `taxpay-password-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const signup = await fetch(new URL('/auth/v1/signup', url.origin), {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(signup.status).toBe(200);
  const account = await signup.json();
  expect(account.user?.id).toBeTruthy();

  const directLogin = await fetch(new URL('/auth/v1/token?grant_type=password', url.origin), {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(directLogin.status).toBe(200);
  expect((await directLogin.json()).access_token).toBeTruthy();

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'Account email address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  const storageKey = `sb-${url.hostname.split('.')[0]}-auth-token`;
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toContain('access_token');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await page.locator('.taxpayer-reference-rail').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await page.goto('/?action=dashboard');
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toHaveCount(0);
});

test('real disposable Supabase rejects an incorrect password without opening taxpayer screens', async ({ page }) => {
  if (!localUrl || !anonKey) throw new Error('BLOCKED: loopback Supabase test credentials are required');
  const url = new URL(localUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to test password authentication against a hosted or non-loopback endpoint');
  }
  const email = `taxpay-invalid-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const signup = await fetch(new URL('/auth/v1/signup', url.origin), {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(signup.status).toBe(200);

  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'Account email address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check your email and password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toHaveCount(0);
});

test('password reset email updates a disposable local account and the new password signs in', async ({ page }) => {
  if (!localUrl || !anonKey) throw new Error('BLOCKED: loopback Supabase test credentials are required');
  const url = new URL(localUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to test password recovery against a hosted or non-loopback endpoint');
  }
  const email = `taxpay-reset-${randomUUID()}@example.invalid`;
  const oldPassword = randomBytes(32).toString('base64url');
  const newPassword = randomBytes(32).toString('base64url');
  await page.setViewportSize({ width: 1600, height: 900 });
  const signup = await fetch(new URL('/auth/v1/signup', url.origin), {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: oldPassword }),
  });
  expect(signup.status).toBe(200);

  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'Account email address' }).fill(email);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('status')).toContainText('password reset instructions');

  const mail = new URL('http://127.0.0.1:54324');
  let resetLink: URL | null = null;
  for (let tries = 0; tries < 30 && !resetLink; tries++) {
    const listResponse = await fetch(new URL('/api/v1/messages?limit=30', mail.origin));
    expect(listResponse.status, 'Disposable Mailpit must be running').toBe(200);
    const messages = (await listResponse.json()).messages ?? [];
    for (const item of messages) {
      const recipients = JSON.stringify(item.To ?? item.to ?? item.Recipients ?? []);
      if (!recipients.toLowerCase().includes(email)) continue;
      const detailResponse = await fetch(new URL('/api/v1/message/' + encodeURIComponent(item.ID), mail.origin));
      expect(detailResponse.status).toBe(200);
      const detail = await detailResponse.json();
      const body = [detail.Text, detail.HTML, detail.TextBody, detail.HtmlBody].filter(Boolean).join('\n')
        .replace(/&amp;/g, '&').replace(/&#38;/g, '&');
      const match = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/i);
      if (!match) continue;
      resetLink = new URL(match[0].replace(/[),.;]+$/, ''));
      break;
    }
    if (!resetLink) await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(resetLink, 'Local Supabase did not deliver the password recovery message');
  expect(resetLink.origin).toBe(url.origin);
  expect(resetLink.searchParams.get('type')).toBe('recovery');
  const redirectTo = resetLink.searchParams.get('redirect_to') ?? '';
  expect(redirectTo).toContain('action=taxpayer_login');
  expect(redirectTo).toContain('reset=1');
  await page.goto(resetLink.toString());
  await expect(page.getByLabel('Set new password')).toBeVisible();
  await page.getByLabel('Set new password').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await page.locator('.taxpayer-reference-rail').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();

  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'Account email address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(oldPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check your email and password');
  await page.getByLabel('Password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
});
