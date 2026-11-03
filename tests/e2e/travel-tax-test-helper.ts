import type { Locator, Page } from '@playwright/test';

/** Completes the primary passenger first, then travel details. Only simulated passport lookup is available. */
export async function fillTravelDetails(root: Locator | Page, options?: {
  mode?: 'LAND' | 'WATER'; port?: string; destination?: string; date?: string;
}) {
  const primary = root.locator('#travel-passport-first');
  if (await primary.isVisible() && !(await primary.inputValue())) {
    await primary.fill('TEST123456');
    await root.locator('#travel-lookup-first').click();
  }
  const continueToTravel = root.getByRole('button', { name: 'Continue to travel details' });
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
  let returnedToStageOne = false;
  const foreignTab = root.locator('#travel-passenger-tab-first-FOREIGN');
  if (!(await foreignTab.isVisible())) {
    await root.getByRole('button', { name: 'Edit details' }).click();
    returnedToStageOne = true;
  }
  await root.locator('#travel-passenger-tab-first-FOREIGN').click();
  await root.locator('#travel-passport-first').fill(options?.passport ?? 'TRAVEL123');
  await root.locator('#travel-name-first').fill(options?.name ?? 'SAMPLE TRAVELLER');
  await root.locator('#travel-birth-date-first').fill(options?.birthDate ?? '1992-05-10');
  await root.locator('#travel-country-first').fill(options?.country ?? 'India');
  if (returnedToStageOne) await root.getByRole('button', { name: 'Continue to add passengers' }).click();
  if (await root.locator('#travel-mobile').isVisible()) await root.locator('#travel-mobile').fill('01712345678');
}

/** Complete the group-stage contact field without changing primary passenger identity. */
export async function fillTravelReceiptMobile(root: Locator | Page) {
  await root.locator('#travel-mobile').fill('01712345678');
}
