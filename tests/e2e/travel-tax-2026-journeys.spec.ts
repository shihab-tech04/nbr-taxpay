import { openLegacyTaxServiceChoice } from './pay-tax-entry-helper';
import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, fillForeignPassenger, futureTravelDate } from './travel-tax-test-helper';

test('Pay Tax and Travel Tax keep the same modal width across passenger and travel stages', async ({page}, info) => {
  await page.goto('/');
  // Start an ordinary Tax with Return payment and measure its shared modal
  // after selecting the payer, service and walk-in access.
  await openLegacyTaxServiceChoice(page);
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
  await checkWidth('Passenger Information');
  await travel.locator('#travel-passport-first').fill('TEST123456');
  await travel.locator('#travel-lookup-first').click();
  await travel.getByRole('button',{name:'Add passenger',exact:true}).click();
  await travel.getByRole('button',{name:'Continue to travel details'}).click();
  await checkWidth('Travel Details');
  await travel.locator('#travel-port').selectOption('Benapole');
  await travel.locator('#travel-destination').fill('India');
  await travel.locator('#travel-departure-date').fill(futureTravelDate);
  await travel.getByRole('button',{name:'Continue to review'}).click();
  await checkWidth('Final Preview');
  if (info.project.name === 'desktop-1280' || info.project.name === 'mobile-375') {
    await page.screenshot({
      path: `test-results/screenshots/travel-width-parity-${info.project.name}.png`,
      fullPage:false
    });
  }
});

test('Travel Tax: Step 1 validates passengers; preview collects receipt contact', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name: 'Travel tax'});
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
  await expect(modal.locator('#travel-mobile')).toHaveCount(0);
  await expect(modal.locator('#travel-receipt-email')).toHaveCount(0);
  await expect(modal.locator('.travel-flow__summary')).toBeHidden();
  await expect(modal.getByRole('button',{name:'Back',exact:true})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toBeEnabled();
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.getByRole('button', {name:'Add passenger', exact:true}).click();
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(modal.locator('#travel-new-passport')).toBeVisible();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel Details');
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
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
  await expect(modal.locator('#travel-mobile')).toHaveValue('');
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
  const medicalBox = await passenger.locator('.travel-passenger-workspace__medical').boundingBox();
  const confirmBox = await add.boundingBox();
  expect(medicalBox).not.toBeNull();
  expect(confirmBox).not.toBeNull();
  // Confirmation spans the same content column as medical review, not
  // a small, distant button anchored to the right of a huge empty row.
  const identityCard = await passenger.locator('.travel-flow__identity-card').boundingBox();
  expect(identityCard).not.toBeNull();
  // The medical control belongs INSIDE the checked passenger's information card.
  expect(medicalBox!.x).toBeGreaterThanOrEqual(identityCard!.x - 2);
  expect(medicalBox!.x + medicalBox!.width).toBeLessThanOrEqual(identityCard!.x + identityCard!.width + 2);
  expect(confirmBox!.width).toBeGreaterThanOrEqual(120);
  expect(confirmBox!.width).toBeLessThanOrEqual((await passenger.boundingBox())!.width);
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
    const medical = person?.querySelector('.travel-passenger-workspace__medical');
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
  await expect(modal.locator('.travel-flow__contact')).toHaveCount(0);
  await add.click();
  await expect(add).toHaveCount(0);
  await expect(modal.locator('#travel-new-passport')).toBeVisible();
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
  await expect(modal.locator('.travel-passenger-workspace__medical')).toHaveCount(0);
  await passport.focus();
  await expect(suggestions.getByRole('option')).toHaveCount(10);
  await expect(suggestions.getByText('Sample passport numbers')).toBeVisible();
  const withPopup=await row.boundingBox();
  const withCard=await modal.locator('[data-passenger-id="first"]').boundingBox();
  expect(baseline).not.toBeNull();
  expect(withPopup).not.toBeNull();
  expect(cardBaseline).not.toBeNull();
  expect(withCard).not.toBeNull();
  // Passport suggestions must not shift or expand the empty lookup dialog.
  expect(Math.abs(withPopup!.height - baseline!.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(withCard!.height - cardBaseline!.height)).toBeLessThanOrEqual(2);
  expect(await suggestions.evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
  expect(await suggestions.evaluate(el=>el.matches(':popover-open'))).toBe(true);
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
  await expect(modal.locator('#travel-new-passport')).toBeVisible();
  await modal.locator('#travel-new-passport').focus();
  await expect(another).toHaveCount(0);
  await expect(add).toHaveCount(0);
  await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
  await expect(modal.locator('.travel-passenger-workspace__entry')).toHaveCount(1);
});

test('Travel Tax: medical review stays with passenger; receipt mobile moves to preview',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  const medical=modal.locator('.travel-passenger-workspace__medical');
  const passenger=modal.locator('[data-passenger-id="first"]');
  await expect(modal.locator('#travel-mobile')).toHaveCount(0);
  await expect(medical).toHaveCount(0);
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(medical).toBeVisible();
  const identityCard=passenger.locator('.travel-flow__identity-card');
  const [medicalBox,identityBox]=await Promise.all([medical.boundingBox(),identityCard.boundingBox()]);
  expect(medicalBox && identityBox).toBeTruthy();
  expect(medicalBox!.width).toBeGreaterThan(identityBox!.width * .7);
  await expect(identityCard.getByRole('button',{name:'Add passenger',exact:true})).toBeVisible();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('#travel-mobile')).toHaveCount(0);
  await modal.locator('#travel-port').selectOption('Benapole');
  await modal.locator('#travel-destination').fill('India');
  await modal.locator('#travel-departure-date').fill(futureTravelDate);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  const contact=modal.getByTestId('travel-preview-receipt-contact');
  const mobile=contact.locator('#travel-mobile');
  await expect(contact).toBeVisible();
  await expect(mobile).toHaveValue('');
  const [contactBox,mobileBox]=await Promise.all([contact.boundingBox(),mobile.boundingBox()]);
  expect(contactBox && mobileBox).toBeTruthy();
  expect(mobileBox!.width).toBeGreaterThan(contactBox!.width * .8);
  const payment=modal.getByRole('button',{name:'Make Payment'});
  await expect(payment).toBeVisible();
  await payment.click();
  await expect(modal.getByRole('alert')).toContainText('11-digit receipt mobile number');
  await mobile.fill('0171234');
  await expect(mobile).toHaveAttribute('aria-invalid','true');
  await expect(contact).toContainText('11-digit mobile number');
  await mobile.fill('01712345678');
  await expect(mobile).not.toHaveAttribute('aria-invalid','true');
  await payment.click();
  await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
  const confirm=modal.getByRole('button',{name:'Confirm sample payment'});
  await expect(confirm).toBeDisabled();
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await expect(confirm).toBeEnabled();
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
  await expect.poll(async()=>list.getAttribute('data-placement')).toMatch(/above|below/);
  const boundaries=await list.evaluate(el=>{
    const list=el.getBoundingClientRect();
    return {top:list.top,bottom:list.bottom,viewportHeight:window.innerHeight};
  });
  expect(boundaries.top).toBeGreaterThanOrEqual(0);
  expect(boundaries.bottom).toBeLessThanOrEqual(boundaries.viewportHeight + 1);
  expect(await list.evaluate(el=>el.matches(':popover-open'))).toBe(true);
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
  await expect(modal.locator('#travel-new-passport')).toBeVisible();
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
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
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
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
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
  await modal.locator('#travel-new-passport').focus();
  const people=modal.getByTestId('travel-passenger-list').locator('.travel-passenger-workspace__person, .travel-passenger-workspace__entry');
  const completePeople=modal.getByTestId('travel-passenger-list').locator('[data-passenger-id][data-complete="true"]');
  await expect(people).toHaveCount(2);
  const second=modal.locator('.travel-passenger-workspace__entry');
  await second.getByRole('tab',{name:'Foreign passenger'}).click();
  await second.getByLabel('Passport number').fill('B7654321');
  await second.getByLabel('Passenger name as on passport').fill('FRIEND SECOND');
  await second.getByLabel('Date of birth').fill('2017-08-10');
  await second.getByLabel('Country of nationality').fill('India');
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.locator('.travel-flow__passenger-table tfoot')).toContainText('1,500');
  if (await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).isVisible()) {
    const contact=modal.locator('#travel-mobile');
    if (await contact.isVisible() && !/^01\\d{9}$/.test(await contact.inputValue())) await contact.fill('01712345678');
    await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).click();
  }
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm sample payment'}).click();
  const combined=modal.getByTestId('travel-family-challan');
  await expect(combined).toBeVisible({timeout:12000});
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('This saved record is not proof of government A-Challan issuance or Treasury settlement.');
  await expect(modal.locator('.receipt-view__actions')).not.toContainText('New payment');
  await expect(modal.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Print receipt'})).toBeVisible();
});

test('Travel Tax: every passenger must be confirmed and Back preserves confirmations and amounts',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.locator('#travel-new-passport').focus();

  const people=modal.getByTestId('travel-passenger-list').locator('.travel-passenger-workspace__person, .travel-passenger-workspace__entry');
  const completePeople=modal.getByTestId('travel-passenger-list').locator('[data-passenger-id][data-complete="true"]');
  await expect(people).toHaveCount(2);
  const first=modal.locator('.travel-passenger-workspace__person'), second=modal.locator('.travel-passenger-workspace__entry');
  await second.getByLabel('Passport number').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();

  const continueButton=modal.getByRole('button',{name:'Continue to travel details'});
  await expect(first).toHaveAttribute('data-complete','true');
  await expect(second).toHaveAttribute('data-complete','false');
  await expect(continueButton).toBeDisabled();
  await expect(second.getByTestId('travel-passenger-name-'+(await second.getAttribute('data-passenger-id')))).toHaveText('SAMPLE PASSENGER TWO');

  await second.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(completePeople).toHaveCount(2);
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await expect(modal.getByRole('button',{name:'Edit passengers (2)'})).toBeVisible();

  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('2,000');
  await modal.getByRole('button',{name:'Edit passengers (2)'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(completePeople).toHaveCount(2);
  await expect(people.nth(0)).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(people.nth(1)).toContainText('SAMPLE PASSENGER TWO');
  await expect(continueButton).toBeEnabled();

  await continueButton.click();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await expect(modal.locator('#travel-destination')).toHaveValue('India');
  await expect(modal.locator('#travel-departure-date')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  const reviewed=modal.locator('.travel-flow__passenger-table');
  await expect(reviewed.locator('tbody tr')).toHaveCount(2);
  await expect(reviewed.locator('tfoot')).toContainText('2,000');
});

test('Travel Tax: duplicate passports cannot be confirmed or included in final total',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.locator('#travel-new-passport').focus();
  const second=modal.locator('.travel-passenger-workspace__entry');
  await second.getByLabel('Passport number').focus();
  const unusedSuggestions = second.locator('.travel-flow__passport-suggestions');
  await expect(unusedSuggestions.getByRole('option')).toHaveCount(9);
  await expect(unusedSuggestions.getByRole('option',{name:/TEST123456/})).toHaveCount(0);
  await second.getByLabel('Passport number').fill('TEST123456');
  await expect(second.getByText('Passport already added.',{exact:true})).toBeVisible();
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(modal.getByRole('alert')).toContainText('Passport already added.');
  await expect(modal.getByRole('button',{name:'Add passenger',exact:true})).toHaveCount(0);
  await expect(second.getByLabel('Passport number')).toHaveAttribute('aria-invalid','true');
  await expect(second.getByLabel('Passport number')).toBeFocused();
  await expect(second).toHaveAttribute('data-complete','false');
  await expect(second.locator('.travel-flow__inline-error')).toContainText('Passport already added.');
  await expect(modal.getByRole('button',{name:'Add another passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await second.getByLabel('Passport number').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await expect(second.locator('.travel-flow__inline-error')).toHaveCount(0);
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  const completePassengers=modal.getByTestId('travel-passenger-list').locator('[data-complete="true"]');
  await expect(completePassengers).toHaveCount(2);
  const summaries=modal.getByTestId('travel-passenger-list').locator('.travel-passenger-workspace__person');
  await expect(summaries).toHaveCount(2);
  const maskedPassports=await summaries.locator('small').allTextContents();
  expect(maskedPassports).toHaveLength(2);
  expect(maskedPassports[0]).not.toBe(maskedPassports[1]);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await expect(modal.getByRole('button',{name:'Edit passengers (2)'})).toBeVisible();
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  const reviewedTable=modal.locator('.travel-flow__passenger-table');
  await expect(reviewedTable.locator('tbody tr')).toHaveCount(2);
  await expect(reviewedTable).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(reviewedTable).toContainText('SAMPLE PASSENGER TWO');
});

test('Travel Tax: incomplete foreign passenger shows a field error and recovers without losing the first passenger',async({page})=>{
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  const passengerList=modal.getByTestId('travel-passenger-list');
  await modal.locator('#travel-new-passport').focus();
  const second=passengerList.locator('.travel-passenger-workspace__entry');
  await second.getByRole('tab',{name:'Foreign passenger'}).click();
  const passport=second.getByLabel('Passport number');
  const name=second.getByLabel('Passenger name as on passport');
  const birthDate=second.getByLabel('Date of birth');
  const country=second.getByLabel('Country of nationality');
  await passport.fill('FOREIGN123');
  await name.fill('SAMPLE FOREIGN TRAVELLER');
  await birthDate.fill('1992-05-10');
  await expect(second.getByRole('button',{name:'Add passenger',exact:true})).toBeEnabled();
  await second.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(country).toHaveAttribute('aria-invalid','true');
  await expect(country).toBeFocused();
  await expect(second.getByRole('alert')).toContainText('country of nationality');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await expect(passengerList.locator('[data-complete="true"]')).toHaveCount(1);
  await country.fill('India');
  await expect(country).not.toHaveAttribute('aria-invalid','true');
  await second.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(passengerList.locator('[data-complete="true"]')).toHaveCount(2);
  await expect(passengerList.locator('.travel-passenger-workspace__person').nth(0)).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(passengerList.locator('.travel-passenger-workspace__person').nth(1)).toContainText('SAMPLE FOREIGN TRAVELLER');
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
  const medicalPassenger=modal.locator('.travel-passenger-workspace__entry');
  await expect(medicalPassenger).toContainText('Manual medical assessment is required at the departure port.');
  const addPassenger=modal.getByRole('button',{name:'Add passenger',exact:true});
  await expect(addPassenger).toBeEnabled();
  await addPassenger.click();
  await expect(modal.locator('#travel-passenger-issue-first')).toContainText('medical exemption requires assessment at the departure port');
  await expect(medicalPassenger).toHaveAttribute('data-complete','false');
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
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
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
  // The revised Step 1 intentionally contains fewer controls, so a standard
  // 720px/800px viewport may not overflow. Exercise an actual shallow viewport
  // instead of incorrectly demanding a scrollbar when content fits. This still
  // checks strict 1px fixed-action stability during nonzero modal-body scrolling.
  const initialViewport = page.viewportSize();
  expect(initialViewport).not.toBeNull();
  await page.setViewportSize({width: initialViewport!.width, height: 430});
  // Step 1 now animates its height and newly revealed passenger details.
  // Compare fixed header/footer positions only after those animations finish;
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

  // Share the approved Taxpayer modal's true scroll owner: either the inner
  // payment area or the modal body, never the document behind the dialog.
  const mainIsScrollable = await main.evaluate(element =>
    element.scrollHeight > element.clientHeight &&
    ['auto','scroll'].includes(getComputedStyle(element).overflowY));
  const owner = mainIsScrollable ? main : body;
  const other = mainIsScrollable ? body : main;
  expect(await owner.evaluate(element => ['auto','scroll'].includes(getComputedStyle(element).overflowY))).toBe(true);
  expect(await other.evaluate(element => ['auto','scroll'].includes(getComputedStyle(element).overflowY)))
    .toBe(false);
  const scroll = await owner.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return {position: element.scrollTop, overflow: element.scrollHeight - element.clientHeight};
  });
  expect(scroll.overflow).toBeGreaterThan(0);
  expect(scroll.position).toBeGreaterThan(0);
  // Scrolling a long Step 1 must never create a second document scrollbar.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
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
  await modal.locator('#travel-new-passport').focus();
  const newPassenger = modal.locator('.travel-passenger-workspace__entry');
  await expect(newPassenger).toBeVisible();
  await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
  await expect(newPassenger.locator('.travel-flow__passport-row')).toBeVisible();
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
  await modal.locator('#travel-new-passport').focus();
  const second=modal.locator('.travel-passenger-workspace__entry');
  await second.locator('input[role="combobox"]').fill('TEST230001');
  await second.getByRole('button',{name:'Check Passport'}).click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await fillTravelDetails(modal);
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  if (await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).isVisible()) {
    const contact=modal.locator('#travel-mobile');
    if (await contact.isVisible() && !/^01\\d{9}$/.test(await contact.inputValue())) await contact.fill('01712345678');
    await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).click();
  }
  await modal.getByRole('button',{name:'Pay online'}).click();
  await modal.getByRole('button',{name:'Mobile banking'}).click();
  await modal.getByRole('radio',{name:'Nagad'}).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  await modal.getByRole('button',{name:'Confirm sample payment'}).click();
  const combined=modal.getByTestId('travel-family-challan');
  await expect(combined.locator('tbody tr')).toHaveCount(2);
  await expect(combined).toContainText('SAMPLE PASSENGER TWO');
  await expect(combined.locator('tfoot')).toContainText('2,000');
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await expect(modal).toBeVisible();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await expect(modal.getByRole('button',{name:'Confirm sample payment'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Edit travel details'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Edit passengers'})).toHaveCount(0);
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
  const option=modal.getByLabel('Request manual medical assessment at departure port');
  await expect(option).toHaveCount(0);
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(option).toBeVisible();
  await expect(option).not.toBeChecked();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(option).toHaveCount(0);
  await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
  await modal.locator('.travel-passenger-workspace__copy button').click();
  await expect(option).toBeVisible();
  await option.check();
  await expect(option).toBeChecked();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await option.uncheck();
  await expect(option).not.toBeChecked();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(option).toHaveCount(0);
  await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
});



for (const [language, project] of [['en', 'desktop-1280'], ['bn', 'mobile-375']] as const) {
  test('TT-01/02: Travel Tax zero-preview group completes without payment or challan ('+language+')', async ({page}, info) => {
    test.skip(info.project.name !== project, 'Represent desktop English and mobile Bengali');
    await page.goto(language === 'bn' ? '/?lang=bn' : '/');
    await openTravelTaxFromBanner(page);
    const modal = page.locator('.taxpay-modal:visible').first();
    const nextPassenger = language === 'bn' ? 'যাত্রী যোগ করুন' : 'Add passenger';
    const nextTravel = language === 'bn' ? 'ভ্রমণের তথ্য দিতে এগিয়ে যান' : 'Continue to travel details';
    const nextReview = language === 'bn' ? 'পেমেন্ট পর্যালোচনায় যান' : 'Continue to review';
    await modal.locator('#travel-passport-first').fill('TEST230006');
    await modal.locator('#travel-lookup-first').click();
    await modal.getByRole('button', {name:nextPassenger, exact:true}).click();
    await modal.getByRole('button', {name:nextTravel}).click();
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    await modal.locator('#travel-departure-date').fill(futureTravelDate);
    await modal.getByRole('button', {name:nextReview}).click();
    const total = modal.locator('.travel-flow__passenger-table tfoot .travel-currency');
    await expect(total).toBeVisible();
    await expect(total.locator('svg.travel-currency__mark')).toBeVisible();
    await expect(total).toContainText('৳');
    await expect(modal.getByTestId('travel-preview-receipt-contact')).toHaveCount(0);
    const finish = modal.getByTestId('travel-zero-tax-finish');
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(modal.getByTestId('travel-zero-tax-result')).toBeVisible();
    await expect(modal.getByTestId('travel-zero-tax-result')).toContainText(
      language === 'bn' ? 'কোনো পেমেন্ট করা হয়নি' : 'No payment was made');
    await expect(modal.locator('.receipt-view')).toHaveCount(0);
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    await expect(modal.getByTestId('travel-payment-channel-screen')).toHaveCount(0);
    await modal.screenshot({animations:'disabled'});
    await modal.getByRole('button', {name:language==='bn'?'ফিরুন':'Back',exact:true}).click();
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
    await modal.getByTestId('travel-zero-tax-finish').click();
    await modal.getByRole('button', {name:language==='bn'?'আরেকটি ভ্রমণ পর্যালোচনা শুরু করুন':'Start another travel review'}).click();
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
    await expect(modal.locator('#travel-passport-first')).toHaveValue('');
  });
}

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

  await expect(modal.locator('.taxpay-modal__title')).toContainText('যাত্রীর তথ্য');
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await modal.getByRole('button', { name: 'যাত্রী যোগ করুন', exact: true }).click();
  await modal.getByRole('button', { name: 'ভ্রমণের তথ্য দিতে এগিয়ে যান' }).click();
  await assertContained();

  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.getByRole('alert')).toHaveText('যাত্রা শুরুর বন্দর নির্বাচন করুন।');
  await modal.locator('#travel-port').selectOption('Benapole');
  await modal.locator('#travel-destination').fill('India');
  await modal.locator('#travel-departure-date').fill(futureTravelDate);
  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  await assertContained();
  await expect(modal.locator('.travel-flow__passenger-table')).toContainText('মোট প্রদেয়');

  await modal.getByRole('button', { name: 'ফিরুন', exact: true }).click();
  await expect(flow).toHaveAttribute('data-step', '1');
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await modal.getByRole('button', { name: 'পেমেন্ট পর্যালোচনায় যান' }).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  if (await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).isVisible()) {
    const contact=modal.locator('#travel-mobile');
    if (await contact.isVisible() && !/^01\\d{9}$/.test(await contact.inputValue())) await contact.fill('01712345678');
    await modal.getByRole('button',{name:/^(Make Payment|পেমেন্ট করুন)$/}).click();
  }
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


// F-150-C01 / US-147-T01–T04: verify the existing form, review and recovery
// against the local Dhaka calendar boundary without issuing a real payment.
test('F-150 US-147: Dhaka-midnight foreign DOB is accepted and a future DOB is rejected',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative date-validation boundary');
  // 20:00Z on Nov 14 is Nov 15 in Dhaka, but still Nov 14 in UTC.
  await page.clock.install({time:new Date('2026-11-14T20:00:00.000Z')});
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.getByRole('tab',{name:'Foreign passenger'}).click();
  await modal.locator('#travel-passport-first').fill('FOREIGN123');
  await modal.locator('#travel-name-first').fill('BABY VISITOR');
  await modal.locator('#travel-country-first').fill('India');
  await modal.locator('#travel-birth-date-first').fill('2026-11-16');
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(modal.locator('#travel-birth-date-first')).toHaveAttribute('aria-invalid','true');
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeDisabled();
  await modal.locator('#travel-birth-date-first').fill('2026-11-15');
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(modal.getByRole('button',{name:'Continue to travel details'})).toBeEnabled();
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await modal.locator('#travel-port').selectOption('Benapole');
  await modal.locator('#travel-destination').fill('India');
  await modal.locator('#travel-departure-date').fill('2026-11-16');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 0 on travel date');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('0');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.locator('.travel-flow__passenger-table')).toContainText('BABY VISITOR');
  await expect(modal.locator('.travel-flow__review')).toContainText('2026-11-16');
});

test('F-150 US-147: changing travel date reclassifies the same passenger and updates review amount',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Travel date EN desktop/mobile representative');
  await page.clock.install({time:new Date('2026-11-14T20:00:00.000Z')});
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillForeignPassenger(modal,{name:'AGE CHANGE VISITOR',birthDate:'2020-11-16',passport:'FOREIGN2020'});
  await fillTravelDetails(modal,{date:'2026-11-15'});
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 5 on travel date');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('0');
  await modal.locator('#travel-departure-date').fill('2026-11-16');
  await expect(modal.locator('.travel-flow__age-breakdown')).toContainText('Age 6 on travel date');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  const reviewed=modal.locator('.travel-flow__review');
  await expect(modal.locator('.travel-flow__passenger-table')).toContainText('AGE CHANGE VISITOR');
  await expect(reviewed).toContainText('2026-11-16');
  await expect(modal.locator('.travel-flow__passenger-table')).toContainText('500');
  await modal.getByRole('button',{name:'Back',exact:true}).click();
  await expect(modal.locator('#travel-departure-date')).toHaveValue('2026-11-16');
  await expect(modal.getByTestId('travel-payment-total')).toContainText('500');
});


test('F-153 / US-150 T01 T03: editing a confirmed passenger reprices review and cancellation restores the original',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'EN desktop/mobile representative');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.locator('#travel-new-passport').focus();
  const id=await modal.locator('.travel-passenger-workspace__entry').getAttribute('data-passenger-id');
  const child=modal.locator('[data-passenger-id="'+id+'"]');
  expect(id).toBeTruthy();
  await child.getByRole('tab',{name:'Foreign passenger'}).click();
  await child.getByLabel('Passport number').fill('TRAVELF153');
  await child.getByLabel('Passenger name as on passport').fill('FOREIGN CHILD');
  await child.getByLabel('Date of birth').fill('2017-08-10');
  await child.getByLabel('Country of nationality').fill('India');
  await child.getByRole('button',{name:'Add passenger',exact:true}).click();
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,500');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
  await modal.getByRole('button',{name:'Edit passengers'}).click();
  await child.locator('.travel-passenger-workspace__copy button').click();
  await expect(child).toHaveAttribute('data-complete','false');
  await child.getByLabel('Date of birth').fill('2012-08-10');
  await child.getByLabel('Passenger name as on passport').fill('EDITED FOREIGN ADULT');
  await child.getByRole('button',{name:'Cancel edit'}).click();
  await expect(child).toHaveAttribute('data-complete','true');
  await expect(child).toContainText('FOREIGN CHILD');
  await child.locator('.travel-passenger-workspace__copy button').click();
  await expect(child.getByLabel('Date of birth')).toHaveValue('2017-08-10');
  await child.getByRole('button',{name:'Cancel edit'}).click();
  await expect(child).not.toContainText('EDITED FOREIGN ADULT');
  await child.locator('.travel-passenger-workspace__copy button').click();
  await child.getByLabel('Date of birth').fill('2012-08-10');
  await child.getByLabel('Passenger name as on passport').fill('EDITED FOREIGN ADULT');
  await child.getByRole('button',{name:'Add passenger',exact:true}).click();
  await expect(child).toHaveAttribute('data-complete','true');
  expect(await child.getAttribute('data-passenger-id')).toBe(id);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.getByTestId('travel-payment-total')).toContainText('2,000');
  await modal.getByRole('button',{name:'Continue to review'}).click();
  if (await modal.locator('#travel-mobile').isVisible() && !(await modal.locator('#travel-mobile').inputValue())) await modal.locator('#travel-mobile').fill('01712345678');
  const table=modal.locator('.travel-flow__passenger-table');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table).toContainText('EDITED FOREIGN ADULT');
  await expect(table).not.toContainText('FOREIGN CHILD');
  await expect(table.locator('tfoot')).toContainText('2,000');
});

test('F-153 / US-150: remove from passenger rail, cancel an unfinished entry, and reprice without undo',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'EN desktop/mobile representative');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
  await modal.locator('#travel-new-passport').focus();
  const second=modal.locator('.travel-passenger-workspace__entry');
  const secondId=await second.getAttribute('data-passenger-id');
  expect(secondId).toBeTruthy();
  await second.locator('#travel-passport-'+secondId).fill('TEST230001');
  await second.locator('#travel-lookup-'+secondId).click();
  await second.getByRole('button',{name:'Add passenger',exact:true}).click();
  const members=modal.locator('.travel-passenger-workspace__person');
  await expect(members).toHaveCount(2);
  await expect(modal.getByRole('button',{name:'Remove passenger'})).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Undo removal'})).toHaveCount(0);
  await members.nth(1).locator('.travel-passenger-workspace__remove').click();
  await expect(members).toHaveCount(1);
  await expect(modal.getByText('Passenger removed.')).toHaveCount(0);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await fillTravelDetails(modal);
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,000');
  await modal.getByRole('button',{name:'Edit passengers (1)'}).click();
  await modal.locator('#travel-new-passport').focus();
  const entry=modal.locator('.travel-passenger-workspace__entry');
  await expect(modal.locator('.travel-passenger-workspace__editor').getByRole('button',{name:'Cancel adding'})).toBeVisible();
  await modal.locator('.travel-passenger-workspace__editor').getByRole('button',{name:'Cancel adding'}).click();
  await expect(entry).toHaveCount(0);
  await expect(members).toHaveCount(1);
  await expect(modal.getByRole('button',{name:'Undo removal'})).toHaveCount(0);
  await modal.getByRole('button',{name:'Continue to travel details'}).click();
  await expect(modal.getByTestId('travel-payment-total')).toContainText('1,000');
});


// F-159-C01 / US-156-T01–T03: a complete final review and explicit re-approval
// after editing any material field. Uses existing simulated journey only.
for (const [language,project] of [['en','desktop-1280'],['bn','mobile-375']] as const) {
  test('F-159 US-156 complete review and changed-details confirmation recovery ('+language+')',async({page},info)=>{
    test.skip(info.project.name!==project,'Representative EN desktop / BN mobile.');
    await page.goto(language==='bn'?'/?lang=bn':'/');
    await openTravelTaxFromBanner(page);
    const modal=page.locator('.taxpay-modal:visible').first();
    const nextReview=language==='bn'?'পেমেন্ট পর্যালোচনায় যান':'Continue to review';
    const pay=language==='bn'?'পেমেন্ট করুন':'Make Payment';
    const confirmLabel=language==='bn'?'নমুনা পেমেন্ট নিশ্চিত করুন':'Confirm sample payment';
    await fillTravelDetails(modal);
    await modal.getByRole('button',{name:nextReview}).click();
    await modal.locator('#travel-mobile').fill('01712345678');
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
    await expect(modal.locator('.travel-flow__review')).toContainText('India');
    await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
    await modal.getByRole('button',{name:pay}).click();
    await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
    const confirm=modal.getByRole('button',{name:confirmLabel});
    await expect(confirm).toBeDisabled();
    await modal.getByRole('button',{name:language==='bn'?'অনলাইনে পরিশোধ':'Pay online'}).click();
    await modal.getByRole('button',{name:language==='bn'?'মোবাইল ব্যাংকিং':'Mobile banking'}).click();
    await modal.getByRole('radio',{name:'Nagad'}).check();
    const acknowledge=modal.getByLabel(language==='bn'
      ?'ভ্রমণের তথ্য, সকল যাত্রী এবং মোট টাকার পরিমাণ নিশ্চিত করছি।'
      :'I confirm the travel information, all passengers and the combined amount.');
    await expect(confirm).toBeDisabled();
    await acknowledge.check();
    await expect(confirm).toBeEnabled();
    // Returning from checkout and editing travel details must reset confirmation.
    await modal.getByRole('button',{name:language==='bn'?'ফিরুন':'Back',exact:true}).click();
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
    await modal.getByRole('button',{name:language==='bn'?'ভ্রমণের তথ্য সম্পাদনা':'Edit travel details'}).click();
    await modal.locator('#travel-destination').fill('Nepal');
    await modal.getByRole('button',{name:nextReview}).click();
    await expect(modal.locator('.travel-flow__review')).toContainText('Nepal');
    await modal.getByRole('button',{name:pay}).click();
    await expect(acknowledge).not.toBeChecked();
    await expect(confirm).toBeDisabled();
    await acknowledge.check();
    await expect(confirm).toBeEnabled();
    // Changing receipt mobile in Final Preview also requires new approval.
    await modal.getByRole('button',{name:language==='bn'?'ফিরুন':'Back',exact:true}).click();
    await modal.locator('#travel-mobile').fill('01712340000');
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712340000');
    await expect(modal.locator('.travel-flow__passenger-table tfoot'))
      .toContainText(language==='bn'?'১,০০০':'1,000');
    await modal.getByRole('button',{name:pay}).click();
    await expect(acknowledge).not.toBeChecked();
    await expect(confirm).toBeDisabled();
    await acknowledge.check();
    await expect(confirm).toBeEnabled();
  });
}

// Contract: outside-click dismissal must not swallow real Travel Tax step clicks.
test('Travel Tax passport suggestions recover on keyboard Escape and outside pointer or Tab', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  const passport = modal.locator('#travel-passport-first');
  const list = modal.locator('#travel-passport-suggestions-first');
  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  await passport.press('ArrowDown');
  await expect(list.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(list.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(passport).toBeFocused();
  await expect(modal).toBeVisible(); // Escape never closes the payment dialog.

  // Focusing elsewhere dismisses an open picker without changing identity.
  await modal.getByRole('tab', { name: 'Bangladeshi passenger' }).focus();
  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  await modal.locator('.travel-passenger-workspace__editor h2').click();
  await expect(list).toHaveCount(0);
  await expect(passport).toHaveValue('');

  await passport.focus();
  await expect(list.getByRole('option')).toHaveCount(10);
  // The disabled Check Passport control is skipped: Tab enters the sample
  // options, where the list must remain open. Dismiss only after focus
  // actually leaves the full picker, not when it moves between its controls.
  await passport.press('Tab');
  await expect(list).toHaveCount(1);
  await list.getByRole('option').last().focus();
  await page.keyboard.press('Tab');
  await expect(list).toHaveCount(0);
});

test('Travel Tax: draft route selections survive Land/Water switch without stale cross-mode use', async ({page}) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(modal);
  await expect(modal.locator('#travel-port')).toBeVisible();
  await modal.locator('#travel-port').selectOption('Benapole');
  await modal.locator('#travel-tax-route-1').check();
  const waterPort=modal.locator('#travel-water-port');
  await expect(waterPort).toBeVisible();
  await waterPort.fill('Mongla');
  await modal.locator('#travel-tax-route-0').check();
  await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
  await expect(modal.locator('#travel-water-port')).toHaveCount(0);
  await modal.locator('#travel-tax-route-1').check();
  await expect(modal.locator('#travel-water-port')).toHaveValue('Mongla');
  await expect(modal.locator('#travel-port')).toHaveCount(0);
});

// Regression against the original downloadable UI: the sample picker must float
// over the passenger form, NOT expand the modal or shift its sticky CTA.
// The full passenger details card after Check Passport is intentionally inline.
test('Travel Tax preview: stale notices absent and suggestions do not reflow modal at 320/375/1280', async ({page}) => {
  for(const width of [320, 375, 1280]) {
    await page.setViewportSize({width,height:width===1280?900:800});
    await page.goto('/travel-tax-ui-preview.html');
    await expect(page.locator('body')).not.toContainText('Passport search uses labelled sample data');
    await expect(page.locator('body')).not.toContainText('Age-based sample rates are illustrative');
    const next = page.locator('.footer button[data-action="next"]');
    await expect(next).toBeDisabled();
    await expect(next).toHaveCSS('background-color','rgb(228, 234, 242)');
    // Compare layout coordinates, not viewport coordinates: mobile focusing may scroll.
    const footerDocumentTop=() => page.locator('.footer').evaluate(
      el => el.getBoundingClientRect().top + window.scrollY
    );
    const before=await footerDocumentTop();
    await page.locator('#bdPassport').fill('1');
    const suggestions=page.locator('.passport-lookup-region .suggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions).toHaveCSS('position','absolute');
    const after=await footerDocumentTop();
    expect(Math.abs(after-before)).toBeLessThanOrEqual(2);
    await expect(next).toBeDisabled();
    await page.locator('#bdPassport').fill('TEST123456');
    await page.locator('[data-action="check"]').click();
    await expect(next).toBeDisabled();
    await expect(page.locator('.info-card')).toBeVisible();
    await page.locator('[data-action="add"]').click();
    await expect(next).toBeEnabled();
  }
});

// Regression: the standalone approved Walk-in preview must not look actionable
// before any passenger has been added, even if the button is HTML-disabled.
test('Travel Tax preview: primary action is visibly disabled until a passenger is added', async ({page}) => {
  await page.goto('/travel-tax-ui-preview.html');
  const continueButton=page.locator('.footer button[data-action="next"]');
  await expect(continueButton).toBeVisible();
  await expect(continueButton).toBeDisabled();
  await expect(continueButton).toHaveCSS('background-color','rgb(228, 234, 242)');
  await expect(continueButton).toHaveCSS('color','rgb(112, 131, 158)');
  await page.locator('#bdPassport').fill('TEST123456');
  await expect(continueButton).toBeDisabled();
  await page.locator('[data-action="check"]').click();
  await expect(continueButton).toBeDisabled();
  await page.locator('[data-action="add"]').click();
  await expect(continueButton).toBeEnabled();
  await expect(continueButton).toHaveCSS('background-color','rgb(43, 93, 170)');
});


test('signed-out Travel Tax X uses the same reusable Walk-in discard confirmation', async ({page}) => {
  await page.goto('/?action=landing&lang=en');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', {name:'Travel tax'});
  const passport = modal.locator('#travel-passport-first');
  await passport.fill('TEST123456');
  await modal.locator('.taxpay-modal__close').click();
  const exit = modal.getByTestId('walkin-payment-exit-overlay');
  await expect(exit.getByRole('alertdialog', {name:'Discard tax payment?'})).toBeVisible();
  await expect(exit.locator('button')).toHaveCount(2);
  await expect(exit.getByRole('button', {name:'Save Draft'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(exit).toHaveCount(0);
  await expect(passport).toHaveValue('TEST123456');
  await modal.locator('.taxpay-modal__close').click();
  await exit.getByRole('button',{name:'Discard tax payment'}).click();
  await expect(modal).toHaveCount(0);
});

test('Walk-in Travel Tax: short desktop dropdown is hit-testable and has no draft controls', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Explicit landscape viewport coverage');
  test.setTimeout(90000);
  for (const [width,height] of [[1280,520],[1366,568],[1920,800]]) {
    await page.setViewportSize({width,height});
    await page.goto('/?action=landing&lang=en');
    await openTravelTaxFromBanner(page);
    const modal=page.getByRole('dialog',{name:'Travel tax'});
    await expect(modal.getByRole('button',{name:'Save Draft',exact:true})).toHaveCount(0);
    await expect(modal.getByRole('button',{name:'Continue Draft',exact:true})).toHaveCount(0);
    const input=modal.locator('#travel-passport-first');
    const list=modal.locator('#travel-passport-suggestions-first');
    await modal.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.finished.catch(()=>undefined)));});
    const geometry=()=>modal.evaluate(el=>[el,el.querySelector('.taxpay-modal__footer'),el.querySelector('#travel-passport-first'),el.querySelector('.travel-passenger-workspace__rail')].map(node=>{const r=node!.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
    const baseline=await geometry();
    await input.click();
    await expect(list.getByRole('option')).toHaveCount(10);
    await expect.poll(()=>list.evaluate(el=>{
      const b=el.getBoundingClientRect();
      const first=el.querySelector('[role="option"]')?.getBoundingClientRect();
      if(!first||b.height<90||b.bottom>window.innerHeight+1||b.top<0||!el.matches(':popover-open'))return false;
      const hit=document.elementFromPoint(first.x+12,first.y+first.height/2);
      return Boolean(hit?.closest('[role="option"]')&&el.contains(hit));
    })).toBe(true);
    // The modal, footer, field and passenger rail must retain their exact
    // closed-state dimensions and positions while the list is open.
    const unchanged=async()=> (await geometry()).every((r,i)=>r.every((v,j)=>Math.abs(v-baseline[i][j])<=1));
    await expect.poll(unchanged).toBe(true);
    await page.waitForTimeout(350);
    expect(await unchanged()).toBe(true);
    await input.press('Escape');
    await expect(list).toHaveCount(0);
    expect(await unchanged()).toBe(true);
    await input.click();
    await expect(list.getByRole('option')).toHaveCount(10);
    await list.getByRole('option',{name:/TEST230005/}).click();
    await modal.getByRole('button',{name:'Check Passport'}).click();
    await modal.getByRole('button',{name:'Add passenger',exact:true}).click();
    await modal.getByRole('button',{name:'Continue to travel details'}).click();
    await expect(modal.getByRole('button',{name:'Save Draft',exact:true})).toHaveCount(0);
    await expect(modal.getByRole('button',{name:'Undo removal',exact:true})).toHaveCount(0);
    await expect(modal.getByRole('button',{name:'Remove passenger',exact:true})).toHaveCount(0);
  }
});
