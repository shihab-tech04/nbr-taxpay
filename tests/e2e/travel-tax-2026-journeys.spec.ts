import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, fillForeignPassenger } from './travel-tax-test-helper';

test('Travel Tax 2026: Land is default, Air is excluded and zone codes follow the client list', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name:'Travel tax'});
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel details');
  await expect(modal.locator('#travel-tax-route-results input[type=radio]')).toHaveCount(2);
  await expect(modal.locator('#travel-tax-route-0')).toBeChecked();
  await expect(modal.getByText('By air', {exact:false})).toHaveCount(0);
  await modal.getByRole('button', {name:'Continue to passenger details'}).click();
  await expect(modal.getByRole('alert')).toContainText('departure port');
  await fillTravelDetails(modal);
  await expect(modal.locator('#travel-organization-code')).toHaveValue('1110215102417');
  await expect(modal.locator('#travel-economic-code')).toHaveValue('1144102');
  await modal.getByRole('button', {name:'Continue to passenger details'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await modal.getByRole('button', {name:'Back'}).click();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await modal.locator('#travel-tax-route-1').check();
  await expect(modal.locator('#travel-water-port')).toBeVisible();
  await expect(modal.locator('#travel-port')).toHaveCount(0);
});

test('Travel Tax 2026: friends and family share one challan with passenger-wise totals', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await fillForeignPassenger(modal,{name:'FIRST FOREIGN',passport:'A1234567'});
  await modal.getByRole('button',{name:/Add New Member/}).click();
  await expect(modal.getByTestId('travel-passenger-list').locator('.travel-flow__person')).toHaveCount(2);
  const second = modal.getByTestId('travel-passenger-list').locator('.travel-flow__person').nth(1);
  await second.getByLabel('Passport number').fill('B7654321');
  await second.getByLabel('Passenger name').fill('FRIEND SECOND');
  await second.getByLabel('Age category').selectOption('CHILD');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.locator('.travel-flow__passenger-table tfoot')).toContainText('1,500');
  await expect(modal.locator('.travel-flow__review')).toContainText('1144102');
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm preview payment'}).click();
  const combined = modal.getByTestId('travel-family-challan');
  await expect(combined).toBeVisible({timeout:12000});
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('1,500');
  await expect(modal.locator('.receipt-view__paper')).toContainText('SIM-');
  await expect(combined).toContainText('not a government A-Challan');
  await expect(modal.locator('.travel-flow__summary')).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Print receipt'})).toBeVisible();
});

test('Travel Tax 2026: Bangladeshi lookup cannot silently invent a real passport identity',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await modal.getByLabel('Passenger nationality').selectOption('BD');
  const name = modal.getByLabel('Passenger name');
  await expect(name).toHaveAttribute('readonly','');
  await modal.getByLabel('Passport number').fill('REALPASSPORT1');
  await modal.getByRole('button',{name:/Retrieve passport details/}).click();
  await expect(modal.getByRole('alert')).toContainText('not connected');
  await expect(name).toHaveValue('');
  await modal.getByLabel('Passport number').fill('DEMO123456');
  await modal.getByRole('button',{name:/Retrieve passport details/}).click();
  await expect(name).toHaveValue('SAMPLE BANGLADESHI PASSENGER');
  await expect(modal.getByText('Sample identity only', {exact:false})).toBeVisible();
});

test('Travel Tax 2026: medical referral requires port procedure, not online exemption approval',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await fillForeignPassenger(modal);
  await modal.locator('#travel-medical-first').check();
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.getByRole('alert')).toContainText('manual documentation');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
});

test('Travel Tax 2026: mobile footer calculation and EN/BN journey contain no page overflow',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile-specific payment layout');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('mobile-payment-calculation')).toBeVisible();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.getByRole('button',{name:'Continue to passenger details'}).click();
  await fillForeignPassenger(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.getByTestId('mobile-payment-calculation').locator('summary')).toContainText('1,000');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
