import React, { useState } from 'react';
import { Search } from 'lucide-react';
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
  onChange: (lines: OtherTaxAllocation[]) => void;
  error?: string;
  summary?: React.ReactNode;
};

export function OtherTaxBatchComposer({ language, taxpayers, lines, onChange, error, summary }: Props) {
  const bn = language === 'bn';
  const tx = (en: string, bangla: string) => bn ? bangla : en;
  const [query, setQuery] = useState('');
  const [activeTaxpayer, setActiveTaxpayer] = useState('primary');
  const activeId = taxpayers.some(person => person.id === activeTaxpayer)
    ? activeTaxpayer : taxpayers[0]?.id;
  const activePerson = taxpayers.find(person => person.id === activeId);
  const activeLines = lines.filter(line => line.taxpayerId === activeId);
  const search = query.trim().toLocaleLowerCase();
  const count = grouped.reduce((n, group) => n + group.rows.length, 0);
  const usedTotal = otherTaxAllocationTotal(lines);

  // One selection per taxpayer and source head. Selecting a different taxpayer
  // does not change, duplicate or remove another taxpayer's allocations.
  const toggleHead = (headId: number, checked: boolean) => {
    if (!activeId || !isOtherTaxHeadEligible(headId)) return;
    if (!checked) {
      onChange(lines.filter(line => !(line.taxpayerId === activeId && line.headId === headId)));
    } else if (!lines.some(line => line.taxpayerId === activeId && line.headId === headId)) {
      onChange([...lines, {
        id: crypto.randomUUID(), taxpayerId: activeId, headId,
        assessmentYear: '2026-27', amount: '',
      }]);
    }
  };
  const edit = (id: string, update: Partial<OtherTaxAllocation>) =>
    onChange(lines.map(line => line.id === id ? { ...line, ...update } : line));

  return (
    <div className="payment-form-layout payment-flow-embedded__payment" data-testid="other-tax-batch">
      <div className="payment-form-layout__sections">
        <section className="payment-form-section payment-form-section--static">
          <div className="payment-form-section__heading">
            <div className="payment-form-section__heading-copy">
              <h2>{tx('Choose payment heads', 'পরিশোধের খাত নির্বাচন করুন')}</h2>
              <p>{tx('Choose a taxpayer, then tick the payment heads. Enter the year and amount directly below each selection.',
                'করদাতা নির্বাচন করে খাতে টিক দিন। নির্বাচিত খাতের নিচেই করবর্ষ ও পরিমাণ লিখুন।')}</p>
            </div>
          </div>
          <div className="payment-form-section__body space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                {tx('Paying tax for', 'যার কর পরিশোধ করছেন')}
              </p>
              <div role="group" aria-label={tx('Choose a taxpayer to assign payment heads', 'করদাতা নির্বাচন করুন')}
                className="flex flex-wrap gap-2" data-testid="other-tax-taxpayer-tabs">
                {taxpayers.map((person, index) => {
                  const selectedCount = lines.filter(line => line.taxpayerId === person.id).length;
                  const active = activeId === person.id;
                  return <button key={person.id} type="button"
                    aria-pressed={active} onClick={() => setActiveTaxpayer(person.id)}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary ${active
                      ? 'border-taxpay-primary bg-blue-50 text-taxpay-dark font-semibold'
                      : 'border-slate-300 bg-white text-slate-700'}`}>
                    <span className="block">{person.name.trim() || tx('Taxpayer', 'করদাতা') + ' ' + (index + 1)}</span>
                    <span className="block text-xs font-mono-plex">{person.tin} · {selectedCount} {tx('selected', 'নির্বাচিত')}</span>
                  </button>;
                })}
              </div>
              {taxpayers.length > 1 && <p className="mt-2 text-xs text-slate-600">
                {tx('Switch taxpayers here to select different heads. Other taxpayers’ selections are preserved.',
                  'অন্য করদাতার খাত নির্বাচন করতে এখানে করদাতা বদলান। পূর্বের নির্বাচন অপরিবর্তিত থাকবে।')}
              </p>}
            </div>
            <div>
              <label htmlFor="other-tax-head-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                {tx('Find a payment head', 'পরিশোধের খাত খুঁজুন')}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 min-h-11">
                <Search size={17} aria-hidden="true" className="text-taxpay-primary shrink-0" />
                <input id="other-tax-head-filter" type="search" value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={tx('Search name or code — e.g. 68A, motor car', 'নাম বা কোড দিয়ে খুঁজুন — যেমন 68A')}
                  className="w-full min-w-0 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <p className="text-xs text-slate-600" role="status">
              {tx(`${activeLines.length} heads selected for ${activePerson?.name || activePerson?.tin || 'this taxpayer'} · ${count} available Other Tax heads in ${GROUP_ORDER.length} groups`,
                `এই করদাতার জন্য ${activeLines.length}টি খাত নির্বাচিত · অন্যান্য করের জন্য ${count}টি খাত, ${GROUP_ORDER.length}টি গ্রুপ`)}
            </p>
            <div className="rounded-lg border border-slate-200" data-testid="other-tax-head-catalogue">
              {grouped.map(group => {
                const matched = group.rows.filter(head =>
                  !search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search));
                if (!matched.length) return null;
                const groupSelectedCount = group.rows.filter(head => activeLines.some(line => line.headId === head.id)).length;
                return <details key={group.name} open={search ? true : undefined}
                  className="group border-b border-slate-200 last:border-b-0" data-head-group={group.name}>
                  <summary className="cursor-pointer px-3 py-3 bg-slate-50 text-sm font-semibold text-taxpay-dark focus-visible:outline-2 focus-visible:outline-taxpay-primary">
                    {bn ? matched[0].grpBn : group.name}
                    <span className="text-slate-500 font-normal"> ({matched.length})</span>
                    {groupSelectedCount > 0 && <span className="ml-2 text-taxpay-primary text-xs">
                      {groupSelectedCount} {tx('selected', 'নির্বাচিত')}
                    </span>}
                  </summary>
                  <ul className="divide-y divide-slate-200 list-none m-0 p-0">
                    {matched.map(head => {
                      const blocked = !isOtherTaxHeadEligible(head.id);
                      const selectedLine = activeLines.find(line => line.headId === head.id);
                      return <li key={head.id} className={selectedLine ? 'bg-blue-50/40' : 'bg-white'}>
                        <label className={`flex gap-3 items-start px-3 py-3 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/60'}`}>
                          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#2c5ead]"
                            checked={!!selectedLine} disabled={blocked}
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
                        {selectedLine && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3 pl-10"
                          data-testid="other-tax-line" data-head-id={head.id}>
                          <div>
                            <label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-year-${selectedLine.id}`}>
                              {tx('Assessment year', 'করবর্ষ')} *
                            </label>
                            <select id={`other-tax-year-${selectedLine.id}`} value={selectedLine.assessmentYear}
                              onChange={event => edit(selectedLine.id, { assessmentYear: event.target.value })}
                              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                              {OTHER_TAX_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" htmlFor={`other-tax-amount-${selectedLine.id}`}>
                              {tx('Payment amount (৳)', 'পরিশোধের পরিমাণ (৳)')} *
                            </label>
                            <input id={`other-tax-amount-${selectedLine.id}`} type="text" inputMode="decimal"
                              value={selectedLine.amount} onChange={event => edit(selectedLine.id, { amount: event.target.value })}
                              placeholder="0.00" maxLength={17}
                              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-plex text-sm" />
                          </div>
                        </div>}
                      </li>;
                    })}
                  </ul>
                </details>;
              })}
              {!grouped.some(group => group.rows.some(head => !search ||
                [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search))) &&
                <p className="p-4 text-sm text-slate-600">{tx('No matching payment head', 'কোনো খাত পাওয়া যায়নি')}</p>}
            </div>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold">{tx('Total for all taxpayers', 'সব করদাতার মোট')}</span>
              <strong className="font-mono-plex text-taxpay-primary" data-testid="other-tax-combined-total">
                {usedTotal === null ? '—' : formatCurrency(usedTotal, language)}
              </strong>
            </div>
          </div>
        </section>
      </div>
      {summary}
    </div>
  );
}
