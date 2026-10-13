import React from 'react';
import { ArrowRight, BookOpen, Building2, CalendarDays, CircleHelp, ClipboardCheck, FileCheck2, Landmark, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';

const OFFICE_LOGIN = 'https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions';

export const PublicLanding: React.FC = () => {
  const { language } = useTaxState();
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const topics = [
    { Icon: FileCheck2, title: t('Tax with return', 'রিটার্নের সঙ্গে কর'), copy: t('Learn about payments made when preparing an income tax return and the information needed for review.', 'আয়কর রিটার্ন তৈরির সময় কর পরিশোধ এবং যাচাইয়ের জন্য প্রয়োজনীয় তথ্য জানুন।') },
    { Icon: CalendarDays, title: t('Advance income tax', 'অগ্রিম আয়কর'), copy: t('Understand the purpose of advance payments, the assessment year and payment references.', 'অগ্রিম কর পরিশোধের উদ্দেশ্য, করবর্ষ ও পেমেন্ট রেফারেন্স সম্পর্কে জানুন।') },
    { Icon: Building2, title: t('Withholding tax', 'উৎসে কর'), copy: t('Explore deductions, collections and deposits, and why payer and taxpayer identities matter.', 'উৎসে কর কর্তন, সংগ্রহ ও জমা এবং পরিশোধকারী ও করদাতার পরিচয়ের গুরুত্ব জানুন।') },
    { Icon: WalletCards, title: t('Other tax payments', 'অন্যান্য কর পরিশোধ'), copy: t('Find guidance on choosing an appropriate purpose and reviewing payment details.', 'সঠিক পরিশোধের উদ্দেশ্য নির্বাচন ও পেমেন্ট তথ্য যাচাইয়ের নির্দেশনা জানুন।') }
  ];
  const guides = [
    { title: t('Prepare your payment details', 'পরিশোধের তথ্য প্রস্তুত করুন'), description: t('Check the taxpayer identity, assessment year, payment purpose and any supporting reference before proceeding.', 'পরবর্তী ধাপের আগে করদাতার পরিচয়, করবর্ষ, পরিশোধের উদ্দেশ্য ও প্রয়োজনীয় রেফারেন্স যাচাই করুন।') },
    { title: t('Understand your payment status', 'পেমেন্টের অবস্থা বুঝুন'), description: t('A payment instruction, gateway response, Treasury settlement and recognized tax credit are separate events.', 'পেমেন্ট নির্দেশনা, গেটওয়ের সাড়া, ট্রেজারি জমা ও স্বীকৃত কর ক্রেডিট আলাদা ধাপ।') },
    { title: t('Records, receipts and corrections', 'রেকর্ড, রসিদ ও সংশোধন'), description: t('Keep transaction references and review a mismatch through the appropriate authorized channel.', 'লেনদেনের রেফারেন্স সংরক্ষণ করুন এবং অমিল হলে উপযুক্ত অনুমোদিত মাধ্যমে যাচাই করুন।') }
  ];
  const questions = [
    { q: t('What information should I check before making a payment?', 'কর পরিশোধের আগে কী তথ্য যাচাই করব?'), a: t('Confirm the relevant taxpayer, payment purpose, applicable year and amount from an authoritative source. Do not rely on an unverified code or rate.', 'সংশ্লিষ্ট করদাতা, পরিশোধের উদ্দেশ্য, প্রযোজ্য করবর্ষ এবং প্রামাণ্য উৎস থেকে পরিমাণ যাচাই করুন। অযাচাইকৃত কোড বা হারের ওপর নির্ভর করবেন না।') },
    { q: t('Does a receipt automatically prove a tax credit?', 'রসিদ থাকলেই কি কর ক্রেডিট পাওয়া যায়?'), a: t('No. Payment evidence and a tax credit are different. A credit depends on the applicable law, taxpayer ownership and verified reconciliation.', 'না। পেমেন্টের প্রমাণ ও কর ক্রেডিট আলাদা বিষয়। ক্রেডিট নির্ভর করে প্রযোজ্য আইন, করদাতার মালিকানা ও যাচাইকৃত সমন্বয়ের ওপর।') },
    { q: t('Where can I manage my own transactions?', 'নিজের লেনদেন কোথায় পরিচালনা করব?'), a: t('Choose Login to enter the account access page. Personal transaction tools belong in the taxpayer workspace.', 'অ্যাকাউন্টে প্রবেশের জন্য লগইন বেছে নিন। ব্যক্তিগত লেনদেনের সুবিধা করদাতার ওয়ার্কস্পেসে পাওয়া যায়।') },
    { q: t('How can I find authoritative tax guidance?', 'প্রামাণ্য আয়কর নির্দেশনা কোথায় পাব?'), a: t('Consult current official NBR publications, applicable Acts, Rules and circulars. Check the relevant dates and amendments for your situation.', 'জাতীয় রাজস্ব বোর্ডের বর্তমান প্রকাশনা, প্রযোজ্য আইন, বিধিমালা ও পরিপত্র দেখুন। নিজের ক্ষেত্রে তারিখ ও সংশোধন যাচাই করুন।') }
  ];

  return <div className={`citizen-public-hub public-information-hub mx-auto max-w-5xl space-y-5 pb-12 ${bn ? 'font-bengali' : ''}`}>
    <section className="citizen-public-hero public-information-hero" aria-labelledby="public-home-title">
      <div className="citizen-public-hero__copy">
        <p className="citizen-public-hero__eyebrow"><Landmark size={16} aria-hidden="true" />{t('INCOME TAX PAYMENT INFORMATION', 'আয়কর পরিশোধের তথ্যসেবা')}</p>
        <h1 id="public-home-title">{t('Understand tax payments. Stay in control.', 'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।')}</h1>
        <p>{t('Explore income tax payment types, practical guidance and the steps behind payment records. Your personal transaction tools are available after login.', 'আয়কর পরিশোধের ধরন, প্রয়োজনীয় নির্দেশনা ও লেনদেনের ধাপ সম্পর্কে জানুন। লগইনের পর ব্যক্তিগত লেনদেন পরিচালনা করুন।')}</p>
        <div className="citizen-public-hero__actions">
          <a className="citizen-public-primary public-home-login" href={OFFICE_LOGIN}>{t('Login', 'লগইন')} <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      </div>
      <aside className="citizen-public-hero__panel public-information-guide" aria-labelledby="prepare-title">
        <p className="citizen-public-hero__panel-label">{t('BEFORE YOU PAY', 'কর পরিশোধের আগে')}</p>
        <h2 id="prepare-title">{t('Three details worth checking', 'তিনটি বিষয় যাচাই করুন')}</h2>
        <ol>
          <li><span>01</span><p>{t('Taxpayer identity and payment ownership', 'করদাতার পরিচয় ও পেমেন্টের মালিকানা')}</p></li>
          <li><span>02</span><p>{t('Payment category and applicable year', 'পেমেন্টের ধরন ও প্রযোজ্য করবর্ষ')}</p></li>
          <li><span>03</span><p>{t('Reference, evidence and record status', 'রেফারেন্স, প্রমাণ ও রেকর্ডের অবস্থা')}</p></li>
        </ol>
      </aside>
    </section>

    <section id="public-payment-types" className="citizen-hub-section public-info-section" aria-labelledby="payment-types-title">
      <div className="citizen-hub-section__heading"><div>
        <p className="citizen-hub-eyebrow">{t('PAYMENT INFORMATION', 'কর পরিশোধের তথ্য')}</p>
        <h2 id="payment-types-title">{t('Explore payment types', 'কর পরিশোধের ধরন জানুন')}</h2>
        <p>{t('A clear starting point for common income tax payment purposes.', 'আয়কর পরিশোধের পরিচিত উদ্দেশ্যগুলো সহজভাবে জানুন।')}</p>
      </div></div>
      <div className="public-info-topic-grid">
        {topics.map(({Icon,title,copy})=><article className="public-info-topic" key={title}>
          <span className="citizen-hub-service-grid__icon"><Icon size={20} aria-hidden="true" /></span>
          <h3>{title}</h3><p>{copy}</p>
        </article>)}
      </div>
    </section>

    <section id="public-how-it-works" className="citizen-hub-section citizen-hub-steps public-info-section" aria-labelledby="steps-title">
      <div className="citizen-hub-section__heading"><div>
        <p className="citizen-hub-eyebrow">{t('THE PROCESS', 'পরিশোধের প্রক্রিয়া')}</p>
        <h2 id="steps-title">{t('From information to transaction tracking', 'তথ্য থেকে লেনদেন অনুসরণ')}</h2>
        <p>{t('Understand the stages before using account-specific tools.', 'অ্যাকাউন্টের সুবিধা ব্যবহারের আগে প্রক্রিয়ার ধাপগুলো বুঝে নিন।')}</p>
      </div></div>
      <ol>
        <li><span>1</span><div><strong>{t('Read the guidance', 'নির্দেশনা পড়ুন')}</strong><p>{t('Find the relevant tax payment purpose.', 'প্রাসঙ্গিক কর পরিশোধের উদ্দেশ্য জেনে নিন।')}</p></div></li>
        <li><span>2</span><div><strong>{t('Access your account', 'অ্যাকাউন্টে প্রবেশ করুন')}</strong><p>{t('Open the personal transaction workspace.', 'ব্যক্তিগত লেনদেন ওয়ার্কস্পেসে প্রবেশ করুন।')}</p></div></li>
        <li><span>3</span><div><strong>{t('Review the evidence', 'প্রমাণ যাচাই করুন')}</strong><p>{t('Follow payment and record status separately.', 'পেমেন্ট ও রেকর্ডের অবস্থা আলাদাভাবে দেখুন।')}</p></div></li>
      </ol>
    </section>

    <section id="public-guides" className="citizen-hub-section public-info-section" aria-labelledby="knowledge-title">
      <div className="citizen-hub-section__heading"><div>
        <p className="citizen-hub-eyebrow">{t('KNOWLEDGE HUB', 'তথ্য ও নির্দেশনা')}</p>
        <h2 id="knowledge-title">{t('Guidance that helps you prepare', 'পরিশোধের প্রস্তুতির প্রয়োজনীয় নির্দেশনা')}</h2>
        <p>{t('Focused information on payment preparation, status and supporting records.', 'পেমেন্ট প্রস্তুতি, অবস্থা ও প্রমাণ সংক্রান্ত তথ্য।')}</p>
      </div></div>
      <div className="public-info-guides">
        {guides.map((g,i)=><article key={g.title}>
          {i === 0 ? <ClipboardCheck aria-hidden="true" /> : i === 1 ? <ShieldCheck aria-hidden="true" /> : <ReceiptText aria-hidden="true" />}
          <h3>{g.title}</h3><p>{g.description}</p>
        </article>)}
      </div>
      <div className="public-info-source"><BookOpen size={18} aria-hidden="true"/><p>{t('For controlling rates, deadlines and requirements, consult the applicable official publications.', 'প্রযোজ্য হার, সময়সীমা ও শর্ত জানতে সংশ্লিষ্ট সরকারি প্রকাশনা দেখুন।')} <a href="https://nbr.gov.bd/" target="_blank" rel="noopener noreferrer">{t('NBR publications', 'এনবিআর প্রকাশনা')}</a></p></div>
    </section>

    <section id="public-faq" className="citizen-hub-section public-info-section" aria-labelledby="faq-title">
      <div className="citizen-hub-section__heading"><div>
        <p className="citizen-hub-eyebrow">{t('HELP CENTER', 'সহায়তা কেন্দ্র')}</p>
        <h2 id="faq-title"><CircleHelp size={22} aria-hidden="true" /> {t('Frequently asked questions', 'সাধারণ জিজ্ঞাসা')}</h2>
      </div></div>
      <div className="public-info-faq">
        {questions.map(item=><details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
      </div>
    </section>
  </div>;
};
