import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, userId: 'user1' | 'user2') {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill(userId);
  await login.getByRole('textbox', { name: 'Password' }).fill(userId);
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=manage_authorization');
}

test('both authorization tabs stay visible on wide desktops and consent can be revoked', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signIn(page, 'user1');

  const authorization = page.getByTestId('manage-authorization');
  const directions = authorization.getByRole('navigation', { name: 'Authorization direction' });
  const outgoing = directions.getByRole('button', { name: 'I can pay for' });
  const incoming = directions.getByRole('button', { name: 'Can pay for me' });
  await expect(outgoing).toBeVisible();
  await expect(incoming).toBeVisible();

  await incoming.click();
  await expect(authorization.getByRole('heading', { name: 'People authorized to pay my tax' })).toBeVisible();
  await outgoing.click();
  await authorization.getByRole('button', { name: 'Add' }).click();
  await authorization.getByLabel('Taxpayer TIN').fill('2222222222222');
  await authorization.getByRole('button', { name: 'Request authorization' }).click();
  await expect(authorization.getByRole('status')).toContainText('Request created');
  await expect(authorization.getByText('Meghna Trading Ltd.')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, 'user2');
  const user2 = page.getByTestId('manage-authorization');
  await user2.getByRole('navigation', { name: 'Authorization direction' })
    .getByRole('button', { name: 'Can pay for me' }).click();
  await expect(user2.getByText('Md. Arif Rahman')).toBeVisible();
  const code = (await user2.locator('.taxpay-auth-approval strong').innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);
  await user2.getByRole('textbox', { name: 'Enter one-time code' }).fill(code);
  await user2.getByRole('button', { name: 'Authorize' }).click();
  await expect(user2.getByText('Active', { exact: true })).toBeVisible();

  await user2.getByRole('button', { name: 'Remove authorization' }).click();
  await user2.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(user2.getByRole('status')).toContainText('Authorization removed');
  await expect(user2.getByText('Revoked', { exact: true })).toBeVisible();
});
