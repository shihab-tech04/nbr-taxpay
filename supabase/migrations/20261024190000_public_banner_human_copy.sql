-- Editorial copy only: no tax liability, payment, service routing, or legal rule changes.
-- Controlled release overlay; refuses to replace divergent Office CMS edits.
DO $taxpay_banner_copy$
DECLARE
  updated_count integer;
BEGIN
  WITH replacement(id, expected_en, description_en, description_bn, mobile_description_en, mobile_description_bn) AS (
    VALUES
    ('intro', 'Unsure what tax to pay or where your receipt went? Choose the right service, follow clear steps, and find payment records in one place.', 'Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.', 'যে কর পরিশোধ করতে চান, সেই সেবাটি বেছে নিন। ধাপে ধাপে এগিয়ে পেমেন্টের তথ্য সংরক্ষণ করুন।', 'Choose, pay and keep your record.', 'কর দিন, পেমেন্টের তথ্য রাখুন।'),
    ('return', 'Settle the income tax linked to your return through clear, guided steps.', 'Filing an income tax return and still have tax to pay? Make that payment here and keep its reference with your return.', 'রিটার্ন জমা দেওয়ার সময় কর পরিশোধ বাকি আছে? এখান থেকে সেই কর দিন এবং পেমেন্টের তথ্য রিটার্নের সঙ্গে রাখুন।', 'Pay tax due with your return.', 'রিটার্নের বাকি কর দিন।'),
    ('advance', 'Plan ahead by paying income tax early for your chosen assessment year.', 'Making an advance income tax payment? Select the assessment year, enter the amount and review the details before paying.', 'অগ্রিম আয়কর দিতে চান? করবর্ষ ও টাকার পরিমাণ নির্বাচন করে পরিশোধের আগে তথ্য মিলিয়ে নিন।', 'Pay ahead for your tax year.', 'করবর্ষ বেছে অগ্রিম কর দিন।'),
    ('withholding', 'Deposit tax already deducted or collected at source using the right payment head.', 'Deducted tax from a salary or supplier bill, or collected tax on a transaction? Deposit that tax under the applicable payment category.', 'বেতন বা সরবরাহকারীর বিল থেকে কর কেটেছেন, কিংবা কোনো লেনদেনে কর আদায় করেছেন? প্রযোজ্য খাতে সেই কর জমা দিন।', 'Deposit tax deducted at source.', 'উৎসে কাটা বা আদায় করা কর দিন।'),
    ('travel', 'Choose your journey, add passenger details and move through travel tax with confidence.', 'Travelling abroad? Choose the journey details and enter passenger information to check and pay the applicable travel tax.', 'বিদেশ ভ্রমণ করছেন? ভ্রমণ ও যাত্রীর তথ্য দিয়ে প্রযোজ্য ভ্রমণ কর যাচাই করে পরিশোধ করুন।', 'Check travel tax before departure.', 'ভ্রমণের কর যাচাই ও পরিশোধ করুন।')
  )
  UPDATE public.taxpay_site_banners AS b
  SET description_en = r.description_en,
      description_bn = r.description_bn,
      mobile_description_en = r.mobile_description_en,
      mobile_description_bn = r.mobile_description_bn
  FROM replacement AS r
  WHERE b.id = r.id AND b.description_en = r.expected_en;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 5 THEN
    RAISE EXCEPTION 'TaxPay CMS copy release refused: expected 5 unchanged baseline banners, updated %', updated_count;
  END IF;
END
$taxpay_banner_copy$;
