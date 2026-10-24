-- TaxPay banner UX copy v2: current SQL CMS and static bundle must match.
-- Applies to the existing five records only; protects against concurrent CMS edits.
-- No service codes, published state, sort order, actions or images are modified.
DO $taxpay_banner_copy$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
  ('intro', NULL, 'Unsure what tax to pay or where your receipt went? Choose the right service, follow clear steps, and find payment records in one place.', 'Not sure which payment to make? Find the service you need, follow the steps and keep your payment record close at hand.', 'কোন কর কীভাবে পরিশোধ করবেন বুঝতে পারছেন না? প্রয়োজনীয় সেবা বেছে নিন, ধাপে ধাপে এগিয়ে যান এবং পেমেন্টের তথ্য খুঁজে নিন।', 'Pay tax and find your receipts.', 'কর দিন, পেমেন্টের তথ্য দেখুন।'),
  ('return', 'TAX_WITH_RETURN', 'Settle the income tax linked to your return through clear, guided steps.', 'Filing your income tax return and have tax to pay? Make that payment here and keep the details for your records.', 'রিটার্ন জমা দেওয়ার সময় কর পরিশোধ করতে হবে? এখান থেকে পেমেন্ট করুন এবং পরিশোধের তথ্য সংরক্ষণ করুন।', 'Pay the tax due with your return.', 'রিটার্নের বকেয়া কর দিন।'),
  ('advance', 'ADVANCE_TAX', 'Plan ahead by paying income tax early for your chosen assessment year.', 'Making an advance income tax payment? Select the assessment year, enter the amount and complete the payment.', 'অগ্রিম আয়কর দিতে চান? করবর্ষ নির্বাচন করুন, পরিমাণ লিখুন এবং পেমেন্ট সম্পন্ন করুন।', 'Pay tax ahead of your return.', 'অগ্রিম আয়কর পরিশোধ করুন।'),
  ('withholding', 'SOURCE_TAX_DEPOSIT', 'Deposit tax already deducted or collected at source using the right payment head.', 'Deducted tax from a salary or supplier bill, or collected tax on a transaction? Deposit it under the appropriate tax category.', 'বেতন বা সরবরাহকারীর বিল থেকে কর কেটেছেন, কিংবা লেনদেনে কর আদায় করেছেন? প্রযোজ্য খাতে সেই কর জমা দিন।', 'Deposit tax withheld or collected.', 'কাটা বা আদায়কৃত কর জমা দিন।'),
  ('travel', 'TRAVEL_TAX', 'Choose your journey, add passenger details and move through travel tax with confidence.', 'Preparing to travel abroad? Enter your journey and passenger details to continue with the applicable travel tax payment.', 'বিদেশ ভ্রমণের প্রস্তুতি নিচ্ছেন? ভ্রমণ ও যাত্রীর তথ্য দিয়ে প্রযোজ্য ভ্রমণ কর পরিশোধ করুন।', 'Pay tax before your journey.', 'ভ্রমণের আগে কর পরিশোধ করুন।')
    ) AS source(id, service_code, old_en, new_en, new_bn, new_mobile_en, new_mobile_bn)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.taxpay_site_banners b
      WHERE b.id = item.id AND b.service_code IS NOT DISTINCT FROM item.service_code
        AND b.published
    ) THEN
      RAISE EXCEPTION 'Banner identity/publication changed: %', item.id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.taxpay_site_banners b
      WHERE b.id=item.id AND b.description_en IS DISTINCT FROM item.old_en
        AND b.description_en IS DISTINCT FROM item.new_en
    ) THEN
      RAISE EXCEPTION 'CMS content conflict for banner %, refusing overwrite', item.id;
    END IF;
    UPDATE public.taxpay_site_banners b
    SET description_en=item.new_en,
        description_bn=item.new_bn,
        mobile_description_en=item.new_mobile_en,
        mobile_description_bn=item.new_mobile_bn
    WHERE b.id=item.id AND b.description_en=item.old_en;

    IF NOT EXISTS (
      SELECT 1 FROM public.taxpay_site_banners b
      WHERE b.id=item.id
        AND b.description_en=item.new_en
        AND b.description_bn=item.new_bn
        AND b.mobile_description_en=item.new_mobile_en
        AND b.mobile_description_bn=item.new_mobile_bn
    ) THEN
      RAISE EXCEPTION 'Banner copy read-back mismatch for %', item.id;
    END IF;
  END LOOP;
END;
$taxpay_banner_copy$;
