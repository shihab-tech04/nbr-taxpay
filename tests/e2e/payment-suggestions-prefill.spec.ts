import { expect, test, type Page } from '@playwright/test';

const projectRef = 'nbr-taxpay-test';
const supabaseUrl = `https://${projectRef}.invalid`;
const owner = {
  id: '00000000-0000-4000-8000-000000000302',
  email: 'suggestions-owner@example.invalid',
  aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { taxpay_display_name: 'Suggestions owner' },
  created_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-10-30T10:00:00.000Z',
};

function sessionFor(user: typeof owner) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expiresAt }));
  return {
    access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.synthetic-signature`,
    token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    refresh_token: `synthetic-refresh-${user.id}`, user,
  };
}

async function mockBoundScenarioAccount(
  page: Page,
  recordsByUser: Record<string, unknown[]> = {
    user1: [{
      record_id: 'SIM-HISTORY-RETURN-2025', user_id: 'user1', service_code: 'TAX_WITH_RETURN',
      assessment_year: '2025-26', amount_minor: 87500, record_state: 'SIMULATED',
      participant_role: 'PAYER', related_user_id: null, recorded_at: '2026-10-28T09:00:00Z', simulation_only: true,
    }],
  },
  authorizedTaxpayers: Array<'user2' | 'user3'> = [],
) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sb-${projectRef}-auth-token`, value: sessionFor(owner),
  });
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info',
      'access-control-allow-methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
    };
    const json = (body: unknown, status = 200) => route.fulfill({
      status, contentType: 'application/json', headers, body: JSON.stringify(body),
    });
    if (request.method() === 'OPTIONS') return json({});
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') return json(owner);
    if (url.pathname === '/rest/v1/rpc/sim_my_taxpayer_profile' && request.method() === 'POST') return json('user1');
    if (url.pathname === '/rest/v1/sim_payment_users' && request.method() === 'GET') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '') ?? '';
      const profiles: Record<string, unknown> = {
        user1: { id: 'user1', role_code: 'PERSON', name_en: 'Scenario Taxpayer One', name_bn: 'সিনারিও করদাতা এক',
          focus_en: 'Annual income tax', focus_bn: 'বার্ষিক আয়কর', tin_stub: '111…111', jurisdiction_label: 'Taxes Zone 1' },
        user2: { id: 'user2', role_code: 'COMPANY', name_en: 'Meghna Trading Ltd.', name_bn: 'মেঘনা ট্রেডিং লিমিটেড',
          focus_en: 'Corporate tax', focus_bn: 'কোম্পানি কর', tin_stub: '222…222', jurisdiction_label: 'Taxes Zone 2' },
        user3: { id: 'user3', role_code: 'COMPANY', name_en: 'Rupali Textiles Ltd.', name_bn: 'রূপালী টেক্সটাইলস লিমিটেড',
          focus_en: 'Demand payment', focus_bn: 'দাবি পরিশোধ', tin_stub: '333…333', jurisdiction_label: 'Taxes Zone 3' },
      };
      expect(profiles[id]).toBeDefined();
      return json(profiles[id]);
    }
    if (url.pathname === '/rest/v1/sim_tax_service_records' && request.method() === 'GET') {
      const id = url.searchParams.get('user_id')?.replace(/^eq\./, '') ?? '';
      expect(id).toMatch(/^user(?:1|2|3)$/);
      return json(recordsByUser[id] ?? []);
    }
    return json({ message: 'Blocked by the payment suggestion browser test' }, 403);
  });
  await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay/authorizations*', async route => {
    const authRecords = authorizedTaxpayers.map(taxpayerId => ({
      id: `AUTH-${taxpayerId}`, payerId: 'user1', taxpayerId, status: 'ACTIVE',
      requestedAt: Date.now() - 60_000, codeExpiresAt: Date.now() + 60_000, consentCode: null,
      confirmedAt: Date.now() - 30_000, activeUntil: null, attempts: 0, revokedAt: null,
    }));
    return route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ success: true, data: authRecords }) });
  });
}

async function openOwnTaxReturn(page: Page, language: 'en' | 'bn') {
  await mockBoundScenarioAccount(page);
  await page.goto(language === 'bn' ? '/?lang=bn' : '/');
  const dialogName = language === 'bn' ? 'কর পরিশোধ' : 'Pay Tax';
  await page.getByRole('button', { name: dialogName, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.locator('.tax-service-choice__continue').click();
  await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await dialog.locator('.tax-service-choice__continue').click();
  await expect(dialog.getByRole('button', { name: language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount' })).toBeVisible();
  await expect(dialog.locator('.account-taxpayer-summary')).toContainText('1111111111111');
  await expect(dialog.locator('#guest-notice-ref')).toHaveValue('');
  await dialog.getByRole('button', { name: language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('payment-suggestions')).toBeVisible();
  return dialog;
}

for (const language of ['en', 'bn'] as const) {
  test(`own taxpayer payment suggestion fills only the verified scenario year (${language})`, async ({ page }) => {
    const dialog = await openOwnTaxReturn(page, language);
    const suggestions = dialog.getByTestId('payment-suggestions');
    await expect(suggestions).toContainText('SIM-HISTORY-RETURN-2025');
    await expect(suggestions).not.toContainText('875.00');
    await expect(suggestions).not.toContainText('NBR-REFERENCE');
    await suggestions.getByRole('button', { name: language === 'bn' ? 'সেবা ও করবর্ষ ব্যবহার করুন' : 'Use service and year' }).click();
    await expect(dialog.locator('#guest-assessment-year')).toHaveValue('2025-26');
    await expect(dialog.locator('#guest-tax-amount')).toHaveValue('');
    await expect(dialog.locator('input[name="guest-income-type"]:checked')).toHaveCount(0);

    await dialog.locator('#guest-income-type-NON_COMPANY').check();
    await dialog.locator('#guest-tax-amount').fill('25.00');
    await dialog.getByRole('button', { name: language === 'bn' ? 'পেমেন্ট চ্যানেলে এগিয়ে যান' : 'Continue to payment channel' }).click();
    await expect(dialog.getByTestId('payment-review')).toBeVisible();
    await expect(dialog.getByTestId('payment-review')).toContainText(language === 'bn' ? '৳ ২৫' : 'BDT 25');
    await expect(dialog).toContainText(language === 'bn' ? '2025-26' : '2025-26');
  });
}

for (const language of ['en', 'bn'] as const) {
  test(`source tax suggestion fills only the selected taxpayer's scenario year (${language})`, async ({ page }) => {
    await mockBoundScenarioAccount(page, {
      user1: [{ record_id: 'SIM-HISTORY-SOURCE-2025', user_id: 'user1', service_code: 'SOURCE_TAX_DEPOSIT',
        assessment_year: '2025-26', amount_minor: 66500, record_state: 'SIMULATED', participant_role: 'PAYER',
        related_user_id: null, recorded_at: '2026-10-28T08:00:00Z', simulation_only: true }],
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(language === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing');
    const carousel = page.getByRole('region', { name: language === 'bn' ? 'কর পরিশোধের সেবা ব্যানার' : 'Tax payment service banners' });
    const activeIndex = Number(await carousel.getAttribute('data-active-slide'));
    const moves = (3 - activeIndex + 5) % 5;
    for (let i = 0; i < moves; i++) await carousel.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-payment-service', 'SOURCE_TAX_DEPOSIT');
    await carousel.getByRole('button', { name: language === 'bn' ? 'উৎসে কর জমা দিন' : 'Deposit Source Tax', exact: true }).click();

    const dialogName = language === 'bn' ? 'কর পরিশোধ' : 'Pay Tax';
    const dialog = page.getByRole('dialog', { name: dialogName });
    await dialog.locator('[data-payer-relationship="SELF"]').click();
    await dialog.getByRole('button', { name: language === 'bn' ? 'এগিয়ে যান' : 'Continue', exact: true }).click();
    await dialog.getByRole('button', { name: language === 'bn' ? 'এগিয়ে যান' : 'Continue', exact: true }).click();
    await expect(dialog.locator('.tax-service-choice__selected-service [data-payment-service]'))
      .toHaveAttribute('data-payment-service', 'SOURCE_TAX_DEPOSIT');
    await dialog.getByRole('button', { name: language === 'bn' ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount' }).click();

    const suggestions = dialog.getByTestId('payment-suggestions');
    await expect(suggestions).toContainText('SIM-HISTORY-SOURCE-2025');
    await expect(suggestions).not.toContainText('665.00');
    await suggestions.getByRole('button', { name: language === 'bn' ? 'সেবা ও করবর্ষ ব্যবহার করুন' : 'Use service and year' }).click();
    await expect(dialog.locator('#guest-assessment-year')).toHaveValue('2025-26');
    await expect(dialog.locator('input[name="guest-payment-head"]:checked')).toHaveCount(0);
    await expect(dialog.locator('#guest-tax-amount')).toHaveCount(0);
    await dialog.locator('input[name="guest-payment-head"]:enabled').first().check();
    await expect(dialog.locator('#guest-tax-amount')).toHaveValue('');
  });
}

test('authorized taxpayer suggestion selects the matching batch row and preserves each year and amount', async ({ page }) => {
  await mockBoundScenarioAccount(page, {
    user2: [{ record_id: 'SIM-ADVANCE-USER2', user_id: 'user2', service_code: 'ADVANCE_TAX',
      assessment_year: '2026-27', amount_minor: 99000, record_state: 'SIMULATED', participant_role: 'PAYER',
      related_user_id: null, recorded_at: '2026-10-28T08:00:00Z', simulation_only: true }],
    user3: [{ record_id: 'SIM-DEMAND-USER3', user_id: 'user3', service_code: 'ASSESSED_DEMAND',
      assessment_year: '2024-25', amount_minor: 87500, record_state: 'SIMULATED', participant_role: 'PAYER',
      related_user_id: null, recorded_at: '2026-10-29T08:00:00Z', simulation_only: true }],
  }, ['user2', 'user3']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await dialog.locator('.tax-service-choice__continue').click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('.tax-service-choice__continue').click();

  await dialog.getByRole('button', { name: /Meghna Trading Ltd\./ }).click();
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.getByRole('button', { name: /Rupali Textiles Ltd\./ }).click();
  await expect(dialog.locator('[data-testid="other-tax-taxpayer"]')).toHaveCount(1);
  await expect(dialog.locator('[data-testid="other-tax-taxpayer"] input').first()).toHaveValue('3333333333333');

  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const suggestions = dialog.getByTestId('payment-suggestions');
  await expect(suggestions).toHaveCount(2);
  const secondarySuggestion = dialog.getByTestId('payment-suggestions').filter({ hasText: 'Rupali Textiles Ltd.' });
  await expect(secondarySuggestion).toContainText('SIM-DEMAND-USER3');
  await expect(secondarySuggestion).not.toContainText('875.00');
  await secondarySuggestion.getByRole('button', { name: 'Use service and year' }).click();
  await expect(dialog.getByTestId('other-tax-taxpayer-tabs').locator('button[aria-pressed="true"]')).toContainText('3333333333333');
  await expect(dialog.getByTestId('suggested-taxpayer-year')).toContainText('2024-25');

  const demandHead = dialog.locator('details[data-head-group="Tax against Demand"] input[type="checkbox"]:enabled').first();
  await demandHead.check();
  const secondaryLine = dialog.locator('[data-testid="other-tax-line"]');
  await expect(secondaryLine.locator('select')).toHaveValue('2024-25');
  await expect(secondaryLine.locator('input')).toHaveValue('');
  await secondaryLine.locator('input').fill('40.00');

  const primarySuggestion = dialog.getByTestId('payment-suggestions').filter({ hasText: 'Meghna Trading Ltd.' });
  await primarySuggestion.getByRole('button', { name: 'Use service and year' }).click();
  await expect(dialog.getByTestId('other-tax-taxpayer-tabs').locator('button[aria-pressed="true"]')).toContainText('2222222222222');
  await expect(dialog.getByTestId('suggested-taxpayer-year')).toContainText('2026-27');
  const advanceHead = dialog.locator('details[data-head-group="Advance Tax"] input[type="checkbox"]:enabled').first();
  await advanceHead.check();
  const primaryLine = dialog.locator('[data-testid="other-tax-line"]');
  await expect(primaryLine.locator('select')).toHaveValue('2026-27');
  await primaryLine.locator('input').fill('65.50');

  await dialog.getByRole('button', { name: /Rupali Textiles Ltd\./ }).click();
  await expect(dialog.locator('[data-testid="other-tax-line"] select')).toHaveValue('2024-25');
  await expect(dialog.locator('[data-testid="other-tax-line"] input')).toHaveValue('40.00');
  await dialog.getByRole('button', { name: /Meghna Trading Ltd\./ }).click();
  await expect(dialog.locator('[data-testid="other-tax-line"] select')).toHaveValue('2026-27');
  await expect(dialog.locator('[data-testid="other-tax-line"] input')).toHaveValue('65.50');

  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  const review = dialog.getByTestId('payment-review');
  await expect(review).toBeVisible();
  await expect(review.getByTestId('grouped-taxpayer-calculation')).toContainText('Meghna Trading Ltd.');
  await expect(review.getByTestId('grouped-taxpayer-calculation')).toContainText('Rupali Textiles Ltd.');
  await expect(review.locator('.payment-form-summary__total')).toHaveText('BDT 105.5');
});
