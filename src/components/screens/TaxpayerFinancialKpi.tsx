import React from 'react';
import {ArrowRight, Info} from 'lucide-react';
import type {Language} from '../../types/tax';

/**
 * Shared financial dashboard KPI. All sources use the same approved presentation.
 * The caller owns the financial evidence: unavailable figures must be passed as
 * "—", never synthetic zeroes or another taxpayer's fixture amounts.
 */
export function TaxpayerFinancialKpi({
  language, titleEn, titleBn, value, helpEn, helpBn, priority = false, onReviewPayment,
}: {
  language: Language;
  titleEn: string;
  titleBn: string;
  value: string;
  helpEn: string;
  helpBn: string;
  priority?: boolean;
  onReviewPayment?: () => void;
}) {
  const bn = language === 'bn';
  const title = bn ? titleBn : titleEn;
  const help = bn ? helpBn : helpEn;
  return <article className={'rounded-2xl border border-taxpay-border bg-taxpay-surface p-4 shadow-sm sm:p-5 taxpayer-dashboard-kpi' +
    (priority ? ' taxpayer-dashboard-kpi--balance' : '')}>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <p className="text-sm font-medium text-taxpay-muted">{title}</p>
      <details className="taxpayer-inline-help"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false;
            event.stopPropagation();
          }
        }}>
        <summary aria-label={(bn ? 'বিস্তারিত: ' : 'About ') + title}
          title={bn ? 'বিস্তারিত তথ্য' : 'More information'}>
          <Info size={16} aria-hidden="true"/>
        </summary>
        <p className="taxpayer-inline-help__content">{help}</p>
      </details>
    </div>
    <p className="mt-3 break-words text-2xl font-semibold tabular-nums text-taxpay-text">{value}</p>
    {onReviewPayment && <button type="button"
      className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-taxpay-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
      onClick={onReviewPayment}>
      {bn ? 'পেমেন্টের বিকল্প দেখুন' : 'Review payment options'}
      <ArrowRight size={15} aria-hidden="true"/>
    </button>}
  </article>;
}
