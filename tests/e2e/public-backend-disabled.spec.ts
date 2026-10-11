import { expect, test } from '@playwright/test';

test('public preview keeps Auth and drafts disabled without explicit backend configuration', async ({ page }) => {
  const hostedSupabaseRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname.endsWith('.supabase.co')) hostedSupabaseRequests.push(url.hostname);
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Secure TaxPay workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dedicated database is not configured yet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in with email' })).toHaveCount(0);
  await expect(page.getByText('This public preview has no authentication or database connection. Sign-in and saved drafts are unavailable here. It does not fall back to fictional saved records.')).toBeVisible();
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'নিরাপদ TaxPay ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'নির্দিষ্ট ডেটাবেস এখনো কনফিগার করা হয়নি' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toHaveCount(0);
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);
});
