import { expect, test, type Page } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

async function openOtherTax(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  return dialog;
}

test('one combined receipt covers multiple TINs, survives response loss, and retries one SQL record', async ({ page }) => {
  const saved=new Map<string,{id:string;input:Record<string,any>}>();
  const calls:Record<string,any>[]=[];
  let loseFirstResponse=true;
  await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
    const input=route.request().postDataJSON() as Record<string,any>;
    calls.push(input);
    let record=saved.get(input.idempotencyKey);
    if(!record){
      record={id:'00000000-0000-4000-8000-000000000201',input};
      saved.set(input.idempotencyKey,record);
    }
    if(loseFirstResponse){
      loseFirstResponse=false;
      await route.fulfill({status:503,contentType:'application/json',
        body:JSON.stringify({success:false,error:'OFFICE_SYNC_PENDING'})});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,id:record.id,status:'SIMULATED_SUCCESS',
        mirrored:true,simulationOnly:true})});
  });
  let dialog=await openOtherTax(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button',{name:/^Search(?: TIN)?$/}).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Add another taxpayer'}).click();
  const next=dialog.getByTestId('other-tax-taxpayer');
  await next.locator('input[id^="other-tax-tin"]').fill('222222222222');
  await next.getByRole('button',{name:'Search',exact:true}).click();
  await next.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  const heads=dialog.getByTestId('other-tax-batch');
  await heads.locator('[data-head-group="Advance Tax"] summary').click();
  await heads.getByRole('checkbox',{name:/Select 68A/}).check();
  await heads.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
  await heads.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await heads.getByRole('checkbox',{name:/Select 68B/}).check();
  await heads.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
  await heads.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'bKash'}).check();
  await dialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
  await dialog.getByRole('button',{name:/Pay ৳ 50/}).click();
  await expect(dialog.getByRole('heading',{name:'Simulation confirmation pending'})).toBeVisible({timeout:15000});
  expect(saved.size).toBe(1);
  expect(calls).toHaveLength(1);
  dialog=await openOtherTax(page);
  await expect(dialog.getByRole('heading',{name:'Simulation confirmation pending'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Back',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Retry Office synchronization'}).click();
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  expect(saved.size).toBe(1);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[0].amountMinor).toBe(5000);
  expect(calls[0].details.combinedPayment).toBe(true);
  expect(calls[0].details.allocations).toHaveLength(2);
  expect(calls[0].details.allocations.map((v:{taxpayerTin:string;assessmentYear:string;amountMinor:number})=>
    [v.taxpayerTin,v.assessmentYear,v.amountMinor])).toEqual([
      ['111111111111','2026-27',1500],['222222222222','2025-26',3500]]);
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Receipt details'}).click();
  const receipt=dialog.locator('.receipt-view__paper');
  await expect(receipt).toContainText('111111111111');
  await expect(receipt).toContainText('222222222222');
  await expect(receipt).toContainText('2025-26');
  await expect(receipt).toContainText('৳ 50');
  await dialog.getByRole('button',{name:'View payment certificate'}).click();
  await expect(receipt.getByRole('heading',{name:'Payment Certificate'})).toBeVisible();
  await expect(receipt.getByTestId('payment-certificate-reference'))
    .toContainText('SK-PC-00000000-0000-4000-8000-000000000201');
  await expect(receipt).toContainText('111111111111');
  await expect(receipt).toContainText('222222222222');
  await expect(receipt).toContainText('2025-26');
  await expect(receipt).toContainText('৳ 50');
  await dialog.getByRole('button',{name:'View receipt'}).click();
  await expect(receipt.getByTestId('payment-certificate-reference')).toHaveCount(0);
  await expect(dialog.locator('.receipt-view__actions')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Back',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Back to confirmation'}).click();
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible();
  await dialog.getByRole('button',{name:'Receipt details'}).click();
  await expect(dialog.locator('.receipt-view__paper')).toContainText('222222222222');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('a bank-branch request remains pending across reload until continued', async ({ page }) => {
  const calls: Record<string, any>[] = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: '00000000-0000-4000-8000-000000000301', status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  let dialog = await openOtherTax(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button', { name: 'Add taxpayer' }).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('25');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await dialog.getByRole('button', { name: 'Get payment slip' }).click();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  expect(calls).toHaveLength(0);

  dialog = await openOtherTax(page);
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  expect(calls).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Continue bank payment' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  expect(calls).toHaveLength(1);
  expect(calls[0].amountMinor).toBe(2500);
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(0);
  expect(calls[0].details.combinedPayment).toBe(true);
  expect(calls[0].details.allocations).toHaveLength(1);
  await dialog.getByRole('button',{name:'Receipt details'}).click();
  await expect(dialog.locator('.receipt-view__paper')).toContainText('৳ 25');
});

test('source-tax and demand heads combine across beneficiaries into one exact receipt', async ({ page }) => {
  const submitted: Record<string, any>[]=[];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    const request=route.request().postDataJSON() as Record<string,any>;
    submitted.push(request);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      success:true,id:'00000000-0000-4000-8000-000000000402',
      status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true
    })});
  });
  const dialog=await openOtherTax(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button',{name:/^Search(?: TIN)?$/}).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Add another taxpayer'}).click();
  const second=dialog.getByTestId('other-tax-taxpayer');
  await second.locator('input[id^="other-tax-tin"]').fill('222222222222');
  await second.getByRole('button',{name:'Search',exact:true}).click();
  await second.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  const composer=dialog.getByTestId('other-tax-batch');
  await composer.locator('[data-head-group="Source Tax"] summary').click();
  await composer.getByRole('checkbox',{name:/Select 50 — Deduction from Salary/}).check();
  await composer.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('12');
  await composer.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await composer.locator('[data-head-group="Tax against Demand"] summary').click();
  await composer.getByRole('checkbox',{name:/Select 135 — Tax on notice of demand/}).check();
  await composer.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
  await composer.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('18');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('30');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'bKash'}).check();
  await dialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
  await dialog.getByRole('button',{name:/Pay ৳ 30/}).click();
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  expect(submitted).toHaveLength(1);
  expect(submitted[0].service).toBe('OTHER_TAX_PAYMENT');
  expect(submitted[0].amountMinor).toBe(3000);
  expect(submitted[0].details.lines.map((x:{headId:number})=>x.headId)).toEqual([8,145]);
  expect(submitted[0].details.lines.map((x:{serviceCode:string;isWithholding:boolean})=>
    [x.serviceCode,x.isWithholding])).toEqual([['SOURCE_TAX_DEPOSIT',true],['ASSESSED_DEMAND',false]]);
  expect(submitted[0].details.allocationContractVersion).toBe(3);
  const allocationIds = submitted[0].details.allocations.map((item:{allocationId:string})=>item.allocationId);
  expect(allocationIds).toHaveLength(2);
  expect(allocationIds.every((id:string)=>typeof id==='string'&&id.trim().length>0)).toBe(true);
  expect(new Set(allocationIds).size).toBe(2);
  expect(submitted[0].details.receiptSnapshot.allocationItems.map((item:{allocationId:string})=>item.allocationId))
    .toEqual(allocationIds);
  expect(submitted[0].details.allocations.reduce((sum:number,item:{amountMinor:number})=>sum+item.amountMinor,0))
    .toBe(submitted[0].amountMinor);
  expect(submitted[0].details.allocations.map((x:{serviceCode:string;isWithholding:boolean})=>
    [x.serviceCode,x.isWithholding])).toEqual([['SOURCE_TAX_DEPOSIT',true],['ASSESSED_DEMAND',false]]);
  expect(submitted[0].details.allocations.map((x:{taxpayerTin:string;assessmentYear:string})=>[x.taxpayerTin,x.assessmentYear]))
    .toEqual([['111111111111','2026-27'],['222222222222','2025-26']]);
  await dialog.getByRole('button',{name:'Receipt details'}).click();
  const receipt=dialog.locator('.receipt-view__paper');
  await expect(receipt).toContainText('Deduction from Salary');
  await expect(receipt).toContainText('Tax on notice of demand');
  await expect(receipt).toContainText('৳ 30');
});
