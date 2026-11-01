import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ListChecks, Plus, Search, Trash2 } from 'lucide-react';
import { SuggestedAmountInfo } from '../ui/SuggestedAmountInfo';
import { paymentAmountSuggestionFor } from '../../services/paymentAmountSuggestions';
import type { DemoUserId } from '../../data/demoUsers';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import { V11_PAYMENT_OPTIONS } from '../../data/v11PaymentOptions';
import { BLOCKED_HEAD_IDS } from '../../data/paymentHeads';
import { parseGuestAmount, sumGuestAmounts, normalizeGuestAmountInput } from '../../services/guestAmount';
import type { Language } from '../../types/tax';

export type OtherTaxTaxpayer = { id: string; tin: string; name: string };
export type OtherTaxAllocation = {
  id: string;
  taxpayerId: string;
  headId: number;
  assessmentYear: string;
  amount: string;
};

export const OTHER_TAX_YEARS = ['2027-28', '2026-27', '2025-26', '2024-25'] as const;
// Return tax is a separate service. It must never be offered under Other Tax.
const GROUP_ORDER = ['Advance Tax', 'Tax against Demand', 'Penalty', 'Appellate Tribunal', 'Others'] as const;
const liability = V11_SOURCE_HEADS.filter(head =>
  head.journey === 'LIABILITY' && head.active &&
  head.purpose !== 'return' && head.grpEn !== 'Tax with Return'
);
const grouped = GROUP_ORDER.map(name => ({ name, rows: liability.filter(head => head.grpEn === name) }));
const sourceOptions = new Map(V11_PAYMENT_OPTIONS.map(head => [head.id, head]));

export const otherTaxAllocationAmount = (line: OtherTaxAllocation) => parseGuestAmount(line.amount);
export const otherTaxAllocationTotal = (lines: OtherTaxAllocation[]) =>
  lines.length ? sumGuestAmounts(lines.map(item => item.amount)) : 0;
export const otherTaxAllocationHead = (id: number) => sourceOptions.get(id);
export const isOtherTaxHeadEligible = (id: number) => {
  const source = liability.find(head => head.id === id);
  return !!source && source.map === 'MAPPED' && !BLOCKED_HEAD_IDS.includes(id)
    && sourceOptions.get(id)?.status === 'ACTIVE';
};

type Props = {
  language: Language;
  taxpayers: OtherTaxTaxpayer[];
  lines: OtherTaxAllocation[];
  suggestionTaxpayerIds?: Readonly<Record<string, DemoUserId | null>>;
  onChange: (lines: OtherTaxAllocation[]) => void;
  error?: string;
  summary?: React.ReactNode;
  focusRequest?: { lineId: string; requestId: number } | null;
};

export function OtherTaxBatchComposer({ language, taxpayers, lines, suggestionTaxpayerIds, onChange, error, summary, focusRequest }: Props) {
  const bn = language === 'bn';
  const tx = (en: string, bangla: string) => bn ? bangla : en;
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const taxpayerTabsRef = useRef<HTMLDivElement>(null);
  const [railEdges, setRailEdges] = useState({ left: false, right: false });
  const selectionMenuRef = useRef<HTMLDetailsElement>(null);
  const lastFocusRequest = useRef<number>(0);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!selectionMenuRef.current?.contains(event.target as Node)) selectionMenuRef.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);
  useEffect(() => {
    const rail = taxpayerTabsRef.current;
    if (!rail) return;
    const update = () => setRailEdges(previous => {
      const next = { left: rail.scrollLeft > 2, right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 };
      return previous.left === next.left && previous.right === next.right ? previous : next;
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    if (rail.firstElementChild) observer.observe(rail.firstElementChild);
    return () => observer.disconnect();
  }, [taxpayers.length]);
  const scrollTaxpayers = (direction: -1 | 1) => {
    const rail = taxpayerTabsRef.current;
    if (rail) rail.scrollBy({ left: direction * Math.max(160, rail.clientWidth * .7), behavior: 'smooth' });
  };
  const [activeTaxpayer, setActiveTaxpayer] = useState('primary');
  const activeId = taxpayers.some(person => person.id === activeTaxpayer)
    ? activeTaxpayer : taxpayers[0]?.id;
  const activeLines = lines.filter(line => line.taxpayerId === activeId);
  const search = query.trim().toLocaleLowerCase();
  const count = grouped.reduce((n, group) => n + group.rows.length, 0);
  const usedTotal = otherTaxAllocationTotal(lines);
  const isIncomplete = (line: OtherTaxAllocation) =>
    otherTaxAllocationAmount(line) === null || !isOtherTaxHeadEligible(line.headId) ||
    !OTHER_TAX_YEARS.some(year => year === line.assessmentYear);
  const invalidLines = error ? lines.filter(isIncomplete) : [];
  const firstInvalid = invalidLines[0];
  const firstMissingTaxpayer = error ? taxpayers.find(person => !lines.some(line => line.taxpayerId === person.id)) : undefined;

  useEffect(() => {
    if (!error) return;
    setQuery('');
    const target = firstInvalid?.taxpayerId ?? firstMissingTaxpayer?.id;
    if (target && target !== activeId) {
      setActiveTaxpayer(target);
      return;
    }
    rootRef.current?.querySelectorAll<HTMLDetailsElement>('[data-head-group]').forEach(group => {
      if (group.querySelector('[data-invalid="true"]')) group.open = true;
    });
  }, [error, activeId, firstInvalid?.id, firstMissingTaxpayer?.id, query]);

  // Summary lines link back to the exact taxpayer, payment head and year.
  useEffect(() => {
    if (!focusRequest || lastFocusRequest.current === focusRequest.requestId) return;
    const selected = lines.find(line => line.id === focusRequest.lineId);
    if (!selected) return;
    if (activeId !== selected.taxpayerId) {
      setActiveTaxpayer(selected.taxpayerId);
      return;
    }
    if (query) {
      setQuery('');
      return;
    }
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-head-row="${selected.headId}"]`);
    const group = row?.closest('details');
    if (group) group.open = true;
    lastFocusRequest.current = focusRequest.requestId;
    const input = rootRef.current?.querySelector<HTMLInputElement>(`#other-tax-amount-${selected.id}`);
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  }, [focusRequest, activeId, query, lines]);

  const defaultYear = '2026-27';
  const suggestedFor = (taxpayerId: string, headId: number, year: string) =>
    paymentAmountSuggestionFor(
      suggestionTaxpayerIds?.[taxpayerId] ?? null,
      liability.find(head => head.id === headId)?.grpEn,
      year,
      headId,
    );
  const newLine = (headId: number, assessmentYear = defaultYear): OtherTaxAllocation => ({
    id: crypto.randomUUID(), taxpayerId: activeId!, headId, assessmentYear,
    amount: suggestedFor(activeId!, headId, assessmentYear)?.amount ?? '',
  });
  const visibleEligible = grouped.flatMap(group => group.rows).filter(head =>
    isOtherTaxHeadEligible(head.id) &&
    (!search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search)));
  const selectAll = () => {
    if (!activeId) return;
    const additions = visibleEligible.filter(head => !activeLines.some(line => line.headId === head.id))
      .map(head => newLine(head.id));
    if (additions.length) onChange([...lines, ...additions]);
  };
  const unselectAll = () => {
    if (activeId && activeLines.length) onChange(lines.filter(line => line.taxpayerId !== activeId));
  };
  // A head may be selected once per assessment year for each taxpayer.
  const toggleHead = (headId: number, checked: boolean) => {
    if (!activeId || !isOtherTaxHeadEligible(headId)) return;
    if (!checked) onChange(lines.filter(line => !(line.taxpayerId === activeId && line.headId === headId)));
    else if (!activeLines.some(line => line.headId === headId)) onChange([...lines, newLine(headId)]);
  };
  const addYear = (headId: number) => {
    const chosen = new Set(activeLines.filter(line => line.headId === headId).map(line => line.assessmentYear));
    const year = OTHER_TAX_YEARS.find(candidate => !chosen.has(candidate));
    if (activeId && year && isOtherTaxHeadEligible(headId)) onChange([...lines, newLine(headId, year)]);
  };
  const edit = (id: string, update: Partial<OtherTaxAllocation>) => {
    const current = lines.find(line => line.id === id);
    if (!current) return;
    if (update.assessmentYear && lines.some(line => line.id !== id && line.taxpayerId === current.taxpayerId &&
      line.headId === current.headId && line.assessmentYear === update.assessmentYear)) return;
    // A User1 example amount is tied to one year; other taxpayers keep manual values.
    const nextSuggestion = update.assessmentYear
      ? suggestedFor(current.taxpayerId, current.headId, update.assessmentYear) : null;
    const amount = update.amount ?? (update.assessmentYear && suggestionTaxpayerIds?.[current.taxpayerId] === 'user1'
      ? nextSuggestion?.amount ?? '' : current.amount);
    onChange(lines.map(line => line.id === id ? { ...line, ...update, amount } : line));
  };

  return (
    <div ref={rootRef} className="payment-form-layout payment-flow-embedded__payment other-tax-batch-panel" data-testid="other-tax-batch">
      <div className="payment-form-layout__sections">
        <section className={error ? "payment-form-section payment-form-section--static other-tax-section--invalid" : "payment-form-section payment-form-section--static"}>
          <div className="payment-form-section__heading">
            <div className="payment-form-section__heading-copy">
              <h2>{taxpayers.length > 1 ? tx('Paying tax for', 'যার কর পরিশোধ করছেন') : tx('Choose payment heads', 'পরিশোধের খাত নির্বাচন করুন')}</h2>
            </div>
          </div>
          <div className="payment-form-section__body space-y-4">
            {taxpayers.length > 1 && <div className="other-tax-taxpayer-section">
              <div className="other-tax-taxpayer-nav">
                <div ref={taxpayerTabsRef} role="group"
                  aria-label={tx('Choose a taxpayer to assign payment heads', 'করদাতা নির্বাচন করুন')}
                  className="other-tax-taxpayer-tabs" data-testid="other-tax-taxpayer-tabs"
                  onScroll={() => {
                    const rail = taxpayerTabsRef.current;
                    if (rail) setRailEdges({ left: rail.scrollLeft > 2, right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 });
                  }}>
                  {taxpayers.map((person, index) => {
                    const selectedCount = lines.filter(line => line.taxpayerId === person.id).length;
                    const active = activeId === person.id;
                    const issues = invalidLines.filter(line => line.taxpayerId === person.id).length;
                    const noHead = firstMissingTaxpayer?.id === person.id && !firstInvalid;
                    const name = person.name.trim() || tx('Taxpayer', 'করদাতা') + ' ' + (index + 1);
                    return <button key={person.id} type="button"
                      aria-pressed={active} data-taxpayer-id={person.id}
                      data-invalid={issues > 0 || noHead ? 'true' : undefined}
                      aria-label={name + ', ' + tx('TIN', 'টিআইএন') + ' ' + person.tin + ', ' + selectedCount + ' ' + tx('selected', 'নির্বাচিত') + (issues || noHead ? ', ' + tx('incomplete', 'অসম্পূর্ণ') : '')}
                      title={name + ' · ' + person.tin} onClick={() => setActiveTaxpayer(person.id)}
                      className="other-tax-taxpayer-chip">
                      <span>{name}</span>
                      {selectedCount > 0 && <span className="other-tax-taxpayer-chip__count" aria-hidden="true">{selectedCount}</span>}
                      {(issues > 0 || noHead) && <span className="other-tax-taxpayer-chip__alert" aria-hidden="true">!</span>}
                    </button>;
                  })}
                </div>
                {railEdges.left && <button type="button" className="other-tax-taxpayer-nav__arrow other-tax-taxpayer-nav__arrow--left"
                  aria-label={tx('Previous taxpayers', 'আগের করদাতারা')} onClick={() => scrollTaxpayers(-1)}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>}
                {railEdges.right && <button type="button" className="other-tax-taxpayer-nav__arrow other-tax-taxpayer-nav__arrow--right"
                  aria-label={tx('Next taxpayers', 'পরের করদাতারা')} onClick={() => scrollTaxpayers(1)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>}
              </div>
            </div>}
            {taxpayers.length > 1 && <div className="other-tax-head-section__heading">
              <h2>{tx('Choose payment heads', 'পরিশোধের খাত নির্বাচন করুন')}</h2>
            </div>}
            {error && <p className="other-tax-error-heading">{tx('Review highlighted entries', 'চিহ্নিত তথ্য সংশোধন করুন')}</p>}
            <p className="other-tax-guidance">{taxpayers.length > 1
              ? tx('Select heads, year & amount. Switching taxpayers keeps selections.', 'খাত, করবর্ষ ও পরিমাণ দিন। করদাতা বদলালেও নির্বাচন থাকবে।')
              : tx('Select heads, year & amount.', 'খাত, করবর্ষ ও পরিমাণ দিন।')}</p>
            <div className="other-tax-head-tools">
              <label htmlFor="other-tax-head-filter" className="other-tax-head-tools__label sr-only">
                {tx('Find a payment head', 'পরিশোধের খাত খুঁজুন')}
              </label>
              <div className="other-tax-head-tools__row">
                <div className="other-tax-head-tools__search">
                  <Search size={17} aria-hidden="true" className="text-taxpay-primary shrink-0" />
                  <input id="other-tax-head-filter" type="search" value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={tx('Search name or code — e.g. 68A, motor car', 'নাম বা কোড দিয়ে খুঁজুন — যেমন 68A')}
                    className="w-full min-w-0 text-sm bg-transparent outline-none" />
                </div>
                <details ref={selectionMenuRef} className="other-tax-selection-menu" data-testid="other-tax-selection-menu"
                  onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); selectionMenuRef.current?.removeAttribute('open'); } }}>
                  <summary aria-label={tx('Selection actions', 'খাত নির্বাচনের ব্যবস্থা')}>
                    <ListChecks size={17} aria-hidden="true" />
                    <span>{tx('Select', 'নির্বাচন')}</span>
                    <ChevronDown size={16} aria-hidden="true" className="other-tax-selection-menu__chevron" />
                  </summary>
                  <div className="other-tax-selection-menu__panel" role="group" aria-label={tx('Payment head selection actions', 'পরিশোধের খাত নির্বাচনের ব্যবস্থা')}>
                    <button type="button" onClick={() => { selectAll(); selectionMenuRef.current?.removeAttribute('open'); }}
                      disabled={!visibleEligible.some(head => !activeLines.some(line => line.headId === head.id))}>
                      {search ? tx('Select all matching', 'মিল থাকা সব নির্বাচন করুন') : tx('Select all', 'সব নির্বাচন করুন')}
                    </button>
                    <button type="button" onClick={() => { unselectAll(); selectionMenuRef.current?.removeAttribute('open'); }}
                      disabled={!activeLines.length}>
                      {tx('Clear selection', 'নির্বাচন বাতিল করুন')}
                    </button>
                  </div>
                </details>
              </div>
            </div>
            <p className="other-tax-selection-status" role="status">
              {tx(new Set(activeLines.map(line => line.headId)).size + ' heads · ' + activeLines.length + ' years · ' + count + ' available Other Tax heads',
                 new Set(activeLines.map(line => line.headId)).size + 'টি খাত · ' + activeLines.length + 'টি করবর্ষ · ' + count + 'টি অন্যান্য করের খাত')}
            </p>
            {error && <div className="other-tax-error-summary" role="alert" data-testid="other-tax-validation-summary">
              <strong>{tx('Check highlighted payment entries', 'চিহ্নিত পরিশোধের তথ্য পরীক্ষা করুন')}</strong>
              <p>{error}</p>
              {firstInvalid && <button type="button" onClick={() => {
                setActiveTaxpayer(firstInvalid.taxpayerId);
                setQuery('');
              }}>{tx('Show first incomplete payment', 'প্রথম অসম্পূর্ণ পরিশোধ দেখুন')}</button>}
            </div>}
            <div className={error ? 'rounded-lg border border-rose-400' : 'rounded-lg border border-slate-200'} data-testid="other-tax-head-catalogue">
              {grouped.map(group => {
                const matched = group.rows.filter(head =>
                  !search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search));
                if (!matched.length) return null;
                const groupSelectedCount = group.rows.filter(head => activeLines.some(line => line.headId === head.id)).length;
                const groupErrors = invalidLines.filter(line => line.taxpayerId === activeId && group.rows.some(head => head.id === line.headId)).length;
                return <details key={group.name} open={search ? true : undefined}
                  className={groupErrors ? "group border-b border-rose-300 last:border-b-0 other-tax-group--invalid" : "group border-b border-slate-200 last:border-b-0"} data-head-group={group.name} data-invalid={groupErrors ? "true" : undefined}>
                  <summary className="cursor-pointer px-3 py-3 bg-slate-50 text-sm font-semibold text-taxpay-dark focus-visible:outline-2 focus-visible:outline-taxpay-primary">
                    {bn ? matched[0].grpBn : group.name}
                    <span className="text-slate-500 font-normal"> ({matched.length})</span>
                    {groupErrors > 0 && <span className="ml-2 text-rose-700 text-xs font-semibold">{groupErrors} {tx('incomplete', 'অসম্পূর্ণ')}</span>}
                    {groupSelectedCount > 0 && <span className="ml-2 text-taxpay-primary text-xs">
                      {groupSelectedCount} {tx('selected', 'নির্বাচিত')}
                    </span>}
                  </summary>
                  <ul className="divide-y divide-slate-200 list-none m-0 p-0">
                    {matched.map(head => {
                      const blocked = !isOtherTaxHeadEligible(head.id);
                      const headLines = activeLines.filter(line => line.headId === head.id);
                      const invalid = Boolean(error && headLines.some(isIncomplete));
                      const focused = headLines.some(line => line.id === focusRequest?.lineId);
                      const availableYears = OTHER_TAX_YEARS.filter(year => !headLines.some(line => line.assessmentYear === year));
                      return <li key={head.id} data-head-row={head.id} data-invalid={invalid ? 'true' : undefined}
                        data-highlighted={focused ? 'true' : undefined}
                        className={invalid ? 'other-tax-row--invalid' : focused ? 'other-tax-row--focused' : headLines.length ? 'bg-blue-50/40' : 'bg-white'}>
                        <label className={`flex gap-3 items-start px-3 py-3 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/60'}`}>
                          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#2c5ead]"
                            checked={headLines.length > 0} disabled={blocked}
                            onChange={event => toggleHead(head.id, event.target.checked)}
                            aria-label={tx('Select', 'নির্বাচন করুন') + ' ' + head.codeEn + ' — ' + head.en} />
                          <span className="min-w-0 text-sm">
                            <span className="block text-taxpay-dark">
                              <strong className="font-mono-plex">{head.codeEn}</strong> — {bn ? head.bn || head.en : head.en}
                            </span>
                            {head.bn && <span lang={bn ? 'en' : 'bn'} className="block text-xs text-slate-600 mt-1">
                              {bn ? head.en : head.bn}
                            </span>}
                            {blocked && <span className="block text-xs text-rose-700 mt-1">
                              {tx('Unavailable pending verification', 'যাচাই না হওয়া পর্যন্ত নির্বাচন করা যাবে না')}
                            </span>}
                          </span>
                        </label>
                        {headLines.map(line => {
                          const amountId = 'other-tax-amount-' + line.id;
                          const lineInvalid = Boolean(error && isIncomplete(line));
                          const suggestedAmount = suggestedFor(line.taxpayerId, head.id, line.assessmentYear);
                          return <div key={line.id}
                            className="other-tax-year-allocation"
                            data-testid="other-tax-line" data-head-id={head.id} data-line-id={line.id}
                            data-invalid={lineInvalid ? 'true' : undefined}
                            data-focused={focusRequest?.lineId === line.id ? 'true' : undefined}>
                            <div className="other-tax-year-allocation__fields">
                            <div>
                              <label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-year-${line.id}`}>
                                {tx('Assessment year', 'করবর্ষ')} *
                              </label>
                              <select id={`other-tax-year-${line.id}`} value={line.assessmentYear}
                                onChange={event => edit(line.id, { assessmentYear: event.target.value })}
                                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                                {OTHER_TAX_YEARS.filter(year => year === line.assessmentYear || !headLines.some(other => other.id !== line.id && other.assessmentYear === year))
                                  .map(year => <option key={year} value={year}>{year}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center gap-1">
                                <label className="text-xs font-semibold" htmlFor={amountId}>
                                  {tx('Payment amount (৳)', 'পরিশোধের পরিমাণ (৳)')} *
                                </label>
                                {suggestedAmount && line.amount === suggestedAmount.amount &&
                                  <SuggestedAmountInfo suggestion={suggestedAmount} language={language} controlId={amountId} />}
                              </div>
                              <input id={amountId} type="text" inputMode="decimal"
                                pattern="[0-9]+([.][0-9]{1,2})?" required
                                aria-invalid={lineInvalid || undefined}
                                aria-describedby={lineInvalid ? amountId + '-error' : undefined}
                                value={line.amount} onChange={event => {
                                  const next = normalizeGuestAmountInput(event.target.value);
                                  if (next !== null) edit(line.id, { amount: next });
                                }}
                                placeholder="0.00" maxLength={17}
                                className={lineInvalid
                                  ? 'min-h-11 w-full rounded-lg border border-rose-600 bg-white px-3 font-mono-plex text-sm'
                                  : 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-plex text-sm'} />
                              {lineInvalid && <p id={amountId + '-error'} className="payment-form-field-error">
                                {tx('Enter a positive amount using digits (up to 2 decimal places).',
                                  'সংখ্যা দিয়ে শূন্যের বেশি পরিমাণ লিখুন (সর্বোচ্চ ২ দশমিক স্থান)।')}
                              </p>}
                            </div>
                            {headLines.length > 1 && <button type="button" className="other-tax-year-remove"
                              onClick={() => onChange(lines.filter(item => item.id !== line.id))}
                              aria-label={tx('Remove assessment year', 'করবর্ষ মুছুন') + ': ' + line.assessmentYear}
                              title={tx('Remove assessment year', 'করবর্ষ মুছুন')}>
                              <Trash2 size={18} aria-hidden="true" />
                            </button>}
                            </div>
                          </div>;
                        })}
                        {headLines.length > 0 && availableYears.length > 0 &&
                          <button type="button" className="other-tax-add-year" onClick={() => addYear(head.id)}>
                            <Plus size={16} aria-hidden="true" /> {tx('Add another assessment year', 'আরেকটি করবর্ষ যোগ করুন')}
                          </button>}
                      </li>;
                    })}
                  </ul>
                </details>;
              })}
              {!grouped.some(group => group.rows.some(head => !search ||
                [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search))) &&
                <p className="p-4 text-sm text-slate-600">{tx('No matching payment head', 'কোনো খাত পাওয়া যায়নি')}</p>}
            </div>
            {error && usedTotal === null && invalidLines.length === 0 && <p className="payment-form-field-error">{tx('Combined amount exceeds the supported limit. Reduce the amounts.', 'মোট পরিমাণ সীমার বেশি। পরিমাণ কমান।')}</p>}

          </div>
        </section>
      </div>
      {summary}
    </div>
  );
}
