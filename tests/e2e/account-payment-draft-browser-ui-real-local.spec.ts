import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Account = 'user27' | 'user28' | 'user29' | 'user30';

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
  // Independent synthetic owner pairs prevent cross-project drafts from racing.
  // The older serial suite reused user29/user30 in both desktop and mobile.
  const accounts: { owner: Account; other: Account } = info.project.name.startsWith('mobile')
    ? { owner: 'user27', other: 'user28' }
    : { owner: 'user29', other: 'user30' };
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
    const a = await open(accounts.owner);
    const marker = 'CROSS-BROWSER-DRAFT-' + Date.now();
    await a.locator('#guest-notice-ref').fill(marker);
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByRole('button', { name: 'Draft Saved' })).toBeVisible();
    await expect(a.getByText('Draft saved to your account. You can continue in another browser.')).toHaveCount(0);

    // Dashboard uses the same owner-scoped SQL drafts, not local copies.
    const dashboard = await open(accounts.owner);
    await dashboard.goto('/?action=taxpayer_home');
    const cards = dashboard.getByTestId('dashboard-payment-drafts');
    const firstCard = cards.locator('[data-draft-id]').first();
    await expect(firstCard).toBeVisible();
    const draftId = await firstCard.getAttribute('data-draft-id');
    expect(draftId).toBeTruthy();
    await firstCard.getByRole('button', { name: 'Continue' }).click();
    const restoredModal = dashboard.getByRole('dialog', { name: 'Pay Tax' });
    await expect(restoredModal.locator('#guest-notice-ref')).toHaveValue(marker);
    await restoredModal.getByRole('button', { name: 'Close payment services' }).click();
    await expect(cards.locator('[data-draft-id="' + draftId + '"]')).toBeVisible();

    // The existing draft makes Pay Tax open its compact two-choice modal.
    // Regression: choosing Start new must EXPAND to the original complete payer
    // selection, never leave the second card clipped behind the footer.
    const entry = await open(accounts.owner);
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
    // A second Back must survive after entering and leaving Taxpayer details.
    // This is the exact real-world regression: the payer screen previously
    // lost its Back arrow after a payment started.
    await entryModal.locator('[data-payer-relationship="SELF"]').click();
    await entryModal.locator('[data-payment-entry="OTHER_TAX"]').click();
    await entryModal.locator('.taxpay-modal__footer').getByRole('button', { name: 'Continue' }).click();
    await expect(entryModal.locator('.taxpay-modal__title')).toHaveText('Taxpayer details');
    const payerBack = entryModal.locator('.taxpay-modal__header .taxpay-modal__back');
    await expect(payerBack).toBeVisible();
    await payerBack.click();
    await expect(entryModal.locator('.taxpay-modal__title')).toHaveText('Pay Tax');
    await expect(entryModal.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(entryModal.locator('[data-payer-relationship="SELF"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entryModal.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entryModal.locator('.taxpay-modal__footer').getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(payerBack, 'Back must survive after returning from Taxpayer details').toBeVisible();
    await payerBack.click();
    await expect(draftGate.getByRole('button', { name: 'Start new Tax payment' })).toBeVisible();
    await expect(draftGate.getByRole('button', { name: 'Continue from draft' })).toBeVisible();
    await expect(entryModal.locator('.taxpay-modal__footer')).toHaveCount(0);
    await expect(payerBack).toHaveCount(0);
    await draftGate.getByRole('button', { name: 'Start new Tax payment' }).click();
    await expect(payerBack).toBeVisible();
    await expect(entryModal.locator('[data-payer-relationship]')).toHaveCount(2);
    await entryModal.getByRole('button', { name: 'Close payment services' }).click();

    const b = await open(accounts.owner);
    await b.locator('.payment-form-draft-controls__open').click();
    await expect(b.getByRole('button', { name: 'Continue', exact: true }).first()).toBeVisible();
    await b.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await expect(b.locator('#guest-notice-ref')).toHaveValue(marker);
    await b.locator('#guest-notice-ref').fill(marker + '-UPDATED');
    await b.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(b.getByRole('button', { name: 'Draft Saved' })).toBeVisible();
    await expect(b.getByText('Draft saved to your account. You can continue in another browser.')).toHaveCount(0);

    // Browser A is still at the older revision; no silent loss of Browser B's changes.
    await a.locator('#guest-notice-ref').fill(marker + '-STALE');
    await a.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(a.getByRole('alert').filter({ hasText: /changed in another session/ })).toBeVisible();

    const unrelated = await open(accounts.other);
    await unrelated.locator('.payment-form-draft-controls__open').click();
    await expect(unrelated.getByText('Payment draft', { exact: true })).toHaveCount(0);
    await expect(unrelated.locator('#guest-notice-ref')).not.toHaveValue(marker + '-UPDATED');

    // Separate owner: dashboard Delete is a two-action confirmation and persists.
    await unrelated.locator('#guest-notice-ref').fill('DASHBOARD-DELETE-' + Date.now());
    await unrelated.getByRole('button', { name: 'Save Draft' }).click();
    await expect(unrelated.getByRole('button', { name: 'Draft Saved' })).toBeVisible();
    await unrelated.goto('/?action=taxpayer_home');
    const otherCards = unrelated.getByTestId('dashboard-payment-drafts');
    const otherCard = otherCards.locator('[data-draft-id]').first();
    await expect(otherCard).toBeVisible();
    await otherCard.getByRole('button', { name: 'Delete' }).click();
    await expect(otherCard.getByRole('button', { name: 'Confirm delete' })).toBeVisible();
    await otherCard.getByRole('button', { name: 'Cancel' }).click();
    await expect(otherCard).toBeVisible();
    await otherCard.getByRole('button', { name: 'Delete' }).click();
    await otherCard.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(otherCard).toHaveCount(0);


    await b.locator('.payment-form-draft-controls__open').click();
    await b.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await b.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await expect(b.getByText('Draft deleted.')).toBeVisible();

    // A fresh same-account browser does not recover a deleted draft.
    const fresh = await open(accounts.owner);
    await fresh.locator('.payment-form-draft-controls__open').click();
    await expect(fresh.getByText('Payment draft', { exact: true })).toHaveCount(0);
    await dashboard.goto('/?action=taxpayer_home');
    await expect(dashboard.getByTestId('dashboard-payment-drafts')
      .locator('[data-draft-id="' + draftId + '"]')).toHaveCount(0);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});

test('user1 Overview shows account-scoped saved drafts with Continue and confirmed Delete', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('Disposable local Supabase is required.');
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Refusing hosted SQL draft browser test.');
  }
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: info.project.name.startsWith('mobile') ? { width: 375, height: 812 } : { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
    await page.getByLabel('Password', { exact: true }).fill('user1');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();

    // Create an actual owner-scoped local SQL draft, not a fixture card.
    await page.goto('/?action=guest');
    await page.locator('#guest-payer-self').check();
    const marker = 'USER1-OVERVIEW-DRAFT-' + Date.now();
    await page.locator('#guest-notice-ref').fill(marker);
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Draft Saved' })).toBeVisible();

    await page.goto('/?action=taxpayer_home');
    const workspace = page.getByTestId('user1-synthetic-workspace');
    const cards = workspace.getByTestId('dashboard-payment-drafts');
    await expect(cards.getByRole('heading', { name: 'Saved payment drafts' })).toBeVisible();
    const savedCard = cards.locator('[data-draft-id]').first();
    await expect(savedCard).toBeVisible();
    const id = await savedCard.getAttribute('data-draft-id');
    expect(id).toBeTruthy();
    // The entire approved Overview and its existing Pay action must remain mounted
    // and keep their geometry when a payment dialog covers the page.
    const countBefore = await cards.locator('[data-draft-id]').count();
    const layoutBefore = await cards.boundingBox();
    expect(layoutBefore).not.toBeNull();
    const desktopPay = page.locator('.taxpayer-reference-main-action');
    if (page.viewportSize()!.width > 900) await expect(desktopPay).toBeVisible();
    // Preserve existing user1 financial dashboard; insert cards after the heading.
    await expect(workspace.getByRole('heading', { name: 'What needs your attention' })).toBeVisible();
    await savedCard.getByRole('button', { name: 'Continue' }).click();
    const payment = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(payment.locator('#guest-notice-ref')).toHaveValue(marker);
    await expect(cards).toBeVisible();
    await expect(cards.locator('[data-draft-id]')).toHaveCount(countBefore);
    if (page.viewportSize()!.width > 900) await expect(desktopPay).toBeVisible();
    const layoutUnderModal = await cards.boundingBox();
    expect(layoutUnderModal).not.toBeNull();
    // Opening a modal intentionally scroll-locks the page and can change viewport Y.
    // Compare the card's dimensions, not its scroll-relative screen coordinate.
    expect(Math.abs(layoutUnderModal!.width - layoutBefore!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(layoutUnderModal!.height - layoutBefore!.height)).toBeLessThanOrEqual(2);
    await expect(workspace.getByRole('heading', { name: 'What needs your attention' })).toBeVisible();
    await payment.getByRole('button', { name: 'Close payment services' }).click();
    // A resumed, draft-eligible payment must not be silently dismissed.
    const exitPrompt = payment.getByRole('alertdialog');
    await expect(exitPrompt).toBeVisible();
    await exitPrompt.getByRole('button', { name: 'Save Draft', exact: true }).click();
    // The modal closes only after the local SQL update and readback succeed.
    await expect(payment).toHaveCount(0);
    await expect(cards.locator('[data-draft-id]')).toHaveCount(countBefore);

    // Opening Pay Tax from the sidebar must also keep both the sidebar and
    // saved draft cards unchanged, including the background mobile Pay action.
    if (page.viewportSize()!.width > 900) {
      await desktopPay.click();
      await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Pay Tax',exact:true}).click();
      await expect(page.getByRole('dialog', { name: 'Pay Tax' })
        .getByRole('button', { name: 'Continue from draft' })).toBeVisible();
      await expect(desktopPay).toBeVisible();
      await expect(cards.locator('[data-draft-id]')).toHaveCount(countBefore);
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('.citizen-pay')).toBeVisible();
      await expect(cards.locator('[data-draft-id]')).toHaveCount(countBefore);
      await page.getByRole('dialog', { name: 'Pay Tax' })
        .getByRole('button', { name: 'Close payment services' }).click();
    } else {
      const mobilePay = page.locator('.citizen-pay');
      await expect(mobilePay).toBeVisible();
      await mobilePay.click();
      await expect(page.getByRole('dialog', { name: 'Pay Tax' })
        .getByRole('button', { name: 'Continue from draft' })).toBeVisible();
      await expect(mobilePay).toBeVisible();
      await expect(cards.locator('[data-draft-id]')).toHaveCount(countBefore);
      await page.getByRole('dialog', { name: 'Pay Tax' })
        .getByRole('button', { name: 'Close payment services' }).click();
    }
    const matching = workspace.getByTestId('dashboard-payment-drafts').locator('[data-draft-id="' + id + '"]');
    await expect(matching).toBeVisible();
    await matching.getByRole('button', { name: 'Delete' }).click();
    await expect(matching.getByRole('button', { name: 'Confirm delete' })).toBeVisible();
    await matching.getByRole('button', { name: 'Cancel' }).click();
    await expect(matching).toBeVisible();
    await matching.getByRole('button', { name: 'Delete' }).click();
    await matching.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(matching).toHaveCount(0);
    // Other user1 saved drafts must not be deleted or changed by this action.
    await page.reload();
    await expect(workspace.getByTestId('dashboard-payment-drafts').locator('[data-draft-id="' + id + '"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
