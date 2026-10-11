export interface GlossaryTerm {
  termEn: string;
  termBn: string;
  acronym?: string;
  category: 'STATUTORY' | 'PROCEDURAL' | 'BANKING' | 'TAX_HEAD';
  definitionEn: string;
  definitionBn: string;
  actReference?: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    termEn: 'A-Challan (Automated Challan)',
    termBn: 'এ-চালান (স্বয়ংক্রিয় সরকারি চালান)',
    acronym: 'ACS',
    category: 'BANKING',
    definitionEn: 'The central Bangladesh Government electronic portal system for collecting all revenue and government fees directly into the Treasury Account at Bangladesh Bank.',
    definitionBn: 'বাংলাদেশ সরকারের রাজস্ব ও ফি সরাসরি বাংলাদেশ ব্যাংকের ট্রেজারি হিসাবে জমা করার কেন্দ্রীয় ইলেকট্রনিক ব্যবস্থা।',
    actReference: 'Bangladesh Treasury Rules'
  },
  {
    termEn: 'Taxpayer Identification Number',
    termBn: 'কর শনাক্তকরণ নম্বর',
    acronym: 'e-TIN',
    category: 'STATUTORY',
    definitionEn: 'Unique 12-digit numeric identifier issued by the National Board of Revenue to every registered taxpayer in Bangladesh.',
    definitionBn: 'জাতীয় রাজস্ব বোর্ড (এনবিআর) কর্তৃক নিবন্ধিত প্রতিটি করদাতাকে প্রদত্ত অনন্য ১২ সংখ্যার পরিচিতি নম্বর।',
    actReference: 'Section 261, Income Tax Act 2023'
  },
  {
    termEn: 'Assessment Year',
    termBn: 'করবর্ষ',
    acronym: 'AY',
    category: 'STATUTORY',
    definitionEn: 'The period of twelve months commencing on the first day of July every year, in which income of the previous income year is taxed.',
    definitionBn: 'প্রতি বছরের ১লা জুলাই হতে শুরু হওয়া ১২ মাসের সময়কাল, যে সময়ে পূর্ববর্তী আয়বর্ষের অর্জিত আয়ের ওপর কর ধার্য করা হয়।',
    actReference: 'Section 2(9), Income Tax Act 2023'
  },
  {
    termEn: 'Tax Deducted at Source',
    termBn: 'উৎসে কর কর্তন',
    acronym: 'TDS',
    category: 'STATUTORY',
    definitionEn: 'Tax withheld by a designated deducting entity (employer, bank, government agency, contractor payer) at the moment of disbursing payment.',
    definitionBn: 'অর্থ পরিশোধকারী কর্তৃপক্ষ কর্তৃক সেবাগ্রহীতা, কর্মচারী বা ঠিকাদারকে অর্থ প্রদানের সময় সংবিধিবদ্ধ হারে কর কেটে রাখা।',
    actReference: 'Chapter VII, Income Tax Act 2023'
  },
  {
    termEn: 'Tax Collected at Source',
    termBn: 'উৎসে কর সংগ্রহ',
    acronym: 'TCS',
    category: 'STATUTORY',
    definitionEn: 'Tax collected by designated authorities at the stage of commercial import, auction, real estate deed registration, or motor vehicle renewal.',
    definitionBn: 'আমদানি, নিলাম, জমি রেজিস্ট্রেশন বা মোটরযান নবায়ন পর্যায়ে সংবিধিবদ্ধ কর্তৃপক্ষ কর্তৃক সংগৃহীত কর।',
    actReference: 'Section 90, 118, 120, Income Tax Act 2023'
  },
  {
    termEn: 'Tax with Return',
    termBn: 'রিটার্নের সাথে কর',
    category: 'PROCEDURAL',
    definitionEn: 'Self-assessed tax payable by the taxpayer under Section 173 prior to or simultaneously with submitting the annual return of income.',
    definitionBn: 'বার্ষিক আয়কর রিটার্ন দাখিলের পূর্বে বা দাখিলের সাথে করদাতা কর্তৃক স্ব-নির্ধারিত হিসাব অনুযায়ী প্রদেয় নিট কর।',
    actReference: 'Section 173, Income Tax Act 2023'
  },
  {
    termEn: 'Advance Tax',
    termBn: 'অগ্রিম কর',
    category: 'PROCEDURAL',
    definitionEn: 'Income tax payable in four quarterly installments (September, December, March, June) during the income year if the taxpayer\'s latest assessed income exceeds statutory limits.',
    definitionBn: 'আয়বর্ষ চলাকালীন ৪টি ত্রৈমাসিক কিস্তিতে (সেপ্টেম্বর, ডিসেম্বর, মার্চ ও জুন) প্রদেয় আনুমানিক কর।',
    actReference: 'Section 154, Income Tax Act 2023'
  },
  {
    termEn: 'Demand Notice',
    termBn: 'দাবি নোটিশ',
    category: 'STATUTORY',
    definitionEn: 'Formal statutory notice served by the tax circle specifying assessed tax liability, penalty, or interest payable within a specified timeframe (normally 30 days).',
    definitionBn: 'কর সার্কেল কর্তৃক জারি করা বিধিবদ্ধ নোটিশ যাতে নির্ধারিত কর দাবি, জরিমানা বা সুদ নির্দিষ্ট সময়ের মধ্যে পরিশোধের নির্দেশ থাকে।',
    actReference: 'Section 214, Income Tax Act 2023'
  },
  {
    termEn: 'Tax Credit',
    termBn: 'কর রেয়াত / কর জমা',
    category: 'STATUTORY',
    definitionEn: 'Recognized financial credit officially booked in the taxpayer\'s ledger resulting from advance tax, TDS, or direct Treasury payment that offsets tax liability.',
    definitionBn: 'অগ্রিম কর, উৎসে কর্তিত কর বা সরাসরি ট্রেজারি জমার মাধ্যমে করদাতার লেজারে আনুষ্ঠানিকভাবে অর্জিত ক্রেডিট যা কর দায় হ্রাস করে।',
    actReference: 'Section 173, Income Tax Act 2023'
  },
  {
    termEn: 'Maker-Reviewer-Approver',
    termBn: 'মেকার-রিভিউয়ার-অ্যাপ্রুভার',
    acronym: 'MRA',
    category: 'PROCEDURAL',
    definitionEn: 'Three-stage administrative segregation of duties workflow required to amend, reverse, or transfer tax payment ledger credits.',
    definitionBn: 'ট্যাক্স পেমেন্ট লেজার সংশোধন বা হস্তান্তরের ক্ষেত্রে ৩ স্তরের প্রশাসনিক যাচাই ও অনুমোদন কাঠামো।',
    actReference: 'NBR Administrative Manual'
  },
  {
    termEn: 'Travel Tax',
    termBn: 'ভ্রমণ কর',
    category: 'TAX_HEAD',
    definitionEn: 'Statutory government tax payable by departing passengers traveling outside Bangladesh by air, land, or sea.',
    definitionBn: 'আকাশপথ, স্থলপথ বা সমুদ্রপথে বাংলাদেশ হতে বিদেশ গমনকারী যাত্রীদের জন্য প্রদেয় সরকারি ভ্রমণ কর।',
    actReference: 'Travel Tax Act 2003'
  },
  {
    termEn: 'Alternative Dispute Resolution',
    termBn: 'বিকল্প বিরোধ নিষ্পত্তি',
    acronym: 'ADR',
    category: 'PROCEDURAL',
    definitionEn: 'Consensual statutory framework allowing taxpayers and the NBR to resolve assessment disputes amicably with the assistance of a certified facilitator.',
    definitionBn: 'করদাতা ও এনবিআরের মধ্যকার কর বিরোধ সমঝোতার মাধ্যমে নিষ্পত্তির বিধিবদ্ধ কাঠামো।',
    actReference: 'Section 315-321, Income Tax Act 2023'
  }
];
