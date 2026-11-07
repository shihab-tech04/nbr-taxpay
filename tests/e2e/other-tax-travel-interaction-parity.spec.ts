import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

for (const locale of ['en', 'bn'] as const) {
  test(`Other Tax matches Travel Tax search → details → add → another sequence (${locale})`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing');
    await page.getByRole('button', {name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax', exact: true}).first().click();
    const modal = page.getByRole('dialog', {name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax'});
    await modal.locator('[data-payer-relationship="OTHER"]').click();
    await modal.locator('[data-payment-entry="OTHER_TAX"]').click();
    await modal.locator('[data-payment-access="GUEST"]').click();
    await modal.locator('.tax-service-choice__actions').getByRole('button', {
      name: locale === 'bn' ? 'এগিয়ে যান' : 'Continue', exact: true,
    }).click();
    const primary = modal.getByTestId('other-tax-primary-taxpayer');
    const tin = primary.locator('#guest-tin');
    const addName = locale === 'bn' ? 'করদাতা যোগ করুন' : 'Add taxpayer';
    const nextName = locale === 'bn' ? 'আরেকজন করদাতা যোগ করুন' : 'Add another taxpayer';
    await expect(primary.locator('.tin-lookup__name')).toBeHidden();
    await expect(primary.getByTestId('searched-taxpayer-card')).toHaveCount(0);
    await expect(primary.getByRole('button', {name: addName})).toHaveCount(0);
    await expect(modal.getByRole('button', {name: nextName})).toHaveCount(0);
    const before = await primary.evaluate(el => el.getBoundingClientRect().height);
    await tin.focus();
    const suggestions = modal.getByRole('listbox', {name: locale === 'bn' ? 'প্রস্তাবিত টিআইএন' : 'Suggested TIN numbers'});
    await expect(suggestions).toHaveCount(0); // Focus does not open all suggestions.
    await tin.fill('1');
    await expect(suggestions).toBeVisible();
    const after = await primary.evaluate(el => el.getBoundingClientRect().height);
    expect(Math.abs(before - after)).toBeLessThan(3); // overlay never expands the card
    await suggestions.getByRole('option', {name: '111111111111'}).click();
    await expect(tin).toHaveValue('111111111111');
    await expect(suggestions).toHaveCount(0); // Selecting must not reopen the dropdown.
    await expect(primary.getByTestId('searched-taxpayer-card')).toHaveCount(0);
    await primary.getByRole('button', {name: locale === 'bn' ? 'খুঁজুন' : 'Search', exact: true}).click();
    const detail = primary.getByTestId('searched-taxpayer-card');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(locale === 'bn' ? 'ইউজার 1' : 'User 1');
    await expect(detail).toContainText('111111111111');
    await expect(detail.getByRole('button', {name: addName})).toHaveCount(0);
    await expect(primary.locator('.taxpay-taxpayer-row__fields > .taxpay-taxpayer-row__confirm-add')).toHaveCount(1);
    await expect(primary.getByRole('button', {name: addName})).toBeVisible();
    await expect(modal.getByRole('button', {name: nextName})).toHaveCount(0);
    await primary.getByRole('button', {name: addName}).click();
    await expect(primary.getByTestId('confirmed-taxpayer-card')).toContainText('111111111111');
    await expect(modal.getByRole('button', {name: nextName})).toBeVisible();
    await modal.getByRole('button', {name: nextName}).click();
    const second = modal.getByTestId('other-tax-taxpayer').last();
    await expect(second.getByTestId('searched-taxpayer-card')).toHaveCount(0);
    await second.locator('input[id^="other-tax-tin-"]').fill('222222222222');
    await second.getByRole('button', {name: locale === 'bn' ? 'খুঁজুন' : 'Search', exact: true}).click();
    await expect(second.getByTestId('searched-taxpayer-card')).toContainText(locale === 'bn' ? 'ইউজার 2' : 'User 2');
    await expect(second.getByTestId('searched-taxpayer-card').getByRole('button', {name: addName})).toHaveCount(0);
    await expect(second.locator('.taxpay-taxpayer-row__fields > .taxpay-taxpayer-row__confirm-add')).toHaveCount(1);
    await second.getByRole('button', {name: addName}).click();
    await expect(second.getByTestId('confirmed-taxpayer-card')).toContainText('222222222222');
    await second.getByRole('button', {name: locale === 'bn' ? 'সম্পাদনা' : 'Edit'}).click();
    await expect(second.getByTestId('confirmed-taxpayer-card')).toHaveCount(0);
    const clear = second.getByRole('button', {name: locale === 'bn' ? 'টিআইএন অনুসন্ধান মুছুন' : 'Clear TIN search'});
    await expect(clear).toBeVisible();
    await clear.click();
    const secondTin = second.locator('input[id^="other-tax-tin-"]');
    const secondSuggestions = modal.getByRole('listbox', {name: locale === 'bn' ? 'প্রস্তাবিত টিআইএন' : 'Suggested TIN numbers'});
    await expect(secondTin).toHaveValue('');
    await expect(secondTin).toBeFocused();
    await expect(secondSuggestions).toHaveCount(0); // Clear X restores focus without opening.
    await expect(second.getByTestId('searched-taxpayer-card')).toHaveCount(0);
    await secondTin.press('0');
    await expect(secondSuggestions).toBeVisible();
    await secondTin.press('ArrowDown');
    await expect(secondSuggestions.getByRole('option', {name: '000000000000'})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(secondTin).toHaveValue('000000000000');
    await expect(secondTin).toBeFocused();
    await expect(secondSuggestions).toHaveCount(0); // Keyboard selection must not reopen.
    await secondTin.press('Backspace');
    await expect(secondSuggestions).toBeVisible();
    await secondTin.press('Escape');
    await expect(secondSuggestions).toHaveCount(0);
    await expect(modal).toBeVisible(); // Escape closes suggestions, never the payment modal.
    await secondTin.press('0');
    await secondTin.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(secondSuggestions).toHaveCount(0);
    await expect(secondTin).toBeFocused();
    await expect(modal).toBeVisible();
    expect(await modal.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
  });
}

// Regression for a TIN input near the fixed footer: suggestions still open
// beneath the field in a scrollable overlay without growing the modal.
test('Other Tax TIN suggestions open below and remain reachable near the fixed footer', async ({page}) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', {name: 'Pay Tax', exact: true}).first().click();
  const modal = page.getByRole('dialog', {name: 'Pay Tax'});
  await enterTaxPayService(modal, 'OTHER_TAX_PAYMENT', 'OTHER');
  const first = modal.getByTestId('other-tax-primary-taxpayer');
  const input = first.locator('#guest-tin');
  await input.evaluate(element => element.scrollIntoView({block: 'end', inline: 'nearest', behavior: 'instant'}));
  await input.focus();
  const options = modal.getByRole('listbox', {name: 'Suggested TIN numbers'});
  await expect(options).toHaveCount(0);
  await input.fill('9');
  await expect(options).toBeVisible();
  const geometry = await options.evaluate(menu => {
    const dialog = menu.closest('.taxpay-modal');
    const anchor = dialog?.querySelector<HTMLInputElement>('#guest-tin');
    if (!dialog || !anchor) throw new Error('Expected TIN popup within its modal dialog shell');
    const menuRect = menu.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    return {top:menuRect.top,bottom:menuRect.bottom,height:menuRect.height,
      dialogBottom:dialogRect.bottom,inputBottom:anchorRect.bottom,
      placement:menu.getAttribute('data-placement')};
  });
  expect(geometry.placement).toBe('below');
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.inputBottom);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.dialogBottom+2);
  expect(geometry.height).toBeGreaterThan(40);
  await options.getByRole('option', {name: '999999999999'}).click();
  await expect(input).toHaveValue('999999999999');
  await expect(options).toHaveCount(0);
  await expect(modal.getByRole('button', {name: 'Continue to purpose & amount'})).toBeVisible();
});

test('Travel Tax Bangladeshi and foreign passport inputs have the same clear button without altering lookup', async ({page}) => {
  await page.goto('/?action=travel');
  const travel = page.locator('.travel-flow');
  const passport = travel.locator('#travel-passport-first');
  const clear = travel.getByRole('button', {name: 'Clear passport'});
  await expect(clear).toHaveCount(0);
  await passport.fill('TEST123456');
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(passport).toHaveValue('');
  await expect(passport).toBeFocused();
  await expect(clear).toHaveCount(0);
  await passport.fill('TEST123456');
  await travel.getByRole('button', {name: 'Check Passport'}).click();
  await expect(travel.getByRole('region', {name: 'Passenger details'})).toBeVisible();
  await clear.click();
  await expect(travel.getByRole('region', {name: 'Passenger details'})).toHaveCount(0);
  await travel.getByRole('tab', {name: 'Foreign passenger'}).click();
  await passport.fill('A1234567');
  await clear.click();
  await expect(passport).toHaveValue('');
  await expect(passport).toBeFocused();
});