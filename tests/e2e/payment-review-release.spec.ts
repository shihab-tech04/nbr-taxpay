import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pageWidth = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);

const expectResponsiveReceipt = async (page: import('@playwright/test').Page, projectName: string, language: 'bn' | 'en' = 'bn', embedded = false) => {
  const receiptTitle = embedded
    ? language === 'bn' ? 'রসিদের বিবরণ' : 'Receipt details'
    : language === 'bn' ? 'আমার কর — রসিদের বিবরণ' : 'Amar Kor — Receipt details';
  await expect(page.getByRole('heading', { name: receiptTitle, exact: true })).toBeInViewport();
  if (projectName === 'desktop-1280' && !embedded) {
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
  await expect(page.locator('#public-home-title')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment guidance'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Frequently asked questions'})).toBeVisible();
  await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-en');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await switchToBangla();
  await expect(page.locator('#public-home-title')).toBeVisible();
  await expect(page.getByRole('heading',{name:'কর পরিশোধের ধরন জানুন'})).toBeVisible();
  await expect(page.locator('footer').getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('public-hub-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();

  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment composition' })).toBeVisible();
  await expect(page.getByRole('region',{name:'Payment records summary'})).toContainText('Recorded income tax');
  await expect(page.getByText(/verified liability and tax credit not connected/i)).toHaveCount(0);
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
  await expect(page.getByRole('region', { name: 'পেমেন্ট রেকর্ডের সারসংক্ষেপ' })).toContainText('নথিভুক্ত আয়কর');
  await expect(page.getByText(/যাচাইকৃত করদায় ও ক্রেডিট সংযুক্ত নয়/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'পেমেন্টের বিভাজন' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(maxWidth);
  await takeEvidence('taxpayer-home-bn');
  if (viewport === 'mobile-320' || viewport === 'desktop-1280') await audit();
});

test('guest payment remains a bilingual, accessible simulation at mobile and desktop widths', async ({ page }, info) => {
  await page.goto('/?action=guest');
  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();
  await expect(page.getByLabel('Taxpayer’s TIN')).toBeVisible();
  await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(pageWidth(page)).resolves.toBeLessThanOrEqual(info.project.name === 'mobile-320' ? 322 : info.project.name === 'mobile-375' ? 377 : 1282);

  await page.getByLabel('Taxpayer’s TIN').fill('123456789012');
  await page.getByLabel('Mobile number for receipt').fill('01712345678');
  await page.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(page.locator('.payment-head-single')).toBeVisible();
  await page.getByRole('radio', { name: /Income tax payable by persons other than companies/ }).check();

  await page.getByLabel('Payment amount (৳)').fill('0');
  await page.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await expect(page.getByLabel('Payment amount (৳)')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Payment amount (৳)').fill('15000');
  await page.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(page.getByText('Payment simulation only')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay online' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay at a bank branch' })).toBeVisible();

  if (info.project.name === 'mobile-320') {
    const controls = await page.locator('main input:not([type="radio"]):not([type="checkbox"]), main select, main button').evaluateAll(elements =>
      elements.map(element => ({ name: element.getAttribute('aria-label') || element.textContent?.trim() || element.id, height: (element as HTMLElement).getBoundingClientRect().height }))
    );
    expect(controls.filter(control => control.height < 43).map(control => control.name)).toEqual([]);
    const checkboxes = await page.locator('main .payment-review__ack, main .payment-review__fail-toggle').evaluateAll(elements =>
      elements.map(element => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height }))
    );
    expect(checkboxes.filter(control => control.height < 44).map(control => control.label)).toEqual([]);
    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length, targets: nodes.flatMap(node => node.target) }))).toEqual([]);
  }

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('button', { name: 'অনলাইনে পরিশোধ' })).toBeVisible();
  await expect(page.getByText(/অর্থ স্থানান্তর বা সরকারি চালান ইস্যু হয় না/)).toHaveCount(0);
  await page.getByRole('button', { name: 'অনলাইনে পরিশোধ' }).click();
  await page.getByRole('radio', { name: 'bKash' }).check();
  await page.getByRole('checkbox', { name: /আমি টিআইএন, পরিশোধের উদ্দেশ্য/ }).check();
  await page.getByRole('button', { name: /১৫,০০০ পরিশোধ করুন/ }).click();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট প্রক্রিয়া সম্পন্ন' })).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole('heading', { name: 'আমার কর — রসিদের বিবরণ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('ট্রেজারি স্ক্রল রেফারেন্স:')).toBeVisible();
  await expect(page.getByText('সরকারি অর্থ স্থানান্তর হয়নি।')).toHaveCount(0);

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
  await expect(page.getByRole('heading', { name: 'Amar Kor — Receipt details' })).toBeVisible();
  await expect(page.getByText('Treasury scroll reference:')).toBeVisible();
});

test('taxpayer Pay Tax modal preserves amounts through review and simulated receipt', async ({ page }, info) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await page.getByRole('button', { name: 'Pay — select payment type' }).click();
  const services = page.getByRole('dialog', { name: 'Pay Tax' });
  await services.getByRole('button', { name: /Tax with Return/ }).click();
  await services.getByRole('button', { name: 'Continue' }).click();
  await services.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(services.locator('.payment-form-section')).toHaveCount(2);
  await expect(page).toHaveURL(/action=taxpayer_home/);
  // The original taxpayer dashboard remains mounted behind the modal.
  await expect(services).toBeVisible();
  await services.locator('#guest-tin').fill('123456789012');
  await services.locator('#guest-phone').fill('01712345678');
  await services.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(services.getByRole('heading', { name: 'Payment calculation' })).toBeVisible();
  await services.getByRole('radio', { name: /Income tax payable by persons other than companies/ }).check();
  await services.locator('#guest-tax-amount').fill('0');
  await services.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(services.getByRole('alert')).toContainText('greater than zero');
  await services.locator('#guest-tax-amount').fill('25000');
  await services.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(services.getByText('Step 3 of 4')).toBeVisible();
  await expect(services.getByText('No money is transferred and no official challan is issued.')).toHaveCount(0);
  await services.getByRole('button', { name: 'Pay online' }).click();
  await services.getByRole('radio', { name: 'Nagad' }).check();
  await services.getByRole('checkbox', { name: /I have checked the TIN/ }).check();
  await services.getByRole('button', { name: /Pay BDT 25,000/ }).click();
  await expect(services.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  await expect(services.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name, 'en', true);

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/taxpayer-wizard-bn-desktop-1280.png' });
  }
  await expect(services.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});

test('Travel Tax clearly discloses unverified rates and performs a non-operational bilingual simulation', async ({ page }, info) => {
  await page.goto('/?action=travel');
  await expect(page.getByRole('heading', { name: 'Travel tax' })).toBeVisible();
  await expect(page.getByText(/Rates and exemptions are not verified/)).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /By air to North America, South America/ }).first()).toBeVisible();
  await page.locator('#travel-tax-route-0').check();
  await page.getByRole('button', { name: 'Continue to passenger details' }).click();
  await page.getByLabel('Passenger name').fill('SAMPLE PASSENGER');
  await page.getByLabel('Passport number').fill('SAMPLE123');
  await page.getByLabel('Mobile number for receipt').fill('01712345678');
  await page.getByLabel('Travel date').fill('2026-10-25');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'ভ্রমণ কর' })).toBeVisible();
  await expect(page.getByText(/হার ও অব্যাহতি যাচাইকৃত নয়/)).toHaveCount(0);
  await expect(page.getByLabel('যাত্রীর বয়স')).toBeVisible();
  await page.getByRole('button', { name: 'পর্যালোচনায় যান' }).click();
  await expect(page.getByRole('heading', { name: 'তথ্য পর্যালোচনা' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'পেমেন্টে এগিয়ে যান' })).toBeVisible();
  await page.getByRole('button', { name: 'পেমেন্টে এগিয়ে যান' }).click();
  await expect(page.getByText('ভ্রমণ করের তথ্য প্রস্তুত')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'আমার কর — রসিদের বিবরণ' })).toBeVisible();
  await expectResponsiveReceipt(page, info.project.name);
  await expect(page.getByText('ব্যক্তিগত কর ক্রেডিট যাচাই হয়নি।')).toHaveCount(0);

  if (info.project.name === 'mobile-320') {
    expect(await pageWidth(page)).toBeLessThanOrEqual(322);
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-mobile-320.png' });
  }
  if (info.project.name === 'desktop-1280') {
    await page.screenshot({ path: 'docs/acceptance-evidence/2026-10-12/travel-tax-bn-desktop-1280.png' });
  }
});
