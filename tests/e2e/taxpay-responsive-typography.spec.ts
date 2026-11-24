import { expect, test } from '@playwright/test';

/* Checks real computed styles, not only static token declarations.
   Covers EN/BN, narrow phones, tablet, laptop and wide desktop. */
test('citizen six-step typography responds without shrinking form text or overflowing', async ({ page }) => {
  for (const width of [320, 375, 480, 767, 768, 1024, 1280, 1920]) {
    for (const lang of ['en', 'bn']) {
      await page.setViewportSize({width, height: 900});
      await page.goto('/?action=landing&lang='+lang);
      await expect(page.locator('.taxpay-citizen-shell')).toBeVisible();
      const values = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('.taxpay-citizen-shell')!;
        const probe = (className: string) => {
          const el = document.createElement('div');
          el.className = className;
          shell.appendChild(el);
          const size = parseFloat(getComputedStyle(el).fontSize);
          el.remove();
          return size;
        };
        const input = document.createElement('input');
        input.type = 'text';
        shell.appendChild(input);
        const inputSize = parseFloat(getComputedStyle(input).fontSize);
        input.remove();
        return {
          micro: probe('taxpay-type-micro'),
          body: probe('taxpay-type-body'),
          section: probe('taxpay-type-h2'),
          page: probe('taxpay-type-h1'),
          inputSize,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(values.micro, JSON.stringify({width,lang,values})).toBe(12);
      expect(values.body).toBe(16);
      expect(values.inputSize).toBe(16);
      expect(values.section).toBe(width >= 768 ? 24 : 20);
      expect(values.page).toBe(width >= 1024 ? 32 : width >= 480 ? 28 : 24);
      expect(values.overflow, JSON.stringify({width,lang,values})).toBeLessThanOrEqual(2);
    }
  }
});
