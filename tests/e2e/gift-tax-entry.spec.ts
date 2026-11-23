import {expect, test} from '@playwright/test';

for (const locale of ['en', 'bn'] as const) {
  test('Other Tax connects both existing Travel and review-only Gift flows in '+locale, async ({page}) => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing&lang=en');
    const bn = locale === 'bn';
    const hero = page.locator('.public-hero-carousel__slide[data-active="true"]');
    await hero.getByRole('button', {name: bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    const entry = page.getByRole('dialog', {name:'Pay Tax'});
    await expect(entry.locator('.taxpayer-login-dialog')).toBeVisible();
    await expect(entry.getByRole('button', {name:bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'})).toBeVisible();
    await entry.getByRole('button', {name:bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    const chooser = page.getByTestId('other-tax-chooser');
    const chooserDialog = page.getByRole('dialog', {name:bn ? 'অন্যান্য কর পরিশোধ' : 'Other tax payments'});
    await expect(chooser).toBeVisible();
    await expect(chooserDialog.locator('.taxpay-modal__title')).toHaveCSS('text-align','left');
    await expect(chooserDialog.locator('.taxpay-modal__footer')).toHaveCount(0);
    await expect(chooserDialog.getByRole('button', {name:bn ? 'পেমেন্ট পদ্ধতি নির্বাচন করতে ফিরুন' : 'Back to payment access'})).toBeVisible();
    await chooserDialog.getByRole('button', {name:bn ? 'পেমেন্ট পদ্ধতি নির্বাচন করতে ফিরুন' : 'Back to payment access'}).click();
    await expect(entry).toBeVisible();
    await entry.getByRole('button', {name:bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await expect(chooser.getByRole('button', {name:/Travel Tax|ভ্রমণ কর/})).toBeVisible();
    await chooser.getByRole('button', {name:/Gift Tax|দান কর/}).click();
    const gift = page.getByRole('dialog', {name:bn ? 'দান কর' : 'Gift Tax'});
    await expect(gift.getByTestId('gift-tax-entry-form')).toBeVisible();
    await gift.getByRole('button', {name:bn ? 'এগিয়ে যান' : 'Continue'}).click();
    await expect(gift.getByRole('alert')).toHaveCount(2);
    await gift.locator('#gift-tax-tin').fill('111111111111');
    await gift.locator('#gift-tax-amount').fill('3250.50');
    await gift.getByRole('button', {name:bn ? 'এগিয়ে যান' : 'Continue'}).click();
    await expect(gift.getByTestId('gift-tax-review')).toBeVisible();
    await expect(gift.getByTestId('gift-tax-review')).toContainText(bn ? '৩,২৫০.৫' : '3,250.5');
    await gift.getByRole('button', {name:bn ? 'পর্যালোচনা শেষ করুন' : 'Finish review'}).click();
    await expect(gift.getByTestId('gift-tax-review-complete')).toContainText(bn ? 'কোনো টাকা কাটা হয়নি' : 'No money was charged');
    await expect(page.locator('.receipt-view')).toHaveCount(0);
    await gift.getByRole('button', {name:bn ? 'সম্পন্ন' : 'Done'}).click();
    await expect(gift).toHaveCount(0);
    await hero.getByRole('button', {name:bn ? 'অন্যান্য কর' : 'Other Tax'}).click();
    await entry.getByRole('button', {name:bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment'}).click();
    await page.getByTestId('other-tax-chooser').getByRole('button', {name:/Travel Tax|ভ্রমণ কর/}).click();
    await expect(page.getByRole('dialog', {name:bn ? /ভ্রমণ কর/ : /Travel tax/i})).toBeVisible();
  });
}
