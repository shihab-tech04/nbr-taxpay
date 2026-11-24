import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails } from './travel-tax-test-helper';

async function reachTravelPreview(page: import('@playwright/test').Page, multiple = false) {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  if (multiple) {
    await modal.locator('.travel-passenger-workspace__blank').getByRole('button', {name:'Bangladeshi', exact:true}).click();
    const second = modal.locator('.travel-passenger-workspace__entry');
    await second.locator('input[role="combobox"]').fill('TEST230001');
    await second.getByRole('button', {name:'Check Passport'}).click();
    await modal.getByRole('button', {name:'Add passenger', exact:true}).click();
  }
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
    if (multiple) {
      await expect(list.locator('.travel-flow__age-row')).toHaveCount(2);
      const visible = await list.evaluate(el => {
        const rail = el.closest('.travel-flow__summary')!.getBoundingClientRect();
        return Array.from(el.querySelectorAll('.travel-flow__age-row')).every(row => {
          const box = row.getBoundingClientRect(); return box.top >= rail.top && box.bottom <= rail.bottom + 2;
        });
      });
      expect(visible, 'Two passengers must fit without a nested scrollbar at standard desktop size').toBe(true);
    }
  }
  await modal.getByRole('button', { name: 'Continue to review' }).click();
  return modal;
}

test('Travel Tax keeps taxpayer v5 review and checkout components without a squeezed payment rail', async ({ page }) => {
  const modal = await reachTravelPreview(page, true);
  const preview = modal.getByTestId('travel-unified-final-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveClass(/payment-review--unified-v5/);
  await expect(preview.locator('.unified-v3-review')).toBeVisible();
  await expect(preview.locator('.unified-v3-review__table tbody tr')).toHaveCount(2);
  await expect(preview.getByTestId('travel-preview-total')).toContainText('2,000');
  await expect(preview.getByTestId('travel-preview-total-in-words')).toContainText('Two Thousand');
  await expect(preview.locator('.unified-v3-review__table tfoot')).toHaveCount(0);
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await expect(modal.getByTestId('travel-preview-receipt-contact')).toBeVisible();
  await expect(preview.getByTestId('travel-payment-details')).toBeVisible();
  await expect(modal.getByRole('heading', {name:'Payer and receipt details'})).toBeVisible();
  await modal.screenshot({path: test.info().outputPath('travel-final-preview.png'),animations:'disabled'});
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
  await expect(checkout.locator('.unified-v5-review-total')).toHaveCount(0);
  await expect(modal.getByTestId('mobile-payment-calculation')).toHaveCount(0);
  const bounds = await checkout.evaluate(el => {
    const dialog = el.closest('.taxpay-modal')!;
    const header = dialog.querySelector('.taxpay-modal__header')!.getBoundingClientRect();
    const body = dialog.querySelector('.taxpay-modal__body')!.getBoundingClientRect();
    const footer = dialog.querySelector('.taxpay-modal__footer')!.getBoundingClientRect();
    return {top:body.top-header.bottom,bottom:footer.top-body.bottom,height:body.height};
  });
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeGreaterThanOrEqual(-1);
  expect(bounds.height).toBeGreaterThan(150);
  await expect(checkout.locator('.payment-review__method-groups')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await expect(checkout.locator('.payment-review__method-groups')).toBeVisible();
  await modal.screenshot({path:test.info().outputPath('travel-payment-channel.png'),animations:'disabled'});
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(modal.getByTestId('travel-unified-final-preview')).toBeVisible();
  await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
});

test('Travel Tax sample result uses the shared compact walk-in receipt and account actions', async ({ page }, info) => {
  test.skip(!['desktop-1280', 'mobile-375', 'mobile-320'].includes(info.project.name), 'Full simulated result checked on desktop and both narrow layouts');
  const modal = await reachTravelPreview(page);
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button', { name: 'Make Payment', exact: true }).click();
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button', { name: 'Confirm sample payment' }).click();
  const result = modal.getByTestId('travel-payment-result');
  await expect(result).toBeVisible({ timeout: 12000 });
  await expect(result.getByRole('heading', { name: 'Payment record saved' })).toBeVisible();
  await expect(result.locator('.payment-lifecycle__overview')).toContainText('1,000');
  await expect(result.getByTestId('walkin-result-benefits')).toBeVisible();
  await expect(result.locator('.walkin-result-benefits__actions button')).toHaveCount(2);
  await expect(modal.getByTestId('travel-family-challan')).toHaveCount(0);
  await modal.screenshot({path:info.outputPath('travel-payment-result.png'),animations:'disabled'});
  await result.getByTestId('walkin-challan-action').getByRole('button').first().click();
  await expect(modal.getByTestId('travel-family-challan')).toBeVisible({ timeout: 12000 });
  await expect(modal.locator('.payment-flow-embedded--receipt')).toBeVisible();
  await expect(modal.locator('.receipt-view--walkin')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await modal.screenshot({path:info.outputPath('travel-challan-details.png'),animations:'disabled'});
  await expect(modal.getByTestId('travel-family-challan')).toContainText(
    'not proof of government A-Challan issuance or Treasury settlement');
});
