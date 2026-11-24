import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails } from './travel-tax-test-helper';

async function reachTravelPreview(page: import('@playwright/test').Page) {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  await modal.getByRole('button', { name: 'Continue to travel details' }).click();
  await fillTravelDetails(modal);
  if ((page.viewportSize()?.width ?? 0) > 800) {
    const rail = modal.locator('.travel-flow__summary');
    const list = rail.locator('.travel-flow__age-breakdown');
    await expect(list).toBeVisible();
    const geometry = await rail.evaluate(el => ({
      railWidth: el.clientWidth,
      bodyWidth: el.closest('.taxpay-modal__body')!.clientWidth,
      overflow: getComputedStyle(el).overflowY,
      listOverflow: getComputedStyle(el.querySelector('.travel-flow__age-breakdown')!).overflowY,
    }));
    expect(geometry.railWidth).toBeGreaterThan(geometry.bodyWidth * 0.35);
    expect(geometry.overflow).toBe('auto');
    expect(geometry.listOverflow).toBe('visible');
  }
  await modal.getByRole('button', { name: 'Continue to review' }).click();
  return modal;
}

test('Travel Tax keeps taxpayer v5 review and checkout components without a squeezed payment rail', async ({ page }) => {
  const modal = await reachTravelPreview(page);
  const preview = modal.getByTestId('travel-unified-final-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveClass(/payment-review--unified-v5/);
  await expect(preview.locator('.unified-v3-review')).toBeVisible();
  await expect(preview.locator('.unified-v3-review__table tbody tr')).toHaveCount(1);
  await expect(preview.locator('.unified-v3-review__table tfoot')).toContainText('1,000');
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await expect(modal.getByTestId('travel-preview-receipt-contact')).toBeVisible();
  const metrics = await preview.evaluate(element => {
    const modalBody = element.closest('.taxpay-modal__body') as HTMLElement;
    return {
      overflow: modalBody.scrollWidth - modalBody.clientWidth,
      width: element.getBoundingClientRect().width,
      modalWidth: modalBody.getBoundingClientRect().width,
    };
  });
  expect(metrics.overflow).toBeLessThanOrEqual(2);
  expect(metrics.width).toBeGreaterThan(metrics.modalWidth * 0.8);
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button', { name: 'Make Payment', exact: true }).click();
  const checkout = modal.getByTestId('travel-payment-channel-screen');
  await expect(checkout).toBeVisible();
  await expect(checkout).toHaveClass(/payment-review--unified-v5/);
  await expect(checkout).toHaveClass(/unified-v5-payment-channel/);
  await expect(checkout.locator('.payment-review__channels')).toBeVisible();
  await expect(checkout.getByTestId('travel-checkout-total')).toContainText('1,000');
  if ((page.viewportSize()?.width ?? 0) >= 651) {
    await expect(modal.getByTestId('mobile-payment-calculation')).toBeHidden();
  } else {
    await expect(modal.getByTestId('mobile-payment-calculation')).toBeVisible();
  }
  await expect(checkout.locator('.payment-review__method-groups')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await expect(checkout.locator('.payment-review__method-groups')).toBeVisible();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(modal.getByTestId('travel-unified-final-preview')).toBeVisible();
  await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
});

test('Travel Tax sample result uses the shared compact walk-in receipt and account actions', async ({ page }, info) => {
  test.skip(!['desktop-1280', 'mobile-375'].includes(info.project.name), 'Full simulated result checked on representative layouts');
  const modal = await reachTravelPreview(page);
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button', { name: 'Make Payment', exact: true }).click();
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button', { name: 'Confirm sample payment' }).click();
  await expect(modal.getByTestId('travel-family-challan')).toBeVisible({ timeout: 12000 });
  await expect(modal.locator('.payment-flow-embedded--receipt')).toBeVisible();
  await expect(modal.locator('.receipt-view--walkin')).toBeVisible();
  await expect(modal.locator('.walkin-postpayment-login')).toBeVisible();
  await expect(modal.locator('.walkin-postpayment-login__actions button')).toHaveCount(2);
  await expect(modal.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await expect(modal.getByTestId('travel-family-challan')).toContainText(
    'not proof of government A-Challan issuance or Treasury settlement');
});
