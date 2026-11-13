import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chooseBeneficiaryOption } from './beneficiarySearchableSelect';

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
    await expect(workspace.getByRole('heading', { name: 'Payment and request summary' })).toBeVisible();
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
    await expect(workspace.getByRole('heading', { name: 'Payment and request summary' })).toBeVisible();
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
      await page.locator('.taxpayer-reference-rail').getByRole('menuitem',{name:'Pay Tax',exact:true}).click();
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
      await page.getByRole('menuitem',{name:'Pay Tax',exact:true}).click();
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
    // Zero records must remain a navigable, recoverable dashboard feature.
    const empty = workspace.getByTestId('dashboard-payment-drafts');
    await expect(empty).toBeVisible();
    await expect(empty.getByTestId('dashboard-drafts-empty')).toBeVisible();
    await expect(empty.getByRole('button',{name:'Start a payment'})).toBeVisible();
    await empty.getByRole('button',{name:'Start a payment'}).click();
    await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();

  } finally {
    await context.close();
  }
});

for (const language of ['en', 'bn'] as const) {
  test(`payment form drafts survive another browser with real Auth ownership, recovery and isolation (${language})`, async ({ browser }, info) => {
    test.setTimeout(120_000);
    const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
    const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
    const dsn = process.env.TAXPAY_LOCAL_PG_DSN;
    if (!raw || !key || !dsn) throw new Error('Disposable local Supabase is required.');
    const endpoint = new URL(raw);
    const database = new URL(dsn);
    if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname)) {
      throw new Error('Refusing hosted or non-loopback Auth/draft/payment test targets.');
    }
    const bn = language === 'bn';
    const viewport = info.project.name.startsWith('mobile')
      ? { width: 375, height: 812 } : { width: 1280, height: 800 };
    const contexts: BrowserContext[] = [];
    const query = (sql: string) => {
      const result = spawnSync('psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
        encoding: 'utf8', timeout: 10_000,
        env: {
          ...process.env,
          PGHOST: database.hostname,
          PGPORT: database.port || '5432',
          PGUSER: decodeURIComponent(database.username),
          PGPASSWORD: decodeURIComponent(database.password),
          PGDATABASE: database.pathname.slice(1),
        },
      });
      if (result.status !== 0) throw new Error('Disposable SQL read failed: ' + result.stderr.slice(0, 500));
      return result.stdout.trim();
    };
    const createOwner = async (label: string) => {
      const email = `${label}-${randomUUID()}@example.invalid`;
      const password = randomBytes(32).toString('base64url');
      const response = await fetch(new URL('/auth/v1/signup', endpoint.origin), {
        method: 'POST', headers: { apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as {
        user?: { id?: string };
        session?: { access_token?: string; refresh_token?: string; expires_at?: number };
        access_token?: string; refresh_token?: string; expires_at?: number;
      };
      const session = body.session ?? body;
      expect(body.user?.id).toBeTruthy();
      expect(session.access_token).toBeTruthy();
      expect(session.refresh_token).toBeTruthy();
      return {
        id: body.user!.id!,
        session: session as { access_token: string; refresh_token: string; expires_at?: number },
      };
    };
    const owner = await createOwner('account-draft-owner');
    const other = await createOwner('account-draft-other');
    const paymentCountBefore = query('select count(*) from public.sim_payment_transactions');
    const appUrl = (action: string, session: { access_token: string; refresh_token: string; expires_at?: number }) =>
      `/?action=${action}&lang=${language}#access_token=${encodeURIComponent(session.access_token)}` +
      `&refresh_token=${encodeURIComponent(session.refresh_token)}&token_type=bearer&expires_in=3600&expires_at=` +
      (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600);
    const open = async (session: { access_token: string; refresh_token: string; expires_at?: number }, action: string) => {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport });
      contexts.push(context);
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      await page.goto(appUrl(action, session));
      await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang', language);
      return page;
    };
    const readRows = async (session: { access_token: string }, filters: Record<string, string>) => {
      const url = new URL('/rest/v1/taxpay_account_payment_form_drafts', endpoint.origin);
      url.searchParams.set('select', 'id,owner_uid,service,form_payload,revision,created_at,updated_at');
      for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, value);
      const response = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + session.access_token } });
      expect(response.status).toBe(200);
      return await response.json() as Array<{
        id: string; owner_uid: string; service: string; form_payload: Record<string, unknown>; revision: number;
      }>;
    };
    const readBeneficiaries = async (session: { access_token: string }) => {
      const url = new URL('/rest/v1/taxpay_beneficiaries', endpoint.origin);
      url.searchParams.set('select', 'owner_uid,tin,display_name,tag,relationship');
      const response = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + session.access_token } });
      expect(response.status).toBe(200);
      return await response.json() as Array<{
        owner_uid: string; tin: string; display_name: string; tag: string; relationship: string | null;
      }>;
    };
    try {
    const beneficiarySetup = await open(owner.session, 'beneficiaries');
    await expect(beneficiarySetup.getByTestId('beneficiaries-page')).toBeVisible();
    await beneficiarySetup.getByRole('button', { name: bn ? 'তালিকা তৈরি' : 'Create list', exact: true }).first().click();
    const listDialog = beneficiarySetup.getByRole('dialog', { name: bn ? 'তালিকা তৈরি' : 'Create list' });
    await listDialog.locator('#beneficiary-create-list-name').fill('Draft beneficiaries');
    await listDialog.getByRole('button', { name: bn ? 'তালিকা তৈরি' : 'Create list', exact: true }).click();
    await beneficiarySetup.getByRole('button', { name: bn ? 'উপকারভোগী যোগ' : 'Add beneficiary', exact: true }).click();
    const beneficiaryDialog = beneficiarySetup.getByRole('dialog', { name: bn ? 'উপকারভোগী যোগ' : 'Beneficiary entry' });
    await beneficiaryDialog.locator('#beneficiary-tin').fill('012345678901');
    await beneficiaryDialog.locator('#beneficiary-name').fill('Local Draft Beneficiary');
    await chooseBeneficiaryOption(beneficiaryDialog, 'beneficiary-tag', 'clients');
    await beneficiaryDialog.getByRole('button', { name: bn ? 'উপকারভোগী যোগ' : 'Add beneficiary', exact: true }).click();
    await expect(beneficiarySetup.getByText(bn ? 'উপকারভোগী সংরক্ষিত হয়েছে।' : 'Beneficiary saved.')).toBeVisible();
    const ownerBeneficiaries = await readBeneficiaries(owner.session);
    expect(ownerBeneficiaries).toHaveLength(1);
    expect(ownerBeneficiaries[0]).toMatchObject({
      owner_uid: owner.id, tin: '012345678901', display_name: 'Local Draft Beneficiary', tag: 'clients', relationship: null,
    });
    expect(await readBeneficiaries(other.session)).toEqual([]);

    const payer = await open(owner.session, 'history');
    // A route reached through a real local Auth callback enables the existing
    // signed-in draft actor; no preview identity or mocked transport is used.
    await payer.goto(`/?action=guest&lang=${language}&initialCategory=ADVANCE_TAX`);
    const saveLabel = bn ? 'খসড়া সংরক্ষণ করুন' : 'Save Draft';
    const savedLabel = bn ? 'খসড়া সংরক্ষিত' : 'Draft Saved';
    const continueLabel = bn ? 'চালিয়ে যান' : 'Continue';
    const marker = `AUTH-DRAFT-${language}-${randomUUID()}`;
    const receiptPhone = '01712345678';
    const receiptEmail = `draft-${language}-${randomUUID()}@example.invalid`;
    await payer.locator('#guest-payer-other').check();
    const beneficiaryPicker = payer.getByTestId('saved-beneficiary-picker');
    await expect(beneficiaryPicker).toContainText('Local Draft Beneficiary');
    await beneficiaryPicker.locator('input[type="radio"]').check();
    await expect(payer.locator('#guest-notice-ref')).toBeVisible();
    await expect(payer.locator('#guest-phone')).toBeVisible();
    await expect(payer.locator('#guest-receipt-email')).toBeVisible();
    await payer.locator('#guest-notice-ref').fill(marker);
    await payer.locator('#guest-phone').fill(receiptPhone);
    await payer.locator('#guest-receipt-email').fill(receiptEmail);
    await payer.getByRole('button', { name: bn ? 'পেমেন্ট খাতে এগিয়ে যান' : 'Continue to Payment Head', exact: true }).click();
    await payer.locator('#guest-income-type-NON_COMPANY').check();
    const availableHead = payer.locator('input[name="guest-payment-head"]:not(:disabled)').first();
    await expect(availableHead).toBeVisible();
    const selectedHeadId = Number(await availableHead.getAttribute('value'));
    expect(Number.isSafeInteger(selectedHeadId)).toBe(true);
    await availableHead.check();
    await payer.locator('#guest-assessment-year').selectOption('2025-26');
    await payer.locator('#guest-tax-amount').fill('125.75');
    await payer.getByRole('button', { name: saveLabel, exact: true }).click();
    await expect(payer.getByRole('button', { name: savedLabel, exact: true })).toBeVisible();

    const firstRows = await readRows(owner.session, { owner_uid: 'eq.' + owner.id });
    expect(firstRows).toHaveLength(1);
    const draftId = firstRows[0].id;
    expect(firstRows[0]).toMatchObject({ owner_uid: owner.id, revision: 1 });
    expect(firstRows[0].form_payload).toMatchObject({
      category: 'ADVANCE_TAX', step: 2, noticeReference: marker, forSelf: false, tin: '012345678901',
      otherTaxpayerName: 'Local Draft Beneficiary', phone: receiptPhone, receiptEmail,
      incomeTaxType: 'NON_COMPANY', assessmentYear: '2025-26', selectedHeadIds: [selectedHeadId],
      amountInputs: { [selectedHeadId]: '125.75' },
    });

    // A separate fresh form creates a sibling draft for the same owner. The
    // later discard must remove only the selected draft, never this sibling.
    const sibling = await open(owner.session, 'guest');
    const siblingMarker = marker + '-SIBLING';
    await sibling.locator('#guest-payer-self').check();
    await sibling.locator('#guest-notice-ref').fill(siblingMarker);
    await sibling.getByRole('button', { name: saveLabel, exact: true }).click();
    await expect(sibling.getByRole('button', { name: savedLabel, exact: true })).toBeVisible();
    const siblingRows = await readRows(owner.session, { owner_uid: 'eq.' + owner.id });
    expect(siblingRows).toHaveLength(2);
    const siblingDraft = siblingRows.find(row => row.form_payload.noticeReference === siblingMarker);
    expect(siblingDraft).toMatchObject({ owner_uid: owner.id, revision: 1 });
    expect(siblingDraft?.id).not.toBe(draftId);

    // A second browser reloads the owner dashboard from Auth-backed SQL.
    const resume = await open(owner.session, 'taxpayer_home');
    const cards = resume.getByTestId('dashboard-payment-drafts');
    const card = cards.locator('[data-draft-id="' + draftId + '"]');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: continueLabel, exact: true }).click();
    const modal = resume.getByRole('dialog', { name: bn ? 'কর পরিশোধ' : 'Pay Tax' });
    await expect(modal.locator('#guest-assessment-year')).toHaveValue('2025-26');
    await expect(modal.locator('#guest-income-type-NON_COMPANY')).toBeChecked();
    await expect(modal.locator('#guest-head-' + selectedHeadId)).toBeChecked();
    await expect(modal.locator('#guest-tax-amount')).toHaveValue('125.75');

    // The approved embedded Pay Tax modal retains the payer relationship from the
    // draft entry. Its relationship selector is not duplicated inside this step.
    const modalBack = modal.locator('.taxpay-modal__back');
    await expect(modalBack).toHaveAttribute('aria-label', bn ? 'ফিরুন' : 'Back');
    await modalBack.click();
    await expect(modal.locator('[data-payer-relationship]')).toHaveCount(0);
    await expect(modal.locator('.tax-service-choice__selected-service')).toContainText(
      bn ? 'অন্য করদাতার কর পরিশোধে সহায়তা করুন' : 'Facilitate another taxpayer’s payment');
    await expect(modal.locator('#guest-notice-ref')).toHaveValue(marker);
    await expect(modal.locator('#guest-phone')).toHaveValue(receiptPhone);
    await expect(modal.locator('#guest-receipt-email')).toHaveValue(receiptEmail);
    const restoredPicker = modal.getByTestId('saved-beneficiary-picker');
    await expect(restoredPicker).toContainText('Local Draft Beneficiary');
    await expect(restoredPicker.locator('input[name="payment-beneficiary"]')).toBeChecked();
    await modal.locator('.taxpay-modal__footer-actions')
      .getByRole('button', { name: bn ? 'খাত ও পরিমাণে এগিয়ে যান' : 'Continue to purpose & amount', exact: true }).click();

    await expect(modal.locator('#guest-assessment-year')).toHaveValue('2025-26');
    await expect(modal.locator('#guest-income-type-NON_COMPANY')).toBeChecked();
    await expect(modal.locator('#guest-head-' + selectedHeadId)).toBeChecked();
    await expect(modal.locator('#guest-tax-amount')).toHaveValue('125.75');
    await modal.locator('#guest-tax-amount').fill('126.75');
    await modal.getByRole('button', { name: saveLabel, exact: true }).click();
    await expect(modal.getByRole('button', { name: savedLabel, exact: true })).toBeVisible();

    const updatedRows = await readRows(owner.session, { owner_uid: 'eq.' + owner.id, id: 'eq.' + draftId });
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]).toMatchObject({ id: draftId, owner_uid: owner.id, revision: 2 });
    expect(updatedRows[0].form_payload).toMatchObject({
      category: 'ADVANCE_TAX', step: 2, noticeReference: marker, forSelf: false, tin: '012345678901',
      otherTaxpayerName: 'Local Draft Beneficiary', phone: receiptPhone, receiptEmail,
      incomeTaxType: 'NON_COMPANY', assessmentYear: '2025-26', selectedHeadIds: [selectedHeadId],
      amountInputs: { [selectedHeadId]: '126.75' },
    });

    // The first browser retains revision 1; a stale update must be rejected.
    await payer.getByRole('button', { name: bn ? 'পূর্ববর্তী ধাপ' : 'Back', exact: true }).click();
    await payer.locator('#guest-notice-ref').fill(marker + '-STALE');
    await payer.getByRole('button', { name: saveLabel, exact: true }).click();
    await expect(payer.getByRole('alert').filter({ hasText: /changed in another session/ })).toBeVisible();
    const afterConflict = await readRows(owner.session, { owner_uid: 'eq.' + owner.id, id: 'eq.' + draftId });
    expect(afterConflict[0]?.form_payload.amountInputs).toEqual({ [selectedHeadId]: '126.75' });

    // Refresh then resume the exact updated value. Draft activity must not create a payment.
    await resume.goto(`/?action=taxpayer_home&lang=${language}`);
    await expect(cards.locator('[data-draft-id="' + draftId + '"]')).toBeVisible();
    await cards.locator('[data-draft-id="' + draftId + '"]').getByRole('button', { name: continueLabel, exact: true }).click();
    const refreshedModal = resume.getByRole('dialog', { name: bn ? 'কর পরিশোধ' : 'Pay Tax' });
    await expect(refreshedModal.locator('#guest-assessment-year')).toHaveValue('2025-26');
    await expect(refreshedModal.locator('#guest-income-type-NON_COMPANY')).toBeChecked();
    await expect(refreshedModal.locator('#guest-head-' + selectedHeadId)).toBeChecked();
    await expect(refreshedModal.locator('#guest-tax-amount')).toHaveValue('126.75');
    await refreshedModal.locator('.taxpay-modal__header .taxpay-modal__close').click();
    const exitPrompt = refreshedModal.getByRole('alertdialog');
    await expect.poll(async () => await refreshedModal.count() === 0 || await exitPrompt.count() > 0).toBe(true);
    if (await refreshedModal.count() > 0) {
      await exitPrompt.getByRole('button', { name: saveLabel, exact: true }).click();
    }
    await expect(refreshedModal).toHaveCount(0);

    // Another real Auth user cannot see the row in UI or PostgREST.
    const stranger = await open(other.session, 'taxpayer_home');
    const strangerCards = stranger.getByTestId('dashboard-payment-drafts');
    await expect(strangerCards.getByTestId('dashboard-drafts-empty')).toBeVisible();
    await expect(stranger.getByText(marker, { exact: false })).toHaveCount(0);
    expect(await readRows(other.session, { owner_uid: 'eq.' + other.id, id: 'eq.' + draftId })).toEqual([]);
    expect(await readBeneficiaries(other.session)).toEqual([]);

    // Delete confirmation can be cancelled; confirming deletes this draft only.
    const finalCard = cards.locator('[data-draft-id="' + draftId + '"]');
    await finalCard.getByRole('button', { name: bn ? 'মুছুন' : 'Delete', exact: true }).click();
    await expect(finalCard.getByRole('button', { name: bn ? 'মুছে ফেলা নিশ্চিত করুন' : 'Confirm delete', exact: true })).toBeVisible();
    await finalCard.getByRole('button', { name: bn ? 'বাতিল' : 'Cancel', exact: true }).click();
    await expect(finalCard).toBeVisible();
    await finalCard.getByRole('button', { name: bn ? 'মুছুন' : 'Delete', exact: true }).click();
    await finalCard.getByRole('button', { name: bn ? 'মুছে ফেলা নিশ্চিত করুন' : 'Confirm delete', exact: true }).click();
    await expect(finalCard).toHaveCount(0);
    expect(await readRows(owner.session, { owner_uid: 'eq.' + owner.id, id: 'eq.' + draftId })).toEqual([]);
    const siblingCard = cards.locator('[data-draft-id="' + siblingDraft!.id + '"]');
    await expect(siblingCard).toBeVisible();
    const remainingRows = await readRows(owner.session, { owner_uid: 'eq.' + owner.id });
    expect(remainingRows).toHaveLength(1);
    expect(remainingRows[0]).toMatchObject({ id: siblingDraft!.id, owner_uid: owner.id, revision: 1 });
    expect(remainingRows[0].form_payload.noticeReference).toBe(siblingMarker);
    await siblingCard.getByRole('button', { name: bn ? 'মুছুন' : 'Delete', exact: true }).click();
    await siblingCard.getByRole('button', { name: bn ? 'মুছে ফেলা নিশ্চিত করুন' : 'Confirm delete', exact: true }).click();
    await expect(siblingCard).toHaveCount(0);
    expect(await readRows(owner.session, { owner_uid: 'eq.' + owner.id })).toEqual([]);
    expect(query('select count(*) from public.sim_payment_transactions')).toBe(paymentCountBefore);
    } finally {
      await Promise.allSettled(contexts.map(context => context.close()));
    }
  });
}
