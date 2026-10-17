import { expect, test } from '@playwright/test';

test('mobile chooser, four payment steps and footer actions remain usable', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1280', 'Mobile regression at 320px and 375px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  const footer = chooser.locator('.taxpay-modal__footer');
  const progress = chooser.locator('.tax-service-choice__progress');

  await expect(progress).toHaveCount(0); // Service selection is not a numbered step.
  await expect(footer.getByRole('button')).toHaveCount(1);
  await expect(footer.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(chooser.getByRole('button', { name: 'Close payment services' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

  await chooser.getByRole('button', { name: /Penalty/ }).click();
  await footer.getByRole('button', { name: 'Continue' }).click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '1. Taxpayer details');
  await expect(chooser.locator('.payment-form-section')).toHaveCount(2);
  await expect(chooser.locator('#guest-category')).toHaveCount(0);
  await expect(chooser.locator('.payment-form-section').last()).toContainText('Taxpayer identification');

  const buttons = footer.getByRole('button');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.first()).toHaveAccessibleName('Back to services');
  await expect(buttons.last()).toHaveAccessibleName('Continue to payment details');
  await chooser.locator('#guest-tin').fill('123456789012');
  await chooser.locator('#guest-phone').fill('01712345678');
  await buttons.last().click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '2. Payment details');
  await expect(chooser.locator('.payment-form-section')).toHaveCount(2);
  await expect(chooser.locator('.payment-form-section').last()).toContainText('Payment amount');
  await expect(chooser.locator('.payment-form-summary__total')).toBeVisible();
  expect(await chooser.locator('.payment-head-options').evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
  const originalHead = await chooser.locator('.payment-head-options input:checked').inputValue();
  await chooser.locator('#guest-head-search').fill('no-matching-head-123');
  await expect(chooser.locator('.payment-head-options')).toContainText('No matching payment heads');
  await chooser.locator('#guest-head-search').fill('');
  await expect(chooser.locator('.payment-head-options input:checked')).toHaveValue(originalHead);

  await expect(buttons.last()).toHaveAccessibleName('Continue to review');
  const backBox = await buttons.first().boundingBox();
  const nextBox = await buttons.last().boundingBox();
  expect(backBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  expect(Math.abs(backBox!.y - nextBox!.y)).toBeLessThan(2);
  expect(backBox!.x + backBox!.width).toBeLessThan(nextBox!.x);
  expect(nextBox!.x + nextBox!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
  const bodyOverflow = await chooser.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(bodyOverflow).toBeLessThanOrEqual(1);

  await chooser.getByRole('radio', { name: 'Person other than company' }).check();
  await chooser.locator('#guest-tax-amount').fill('2100');
  await expect(chooser.locator('.payment-form-summary__total')).toContainText('2,100');
  await buttons.last().click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '3. Payment channel');
  await expect(footer.getByRole('button')).toHaveCount(2);
  await footer.locator('.tax-service-choice__cancel').click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '2. Payment details');
  await expect(chooser.locator('#guest-tax-amount')).toHaveValue('2100');
  await footer.locator('.tax-service-choice__cancel').click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '1. Taxpayer details');
  await footer.getByRole('button', { name: 'Back to services' }).click();
  await expect(progress).toHaveCount(0);
  await expect(chooser.getByRole('button', { name: /Penalty/ })).toHaveAttribute('aria-pressed', 'true');
  await chooser.getByRole('button', { name: 'Close payment services' }).click();
  await expect(chooser).toHaveCount(0);
});

test('guest amount view recalculates the right-hand summary', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Two-column geometry on desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Advance Tax/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();

  await page.locator('#guest-tin').fill('123456789012');
  await page.locator('#guest-phone').fill('01712345678');
  await chooser.getByRole('button', { name: /Continue to payment details/ }).click();

  const sections = chooser.locator('.payment-form-section');
  const summary = chooser.locator('.payment-form-summary');
  await expect(sections).toHaveCount(2);
  await expect(summary).toHaveCount(1);
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Advance');
  const columns = await chooser.locator('.payment-flow-embedded__content').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);

  await expect(sections.first().locator('h2')).toContainText('Payment purpose & head');
  await expect(chooser.locator('.payment-head-single')).toHaveCount(0);
  await chooser.getByRole('radio', { name: 'Person other than company' }).check();
  await page.locator('#guest-tax-amount').fill('21875');
  await expect(page.locator('.payment-form-summary__total')).toContainText('21,875');
  await page.locator('#guest-tax-amount').fill('12000');
  await expect(page.locator('.payment-form-summary__total')).toContainText('12,000');
  await chooser.getByRole('button', { name: /Continue to review/ }).click();
  await expect(chooser.getByText('Step 3 of 4')).toBeVisible();
  await expect(chooser.getByText('Payment summary', { exact: true })).toBeVisible();
  await expect(chooser.getByText('BDT 12,000', { exact: true })).toBeVisible();
  await chooser.getByRole('button', { name: 'Pay online' }).click();
  await chooser.getByRole('radio', { name: 'bKash' }).check();
  await chooser.getByRole('checkbox', { name: /I have checked the TIN/ }).check();
  await chooser.getByRole('button', { name: /Pay BDT 12,000/ }).click();
  await expect(chooser.getByText('Step 4 of 4')).toBeVisible();
  await expect(chooser.getByTestId('payment-lifecycle').getByText('CREDITED')).toBeVisible({ timeout: 12000 });
  await expect(chooser.getByRole('heading', { name: 'Payment process complete' })).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
});

test('small-screen return payment uses one fixed head and inline field validation', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Focused mobile form accessibility regression');
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Tax with Return/ }).click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await payment.getByRole('button', { name: 'Continue to payment details' }).click();
  await expect(payment.locator('#guest-tin')).toBeFocused();
  await expect(payment.getByRole('alert')).toContainText('12-digit');

  await payment.locator('#guest-tin').fill('123456789012');
  await payment.locator('#guest-phone').fill('01712345678');
  await payment.getByRole('button', { name: 'Continue to payment details' }).click();
  await expect(payment.locator('.payment-head-single')).toBeVisible();
  await expect(payment.locator('#guest-head-search')).toHaveCount(0);
  await payment.getByRole('button', { name: 'Continue to review' }).click();
  await expect(payment.getByRole('alert')).toContainText('Choose the income tax type');
  await expect(payment.getByRole('radio', { name: 'Person other than company' })).toBeFocused();

  await payment.getByRole('radio', { name: 'Person other than company' }).check();
  await payment.locator('#guest-tax-amount').fill('-5');
  await payment.getByRole('button', { name: 'Continue to review' }).click();
  await expect(payment.getByRole('alert')).toContainText('greater than zero');
  await expect(payment.locator('#guest-tax-amount')).toBeFocused();
  await payment.locator('#guest-tax-amount').fill('1250.75');
  await payment.getByRole('button', { name: 'Continue to review' }).click();
  await expect(payment.locator('.tax-service-choice__progress [aria-current="step"]')).toHaveAttribute('aria-label', '3. Payment channel');
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(376);
});

test('Travel tax form applies exact v11 journey rates and age bands', async ({ page }) => {
  await page.goto('/?action=travel');
  const travel = page.locator('.travel-flow');
  const summary = travel.locator('.travel-flow__total');
  await expect(travel.locator('#travel-tax-route-results input[type="radio"]')).toHaveCount(6);
  await travel.locator('#travel-tax-route-1').check();
  await expect(summary).toContainText('2,000');
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await travel.getByLabel('Passenger age').selectOption('CHILD');
  await expect(summary).toContainText('1,000');
  await travel.getByLabel('Passenger age').selectOption('UNDER5');
  await expect(summary).toContainText('0');
  await travel.getByLabel('Passenger age').selectOption('ADULT');
  await expect(summary).toContainText('2,000');
  await travel.getByLabel('Passenger name (as in passport)').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport reference').fill('FAKE002');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await expect(travel.getByRole('heading', { name: 'Review travel details' })).toBeVisible();
});
