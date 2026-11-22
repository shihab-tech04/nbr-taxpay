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
  await page.getByTestId('other-tax-chooser').getByRole('button',{name:/Gift Tax/}).click();
  const gift=page.getByRole('dialog',{name:'Gift Tax'});
  await expect(gift).toBeVisible();
  await gift.getByLabel('Taxpayer TIN').fill('111111111111');
  await gift.getByLabel('Amount to pay (৳)').fill('2500');
  await gift.getByRole('button',{name:'Continue'}).click();
  await expect(gift.getByTestId('gift-tax-review')).toContainText('2,500');
  await gift.getByRole('button',{name:'Finish review'}).click();
  await expect(gift.getByText(/no money was charged/i)).toBeVisible();
  await gift.getByRole('button',{name:'Close Gift Tax'}).click();
  await expect(gift).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toHaveCount(0);
});
test('walk-in parallel chooser uses a seven-row category table and keeps Return in shared head catalogue',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  const table=dialog.getByTestId('fixed-tax-categories');
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect(dialog.getByText('Sign in to see categories from your payment history.')).toHaveCount(0);
  await expect(dialog.getByTestId('frequent-category-section')).toHaveCount(0);
  await expect(dialog.getByTestId('unified-v5-return-group')).toHaveCount(1);
  await table.getByRole('button',{name:'View payment heads for Tax with Return'}).click();
  await expect(dialog.getByTestId('unified-v5-return-group')).toHaveAttribute('open','');
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
