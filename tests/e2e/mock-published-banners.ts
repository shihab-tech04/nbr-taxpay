import type { Page } from '@playwright/test';

// Published CMS records for offline, deterministic browser acceptance.
// Never depend on bundled images bypassing SQL publication state.
const categories = [
  { id: 'intro', service_code: null, heading_en: 'Tax payments, without the confusion', heading_bn: 'কর পরিশোধে আর বিভ্রান্তি নয়।', mobile_heading_en: 'Pay tax with confidence', mobile_heading_bn: 'কর পরিশোধ সহজ করুন', action_en: 'Pay Tax', action_bn: 'কর পরিশোধ' },
  { id: 'return', service_code: 'TAX_WITH_RETURN', heading_en: 'Tax with Return', heading_bn: 'রিটার্নের সঙ্গে কর', mobile_heading_en: 'Tax with Return', mobile_heading_bn: 'রিটার্নের সঙ্গে কর', action_en: 'Pay Tax with Return', action_bn: 'রিটার্নের সঙ্গে কর পরিশোধ' },
  { id: 'advance', service_code: 'ADVANCE_TAX', heading_en: 'Advance Income Tax', heading_bn: 'অগ্রিম আয়কর', mobile_heading_en: 'Advance Income Tax', mobile_heading_bn: 'অগ্রিম আয়কর', action_en: 'Pay Advance Income Tax', action_bn: 'অগ্রিম আয়কর পরিশোধ' },
  { id: 'withholding', service_code: 'SOURCE_TAX_DEPOSIT', heading_en: 'Source Tax Deposit (TDS/TCS)', heading_bn: 'উৎসে কর জমা (টিডিএস/টিসিএস)', mobile_heading_en: 'Source Tax (TDS/TCS)', mobile_heading_bn: 'উৎসে কর জমা', action_en: 'Deposit Source Tax', action_bn: 'উৎসে কর জমা দিন' },
  { id: 'travel', service_code: 'TRAVEL_TAX', heading_en: 'Travel Tax', heading_bn: 'ভ্রমণ কর', mobile_heading_en: 'Travel Tax', mobile_heading_bn: 'ভ্রমণ কর', action_en: 'Pay Travel Tax', action_bn: 'ভ্রমণ কর পরিশোধ' },
] as const;

const intro = {
  description_en: 'Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.',
  description_bn: 'যে কর পরিশোধ করতে চান, সেই সেবাটি বেছে নিন। ধাপে ধাপে এগিয়ে পেমেন্টের তথ্য সংরক্ষণ করুন।',
  mobile_description_en: 'Choose, pay and keep your record.',
  mobile_description_bn: 'কর দিন, পেমেন্টের তথ্য রাখুন।',
};
export const publishedBannerRows = categories.map((row, sort_order) => ({
  ...row, sort_order, published: true,
  description_en: intro.description_en, description_bn: intro.description_bn,
  mobile_description_en: intro.mobile_description_en, mobile_description_bn: intro.mobile_description_bn,
  desktop_image_path: null, mobile_image_path: null,
}));

export async function mockPublishedBannerCms(page: Page): Promise<void> {
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(publishedBannerRows),
  }));
}
