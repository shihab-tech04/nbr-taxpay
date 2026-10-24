import React, { useState } from 'react';
import { Search, Plus, Trash2, Lock } from 'lucide-react';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import { V11_PAYMENT_OPTIONS } from '../../data/v11PaymentOptions';
import { BLOCKED_HEAD_IDS } from '../../data/paymentHeads';
import { formatCurrency } from '../../services/numberFormat';
import { parseGuestAmount, sumGuestAmounts } from '../../services/guestAmount';
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
const GROUP_ORDER = ['Tax with Return', 'Advance Tax', 'Tax against Demand', 'Penalty', 'Appellate Tribunal', 'Others'] as const;
const liability = V11_SOURCE_HEADS.filter(head => head.journey === 'LIABILITY' && head.active);
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
  onChange: (lines: OtherTaxAllocation[]) => void;
  error?: string;
  summary?: React.ReactNode;
};

export function OtherTaxBatchComposer({ language, taxpayers, lines, onChange, error, summary }: Props) {
  const bn = language === 'bn';
  const tx = (en: string, bangla: string) => bn ? bangla : en;
  const [query, setQuery] = useState('');
  const [selectedTaxpayer, setSelectedTaxpayer] = useState('primary');
  const search = query.trim().toLocaleLowerCase();
  const count = grouped.reduce((n, group) => n + group.rows.length, 0);
  const addHead = (headId: number) => {
    if (!isOtherTaxHeadEligible(headId)) return;
    onChange([...lines, {
      id: crypto.randomUUID(),
      taxpayerId: taxpayers.some(item => item.id === selectedTaxpayer) ? selectedTaxpayer : taxpayers[0].id,
      headId,
      assessmentYear: '2026-27',
      amount: '',
    }]);
  };
  const edit = (id: string, update: Partial<OtherTaxAllocation>) =>
    onChange(lines.map(line => line.id === id ? { ...line, ...update } : line));
  const usedTotal = otherTaxAllocationTotal(lines);

  return (
    <div className="payment-form-layout payment-flow-embedded__payment" data-testid="other-tax-batch">
      <div className="payment-form-layout__sections">
        <section className="payment-form-section payment-form-section--static">
          <div className="payment-form-section__heading">
            <div className="payment-form-section__heading-copy">
              <h2>{tx('Search all payment heads', 'সব পরিশোধ খাত খুঁজুন')}</h2>
              <p>{tx(
                `${count} liability heads, grouped exactly as in the supplied v11 source. Source-tax deductions use the separate withholding journey.`,
                `v11 উৎস অনুযায়ী ${count}টি খাত উদ্দেশ্যভিত্তিক সাজানো। উৎসে কর কর্তন আলাদা যাত্রায়।`,
              )}</p>
            </div>
          </div>
          <div className="payment-form-section__body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label htmlFor="other-tax-head-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                  {tx('What are you paying for?', 'কী জন্য কর পরিশোধ করছেন?')}
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 min-h-11">
                  <Search size={17} aria-hidden="true" className="text-taxpay-primary shrink-0" />
                  <input id="other-tax-head-filter" type="search" value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={tx('Search purpose, head or code — e.g. advance, 16A', 'উদ্দেশ্য, খাত বা কোড দিয়ে খুঁজুন')}
                    className="w-full min-w-0 text-sm bg-transparent outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="other-tax-target" className="block text-xs font-semibold text-slate-700 mb-1">
                  {tx('Add selected head for taxpayer', 'যে করদাতার জন্য খাত যোগ করবেন')}
                </label>
                <select id="other-tax-target" value={taxpayers.some(t => t.id === selectedTaxpayer) ? selectedTaxpayer : taxpayers[0].id}
                  onChange={event => setSelectedTaxpayer(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {taxpayers.map((t, i) => <option key={t.id} value={t.id}>{t.name || tx('Taxpayer', 'করদাতা') + ' ' + (i + 1)} · {t.tin}</option>)}
                </select>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-200"
              role="region" aria-label={tx('Grouped v11 payment heads', 'v11 খাতের তালিকা')} tabIndex={0}>
              {grouped.map(group => {
                const matched = group.rows.filter(head =>
                  !search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search));
                if (!matched.length) return null;
                return <details key={group.name} open={search ? true : undefined}
                  className="group" data-head-group={group.name}>
                  <summary className="cursor-pointer px-3 py-3 bg-slate-50 text-xs font-bold text-taxpay-dark">
                    {bn ? matched[0].grpBn : group.name} <span className="text-slate-500">({matched.length})</span>
                  </summary>
                  <ul className="divide-y divide-slate-100 list-none">
                    {matched.map(head => {
                      const blocked = !isOtherTaxHeadEligible(head.id);
                      return <li key={head.id} className="flex gap-3 items-start justify-between px-3 py-3">
                        <div className="min-w-0 text-xs">
                          <p><strong className="font-mono-plex">{head.codeEn}</strong> — {bn ? head.bn || head.en : head.en}</p>
                          {head.bn && <p lang={bn ? 'en' : 'bn'} className="text-slate-600 mt-1">{bn ? head.en : head.bn}</p>}
                          {head.note && <p className="text-slate-600 mt-1">{head.note}</p>}
                          {blocked && <p className="text-rose-700 mt-1">{tx('Unavailable pending owner review', 'মালিকের যাচাই পর্যন্ত অনুপলব্ধ')}</p>}
                        </div>
                        <button type="button" disabled={blocked} onClick={() => addHead(head.id)}
                          aria-label={tx('Add', 'যোগ করুন') + ' ' + head.codeEn}
                          className="shrink-0 min-h-11 inline-flex gap-1 items-center rounded-lg border border-taxpay-primary px-3 font-semibold text-taxpay-primary disabled:opacity-50 disabled:border-slate-300">
                          {blocked ? <Lock size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                          {tx('Add', 'যোগ')}
                        </button>
                      </li>;
                    })}
                  </ul>
                </details>;
              })}
              {!grouped.some(g => g.rows.some(h => !search || [h.codeEn, h.en, h.bn || '', h.grpEn, h.grpBn].join(' ').toLocaleLowerCase().includes(search))) &&
                <p className="p-4 text-sm text-slate-600">{tx('No matching payment head', 'কোনো খাত পাওয়া যায়নি')}</p>}
            </div>
          </div>
        </section>
        <section className="payment-form-section payment-form-section--static">
          <div className="payment-form-section__heading">
            <div className="payment-form-section__heading-copy">
              <h2>{tx('Selected payment heads', 'নির্বাচিত পেমেন্ট খাত')} ({lines.length})</h2>
              <p>{tx('Each entry has its own taxpayer, assessment year and amount. The same head can be added for more than one taxpayer.', 'প্রতিটি খাতের করদাতা, করবর্ষ ও পরিমাণ আলাদা। একাধিক করদাতার জন্য একই খাত যোগ করা যাবে।')}</p>
            </div>
          </div>
          <div className="payment-form-section__body space-y-3">
            {lines.length === 0 && <p className="text-sm text-slate-600">{tx('Choose one or more heads from the grouped list.', 'উপরের তালিকা থেকে এক বা একাধিক খাত বেছে নিন।')}</p>}
            {lines.map((line, index) => {
              const head = otherTaxAllocationHead(line.headId);
              return <article key={line.id} className="rounded-lg border border-slate-200 p-3 space-y-3" data-testid="other-tax-line">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-taxpay-dark">{index + 1}. {head?.economicCode} — {bn ? head?.nameBn : head?.nameEn}</h3>
                  <button type="button" aria-label={tx('Remove payment head', 'খাত মুছুন') + ' ' + (head?.economicCode || '')}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-slate-200 text-red-700"
                    onClick={() => onChange(lines.filter(item => item.id !== line.id))}>
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-person-${line.id}`}>{tx('Taxpayer', 'করদাতা')} *</label>
                    <select id={`other-tax-person-${line.id}`} value={line.taxpayerId}
                      onChange={e => edit(line.id, { taxpayerId: e.target.value })}
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-2 text-sm">
                      {taxpayers.map((t, i) => <option key={t.id} value={t.id}>{t.name || tx('Taxpayer','করদাতা') + ' ' + (i + 1)} · {t.tin}</option>)}
                    </select></div>
                  <div><label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-year-${line.id}`}>{tx('Assessment year', 'করবর্ষ')} *</label>
                    <select id={`other-tax-year-${line.id}`} value={line.assessmentYear}
                      onChange={e => edit(line.id, { assessmentYear: e.target.value })}
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-2 text-sm">
                      {OTHER_TAX_YEARS.map(y => <option key={y}>{y}</option>)}
                    </select></div>
                  <div><label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-amount-${line.id}`}>{tx('Payment amount (৳)', 'পরিশোধের পরিমাণ (৳)')} *</label>
                    <input id={`other-tax-amount-${line.id}`} type="text" inputMode="decimal"
                      value={line.amount} onChange={e => edit(line.id, { amount: e.target.value })}
                      placeholder="0.00" maxLength={17} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono-plex text-sm" />
                  </div>
                </div>
              </article>;
            })}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-between items-center border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold">{tx('Total', 'মোট')}</span>
              <strong className="font-mono-plex text-taxpay-primary">{usedTotal === null ? '—' : formatCurrency(usedTotal, language)}</strong>
            </div>
          </div>
        </section>
      </div>
      {summary}
    </div>
  );
}
