import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Account = 'user29' | 'user30';

/** Full React Save Draft → another browser → Continue Draft acceptance.
 * Uses the disposable local Supabase/Edge service, not intercepted REST routes.
 * Never connects to hosted taxpayer data.
 */
test('payment form drafts survive another browser, protect owner isolation and reject stale edits', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('Disposable local Supabase is required.');
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Refusing hosted SQL draft browser test.');
  }
  const contexts: BrowserContext[] = [];
  const viewport = info.project.name.startsWith('mobile')
    ? { width: 375, height: 812 } : { width: 1280, height: 800 };
  const open = async (id: Account): Promise<Page> => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(9_000);
    page.setDefaultNavigationTimeout(20_000);
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill(id);
    await page.getByLabel('Password', { exact: true }).fill(id);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=guest');
    await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeVisible();
    // The approved form intentionally starts with no payer relationship chosen.
    // Select self before using the receipt-reference input; do not bypass this UX gate.
    await page.locator('#guest-payer-self').check();
    await expect(page.locator('#guest-notice-ref')).toBeVisible();
    return page;
  };
  try {
    const a = await open('user29');
    const marker = 'CROSS-BROWSER-DRAFT-' + Date.now();
    await a.locator('#guest-notice-ref').fill(marker);
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByText('Draft saved to your account. You can continue in another browser.')).toBeVisible();

    // The existing draft makes Pay Tax open its compact two-choice modal.
    // Regression: choosing Start new must EXPAND to the original complete payer
    // selection, never leave the second card clipped behind the footer.
    const entry = await open('user29');
    await entry.goto('/?action=landing');
    await entry.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
    const entryModal = entry.getByRole('dialog', { name: 'Pay Tax' });
    const draftGate = entryModal.getByTestId('account-draft-entry');
    await expect(draftGate.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
    const compactHeight = await entryModal.evaluate(node => node.getBoundingClientRect().height);
    await draftGate.getByRole('button', { name: 'Continue from draft' }).click();
    await expect(draftGate.getByTestId('saved-payment-draft-list').locator('[data-draft-id]').first()).toBeVisible();
    await entryModal.locator('.taxpay-modal__header .taxpay-modal__back').click();
    await expect(draftGate.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
    await draftGate.getByRole('button', { name: 'Start new Tax payment' }).click();
    await expect(entryModal.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(entryModal.locator('.taxpay-modal__footer').getByRole('button', { name: 'Continue' })).toBeVisible();

    // Start new is itself reached from the saved-draft choice modal.
    // Its Back action belongs in the existing header and must return to that
    // choice, NOT close Pay Tax or add another bottom/body action.
    const newPaymentBack = entryModal.locator('.taxpay-modal__header .taxpay-modal__back');
    await expect(newPaymentBack).toBeVisible();
    await expect(newPaymentBack).toHaveAttribute('aria-label', 'Back');
    await expect(entryModal.locator('.taxpay-modal__header .taxpay-modal__close')).toBeVisible();
    await expect(entryModal.locator('.taxpay-modal__body button[aria-label="Back"]')).toHaveCount(0);
    const headerSpacing = await entryModal.locator('.taxpay-modal__header').evaluate(header => {
      const back = header.querySelector<HTMLElement>('.taxpay-modal__back')!.getBoundingClientRect();
      const title = header.querySelector<HTMLElement>('.taxpay-modal__title')!.getBoundingClientRect();
      const close = header.querySelector<HTMLElement>('.taxpay-modal__close')!.getBoundingClientRect();
      return { beforeTitle: title.left - back.right, beforeClose: close.left - title.right };
    });
    expect(headerSpacing.beforeTitle).toBeGreaterThanOrEqual(7);
    expect(headerSpacing.beforeClose).toBeGreaterThanOrEqual(7);

    await newPaymentBack.click();
    await expect(draftGate.getByRole('button', { name: 'Continue from draft' })).toBeVisible();
    await expect(draftGate.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
    await expect(entryModal.locator('.taxpay-modal__footer')).toHaveCount(0);
    await expect(newPaymentBack).toHaveCount(0);
    await draftGate.getByRole('button', { name: 'Start new Tax payment' }).click();
    await expect(newPaymentBack).toBeVisible();
    await expect(entryModal.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(entryModal.locator('.taxpay-modal__footer').getByRole('button', { name: 'Continue' })).toBeVisible();

    const measure = () => entryModal.evaluate(modal => {
      const cards = Array.from(modal.querySelectorAll<HTMLElement>('[data-payer-relationship]'));
      const body = modal.querySelector<HTMLElement>('.taxpay-modal__body');
      const footer = modal.querySelector<HTMLElement>('.taxpay-modal__footer');
      return {
        height: modal.getBoundingClientRect().height,
        cardCount: cards.length,
        finalCardBottom: cards.at(-1)?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        bodyBottom: body?.getBoundingClientRect().bottom ?? 0,
        footerTop: footer?.getBoundingClientRect().top ?? 0,
        bodyScrollHeight: body?.scrollHeight ?? Number.POSITIVE_INFINITY,
        bodyClientHeight: body?.clientHeight ?? 0,
      };
    });
    await expect.poll(async () => {
      const m = await measure();
      return m.cardCount === 2 && m.finalCardBottom <= m.bodyBottom - 1 &&
        m.finalCardBottom <= m.footerTop - 1 && m.bodyScrollHeight <= m.bodyClientHeight + 2 &&
        (info.project.name.startsWith('mobile') ? m.height >= compactHeight - 1 : m.height >= compactHeight + 35);
    }, { timeout: 10_000, message: 'Start new must expand the modal and reveal both payer cards above its footer' }).toBe(true);
    console.log('DRAFT_TO_ORIGINAL_MODAL_GEOMETRY', JSON.stringify({ project: info.project.name, compactHeight, expanded: await measure() }));
    await entry.screenshot({ path: 'test-results/draft-to-original-payer-' + info.project.name + '.png' });
    await entryModal.getByRole('button', { name: 'Close payment services' }).click();

    const b = await open('user29');
    await b.locator('.payment-form-draft-controls__open').click();
    await expect(b.getByRole('button', { name: 'Continue', exact: true }).first()).toBeVisible();
    await b.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await expect(b.locator('#guest-notice-ref')).toHaveValue(marker);
    await b.locator('#guest-notice-ref').fill(marker + '-UPDATED');
    await b.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(b.getByText('Draft saved to your account. You can continue in another browser.')).toBeVisible();

    // Browser A is still at the older revision; no silent loss of Browser B's changes.
    await a.locator('#guest-notice-ref').fill(marker + '-STALE');
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByRole('alert').filter({ hasText: /changed in another session/ })).toBeVisible();

    const unrelated = await open('user30');
    await unrelated.locator('.payment-form-draft-controls__open').click();
    await expect(unrelated.getByText('Payment draft', { exact: true })).toHaveCount(0);
    await expect(unrelated.locator('#guest-notice-ref')).not.toHaveValue(marker + '-UPDATED');

    await b.locator('.payment-form-draft-controls__open').click();
    await b.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await b.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await expect(b.getByText('Draft deleted.')).toBeVisible();

    // A fresh same-account browser does not recover a deleted draft.
    const fresh = await open('user29');
    await fresh.locator('.payment-form-draft-controls__open').click();
    await expect(fresh.getByText('Payment draft', { exact: true })).toHaveCount(0);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
