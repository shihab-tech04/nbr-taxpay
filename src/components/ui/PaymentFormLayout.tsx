import React from 'react';
import { ChevronDown, Copy, Eye, EyeOff, ReceiptText } from 'lucide-react';
import { formatCurrency } from '../../services/numberFormat';
import { amountInTakaWords } from '../../services/amountInWords';
import type { ServiceCategoryCode } from './ServiceCategoryTag';

type Language = 'en' | 'bn';

interface FormSectionProps {
  title: string;
  description?: string;
  number: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  staticView?: boolean;
  hideHeading?: boolean;
}

/** Native details/summary remain keyboard-operable and retain input state when collapsed. */
export function PaymentFormSection({ title, description, number, children, defaultOpen = true, staticView = false, hideHeading = false }: FormSectionProps) {
  const sectionRef = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    if (sectionRef.current) sectionRef.current.open = defaultOpen;
  }, [defaultOpen]);
  // The signed-in account card supplies its own section title. Avoid duplicate
  // headings and a non-functional disclosure control in that one journey.
  if (hideHeading) return (
    <section className="payment-form-section payment-form-section--static payment-form-section--no-heading">
      <div className="payment-form-section__body">{children}</div>
    </section>
  );
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
  breakdown?: { id?: string; label: string; detail?: string; value: number | null }[];
  groupedBreakdown?: { id: string; label: string; tin: string; amount: number | null; countLabel?: string; entries: { id?: string; label: string; detail?: string; value: number | null }[] }[];
  onSelectEntry?: (id: string) => void;
  /** Optional active editor line; no behavior change to other payment services. */
  activeEntryId?: string | null;
}

/** Mask payment-form identity by default. Full TIN is still available by an
 * explicit reveal/copy gesture; transaction serialization is unchanged. */
function MaskedSummaryTin({ tin, language }: { tin: string; language: Language }) {
  const [revealed, setRevealed] = React.useState(false);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const bn = language === 'bn';
  const visible = revealed ? tin : tin.slice(0, 3) + '****';

  const copyTin = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(tin);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return <span className="payment-form-summary__tin">
    <span className="payment-form-summary__mono" data-testid="payment-summary-tin">{visible}</span>
    <button type="button" className="payment-form-summary__tin-action"
      aria-label={revealed ? (bn ? 'টিআইএন লুকান' : 'Hide TIN') : (bn ? 'টিআইএন দেখুন' : 'Reveal TIN')}
      aria-pressed={revealed} onClick={event => { event.preventDefault(); event.stopPropagation(); setRevealed(value => !value); }}
      onKeyDown={event => event.stopPropagation()}>
      {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
    </button>
    <button type="button" className="payment-form-summary__tin-action"
      aria-label={bn ? 'টিআইএন কপি করুন' : 'Copy TIN'}
      onClick={event => { event.preventDefault(); event.stopPropagation(); void copyTin(); }}
      onKeyDown={event => event.stopPropagation()}><Copy size={16} aria-hidden="true" /></button>
    <span className="sr-only" role="status">
      {copyState === 'copied' ? (bn ? 'টিআইএন কপি হয়েছে' : 'TIN copied')
        : copyState === 'failed' ? (bn ? 'টিআইএন কপি করা যায়নি' : 'Could not copy TIN') : ''}
    </span>
  </span>;
}

export function PaymentLiveSummary({ language, category, categoryCode, hideService = false, tin, year, head, amount, note, helpText, breakdown, groupedBreakdown, onSelectEntry, activeEntryId }: PaymentSummaryProps) {
  const bn = language === 'bn';
  const amountWords = amountInTakaWords(amount, language);
  // A bulk selection can contain dozens of entries. Keep a clear, accessible
  // way to reveal every selected head without burying the next taxpayer.
  const [expandedTaxpayerSummaries, setExpandedTaxpayerSummaries] = React.useState<Record<string, boolean>>({});
  const summaryRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!activeEntryId) return;
    const group = groupedBreakdown?.find(item => item.entries.some(entry => entry.id === activeEntryId));
    if (!group) return;
    if (group.entries.findIndex(entry => entry.id === activeEntryId) >= 4) {
      setExpandedTaxpayerSummaries(previous => previous[group.id] ? previous : { ...previous, [group.id]: true });
    }
    // Never collapse a taxpayer card another editor action has left open.
    summaryRef.current?.querySelectorAll<HTMLDetailsElement>('.payment-form-summary__taxpayer')
      .forEach(element => { if (element.dataset.groupId === group.id) element.open = true; });
  }, [activeEntryId, groupedBreakdown]);
  const renderBreakdownEntry = (item: NonNullable<PaymentSummaryProps['breakdown']>[number], index: number) => {
    const contents = <>
      <span className="payment-form-summary__entry-description">
        <span>{item.label}</span>
        {item.detail && <small>{item.detail}</small>}
      </span>
      <strong>{item.value === null ? '—' : formatCurrency(item.value, language)}</strong>
    </>;
    return item.id && onSelectEntry
      ? <button type="button" key={item.id} className="payment-form-summary__entry payment-form-summary__entry--link"
           data-active={item.id === activeEntryId ? "true" : undefined}
          aria-label={bn ? `সম্পাদনা করুন: ${item.label}, ${item.detail || ''}` : `Edit ${item.label}, ${item.detail || ''}`}
          onClick={() => onSelectEntry(item.id!)}>{contents}</button>
      : <div key={item.id ?? index} className="payment-form-summary__entry">{contents}</div>;
  };
  return (
    <aside ref={summaryRef} className="payment-form-summary" aria-label={bn ? 'হালনাগাদ পেমেন্ট হিসাব' : 'Live payment calculation'}>
      <div className="payment-form-summary__heading"><ReceiptText size={19} aria-hidden="true" />
        <h2>{bn ? 'পেমেন্টের হিসাব' : 'Payment calculation'}</h2>
      </div>
      <p className="payment-form-summary__eyebrow">{bn ? 'পরিশোধের মোট পরিমাণ' : 'Payment total'}</p>
      <output className="payment-form-summary__total" aria-live="polite">{amount === null ? '—' : formatCurrency(amount, language)}</output>
      {amountWords && <p className="payment-form-summary__amount-words" data-testid="payment-total-in-words">{amountWords}</p>}
      {helpText && <p className="payment-form-summary__help">{helpText}</p>}
      {(!hideService || tin || year || head) && <dl className={categoryCode === 'TAX_WITH_RETURN' && head
        ? 'payment-form-summary__rows payment-form-summary__rows--return-context'
        : 'payment-form-summary__rows'}>
        {!hideService && <div><dt>{bn ? 'সেবা' : 'Service'}</dt><dd className={categoryCode ? 'taxpay-service-value' : undefined} data-payment-service={categoryCode}>{category}</dd></div>}
        {tin && <div><dt>{bn ? 'টিআইএন' : 'TIN'}</dt><dd><MaskedSummaryTin tin={tin} language={language} /></dd></div>}
        {year && <div><dt>{bn ? 'করবর্ষ' : 'Assessment year'}</dt><dd>{year}</dd></div>}
        {head && <div><dt>{bn ? 'খাত' : 'Payment head'}</dt><dd>{head}</dd></div>}
      </dl>}
      {Boolean(breakdown?.length || groupedBreakdown?.length) && <div className="payment-form-summary__scroll-content" data-testid="payment-calculation-scroll-area">
      {breakdown && breakdown.length > 0 && <div className="payment-form-summary__breakdown">
        <h3>{bn ? 'হিসাবের বিবরণ' : 'Amount breakdown'}</h3>
        {breakdown.map(renderBreakdownEntry)}
      </div>}
      {groupedBreakdown && groupedBreakdown.length > 0 && <section className="payment-form-summary__taxpayers" aria-label={bn ? 'করদাতা অনুযায়ী হিসাব' : 'Calculation by taxpayer'} data-testid="grouped-taxpayer-calculation">
        <h3>{bn ? 'করদাতা অনুযায়ী হিসাব' : 'By taxpayer'}</h3>
        {groupedBreakdown.map((group, index) => {
          const countLabel = group.countLabel ?? (bn ? `${group.entries.length}টি খাত` : `${group.entries.length} ${group.entries.length === 1 ? 'head' : 'heads'}`);
          const previewLimit = 4;
          const canExpand = group.entries.length > previewLimit;
          const expanded = Boolean(expandedTaxpayerSummaries[group.id]);
          const visibleEntries = canExpand && !expanded ? group.entries.slice(0, previewLimit) : group.entries;
          return <details key={group.id} data-group-id={group.id} className="payment-form-summary__taxpayer" open={index === 0}>
          <summary>
            <span className="payment-form-summary__taxpayer-name">
              <strong>{group.label}</strong>
              <small className="payment-form-summary__taxpayer-identity">{bn ? 'টিআইএন' : 'TIN'}: {group.tin ? group.tin.slice(0, 3) + '****' : '—'} · {countLabel}</small>
            </span>
            <span className="payment-form-summary__taxpayer-total">{group.amount === null ? '—' : formatCurrency(group.amount, language)}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="payment-form-summary__taxpayer-items">
            {canExpand && <button type="button" className="payment-form-summary__taxpayer-show-all"
              aria-expanded={expanded}
              onClick={() => setExpandedTaxpayerSummaries(previous => ({ ...previous, [group.id]: !previous[group.id] }))}>
              <span>{expanded
                ? (bn ? 'প্রথম চারটি খাত দেখুন' : 'Show first 4 heads')
                : (bn ? `নির্বাচিত সব ${group.entries.length}টি খাত দেখুন` : `Show all ${group.entries.length} selected heads`)}</span>
              {!expanded && <small>{bn ? `আরও ${group.entries.length - previewLimit}টি খাত` : `${group.entries.length - previewLimit} more heads`}</small>}
            </button>}
            <div className="payment-form-summary__taxpayer-entries"
              data-testid="selected-taxpayer-head-list"
              data-expanded={canExpand && expanded ? 'true' : undefined}
              role={canExpand && expanded ? 'region' : undefined}
              aria-label={canExpand && expanded ? (bn ? `${group.label} নির্বাচিত পরিশোধের খাত` : `${group.label} selected payment heads`) : undefined}
              tabIndex={canExpand && expanded ? 0 : undefined}>
              {visibleEntries.length ? visibleEntries.map((entry, entryIndex) => {
              const contents = <>
                <span className="payment-form-summary__taxpayer-label">{entry.label}{entry.detail && <small>{entry.detail}</small>}</span>
                <strong>{entry.value === null ? '—' : formatCurrency(entry.value, language)}</strong>
              </>;
              return entry.id && onSelectEntry
                ? <button type="button" key={entry.id} className="payment-form-summary__taxpayer-item payment-form-summary__entry--link"
                     data-active={entry.id === activeEntryId ? "true" : undefined}
                    aria-label={bn ? `সম্পাদনা করুন: ${entry.label}, ${entry.detail || ''}` : `Edit ${entry.label}, ${entry.detail || ''}`}
                    onClick={() => onSelectEntry(entry.id!)}>{contents}</button>
                : <div key={entryIndex} className="payment-form-summary__taxpayer-item">{contents}</div>;
              }) : <p className="payment-form-summary__taxpayer-empty">{bn ? 'পরের ধাপে খাত ও পরিমাণ নির্বাচন করুন।' : 'Select payment heads and amounts in Step 2.'}</p>}
            </div>
            {group.tin && <div className="payment-form-summary__taxpayer-tin-tools" aria-label={bn ? 'করদাতার টিআইএন নিয়ন্ত্রণ' : 'Taxpayer TIN controls'}>
              <MaskedSummaryTin tin={group.tin} language={language} />
            </div>}
          </div>
        </details>;
        })}
      </section>}
      </div>}
      {note && <p className="payment-form-summary__notice">{note}</p>}
    </aside>
  );
}
