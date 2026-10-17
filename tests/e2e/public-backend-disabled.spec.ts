import { expect, test } from '@playwright/test';

test('public preview keeps Auth and drafts disabled without explicit backend configuration', async ({ page }) => {
  const hostedSupabaseRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname.endsWith('.supabase.co')) hostedSupabaseRequests.push(url.hostname);
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Secure Amar Kor workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in with email' })).toHaveCount(0);
  await expect(page.getByText('Sign-in and saved drafts are not available right now.')).toBeVisible();
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);

  // Signed-out draft links use the public header, consistently at every viewport.
  await page.locator('.public-home-header').getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'নিরাপদ আমার কর ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'অ্যাকাউন্ট আপাতত চালু নেই' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toHaveCount(0);
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);
});
