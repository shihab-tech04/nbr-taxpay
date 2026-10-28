import { expect, test } from '@playwright/test';

test('payer and access match requested modal wording and button placement', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Whose tax liability are you settling?');
  await expect(dialog.locator('.taxpay-modal__close')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__back')).toHaveCount(0);
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toContainText('Pay tax for myself.');
  await expect(dialog.locator('[data-payer-relationship="OTHER"]')).toContainText('Pay on behalf of another taxpayer.');
  await expect(dialog.getByRole('heading', { name: 'How you want to settle it?' })).toBeVisible();
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  await expect(guest).toContainText('As a guest User');
  await expect(guest).toContainText('Enter your details and make this payment');
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toContainText('Sign in to use your account details and records');
  await expect(dialog.locator('.tax-service-choice__access-arrow')).toHaveCount(2);
  await expect(dialog.locator('.tax-service-choice__access-options .tax-service-choice__radio')).toHaveCount(0);
  const title = await dialog.locator('.taxpay-modal__title').boundingBox();
  const modal = await dialog.boundingBox();
  expect(title).not.toBeNull();
  expect(modal).not.toBeNull();
  expect(Math.abs(title!.x + title!.width/2 - (modal!.x + modal!.width/2))).toBeLessThan(3);
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.taxpay-modal__back')).toBeVisible();
  await dialog.locator('.taxpay-modal__back').click();
  await expect(dialog.locator('[data-payment-access="GUEST"]')).toHaveAttribute('aria-pressed', 'true');
});

test('standalone login retains divided eTIN-style form and existing credentials', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(dialog.locator('.taxpayer-login-heading__close')).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Sign In'})).toBeVisible();
  await expect(dialog.locator('.taxpayer-login-heading')).toHaveCSS('display','grid');
  await expect(dialog.locator('.taxpayer-login-actions')).toHaveCSS('border-top-style','solid');
});