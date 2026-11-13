import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, fillForeignPassenger, futureTravelDate } from './travel-tax-test-helper';

test('Pay Tax and Travel Tax keep the same modal width across passenger and travel stages', async ({page}, info) => {
  await page.goto('/');
  // Start an ordinary Tax with Return payment and measure its shared modal
  // after selecting the payer, service and walk-in access.
  await page.getByRole('button', {name:'Pay Tax',exact:true}).click();
  const payment = page.getByRole('dialog',{name:'Pay Tax'});
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await payment.locator('[data-payment-access="GUEST"]').click();
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(payment.locator('#guest-tin')).toBeVisible();
  // Pay Tax grows from the compact access-choice dialog to the 1160px
  // workflow dialog. Measure only after that existing width transition ends.
  await payment.evaluate(async dialog => {
    await Promise.all(dialog.getAnimations({subtree:false})
      .filter(animation => animation.playState === 'running')
      .map(animation => animation.finished.catch(() => undefined)));
  });
  const paymentBox = await payment.boundingBox();
  expect(paymentBox).not.toBeNull();
  const paymentWidth = paymentBox!.width;
  // Measure each service from a clean public entry; avoid coupling width
  // parity to an unrelated close-control accessible-name contract.
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const travel = page.getByRole('dialog',{name:'Travel tax'});
  const checkWidth = async (stage: string) => {
    await expect(travel.locator('.taxpay-modal__title')).toHaveText(stage);
    await expect.poll(async () => {
      const box = await travel.boundingBox();
      return Math.abs((box?.width ?? 0) - paymentWidth);
    }, {timeout:6000}).toBeLessThanOrEqual(2);
    const box = await travel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
    expect(await travel.locator('.taxpay-modal__body').evaluate(
      el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
  };

  // Modal width is an invariant; only its content and allowable height change.
  await checkWidth('Passengers and receipt details');
  await travel.locator('#travel-passport-first').fill('TEST123456');
  await travel.locator('#travel-lookup-first').click();
  await travel.getByRole('button',{name:'Add passenger',exact:true}).click();
  await travel.locator('#travel-mobile').fill('01712345678');
  await travel.getByRole('button',{name:'Continue to travel details'}).click();
  await checkWidth('Travel details');
  await travel.locator('#travel-port').selectOption('Benapole');
  await travel.locator('#travel-destination').fill('India');
  await travel.locator('#travel-departure-date').fill(futureTravelDate);
  await travel.getByRole('button',{name:'Continue to review'}).click();
  await checkWidth('Review & payment');
  if (info.project.name === 'desktop-1280' || info.project.name === 'mobile-375') {
    await page.screenshot({
      path: `test-results/screenshots/travel-width-parity-${info.project.name}.png`,
      fullPage:false
    });
  }
});

test('Travel Tax: Step 1 collects passengers and contact, Step 2 starts with travel mode', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await expect(modal.locator('#travel-mobile')).toBeVisible();
  await expect(modal.locator('#travel-receipt-email')).toHaveCount(0);
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await expect(modal.getByRole('button',{name:'Back',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toBeEnabled();
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.getByRole('button', {name:'Add passenger', exact:true}).click();
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toBeVisible();
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
  await modal.locator('#travel-departure-date').fill('2000-01-01');
  await continueButton.click();
  await expect(modal.getByRole('alert')).toHaveText('Select today or a future travel date.');
  await modal.locator('#travel-departure-date').fill(futureTravelDate);
  await continueButton.click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Review & payment');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
  await modal.getByRole('button',{name:'Edit travel details'}).click();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
});

test('Travel Tax: Add passenger is attached to the checked passenger card, not receipt contact', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  const passenger = modal.locator('[data-passenger-id="first"]');
  const add = passenger.getByRole('button', {name: 'Add passenger', exact: true});
  await expect(add).toHaveCount(0);
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await expect(add).toHaveCount(0);
  await modal.locator('#travel-lookup-first').click();
  await expect(passenger.getByTestId('travel-passenger-name-first'))
    .toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(add).toBeVisible();
  await expect(passenger.locator('.travel-flow__confirm-row')).toBeVisible();
  const medicalBox = await passenger.locator('.travel-flow__medical-option').boundingBox();
  const confirmBox = await add.boundingBox();
  expect(medicalBox).not.toBeNull();
  expect(confirmBox).not.toBeNull();
  // Confirmation spans the same content column as medical review, not
  // a small, distant button anchored to the right of a huge empty row.
  expect(Math.abs(confirmBox!.x - medicalBox!.x)).toBeLessThanOrEqual(3);
  expect(confirmBox!.width).toBeGreaterThanOrEqual(medicalBox!.width * 0.96);
  const footer = await modal.locator('.taxpay-modal__footer').boundingBox();
  expect(footer).not.toBeNull();
  // The action must be completely above the fixed modal footer.
  await expect.poll(async () => {
    const action = await add.boundingBox();
    const fixed = await modal.locator('.taxpay-modal__footer').boundingBox();
    return !!action && !!fixed && action.y + action.height <= fixed.y - 2;
  }, {timeout: 5000}).toBe(true);
  const groupedCorrectly = await add.evaluate(button => {
    const person = button.closest('[data-passenger-id]');
    const medical = person?.querySelector('.travel-flow__medical-option');
    if (!person || !medical || !person.querySelector('.travel-flow__confirm-row')) return false;
    const personRect = person.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const medicalRect = medical.getBoundingClientRect();
    return person.getAttribute('data-passenger-id') === 'first'
      && buttonRect.left >= personRect.left - 2
      && buttonRect.right <= personRect.right + 2
      && buttonRect.bottom <= personRect.bottom + 2
      && buttonRect.top >= medicalRect.bottom - 2;
  });
  expect(groupedCorrectly).toBe(true);
  await expect(modal.locator('.travel-flow__contact').getByRole('button', {name: 'Add passenger'})).toHaveCount(0);
  await add.click();
  await expect(add).toHaveCount(0);
  await expect(modal.getByRole('button',{name: 'Add another passenger'})).toBeVisible();
});

test('Travel Tax: passport Check button activates on entry and results overlay without moving the field',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const passport=modal.locator('#travel-passport-first');
  const check=modal.locator('#travel-lookup-first');
  await expect(check).toBeDisabled();
  // Measure the resting layout, not the initial passenger-card entrance
  // animation; focus should not add a second layout change.
  await modal.evaluate(async element => {
    await Promise.all(element.getAnimations({subtree:true})
      .filter(animation => animation.playState === 'running')
      .map(animation => animation.finished.catch(() => undefined)));
  });
  const row=modal.locator('.travel-flow__passport-row');
  const suggestions=modal.locator('#travel-passport-suggestions-first');
  await expect(suggestions).toHaveCount(0);
  const baseline=await row.boundingBox();
  const cardBaseline=await modal.locator('[data-passenger-id="first"]').boundingBox();
  const contactBaseline=await modal.locator('.travel-flow__contact').boundingBox();
  await passport.focus();
  await expect(suggestions.getByRole('option')).toHaveCount(10);
  await expect(suggestions.getByText('Sample passport numbers')).toBeVisible();
  const withPopup=await row.boundingBox();
  const withCard=await modal.locator('[data-passenger-id="first"]').boundingBox();
  const contactWithPopup=await modal.locator('.travel-flow__contact').boundingBox();
  expect(baseline).not.toBeNull();
  expect(withPopup).not.toBeNull();
  expect(cardBaseline).not.toBeNull();
  expect(withCard).not.toBeNull();
  expect(contactBaseline).not.toBeNull();
  expect(contactWithPopup).not.toBeNull();
  // Combobox popup floats above later fields; it cannot expand the form,
  // modal, or shift receipt contact when input focus opens it.
  expect(Math.abs(withPopup!.height - baseline!.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(withCard!.height - cardBaseline!.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(contactWithPopup!.y - contactBaseline!.y)).toBeLessThanOrEqual(2);
  expect(await suggestions.evaluate(el=>getComputedStyle(el).position)).toBe('absolute');
  expect(await suggestions.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  // Popup must receive hit testing ahead of the controls beneath it;
  // otherwise medical labels can appear through the floating list.
  expect(await suggestions.evaluate(el => {
    const box=el.getBoundingClientRect();
    const target=document.elementFromPoint(box.x+Math.min(16,box.width/2),box.y+Math.min(18,box.height/2));
    return !!target && el.contains(target);
  })).toBe(true);
  await passport.fill('TEST12');
  await expect(check).toBeEnabled();
  await passport.fill('');
  await expect(check).toBeDisabled();
  await suggestions.getByRole('option',{name:/TEST230005/}).click();
  await expect(check).toBeEnabled();
  await check.click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
});

test('Travel Tax: search result requires confirmation before adding another passenger', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name:'Travel tax'});
  const passport = modal.locator('#travel-passport-first');
  const add = modal.getByRole('button', {name:'Add passenger',exact:true});
  const another = modal.getByRole('button', {name:'Add another passenger'});
  await expect(add).toHaveCount(0);
  await expect(another).toHaveCount(0);
  await passport.fill('TEST123456');
  await expect(add).toHaveCount(0);
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(add).toBeVisible();
  await expect(another).toHaveCount(0);

  // The user can change the search without accidentally adding the prior result.
  await passport.fill('TEST230001');
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveCount(0);
  await expect(add).toHaveCount(0);
  await expect(another).toHaveCount(0);
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
  await expect(add).toBeVisible();
  await add.click();
  await expect(add).toHaveCount(0);
  await expect(another).toBeVisible();
  await another.click();
  await expect(another).toHaveCount(0);
  await expect(add).toHaveCount(0);
  await expect(modal.getByTestId('travel-passenger-list').locator('.travel-flow__person')).toHaveCount(2);
});

test('Travel Tax: medical row and receipt contact are full width with a divider',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const medical=modal.locator('.travel-flow__medical-option');
  const contact=modal.locator('.travel-flow__contact');
  const mobile=modal.locator('#travel-mobile');
  await expect(modal.locator('#travel-receipt-email')).toHaveCount(0);
  await expect(contact.locator('input')).toHaveCount(1);
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
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await mobile.fill('01712345678');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
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
  const confirm = modal.getByRole('button',{name:'Add passenger', exact:true});
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeEnabled();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toBeEnabled();
  await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
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
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.getByRole('button',{name:'Add another passenger'}).click();
  const people=modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second=people.nth(1);
  await second.getByRole('tab',{name:'Foreign passenger'}).click();
  await second.getByLabel('Passport number').fill('B7654321');
  await second.getByLabel('Passenger name as on passport').fill('FRIEND SECOND');
  await second.getByLabel('Date of birth').fill('2017-08-10');
  await second.getByLabel('Country of nationality').fill('India');
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
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
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
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
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await second.getByLabel('Passport number').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(second.locator('.travel-flow__inline-error')).toHaveCount(0);
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
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
  await modal.locator('#travel-medical-first').check();
  await modal.locator('#travel-mobile').fill('01712345678');
  const help = modal.getByRole('button',{name:'What is manual assessment?'});
  await help.click();
  await expect(modal.getByRole('tooltip')).toContainText('does not approve a tax exemption online');
  await expect(modal.getByRole('button',{name:'Add passenger'})).toBeDisabled();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await modal.locator('#travel-medical-first').uncheck();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
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
  // Step 1 now animates its height and newly revealed passenger details.
  // Compare sticky header/footer positions only after those animations finish;
  // keep the strict 1px position assertion (do not weaken the layout gate).
  await modal.evaluate(async element => {
    await Promise.all(element.getAnimations({subtree:true})
      .filter(animation=>animation.playState==='running')
      .map(animation=>animation.finished.catch(()=>undefined)));
  });
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
  await expect(date).toHaveValue(futureTravelDate);
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
  await modal.getByRole('button', {name: 'Add passenger', exact: true}).click();
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


test('Travel Tax: receipt Back returns to recorded review with all passengers and never closes modal', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.getByRole('button',{name:'Add another passenger'}).click();
  const second=modal.locator('.travel-flow__person').nth(1);
  await second.locator('input[role="combobox"]').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm preview payment'}).click();
  const combined=modal.getByTestId('travel-family-challan');
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('SAMPLE PASSENGER TWO');
  await expect(combined.locator('tfoot')).toContainText('2,000');
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await expect(modal).toBeVisible();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Review & payment');
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.getByRole('button',{name:'Confirm preview payment'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Edit travel details'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Edit passengers and receipt contact'})).toHaveCount(0);
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await expect(modal.getByTestId('travel-family-challan').locator('tbody tr')).toHaveCount(2);
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await modal.getByRole('button',{name:'View combined challan'}).click();
  await expect(modal.getByTestId('travel-family-challan').locator('tbody tr')).toHaveCount(2);
});

test('Travel Tax: medical assessment option survives passport check and passenger confirmation', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const option=modal.getByLabel('Request manual assessment at departure port');
  await expect(option).not.toBeChecked();
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(option).toBeVisible();
  await expect(option).not.toBeChecked();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(option).toBeVisible();
  await option.check();
  await expect(option).toBeChecked();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await option.uncheck();
  await expect(option).not.toBeChecked();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(option).toBeVisible();
});


test('Travel Tax: Bangla journey validates, edits and shows the shared receipt without clipping', async ({ page }) => {
  await page.goto('/?lang=bn');
  await openTravelTaxFromBanner(page);
  const modal = page.locator('.taxpay-modal:visible').first();
  const flow = modal.locator('.travel-flow');
  await expect(modal).toBeVisible();
  await expect(flow).toHaveAttribute('lang', 'bn');

  const assertContained = async () => {
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const bounds = await modal.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewportWidth + 1);
    const overflow = await modal.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  };

  await expect(modal.locator('.taxpay-modal__title')).toContainText('যাত্রী ও রসিদের তথ্য');
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await modal.getByRole('button', { name: 'যাত্রী যোগ করুন', exact: true }).click();
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button', { name: 'ভ্রমণের তথ্য দিতে এগিয়ে যান' }).click();
  await assertContained();

  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  await expect(modal.getByRole('alert')).toHaveText('যাত্রা শুরুর বন্দর নির্বাচন করুন।');
  await modal.locator('#travel-port').selectOption('Benapole');
  await modal.locator('#travel-destination').fill('India');
  await modal.locator('#travel-departure-date').fill(futureTravelDate);
  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  await assertContained();
  await expect(modal.locator('.travel-flow__passenger-table')).toContainText('মোট প্রদেয়');

  await modal.getByRole('button', { name: 'ফিরুন', exact: true }).click();
  await expect(flow).toHaveAttribute('data-step', '1');
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  await modal.getByRole('button', { name: 'অনলাইনে পরিশোধ', exact: true }).click();
  await modal.getByRole('button', { name: 'মোবাইল ব্যাংকিং', exact: true }).click();
  await modal.getByRole('radio', { name: 'Nagad', exact: true }).check();
  await modal.getByLabel('ভ্রমণের তথ্য, সকল যাত্রী এবং মোট টাকার পরিমাণ নিশ্চিত করছি।').check();
  await modal.getByRole('button', { name: 'নমুনা পেমেন্ট নিশ্চিত করুন' }).click();

  const receipt = modal.getByTestId('travel-family-challan');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('সর্বমোট ভ্রমণ কর');
  await expect(receipt).toContainText('যাত্রীভিত্তিক ভ্রমণ কর');
  await expect(receipt).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(receipt.locator('tbody tr')).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'ডাউনলোড', exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'রসিদ প্রিন্ট', exact: true })).toBeVisible();
  await assertContained();
});
