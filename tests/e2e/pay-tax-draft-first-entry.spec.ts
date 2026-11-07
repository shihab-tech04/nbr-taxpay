import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('signed-in Pay Tax offers saved drafts before original journey and restores the selected form', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user28');
  await login.getByLabel('Password', { exact: true }).fill('user28');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });

  // This account may or may not have drafts before this test. Starting new
  // must always keep the existing payer/service selection untouched.
  const initialChoice = dialog.getByTestId('account-draft-entry');
  await expect.poll(async () => {
    const loading = initialChoice.getByText('Checking your saved payment drafts…');
    return (await loading.count()) === 0;
  }).toBe(true);
  const startNew = initialChoice.getByRole('button', { name: 'Start new Tax payment' });
  if (await startNew.count()) await startNew.click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);

  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'SELF');
  const notice = dialog.locator('#guest-notice-ref');
  await expect(notice).toBeEditable();
  const marker = 'DRAFT-ENTRY-' + Date.now().toString();
  await notice.fill(marker);
  await dialog.getByRole('button', { name: 'Save Draft' }).click();
  await expect(dialog.getByRole('button', { name: 'Draft Saved' })).toBeVisible();
  await expect(dialog.getByText('Draft saved to your account. You can continue in another browser.')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const draftEntry = dialog.getByTestId('account-draft-entry');
  await expect(draftEntry.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
  const entryCards = draftEntry.locator('[data-draft-entry-option]');
  await expect(entryCards).toHaveCount(2);
  // Same approved card geometry, token-based colored icons and navigation arrows
  // as the existing My Tax Liability / Other Tax entry cards at 320/375/desktop.
  const visual = await entryCards.evaluateAll(cards => cards.map(card => {
    const icon = card.querySelector<HTMLElement>('.tax-service-choice__icon')!;
    const arrow = card.querySelector<HTMLElement>('.tax-service-choice__access-arrow')!;
    const copy = card.querySelector<HTMLElement>('.tax-service-choice__copy')!;
    const cardBox = card.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    return {
      option: card.getAttribute('data-draft-entry-option'),
      row: getComputedStyle(card).flexDirection,
      radius: getComputedStyle(card).borderRadius,
      borderWidth: getComputedStyle(card).borderTopWidth,
      iconWidth: iconBox.width,
      iconHeight: iconBox.height,
      iconColor: getComputedStyle(icon).color,
      iconBackground: getComputedStyle(icon).backgroundColor,
      arrowColor: getComputedStyle(arrow).color,
      textFont: getComputedStyle(copy.querySelector('strong')!).fontSize,
      inBounds: iconBox.left >= cardBox.left - 1 && arrowBox.right <= cardBox.right + 1,
      centered: Math.abs((iconBox.top + iconBox.height / 2) - (arrowBox.top + arrowBox.height / 2)) <= 1,
    };
  }));
  expect(visual.map(row => row.option)).toEqual(['NEW', 'RESUME']);
  expect(new Set(visual.map(row => row.iconColor)).size).toBe(2);
  expect(new Set(visual.map(row => row.iconBackground)).size).toBe(2);
  expect(visual.every(row => row.iconBackground !== 'rgba(0, 0, 0, 0)' &&
    row.iconBackground !== 'rgb(255, 255, 255)' &&
    row.row === 'row' && row.borderWidth === '1px' &&
    row.iconWidth === visual[0].iconWidth && row.iconHeight === visual[0].iconHeight &&
    row.radius === visual[0].radius && row.textFont === visual[0].textFont &&
    row.arrowColor !== 'rgb(0, 0, 0)' && row.inBounds && row.centered)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
  await draftEntry.getByRole('button', { name: 'Continue from draft' }).click();
  // The shared modal header owns Back. Never show a stray body button or blank footer.
  const headerBack = dialog.locator('.taxpay-modal__header .taxpay-modal__back');
  await expect(headerBack).toBeVisible();
  await expect(headerBack).toHaveAttribute('aria-label', 'Back');
  // The shared header grid must put the title after Back, never over the arrow.
  // This test runs at 320px, 375px, and desktop in the existing browser projects.
  const headerPositions = await dialog.locator('.taxpay-modal__header').evaluate(header => {
    const back = header.querySelector<HTMLElement>('.taxpay-modal__back')!;
    const title = header.querySelector<HTMLElement>('.taxpay-modal__title')!;
    const close = header.querySelector<HTMLElement>('.taxpay-modal__close')!;
    return {
      backRight: back.getBoundingClientRect().right,
      titleLeft: title.getBoundingClientRect().left,
      titleRight: title.getBoundingClientRect().right,
      closeLeft: close.getBoundingClientRect().left,
      titleText: title.textContent?.trim(),
    };
  });
  expect(headerPositions.titleText).toBe('Pay Tax');
  expect(headerPositions.titleLeft - headerPositions.backRight,
    'Pay Tax title must begin after the Back button, without overlap').toBeGreaterThanOrEqual(7);
  expect(headerPositions.closeLeft - headerPositions.titleRight,
    'Pay Tax title must end before the Close button').toBeGreaterThanOrEqual(7);
  // Keep the approved X alongside the header arrow; neither action belongs in the body.
  await expect(dialog.locator('.taxpay-modal__header .taxpay-modal__close')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer')).toHaveCount(0);
  await expect(draftEntry.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await headerBack.click();
  await expect(draftEntry.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
  await expect(headerBack).toHaveCount(0);
  // Without a Back action, the same approved header starts at the card alignment.
  const noBackAlignment = await dialog.locator('.taxpay-modal__header').evaluate(header => {
    const title = header.querySelector<HTMLElement>('.taxpay-modal__title')!;
    return title.getBoundingClientRect().left - header.getBoundingClientRect().left;
  });
  expect(noBackAlignment).toBeGreaterThanOrEqual(0);
  expect(noBackAlignment).toBeLessThan(40);
  await draftEntry.getByRole('button', { name: 'Continue from draft' }).click();
  await expect(headerBack).toBeVisible();
  const savedList = draftEntry.getByTestId('saved-payment-draft-list');
  await expect(savedList.locator('[data-draft-id]').first()).toBeVisible();
  await savedList.locator('[data-draft-id]').first().click();

  await expect(dialog.getByTestId('account-draft-entry')).toHaveCount(0);
  await expect(dialog.locator('#guest-notice-ref')).toHaveValue(marker);
  await expect(dialog.getByRole('button', { name: 'Save Draft' })).toBeVisible();

  // Re-entering a fresh payment remains the original journey even with drafts.
  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  await dialog.getByTestId('account-draft-entry')
    .getByRole('button', { name: 'Start new Tax payment' }).click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(0);
});
