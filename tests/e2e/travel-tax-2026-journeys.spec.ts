import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, fillForeignPassenger, fillTravelReceiptMobile } from './travel-tax-test-helper';

test('Travel Tax: Step 1 identifies missing travel fields before age validation', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await modal.getByRole('button', {name: 'Continue to travel details'}).click();
  const continueButton = modal.getByRole('button', {name: 'Continue to add passengers'});

  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select a departure port.');
  await modal.locator('#travel-port').selectOption('Benapole');

  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select or enter a destination.');
  await modal.locator('#travel-destination').fill('India');

  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select your travel date.');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');

  await modal.locator('#travel-departure-date').fill('2026-11-20');
  await continueButton.click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
});

test('Travel Tax: ten fictional passports suggest on focus and confirm the selected identity', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  const passport = modal.locator('#travel-passport-first');
  await passport.focus();
  const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
  await expect(options).toHaveCount(10);
  await options.filter({hasText: 'TEST230005'}).click();
  await expect(passport).toHaveValue('TEST230005');
  await modal.getByRole('button', {name: 'Check Passport'}).click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
  await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await modal.getByRole('button', {name: 'Continue to travel details'}).click();
  await expect(modal.locator('#travel-tax-route-results')).toBeVisible();
  await expect(modal.locator('#travel-tax-route-results')).toContainText('By land');
  await expect(modal.locator('#travel-tax-route-results')).not.toContainText('স্থলপথে');
  await modal.getByRole('button', {name: 'Edit passenger details'}).click();
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
});

test('Travel Tax: foreign passenger must enter mandatory identity fields before travel details', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await modal.locator('#travel-passenger-tab-first-FOREIGN').click();
  await expect(modal.locator('#travel-country-first')).toBeVisible();
  await expect(modal.locator('#travel-lookup-first')).toHaveCount(0);
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await modal.getByRole('button', {name: 'Continue to travel details'}).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await fillForeignPassenger(modal);
  await modal.getByRole('button', {name: 'Continue to travel details'}).click();
  await expect(modal.locator('#travel-tax-route-results')).toBeVisible();
});

test('Travel Tax: passenger tabs first, Land default, no rate on mode cards or accounting inputs', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger and travel details');
  await expect(modal.getByRole('button', {name:'Continue to travel details'})).toBeVisible();
  await expect(modal.locator('#travel-passenger-tab-first-BD')).toHaveAttribute('aria-selected', 'true');
  await expect(modal.locator('#travel-passenger-tab-first-BD svg')).toBeVisible();
  const routes = modal.locator('#travel-tax-route-results');
  await expect(routes).toHaveCount(0);
  await expect(modal.locator('#travel-port-number, #travel-tax-zone, #travel-organization-code')).toHaveCount(0);
  await expect(modal.getByTestId('travel-payment-total')).toHaveText('—');
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(routes.locator('input[type=radio]')).toHaveCount(2);
  await expect(routes.locator('#travel-tax-route-0')).toBeChecked();
  await expect(routes.getByText('1,000')).toHaveCount(0);
  await expect(routes.getByText('স্থলপথে')).toHaveCount(0);
  const boxes = await Promise.all([
    routes.locator('.travel-flow__route').nth(0).boundingBox(),
    routes.locator('.travel-flow__route').nth(1).boundingBox(),
  ]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) > 520) {
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(2);
  } else {
    expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height);
  }
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,000');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 34 on travel date');
  await modal.getByRole('button', {name:'Continue to add passengers'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(modal.locator('#travel-port-number, #travel-tax-zone, #travel-organization-code')).toHaveCount(0);
  await modal.getByRole('button', {name:'Back',exact:true}).click();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await routes.locator('#travel-tax-route-1').check();
  await expect(modal.locator('#travel-water-port')).toBeVisible();
});

test('Travel Tax: foreign tab shows only manual identity fields and derives rate from birth date',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passenger-tab-first-FOREIGN').click();
  await expect(modal.locator('#travel-country-first')).toBeVisible();
  await expect(modal.locator('#travel-lookup-first')).toHaveCount(0);
  await fillForeignPassenger(modal,{birthDate:'2017-08-10'});
  await fillTravelDetails(modal,{mode:'WATER'});
  await expect(modal.getByTestId('travel-payment-total')).toContainText('500');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 9 on travel date');
  await modal.getByRole('button',{name:'Continue to add passengers'}).click();
  await fillTravelReceiptMobile(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
  await expect(modal.locator('.travel-flow__review')).toContainText('Chattogram');
});

test('Travel Tax: family and friends share one passenger-wise preview challan',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to add passengers'}).click();
  await fillTravelReceiptMobile(modal);
  await modal.getByRole('button',{name:/Add New Member/}).click();
  const people=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second=people.nth(1);
  await second.getByRole('tab',{name:'Foreign passenger'}).click();
  await second.getByLabel('Passport number').fill('B7654321');
  await second.getByLabel('Passenger name as on passport').fill('FRIEND SECOND');
  await second.getByLabel('Date of birth').fill('2017-08-10');
  await second.getByLabel('Country of nationality').fill('India');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.locator('.travel-flow__passenger-table tfoot')).toContainText('1,500');
  await expect(modal.locator('.travel-flow__review')).toContainText('Benapole');
  await expect(modal.locator('.travel-flow__review')).not.toContainText('Organization');
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm preview payment'}).click();
  const combined=modal.getByTestId('travel-family-challan');
  await expect(combined).toBeVisible({timeout:12000});
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('not a government A-Challan');
  await expect(combined).not.toContainText('Organizational code');
  await expect(combined).not.toContainText('port and number');
});

test('Travel Tax: government passport lookup must not fabricate identity',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('REALPASSPORT1');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByRole('alert')).toContainText('not connected');
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveCount(0);
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('1992-04-18');
  await expect(modal.getByText('Sample identity and birth date only', {exact:false})).toBeVisible();
});

test('Travel Tax: medical referral is never an online tax exemption',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await modal.locator('#travel-medical-first').check();
  await modal.getByRole('button',{name:'Continue to add passengers'}).click();
  await expect(modal.getByRole('alert')).toContainText('manual documentation');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
});

test('Travel Tax: mobile age breakdown and payment summary remain within viewport',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile-specific payment layout');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  const footer=modal.getByTestId('mobile-payment-calculation');
  await expect(footer).toBeVisible();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.getByRole('button',{name:'Continue to add passengers'}).click();
  await fillTravelReceiptMobile(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(footer.locator('summary')).toContainText('1,000');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
