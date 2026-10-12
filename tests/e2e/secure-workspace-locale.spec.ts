import { test, expect } from '@playwright/test';

test('secure workspace sign-in copy stays localized and fits the viewport', async ({ page }) => {
  let otpRequests = 0;
  await page.route('**/auth/v1/otp**', async route => {
    otpRequests++;
    const body = route.request().postDataJSON();
    expect(body.email).toBe('taxpay-locale@example.invalid');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/?action=secure_workspace');
  const workspace = page.locator('section[lang]').first();
  await expect(workspace).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Secure TaxPay workspace' })).toBeVisible();

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(workspace).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('heading', { name: 'নিরাপদ TaxPay ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByText('ইমেইল অ্যাক্সেস করদাতার পক্ষে কাজ করার আইনগত অনুমতি প্রমাণ করে না।')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ইমেইল ঠিকানা' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'ইমেইল ঠিকানা' }).fill('taxpay-locale@example.invalid');
  await page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' }).click();
  await expect(page.getByRole('status').last()).toContainText('নিরাপদ সাইন-ইন লিংকের জন্য আপনার ইমেইল দেখুন।');
  expect(otpRequests).toBe(1);

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('Check your email for the secure sign-in link.');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('status').last()).toContainText('নিরাপদ সাইন-ইন লিংকের জন্য আপনার ইমেইল দেখুন।');

  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === 'string' ? element.className : '',
          text: element.innerText?.slice(0, 60) ?? '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter(element => element.right > document.documentElement.clientWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 8),
  }));
  expect(width.scroll, JSON.stringify(width.overflowing)).toBeLessThanOrEqual(width.client + 1);
});


test('sign-in and localized workspace remain usable at all six Phase 02 widths', async ({ page }) => {
  await page.goto('/?action=secure_workspace');
  for (const width of [320, 360, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 800 : 740 });
    for (const mode of ['en', 'bn'] as const) {
      await page.getByRole('button', { name: mode === 'bn' ? 'বাংলা' : 'EN', exact: true }).click();
      const section = page.locator('section[lang]').first();
      await expect(section).toHaveAttribute('lang', mode);
      const email = page.getByRole('textbox', { name: mode === 'bn' ? 'ইমেইল ঠিকানা' : 'Email address' });
      await expect(email).toBeVisible();
      await expect(email).toHaveAttribute('type', 'email');
      await email.focus();
      await expect(email).toBeFocused();
      const send = page.getByRole('button', { name: mode === 'bn' ? 'সাইন ইন লিংক পাঠান' : 'Email sign-in link' });
      await expect(send).toBeVisible();
      const bounds = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(bounds.scroll, mode + ' at ' + width + 'px overflows').toBeLessThanOrEqual(bounds.client + 1);
    }
  }
});
