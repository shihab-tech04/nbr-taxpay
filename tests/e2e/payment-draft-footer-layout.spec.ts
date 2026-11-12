import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

// Layout-only regression: never save data or submit a payment to hosted SQL.
for (const width of [320, 375, 1280]) {
  test('signed-in payment footer keeps Save Draft left and Continue right without Drafts at ' + width + 'px', async ({ page }, info) => {
    const expectedProject = width === 1280 ? 'desktop-1280' : 'mobile-' + width;
    test.skip(info.project.name !== expectedProject, 'The targeted viewport belongs to its own device project');
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/?action=taxpayer_login');
    const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
    await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
    await login.getByLabel('Password', { exact: true }).fill('user2');
    await login.getByRole('button', { name: 'Sign In' }).click();
    await expect(login).toHaveCount(0);
    await page.goto('/?action=landing');
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await enterTaxPayService(modal, 'TAX_WITH_RETURN', 'SELF');
    const footer = modal.locator('.taxpay-modal__footer');
    const actionGroup = footer.locator('.payment-form-draft-controls__actions');
    const save = actionGroup.getByRole('button', { name: 'Save Draft' });
    const resume = actionGroup.locator('.payment-form-draft-controls__open');
    const next = footer.getByRole('button', { name: 'Continue to purpose & amount' });
    await expect(save).toBeVisible();
    await expect(resume).toHaveCount(0);
    await expect(next).toBeVisible();
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
    await expect(modal.locator('.taxpay-modal__step-count')).toContainText('2/4');
    await expect(footer.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(footer.locator('.payment-form-draft-controls__open')).toHaveCount(0);
    await expect(footer.getByRole('button', { name: 'Continue to payment channel' })).toBeVisible();
    await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
    const step2Save = await footer.getByRole('button', { name: 'Save Draft' }).boundingBox();
    const step2Next = await footer.getByRole('button', { name: 'Continue to payment channel' }).boundingBox();
    const step2Footer = await footer.boundingBox();
    expect(step2Save && step2Next && step2Footer).toBeTruthy();
    if (step2Save && step2Next && step2Footer) {
      expect(Math.abs(step2Save.y - step2Next.y)).toBeLessThan(6);
      expect(step2Save.x + step2Save.width).toBeLessThan(step2Next.x);
      expect(step2Next.width).toBeLessThan(step2Footer.width * .7);
    }
    await page.screenshot({ path: 'test-results/payment-footer-drafts-' + width + '.png' });
  });
}


test('Pay Tax header reserves the Back column without overlapping the title in EN/BN', async ({ page }, testInfo) => {
  // Layout-only regression: reproduce the same shared modal header's Back state
  // without writing account drafts, payments or authentication records.
  for (const language of ['en', 'bn'] as const) {
    const translated = language === 'bn';
    const label = translated ? 'কর পরিশোধ' : 'Pay Tax';
    await page.goto(translated ? '/?action=landing&lang=bn' : '/?action=landing');
    await page.getByRole('button', { name: label, exact: true }).first().click();
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


test('draft-eligible account payment protects backdrop, Escape and X at every payment breakpoint', async ({ page }) => {
  // No hosted writes: this suite explicitly runs with the backend disabled.
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'SELF');
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
    if ((page.viewportSize()?.width ?? 1280) < 420) {
      expect(editBox.y).toBeGreaterThan(saveBox.y);
    } else {
      expect(Math.abs(editBox.y - saveBox.y)).toBeLessThanOrEqual(1);
    }
  }
  await page.screenshot({ path: 'test-results/payment-draft-exit-dialog-' + (page.viewportSize()?.width ?? 1280) + '.png' });
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


test('signed-out guest payment keeps original immediate X-close behavior', async ({ page }) => {
  // The draft exit confirmation belongs only to eligible signed-in payments.
  // Preserve the existing public guest journey and do not create payment data.
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'SELF');
  await expect(dialog.locator('.payment-form-draft-controls__save')).toHaveCount(0);
  await dialog.locator('.taxpay-modal__close').click();
  await expect(dialog).toHaveCount(0);
});
