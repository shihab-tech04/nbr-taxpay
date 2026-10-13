import { test, expect } from '@playwright/test';
import { setWorkspaceLanguage } from './workspace-language';

const projectRef = 'nbr-taxpay-test';
const syntheticSupabaseUrl = `https://${projectRef}.invalid`;
const userId = '00000000-0000-4000-8000-000000000001';

test('owner can recover a failed private inquiry history load without duplicating a saved inquiry', async ({ page }) => {
  const authUser = {
    id: userId,
    email: 'synthetic-taxpayer@example.invalid',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: expiresAt }))}.synthetic-signature`;
  let inquiryReads = 0;
  let allowHistorySuccess = false;
  let failPostSaveRefresh = false;
  let allowPostSaveHistoryRetry = false;
  let postSaveRefreshFailures = 0;
  let postSaveHistorySuccesses = 0;
  let insertCount = 0;
  let submitted = false;
  let insertPayload: unknown = null;
  const inquiry = {
    inquiry_id: 'synthetic-inquiry-1',
    original_reference: 'SYN-REF-123456',
    evidence_state: 'PENDING_EVIDENCE',
    created_at: '2026-01-01T00:00:00.000Z',
    reason: 'Synthetic request for review.',
    requested_outcome: 'Please review this synthetic sample.',
    change_kind: 'ASSESSMENT_YEAR',
    old_value: '2024-25',
    new_value: '2025-26',
  };

  await page.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: `sb-${projectRef}-auth-token`,
    session: {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: 'synthetic-refresh-token',
      user: authUser,
    },
  });

  await page.route(`${syntheticSupabaseUrl}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      },
      body: JSON.stringify(body),
    });

    if (request.method() === 'OPTIONS') return json({}, 200);
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') return json(authUser);
    if (url.pathname === '/rest/v1/taxpay_correction_inquiries' && request.method() === 'GET') {
      inquiryReads++;
      if (!allowHistorySuccess) return json({ message: 'Synthetic temporary read failure.' }, 503);
      if (submitted && failPostSaveRefresh && !allowPostSaveHistoryRetry) {
        postSaveRefreshFailures++;
        return json({ message: 'Synthetic post-save refresh failure.' }, 503);
      }
      if (allowPostSaveHistoryRetry) {
        failPostSaveRefresh = false;
        allowPostSaveHistoryRetry = false;
      }
      if (submitted) postSaveHistorySuccesses++;
      expect(url.searchParams.get('requester_uid')).toBe(`eq.${userId}`);
      return json(submitted ? [inquiry] : []);
    }
    if (url.pathname === '/rest/v1/taxpay_correction_inquiries' && request.method() === 'POST') {
      insertCount++;
      insertPayload = request.postDataJSON();
      expect((insertPayload as Record<string, unknown>).requester_uid).toBe(userId);
      submitted = true;
      failPostSaveRefresh = true;
      return json([inquiry]);
    }
    if (request.method() === 'GET') return json([]);
    return json({ message: 'Blocked by the synthetic TaxPay browser test.' }, 403);
  });

  await page.goto('/?action=secure_workspace');
  const history = page.getByRole('region', { name: 'My review inquiries' });
  await expect(page.getByRole('status').filter({ hasText: 'Unable to save or load inquiry' })).toBeVisible();
  const failedReadCount = inquiryReads;
  expect(failedReadCount).toBeGreaterThan(0);
  allowHistorySuccess = true;
  await expect(history.getByRole('button', { name: 'Retry loading inquiries' })).toBeVisible();
  await history.getByRole('button', { name: 'Retry loading inquiries' }).click();
  await expect(history.getByText('No correction inquiries for this account.')).toBeVisible();
  expect(inquiryReads).toBe(failedReadCount + 1);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Original receipt or payment reference (user supplied, not verified)').fill('SYN-REF-123456');
  await page.getByLabel('Reason for requesting a correction review').fill('Synthetic request for review.');
  await page.getByLabel('What outcome are you requesting?').fill('Please review this synthetic sample.');
  await page.getByLabel('Proposed attribution field (optional)').selectOption('ASSESSMENT_YEAR');
  await page.getByLabel('Original value (user supplied)').fill('2024-25');
  await page.getByLabel('Requested value (unverified)').fill('2025-26');
  await page.getByRole('button', { name: 'Save evidence-pending inquiry' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Inquiry saved, but its private history could not be refreshed' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(insertCount).toBe(1);
  expect(postSaveRefreshFailures).toBeGreaterThan(0);
  expect(insertPayload).toMatchObject({
    requester_uid: userId,
    original_reference: 'SYN-REF-123456',
    reason: 'Synthetic request for review.',
    requested_outcome: 'Please review this synthetic sample.',
    change_kind: 'ASSESSMENT_YEAR',
    old_value: '2024-25',
    new_value: '2025-26',
  });
  await expect(page.getByLabel('Original receipt or payment reference (user supplied, not verified)')).toHaveValue('');
  await expect(history.getByRole('button', { name: 'Retry loading inquiries' })).toBeVisible();
  expect(inquiryReads).toBeGreaterThan(failedReadCount + 1);
  allowPostSaveHistoryRetry = true;
  await history.getByRole('button', { name: 'Retry loading inquiries' }).click();
  await expect(history.getByText('SYN-REF-123456 — Pending evidence — not an approved correction')).toBeVisible();
  expect(postSaveHistorySuccesses).toBeGreaterThan(0);
  expect(insertCount).toBe(1);
  await expect(history.getByRole('button', { name: 'Retry loading inquiries' })).toHaveCount(0);
  await history.locator('summary').click();
  await expect(history.getByText('Reason provided: Synthetic request for review.')).toBeVisible();
  await expect(history.getByText('Requested outcome: Please review this synthetic sample.')).toBeVisible();
  await expect(history.getByText('Unverified attribution proposal: Assessment year')).toBeVisible();
  await expect(history.getByText('Previous value (unverified): 2024-25')).toBeVisible();
  await expect(history.getByText('Requested value (unverified): 2025-26')).toBeVisible();

  // Restore the expanded navigation before exercising its language action at 320px.
  // Preserve the real adaptive scroll behavior; never force-click a hidden control.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
  await setWorkspaceLanguage(page, 'bn');
  const historyBn = page.getByRole('region', { name: 'আমার পর্যালোচনার অনুসন্ধান' });
  await expect(historyBn.locator('summary')).toHaveText('অনুরোধের বিবরণ');
  await expect(historyBn.getByText('প্রদত্ত কারণ: Synthetic request for review.')).toBeVisible();
  await expect(historyBn.getByText('অনুরোধের ফলাফল: Please review this synthetic sample.')).toBeVisible();
  await expect(historyBn.getByText('যাচাই না হওয়া পরিচিতি প্রস্তাব: করবর্ষ')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});
