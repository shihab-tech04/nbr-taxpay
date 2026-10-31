import { expect, test } from '@playwright/test';

// Runs in the existing desktop-1280, mobile-375 and mobile-320 projects.
// The entry modal must retain its progressive choices and shared footer.
for (const language of ['en', 'bn'] as const) {
  test(`Pay Tax progressive groups have readable spacing and token dividers (${language})`, async ({ page }) => {
    await page.goto(language === 'bn' ? '/?lang=bn' : '/');
    await page.getByRole('button', { name: language === 'bn' ? 'কর পরিশোধ' : 'Pay Tax', exact: true }).first().click();

    const dialog = page.locator('.taxpay-modal[data-public-service="payment-choice"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-payer-relationship="SELF"]').click();
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();

    const tax = dialog.locator('[data-entry-section="tax"]');
    const access = dialog.locator('[data-entry-section="access"]');
    await expect(tax).toBeVisible();
    await expect(access).toBeVisible();
    for (const section of [tax, access]) {
      await expect(section).toHaveCSS('border-top-width', '1px');
      await expect(section).toHaveCSS('border-top-style', 'solid');
      await expect(section).toHaveCSS('margin-top', '16px');
      await expect(section).toHaveCSS('padding-top', '16px');
    }

    // Keep the inherited footer border, not an extra nested modal/footer treatment.
    await expect(dialog.locator('.taxpay-modal__footer')).toHaveCSS('border-top-width', '1px');
    await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
    await expect(dialog.locator('[data-payment-access]')).toHaveCount(2);
    // Responsive groups must not create horizontal overflow.
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBe(true);
  });
}
