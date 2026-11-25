import { expect, test } from '@playwright/test';
import { enterTaxPayService, ensureNewPaymentEntry, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

test('an already signed-in taxpayer starts payment without a second login prompt', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  // Sign-in lands in the taxpayer dashboard; the payment service chooser is on Home.
  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await ensureNewPaymentEntry(payment);
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);
  await expect(payment.locator('[data-entry-section="access"]')).toHaveCount(0);
  await expect(payment.locator('[data-payment-access]')).toHaveCount(0);
  // A real signed-in session goes directly into the existing account payment flow.
  await expect(payment.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  await expect(payment.getByText('Continuing with your account')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' })).toHaveCount(0);
});

test('signed-in own-tax payment uses the account TIN read-only and never carries it into someone else’s tax', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'SELF');

  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.taxpay-modal__subtitle')).toContainText('My Tax Liability');
  await expect(payment.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  const card = payment.locator('#signed-in-account-taxpayer-card');
  await expect(card).toContainText('Meghna Trading Ltd.');
  await expect(card).toContainText('2222222222222');
  await expect(card).toContainText('01700000002');
  await expect(payment.locator('#guest-tin, #guest-phone, #guest-taxpayer-name')).toHaveCount(0);
  await expect(payment.locator('.payment-identity__fields input')).toHaveCount(1);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');

  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.taxpay-modal__subtitle')).toContainText("Facilitate another taxpayer’s payment");
  // Keep saved-beneficiary selection available after verified account sign-in.
  await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(1);
  await expect(payment.getByRole('heading',{name:'Choose beneficiaries',exact:true})).toHaveCount(1);
  await expect(payment.getByTestId('saved-beneficiary-picker').getByRole('button',{name:'Manage beneficiaries'})).toBeVisible();
  await expect(payment.locator('#guest-tin, #guest-payer-name, #guest-taxpayer-name')).toHaveCount(0);
  await expect(payment.getByRole('button',{name:'Add another taxpayer'})).toHaveCount(0);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toContainText('2222222222222');
  await expect(payment.locator('#guest-tin')).toHaveCount(0);
});

// Actual public hero login must not unmount its pending continuation when the
// account identity changes. Keep the approved start/resume choice, not a second
// sign-in/walk-in chooser. No hosted mutations: existing isolated browser suite.
for (const language of ['en','bn'] as const) {
  test('public Pay Tax sign-in continues without a second access chooser ('+language+')', async ({page}) => {
    await page.goto('/?action=landing&lang='+language);
    const active=page.locator('.public-hero-carousel__slide[aria-hidden="false"]');
    await active.getByRole('button',{name:language==='bn'?'কর পরিশোধ':'Pay Tax',exact:true}).click();
    const modal=page.getByRole('dialog',{name:language==='bn'?'কর পরিশোধ':'Pay Tax',exact:true});
    await expect(modal.locator('[data-view="entry"]')).toBeVisible();
    const user=modal.locator('#taxpayer-login-user-id');
    const password=modal.locator('#taxpayer-login-password');
    await user.fill('user2');
    await password.fill('incorrect');
    await modal.getByTestId('taxpayer-login-submit').click();
    await expect(modal.getByRole('alert')).toBeVisible();
    await expect(modal.locator('[data-view="entry"]')).toBeVisible();
    await password.fill('user2');
    await page.evaluate(()=>{
      const state={seen:false};
      Object.assign(window,{__payTaxAccessRegression:state});
      const check=()=>{if(document.querySelector('.taxpay-unified-entry__signed-in'))state.seen=true;};
      new MutationObserver(check).observe(document.body,{childList:true,subtree:true});
      check();
    });
    await modal.getByTestId('taxpayer-login-submit').click();
    await expect(modal.locator('[data-view="payer"]')).toBeVisible({timeout:15000});
    await expect(modal.locator('.taxpay-unified-entry__signed-in')).toHaveCount(0);
    await expect(modal.locator('.taxpay-unified-entry__walkin')).toHaveCount(0);
    await expect(modal.getByTestId('account-draft-entry')).toBeVisible();
    await modal.getByTestId('account-draft-entry').locator('[data-draft-entry-option="NEW"]').click();
    await expect(modal.locator('[data-view="payment"]')).toBeVisible();
    await expect(modal.locator('.taxpay-modal__subtitle')).toHaveText(language==='bn'?'সাইন-ইন পেমেন্ট':'Signed-in Payment');
    expect(await page.evaluate(()=> (window as unknown as {__payTaxAccessRegression:{seen:boolean}}).__payTaxAccessRegression.seen)).toBe(false);
  });
}
