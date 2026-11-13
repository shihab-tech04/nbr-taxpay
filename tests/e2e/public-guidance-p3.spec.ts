import { expect, test } from '@playwright/test';

test('public guide provides scoped official support, legal links and example-payment guidance', async ({ page }) => {
  await page.goto('/?action=user_guide');
  const source = page.locator('.public-guide-source').first();
  await expect(page.getByRole('heading', { name: 'Sohojkor user guide' })).toBeVisible();
  await expect(source.getByRole('link', { name: 'Call NBR e-Return support' })).toHaveAttribute('href', 'tel:09643717171');
  await expect(source.getByRole('link', { name: 'Call NBR Tax and VAT e-Payment hotline (16555)' })).toHaveAttribute('href', 'tel:16555');
  await expect(source).toContainText('For tax or VAT e-Payment problems, call 16555.');
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
  await expect(banglaSource.getByRole('link', { name: 'এনবিআর কর ও ভ্যাট ই-পেমেন্ট হটলাইনে কল করুন (১৬৫৫৫)' })).toHaveAttribute('href', 'tel:16555');
  await expect(banglaSource.getByRole('link', { name: 'এনবিআর ভ্যাট পোর্টালের ব্যবহারের শর্ত (ইংরেজি)' })).toBeVisible();
  await expect(banglaSource).toContainText('কর বা ভ্যাট ই-পেমেন্ট সমস্যায় ১৬৫৫৫ নম্বরে কল করুন।');
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
