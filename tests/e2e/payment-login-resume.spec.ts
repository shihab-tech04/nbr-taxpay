import { expect, test } from '@playwright/test';

test('the eight services clearly separate guest payments from account sign-in before proceeding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  const guestRoute = payment.getByRole('button', { name: /(Pay without login|Guest payment)/ });
  const accountRoute = payment.getByRole('button', { name: /(Use my account · Login required|Account login)/ });
  await expect(guestRoute).toHaveAttribute('aria-pressed', 'true');
  await expect(accountRoute).toHaveAttribute('aria-pressed', 'false');
  await expect(payment.getByRole('group', { name: 'Tax payment services' }).getByRole('button')).toHaveCount(8);

  await payment.getByRole('button', { name: /Assessed Demand/ }).click();
  await accountRoute.click();
  await expect(accountRoute).toHaveAttribute('aria-pressed', 'true');
  await payment.getByRole('button', { name: 'Proceed to login' }).click();
  const requirement = page.getByRole('alertdialog', { name: 'Sign in required' });
  await expect(requirement).toBeVisible();
  await requirement.getByRole('button', { name: 'Go to login' }).click();

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment.getByText('Step 1 of 4 · Taxpayer details')).toBeVisible();
  await expect(payment.locator('.tax-service-choice__selected-service strong')).toHaveText('Assessed Demand');
  await expect(payment.getByRole('heading', { name: 'Taxpayer identification' })).toBeVisible();
});

test('dismissed account requirement proceeds as guest in the selected service', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Source Tax Deposit/ }).click();
  await payment.getByRole('button', { name: /(Use my account · Login required|Account login)/ }).click();
  await payment.getByRole('button', { name: 'Proceed to login' }).click();
  await page.getByRole('alertdialog', { name: 'Sign in required' })
    .getByRole('button', { name: 'Continue without login' }).click();
  await expect(payment.locator('.tax-service-choice__selected-service strong')).toHaveText('Source Tax Deposit');
  await expect(payment.getByText('Step 1 of 4 · Taxpayer details')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('account sign-in returns to the exact selected service before data entry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Assessed Demand/ }).click();
  await payment.getByRole('button', { name: /(Use my account · Login required|Account login)/ }).click();
  await payment.getByRole('button', { name: 'Proceed to login' }).click();
  const requirement = page.getByRole('alertdialog', { name: 'Sign in required' });
  await expect(requirement).toBeVisible();
  await requirement.getByRole('button', { name: 'Go to login' }).click();

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(payment.locator('.tax-service-choice__selected-service strong')).toHaveText('Assessed Demand');
  await expect(payment.locator('#guest-tin')).toHaveValue('');
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment continues without a login and no account records are opened', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Source Tax Deposit/ }).click();
  await payment.getByRole('button', { name: 'Continue' }).click();
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Step 1 of 4 · Taxpayer details')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
