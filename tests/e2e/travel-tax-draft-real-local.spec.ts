import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { openTaxpayerTravelTax } from './taxpayer-travel-menu-helper';
import { futureTravelDate } from './travel-tax-test-helper';

type LocalAccount = 'user27' | 'user28';

/** Signed-in Travel Tax draft recovery against disposable local Supabase/Auth/RLS only. */
test('signed-in Travel Tax draft survives refresh, rechecks passengers and stays owner-scoped', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Keep the isolated account pair serial.');
  test.setTimeout(120_000);

  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('Disposable local Supabase is required.');
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Refusing hosted SQL draft browser test.');
  }

  const contexts: BrowserContext[] = [];
  const openAccount = async (id: LocalAccount): Promise<Page> => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 1280, height: 800 },
    });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(20_000);
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill(id);
    await page.getByLabel('Password', { exact: true }).fill(id);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
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
    expect(draftId).toBeTruthy();

    // A different signed-in account cannot see the owner's saved Travel Tax form.
    const other = await openAccount('user28');
    const otherDashboard = other.getByTestId('dashboard-payment-drafts');
    await expect(otherDashboard).toBeVisible();
    await expect(otherDashboard.locator('[data-draft-id]').filter({ hasText: /travel tax|ভ্রমণ কর/i })).toHaveCount(0);

    // Use the existing desktop language control at its supported 1600px rail breakpoint,
    // then recover the same owner-scoped SQL draft in Bengali on a phone-sized viewport.
    await owner.setViewportSize({ width: 1600, height: 900 });
    const desktopRail = owner.getByRole('complementary', { name: 'Taxpayer desktop navigation' });
    const languageSwitcher = desktopRail.locator('.taxpayer-reference-rail-bottom')
      .getByRole('button').filter({ hasText: 'Language' });
    await languageSwitcher.click();
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
    const refreshedCard = dashboard.locator('[data-draft-id="' + draftId + '"]');
    await expect(refreshedCard).toBeVisible();
    await refreshedCard.getByRole('button', { name: 'মুছুন', exact: true }).click();
    await refreshedCard.getByRole('button', { name: 'মুছে ফেলা নিশ্চিত করুন', exact: true }).click();
    await expect(refreshedCard).toHaveCount(0);
    await Promise.allSettled(contexts.slice(1).map(context => context.close()));
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
