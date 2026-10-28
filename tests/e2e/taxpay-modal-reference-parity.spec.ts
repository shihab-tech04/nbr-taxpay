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
  await expect(dialog.getByRole('heading', { name: 'How you want to settle it?' })).toHaveCount(0);
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await expect(dialog.getByRole('heading', { name: 'How you want to settle it?' })).toBeVisible();
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  await expect(guest).toContainText('As a guest User');
  await expect(guest).toContainText('Enter your details and make this payment');
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toContainText('Sign in to use your account details and records');
  await expect(dialog.locator('.tax-service-choice__access-arrow')).toHaveCount(0);
  await expect(dialog.locator('.tax-service-choice__access-radio')).toHaveCount(2);
  await expect(dialog.locator('[data-payment-access="GUEST"] .tax-service-choice__access-radio > span')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const title = await dialog.locator('.taxpay-modal__title').boundingBox();
  const modal = await dialog.boundingBox();
  expect(title).not.toBeNull();
  expect(modal).not.toBeNull();
  expect(Math.abs(title!.x + title!.width/2 - (modal!.x + modal!.width/2))).toBeLessThan(3);
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

test('access choices appear only after either payer selection and retain the chosen mode on change', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const access = dialog.locator('[data-payment-access]');
  await expect(access).toHaveCount(0);
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await expect(access).toHaveCount(2);
  await dialog.locator('[data-payment-access="ACCOUNT"]').click();
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await expect(access).toHaveCount(2);
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('access cards align side by side on desktop and stack on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const login = dialog.locator('[data-payment-access="ACCOUNT"]');
  const first = await guest.boundingBox();
  const second = await login.boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  expect(Math.abs(first!.width - second!.width)).toBeLessThan(2);
  await login.click();
  await expect(login).toHaveAttribute('aria-pressed', 'true');
  await expect(login.locator('.tax-service-choice__access-radio > span')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.setViewportSize({ width: 375, height: 812 });
  const mobileFirst = await guest.boundingBox();
  const mobileSecond = await login.boundingBox();
  expect(mobileFirst).not.toBeNull();
  expect(mobileSecond).not.toBeNull();
  expect(mobileSecond!.y).toBeGreaterThanOrEqual(mobileFirst!.y + mobileFirst!.height);
});

test('conditional modal resize uses standard motion and supports reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog).toHaveAttribute('data-size-motion', 'true');
  await expect.poll(async () => dialog.evaluate(el => getComputedStyle(el).height)).not.toBe('auto');
  const initialHeight = (await dialog.boundingBox())!.height;
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(2);
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBeGreaterThan(initialHeight + 75);
  await expect(dialog).toHaveCSS('transition-property', /height/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(dialog).toHaveCSS('transition-property', 'none');
});
