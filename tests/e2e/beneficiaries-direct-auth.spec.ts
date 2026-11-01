import { expect, test } from '@playwright/test';

test('signed-out Beneficiaries deep link starts real email sign-in without sample-account detours', async ({ page }) => {
  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiary-sign-in')).toBeVisible({timeout: 15000});
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(page.getByRole('heading', { name: 'Sign in to manage beneficiaries' })).toBeVisible();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use User ID (sample account)' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(0);

  const input = page.getByRole('textbox', { name: 'Email address' });
  await expect(input).toBeVisible();
  const submit = page.getByRole('button', { name: 'Email sign-in link' });
  await expect(submit).toBeDisabled();
  await input.fill('saved-lists@example.org');
  let requestedEmail: string | undefined;
  let callback: string | null = null;
  await page.route('**/auth/v1/otp**', async route => {
    const request = route.request();
    const payload = request.postDataJSON();
    requestedEmail = payload.email;
    callback = new URL(request.url()).searchParams.get('redirect_to');
    await route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
  });
  await submit.click();
  await expect(page.getByRole('status')).toContainText('return to Beneficiaries');
  expect(requestedEmail).toBe('saved-lists@example.org');
  expect(callback).toContain('action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page).toHaveURL(/action=beneficiaries/);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('Bengali Beneficiaries sign-in stays contained on mobile and never shows private data', async ({ page }) => {
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading', { name: 'উপকারভোগী দেখতে সাইন ইন করুন' })).toBeVisible({timeout: 15000});
  await expect(page.getByRole('textbox', { name: 'ইমেইল ঠিকানা' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন-ইন লিংক পাঠান' })).toBeDisabled();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ইউজার আইডি দিয়ে নমুনা অ্যাকাউন্ট দেখুন' })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'মূল পাতায় ফিরুন' }).click();
  await expect(page).toHaveURL(/action=landing/);
});
