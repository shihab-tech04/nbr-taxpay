import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('signed-in Pay Tax offers saved drafts before original journey and restores the selected form', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user28');
  await login.getByLabel('Password', { exact: true }).fill('user28');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });

  // This account may or may not have drafts before this test. Starting new
  // must always keep the existing payer/service selection untouched.
  const initialChoice = dialog.getByTestId('account-draft-entry');
  await expect.poll(async () => {
    const loading = initialChoice.getByText('Checking your saved payment drafts…');
    return (await loading.count()) === 0;
  }).toBe(true);
  const startNew = initialChoice.getByRole('button', { name: 'Start new Tax payment' });
  if (await startNew.count()) await startNew.click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);

  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'SELF');
  const notice = dialog.locator('#guest-notice-ref');
  await expect(notice).toBeEditable();
  const marker = 'DRAFT-ENTRY-' + Date.now().toString();
  await notice.fill(marker);
  await dialog.getByRole('button', { name: 'Save Draft' }).click();
  await expect(dialog.getByText('Draft saved to your account. You can continue in another browser.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const draftEntry = dialog.getByTestId('account-draft-entry');
  await expect(draftEntry.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
  await draftEntry.getByRole('button', { name: 'Continue from draft' }).click();
  // The shared modal header owns Back. Never show a stray body button or blank footer.
  const headerBack = dialog.locator('.taxpay-modal__header .taxpay-modal__back');
  await expect(headerBack).toBeVisible();
  await expect(headerBack).toHaveAttribute('aria-label', 'Back');
  // Keep the approved X alongside the header arrow; neither action belongs in the body.
  await expect(dialog.locator('.taxpay-modal__header .taxpay-modal__close')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer')).toHaveCount(0);
  await expect(draftEntry.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await headerBack.click();
  await expect(draftEntry.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
  await expect(headerBack).toHaveCount(0);
  await draftEntry.getByRole('button', { name: 'Continue from draft' }).click();
  await expect(headerBack).toBeVisible();
  const savedList = draftEntry.getByTestId('saved-payment-draft-list');
  await expect(savedList.locator('[data-draft-id]').first()).toBeVisible();
  await savedList.locator('[data-draft-id]').first().click();

  await expect(dialog.getByTestId('account-draft-entry')).toHaveCount(0);
  await expect(dialog.locator('#guest-notice-ref')).toHaveValue(marker);
  await expect(dialog.getByRole('button', { name: 'Save Draft' })).toBeVisible();

  // Re-entering a fresh payment remains the original journey even with drafts.
  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  await dialog.getByTestId('account-draft-entry')
    .getByRole('button', { name: 'Start new Tax payment' }).click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(0);
});
