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

test('standalone login uses exactly the shared TaxPayModal header, body and right-aligned footer', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(dialog).toHaveClass(/taxpay-modal/);
  await expect(dialog.locator('.taxpay-modal__header')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__body .taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__close')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__back')).toHaveCount(0);
  await expect(dialog.locator('.taxpayer-login-heading,.taxpayer-login-backdrop')).toHaveCount(0);
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeFocused();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeDisabled();
  await dialog.getByRole('textbox',{name:'User ID'}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await expect(dialog.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeEnabled();
});
test('both login entry points use the identical reusable login modal variant', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const standalone=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(standalone).toHaveAttribute('data-public-service','login');
  await expect(standalone).toHaveClass(/taxpayer-login-modal/);
  const standaloneWidth=await standalone.evaluate(el=>getComputedStyle(el).width);
  const standaloneBodyPadding=await standalone.locator('.taxpay-modal__body').evaluate(el=>getComputedStyle(el).padding);
  await standalone.getByRole('button',{name:'Close modal'}).click();
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const payment=page.getByRole('dialog',{name:'Pay Tax'});
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  const embedded=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(embedded).toHaveAttribute('data-public-service','login');
  await expect(embedded).toHaveClass(/taxpayer-login-modal/);
  await expect(embedded).toHaveClass(/taxpay-modal/);
  await expect(embedded.locator('.taxpay-modal__header')).toBeVisible();
  await expect(embedded.locator('.taxpay-modal__footer')).toBeVisible();
  await expect(embedded.locator('.taxpay-modal__back')).toBeVisible();
  await expect(embedded.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeDisabled();
  // Compare CSS layout widths, not an animated bounding-box frame during modal entry.
  await expect.poll(() => embedded.evaluate(el=>getComputedStyle(el).width)).toBe(standaloneWidth);
  expect(await embedded.locator('.taxpay-modal__body').evaluate(el=>getComputedStyle(el).padding)).toBe(standaloneBodyPadding);
  await embedded.getByRole('button',{name:'Back'}).click();
  await expect(payment.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed','true');
});

test('homepage Login and payment journey account login use the same modal chrome', async ({ page }) => {
  await page.goto('/?action=landing');
  if (page.viewportSize()!.width <= 900) {
    await page.getByRole('button',{name:'Menu'}).click();
    await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Login'}).click();
  } else {
    await page.locator('.public-home-header__tools .public-home-login-link--desktop').click();
  }
  const standalone=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(standalone.locator('.taxpay-modal__header')).toBeVisible();
  await expect(standalone.locator('.taxpay-modal__body .taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(standalone.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeVisible();
  await standalone.getByRole('button',{name:'Close modal'}).click();
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const payment=page.getByRole('dialog',{name:'Pay Tax'});
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  // The shared modal stays mounted but its accessible name changes with the workflow step.
  const paymentLogin=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(paymentLogin.locator('.taxpay-modal__title')).toContainText('Sign In To Your Amar Kor Account');
  await expect(paymentLogin.locator('.taxpay-modal__body .taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(paymentLogin.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeDisabled();
  await expect(paymentLogin.locator('.taxpay-modal__back')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await paymentLogin.locator('.taxpay-modal__back').click();
  await expect(payment.locator('[data-payer-relationship="SELF"]')).toBeVisible();
  await payment.locator('.taxpay-modal__close').click();
  await expect(payment).toHaveCount(0);
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
  // The dialog itself is deliberately animating its height and vertical position.
  // Compare both cards only once that transition has settled.
  await expect.poll(async () => {
    const first = await guest.boundingBox();
    const second = await login.boundingBox();
    return first && second ? Math.abs(first.y - second.y) : Infinity;
  }).toBeLessThan(2);
  const first = await guest.boundingBox();
  const second = await login.boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
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
