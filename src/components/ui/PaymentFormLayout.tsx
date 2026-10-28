import React from 'react';
import { ChevronDown, ReceiptText } from 'lucide-react';
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
  hideService?: boolean;
  tin?: string;
  year?: string;
  head?: string;
  amount: number | null;
  note?: string;
  helpText?: string;
  breakdown?: { label: string; detail?: string; value: number | null }[];
  groupedBreakdown?: { id: string; label: string; tin: string; amount: number | null; entries: { label: string; detail?: string; value: number | null }[] }[];
}

export function PaymentLiveSummary({ language, category, categoryCode, hideService = false, tin, year, head, amount, note, helpText, breakdown, groupedBreakdown }: PaymentSummaryProps) {
  const bn = language === 'bn';
  return (
    <aside className="payment-form-summary" aria-label={bn ? 'হালনাগাদ পেমেন্ট হিসাব' : 'Live payment calculation'}>
      <div className="payment-form-summary__heading"><ReceiptText size={19} aria-hidden="true" />
        <h2>{bn ? 'পেমেন্টের হিসাব' : 'Payment calculation'}</h2>
      </div>
      <p className="payment-form-summary__eyebrow">{bn ? 'পরিশোধের মোট পরিমাণ' : 'Payment total'}</p>
      <output className="payment-form-summary__total" aria-live="polite">{amount === null ? '—' : formatCurrency(amount, language)}</output>
      <p className="payment-form-summary__help">{helpText || (bn ? 'ফর্মে তথ্য পরিবর্তনের সঙ্গে হিসাব আপডেট হয়।' : 'Updates as you complete the form.')}</p>
      {(!hideService || tin || year || head) && <dl className={categoryCode === 'TAX_WITH_RETURN' && head
        ? 'payment-form-summary__rows payment-form-summary__rows--return-context'
        : 'payment-form-summary__rows'}>
        {!hideService && <div><dt>{bn ? 'সেবা' : 'Service'}</dt><dd className={categoryCode ? 'taxpay-service-value' : undefined} data-payment-service={categoryCode}>{category}</dd></div>}
        {tin && <div><dt>{bn ? 'টিআইএন' : 'TIN'}</dt><dd className="payment-form-summary__mono">{tin}</dd></div>}
        {year && <div><dt>{bn ? 'করবর্ষ' : 'Assessment year'}</dt><dd>{year}</dd></div>}
        {head && <div><dt>{bn ? 'খাত' : 'Payment head'}</dt><dd>{head}</dd></div>}
      </dl>}
      {breakdown && breakdown.length > 0 && <div className="payment-form-summary__breakdown">
        <h3>{bn ? 'হিসাবের বিবরণ' : 'Amount breakdown'}</h3>
        {breakdown.map((item, index) => <div key={index} className="payment-form-summary__entry">
          <span className="payment-form-summary__entry-description">
            <span>{item.label}</span>
            {item.detail && <small>{item.detail}</small>}
          </span>
          <strong>{item.value === null ? '—' : formatCurrency(item.value, language)}</strong>
        </div>)}
      </div>}
      {groupedBreakdown && groupedBreakdown.length > 0 && <section className="payment-form-summary__taxpayers" aria-label={bn ? 'করদাতা অনুযায়ী হিসাব' : 'Calculation by taxpayer'} data-testid="grouped-taxpayer-calculation">
        <h3>{bn ? 'করদাতা অনুযায়ী হিসাব' : 'By taxpayer'}</h3>
        {groupedBreakdown.map((group, index) => <details key={group.id} className="payment-form-summary__taxpayer" open={index === 0}>
          <summary>
            <span className="payment-form-summary__taxpayer-name">
              <strong>{group.label}</strong>
              <small>{bn ? 'টিআইএন' : 'TIN'}: {group.tin || '—'} · {group.entries.length} {bn ? 'টি খাত' : group.entries.length === 1 ? 'head' : 'heads'}</small>
            </span>
            <span className="payment-form-summary__taxpayer-total">{group.amount === null ? '—' : formatCurrency(group.amount, language)}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="payment-form-summary__taxpayer-items">
            {group.entries.length ? group.entries.map((entry, entryIndex) => <div key={entryIndex} className="payment-form-summary__taxpayer-item">
              <p>{entry.label}{entry.detail && <small>{entry.detail}</small>}</p>
              <strong>{entry.value === null ? '—' : formatCurrency(entry.value, language)}</strong>
            </div>) : <p className="payment-form-summary__taxpayer-empty">{bn ? 'পরের ধাপে খাত ও পরিমাণ নির্বাচন করুন।' : 'Select payment heads and amounts in Step 2.'}</p>}
          </div>
        </details>)}
      </section>}
      {note && <p className="payment-form-summary__notice">{note}</p>}
    </aside>
  );
}
