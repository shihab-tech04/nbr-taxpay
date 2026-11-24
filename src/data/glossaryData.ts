export interface GlossaryTerm {
  termEn: string;
  termBn: string;
  acronym?: string;
  category: 'IDENTITY' | 'TAX' | 'PAYMENT' | 'RECORD' | 'PROCESS';
  definitionEn: string;
  definitionBn: string;
}

/** Plain-language descriptions of terms used in the payment journeys.
 * They explain the interface and do not replace current NBR instructions. */
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    termEn: 'A-Challan',
    termBn: 'এ-চালান',
    category: 'RECORD',
    definitionEn: 'A government payment document or reference. Use the relevant official service to confirm whether it was paid or credited.',
    definitionBn: 'সরকারি পেমেন্টের একটি দলিল বা রেফারেন্স। অর্থ জমা বা ক্রেডিট হয়েছে কি না সংশ্লিষ্ট সরকারি সেবায় যাচাই করুন।'
  },
  {
    termEn: 'Taxpayer Identification Number',
    termBn: 'করদাতা শনাক্তকরণ নম্বর',
    acronym: 'e-TIN',
    category: 'IDENTITY',
    definitionEn: 'A number used to identify a taxpayer in NBR services. Enter the number belonging to the person whose tax is being paid.',
    definitionBn: 'এনবিআর সেবায় করদাতাকে শনাক্ত করার নম্বর। যার কর দেওয়া হচ্ছে, তাঁর নম্বর লিখুন।'
  },
  {
    termEn: 'Assessment Year',
    termBn: 'করবর্ষ',
    acronym: 'AY',
    category: 'TAX',
    definitionEn: 'The year label attached to a return, notice or payment. Follow the year shown in the relevant official record.',
    definitionBn: 'রিটার্ন, নোটিশ বা পেমেন্টের সঙ্গে থাকা করবর্ষের নাম। সংশ্লিষ্ট সরকারি রেকর্ডে দেখানো বছর অনুসরণ করুন।'
  },
  {
    termEn: 'Tax Deducted at Source',
    termBn: 'উৎসে কর কর্তন',
    acronym: 'TDS',
    category: 'TAX',
    definitionEn: 'Tax withheld from a payment by the payer where applicable. Check official records to see how it is treated for a taxpayer.',
    definitionBn: 'প্রযোজ্য ক্ষেত্রে অর্থ দেওয়ার সময় পরিশোধকারীর কেটে রাখা কর। করদাতার হিসাবে এর ব্যবহার সরকারি রেকর্ডে যাচাই করুন।'
  },
  {
    termEn: 'Tax Collected at Source',
    termBn: 'উৎসে কর সংগ্রহ',
    acronym: 'TCS',
    category: 'TAX',
    definitionEn: 'Tax collected by an authorized party where applicable. Check current NBR guidance for the rules that apply to you.',
    definitionBn: 'প্রযোজ্য ক্ষেত্রে অনুমোদিত পক্ষের সংগ্রহ করা কর। আপনার ক্ষেত্রে কোন নিয়ম প্রযোজ্য তা বর্তমান এনবিআর নির্দেশনায় যাচাই করুন।'
  },
  {
    termEn: 'Tax with Return',
    termBn: 'রিটার্নের সঙ্গে কর',
    category: 'PAYMENT',
    definitionEn: 'A payment category in this service. Selecting it here does not file or submit an income tax return.',
    definitionBn: 'এই সেবার একটি পেমেন্ট শ্রেণি। এখানে এটি বেছে নিলে আয়কর রিটার্ন দাখিল হয় না।'
  },
  {
    termEn: 'Advance Tax',
    termBn: 'অগ্রিম কর',
    category: 'PAYMENT',
    definitionEn: 'A tax payment made before a final assessment when applicable. Check NBR guidance for eligibility and amount.',
    definitionBn: 'প্রযোজ্য ক্ষেত্রে চূড়ান্ত নির্ধারণের আগে দেওয়া কর। যোগ্যতা ও পরিমাণ এনবিআরের নির্দেশনায় যাচাই করুন।'
  },
  {
    termEn: 'Demand Notice',
    termBn: 'কর দাবি নোটিশ',
    category: 'TAX',
    definitionEn: 'A notice from the tax authority that states an amount to pay. Use the notice and current official instructions to confirm the details.',
    definitionBn: 'কর কর্তৃপক্ষের দেওয়া অর্থ পরিশোধের নোটিশ। বিবরণ যাচাই করতে নোটিশ ও বর্তমান সরকারি নির্দেশনা অনুসরণ করুন।'
  },
  {
    termEn: 'Tax Credit',
    termBn: 'কর ক্রেডিট',
    category: 'TAX',
    definitionEn: 'An amount recognized in an official tax record and applied against tax due. A payment receipt alone does not prove that a credit was recorded.',
    definitionBn: 'সরকারি কর রেকর্ডে স্বীকৃত এবং করের সঙ্গে সমন্বিত অর্থ। শুধু পেমেন্টের রসিদে কর ক্রেডিট রেকর্ড হয়েছে প্রমাণ হয় না।'
  },
  {
    termEn: 'Maker-Reviewer-Approver',
    termBn: 'প্রস্তুতকারী-পর্যালোচক-অনুমোদনকারী',
    acronym: 'MRA',
    category: 'PROCESS',
    definitionEn: 'A workflow where one person prepares an item, another reviews it, and an authorized person makes the approval decision.',
    definitionBn: 'এমন একটি প্রক্রিয়া যেখানে একজন তথ্য প্রস্তুত করেন, আরেকজন পর্যালোচনা করেন এবং অনুমোদিত ব্যক্তি সিদ্ধান্ত দেন।'
  },
  {
    termEn: 'Travel Tax',
    termBn: 'ভ্রমণ কর',
    category: 'PAYMENT',
    definitionEn: 'A payment service for travel tax when it applies to a passenger’s journey. Check NBR publications for current requirements and rates.',
    definitionBn: 'যাত্রীর ভ্রমণে প্রযোজ্য হলে ভ্রমণ কর দেওয়ার সেবা। বর্তমান শর্ত ও হার এনবিআরের প্রকাশনায় যাচাই করুন।'
  },
  {
    termEn: 'Alternative Dispute Resolution',
    termBn: 'বিকল্প বিরোধ নিষ্পত্তি',
    acronym: 'ADR',
    category: 'PROCESS',
    definitionEn: 'A way to address a tax dispute with help from an authorized facilitator. Check NBR guidance for the available process.',
    definitionBn: 'অনুমোদিত সহায়তাকারীর মাধ্যমে কর বিরোধ সমাধানের একটি পদ্ধতি। প্রযোজ্য প্রক্রিয়া এনবিআরের নির্দেশনায় যাচাই করুন।'
  },
  {
    termEn: 'Payment Head',
    termBn: 'পেমেন্ট খাত',
    category: 'PAYMENT',
    definitionEn: 'The category or description that identifies what a payment is for. Match it to the relevant official instruction or notice.',
    definitionBn: 'কোন উদ্দেশ্যে পেমেন্ট করা হচ্ছে তা বোঝানোর শ্রেণি বা বিবরণ। সংশ্লিষ্ট সরকারি নির্দেশনা বা নোটিশের সঙ্গে মিলিয়ে নিন।'
  },
  {
    termEn: 'Source Tax Deposit',
    termBn: 'উৎসে কর জমা',
    category: 'PAYMENT',
    definitionEn: 'A payment flow for depositing tax withheld or collected at source. Any taxpayer allocation must be checked against verified official records.',
    definitionBn: 'উৎসে কর্তন বা সংগ্রহ করা কর জমা দেওয়ার পেমেন্ট ধাপ। করদাতার নামে বরাদ্দ যাচাইকৃত সরকারি রেকর্ডে মিলিয়ে নিন।'
  },
  {
    termEn: 'Payment Reference',
    termBn: 'পেমেন্ট রেফারেন্স',
    category: 'RECORD',
    definitionEn: 'A number or code used to find a payment record. Enter the reference exactly as it appears on the source document.',
    definitionBn: 'পেমেন্ট রেকর্ড খুঁজতে ব্যবহৃত নম্বর বা কোড। উৎস নথিতে যেমন আছে, ঠিক তেমনভাবে লিখুন।'
  },
  {
    termEn: 'Payment Receipt',
    termBn: 'পেমেন্ট রসিদ',
    category: 'RECORD',
    definitionEn: 'A record that summarizes a payment and its displayed status. For actual settlement or tax credit, check the relevant official record.',
    definitionBn: 'পেমেন্ট ও প্রদর্শিত অবস্থা সংক্ষেপে দেখানো রেকর্ড। প্রকৃত অর্থ জমা বা কর ক্রেডিটের জন্য সংশ্লিষ্ট সরকারি রেকর্ড যাচাই করুন।'
  },
  {
    termEn: 'Payment Status',
    termBn: 'পেমেন্টের অবস্থা',
    category: 'RECORD',
    definitionEn: 'The current state shown for a payment record, such as pending or completed. A sample or example status is not proof of settlement.',
    definitionBn: 'পেমেন্ট রেকর্ডের বর্তমান অবস্থা, যেমন অপেক্ষমাণ বা সম্পন্ন। নমুনা বা উদাহরণ অবস্থা অর্থ জমার প্রমাণ নয়।'
  },
  {
    termEn: 'Example Payment Record',
    termBn: 'উদাহরণ পেমেন্ট রেকর্ড',
    category: 'RECORD',
    definitionEn: 'A sample used to explain the service. It is not a real payment, Treasury settlement, or official tax-credit entry.',
    definitionBn: 'সেবা বোঝাতে ব্যবহৃত নমুনা। এটি প্রকৃত পেমেন্ট, ট্রেজারিতে অর্থ জমা বা সরকারি কর-ক্রেডিট এন্ট্রি নয়।'
  }
];
