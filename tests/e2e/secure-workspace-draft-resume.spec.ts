import { test, expect } from '@playwright/test';

const projectRef = 'nbr-taxpay-test';
const syntheticSupabaseUrl = `https://${projectRef}.invalid`;
const userId = '00000000-0000-4000-8000-000000000001';

test('authenticated owner resumes and updates a private draft in Bengali without overflow', async ({ page }) => {
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
  const draft = {
    id: 'synthetic-private-draft-1',
    purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN',
    assessment_year: '2026-27',
    amount_minor: 12345,
    memo: 'Synthetic resume test note',
    created_at: '2026-01-01T00:00:00.000Z',
  };
  let patchCount = 0;
  let updateFilters: { id: string | null; owner_uid: string | null } | null = null;
  let updateBody: unknown = null;

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
    if (url.pathname === '/rest/v1/taxpay_payment_drafts' && request.method() === 'GET') return json([draft]);
    if (url.pathname === '/rest/v1/taxpay_payment_drafts' && request.method() === 'PATCH') {
      patchCount++;
      updateFilters = {
        id: url.searchParams.get('id'),
        owner_uid: url.searchParams.get('owner_uid'),
      };
      updateBody = request.postDataJSON();
      const payload = updateBody as Record<string, unknown>;
      Object.assign(draft, payload);
      return json([{ id: draft.id }]);
    }
    if (request.method() === 'GET') return json([]);
    return json({ message: 'Blocked by the synthetic TaxPay browser test.' }, 403);
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toBeVisible();
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'সাইন-ইন করা অ্যাপ ব্যবহারকারী' })).toBeVisible();
  await page.getByLabel('নির্ধারণ বছরের লেবেল (যাচাই করা হয়নি)').fill('2030-31');
  await page.getByLabel('প্রস্তাবিত পরিমাণ (BDT)').fill('400.00');
  await page.getByLabel('ব্যক্তিগত নোট (ঐচ্ছিক)').fill('Synthetic unsaved draft to preserve');
  await expect(page.getByRole('button', { name: 'খসড়া পুনরায় খুলুন' })).toBeVisible();
  await page.getByRole('button', { name: 'খসড়া পুনরায় খুলুন' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'সংরক্ষিত ব্যক্তিগত খসড়া সম্পাদনা হচ্ছে' })).toBeVisible();
  await expect(page.getByLabel('নির্ধারণ বছরের লেবেল (যাচাই করা হয়নি)')).toHaveValue('2026-27');
  await expect(page.getByLabel('প্রস্তাবিত পরিমাণ (BDT)')).toHaveValue('123.45');
  await page.getByLabel('নির্ধারণ বছরের লেবেল (যাচাই করা হয়নি)').fill('2027-28');
  await page.getByLabel('প্রস্তাবিত পরিমাণ (BDT)').fill('124.50');
  await page.getByLabel('ব্যক্তিগত নোট (ঐচ্ছিক)').fill('Synthetic updated note');
  await page.getByRole('button', { name: 'খসড়ার পরিবর্তন সংরক্ষণ করুন' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'ব্যক্তিগত খসড়ার পরিবর্তন সংরক্ষিত হয়েছে' }).last()).toBeVisible();
  expect(patchCount).toBe(1);
  expect(updateFilters).toEqual({ id: `eq.${draft.id}`, owner_uid: `eq.${userId}` });
  expect(updateBody).toEqual({
    purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN',
    assessment_year: '2027-28',
    amount_minor: 12450,
    memo: 'Synthetic updated note',
  });
  await expect(page.getByText(/১২৪\.৫০/)).toBeVisible();
  await expect(page.getByLabel('নির্ধারণ বছরের লেবেল (যাচাই করা হয়নি)')).toHaveValue('2030-31');
  await expect(page.getByLabel('প্রস্তাবিত পরিমাণ (BDT)')).toHaveValue('400.00');
  await expect(page.getByLabel('ব্যক্তিগত নোট (ঐচ্ছিক)')).toHaveValue('Synthetic unsaved draft to preserve');

  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});
