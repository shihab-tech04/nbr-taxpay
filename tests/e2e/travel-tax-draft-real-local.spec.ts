import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { openTaxpayerTravelTax } from './taxpayer-travel-menu-helper';
import { futureTravelDate } from './travel-tax-test-helper';

type LocalAccount = 'user27' | 'user28';

/** Existing Taxpayer User ID Travel Tax draft recovery against disposable local SQL only. */
test('signed-in Travel Tax draft survives refresh, rechecks passengers and stays owner-scoped', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Keep the isolated account pair serial.');
  test.setTimeout(120_000);

  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const pgDsn = process.env.TAXPAY_LOCAL_PG_DSN;
  if (!raw || !key || !pgDsn) throw new Error('Disposable local Supabase and PostgreSQL are required.');
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Refusing hosted SQL draft browser test.');
  }
  const postgres = new URL(pgDsn);
  if (!['postgres:', 'postgresql:'].includes(postgres.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(postgres.hostname)) {
    throw new Error('Refusing non-loopback Travel Tax draft SQL readback.');
  }
  const readPreviewDrafts = (demoId: LocalAccount): Array<Record<string, unknown>> => {
    const query = `SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',id::text,'demo_id',demo_id,'service',service,'form_payload',form_payload,'revision',revision
    ) ORDER BY updated_at DESC,id), '[]'::jsonb)::text
    FROM taxpay_guest_private.demo_payment_form_drafts
    WHERE demo_id='${demoId}' AND service='TRAVEL_TAX';`;
    const output = execFileSync('psql', ['-X','-A','-t','-q','-v','ON_ERROR_STOP=1','--dbname',pgDsn,'-c',query],
      { encoding: 'utf8', timeout: 10_000 });
    return JSON.parse(output.trim() || '[]') as Array<Record<string, unknown>>;
  };
  const paymentRowsForReference = (reference: string): number => {
    if (!/^[0-9a-f-]{36}$/i.test(reference)) throw new Error('Invalid disposable draft reference.');
    const output = execFileSync('psql', ['-X','-A','-t','-q','-v','ON_ERROR_STOP=1','--dbname',pgDsn,
      '-c',`SELECT count(*) FROM public.sim_payment_transactions WHERE id='${reference}'::uuid;`],
      { encoding: 'utf8', timeout: 10_000 });
    return Number(output.trim());
  };
  const savedSqlDraft = (demoId: LocalAccount, draftId: string, passengerId: string) => {
    const rows = readPreviewDrafts(demoId);
    const match = rows.filter(row => row.id === draftId);
    expect(match, 'exact SQL draft ID must have one owner-scoped row').toHaveLength(1);
    const row = match[0];
    expect(row.service).toBe('TRAVEL_TAX');
    const payload = row.form_payload as Record<string, unknown>;
    expect(payload.step).toBe(1);
    expect(payload.mode).toBe('LAND');
    expect(payload.port).toBe('Benapole');
    expect(payload.destination).toBe('India');
    expect(payload.travelDate).toBe('');
    const passengers = payload.passengers as Array<Record<string, unknown>>;
    expect(passengers.map(person => person.id)).toEqual(['first', passengerId]);
    expect(passengers.every(person => person.passport === '')).toBe(true);
    const sameJourney = rows.filter(item => {
      const saved = item.form_payload as Record<string, unknown>;
      const people = saved.passengers as Array<Record<string, unknown>> | undefined;
      return Array.isArray(people) && people.length === 2 &&
        people[0]?.id === 'first' && people[1]?.id === passengerId;
    });
    expect(sameJourney, 'refresh/relogin must not create a duplicate saved journey').toHaveLength(1);
    return structuredClone(row);
  };

  const contexts: BrowserContext[] = [];
  let savedPassengerId = '';
  const signIn = async (page: Page, id: LocalAccount): Promise<void> => {
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill(id);
    await page.getByLabel('Password', { exact: true }).fill(id);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
  };
  const openAccount = async (id: LocalAccount): Promise<Page> => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 1280, height: 800 },
    });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(20_000);
    await signIn(page, id);
    return page;
  };

  try {
    const owner = await openAccount('user27');
    await openTaxpayerTravelTax(owner);
    const modal = owner.getByRole('dialog', { name: 'Travel tax' });
    await expect(modal.locator('.travel-flow')).toHaveAttribute('data-step', '0');
    await expect(modal.getByRole('button', { name: 'Save Draft', exact: true })).toBeEnabled();

    // Save a multi-passenger draft from the incomplete travel-details step.
    await modal.locator('#travel-passport-first').fill('TEST123456');
    await modal.locator('#travel-lookup-first').click();
    await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
    await modal.getByRole('button', { name: 'Add another passenger' }).click();
    const second = modal.locator('[data-passenger-id]').nth(1);
    const secondId = await second.getAttribute('data-passenger-id');
    expect(secondId).toBeTruthy();
    savedPassengerId = secondId!;
    await second.locator('#travel-passport-' + secondId).fill('TEST230001');
    await second.locator('#travel-lookup-' + secondId).click();
    await second.getByRole('button', { name: 'Add passenger', exact: true }).click();
    await modal.locator('#travel-mobile').fill('01712345678');
    await modal.getByRole('button', { name: 'Continue to travel details' }).click();
    await expect(modal.locator('.travel-flow')).toHaveAttribute('data-step', '1');
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    // Keep travel date incomplete so the saved record is demonstrably a draft.
    await expect(modal.locator('#travel-departure-date')).toHaveValue('');
    await modal.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Draft Saved' })).toBeVisible();

    const closeModal = () => modal.locator('.taxpay-modal__header .taxpay-modal__close').click();
    await closeModal();
    await owner.goto('/?action=taxpayer_home');
    await owner.reload();

    const dashboard = owner.getByTestId('dashboard-payment-drafts');
    const draftCard = dashboard.locator('[data-draft-id]').filter({ hasText: /travel tax|ভ্রমণ কর/i }).first();
    await expect(draftCard).toBeVisible();
    const draftId = await draftCard.getAttribute('data-draft-id');
    expect(draftId).toMatch(/^[0-9a-f-]{36}$/i);
    const initialSqlDraft = savedSqlDraft('user27', draftId!, savedPassengerId);
    expect(paymentRowsForReference(draftId!)).toBe(0);

    // A saved draft remains available to its owner after the existing Taxpayer
    // User ID sign-out/sign-in cycle, not only after a refresh in one session.
    await owner.setViewportSize({ width: 1600, height: 900 });
    const signOut = owner.locator('.taxpayer-reference-rail-bottom')
      .getByRole('button', { name: 'Sign out', exact: true });
    await expect(signOut).toBeVisible();
    await signOut.click();
    await signIn(owner, 'user27');
    const reauthenticatedDraft = owner.getByTestId('dashboard-payment-drafts')
      .locator('[data-draft-id="' + draftId + '"]');
    await expect(reauthenticatedDraft).toBeVisible();
    expect(savedSqlDraft('user27', draftId!, savedPassengerId)).toEqual(initialSqlDraft);
    await owner.reload();
    await expect(reauthenticatedDraft).toBeVisible();
    expect(savedSqlDraft('user27', draftId!, savedPassengerId)).toEqual(initialSqlDraft);

    // A different signed-in account cannot see the owner's saved Travel Tax form.
    const other = await openAccount('user28');
    const otherDashboard = other.getByTestId('dashboard-payment-drafts');
    await expect(otherDashboard).toBeVisible();
    await expect(otherDashboard.locator('[data-draft-id]').filter({ hasText: /travel tax|ভ্রমণ কর/i })).toHaveCount(0);
    expect(readPreviewDrafts('user28').some(row => row.id === draftId)).toBe(false);

    // Use the existing desktop language control at its supported 1600px rail breakpoint,
    // then recover the same owner-scoped SQL draft in Bengali on a phone-sized viewport.
    await owner.setViewportSize({ width: 1600, height: 900 });
    // The rail's accessible name changes with the selected language. Keep the test locator structural
    // so it still points to the same approved control after the interface changes to Bengali.
    const desktopRail = owner.locator('.taxpayer-reference-rail');
    await expect(desktopRail).toHaveAttribute('aria-label', 'Taxpayer desktop navigation');
    const languageSwitcher = desktopRail.locator('.taxpayer-reference-rail-bottom').getByRole('button').nth(1);
    await expect(languageSwitcher).toContainText('Language');
    await languageSwitcher.click();
    await expect(desktopRail).toHaveAttribute('aria-label', 'করদাতা ডেস্কটপ নেভিগেশন');
    await expect(languageSwitcher).toContainText('English');
    await expect(owner).toHaveURL(/lang=bn/);
    await owner.setViewportSize({ width: 375, height: 812 });
    await owner.reload();
    await expect(draftCard).toBeVisible();
    await expect(owner.locator('.taxpay-citizen-shell')).toHaveAttribute('lang', 'bn');

    // Preview identity fields were redacted. Re-enter and recheck every passenger in the restored batch.
    await draftCard.getByRole('button', { name: /Continue|চালিয়ে যান/ }).click();
    const resumed = owner.locator('.taxpay-modal').filter({ has: owner.locator('.travel-flow') });
    const resumedFlow = resumed.locator('.travel-flow');
    await expect(resumedFlow).toHaveAttribute('data-step', '0');
    await expect(resumedFlow).toHaveAttribute('lang', 'bn');
    const passengers = resumed.locator('[data-passenger-id]');
    await expect(passengers).toHaveCount(2);
    const first = passengers.nth(0);
    await expect(first.locator('#travel-passport-first')).toHaveValue('');
    await expect(first).toHaveAttribute('data-complete', 'false');
    await first.locator('#travel-passport-first').fill('TEST123456');
    await first.locator('#travel-lookup-first').click();
    await first.getByRole('button', { name: 'যাত্রী যোগ করুন', exact: true }).click();

    const resumedSecond = passengers.nth(1);
    const resumedSecondId = await resumedSecond.getAttribute('data-passenger-id');
    expect(resumedSecondId).toBeTruthy();
    await resumedSecond.getByRole('button', { name: 'সম্পাদনা', exact: true }).click();
    await expect(resumedSecond.locator('#travel-passport-' + resumedSecondId)).toHaveValue('');
    await expect(resumedSecond).toHaveAttribute('data-complete', 'false');
    await resumedSecond.locator('#travel-passport-' + resumedSecondId).fill('TEST230001');
    await resumedSecond.locator('#travel-lookup-' + resumedSecondId).click();
    await resumedSecond.getByRole('button', { name: 'যাত্রী যোগ করুন', exact: true }).click();
    await expect(resumed.locator('#travel-mobile')).toHaveValue('01712345678');
    await resumed.getByRole('button', { name: 'ভ্রমণের তথ্য দিতে এগিয়ে যান' }).click();
    await expect(resumedFlow).toHaveAttribute('data-step', '1');
    await expect(resumed.locator('#travel-port')).toHaveValue('Benapole');
    await expect(resumed.locator('#travel-destination')).toHaveValue('India');
    await resumed.locator('#travel-departure-date').fill(futureTravelDate);
    await resumed.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
    await expect(resumed.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);

    // Do not create a payment; discard the disposable draft after the full recovery journey.
    await resumed.locator('.taxpay-modal__header .taxpay-modal__close').click();
    const exitPrompt = owner.getByTestId('payment-draft-exit-overlay');
    await expect(exitPrompt).toBeVisible();
    await exitPrompt.getByRole('button', { name: 'কর পরিশোধ বাদ দিন', exact: true }).click();
    await expect(exitPrompt).toHaveCount(0);
    const refreshedCard = dashboard.locator('[data-draft-id="' + draftId + '"]');
    await expect(refreshedCard).toBeVisible();
    await refreshedCard.getByRole('button', { name: 'মুছুন', exact: true }).click();
    await refreshedCard.getByRole('button', { name: 'মুছে ফেলা নিশ্চিত করুন', exact: true }).click();
    await expect(refreshedCard).toHaveCount(0);
    expect(readPreviewDrafts('user27').some(row => row.id === draftId)).toBe(false);
    expect(readPreviewDrafts('user27').some(row => {
      const payload = row.form_payload as Record<string, unknown>;
      const people = payload.passengers as Array<Record<string, unknown>> | undefined;
      return Array.isArray(people) && people.length === 2 &&
        people[0]?.id === 'first' && people[1]?.id === savedPassengerId;
    })).toBe(false);
    await Promise.allSettled(contexts.slice(1).map(context => context.close()));
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
