import { expect, test } from '@playwright/test';

// Regression for the explicitly approved 1100px public rail. Logged-in
// dashboard / transactional layouts intentionally keep their own sizing.
test('public Home, Guide and Report share the approved 1100px desktop rail', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'The desktop matrix runs once');
  for (const action of ['landing', 'user_guide', 'incident'] as const) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?action=' + action);
    const contentSelector = action === 'landing'
      ? '.public-information-hub'
      : action === 'user_guide' ? '.public-guide-page' : '.public-report-page';
    await expect(page.locator(contentSelector)).toBeVisible();

    const desktop = await page.evaluate(selector => {
      const shell = document.querySelector<HTMLElement>('.taxpay-citizen-shell')!;
      const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        token: getComputedStyle(shell).getPropertyValue('--public-content-max').trim(),
        content: rect(selector).width,
        main: rect('main.public-information-main').width,
        header: rect('.public-home-header__inner').width,
        footer: rect('.public-footer__inner').width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, contentSelector);
    expect(desktop.token, action).toBe('1100px');
    expect(desktop.content, action).toBeCloseTo(1100, 0);
    expect(desktop.main, action).toBeCloseTo(1164, 0);
    expect(desktop.header, action).toBeCloseTo(1164, 0);
    expect(desktop.footer, action).toBeCloseTo(1164, 0);
    expect(desktop.overflow, action).toBeLessThanOrEqual(2);
  }
});

test('approved public rail preserves mobile overflow behavior in EN and BN', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'The narrow-screen check runs once');
  for (const language of ['en', 'bn'] as const) {
    for (const action of ['landing', 'user_guide', 'incident'] as const) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/?action=' + action + '&lang=' + language);
      await expect(page.locator('main.public-information-main')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, action + '/' + language).toBeLessThanOrEqual(2);
    }
  }
});
