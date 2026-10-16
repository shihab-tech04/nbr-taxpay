import React, { useState } from 'react';
import { ArrowRight, BookOpen, Building2, CalendarDays, CircleHelp, ClipboardCheck, FileCheck2, ReceiptText, ShieldCheck, WalletCards, Plane } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import {PublicServiceModal, type PublicService} from './PublicServiceModal';
import { PublicHeroCarousel } from './PublicHeroCarousel';


export const PublicLanding: React.FC = () => {
  const { language, navigate, setPaymentServiceChoiceOpen, isPaymentServiceChoiceOpen } = useTaxState();
  const [openService,setOpenService] = useState<PublicService|null>(null);
  const openGuide=(category:string)=>navigate('user_guide',{category});
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const topics = [
    { tone: 'return', Icon: FileCheck2, title: t('Tax with return', 'রিটার্নের সঙ্গে কর'), copy: t('Payments submitted with a tax return.', 'রিটার্নের সঙ্গে কর পরিশোধের তথ্য।') },
    { tone: 'advance', Icon: CalendarDays, title: t('Advance income tax', 'অগ্রিম আয়কর'), copy: t('Advance payments by assessment year.', 'করবর্ষ অনুযায়ী অগ্রিম কর পরিশোধ।') },
    { tone: 'withholding', Icon: Building2, title: t('Withholding tax', 'উৎসে কর'), copy: t('Tax deducted or collected at source.', 'উৎসে কর কর্তন, সংগ্রহ ও জমা।') },
    { tone: 'other', Icon: WalletCards, title: t('Other tax payments', 'অন্যান্য কর পরিশোধ'), copy: t('Other income tax payment purposes.', 'অন্যান্য আয়কর পরিশোধের তথ্য।') }
  ];
  const guides = [
    { title: t('Prepare your payment details', 'পরিশোধের তথ্য প্রস্তুত করুন'), description: t('Check identity, tax year and payment purpose.', 'পরিচয়, করবর্ষ ও পরিশোধের উদ্দেশ্য যাচাই করুন।') },
    { title: t('Understand your payment status', 'পেমেন্টের অবস্থা বুঝুন'), description: t('Payment status and verified tax credit are different.', 'পেমেন্টের অবস্থা ও যাচাইকৃত কর ক্রেডিট এক নয়।') },
    { title: t('Records, receipts and corrections', 'রেকর্ড, রসিদ ও সংশোধন'), description: t('Keep references and report any mismatch.', 'রেফারেন্স রাখুন এবং অমিল হলে জানান।') }
  ];
  const questions = [
    { q: t('What information should I check before making a payment?', 'কর পরিশোধের আগে কী তথ্য যাচাই করব?'), a: t('Check taxpayer, purpose, tax year and amount against official guidance.', 'সরকারি নির্দেশনা অনুযায়ী করদাতা, উদ্দেশ্য, করবর্ষ ও পরিমাণ যাচাই করুন।') },
    { q: t('Does a receipt automatically prove a tax credit?', 'রসিদ থাকলেই কি কর ক্রেডিট পাওয়া যায়?'), a: t('No. Credit requires applicable law, ownership and verification.', 'না। আইন, মালিকানা ও যাচাই অনুযায়ী ক্রেডিট নির্ধারিত হয়।') },
    { q: t('Where can I manage my own transactions?', 'নিজের লেনদেন কোথায় পরিচালনা করব?'), a: t('Use Login to open your transaction workspace.', 'লগইন করে ব্যক্তিগত লেনদেন দেখুন।') },
    { q: t('How can I find authoritative tax guidance?', 'প্রামাণ্য আয়কর নির্দেশনা কোথায় পাব?'), a: t('See current NBR publications and applicable law.', 'বর্তমান এনবিআর প্রকাশনা ও প্রযোজ্য আইন দেখুন।') }
  ];

  return <div className={'citizen-public-hub public-information-hub mx-auto w-full max-w-[1296px] space-y-6 pb-12' + (bn ? ' font-bengali' : '')}>
    <PublicHeroCarousel
      language={language}
      onPayTax={() => setPaymentServiceChoiceOpen(true)}
      onCheckReceipt={() => setOpenService('status')}
      paused={isPaymentServiceChoiceOpen || openService !== null}
    />

    <section id="public-payment-types" className="citizen-hub-section public-info-section" aria-labelledby="payment-types-title">
      <div className="citizen-hub-section__heading"><div>

        <h2 id="payment-types-title">{t('Explore payment types', 'কর পরিশোধের ধরন জানুন')}</h2>
        <p>{t('Choose a payment category.', 'পেমেন্টের ধরন বেছে নিন।')}</p>
      </div><div className="public-info-section__links">
        <button type="button" className="public-more-link" onClick={()=>setOpenService('travel')}><Plane size={15} aria-hidden="true"/>{t('Pay travel tax','ভ্রমণ কর পরিশোধ')}</button>
        <button type="button" className="public-more-link" onClick={()=>openGuide('payments')}>{t('See more','আরও দেখুন')}<ArrowRight size={15}/></button>
      </div></div>
      <div className="public-info-topic-grid">
        {topics.map(({tone,Icon,title,copy})=><article className="public-info-topic" data-taxpay-service={tone} key={tone}>
          <span className="citizen-hub-service-grid__icon"><Icon size={20} aria-hidden="true" /></span>
          <h3>{title}</h3><p>{copy}</p>
        </article>)}
      </div>
    </section>

    <section id="public-how-it-works" className="citizen-hub-section citizen-hub-steps public-info-section" aria-labelledby="steps-title">
      <div className="citizen-hub-section__heading"><div>

        <h2 id="steps-title">{t('How it works', 'যেভাবে কাজ করে')}</h2>
        <p>{t('Three simple steps.', 'তিনটি সহজ ধাপ।')}</p>
      </div><button type="button" className="public-more-link" onClick={()=>openGuide('status')}>{t('See more','আরও দেখুন')}<ArrowRight size={15}/></button></div>
      <ol>
        <li><span>1</span><div><strong>{t('Read the guidance', 'নির্দেশনা পড়ুন')}</strong><p>{t('Choose a payment purpose.', 'পেমেন্টের উদ্দেশ্য বাছুন।')}</p></div></li>
        <li><span>2</span><div><strong>{t('Access your account', 'অ্যাকাউন্টে প্রবেশ করুন')}</strong><p>{t('View your transactions.', 'নিজের লেনদেন দেখুন।')}</p></div></li>
        <li><span>3</span><div><strong>{t('Review the evidence', 'প্রমাণ যাচাই করুন')}</strong><p>{t('Check the payment status.', 'পেমেন্টের অবস্থা দেখুন।')}</p></div></li>
      </ol>
    </section>

    <section id="public-guides" className="citizen-hub-section public-info-section" aria-labelledby="knowledge-title">
      <div className="citizen-hub-section__heading"><div>

        <h2 id="knowledge-title">{t('Payment guidance', 'পেমেন্ট নির্দেশনা')}</h2>
        <p>{t('Prepare, check and keep records.', 'প্রস্তুতি, যাচাই ও রেকর্ড।')}</p>
      </div><button type="button" className="public-more-link" onClick={()=>openGuide('records')}>{t('See more','আরও দেখুন')}<ArrowRight size={15}/></button></div>
      <div className="public-info-guides">
        {guides.map((g,i)=><article key={g.title}>
          {i === 0 ? <ClipboardCheck aria-hidden="true" /> : i === 1 ? <ShieldCheck aria-hidden="true" /> : <ReceiptText aria-hidden="true" />}
          <h3>{g.title}</h3><p>{g.description}</p>
        </article>)}
      </div>
      <div className="public-info-source"><BookOpen size={18} aria-hidden="true"/><p>{t('For current rates and requirements, see', 'বর্তমান হার ও শর্ত দেখুন')} <a href="https://nbr.gov.bd/" target="_blank" rel="noopener noreferrer">{t('NBR publications', 'এনবিআর প্রকাশনা')}</a></p></div>
    </section>

    <section id="public-faq" className="citizen-hub-section public-info-section" aria-labelledby="faq-title">
      <div className="citizen-hub-section__heading"><div>

        <h2 id="faq-title"><CircleHelp size={22} aria-hidden="true" /> {t('Frequently asked questions', 'সাধারণ জিজ্ঞাসা')}</h2>
      </div><button type="button" className="public-more-link" onClick={()=>openGuide('payments')}>{t('See more','আরও দেখুন')}<ArrowRight size={15}/></button></div>
      <div className="public-info-faq">
        {questions.map(item=><details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
      </div>
    </section>
    {openService&&<PublicServiceModal service={openService} onClose={()=>setOpenService(null)}/>}
  </div>;
};
