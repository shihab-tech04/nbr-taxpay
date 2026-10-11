import { Language } from '../types/tax';

export const UI_STRINGS: Record<Language, Record<string, string>> = {
  en: {
    // Brand & Header
    portalTitle: 'TaxPay',
    portalSubtitle: 'Independent Tax Payment Workspace',
    govBadge: 'Government of the People\'s Republic of Bangladesh',
    
    // Navigation
    navPublicHome: 'Home',
    navGuestPay: 'Guest Pay',
    navWithholding: 'Withholding Deposit',
    navTravelTax: 'Travel Tax',
    navVerifyReceipt: 'Verify Receipt',
    navReportIncident: 'Report Incident',
    navArchitecture: 'Architecture & Model',
    navOntology: 'Tax Ontology',
    navGlossary: 'Glossary',
    navGuidance: 'Assistant & FAQ',
    navTaxpayerPortal: 'Taxpayer Portal',
    navOfficerWorkspace: 'Officer Workspace',
    navParityRegister: 'v11 Route Parity Register',
    
    // Actions & Buttons
    btnPayNow: 'Initiate Tax Payment',
    btnContinue: 'Continue to Review',
    btnBack: 'Back',
    btnSubmitPayment: 'Confirm & Pay via Gateway',
    btnPrintReceipt: 'Print A-Challan Receipt',
    btnDownloadPdf: 'Download PDF',
    btnVerifyNow: 'Verify Challan Status',
    btnNewPayment: 'New Payment',
    btnSwitchRole: 'Simulate User Role',
    btnViewDetails: 'View Details',
    btnSearch: 'Search Records',
    btnFilter: 'Filter',
    btnReset: 'Reset',
    btnApprove: 'Approve & Sanction',
    btnReject: 'Reject Request',
    btnEndorse: 'Endorse to Approver',
    
    // Roles
    roleGuest: 'Public Guest (No login required)',
    roleTaxpayerInd: 'Taxpayer: Md. Tariqul Islam (Individual)',
    roleTaxpayerCorp: 'Taxpayer: Bengal Tech Ltd. (Corporate)',
    roleWithholdingAgent: 'Withholding Agent: Padma Bridge Railway Corp',
    roleOfficerMaker: 'Revenue Officer (Maker - ACT Circle 164)',
    roleOfficerReviewer: 'Inspecting Officer (Reviewer - JCT Range 03)',
    roleOfficerApprover: 'Commissioner of Taxes (Approver - Zone 08)',
    roleAdmin: 'System Admin / LTU Directorate',

    // Financial Boundaries
    warningSeparation: 'LEGAL BOUNDARY: A payment initiation is not a Treasury deposit. A Treasury receipt is not an approved taxpayer tax credit. Withholding deposits do not create agent tax credit.',
    unverifiedNotice: 'Master Catalogue & illustrative calculations are marked: SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED.',

    // Common labels
    tin: 'Taxpayer Identification Number (e-TIN)',
    nid: 'National ID Number (NID)',
    assessmentYear: 'Assessment Year (AY)',
    taxZone: 'Taxes Zone',
    taxCircle: 'Taxes Circle',
    challanNo: 'A-Challan Number',
    tokenNo: 'Token Number',
    amount: 'Total Amount',
    date: 'Date & Time',
    status: 'Status',
    category: 'Payment Category',
    auditDemoTitle: 'Demonstration Audit Log',
    auditDemoStatus: 'Demo only',
    auditDemoDetail: 'Illustrative in-memory entries; persistence, cryptographic verification, and tamper resistance are not established.',
    headCode: 'Economic Head Code'
  },
  bn: {
    // Brand & Header
    portalTitle: 'TaxPay — ট্যাক্সপে',
    portalSubtitle: 'স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস',
    govBadge: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
    
    // Navigation
    navPublicHome: 'মূল পাতা',
    navGuestPay: 'অতিথি পেমেন্ট',
    navWithholding: 'উৎসে কর জমা',
    navTravelTax: 'ভ্রমণ কর',
    navVerifyReceipt: 'রসিদ যাচাই',
    navReportIncident: 'অভিযোগ দায়ের',
    navArchitecture: 'আর্কিটেকচার ও মডেল',
    navOntology: 'কর তত্ত্ব কাঠামো',
    navGlossary: 'পরিভাষা',
    navGuidance: 'সহায়িকা ও প্রশ্নোত্তর',
    navTaxpayerPortal: 'করদাতা পোর্টাল',
    navOfficerWorkspace: 'কর্মকর্তা ওয়ার্কস্পেস',
    navParityRegister: 'v11 রুট প্যারিটি রেজিস্টার',
    
    // Actions & Buttons
    btnPayNow: 'কর প্রদান শুরু করুন',
    btnContinue: 'পর্যালোচনায় যান',
    btnBack: 'পূর্ববর্তী ধাপ',
    btnSubmitPayment: 'নিশ্চিত করুন ও গেটওয়েতে পরিশোধ করুন',
    btnPrintReceipt: 'এ-চালান রসিদ প্রিন্ট করুন',
    btnDownloadPdf: 'পিডিএফ ডাউনলোড',
    btnVerifyNow: 'চালান স্থিতি যাচাই করুন',
    btnNewPayment: 'নতুন কর পরিশোধ',
    btnSwitchRole: 'ইউজার রোল পরিবর্তন করুন',
    btnViewDetails: 'বিস্তারিত দেখুন',
    btnSearch: 'অনুসন্ধান করুন',
    btnFilter: 'ফিল্টার',
    btnReset: 'রিসেট',
    btnApprove: 'অনুমোদন ও মঞ্জুর করুন',
    btnReject: 'আবেদন প্রত্যাখ্যান করুন',
    btnEndorse: 'অনুমোদনের জন্য সুপারিশ করুন',
    
    // Roles
    roleGuest: 'পাবলিক অতিথি (লগইন প্রয়োজন নেই)',
    roleTaxpayerInd: 'করদাতা: মোঃ তারিকুল ইসলাম (ব্যক্তি)',
    roleTaxpayerCorp: 'করদাতা: বেঙ্গল টেক লিমিটেড (কোম্পানি)',
    roleWithholdingAgent: 'উৎসে কর্তনকারী: পদ্মা সেতু রেলওয়ে কর্পোরেশন',
    roleOfficerMaker: 'রাজস্ব কর্মকর্তা (মেকার - সহকারী কর কমিশনার)',
    roleOfficerReviewer: 'পরিদর্শক কর্মকর্তা (রিভিউয়ার - যুগ্ম কর কমিশনার)',
    roleOfficerApprover: 'কর কমিশনার (অ্যাপ্রুভার - কর অঞ্চল-০৮)',
    roleAdmin: 'সিস্টেম অ্যাডমিন / এলটিইউ পরিদপ্তর',

    // Financial Boundaries
    warningSeparation: 'আইনি সীমানা: পেমেন্ট প্রক্রিয়া শুরু করা মানেই ট্রেজারি জমা নয়। ট্রেজারি রসিদ স্বয়ংক্রিয়ভাবে কর রেয়াত তৈরি করে না। উৎসে কর কর্তনকারীর নিজস্ব কর ক্রেডিট হিসেবে গণ্য হবে না।',
    unverifiedNotice: 'মাস্টার তালিকা ও উদাহরণমূলক গণনা: ইনপুটে অনুপস্থিত / আইনি বৈধতা অযাচাইকৃত।',

    // Common labels
    tin: 'কর শনাক্তকরণ নম্বর (ই-টিআইএন)',
    nid: 'জাতীয় পরিচয়পত্র নম্বর (এনআইডি)',
    assessmentYear: 'করবর্ষ',
    taxZone: 'কর অঞ্চল',
    taxCircle: 'কর সার্কেল',
    challanNo: 'এ-চালান নম্বর',
    tokenNo: 'টোকেন নম্বর',
    amount: 'মোট পরিমাণ',
    date: 'তারিখ ও সময়',
    status: 'স্থিতি',
    category: 'প্রদেয় করের শ্রেণি',
    auditDemoTitle: 'নমুনা নিরীক্ষা লগ',
    auditDemoStatus: 'শুধু প্রদর্শনী',
    auditDemoDetail: 'মেমোরিতে রাখা উদাহরণমূলক এন্ট্রি; স্থায়ী সংরক্ষণ, ক্রিপ্টোগ্রাফিক যাচাই বা পরিবর্তন-প্রতিরোধ প্রতিষ্ঠিত নয়।',
    headCode: 'অর্থনৈতিক কোড'
  }
};
