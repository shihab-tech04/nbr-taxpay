import { expect, test } from '@playwright/test';

test('public guide provides scoped official support, legal links and example-payment guidance', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const source = page.locator('.public-guide-source').first();
  await expect(page.getByRole('heading', { name: 'Sohojkor user guide' })).toBeVisible();
  await expect(source.getByRole('link', { name: 'Call NBR e-Return support' })).toHaveAttribute('href', 'tel:09643717171');
  await expect(source.getByRole('link', { name: 'Call NBR Tax e-Payment challan support (09611-777111)' })).toHaveAttribute('href', 'tel:09611777111');
  await expect(source.getByRole('link', { name: 'Call NBR VAT e-Payment challan support (16555)' })).toHaveAttribute('href', 'tel:16555');
  await expect(source).toContainText('For Tax e-Payment challan problems, call 09611-777111; for VAT e-Payment challan problems, call 16555.');
  await expect(source.getByRole('link', { name: 'NBR e-Return FAQ' })).toHaveAttribute('href', 'https://nbr.gov.bd/all-faq/eng');
  await expect(source.getByRole('link', { name: 'NBR VAT Portal terms (English)' })).toHaveAttribute('href', 'https://nbr.gov.bd/terms-of-use/eng');
  await expect(source.getByRole('link', { name: 'NBR VAT Portal privacy policy (English)' })).toHaveAttribute('href', 'https://nbr.gov.bd/privacy-policy/e-services/vatcalculator/eng');
  await expect(source).toContainText('not Sohojkor');
  await expect(source).toContainText('May 2012');
  await expect(source).toContainText('does not prove Treasury settlement');

  await page.locator('.public-guide-actions').getByRole('button', { name: 'Open payment services' }).click();
  await expect(page.locator('.taxpay-modal').first()).toBeVisible();

  await page.goto('/?action=user_guide&category=travel');
  await page.locator('.public-guide-actions').getByRole('button', { name: 'Pay Travel Tax' }).click();
  await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
  await expect(page.getByText('Passengers and receipt details', { exact: true })).toBeVisible();

  await page.goto('/?action=user_guide&lang=bn');
  const banglaSource = page.locator('.public-guide-source').first();
  await expect(page.getByRole('heading', { name: 'সহজকর ব্যবহার নির্দেশিকা' })).toBeVisible();
  await expect(banglaSource.getByRole('link', { name: 'এনবিআর আয়কর ই-পেমেন্ট চালান সহায়তায় কল করুন (০৯৬১১-৭৭৭১১১)' })).toHaveAttribute('href', 'tel:09611777111');
  await expect(banglaSource.getByRole('link', { name: 'এনবিআর ভ্যাট ই-পেমেন্ট চালান সহায়তায় কল করুন (১৬৫৫৫)' })).toHaveAttribute('href', 'tel:16555');
  await expect(banglaSource.getByRole('link', { name: 'এনবিআর ভ্যাট পোর্টালের ব্যবহারের শর্ত (ইংরেজি)' })).toBeVisible();
  await expect(banglaSource).toContainText('আয়কর ই-পেমেন্ট চালান পেতে সমস্যায় ০৯৬১১-৭৭৭১১১ এবং ভ্যাট ই-পেমেন্ট চালান পেতে সমস্যায় ১৬৫৫৫ নম্বরে কল করুন।');
  await expect(banglaSource).toContainText('মে ২০১২');
});

test('public payment glossary is bilingual, searchable and responsive', async ({ page }) => {
  await page.goto('/?action=glossary');
  await expect(page.getByRole('heading', { name: 'Payment terms' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax with Return' })).toBeVisible();
  await expect(page.getByText('Selecting it here does not file or submit an income tax return.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search terms' }).fill('Example Payment Record');
  await expect(page.getByRole('heading', { name: 'Example Payment Record' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax with Return' })).toHaveCount(0);

  await page.goto('/?action=glossary&lang=bn');
  await expect(page.getByRole('heading', { name: 'কর ও পেমেন্টের শব্দ' })).toBeVisible();
  await expect(page.getByLabel('শব্দ খুঁজুন')).toBeVisible();
  await page.getByRole('searchbox', { name: 'শব্দ খুঁজুন' }).fill('রসিদ');
  await expect(page.getByRole('heading', { name: 'Payment Receipt' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});


test('guide search keeps existing Travel Tax action reachable in English and Bangla', async ({ page }) => {
  for (const language of ['en', 'bn'] as const) {
    await page.goto('/?action=user_guide&lang=' + language);
    const bn = language === 'bn';
    await page.getByRole('searchbox', { name: bn ? 'নির্দেশিকা খুঁজুন' : 'Search the guide' })
      .fill(bn ? 'ভ্রমণ কর' : 'Travel tax');
    const result = page.locator('.public-guide-result-group').filter({
      has: page.getByRole('heading', {name: bn ? 'ভ্রমণ কর' : 'Travel tax', exact: true})
    });
    await expect(result).toBeVisible();
    await result.getByRole('button', {name: bn ? 'ভ্রমণ কর পরিশোধ করুন' : 'Pay Travel Tax'}).click();
    await expect(page.getByRole('dialog', {name: bn ? 'ভ্রমণ কর' : 'Travel tax'})).toBeVisible();
  }
});
