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
  await expect(modal.getByRole('button',{name:'Back',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeDisabled();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeEnabled();
  await expect(modal.locator('#travel-medical-first')).toBeVisible();
  await modal.getByRole('button',{name:'Add passenger'}).click();
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toBeEnabled();
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toBeFocused();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
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

test('Travel Tax: passport Check button activates on entry and results overlay without moving the field',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const passport=modal.locator('#travel-passport-first');
  const check=modal.locator('#travel-lookup-first');
  await expect(check).toBeDisabled();
  await passport.focus();
  const row=modal.locator('.travel-flow__passport-row');
  const baseline=await row.boundingBox();
  const suggestions=modal.locator('#travel-passport-suggestions-first');
  await expect(suggestions.getByRole('option')).toHaveCount(10);
  await expect(suggestions.getByText('Sample passport numbers')).toBeVisible();
  const withPopup=await row.boundingBox();
  expect(withPopup?.height).toBeCloseTo(baseline?.height??0,0);
  await passport.fill('TEST12');
  await expect(check).toBeEnabled();
  await passport.fill('');
  await expect(check).toBeDisabled();
  await suggestions.getByRole('option',{name:/TEST230005/}).click();
  await expect(check).toBeEnabled();
  await check.click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
});

test('Travel Tax: medical row and receipt contact are full width with a divider',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const medical=modal.locator('.travel-flow__medical-option');
  const contact=modal.locator('.travel-flow__contact');
  const mobile=modal.locator('#travel-mobile');
  const medicalBounds=await medical.boundingBox();
  const cardBounds=await modal.locator('[data-passenger-id="first"]').boundingBox();
  expect(medicalBounds).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  expect(medicalBounds!.width).toBeGreaterThan(cardBounds!.width * .8);
  const contactBounds=await contact.boundingBox();
  const inputBounds=await mobile.boundingBox();
  expect(inputBounds).not.toBeNull();
  expect(contactBounds).not.toBeNull();
  expect(inputBounds!.width).toBeGreaterThan(contactBounds!.width * .92);
  const divider=await contact.evaluate(element=>getComputedStyle(element).borderTopStyle);
  expect(divider).toBe('solid');
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.locator('#travel-medical-first')).toBeVisible();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.getByRole('button',{name:'Add passenger'}).click();
  await mobile.fill('01712345678');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
  await mobile.fill('0171234');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
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
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await fillForeignPassenger(modal);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
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
  await modal.getByRole('button',{name:'Add another passenger'}).click();
  const people=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second=people.nth(1);
  await expect(second.getByRole('combobox')).toBeFocused();
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
  await expect(combined).toContainText('FRIEND SECOND');
  await expect(combined).toContainText('1,500');
  if ((page.viewportSize()?.width ?? 0) >= 651) {
    await expect(combined.locator('.receipt-view__travel-table')).toBeVisible();
  } else {
    const cards = combined.getByTestId('travel-receipt-passenger-cards');
    await expect(cards).toBeVisible();
    await expect(cards.locator('article')).toHaveCount(2);
  }
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
  await modal.getByRole('button',{name:'Add another passenger'}).click();
  const second=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person').nth(1);
  await second.getByLabel('Passport number').focus();
  const unusedSuggestions = second.locator('.travel-flow__passport-suggestions');
  await expect(unusedSuggestions.getByRole('option')).toHaveCount(9);
  await expect(unusedSuggestions.getByRole('option',{name:/TEST123456/})).toHaveCount(0);
  await second.getByLabel('Passport number').fill('TEST123456');
  await expect(second.getByText('Passport already added.',{exact:true})).toBeVisible();
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(modal.getByRole('alert')).toContainText('Passport already added.');
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeDisabled();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await second.getByLabel('Passport number').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(second.locator('.travel-flow__inline-error')).toHaveCount(0);
  await second.getByRole('button',{name:'Add passenger'}).click();
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
});

test('Travel Tax: an invalid sample cannot fabricate a government passport lookup',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const passport = modal.locator('#travel-passport-first');
  await passport.fill('REALPASSPORT1');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByRole('alert')).toContainText('not connected');
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveCount(0);
  await passport.fill('TEST123456');
  await expect(passport).toHaveValue('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
});

test('Travel Tax: medical referral is not an online tax exemption',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.locator('#travel-medical-first')).toBeVisible();
  await modal.locator('#travel-medical-first').check();
  await modal.locator('#travel-mobile').fill('01712345678');
  const help = modal.getByRole('button',{name:'What is manual assessment?'});
  await help.click();
  await expect(modal.getByRole('tooltip')).toContainText('does not approve a tax exemption online');
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeDisabled();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await modal.locator('#travel-medical-first').uncheck();
  await modal.getByRole('button',{name:'Add passenger'}).click();
  await expect(modal.locator('#travel-medical-first')).toBeVisible();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
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


test('Travel Tax: Step 1 scroll stays inside the modal with accessible fixed actions', async ({page}, info) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  const body = modal.locator('.taxpay-modal__body');
  const main = modal.locator('.travel-flow__main');
  const header = modal.locator('.taxpay-modal__header');
  const footer = modal.locator('.taxpay-modal__footer');
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', {name: 'Add passenger'}).click();
  await modal.getByRole('button', {name: 'Add another passenger'}).click();
  const beforeHeader = await header.boundingBox();
  const beforeFooter = await footer.boundingBox();
  expect(beforeHeader).not.toBeNull();
  expect(beforeFooter).not.toBeNull();

  const owner = info.project.name === 'desktop-1280' ? body : main;
  const other = info.project.name === 'desktop-1280' ? main : body;
  expect(await owner.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
  expect(await other.evaluate(element => getComputedStyle(element).overflowY))
    .not.toBe('auto');
  const scroll = await owner.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return {position: element.scrollTop, overflow: element.scrollHeight - element.clientHeight};
  });
  expect(scroll.overflow).toBeGreaterThan(0);
  expect(scroll.position).toBeGreaterThan(0);
  await expect(modal.getByRole('button', {name: 'Continue to travel details'})).toBeVisible();
  const afterHeader = await header.boundingBox();
  const afterFooter = await footer.boundingBox();
  expect(Math.abs(afterHeader!.y - beforeHeader!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFooter!.y - beforeFooter!.y)).toBeLessThanOrEqual(1);
});

test('Travel Tax: full-width travel date and contained calculation panel', async ({page}, info) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await fillTravelDetails(modal);
  const date = modal.locator('#travel-departure-date');
  const dateField = modal.locator('.travel-flow__field--full');
  const fields = modal.locator('.travel-flow__fields');
  const fieldBox = await dateField.boundingBox();
  const gridBox = await fields.boundingBox();
  const inputBox = await date.boundingBox();
  expect(fieldBox).not.toBeNull();
  expect(gridBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(fieldBox!.width).toBeGreaterThan(gridBox!.width * 0.95);
  expect(inputBox!.width).toBeGreaterThan(fieldBox!.width * 0.95);
  await expect(date).toHaveValue('2026-11-20');
  await expect(modal.getByRole('button', {name: 'Continue to review'})).toBeEnabled();

  if (info.project.name === 'desktop-1280') {
    const rail = modal.locator('.travel-flow__summary');
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('heading', {name: 'Payment calculation'})).toBeVisible();
    await expect(rail.getByTestId('travel-payment-total')).not.toHaveText('—');
    expect(await rail.evaluate(element => getComputedStyle(element).overflowY)).toBe('hidden');
    expect(await rail.locator('.travel-flow__age-breakdown').evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
    const railBox = await rail.boundingBox();
    const mainBox = await modal.locator('.travel-flow__main').boundingBox();
    expect(railBox!.x).toBeGreaterThanOrEqual(mainBox!.x + mainBox!.width - 2);
    expect(railBox!.width).toBeGreaterThanOrEqual(260);
  } else {
    await expect(modal.locator('.travel-flow__summary')).toBeHidden();
    await expect(modal.getByTestId('mobile-payment-calculation')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});


test('Travel Tax: modal resizing, conditional passenger cards and passport suggestions use gentle motion', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await expect(modal).toBeVisible();
  const modalMotion = await modal.evaluate(element => getComputedStyle(element).transitionProperty);
  expect(modalMotion).toContain('height');
  expect(modalMotion).toContain('width');

  const passport = modal.locator('#travel-passport-first');
  await passport.focus();
  const suggestions = modal.locator('#travel-passport-suggestions-first');
  await expect(suggestions).toBeVisible();
  expect(await suggestions.evaluate(element => getComputedStyle(element).animationName))
    .toContain('travel-flow-reveal');
  await passport.fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByRole('button', {name: 'Add passenger'})).toBeEnabled();
  await modal.getByRole('button', {name: 'Add passenger'}).click();
  await modal.getByRole('button', {name: 'Add another passenger'}).click();
  const newPassenger = modal.locator('.travel-flow__person').last();
  await expect(newPassenger).toBeVisible();
  expect(await newPassenger.evaluate(element => getComputedStyle(element).animationName))
    .toContain('travel-flow-expand');
  await expect(modal.locator('.travel-flow__person-body').last()).toBeVisible();
  await expect(modal.getByRole('button', {name: 'Continue to travel details'})).toBeDisabled();
});

test('Travel Tax: mode changes animate without changing controls; reduced motion disables effects', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await fillTravelDetails(modal);
  await expect(modal.locator('#travel-port')).toBeVisible();
  await modal.locator('#travel-tax-route-1').check();
  const water = modal.locator('#travel-water-port');
  await expect(water).toBeVisible();
  await expect(modal.locator('#travel-port')).toHaveCount(0);
  expect(await water.locator('..').evaluate(element => getComputedStyle(element).animationName))
    .toContain('travel-flow-reveal');
  await page.emulateMedia({reducedMotion: 'reduce'});
  expect(await water.locator('..').evaluate(element => getComputedStyle(element).animationName))
    .toBe('none');
  expect(await modal.evaluate(element => getComputedStyle(element).transitionDuration))
    .toMatch(/^(0s(?:, 0s)*)$/);
  await water.fill('Mongla');
  await expect(water).toHaveValue('Mongla');
});
