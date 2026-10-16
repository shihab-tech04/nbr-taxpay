import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pageWidth = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);

const expectResponsiveReceipt = async (page: import('@playwright/test').Page, projectName: string) => {
  await expect(page.getByRole('heading', { name: 'ট্যাক্সপে — রসিদের বিবরণ' })).toBeInViewport();
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
      if (await page.locator('.public-home-header').count()) {
        await expect(page.locator('.public-home-header')).toBeVisible();
      } else {
        await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
        await expect(page.locator('.citizen-header')).toHaveCSS('transform', 'none');
        await expect(page.locator('.citizen-corners')).toHaveCount(0);
      }
      await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/' + name + '-' + viewport + '.png', fullPage: false });
    }
  };
  const audit = async () => {
    const results = await new AxeBuilder({ page }).include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap(node => node.target) }))).toEqual([]);
  };
  const switchToBangla = async () => {
    // Public header keeps its language control. Taxpayer mobile places it
    // under Navigation, while desktop retains the header utility.
    // Reset the scroll-aware header before using its current-viewport control.
    // This also asserts that the expanded header returns on an upward scroll.
    if (!(await page.locator('.public-home-header').isVisible())) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
    }
    if (await page.locator('.public-home-header').isVisible()) {
      await page.locator('.public-home-header').getByRole('button',{name:'বাংলা'}).click();
      return;
    }
    if (await page.locator('.citizen-mobile-menu-trigger').isVisible()) {
      await page.locator('.citizen-mobile-menu-trigger').click();
      await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
      await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
      return;
    }
    if (await page.locator('.citizen-corners').count()) {
      await page.locator('.citizen-corners').getByRole('button',{name:'Open menu'}).click();
      await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
      await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
      return;
    }
    await page.locator('.citizen-header').getByRole('button',{name:'বাংলা'}).click();
  };

  await page.goto('/?action=landing');
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment guidance'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Frequently asked questions'})).toBeVisible();
  await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-en');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await switchToBangla();
  await expect(page.getByRole('heading',{name:'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'কর পরিশোধের ধরন জানুন'})).toBeVisible();
  await expect(page.locator('footer').getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment composition' })).toBeVisible();
  await expect(page.getByRole('region',{name:'Payment records summary'})).toContainText('Recorded income tax');
  await expect(page.getByText('Recorded activity · verified liability and tax credit not connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open transaction history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review tax ledger', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View documents' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Full payment journey' })).toBeVisible();
  if (await page.locator('.citizen-mobile-menu-trigger').isVisible()) {
    await page.getByRole('button',{name:'Open menu'}).click();
    await expect(page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Notifications'})).toBeVisible();
    await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Close'}).click();
  } else {
    const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
    if(await rail.isVisible()) {
      await expect(rail.getByRole('button',{name:'Notifications'})).toBeVisible();
    } else {
      await page.locator('.citizen-header').getByRole('button',{name:'Open menu'}).click();
      await expect(page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Notifications'})).toBeVisible();
      await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Close'}).click();
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('taxpayer-home-en');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await switchToBangla();
  await expect(page.getByRole('heading', { name: 'ড্যাশবোর্ড সারসংক্ষেপ' })).toBeVisible();
  await expect(page.getByText('আয়কর, পেমেন্ট ও আর্থিক রেকর্ড একসঙ্গে')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'পেমেন্টের বিভাজন' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('taxpayer-home-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();
});

test('guest payment remains a bilingual, accessible simulation at mobile and desktop widths', async ({ page }, info) => {
  await page.goto('/?action=guest');
  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();
  await expect(page.getByLabel('Taxpayer Identification Number (e-TIN)')).toBeVisible();
  await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(pageWidth(page)).resolves.toBeLessThanOrEqual(info.project.name === 'mobile-320' ? 322 : info.project.name === 'mobile-375' ? 377 : 1282);

  await page.getByLabel('Taxpayer Identification Number (e-TIN)').fill('123456789012');
  await page.getByLabel('Payer Legal Name').fill('Sample Taxpayer');
  await page.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Master payment head' })).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeVisible();

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
  await expect(page.getByText(/অর্থ স্থানান্তর বা সরকারি চালান ইস্যু হয় না/)).toBeVisible();
  await page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ }).click();
  await expect(page.getByText('পেমেন্টের প্রিভিউ প্রস্তুত।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ট্যাক্সপে — রসিদের বিবরণ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('ট্রেজারি স্ক্রল রেফারেন্স:')).toBeVisible();
  await expect(page.getByText('সরকারি অর্থ স্থানান্তর হয়নি।')).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'TaxPay — Receipt details' })).toBeVisible();
  await expect(page.getByText('Treasury scroll reference:')).toBeVisible();
});

test('authenticated taxpayer wizard preserves amounts while localizing the full simulation journey', async ({ page }, info) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
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
  await expect(page.getByText('No money is transferred and no official challan is issued.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Run payment simulation/ })).toBeVisible();

  if (info.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'বাংলা' }).click();
    await page.getByRole('dialog', { name: 'সেবা ও মেনু' }).getByRole('button', { name: 'বন্ধ করুন' }).click();
  } else await page.getByRole('button', { name: 'বাংলা' }).first().click();
  await expect(page.getByRole('heading', { name: 'পেমেন্টের তথ্য পর্যালোচনা' })).toBeVisible();
  await expect(page.getByText(/অর্থ স্থানান্তর বা সরকারি চালান ইস্যু হয় না/)).toBeVisible();
  await expect(page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ })).toBeVisible();
  await page.getByRole('button', { name: /পেমেন্ট সিমুলেশন চালান/ }).click();
  await expect(page.getByText('পেমেন্টের প্রিভিউ প্রস্তুত।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ট্যাক্সপে — রসিদের বিবরণ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-desktop-1280.png' });
  }
  if (info.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: 'মেনু খুলুন' }).click();
    await page.getByRole('dialog', { name: 'সেবা ও মেনু' }).getByRole('button', { name: 'English' }).click();
    await page.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'Close' }).click();
  } else await page.getByRole('button', { name: 'EN' }).first().click();
  await expect(page.getByRole('heading', { name: 'TaxPay — Receipt details' })).toBeVisible();
});

test('Travel Tax clearly discloses unverified rates and performs a non-operational bilingual simulation', async ({ page }, info) => {
  await page.goto('/?action=travel');
  await expect(page.getByRole('heading', { name: 'Travel tax' })).toBeVisible();
  await expect(page.getByText(/Rates and exemptions are not verified/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Air - North America/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue to passenger details' }).click();
  await page.getByLabel('Passenger name (as in passport)').fill('SAMPLE PASSENGER');
  await page.getByLabel('Passport number (synthetic data only)').fill('SAMPLE123');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'ভ্রমণ কর' })).toBeVisible();
  await expect(page.getByText(/হার ও অব্যাহতি যাচাইকৃত নয়/)).toBeVisible();
  await expect(page.getByText('অব্যাহতি হিসাব করা হয় না।')).toBeVisible();
  await page.getByRole('button', { name: 'পর্যালোচনায় যান' }).click();
  await expect(page.getByRole('heading', { name: 'তথ্য পর্যালোচনা' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'পেমেন্ট সিমুলেশন চালান' })).toBeVisible();
  await page.getByRole('button', { name: 'পেমেন্ট সিমুলেশন চালান' }).click();
  await expect(page.getByText('ভ্রমণ করের প্রিভিউ প্রস্তুত।')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ট্যাক্সপে — রসিদের বিবরণ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('ব্যক্তিগত কর ক্রেডিট যাচাই হয়নি।')).toBeVisible();

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-desktop-1280.png' });
  }
});
