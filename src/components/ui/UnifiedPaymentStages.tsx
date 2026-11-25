import React from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { amountInTakaWords } from '../../services/amountInWords';
type Language = 'en' | 'bn';
type Content = React.ReactNode;

export function PaymentReviewTotal({ language, amount, formatted, testId = 'unified-v5-payment-total', wordsTestId = 'unified-v5-total-in-words' }: {
  language: Language; amount: number; formatted: Content; testId?: string; wordsTestId?: string;
}) {
  return <div className="unified-v5-review-total" data-testid={testId}>
    <div className="unified-v5-review-total__row"><strong>{language === 'bn' ? 'মোট পেমেন্ট' : 'Payment total'}</strong>
      <output aria-live="polite">{formatted}</output></div>
    <p data-testid={wordsTestId}>{amountInTakaWords(amount, language) ?? '—'}</p>
  </div>;
}
export function PaymentChannelScreen({ language, children, actions, testId = 'unified-v5-payment-channel-screen', className = '' }: {
  language: Language; children: Content; actions?: Content; testId?: string; className?: string;
}) {
  const headingId = testId === 'unified-v5-payment-channel-screen' ? 'unified-v5-payment-channel-heading' : testId + '-heading';
  return <section className={['payment-review payment-review--unified-v5 unified-v5-payment-channel', className].filter(Boolean).join(' ')}
    data-testid={testId} aria-labelledby={headingId}>
    <div className="payment-review__main">
      <section className="payment-review__panel">
        <div className="payment-review__section-title">
          <div><h2 id={headingId}>{language === 'bn' ? 'পেমেন্ট চ্যানেল বেছে নিন' : 'Choose payment channel'}</h2>
            <p>{language === 'bn' ? 'অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন' : 'Choose online payment or a bank branch'}</p></div>
        </div>
        {children}
      </section>
      {actions}
    </div>
  </section>;
}
export function PaymentConfirmationLayout({ children }: { children: Content }) {
  return <div className="payment-flow-embedded__confirmation-layout">
    <section className="payment-lifecycle" aria-labelledby="payment-lifecycle-title">{children}</section>
  </div>;
}
export function WalkInChallanAction({ language, onOpen, children }: { language: Language; onOpen: () => void; children?: Content }) {
  return <div className="walkin-result-challan no-print" data-testid="walkin-challan-action">
    <button type="button" className="payment-lifecycle__primary" onClick={onOpen}>
      <FileText size={17} aria-hidden="true"/>{language === 'bn' ? 'চালানের বিবরণ' : 'Challan Details'}<ArrowRight size={17} aria-hidden="true"/>
    </button>
    {children}
  </div>;
}
export function WalkInResultBenefits({ language, onSignIn, onSkip }: { language: Language; onSignIn: () => void; onSkip: () => void }) {
  return <aside className="walkin-result-benefits no-print" data-testid="walkin-result-benefits" aria-labelledby="walkin-result-benefits-title">
    <h3 id="walkin-result-benefits-title">{language === 'bn' ? 'সহজকর অ্যাকাউন্টে আরও সুবিধা' : 'Get More with a Shohojkor Account'}</h3>
    <ul>
      <li>{language === 'bn' ? 'উপলব্ধ পেমেন্ট সনদ দেখুন' : 'Access Payment Certificates'}</li>
      <li>{language === 'bn' ? 'আগের পেমেন্ট রেকর্ড ও চালান দেখুন' : 'View previous payment records and challans'}</li>
      <li>{language === 'bn' ? 'পেমেন্টের ইতিহাস অনুসরণ করুন' : 'Track payment history'}</li>
    </ul>
    <div className="walkin-result-benefits__actions">
      <button type="button" className="walkin-postpayment-login__signin" onClick={onSignIn}>{language === 'bn' ? 'সাইন ইন' : 'Log In'} <ArrowRight size={16} aria-hidden="true" /></button>
      <button type="button" className="walkin-postpayment-login__skip" onClick={onSkip}>{language === 'bn' ? 'সাইন ইন ছাড়াই চালিয়ে যান' : 'Continue without Login'}</button>
    </div>
    <p>{language === 'bn' ? 'এই ওয়াক-ইন পেমেন্ট স্বয়ংক্রিয়ভাবে কোনো অ্যাকাউন্টে যুক্ত হবে না।' : 'This walk-in payment is not automatically linked to an account.'}</p>
  </aside>;
}

/** Approved shared Final Preview payment details and payer card.
 *  Each payment service retains its own validated allocation/contact fields. */
export function PaymentReviewDetails({ language, children, actions, headingId = 'unified-v3-review-title', testId = 'unified-v3-payment-details' }: {
  language: Language; children: Content; actions?: Content; headingId?: string; testId?: string;
}) {
  return <section className="payment-review__panel unified-v3-review" aria-labelledby={headingId} data-testid={testId}>
    <div className="payment-review__section-title unified-v3-review__heading">
      <h2 id={headingId}>{language === 'bn' ? 'পেমেন্টের বিবরণ' : 'Payment details'}</h2>
      {actions}
    </div>
    {children}
  </section>;
}
export function PaymentPayerDetails({ language, children, extra, headingId = 'payment-final-payer-title', testId, className = '' }: {
  language: Language; children: Content; extra?: Content; headingId?: string; testId?: string; className?: string;
}) {
  return <section className={['payment-review__panel payment-review__payer', className].filter(Boolean).join(' ')} aria-labelledby={headingId} data-testid={testId}>
    <div className="payment-review__section-title">
      <div><h2 id={headingId}>{language === 'bn' ? 'পরিশোধকারী ও রসিদের তথ্য' : 'Payer and receipt details'}</h2></div>
    </div>
    <p className="unified-v5-payer-hint">{language === 'bn' ? 'পরিশোধকারীর তথ্য রসিদে দেখানো হবে।' : 'Payer information will appear on the receipt.'}</p>
    <div className="payment-identity__fields">{children}</div>
    {extra}
  </section>;
}
export function PaymentConfirmationHeading({ state, icon, children }: {
  state: 'pending' | 'failed' | 'complete' | 'running'; icon: Content; children: Content;
}) {
  return <div className={'payment-lifecycle__heading payment-lifecycle__heading--' + state}>
    <span className="payment-lifecycle__symbol" aria-hidden="true">{icon}</span>
    <div><h2 id="payment-lifecycle-title">{children}</h2></div>
  </div>;
}
export function PaymentConfirmationOverview({ language, amount, children }: { language: Language; amount: Content; children: Content }) {
  return <div className="payment-lifecycle__overview">
    <div><span>{language === 'bn' ? 'মোট পরিশোধ' : 'Amount'}</span><strong>{amount}</strong></div>
    {children}
  </div>;
}
