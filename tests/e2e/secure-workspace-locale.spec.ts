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
  await expect(page.getByText('ইমেইলে সাইন-ইন লিংক পাঠানো হবে।')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ইমেইল ঠিকানা' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signed-in application user' })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'ইমেইল ঠিকানা' }).fill('taxpay-locale@example.invalid');
  await page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' }).click();
  await expect(page.getByRole('status').last()).toContainText('নিরাপদ সাইন-ইন লিংকের জন্য আপনার ইমেইল দেখুন।');
  expect(otpRequests).toBe(1);

  if (await page.evaluate(() => window.innerWidth <= 900)) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const compactMenu = page.getByLabel('সংক্ষিপ্ত নেভিগেশন').getByRole('button', { name: 'মেনু খুলুন' });
    await expect(compactMenu).toBeVisible();
    await compactMenu.click();
    await page.getByRole('dialog').getByRole('button', { name: 'EN', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'EN', exact: true }).click();
  }
  await expect(page.getByRole('status').last()).toContainText('Check your email for the secure sign-in link.');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'বাংলা', exact: true }).click();
    await dialog.getByRole('button', { name: 'বন্ধ করুন' }).click();
  } else {
    await page.getByRole('button', { name: 'বাংলা' }).click();
  }
  await expect(page.getByRole('status').last()).toContainText('নিরাপদ সাইন-ইন লিংকের জন্য আপনার ইমেইল দেখুন।');

  const width = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    const overflowing = scroll <= client + 1
      ? []
      : Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .flatMap(element => {
          const rect = element.getBoundingClientRect();
          if (rect.right <= client + 1) return [];
          return [{
            tag: element.tagName,
            className: typeof element.className === 'string' ? element.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }];
        })
        .slice(0, 8);
    return { client, scroll, overflowing };
  });
  expect(width.scroll, JSON.stringify(width.overflowing)).toBeLessThanOrEqual(width.client + 1);
});


test('sign-in and localized workspace remain usable at all six Phase 02 widths', async ({ page }) => {
  await page.goto('/?action=secure_workspace');
  for (const width of [320, 360, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 800 : 740 });
    for (const mode of ['en', 'bn'] as const) {
      const section = page.locator('section[lang]').first();
      if (await section.getAttribute('lang') !== mode) {
        await page.getByRole('button', { name: mode === 'bn' ? 'বাংলা' : 'EN', exact: true }).click();
      }
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
