import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice, openUnifiedSignedInPayment, enterLegacyPaymentAsAccount } from './pay-tax-entry-helper';
import type { Page } from '@playwright/test';

type EntryMode = 'unified' | 'guest-origin';
async function startAccountDraftPayment(page: Page, mode: EntryMode) {
  if (mode === 'guest-origin') return enterLegacyPaymentAsAccount(page, 'user2', 'TAX_WITH_RETURN', 'SELF');
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);
  const payment = await openUnifiedSignedInPayment(page);
  await payment.getByTestId('unified-account-own').getByRole('checkbox').check();
  return payment;
}

// Layout-only regression: never save data or submit a payment to hosted SQL.
for (const mode of ['unified', 'guest-origin'] as const) {
for (const width of [320, 375, 1280]) {
  test('signed-in payment footer keeps Save Draft left and Continue right without Drafts at ' + width + 'px (' + mode + ')', async ({ page }, info) => {
    const expectedProject = width === 1280 ? 'desktop-1280' : 'mobile-' + width;
    test.skip(info.project.name !== expectedProject, 'The targeted viewport belongs to its own device project');
    await page.setViewportSize({ width, height: 850 });
    const modal = await startAccountDraftPayment(page, mode);
    const nextLabel = mode === 'unified' ? 'Continue to Payment Head' : 'Continue to purpose & amount';
    const step2Label = mode === 'unified' ? 'Continue to Final Preview' : 'Continue to payment channel';
    const footer = modal.locator('.taxpay-modal__footer');
    const actionGroup = footer.locator('.payment-form-draft-controls__actions');
    const save = actionGroup.getByRole('button', { name: 'Save Draft' });
    const resume = actionGroup.locator('.payment-form-draft-controls__open');
    const next = footer.getByRole('button', { name: nextLabel, exact: true });
    await expect(save).toBeVisible();
    await expect(resume).toHaveCount(0);
    await expect(next).toBeVisible();
    if (width <= 375) {
      // Payment actions must stay readable, even at the 320px breakpoint.
      for (const action of [save, next]) {
        const size = await action.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
        expect(size, 'Payment footer action font must be at least 14px').toBeGreaterThanOrEqual(14);
      }
      expect(await footer.evaluate(node => node.scrollWidth - node.clientWidth),
        'The larger type must not create horizontal scrolling').toBeLessThanOrEqual(2);
    }
    await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
    const geometry = async () => {
      const [left, right, bar] = await Promise.all([
        save.boundingBox(), next.boundingBox(), footer.boundingBox(),
      ]);
      expect(left && right && bar).toBeTruthy();
      if (!left || !right || !bar) return;
      console.log('PAYMENT_FOOTER_GEOMETRY', JSON.stringify({ width, left, right, bar }));
      expect(Math.abs(left.y - right.y)).toBeLessThan(6);
      expect(left.x + left.width).toBeLessThanOrEqual(right.x + 2);
      expect(right.x + right.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
      expect(left.width).toBeLessThan(bar.width * .5);
      expect(right.width).toBeLessThan(bar.width * .7);
    };
    await geometry();
    await next.click();
    await expect(modal.locator('.taxpay-modal__step-count')).toContainText(mode === 'unified' ? '2/3' : '2/4');
    await expect(footer.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(footer.locator('.payment-form-draft-controls__open')).toHaveCount(0);
    await expect(footer.getByRole('button', { name: step2Label, exact: true })).toBeVisible();
    await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
    const step2Save = await footer.getByRole('button', { name: 'Save Draft' }).boundingBox();
    const step2Next = await footer.getByRole('button', { name: step2Label, exact: true }).boundingBox();
    const step2Footer = await footer.boundingBox();
    expect(step2Save && step2Next && step2Footer).toBeTruthy();
    if (step2Save && step2Next && step2Footer) {
      expect(Math.abs(step2Save.y - step2Next.y)).toBeLessThan(6);
      expect(step2Save.x + step2Save.width).toBeLessThan(step2Next.x);
      expect(step2Next.width).toBeLessThan(step2Footer.width * .7);
    }
    await page.screenshot({ path: 'test-results/payment-footer-drafts-' + mode + '-' + width + '.png' });
  });
}
}


test('Pay Tax header reserves the Back column without overlapping the title in EN/BN', async ({ page }, testInfo) => {
  // Layout-only regression: reproduce the same shared modal header's Back state
  // without writing account drafts, payments or authentication records.
  for (const language of ['en', 'bn'] as const) {
    const translated = language === 'bn';
    const label = translated ? 'কর পরিশোধ' : 'Pay Tax';
    await page.goto(translated ? '/?action=landing&lang=bn' : '/?action=landing');
    await openLegacyTaxServiceChoice(page);
    const modal = page.getByRole('dialog', { name: label });
    const header = modal.locator('.taxpay-modal__header');
    const title = header.locator('.taxpay-modal__title');
    const close = header.locator('.taxpay-modal__close');
    await expect(title).toHaveText(label);
    await expect(close).toBeVisible();
    await expect(header.locator('.taxpay-modal__back')).toHaveCount(0);

    // The first Pay Tax screen has no Back; its heading aligns with the cards.
    const initial = await header.evaluate(node =>
      node.querySelector('.taxpay-modal__title')!.getBoundingClientRect().left -
      node.getBoundingClientRect().left
    );
    expect(initial, 'No-Back title must align with the modal body').toBeGreaterThanOrEqual(0);
    expect(initial).toBeLessThan(40);

    // Replicate the exact shared TaxPayModal header state used by the draft list.
    // CSS must update its grid placement when Back replaces the placeholder.
    await header.evaluate(node => {
      const placeholder = node.querySelector('.taxpay-modal__back-placeholder');
      if (!placeholder) throw new Error('Missing shared modal Back placeholder');
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'taxpay-modal__back';
      back.setAttribute('aria-label', 'Back');
      placeholder.replaceWith(back);
    });

    const layout = await header.evaluate(node => {
      const back = node.querySelector('.taxpay-modal__back')!.getBoundingClientRect();
      const title = node.querySelector('.taxpay-modal__title')!.getBoundingClientRect();
      const close = node.querySelector('.taxpay-modal__close')!.getBoundingClientRect();
      return {
        backRight: back.right,
        titleLeft: title.left,
        titleRight: title.right,
        closeLeft: close.left,
        textAlign: getComputedStyle(node.querySelector('.taxpay-modal__title')!).textAlign,
      };
    });
    expect(layout.titleLeft - layout.backRight,
      'Back must never overlap the Pay Tax title').toBeGreaterThanOrEqual(7);
    expect(layout.closeLeft - layout.titleRight,
      'The title must not overlap Close').toBeGreaterThanOrEqual(7);
    expect(layout.textAlign).toBe('left');
    await page.screenshot({
      path: 'test-results/pay-tax-modal-back-header-' + language + '-' + testInfo.project.name + '.png',
    });
  }
});


for (const mode of ['unified', 'guest-origin'] as const) {
test('draft-eligible account payment protects backdrop, Escape and X at every payment breakpoint (' + mode + ')', async ({ page }, testInfo) => {
  // No hosted writes: this suite explicitly runs with the backend disabled.
  const payment = await startAccountDraftPayment(page, mode);
  await expect(payment.locator('.payment-form-draft-controls__save')).toBeVisible();

  // Accidental outside clicks must not close or open a destructive dialog.
  await page.mouse.click(2, 2);
  await expect(payment).toBeVisible();
  await expect(payment.getByRole('alertdialog')).toHaveCount(0);

  // Keyboard dismissal uses the same safe confirmation as the header X.
  await page.keyboard.press('Escape');
  const confirm = payment.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Save Draft' })).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Discard tax payment' })).toBeVisible();

  // The safe actions have equal-sized targets; discard is visually separated
  // below rather than competing as a third primary action.
  const ctaRow = confirm.getByTestId('payment-draft-exit-cta-row');
  const discardRow = confirm.getByTestId('payment-draft-exit-discard-row');
  await expect(ctaRow).toBeVisible();
  await expect(discardRow).toBeVisible();
  const saveBox = await confirm.getByRole('button', { name: 'Save Draft' }).boundingBox();
  const editBox = await confirm.getByRole('button', { name: 'Keep editing' }).boundingBox();
  const discardBox = await confirm.getByRole('button', { name: 'Discard tax payment' }).boundingBox();
  const dialogBox = await confirm.boundingBox();
  expect(saveBox && editBox && discardBox && dialogBox).toBeTruthy();
  if (saveBox && editBox && discardBox && dialogBox) {
    expect(saveBox.height).toBeGreaterThanOrEqual(44);
    expect(editBox.height).toBeGreaterThanOrEqual(44);
    expect(discardBox.height).toBeGreaterThanOrEqual(44);
    expect(discardBox.y).toBeGreaterThan(Math.max(saveBox.y + saveBox.height, editBox.y + editBox.height));
    expect(saveBox.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(editBox.x + editBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
    expect(discardBox.x + discardBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
    expect(discardBox.width, 'Discard is a full-width, intentionally grouped tertiary action').toBeGreaterThanOrEqual(dialogBox.width - 56);
    expect(discardBox.x, 'Discard stays aligned with the primary actions').toBeGreaterThanOrEqual(dialogBox.x + 18);
    if ((page.viewportSize()?.width ?? 1280) < 420) {
      expect(editBox.y).toBeGreaterThan(saveBox.y);
    } else {
      expect(Math.abs(editBox.y - saveBox.y)).toBeLessThanOrEqual(1);
    }
  }
  await expect(confirm.getByRole('button', { name: 'Discard tax payment' })).toHaveCSS('justify-content', 'center');
  await expect(confirm.getByRole('button', { name: 'Discard tax payment' })).toHaveCSS('border-top-width', '1px');
  await page.screenshot({ path: 'test-results/payment-draft-exit-dialog-' + mode + '-' + (page.viewportSize()?.width ?? 1280) + '.png' });
  if (testInfo.project.name === 'desktop-1280') {
    const previousSize = page.viewportSize()!;
    await page.setViewportSize({ width: 515, height: 354 });
    const compactBox = await confirm.boundingBox();
    expect(compactBox, 'the reported 515x354 viewport keeps the confirmation on screen').not.toBeNull();
    expect(compactBox!.x).toBeGreaterThanOrEqual(12);
    expect(compactBox!.y).toBeGreaterThanOrEqual(0);
    expect(compactBox!.x + compactBox!.width).toBeLessThanOrEqual(503);
    expect(compactBox!.y + compactBox!.height).toBeLessThanOrEqual(354);
    expect(await confirm.evaluate(node => node.scrollWidth - node.clientWidth), 'no horizontal dialog overflow').toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'test-results/payment-draft-exit-dialog-' + mode + '-515x354.png' });
    await page.setViewportSize(previousSize);
  }
  await confirm.getByRole('button', { name: 'Keep editing' }).click();
  await expect(payment).toBeVisible();

  await payment.locator('.taxpay-modal__close').click();
  await expect(confirm).toBeVisible();
  // Failed persistence must keep the unsaved payment in place.
  await confirm.getByRole('button', { name: 'Save Draft' }).click();
  await expect(confirm.getByRole('alert')).toBeVisible();
  await expect(payment).toBeVisible();
  await confirm.getByRole('button', { name: 'Discard tax payment' }).click();
  await expect(payment).toHaveCount(0);
});
}


test('signed-out guest payment uses the one reusable X-discard confirmation', async ({ page }) => {
  // Account-owned payments retain Save Draft, but ALL signed-out Walk-in
  // journeys require explicit confirmation before destroying entered fields.
  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'SELF');
  await expect(dialog.locator('.payment-form-draft-controls__save')).toHaveCount(0);
  await dialog.locator('.taxpay-modal__close').click();
  const confirm = dialog.getByRole('alertdialog',{name:'Discard tax payment?'});
  await expect(confirm).toBeVisible();
  await expect(confirm.locator('button')).toHaveCount(2);
  await confirm.getByRole('button',{name:'Keep editing'}).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.locator('.taxpay-modal__close').click();
  await confirm.getByRole('button',{name:'Discard tax payment'}).click();
  await expect(dialog).toHaveCount(0);
});
