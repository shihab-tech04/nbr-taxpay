import { fillTravelDetails } from './travel-tax-test-helper';
import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('Travel Tax settled record shares modal and has only Download/Print without overlapping buttons', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog=page.getByRole('dialog',{name:'Travel tax'});
  await fillTravelDetails(dialog);
  await dialog.getByRole('button',{name:'Continue to review'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'Nagad'}).check();
  await dialog.getByLabel('I confirm the travel information, all passengers and the combined amount.').check();
  await dialog.getByRole('button',{name:'Confirm preview payment'}).click();
  const receipt=dialog.locator('.taxpay-modal__body > .receipt-view--embedded');
  await expect(receipt).toBeVisible({timeout:12000});
  await expect(receipt.getByRole('heading',{name:'Combined Travel Tax details'})).toBeVisible();
  await expect(receipt).toContainText('Not a government A-Challan or Treasury settlement.');
  await expect(dialog.locator('.travel-flow,.travel-flow__summary')).toHaveCount(0);
  await expect(dialog.locator('.taxpay-modal__footer .receipt-view__actions')).toHaveCount(1);
  const footer=dialog.locator('.taxpay-modal__footer');
  const download=footer.getByRole('button',{name:'Download'});
  const print=footer.getByRole('button',{name:'Print receipt'});
  await expect(footer.getByRole('button',{name:'New payment'})).toHaveCount(0);
  await expect(download).toBeVisible();
  await expect(print).toBeVisible();
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:375,height:812},{width:320,height:700}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{
      const [a,b]=await Promise.all([download.boundingBox(),print.boundingBox()]);
      if(!a||!b)return Number.POSITIVE_INFINITY;
      const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
      const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
      return x*y;
    },{timeout:5000}).toBeLessThanOrEqual(1);
    for(const button of [download,print]) {
      const box=await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1);
      expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height+1);
    }
  }
  await dialog.getByRole('button',{name:'Close modal'}).click();
  await expect(dialog).toHaveCount(0);
  await openTravelTaxFromBanner(page);
  await expect(page.getByRole('dialog',{name:'Travel tax'}).getByRole('button',{name:'Continue to travel details'})).toBeVisible();
});

test('Travel Tax progressive modal preserves passenger data and travel details through Back',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog=page.getByRole('dialog',{name:'Travel tax'});
  await expect(dialog).toHaveAttribute('data-payment-stage','true');
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(dialog.locator('.travel-flow__summary')).toBeHidden();
  await expect(dialog.locator('#travel-tax-route-results')).toHaveCount(0);
  await expect(dialog.locator('.payment-form-section').getByRole('heading',{name:'Passengers and receipt details'})).toHaveCount(0);
  await fillTravelDetails(dialog);
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Travel details');
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','2');
  await dialog.getByRole('button',{name:'Back'}).click();
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
  await expect(dialog.locator('#travel-mobile')).toHaveValue('01712345678');
  await expect(dialog.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE BANGLADESHI PASSENGER');
  await page.setViewportSize({width:375,height:812});
  await expect(dialog.locator('.travel-flow__summary')).toBeHidden();
  await expect(dialog.getByTestId('mobile-payment-calculation')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Continue to travel details'}).click();
  const footerSummary=dialog.getByTestId('mobile-payment-calculation');
  await expect(footerSummary).toBeVisible();
  await footerSummary.locator('summary').click();
  await expect(footerSummary.locator('dl')).toBeVisible();
  await expect(dialog.locator('#travel-port')).toHaveValue('Benapole');
  await dialog.getByRole('button',{name:'Continue to review'}).click();
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','3');
  await dialog.getByRole('button',{name:'Back'}).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Travel details');
  await expect(dialog.locator('#travel-port')).toHaveValue('Benapole');
});

test('Travel Tax desktop and mobile calculation retain one total and Taka amount in words',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog=page.getByRole('dialog',{name:'Travel tax'});
  const calculation=dialog.locator('.travel-flow__summary');
  await expect(calculation).toBeHidden();
  await fillTravelDetails(dialog,{mode:'WATER'});
  await expect(calculation).toBeVisible();
  await expect(dialog.locator('#travel-tax-route-1')).toBeChecked();
  await expect(calculation.getByTestId('travel-payment-total')).toContainText('1,000');
  const words=calculation.getByTestId('travel-total-in-words');
  await expect(words).toHaveText('One Thousand Taka only');
  const [amountBox,wordsBox]=await Promise.all([calculation.getByTestId('travel-payment-total').boundingBox(),words.boundingBox()]);
  expect(amountBox&&wordsBox).toBeTruthy();
  expect(wordsBox!.y).toBeGreaterThanOrEqual(amountBox!.y+amountBox!.height);
  await dialog.getByRole('button',{name:'Continue to review'}).click();
  await expect(words).toHaveText('One Thousand Taka only');
  await page.setViewportSize({width:375,height:812});
  await expect(calculation).toBeHidden();
  const summary=dialog.getByTestId('mobile-payment-calculation');
  await expect(summary).toBeVisible();
  await expect(summary.locator('summary')).toContainText('1,000');
  await summary.locator('summary').click();
  await expect(summary.getByTestId('travel-mobile-total-in-words')).toContainText('One Thousand Taka only');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});


test('Tax with Return and Travel Tax stages keep identical dialog width at matched viewports', async ({page}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const viewport of [
    {width: 1280, height: 800},
    {width: 900, height: 800},
    {width: 768, height: 800},
    {width: 650, height: 800},
    {width: 375, height: 812},
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', {name: 'Pay Tax', exact: true}).click();
    const payment = page.getByRole('dialog', {name: 'Pay Tax'});
    await enterTaxPayService(payment, 'TAX_WITH_RETURN');
    await expect(payment.locator('.taxpay-modal__title')).toHaveText('Taxpayer details');
    const paymentBounds = await payment.boundingBox();
    expect(paymentBounds).not.toBeNull();
    // Reset the route instead of assuming the staged payment's close button
    // retains the same accessible label as the entry modal.
    await page.goto('/');
    await openTravelTaxFromBanner(page);
    const travel = page.getByRole('dialog', {name: 'Travel tax'});
    await expect(travel.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
    const passengerBounds = await travel.boundingBox();
    expect(passengerBounds).not.toBeNull();
    expect(Math.abs(passengerBounds!.width - paymentBounds!.width)).toBeLessThanOrEqual(2);

    await fillTravelDetails(travel);
    await expect(travel.locator('.taxpay-modal__title')).toHaveText('Travel details');
    const routeBounds = await travel.boundingBox();
    expect(routeBounds).not.toBeNull();
    expect(Math.abs(routeBounds!.width - paymentBounds!.width)).toBeLessThanOrEqual(2);
    expect(routeBounds!.x).toBeGreaterThanOrEqual(-1);
    expect(routeBounds!.x + routeBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    // Width consistency must never hide the fixed footer or force page overflow.
    await expect(travel.getByRole('button',{name:'Continue to review'})).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )).toBeLessThanOrEqual(2);
  }
});
