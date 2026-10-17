import React from 'react';
import { ChevronDown, CircleCheck, ReceiptText } from 'lucide-react';
import { formatCurrency } from '../../services/numberFormat';
import type { ServiceCategoryCode } from './ServiceCategoryTag';

type Language = 'en' | 'bn';

interface FormSectionProps {
  title: string;
  description?: string;
  number: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  staticView?: boolean;
}

/** Native details/summary remain keyboard-operable and retain input state when collapsed. */
export function PaymentFormSection({ title, description, number, children, defaultOpen = true, staticView = false }: FormSectionProps) {
  const sectionRef = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    if (sectionRef.current) sectionRef.current.open = defaultOpen;
  }, [defaultOpen]);
  if (staticView) return (
    <section className="payment-form-section payment-form-section--static">
      <div className="payment-form-section__heading">
        <div className="payment-form-section__heading-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div>
      </div>
      <div className="payment-form-section__body">{children}</div>
    </section>
  );
  return (
    <details ref={sectionRef} className="payment-form-section">
      <summary className="payment-form-section__heading">
        <span className="payment-form-section__number">{number}</span>
        <span className="payment-form-section__heading-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
        <ChevronDown size={19} className="payment-form-section__chevron" aria-hidden="true" />
      </summary>
      <div className="payment-form-section__body">{children}</div>
    </details>
  );
}

interface PaymentSummaryProps {
  language: Language;
  category: string;
  categoryCode?: ServiceCategoryCode;
  tin?: string;
  year?: string;
  head?: string;
  amount: number;
  note?: string;
  breakdown?: { label: string; value: number }[];
}

export function PaymentLiveSummary({ language, category, categoryCode, tin, year, head, amount, note, breakdown }: PaymentSummaryProps) {
  const bn = language === 'bn';
  return (
    <aside className="payment-form-summary" aria-label={bn ? 'হালনাগাদ পেমেন্ট হিসাব' : 'Live payment calculation'}>
      <div className="payment-form-summary__heading"><ReceiptText size={19} aria-hidden="true" />
        <h2>{bn ? 'পেমেন্টের হিসাব' : 'Payment calculation'}</h2>
        <span className="payment-form-summary__live"><CircleCheck size={14} aria-hidden="true" />{bn ? 'হালনাগাদ' : 'Live'}</span>
      </div>
      <p className="payment-form-summary__eyebrow">{bn ? 'পরিশোধের মোট পরিমাণ' : 'Payment total'}</p>
      <output className="payment-form-summary__total" aria-live="polite">{formatCurrency(amount, language)}</output>
      <p className="payment-form-summary__help">{bn ? 'ফর্মে তথ্য পরিবর্তনের সঙ্গে হিসাব আপডেট হয়।' : 'Updates as you complete the form.'}</p>
      <dl className="payment-form-summary__rows">
        <div><dt>{bn ? 'সেবা' : 'Service'}</dt><dd className={categoryCode ? 'taxpay-service-value' : undefined} data-payment-service={categoryCode}>{category}</dd></div>
        {tin && <div><dt>{bn ? 'টিআইএন' : 'TIN'}</dt><dd className="payment-form-summary__mono">{tin}</dd></div>}
        {year && <div><dt>{bn ? 'করবর্ষ' : 'Assessment year'}</dt><dd>{year}</dd></div>}
        {head && <div><dt>{bn ? 'খাত' : 'Payment head'}</dt><dd>{head}</dd></div>}
      </dl>
      {breakdown && breakdown.length > 0 && <div className="payment-form-summary__breakdown">
        <h3>{bn ? 'হিসাবের বিবরণ' : 'Amount breakdown'}</h3>
        {breakdown.map(item => <div key={item.label}><span>{item.label}</span><strong>{formatCurrency(item.value, language)}</strong></div>)}
      </div>}
      {note && <p className="payment-form-summary__notice">{note}</p>}
    </aside>
  );
}
