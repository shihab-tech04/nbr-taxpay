import { expect, test } from '@playwright/test';

test('an already signed-in taxpayer starts payment without a second login prompt', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  // Sign-in lands in the taxpayer dashboard; the payment service chooser is on Home.
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Advance Tax/ }).click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' })).toHaveCount(0);
});

test('signed-in own-tax payment uses the account TIN read-only and never carries it into someone else’s tax', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Tax with Return/ }).click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  const ownTax = payment.getByRole('radio', { name: 'My own tax' });
  const otherTax = payment.getByRole('radio', { name: "Someone else's tax" });
  const tin = payment.getByRole('textbox', { name: 'Taxpayer’s TIN *' });
  await expect(ownTax).not.toBeChecked();
  await expect(otherTax).not.toBeChecked();
  await expect(tin).toHaveValue('');

  await ownTax.check();
  await expect(tin).toHaveValue('2222222222222');
  await expect(tin).toHaveAttribute('readonly', '');
  await expect(payment.getByText('Your account taxpayer details are prefilled and read-only.')).toBeVisible();
  await expect(payment.getByRole('textbox', { name: 'Mobile number for receipt *' })).toHaveValue('01700000002');
  await expect(payment.getByRole('textbox', { name: 'Mobile number for receipt *' })).toHaveAttribute('readonly', '');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.getByText('Step 2 of 4')).toBeVisible();

  await payment.getByRole('button', { name: 'Back', exact: true }).click();
  await otherTax.check();
  await expect(tin).toHaveValue('');
  await expect(tin).not.toHaveAttribute('readonly', '');
  await tin.fill('123456789012');
  await ownTax.check();
  await expect(tin).toHaveValue('2222222222222');
  await expect(tin).toHaveAttribute('readonly', '');
});
