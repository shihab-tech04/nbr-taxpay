import { expect, test } from '@playwright/test';

test('one decision per shared modal screen with selection retained on Back', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const next = dialog.getByRole('button', { name: 'Continue', exact: true });
  const back = dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back', exact: true });
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Pay Tax');
  await expect(dialog.locator('.taxpay-modal__close')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__back')).toHaveCount(0);
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toContainText('Pay tax for myself.');
  await expect(dialog.locator('[data-payer-relationship="OTHER"]')).toContainText('Pay on behalf of another taxpayer.');
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(0);
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(0);
  await expect(next).toBeDisabled();
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Which tax would you like to pay?' })).toBeVisible();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(0);
  await expect(next).toBeDisabled();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await next.click();
  await expect(dialog.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const account = dialog.locator('[data-payment-access="ACCOUNT"]');
  await expect(guest).toContainText('Walk-in Payment');
  await expect(guest).toContainText('Enter your details and make this payment');
  await expect(account).toContainText('Sign-in Payment');
  await expect(dialog.locator('[data-payment-access]').first()).toHaveAttribute('data-payment-access', 'ACCOUNT');
  await expect(dialog.locator('[data-payment-access]').last()).toHaveAttribute('data-payment-access', 'GUEST');
  await expect(next).toBeDisabled();
  const title = await dialog.locator('.taxpay-modal__title').boundingBox();
  const modal = await dialog.boundingBox();
  expect(title).not.toBeNull();
  expect(modal).not.toBeNull();
  expect(Math.abs(title!.x + title!.width/2 - (modal!.x + modal!.width/2))).toBeLessThan(3);
  await guest.click();
  await expect(guest).toHaveAttribute('aria-pressed', 'true');
  await back.click();
  await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await back.click();
  await expect(dialog.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  await next.click();
  await next.click();
  await expect(guest).toHaveAttribute('aria-pressed', 'true');
  await next.click();
  await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
  await dialog.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(guest).toHaveAttribute('aria-pressed', 'true');
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
  const standalone = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(standalone).toHaveAttribute('data-public-service', 'login');
  await expect(standalone).toHaveClass(/taxpayer-login-modal/);
  const width = await standalone.evaluate(el => getComputedStyle(el).width);
  const padding = await standalone.locator('.taxpay-modal__body').evaluate(el => getComputedStyle(el).padding);
  const standaloneFooter = await standalone.locator('.taxpayer-login-actions').evaluate(el => ({
    display: getComputedStyle(el).display,
    justify: getComputedStyle(el).justifyContent,
  }));
  const standaloneButton = await standalone.getByRole('button',{name:'Sign In'}).evaluate(el => ({
    height: Math.round(el.getBoundingClientRect().height),
    width: Math.round(el.getBoundingClientRect().width),
  }));
  await expect(standalone.locator('.taxpayer-login-actions')).toHaveCount(1);
  await expect(standalone.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(1);
  await standalone.getByRole('button', { name: 'Close modal' }).click();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  const embedded = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(embedded).toHaveAttribute('data-public-service', 'login');
  await expect(embedded).toHaveClass(/taxpayer-login-modal/);
  await expect(embedded.locator('.taxpay-modal__back')).toBeVisible();
  await expect(embedded.locator('.taxpay-modal__footer').getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await expect.poll(() => embedded.evaluate(el => getComputedStyle(el).width)).toBe(width);
  expect(await embedded.locator('.taxpay-modal__body').evaluate(el => getComputedStyle(el).padding)).toBe(padding);
  await expect(embedded.locator('.taxpayer-login-actions')).toHaveCount(1);
  await expect(embedded.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(1);
  expect(await embedded.locator('.taxpayer-login-actions').evaluate(el => ({
    display: getComputedStyle(el).display,
    justify: getComputedStyle(el).justifyContent,
  }))).toEqual(standaloneFooter);
  expect(await embedded.getByRole('button',{name:'Sign In'}).evaluate(el => ({
    height: Math.round(el.getBoundingClientRect().height),
    width: Math.round(el.getBoundingClientRect().width),
  }))).toEqual(standaloneButton);
  await embedded.getByRole('button', { name: 'Back' }).click();
  await expect(payment.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
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
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
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


test('changing payer via Back preserves chosen access and tax service', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const next = dialog.getByRole('button', { name: 'Continue', exact: true });
  const back = dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back', exact: true });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await next.click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await next.click();
  await dialog.locator('[data-payment-access="ACCOUNT"]').click();
  await back.click();
  await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await back.click();
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await next.click();
  await next.click();
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toBeEnabled();
});

test('access cards align side by side on desktop and stack on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
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
  // The approved order is account first and walk-in second; wait for responsive layout to settle.
  await expect.poll(async () => {
    const mobileFirst = await login.boundingBox();
    const mobileSecond = await guest.boundingBox();
    return mobileFirst && mobileSecond ? mobileSecond.y - (mobileFirst.y + mobileFirst.height) : -Infinity;
  }).toBeGreaterThanOrEqual(0);
});

test('compact modal animates between decisions and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog).toHaveAttribute('data-size-motion', 'true');
  await expect(dialog.locator('[data-decision-step="1"]')).toBeVisible();
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[data-decision-step="2"]')).toBeVisible();
  await expect(dialog).toHaveCSS('transition-property', /height/);
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[data-decision-step="3"]')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(dialog).toHaveCSS('transition-property', 'none');
});
