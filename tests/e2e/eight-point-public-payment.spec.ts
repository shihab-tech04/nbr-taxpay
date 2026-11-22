import {test,expect} from '@playwright/test';

test('public home shows Bengali slogan and three working service entries without a fabricated Gift Tax challan',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  const active=page.locator('.public-hero-carousel__slide[data-active="true"]');
  await expect(active.getByText('আমার করের টাকায় গড়বো স্বদেশ')).toBeVisible();
  await expect(active.locator('.public-guest-action')).toHaveCount(3);
  await active.getByRole('button',{name:'Gift Tax'}).click();
  const gift=page.getByRole('dialog',{name:'Gift Tax'});
  await expect(gift).toBeVisible();
  await expect(gift.getByText(/not configured/i)).toBeVisible();
  await expect(gift.getByRole('button',{name:'View available tax heads'})).toBeVisible();
  await gift.getByRole('button',{name:'Close modal'}).click();
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
  await expect(dialog.getByText('Sign in to see categories from your payment history.')).toBeVisible();
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
