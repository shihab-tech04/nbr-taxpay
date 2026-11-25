import {test,expect} from '@playwright/test';

test('approved fixed banner keeps three service destinations without inventing Gift Tax challans',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  const active=page.locator('.public-hero-carousel__slide[data-active="true"]');
  await expect(active.getByText('আমার করের টাকায় গড়বো স্বদেশ')).toHaveCount(0);
  await expect(page.locator('.public-hero-carousel-shell--box')).toHaveCount(0);
  await expect(active).toHaveAttribute('data-fixed-left', 'true');
  await expect(active.locator('.public-guest-action')).toHaveCount(2);
  await expect(active.getByRole('button',{name:'Pay Tax',exact:true})).toBeVisible();
  await expect(active.getByRole('button',{name:'Other Tax',exact:true})).toBeVisible();
  await expect(active.locator('.public-hero-carousel__gift-link')).toHaveCount(0);
  await active.getByRole('button',{name:'Other Tax'}).click();
  const otherAccess = page.locator('.taxpay-modal[data-public-service="login"]');
  await expect(otherAccess.locator('.taxpayer-login-dialog')).toBeVisible();
  await otherAccess.getByRole('button',{name:'Walk-in Payment'}).click();
  await page.getByTestId('other-tax-chooser').getByRole('button',{name:/Gift Tax/}).click();
  const gift=page.getByRole('dialog',{name:'Gift Tax'});
  await expect(gift).toBeVisible();
  const donor=gift.getByTestId('gift-donor-section');
  const donee=gift.getByTestId('gift-donee-section');
  await donor.locator('#gift-donor-tin').fill('111111111111');
  await donor.getByRole('button',{name:'Search Donor information'}).click();
  await donor.getByRole('button',{name:'Add Donor'}).click();
  await donee.locator('#gift-donee-tin').fill('222222222222');
  await donee.getByRole('button',{name:'Search Donee information'}).click();
  await donee.locator('#gift-donee-relationship').click();
  await page.getByRole('option',{name:'Father'}).click();
  await donee.getByRole('button',{name:'Add Donee'}).click();
  await gift.getByRole('button',{name:'Continue to Gift & Tax Information'}).click();
  await gift.locator('#gift-tax-amount').fill('2500');
  await gift.locator('#gift-tax-date').fill('2025-01-15');
  await gift.getByRole('button',{name:'Continue to Final Preview'}).click();
  await expect(gift.getByTestId('gift-tax-review')).toContainText('2,500');
  await expect(gift.getByTestId('gift-tax-review-complete')).toContainText('No money was charged');
  await gift.getByRole('button',{name:'Close Gift Tax'}).click();
  const confirmation = page.getByTestId('walkin-payment-exit-overlay');
  await expect(confirmation).toBeVisible();
  const overlayIndex = await confirmation.evaluate(element => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(overlayIndex).toBeGreaterThan(120);
  await confirmation.getByRole('button',{name:'Discard tax payment'}).click();
  await expect(gift).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toHaveCount(0);
});
test('walk-in head catalogue reuses compact accordion and keeps Return in the shared editor',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  const categories=dialog.getByTestId('fixed-tax-categories');
  await expect(categories.locator('details[data-head-group]')).toHaveCount(7);
  await expect(categories.locator('table')).toHaveCount(0);
  await expect(categories.getByRole('button',{name:/View heads/})).toHaveCount(0);
  await expect(dialog.getByTestId('frequent-category-section')).toHaveCount(0);
  const catalogue=dialog.getByTestId('other-tax-head-catalogue');
  await expect(catalogue).toBeVisible();
  const group=catalogue.getByTestId('unified-v5-return-group');
  await group.locator('summary').click();
  await expect(group).toHaveAttribute('open','');
  await dialog.getByTestId('unified-v5-return-checkbox').check();
  await expect(group.getByTestId('unified-v5-return-amount')).toBeVisible();
  await expect(group.locator('.other-tax-category-trigger__selected')).toContainText('1 selected');
  await group.locator('summary').click();
  await expect(group).not.toHaveAttribute('open','');
  await group.locator('summary').click();
  await expect(dialog.getByTestId('unified-v5-return-checkbox')).toBeChecked();
});

// The banner and first benefit must share one parallel entry, while legacy
// relationship-specific payment UI remains available elsewhere untouched.
test('hero Pay Tax and All Tax Payments benefit open the same parallel chooser',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  const hero=page.locator('.public-hero-carousel__slide[data-active="true"]');
  await hero.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const chooser=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(chooser.getByRole('button',{name:'Walk-in Payment'})).toBeVisible();
  await expect(chooser.locator('[data-payer-relationship]')).toHaveCount(0);
  await chooser.getByRole('button',{name:'Close payment services'}).click();
  await expect(chooser).toHaveCount(0);
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  await expect(chooser.getByRole('button',{name:'Walk-in Payment'})).toBeVisible();
  await expect(chooser.locator('[data-payer-relationship]')).toHaveCount(0);
});


for (const locale of ['en', 'bn'] as const) {
  test('walk-in cancellation uses only Keep editing and Discard tax payment (' + locale + ')', async ({ page }) => {
    await page.goto('/?action=landing&lang=' + locale);
    await page.locator('.public-benefits__item[data-benefit="payments"]').click();
    const payment = page.getByRole('dialog', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax' });
    await payment.getByRole('button', { name: locale === 'bn' ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment' }).click();
    const tin = payment.getByTestId('unified-tin-input');
    await tin.fill('222222222222');
    await expect(payment.locator('.payment-form-draft-controls__save')).toHaveCount(0);
    await payment.locator('.taxpay-modal__close').click();
    const exit = payment.getByRole('alertdialog', {
      name: locale === 'bn' ? 'কর পরিশোধ বাদ দেবেন?' : 'Discard tax payment?',
    });
    await expect(exit).toBeVisible();
    await expect(exit.locator('button')).toHaveCount(2);
    const discard = exit.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ বাদ দিন' : 'Discard tax payment' });
    await expect(discard).toBeVisible();
    await expect(discard).toHaveCSS('min-height', '44px');
    await expect(exit.getByRole('button', { name: locale === 'bn' ? 'সম্পাদনা চালিয়ে যান' : 'Keep editing' })).toBeVisible();
    await expect(exit.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ বাদ দিন' : 'Discard tax payment' })).toBeVisible();
    await expect(exit.getByText(/Save Draft|Save your tax payment|saved beneficiary session|খসড়া সংরক্ষণ/)).toHaveCount(0);
    await expect(exit.locator('[role="alert"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(exit).toHaveCount(0);
    await expect(payment).toBeVisible();
    await expect(tin).toHaveValue('222222222222');
    await payment.locator('.taxpay-modal__close').click();
    await expect(exit).toBeVisible();
    await exit.getByRole('button', { name: locale === 'bn' ? 'সম্পাদনা চালিয়ে যান' : 'Keep editing' }).click();
    await expect(exit).toHaveCount(0);
    await expect(tin).toHaveValue('222222222222');
    await page.locator('.taxpay-modal__overlay').click({ position: { x: 2, y: 2 } });
    await expect(payment).toBeVisible();
    await expect(exit).toHaveCount(0);
    await expect(tin).toHaveValue('222222222222');

    if (locale === 'en') {
      await payment.getByRole('button', { name: 'Search taxpayer TIN' }).click();
      await payment.getByRole('button', { name: 'Add taxpayer' }).click();
      await payment.getByRole('button', { name: 'Continue to Payment Head' }).click();
      await expect(payment.getByTestId('fixed-tax-categories')).toBeVisible();
      await expect(payment.locator('.payment-form-draft-controls__save')).toHaveCount(0);
    }

    await payment.locator('.taxpay-modal__close').click();
    await expect(exit).toBeVisible();
    await exit.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ বাদ দিন' : 'Discard tax payment' }).click();
    await expect(payment).toHaveCount(0);
  });
}
