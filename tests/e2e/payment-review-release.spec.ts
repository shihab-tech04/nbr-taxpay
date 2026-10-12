import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pageWidth = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);

const expectResponsiveReceipt = async (page: import('@playwright/test').Page, projectName: string) => {
  await expect(page.getByRole('heading', { name: 'TaxPay — অনানুষ্ঠানিক নমুনা রসিদ' })).toBeInViewport();
  if (projectName === 'desktop-1280') {
    await expect(page.getByTestId('receipt-breakdown-table')).toBeVisible();
    await expect(page.getByTestId('receipt-breakdown-mobile')).toBeHidden();
  } else {
    await expect(page.getByTestId('receipt-breakdown-mobile')).toBeVisible();
    await expect(page.getByTestId('receipt-breakdown-table')).toBeHidden();
  }
};

test('public knowledge hub and sample taxpayer home stay coherent in EN/BN at approved widths', async ({ page }, info) => {
  const viewport = info.project.name;
  const maxWidth = viewport === 'mobile-320' ? 322 : viewport === 'mobile-375' ? 377 : 1282;
  const takeEvidence = async (name: string) => {
    if (viewport === 'mobile-320' || viewport === 'desktop-1280') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
      await expect(page.locator('.citizen-header')).toHaveCSS('transform', 'none');
      await expect(page.locator('.citizen-corners')).toHaveCount(0);
      await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/' + name + '-' + viewport + '.png', fullPage: false });
    }
  };
  const audit = async () => {
    const results = await new AxeBuilder({ page }).include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap(node => node.target) }))).toEqual([]);
  };
  const switchToBangla = async () => {
    const languageButton = page.getByRole('button', { name: 'বাংলা' });
    const headerIsCollapsed = await page.locator('.citizen-header--hidden').count() > 0;
    if (!headerIsCollapsed && await languageButton.isVisible()) await languageButton.click();
    else {
      await page.locator('.citizen-corners').getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'বাংলা' }).click();
    }
  };

  await page.goto('/?action=landing');
  await expect(page.getByRole('heading', { name: 'Understand your next tax-payment step' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick access' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a payment journey' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Find a sample receipt/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Secure account access/ })).toBeVisible();
  await expect(page.locator('.citizen-pay svg.lucide-plus')).toBeVisible();
  await page.getByText('More payment types', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Assessed Demand/ })).toBeVisible();
  await page.getByText('More payment types', { exact: true }).click();
  const unknown = 'DEMO-REFERENCE-NOT-FOUND';
  await page.getByLabel('Challan, token or transaction reference').fill(unknown);
  await page.getByRole('button', { name: 'Search sample records' }).click();
  await expect(page.getByRole('status')).toContainText('No matching demonstration reference');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-en');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await switchToBangla();
  await expect(page.getByRole('heading', { name: 'আপনার পরবর্তী কর পরিশোধের ধাপ জানুন' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'দ্রুত প্রবেশ' })).toBeVisible();
  await expect(page.getByLabel('চালান, টোকেন বা লেনদেনের রেফারেন্স')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'View sample taxpayer demonstration' }).click();
  await expect(page.getByRole('heading', { name: 'My Tax Payments' })).toBeVisible();
  await expect(page.getByText('This sample profile is not a signed-in taxpayer account.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax position' })).toBeVisible();
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('Unverified', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Payments & activity' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tax ledger', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Certificates' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corrections' })).toBeVisible();
  await page.getByText('More taxpayer services', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await page.getByText('More taxpayer services', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('taxpayer-home-en');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await switchToBangla();
  await expect(page.getByRole('heading', { name: 'আমার কর পেমেন্ট' })).toBeVisible();
  await expect(page.getByText('এই নমুনা প্রোফাইলটি সাইন-ইন করা করদাতা অ্যাকাউন্ট নয়।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'করের অবস্থান' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('taxpayer-home-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();
});

test('guest payment remains a bilingual, accessible simulation at mobile and desktop widths', async ({ page }, info) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay — select payment type' }).click();
  await page.getByRole('dialog', { name: 'Select payment type' }).getByRole('button', { name: 'Advance Tax', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();
  await expect(page.getByLabel('Taxpayer Identification Number (e-TIN)')).toBeVisible();
  await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(pageWidth(page)).resolves.toBeLessThanOrEqual(info.project.name === 'mobile-320' ? 322 : info.project.name === 'mobile-375' ? 377 : 1282);

  await page.getByLabel('Taxpayer Identification Number (e-TIN)').fill('123456789012');
  await page.getByLabel('Payer Legal Name').fill('Sample Taxpayer');
  await page.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Master payment head' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Advance Tax/ }).first()).toBeVisible();

  await page.getByLabel('Tax Amount (৳)').fill('0');
  await page.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await expect(page.getByLabel('Tax Amount (৳)')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Tax Amount (৳)').fill('15000');
  await page.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(page.getByText('Payment simulation only')).toBeVisible();
  await expect(page.getByRole('button', { name: /Run payment simulation/ })).toBeVisible();

  if (info.project.name === 'mobile-320') {
    const controls = await page.locator('main input:not([type="radio"]), main select, main button').evaluateAll(elements =>
      elements.map(element => ({ name: element.getAttribute('aria-label') || element.textContent?.trim() || element.id, height: (element as HTMLElement).getBoundingClientRect().height }))
    );
    expect(controls.filter(control => control.height < 43).map(control => control.name)).toEqual([]);
    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length, targets: nodes.flatMap(node => node.target) }))).toEqual([]);
  }

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByText(/পেমেন্ট সিমুলেশন চালান/)).toBeVisible();
  await expect(page.getByText(/কোনো অর্থ স্থানান্তর হবে না/)).toBeVisible();
  await page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ }).click();
  await expect(page.getByText('সিমুলেশন সম্পন্ন — কাল্পনিক নমুনা রসিদ তৈরি হয়েছে।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TaxPay — অনানুষ্ঠানিক নমুনা রসিদ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('কাল্পনিক ট্রেজারি স্ক্রল রেফারেন্স:')).toBeVisible();
  await expect(page.getByText('শুধু নমুনা অবস্থা; সরকারি অর্থ স্থানান্তর হয়নি।')).toBeVisible();

  if (info.project.name === 'mobile-320') {
    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length, targets: nodes.flatMap(node => node.target) }))).toEqual([]);
  }

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/guest-payment-bn-mobile-320.png' });
    await page.getByTestId('receipt-breakdown-mobile').screenshot({ path: 'docs/acceptance-evidence/2026-10-12/guest-receipt-lines-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/guest-payment-bn-desktop-1280.png' });
    await page.getByTestId('receipt-breakdown-table').screenshot({ path: 'docs/acceptance-evidence/2026-10-12/guest-receipt-lines-bn-desktop-1280.png' });
  }

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'TaxPay — Unofficial demonstration receipt' })).toBeVisible();
  await expect(page.getByText('Fictional Treasury scroll reference:')).toBeVisible();
});

test('authenticated taxpayer wizard preserves amounts while localizing the full simulation journey', async ({ page }, info) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'View sample taxpayer demonstration' }).click();
  await page.getByRole('button', { name: 'Pay — select payment type' }).click();
  await expect(page.getByRole('heading', { name: 'Income tax payment' })).toBeVisible();
  await expect(page.getByLabel('Assessment year')).toBeVisible();
  await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to amounts' }).click();

  await expect(page.getByLabel('Tax amount (৳)')).toHaveValue('25000');
  await page.getByLabel('Tax amount (৳)').fill('0');
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await page.getByLabel('Tax amount (৳)').fill('25000');
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await expect(page.getByText('This is a prototype simulation.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Run payment simulation/ })).toBeVisible();

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'নমুনা তথ্য পর্যালোচনা' })).toBeVisible();
  await expect(page.getByText(/এটি একটি নমুনা সিমুলেশন/)).toBeVisible();
  await expect(page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ })).toBeVisible();
  await page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ }).click();
  await expect(page.getByText('নমুনা পেমেন্ট ধাপ সম্পন্ন হয়েছে।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TaxPay — অনানুষ্ঠানিক নমুনা রসিদ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-desktop-1280.png' });
  }
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'TaxPay — Unofficial demonstration receipt' })).toBeVisible();
});

test('Travel Tax clearly discloses unverified rates and performs a non-operational bilingual simulation', async ({ page }, info) => {
  await page.goto('/?action=travel');
  await expect(page.getByRole('heading', { name: 'Travel tax demonstration' })).toBeVisible();
  await expect(page.getByText(/Rates in this prototype come from the supplied reference concept/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Air - North America/ }).first()).toBeVisible();
  await page.getByLabel('Passenger name (as in passport)').fill('SAMPLE PASSENGER');
  await page.getByLabel('Passport number (synthetic data only)').fill('SAMPLE123');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'ভ্রমণ করের নমুনা' })).toBeVisible();
  await expect(page.getByText(/বর্তমান আইনের সঙ্গে প্রত্যয়ন করা হয়নি/)).toBeVisible();
  await expect(page.getByText('এই নমুনায় বয়স নেওয়া বা অব্যাহতি প্রয়োগ করা হয় না।')).toBeVisible();
  await page.getByRole('button', { name: 'পেমেন্ট সিমুলেশন চালান' }).click();
  await expect(page.getByText(/কোনো সরকারি চালান ইস্যু হয়নি/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TaxPay — অনানুষ্ঠানিক নমুনা রসিদ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('এই নমুনা ব্যক্তিগত কর-ক্রেডিট তৈরি বা যাচাই করে না।')).toBeVisible();

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-desktop-1280.png' });
  }
});
