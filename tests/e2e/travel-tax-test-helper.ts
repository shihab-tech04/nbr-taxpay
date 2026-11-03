import type { Locator, Page } from '@playwright/test';

/** Client-approved Travel Tax entry with reference-only port/zone data. */
export async function fillTravelDetails(root: Locator | Page, options?: {
  mode?: 'LAND' | 'WATER'; port?: string; destination?: string; date?: string;
}) {
  const mode = options?.mode ?? 'LAND';
  if (mode === 'WATER') {
    await root.locator('#travel-tax-route-1').check();
    await root.locator('#travel-water-port').fill(options?.port ?? 'Chattogram');
  } else {
    await root.locator('#travel-tax-route-0').check();
    await root.locator('#travel-port').selectOption(options?.port ?? 'Benapole');
  }
  await root.locator('#travel-port-number').fill('PORT-REVIEW-01');
  await root.locator('#travel-destination').fill(options?.destination ?? 'India');
  await root.locator('#travel-departure-date').fill(options?.date ?? '2026-11-20');
  await root.locator('#travel-tax-zone').selectOption('1110215102417');
}

/** All fields belong to one passenger; the app never fabricates a passport API response. */
export async function fillForeignPassenger(root: Locator | Page, options?: {
  name?: string; passport?: string; ageBand?: 'ADULT' | 'CHILD' | 'UNDER5';
}) {
  await root.locator('#travel-nationality-first').selectOption('FOREIGN');
  await root.locator('#travel-name-first').fill(options?.name ?? 'SAMPLE TRAVELLER');
  await root.locator('#travel-passport-first').fill(options?.passport ?? 'TRAVEL123');
  await root.locator('#travel-age-first').selectOption(options?.ageBand ?? 'ADULT');
  await root.locator('#travel-mobile').fill('01712345678');
}
