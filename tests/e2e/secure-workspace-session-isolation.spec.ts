import { test, expect } from '@playwright/test';

const projectRef = 'nbr-taxpay-test';
const syntheticSupabaseUrl = `https://${projectRef}.invalid`;
const userA = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'synthetic-owner-a@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
};
const userB = {
  ...userA,
  id: '00000000-0000-4000-8000-000000000002',
  email: 'synthetic-owner-b@example.invalid',
};

const makeSession = (user: typeof userA) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
    sub: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: expiresAt,
  }))}.synthetic-signature`;
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: `synthetic-refresh-${user.id}`,
    user,
  };
};

const callbackUrl = (session: ReturnType<typeof makeSession>, attempt: number) =>
  `/?action=secure_workspace&synthetic_reauth=${attempt}#access_token=${encodeURIComponent(session.access_token)}&token_type=bearer&expires_in=3600&expires_at=${session.expires_at}&refresh_token=${encodeURIComponent(session.refresh_token)}`;

const drafts = {
  [userA.id]: [{
    id: 'synthetic-draft-a',
    purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN',
    assessment_year: '2026-27',
    amount_minor: 15500,
    memo: 'PRIVATE-OWNER-A-DRAFT',
    created_at: '2026-01-01T00:00:00.000Z',
  }],
  [userB.id]: [{
    id: 'synthetic-draft-b',
    purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN',
    assessment_year: '2026-27',
    amount_minor: 28750,
    memo: 'PRIVATE-OWNER-B-DRAFT',
    created_at: '2026-01-02T00:00:00.000Z',
  }],
};

const inquiries = {
  [userA.id]: [{
    inquiry_id: 'synthetic-inquiry-a',
    original_reference: 'SYN-A-REF-100001',
    evidence_state: 'PENDING_EVIDENCE',
    created_at: '2026-01-01T00:00:00.000Z',
    reason: 'PRIVATE-OWNER-A-INQUIRY',
    requested_outcome: 'Synthetic owner A only.',
    change_kind: null,
    old_value: null,
    new_value: null,
  }],
  [userB.id]: [{
    inquiry_id: 'synthetic-inquiry-b',
    original_reference: 'SYN-B-REF-100002',
    evidence_state: 'PENDING_EVIDENCE',
    created_at: '2026-01-02T00:00:00.000Z',
    reason: 'PRIVATE-OWNER-B-INQUIRY',
    requested_outcome: 'Synthetic owner B only.',
    change_kind: null,
    old_value: null,
    new_value: null,
  }],
};

test('local sign-out clears private UI and re-authentication loads only the new owner in EN/BN', async ({ page }) => {
  const initialSession = makeSession(userA);
  const logoutScopes: string[] = [];
  let failNextLocalLogout = true;

  await page.addInitScript(({ storageKey, session }) => {
    if (window.name === 'taxpay-session-isolation-started') return;
    window.name = 'taxpay-session-isolation-started';
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: `sb-${projectRef}-auth-token`,
    session: initialSession,
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
    const ownerFromToken = () => {
      const token = request.headers().authorization?.replace(/^Bearer\s+/i, '').split('.')[1];
      if (!token) return null;
      try { return (JSON.parse(atob(token)) as { sub?: string }).sub ?? null; }
      catch { return null; }
    };

    if (request.method() === 'OPTIONS') return json({});
    if (url.pathname === '/auth/v1/logout') {
      logoutScopes.push(url.searchParams.get('scope') ?? 'global-default');
      if (failNextLocalLogout) {
        failNextLocalLogout = false;
        return json({ message: 'Synthetic sign-out failure.' }, 500);
      }
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') {
      const ownerId = ownerFromToken();
      const owner = ownerId === userA.id ? userA : ownerId === userB.id ? userB : null;
      return owner ? json(owner) : json({ message: 'Synthetic session is absent.' }, 401);
    }
    if (url.pathname === '/rest/v1/taxpay_payment_drafts' && request.method() === 'GET') {
      const ownerId = url.searchParams.get('owner_uid')?.replace(/^eq\./, '');
      expect(ownerFromToken()).toBe(ownerId);
      return json(ownerId && ownerId in drafts ? drafts[ownerId as keyof typeof drafts] : []);
    }
    if (url.pathname === '/rest/v1/taxpay_correction_inquiries' && request.method() === 'GET') {
      const ownerId = url.searchParams.get('requester_uid')?.replace(/^eq\./, '');
      expect(ownerFromToken()).toBe(ownerId);
      return json(ownerId && ownerId in inquiries ? inquiries[ownerId as keyof typeof inquiries] : []);
    }
    if (request.method() === 'GET') return json([]);
    return json({ message: 'Blocked by the synthetic TaxPay browser test.' }, 403);
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(page.getByText('PRIVATE-OWNER-A-DRAFT')).toBeVisible();
  const ownerAHistory = page.getByRole('region', { name: 'My review inquiries' });
  await expect(ownerAHistory.getByText('SYN-A-REF-100001 — Pending evidence — not an approved correction')).toBeVisible();
  await ownerAHistory.locator('summary').click();
  await expect(ownerAHistory.getByText('Reason provided: PRIVATE-OWNER-A-INQUIRY')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Signed out on this browser. The server could not confirm revoking the session:' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in with email' })).toBeVisible();
  await expect(page.getByText(/PRIVATE-OWNER-A-/)).toHaveCount(0);
  await expect(page.getByText('SYN-A-REF-100001')).toHaveCount(0);
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'এই ব্রাউজার থেকে সাইন আউট হয়েছে। সার্ভার সেশন বাতিল নিশ্চিত করতে পারেনি:' })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  expect(logoutScopes).toEqual(['local']);

  await page.goto(callbackUrl(makeSession(userA), 1));
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(page.getByText('PRIVATE-OWNER-A-DRAFT')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in with email' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Signed out.' })).toBeVisible();
  await expect(page.getByText(/PRIVATE-OWNER-A-/)).toHaveCount(0);
  await expect(page.getByText('SYN-A-REF-100001')).toHaveCount(0);
  expect(logoutScopes).toEqual(['local', 'local']);
  expect(await page.evaluate(key => localStorage.getItem(key), `sb-${projectRef}-auth-token`)).toBeNull();

  await page.goto(callbackUrl(makeSession(userB), 2));
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await expect(page.getByText('synthetic-owner-b@example.invalid')).toBeVisible();
  await expect(page.getByText('PRIVATE-OWNER-B-DRAFT')).toBeVisible();
  await expect(page.getByText(/PRIVATE-OWNER-A-/)).toHaveCount(0);
  await expect(page.getByText('SYN-B-REF-100002 — Pending evidence — not an approved correction')).toBeVisible();
  await expect(page.getByText('SYN-A-REF-100001')).toHaveCount(0);

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'সাইন-ইন করা অ্যাপ ব্যবহারকারী' })).toBeVisible();
  await expect(page.getByText('PRIVATE-OWNER-B-DRAFT')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});
