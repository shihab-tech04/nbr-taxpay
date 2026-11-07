import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

// Layout-only regression: never save data or submit a payment to hosted SQL.
for (const width of [320, 375, 1280]) {
  test('signed-in payment footer keeps draft actions left and Continue right at ' + width + 'px', async ({ page }, info) => {
    const expectedProject = width === 1280 ? 'desktop-1280' : 'mobile-' + width;
    test.skip(info.project.name !== expectedProject, 'The targeted viewport belongs to its own device project');
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/?action=taxpayer_login');
    const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
    await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
    await login.getByLabel('Password', { exact: true }).fill('user2');
    await login.getByRole('button', { name: 'Sign In' }).click();
    await expect(login).toHaveCount(0);
    await page.goto('/?action=landing');
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await enterTaxPayService(modal, 'TAX_WITH_RETURN', 'SELF');
    const footer = modal.locator('.taxpay-modal__footer');
    const actionGroup = footer.locator('.payment-form-draft-controls__actions');
    const save = actionGroup.getByRole('button', { name: 'Save Draft' });
    const resume = actionGroup.locator('.payment-form-draft-controls__open');
    const next = footer.getByRole('button', { name: 'Continue to purpose & amount' });
    await expect(save).toBeVisible();
    await expect(resume).toBeVisible();
    await expect(next).toBeVisible();
    await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
    const geometry = async () => {
      const [left, middle, right, bar] = await Promise.all([
        save.boundingBox(), resume.boundingBox(), next.boundingBox(), footer.boundingBox(),
      ]);
      expect(left && middle && right && bar).toBeTruthy();
      if (!left || !middle || !right || !bar) return;
      console.log('PAYMENT_FOOTER_GEOMETRY', JSON.stringify({ width, left, middle, right, bar }));
      expect(Math.abs(left.y - right.y)).toBeLessThan(6);
      expect(left.x + left.width).toBeLessThanOrEqual(middle.x + 2);
      expect(middle.x + middle.width).toBeLessThanOrEqual(right.x + 2);
      expect(right.x + right.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
      expect(left.width).toBeLessThan(bar.width * .5);
      expect(right.width).toBeLessThan(bar.width * .7);
    };
    await geometry();
    await next.click();
    await expect(modal.locator('.taxpay-modal__step-count')).toContainText('2/4');
    await expect(footer.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Continue to payment channel' })).toBeVisible();
    await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/payment-footer-drafts-' + width + '.png' });
  });
}
