import { test, expect } from '@playwright/test';

const id='fd718297-1e32-421c-a951-987f4e92a991';
const record={
 id,service:'PENALTY',status:'SIMULATED_SUCCESS',amountMinor:260000,
 createdAt:'2026-10-18T08:00:00.000Z',
 details:{payerName:'Md. Arif Rahman',taxpayerTin:'1111111111111',
 assessmentYear:'2026-27',receiptReference:'ACS-DEMO-123',
 paymentMethod:'BKASH',taxZone:'Taxes Zone 1',taxCircle:'circle-1',
 lines:[{headId:120,economicCode:'120',headNameEn:'Penalty',
 taxAmount:0,penaltyAmount:2600,surchargeAmount:0,interestAmount:0,totalAmount:2600}]}
};
test.beforeEach(async ({page})=>{
 await page.route('**/functions/v1/demo-story1-office/payments*',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({success:true,data:{items:[record],total:1,page:1,perPage:100}})
 }));
});
test('transaction-linked certificate uses the real TaxPay ReceiptView document',async({page})=>{
 await page.goto('/?action=payment_details&transactionId='+id);
 await expect(page.locator('.receipt-view__paper')).toBeVisible();
 await expect(page.locator('.receipt-view__paper')).toContainText('Md. Arif Rahman');
 await expect(page.locator('.receipt-view__paper')).toContainText('Penalty Payment');
 await expect(page.locator('.receipt-view__paper')).toContainText('ACS-DEMO-123');
 await expect(page.locator('.receipt-view__paper')).toContainText('2600');
 await expect(page.locator('.receipt-view__paper')).toContainText(id);
 await expect(page.locator('.receipt-view__paper')).toContainText('PENDING RECONCILIATION');
});
test('Admin Download opens same TaxPay document as an HTML certificate',async({page})=>{
 const download=page.waitForEvent('download',{timeout:20000});
 await page.goto('/?action=payment_details&transactionId='+id+'&docAction=download');
 const result=await download;
 expect(result.suggestedFilename()).toBe('Payment-certificate-'+id+'.html');
 await expect(page.locator('.receipt-view__paper')).toBeVisible();
});
test('a nonmatching payment never falls back to locally generated sample receipt',async({page})=>{
 await page.route('**/functions/v1/demo-story1-office/payments*',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({success:true,data:{items:[],total:0,page:1,perPage:100}})
 }));
 await page.goto('/?action=payment_details&transactionId='+id);
 await expect(page.getByRole('alert')).toContainText('No synchronized payment record');
 await expect(page.locator('.receipt-view__paper')).toHaveCount(0);
});
