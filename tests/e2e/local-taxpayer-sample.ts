import { expect, type Page } from '@playwright/test';

/**
 * Recreate the legacy visual-only taxpayer-role fixture on the local Vite
 * development server. This uses the application's existing historySampleRole
 * mechanism; it is intentionally NOT Supabase authentication or a production
 * shortcut. Browser tests for real OTP return and private-route denial remain
 * independent and must not call this fixture.
 */
export async function enterLocalTaxpayerSample(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('action', 'taxpayer_home');
    url.searchParams.delete('demoUser');
    window.history.replaceState(
      { taxpayRoute: 'taxpayer_home', taxpaySampleRole: 'TAXPAYER_INDIVIDUAL', taxpayParams: {} },
      '',
      url
    );
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Dashboard summary|ড্যাশবোর্ড সারসংক্ষেপ/ })).toBeVisible();
}
