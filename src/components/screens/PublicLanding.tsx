import React, { useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ListChecks, ReceiptText, UserRound, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { PublicServiceModal, type PublicService } from './PublicServiceModal';
import { PublicHeroCarousel } from './PublicHeroCarousel';

export const PublicLanding: React.FC = () => {
  const { language, navigate, openPaymentServiceChoice, isPaymentServiceChoiceOpen, previewAccount } = useTaxState();
  const { user } = useAccountIdentity();
  const signedIn = Boolean(user || previewAccount);
  const [openService, setOpenService] = useState<PublicService | null>(null);
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;

  const stages = [
    {
      Icon: UserRound,
      title: t('Input taxpayer details', 'করদাতার তথ্য দিন'),
      description: t('Enter or confirm the taxpayer’s details.', 'যার কর পরিশোধ করছেন, তার তথ্য দিন বা নিশ্চিত করুন।'),
    },
    {
      Icon: ListChecks,
      title: t('Select purpose & amount', 'খাত ও পরিমাণ নির্বাচন করুন'),
      description: t('Choose the payment head and enter the amount.', 'কর পরিশোধের খাত বেছে নিয়ে পরিমাণ লিখুন।'),
    },
    {
      Icon: WalletCards,
      title: t('Choose payment method', 'পেমেন্ট পদ্ধতি বেছে নিন'),
      description: t('Choose to pay online or at a bank branch.', 'অনলাইন বা ব্যাংক শাখায় পরিশোধের পদ্ধতি বেছে নিন।'),
    },
    {
      Icon: ReceiptText,
      title: t('Review & confirm payment', 'যাচাই করে নিশ্চিত করুন'),
      description: t('Review the details and keep your payment reference.', 'পেমেন্টের তথ্য যাচাই করুন ও রেফারেন্স সংরক্ষণ করুন।'),
    },
  ];

  const questions = [
    {
      question: t('Do I need an account to pay?', 'কর পরিশোধ করতে কি অ্যাকাউন্ট লাগবে?'),
      answer: t(
        'It depends on the service. Choose the payment service first; you will be asked to sign in when that service requires an account.',
        'সেবার ওপর নির্ভর করে। আগে করসেবা বেছে নিন; অ্যাকাউন্ট প্রয়োজন হলে উপযুক্ত সময়ে লগইন করতে বলা হবে।',
      ),
    },
    {
      question: t('Where can I find an earlier payment?', 'আগের পেমেন্ট কোথায় খুঁজব?'),
      answer: signedIn
        ? t('Use your reference to check payment status and receipts, or open your dashboard for transaction history.', 'রেফারেন্স দিয়ে পেমেন্টের অবস্থা ও রসিদ দেখুন, অথবা লেনদেনের ইতিহাসের জন্য ড্যাশবোর্ড খুলুন।')
        : t('Use your reference to check payment status and receipts. Sign in to see your transaction workspace and payment history.', 'রেফারেন্স দিয়ে পেমেন্টের অবস্থা ও রসিদ দেখুন। নিজের লেনদেন ও ইতিহাস দেখতে লগইন করুন।'),
    },
    {
      question: t('Does a receipt automatically confirm a tax credit?', 'রসিদ থাকলেই কি কর ক্রেডিট নিশ্চিত হয়?'),
      answer: t(
        'No. A receipt records a payment. Tax credit depends on applicable rules, ownership and verification.',
        'না। রসিদ একটি পেমেন্টের রেকর্ড। কর ক্রেডিট প্রযোজ্য নিয়ম, মালিকানা ও যাচাইয়ের ওপর নির্ভর করে।',
      ),
    },
    {
      question: t('What if my payment details do not match?', 'পেমেন্টের তথ্যে অমিল থাকলে কী করব?'),
      answer: t(
        'Keep your payment reference and follow the records and corrections guidance.',
        'পেমেন্ট রেফারেন্স সংরক্ষণ করুন এবং রেকর্ড ও সংশোধনের নির্দেশনা অনুসরণ করুন।',
      ),
      guide: true,
    },
  ];

  return <div className={'citizen-public-hub public-information-hub mx-auto w-full space-y-6' + (bn ? ' font-bengali' : '')}>
    <PublicHeroCarousel
      language={language}
      onPayTax={service => service === 'TRAVEL_TAX' ? setOpenService('travel') : openPaymentServiceChoice(service)}
      onCheckReceipt={() => setOpenService('status')}
      paused={isPaymentServiceChoiceOpen || openService !== null}
    />

    <section id="public-how-it-works" className="citizen-hub-section public-info-section public-payment-path" aria-labelledby="steps-title">
      <div className="citizen-hub-section__heading">
        <div>
          <h2 id="steps-title">{t('How your payment works', 'যেভাবে কর পরিশোধ করবেন')}</h2>
          <p>{t('A clear route from taxpayer details to your payment record.', 'করদাতার তথ্য থেকে পেমেন্ট রেকর্ড পর্যন্ত প্রতিটি ধাপ পরিষ্কারভাবে দেখুন।')}</p>
        </div>
      </div>
      <div className="public-payment-path__starter">
        <span className="public-payment-path__starter-label">{t('Start here', 'এখান থেকে শুরু করুন')}</span>
        <p>{t('Choose a service from the banner above, then follow these four steps.', 'উপরের ব্যানার থেকে সেবা বেছে নিন, তারপর চারটি ধাপ অনুসরণ করুন।')}</p>
      </div>
      <ol className="public-payment-path__steps">
        {stages.map((stage, index) => <li key={stage.title}>
          <div className="public-payment-path__step-head">
            <span className="public-payment-path__symbol" aria-hidden="true"><stage.Icon size={23} strokeWidth={1.9}/></span>
            <span className="public-payment-path__step-label">{t(`Step ${index + 1}`, `ধাপ ${['১', '২', '৩', '৪'][index]}`)}</span>
          </div>
          <h3>{stage.title}</h3>
          <p>{stage.description}</p>
        </li>)}
      </ol>
    </section>

    <section id="public-faq" className="citizen-hub-section public-info-section public-faq-layout" aria-labelledby="faq-title">
      <div className="public-faq-layout__heading">
        <div>
          <h2 id="faq-title">{t('Common questions', 'সাধারণ প্রশ্ন')}</h2>
          <p>{t('The answers you may need before making a payment.', 'কর পরিশোধের আগে আপনার প্রয়োজনীয় কিছু উত্তর।')}</p>
        </div>
        <button type="button" className="public-faq-layout__all-guides" onClick={() => navigate('user_guide')}>
          <BookOpen size={18} aria-hidden="true" /> {t('Open user guide', 'ব্যবহার নির্দেশিকা দেখুন')} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="public-info-faq">
        {questions.map(item => <details key={item.question}>
          <summary><span>{item.question}</span><ChevronDown size={20} aria-hidden="true" /></summary>
          <div className="public-faq-layout__answer">
            <p>{item.answer}</p>
            {item.guide && <button type="button" className="public-faq-layout__guide-link" onClick={() => navigate('user_guide', { category: 'records' })}>
              {t('Read records & corrections guidance', 'রেকর্ড ও সংশোধনের নির্দেশনা পড়ুন')}
              <ArrowRight size={15} aria-hidden="true" />
            </button>}
          </div>
        </details>)}
      </div>
    </section>
    {openService && <PublicServiceModal service={openService} onClose={() => setOpenService(null)} />}
  </div>;
};
