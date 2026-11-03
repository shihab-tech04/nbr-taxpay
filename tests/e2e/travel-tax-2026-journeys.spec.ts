import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, fillForeignPassenger } from './travel-tax-test-helper';

test('Travel Tax: Step 1 collects passengers and contact, Step 2 starts with travel mode', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await expect(modal.locator('#travel-mobile')).toBeVisible();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.getByRole('alert')).toContainText('receipt mobile number');
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel details');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await expect(modal.locator('#travel-tax-route-0')).toBeChecked();
  await expect(modal.locator('#travel-passport-first')).toHaveCount(0);
  const continueButton=modal.getByRole('button',{name:'Continue to review'});
  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select a departure port.');
  await modal.locator('#travel-port').selectOption('Benapole');
  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select or enter a destination.');
  await modal.locator('#travel-destination').fill('India');
  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select your travel date.');
  await modal.locator('#travel-departure-date').fill('2026-11-20');
  await continueButton.click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Review & payment');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
  await modal.getByRole('button',{name:'Edit travel details'}).click();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
});

test('Travel Tax: ten fictional passports are scrollable, selectable and verifiable', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').focus();
  const list=modal.locator('#travel-passport-suggestions-first');
  const options=list.getByRole('option');
  await expect(options).toHaveCount(10);
  await expect(options.first()).toBeVisible();
  const geometry=await list.evaluate(el=>({scroll:el.scrollHeight,visible:el.clientHeight}));
  expect(geometry.scroll).toBeGreaterThan(geometry.visible);
  await options.filter({hasText:'TEST230005'}).click();
  await modal.getByRole('button',{name:'Check Passport'}).click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
  await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeVisible();
});

test('Travel Tax: foreign passenger enters every mandatory identity field', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.getByRole('tab',{name:'Foreign passenger'}).click();
  await expect(modal.locator('#travel-country-first')).toBeVisible();
  await expect(modal.locator('#travel-lookup-first')).toHaveCount(0);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await fillForeignPassenger(modal);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('#travel-tax-route-results')).toBeVisible();
});

test('Travel Tax: Land is default, mode cards do not display rates or mixed languages', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  const routes=modal.locator('#travel-tax-route-results');
  await expect(routes.locator('input[type=radio]')).toHaveCount(2);
  await expect(routes.locator('#travel-tax-route-0')).toBeChecked();
  await expect(routes).toContainText('By land');
  await expect(routes).not.toContainText('স্থলপথে');
  await expect(routes.getByText('1,000')).toHaveCount(0);
  const boxes=await Promise.all([routes.locator('.travel-flow__route').nth(0).boundingBox(),routes.locator('.travel-flow__route').nth(1).boundingBox()]);
  expect(boxes[0]).not.toBeNull();expect(boxes[1]).not.toBeNull();
  if ((page.viewportSize()?.width??0)>520) expect(Math.abs(boxes[0]!.y-boxes[1]!.y)).toBeLessThanOrEqual(2);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,000');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 34 on travel date');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await routes.locator('#travel-tax-route-1').check();
  await expect(modal.locator('#travel-water-port')).toBeVisible();
});

test('Travel Tax: foreign child receives illustrative half rate',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillForeignPassenger(modal,{birthDate:'2017-08-10'});
  await fillTravelDetails(modal,{mode:'WATER'});
  await expect(modal.getByTestId('travel-payment-total')).toContainText('500');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 9 on travel date');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
  await expect(modal.locator('.travel-flow__review')).toContainText('Chattogram');
});

test('Travel Tax: additional passengers are added in Step 1, share one receipt and one total',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger'}).click();
  const people=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second=people.nth(1);
  await second.getByRole('tab',{name:'Foreign passenger'}).click();
  await second.getByLabel('Passport number').fill('B7654321');
  await second.getByLabel('Passenger name as on passport').fill('FRIEND SECOND');
  await second.getByLabel('Date of birth').fill('2017-08-10');
  await second.getByLabel('Country of nationality').fill('India');
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.locator('.travel-flow__passenger-table tfoot')).toContainText('1,500');
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm preview payment'}).click();
  const combined=modal.getByTestId('travel-family-challan');
  await expect(combined).toBeVisible({timeout:12000});
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('not a government A-Challan');
  await expect(modal.locator('.receipt-view__actions')).not.toContainText('New payment');
  await expect(modal.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Print receipt'})).toBeVisible();
});

test('Travel Tax: duplicate passports cannot be confirmed or included in final total',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger'}).click();
  const second=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person').nth(1);
  await second.getByLabel('Passport number').fill('TEST123456');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(second.locator('.travel-flow__inline-error')).toContainText('already used');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await second.getByLabel('Passport number').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(second.locator('.travel-flow__inline-error')).toHaveCount(0);
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
});

test('Travel Tax: an invalid sample cannot fabricate a government passport lookup',async({page})=>{
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
});

test('Travel Tax: medical referral is not an online tax exemption',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.locator('[data-passenger-id="first"]').getByRole('button',{name:'Edit'}).click();
  await modal.locator('#travel-medical-first').check();
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.getByRole('alert')).toContainText('medical exemption requires assessment');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
});

test('Travel Tax: mobile payment calculation stays contained in Step 2 and Step 3',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile-specific payment layout');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  const footer=modal.getByTestId('mobile-payment-calculation');
  await expect(footer).toBeVisible();
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await expect(footer.locator('summary')).toContainText('1,000');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
