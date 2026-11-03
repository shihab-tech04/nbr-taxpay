import type { Locator, Page } from '@playwright/test';

/** Completes the primary passenger first, then travel details. Only simulated passport lookup is available. */
export async function fillTravelDetails(root: Locator | Page, options?: {
  mode?: 'LAND' | 'WATER'; port?: string; destination?: string; date?: string;
}) {
  const passport = root.locator('#travel-passport-first');
  if (await passport.isVisible() && !(await passport.inputValue())) {
    await passport.fill('TEST123456');
    await root.locator('#travel-lookup-first').click();
  }
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
  await root.locator('#travel-departure-date').fill(options?.date ?? '2026-11-20');
}
/** Can be called on first stage or after continuing to the group-passenger stage. */
export async function fillForeignPassenger(root: Locator | Page, options?: {
  name?: string; passport?: string; birthDate?: string; country?: string;
}) {
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
