import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails, futureTravelDate } from './travel-tax-test-helper';
import { setWorkspaceLanguage } from './workspace-language';

const paymentId = '2bd0a21e-4a7c-4c89-9664-0ae1f7f336a8';
const fixtureOrigin = 'https://travel-certificate-fixture.invalid';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': '*',
};

for (const language of ['en', 'bn'] as const) {
  test('Travel Tax receipt opens a separate, itemized ' + language.toUpperCase() + ' payment certificate and PDF', async ({ page }) => {
    let submitted: Record<string, unknown> | null = null;
    let submissionCount = 0;
    const totalText = language === 'bn' ? '১,৫০০' : '1,500';
    // Match both the list and /payments/<original UUID> detail. A Playwright
    // glob '*' does not span '/', so the old fixture intercepted only the list.
    await page.route(/\/functions\/v1\/demo-story1-taxpay\/payments(?:\/[^?]+)?(?:\?.*)?$/, async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if(request.method()==='GET'){
        const url=new URL(request.url());
        const stored=submitted as {sessionId?:string;service?:string;amountMinor?:number;details?:Record<string,unknown>}|null;
        if(!stored||url.searchParams.get('sessionId')!==stored.sessionId){
          await route.fulfill({status:403,contentType:'application/json',headers:corsHeaders,
            body:JSON.stringify({success:false,error:'SESSION_NOT_AUTHORIZED'})});
          return;
        }
        const createdAt='2026-11-14T08:00:00.000Z';
        const source={id:paymentId,service:stored.service,amountMinor:stored.amountMinor,
          status:'SIMULATED_SUCCESS',createdAt};
        const detail=url.pathname.endsWith('/'+paymentId);
        await route.fulfill({status:200,contentType:'application/json',headers:corsHeaders,
          body:JSON.stringify(detail
            ?{success:true,simulationOnly:true,data:{id:paymentId,status:'SIMULATED_SUCCESS',
                createdAt,data:{service:stored.service,amountMinor:stored.amountMinor,details:stored.details}}}
            :{success:true,simulationOnly:true,data:{items:[source],total:1}})});
        return;
      }
      if (request.method() !== 'POST') {
        await route.fulfill({ status: 405, headers: corsHeaders });
        return;
      }
      submitted = request.postDataJSON() as Record<string, unknown>;
      submissionCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          success: true, id: paymentId, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
        }),
      });
    });

    await page.goto('/');
    if (language === 'bn') await setWorkspaceLanguage(page, language);
    await openTravelTaxFromBanner(page);
    const modal = page.getByRole('dialog', { name: /Travel tax|ভ্রমণ কর/ });
    await modal.locator('#travel-passport-first').fill('TEST123456');
    await modal.locator('#travel-lookup-first').click();
    await modal.getByRole('button', { name: /^(Add passenger|যাত্রী যোগ করুন)$/ }).click();
    await modal.getByRole('button', { name: /Add another passenger|আরেকজন যাত্রী/ }).click();
    const people = modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
    await expect(people).toHaveCount(2);
    const second = people.nth(1);
    await second.getByRole('tab', { name: /Foreign passenger|বিদেশি যাত্রী/ }).click();
    await second.locator('input[id^="travel-passport-"]').fill('B7654321');
    await second.locator('input[id^="travel-name-"]').fill('FRIEND SECOND');
    await second.locator('input[id^="travel-birth-date-"]').fill('2017-08-10');
    await second.locator('input[id^="travel-country-"]').fill('India');
    await modal.getByRole('button', { name: /^(Add passenger|যাত্রী যোগ করুন)$/ }).click();
    await fillTravelDetails(modal);
    const selectedTravelDate = await modal.locator('#travel-departure-date').inputValue();
    expect(selectedTravelDate).toBe(futureTravelDate);
    await modal.getByRole('button', { name: /Continue to review|পেমেন্ট পর্যালোচনায় যান/ }).click();
    await expect(modal.locator('.travel-flow__passenger-table tfoot')).toContainText(totalText);
    await modal.getByRole('button', { name: /Pay online|অনলাইনে পরিশোধ/ }).click();
    await modal.getByRole('button', { name: /Mobile banking|মোবাইল ব্যাংকিং/ }).click();
    await modal.getByRole('radio', { name: 'Nagad' }).check();
    await modal.getByLabel(/I confirm the travel information|ভ্রমণের তথ্য/).check();
    await modal.getByRole('button', { name: /Confirm preview payment|নমুনা পেমেন্ট নিশ্চিত করুন/ }).click();

    const receiptPaper = modal.locator('.receipt-view__paper');
    await expect(receiptPaper).toBeVisible();
    const receipt = modal.getByTestId('travel-family-challan');
    await expect(receipt.locator('tbody tr')).toHaveCount(2);
    await expect(receipt).toContainText(totalText);
    const firstPassenger = (await receipt.locator('tbody tr').first().locator('td').first().innerText()).trim();
    await expect(modal.getByRole('button', { name: /View payment certificate|পেমেন্ট সনদ দেখুন/ })).toBeVisible();
    await modal.getByRole('button', { name: /View payment certificate|পেমেন্ট সনদ দেখুন/ }).click();

    const certificate = modal.getByTestId('payment-certificate-document');
    await expect(certificate).toBeVisible();
    await expect(certificate.getByRole('heading', { name: /Payment Certificate|পেমেন্ট সনদ/ })).toBeVisible();
    await expect(certificate.getByTestId('payment-certificate-reference')).toContainText('SK-PC-' + paymentId);
    await expect(certificate).toContainText(paymentId);
    await expect(certificate).toContainText(firstPassenger);
    await expect(certificate).toContainText('FRIEND SECOND');
    await expect(certificate).toContainText('••••4321');
    await expect(certificate).toContainText('Benapole');
    await expect(certificate).toContainText('India');
    await expect(certificate).toContainText(selectedTravelDate);
    const certificateLines = (page.viewportSize()?.width ?? 0) <= 650
      ? certificate.getByTestId('payment-certificate-mobile-lines').getByTestId('payment-certificate-line-card')
      : certificate.getByTestId('payment-certificate-allocation-table').getByTestId('payment-certificate-line-row');
    await expect(certificateLines).toHaveCount(2);
    await expect(certificateLines.nth(0)).toContainText(language === 'bn' ? '৳ ১,০০০' : '৳ 1,000');
    await expect(certificateLines.nth(1)).toContainText(language === 'bn' ? '৳ ৫০০' : '৳ 500');
    await expect(certificate.getByTestId('payment-certificate-total')).toContainText(totalText);
    await expect(certificate).not.toContainText('SIMULATED_SUCCESS');
    await expect(certificate).not.toContainText('TREASURY_SCROLLED');
    await expect(certificate).not.toContainText('SIM-TOKEN');
    await expect(receipt).toHaveCount(0);
    await modal.getByRole('button', { name: /View receipt|রসিদ দেখুন/ }).click();
    await expect(modal.getByTestId('travel-family-challan')).toBeVisible();
    await modal.getByRole('button', { name: /View payment certificate|পেমেন্ট সনদ দেখুন/ }).click();
    await expect(modal.getByTestId('payment-certificate-document')).toBeVisible();

    const download = page.waitForEvent('download', { timeout: 20000 });
    await modal.getByRole('button', { name: /Download|ডাউনলোড/ }).click();
    const result = await download;
    expect(result.suggestedFilename()).toBe('Payment-certificate-' + paymentId + '.pdf');
    const path = await result.path();
    expect(path).toBeTruthy();
    const bytes = await readFile(path!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString('latin1')).toContain('/Subtype /Image');
    expect(bytes.toString('latin1')).toContain('Sohojkor Payment Certificate ' + paymentId);
    expect(submitted).not.toBeNull();
    const request = submitted as unknown as { service?: string; amountMinor?: number; details?: Record<string, unknown> };
    expect(request.service).toBe('TRAVEL_TAX');
    expect(request.amountMinor).toBe(150000);
    expect(request.details?.passengers).toHaveLength(2);
    expect(request.details?.travelDate).toBe(selectedTravelDate);
    expect(submissionCount).toBe(1);

    // F-162 / US-119: public Guest status recovery uses the original session
    // AND the receipt mobile. Private Payments & Activity stays sign-in gated.
    await page.goto('/?action=verify');
    await page.reload();
    const originalSnapshot=(submitted as unknown as {details?:{receiptSnapshot?:{
      challanNo?:string;receiptMobile?:string
    }}}).details?.receiptSnapshot;
    expect(originalSnapshot?.challanNo).toBeTruthy();
    expect(originalSnapshot?.receiptMobile).toMatch(/^01\d{9}$/);
    const lookup=page.getByRole('dialog',{name:/Payment status & receipt|পেমেন্ট স্ট্যাটাস|পেমেন্টের অবস্থা/});
    await lookup.getByRole('textbox',{name:/Challan, token or transaction reference|চালান, টোকেন বা লেনদেনের রেফারেন্স/})
      .fill(originalSnapshot!.challanNo!);
    await lookup.getByRole('textbox',{name:/Receipt mobile number|রসিদের মোবাইল নম্বর/})
      .fill(originalSnapshot!.receiptMobile!);
    await lookup.getByRole('button',{name:/Search records|রেকর্ড খুঁজুন/}).click();
    await expect(lookup.getByTestId('travel-family-challan').locator('tbody tr')).toHaveCount(2);
    await expect(lookup.getByTestId('travel-family-challan')).toContainText('FRIEND SECOND');
    await lookup.getByRole('button',{name:/View payment certificate|পেমেন্ট সনদ দেখুন/}).click();
    await expect(lookup.getByTestId('payment-certificate-reference'))
      .toContainText('SK-PC-'+paymentId);
    await expect(lookup.getByTestId('payment-certificate-document'))
      .toContainText('FRIEND SECOND');
    expect(submissionCount).toBe(1);

    // A different browser session cannot recover the original document,
    // even with the same public reference and receipt-mobile number.
    await page.evaluate(()=>sessionStorage.setItem(
      'taxpay-guest-simulation-session','ed18e1b3-8abf-4a19-a22d-0b5d6dca7101'));
    await page.reload();
    const outsider=page.getByRole('dialog',{name:/Payment status & receipt|পেমেন্ট স্ট্যাটাস|পেমেন্টের অবস্থা/});
    await outsider.getByRole('textbox',{name:/Challan, token or transaction reference|চালান, টোকেন বা লেনদেনের রেফারেন্স/})
      .fill(originalSnapshot!.challanNo!);
    await outsider.getByRole('textbox',{name:/Receipt mobile number|রসিদের মোবাইল নম্বর/})
      .fill(originalSnapshot!.receiptMobile!);
    await outsider.getByRole('button',{name:/Search records|রেকর্ড খুঁজুন/}).click();
    await expect(outsider.getByRole('alert')).toBeVisible();
    await expect(outsider.locator('.receipt-view')).toHaveCount(0);
    expect(submissionCount).toBe(1);
    expect(submissionCount).toBe(1);
  });
}
