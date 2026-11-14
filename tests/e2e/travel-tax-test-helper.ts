import type { Locator, Page } from '@playwright/test';

export const futureTravelDate = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Dhaka'})
  .format(new Date(Date.now() + 86_400_000));

/** Completes the primary passenger first, then travel details. Only simulated passport lookup is available. */
export async function fillTravelDetails(root: Locator | Page, options?: {
  mode?: 'LAND' | 'WATER'; port?: string; destination?: string; date?: string;
}) {
  // Travel Tax is lazy-loaded. Wait for the stage UI before any isVisible()
  // probe, otherwise a fast test skips passenger confirmation during chunk load.
  // The passport editor may disappear once a passenger is confirmed.
  // Receipt contact exists throughout the passenger stage; route options exist
  // on the travel stage. Wait for either stable stage anchor after lazy mount.
  await root.locator('#travel-mobile, #travel-tax-route-1').first().waitFor({ state: 'attached' });
  // Pay Again uses stable copied passenger IDs (e.g. repeat-traveller-1),
  // whereas a new payment starts with first. Confirm whichever is rendered.
  const passport = root.locator('input[id^="travel-passport-"]').first();
  const addPassenger = root.getByRole('button', {name: /^(Add passenger|যাত্রী যোগ করুন)$/});
  if (await passport.isVisible()) {
    if (!(await passport.inputValue())) await passport.fill('TEST123456');
    // Pay Again intentionally retains copied fields but revokes the previous
    // identity confirmation. Re-run the passport lookup if the passenger is
    // still unconfirmed, even when the input was already populated.
    // Before any lookup the confirmation button is intentionally absent;
    // after a copied draft it may be absent again until fresh validation.
    if (!(await addPassenger.isVisible()) || !(await addPassenger.isEnabled())) {
      await root.locator('button[id^="travel-lookup-"]').first().click();
    }
  }
  if (await addPassenger.isVisible() && await addPassenger.isEnabled()) await addPassenger.click();
  const mobile = root.locator('#travel-mobile');
  if (await mobile.isVisible() && !(await mobile.inputValue())) await mobile.fill('01712345678');
  const continueToTravel = root.locator('.travel-flow__primary').filter({ hasText: /Continue to travel details|ভ্রমণের তথ্য দিতে এগিয়ে যান/ });
  if (await continueToTravel.isVisible()) await continueToTravel.click();
  const mode = options?.mode ?? (await root.locator('#travel-tax-route-1').isChecked() ? 'WATER' : 'LAND');
  if (mode === 'WATER') {
    await root.locator('#travel-tax-route-1').check();
    await root.locator('#travel-water-port').fill(options?.port ?? 'Chattogram');
  } else {
    await root.locator('#travel-tax-route-0').check();
    await root.locator('#travel-port').selectOption(options?.port ?? 'Benapole');
  }
  await root.locator('#travel-destination').fill(options?.destination ?? 'India');
  await root.locator('#travel-departure-date').fill(options?.date ?? futureTravelDate);
}
/** Can be called on first stage or after continuing to the group-passenger stage. */
export async function fillForeignPassenger(root: Locator | Page, options?: {
  name?: string; passport?: string; birthDate?: string; country?: string;
}) {
  // The parent Travel Tax modal may exist before its lazy-loaded passenger
  // form has mounted. Wait for a real stage anchor before examining visibility;
  // do not misinterpret an unmounted form as a request to navigate Back.
  await root.locator('#travel-passenger-tab-first-FOREIGN, #travel-tax-route-1, .travel-flow__review')
    .first().waitFor({state:'attached'});
  let returnedToTravel = false;
  if (!(await root.locator('#travel-passenger-tab-first-FOREIGN').isVisible())) {
    const editPassengers = root.getByRole('button', { name: /Edit passengers|যাত্রী সম্পাদনা|Edit passengers and receipt contact/ }).first();
    if (await editPassengers.isVisible()) {
      await editPassengers.click();
      returnedToTravel = true;
    } else {
      await root.getByRole('button', {name: 'Back', exact: true}).click();
      returnedToTravel = true;
    }
    const firstEdit = root.locator('[data-passenger-id="first"]').getByRole('button', { name: /Edit|সম্পাদনা/ });
    if (await firstEdit.isVisible()) await firstEdit.click();
  }
  await root.locator('#travel-passenger-tab-first-FOREIGN').click();
  await root.locator('#travel-passport-first').fill(options?.passport ?? 'TRAVEL123');
  await root.locator('#travel-name-first').fill(options?.name ?? 'SAMPLE TRAVELLER');
  await root.locator('#travel-birth-date-first').fill(options?.birthDate ?? '1992-05-10');
  await root.locator('#travel-country-first').fill(options?.country ?? 'India');
  const confirmPassenger = root.getByRole('button', {name: /^(Add passenger|যাত্রী যোগ করুন)$/});
  if (await confirmPassenger.isVisible() && await confirmPassenger.isEnabled()) await confirmPassenger.click();
  const mobile = root.locator('#travel-mobile');
  if (await mobile.isVisible() && !(await mobile.inputValue())) await mobile.fill('01712345678');
  if (returnedToTravel) {
    await root.getByRole('button', {name: /Continue to travel details|ভ্রমণের তথ্য দিতে এগিয়ে যান/}).click();
  }
}
/** Complete the group-stage contact field without changing primary passenger identity. */
export async function fillTravelReceiptMobile(root: Locator | Page) {
  const field = root.locator('#travel-mobile');
  if (await field.isVisible()) {
    await field.fill('01712345678');
  } else {
    await root.getByRole('button', { name: /Edit passengers|যাত্রী সম্পাদনা|Edit passengers and receipt contact/ }).first().click();
    await root.locator('#travel-mobile').fill('01712345678');
    await root.getByRole('button', { name: /Continue to travel details|ভ্রমণের তথ্য দিতে এগিয়ে যান/ }).click();
  }
}
