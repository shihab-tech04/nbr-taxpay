import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ListChecks, Plus, Search, Trash2 } from 'lucide-react';
import { SuggestedAmountInfo } from '../ui/SuggestedAmountInfo';
import { paymentAmountSuggestionFor } from '../../services/paymentAmountSuggestions';
import type { DemoUserId } from '../../data/demoUsers';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import { V11_PAYMENT_OPTIONS } from '../../data/v11PaymentOptions';
import { BLOCKED_HEAD_IDS } from '../../data/paymentHeads';
import { fitsCombinedAllocationCapacity, MAX_COMBINED_ALLOCATIONS } from '../../services/otherTaxCombinedPayment';
import { parseGuestAmount, sumGuestAmounts, normalizeGuestAmountInput } from '../../services/guestAmount';
import type { Language } from '../../types/tax';
import { RETURN_HEAD_ID } from '../../services/taxWithReturnContract';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { getDemoStoryPaymentHistory, type SimulationUser } from '../../services/simulatedPaymentsApi';
import { rankFrequentTaxHeadIds } from '../../services/paymentFrequentCategories';
import { getAccountStoryPayments } from '../../services/story1AccountPaymentHistory';
import { paymentDraftOwnerScope } from '../../services/accountPaymentFormDrafts';
import { activePreviewSession } from '../../services/previewAccountSession';
import '../../styles/taxpay-category-directory.css';

export type OtherTaxTaxpayer = { id: string; tin: string; name: string };
export type OtherTaxAllocation = {
  id: string;
  taxpayerId: string;
  headId: number;
  assessmentYear: string;
  amount: string;
};

export const OTHER_TAX_YEARS = ['2027-28', '2026-27', '2025-26', '2024-25'] as const;
// The owner's only head-mixing exception is Tax with Return. Source Tax
// accounting heads can be combined with other supported non-return heads,
// but never with Return (which has its own distinct service and journey).
const GROUP_ORDER = ['Advance Tax', 'Tax against Demand', 'Penalty', 'Appellate Tribunal', 'Others', 'Source Tax'] as const;
const liability = V11_SOURCE_HEADS.filter(head =>
  head.active && head.purpose !== 'return' && head.grpEn !== 'Tax with Return' &&
  (head.journey === 'LIABILITY' || head.journey === 'WITHHOLDING')
);
const grouped = GROUP_ORDER.map(name => ({ name, rows: liability.filter(head => head.grpEn === name) }));
// Both backend history APIs are owner/capability-scoped and read-only. Do not
// rank by TIN, public fixtures, guessed preferences or browser cache.
type CategoryHistory = { status: 'signed-out' | 'loading' | 'ready' | 'unavailable'; ownerKey: string; headIds: number[] };
// Tax with Return shares the Walk-in catalogue UI; its one-year accounting
// contract and original return service classification remain unchanged.
const returnHead = V11_SOURCE_HEADS.find(head => head.id === RETURN_HEAD_ID &&
  head.purpose === 'return' && head.map === 'MAPPED');
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
  /** Parallel entry masks taxpayer identifiers in tab metadata; other payment screens preserve their existing labels. */
  maskTaxpayerTin?: boolean;
  /** Keep original paid amounts when a Pay Again draft reselects a required year. */
  preserveSourcePaymentAmounts?: boolean;
  onChange: (lines: OtherTaxAllocation[]) => void;
  error?: string;
  summary?: React.ReactNode;
  /** Use the fixed TaxPay service selection without duplicating the head editor. */
  serviceSelection?: React.ReactNode;
  /** Frozen All Tax Payments v3 labels without changing the shared composer. */
  unifiedV3?: boolean;
  /** New All Tax Payments v5 combines Return with other supported heads. */
  allowMixedReturn?: boolean;
  /** The current payment journey is account-owned. Walk-in never shows account suggestions. */
  showFrequentCategories?: boolean;
  /** Optional challan comments stay inside the editor scroll column. */
  remarks?: React.ReactNode;
  focusRequest?: { lineId: string; requestId: number } | null;
  /** Optional editor focus sync for the original payment calculation. */
  onFocusLine?: (lineId: string) => void;
  /** Approved calculation treatment applies only to Facilitate another taxpayer. */
  originalFacilitation?: boolean;
};

export function OtherTaxBatchComposer({ language, taxpayers, lines, suggestionTaxpayerIds, maskTaxpayerTin = false, preserveSourcePaymentAmounts = false, onChange, error, summary, serviceSelection, unifiedV3 = false, allowMixedReturn = false, showFrequentCategories = false, remarks, focusRequest, onFocusLine, originalFacilitation = false }: Props) {
  const bn = language === 'bn';
  const tx = (en: string, bangla: string) => bn ? bangla : en;
  const { previewAccount } = useTaxState();
  const { user } = useAccountIdentity();
  // Partition pending/ready history by its actual account, not a recipient TIN.
  const ownerKey = user?.id ? paymentDraftOwnerScope({kind:'authenticated',userId:user.id})
    : previewAccount?.id && activePreviewSession()?.profileId===previewAccount.id
      ? paymentDraftOwnerScope({kind:'preview',profileId:previewAccount.id}) : '';
  const [categoryHistory, setCategoryHistory] = useState<CategoryHistory>({ status: 'signed-out', ownerKey: '', headIds: [] });
  useEffect(() => {
    // Even a signed-in user who intentionally selected Walk-in must not
    // request account history or see personalized categories here.
    if (!allowMixedReturn || !showFrequentCategories || !ownerKey) {
      setCategoryHistory({ status: 'signed-out', ownerKey: '', headIds: [] });
      return;
    }
    let current = true;
    setCategoryHistory({ status: 'loading', ownerKey, headIds: [] });
    // Both reads use the existing account-bound history capability. The
    // general simulation ledger only exposes category codes, not exact heads.
    const history = !user?.id && previewAccount?.id
      ? getDemoStoryPaymentHistory(previewAccount.id as SimulationUser, 'payer').then(rows=>rows.filter(row=>row.payer===previewAccount.id&&row.simulationOnly===true))
      : getAccountStoryPayments(user!.id,{claimPending:false}).then(rows => rows.map(row => ({
          state: row.status === 'SIMULATED_SUCCESS' ? 'SIMULATED' : row.status,
          createdAt: row.createdAt,
          allocations: Array.isArray(row.details.receiptLines) ? row.details.receiptLines :
            Array.isArray(row.details.lines) ? row.details.lines : [],
        })));
    const catalogue = new Map(V11_PAYMENT_OPTIONS.filter(head =>
      isOtherTaxHeadEligible(head.id) || (Boolean(returnHead) && head.id === RETURN_HEAD_ID))
      .map(head => [head.id, head.economicCode] as const));
    history.then(transactions => {
      if (!current) return;
      setCategoryHistory({ status: 'ready', ownerKey, headIds: rankFrequentTaxHeadIds(transactions, catalogue) });
    }).catch(() => { if (current) setCategoryHistory({ status: 'unavailable', ownerKey, headIds: [] }); });
    return () => { current = false; };
  }, [allowMixedReturn, showFrequentCategories, ownerKey, previewAccount?.id, user?.id]);
  const [query, setQuery] = useState('');
  // The existing head editor is the category list. Do not add a second directory
  // or hide the approved checkbox/year/amount controls behind View heads.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allocationLimitError, setAllocationLimitError] = useState(false);
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
  useEffect(() => {
    if (!allowMixedReturn || !activeCategory || query.trim()) return;
    const details = Array.from(rootRef.current?.querySelectorAll<HTMLDetailsElement>('[data-head-group]') ?? [])
      .find(node => node.getAttribute('data-head-group') === activeCategory);
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    details.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  }, [activeCategory, allowMixedReturn, query]);
  const selectableGroups = allowMixedReturn && returnHead
    ? [{ name: 'Tax with Return', rows: [returnHead] }, ...grouped]
    : grouped;
  const headEligible = (headId: number) => isOtherTaxHeadEligible(headId) ||
    (allowMixedReturn && Boolean(returnHead) && headId === RETURN_HEAD_ID);
  const eligibleLine = (line: OtherTaxAllocation) => headEligible(line.headId);
  const search = query.trim().toLocaleLowerCase();
  // Shortcuts navigate to the original editor; they do not select a head,
  // add a line, copy an amount, modify a draft or mutate Pay Again state.
  const frequentHeads = categoryHistory.headIds.flatMap(id => {
    const group = selectableGroups.find(item => item.rows.some(head => head.id === id));
    const head = group?.rows.find(item => item.id === id);
    return head && headEligible(id) ? [head] : [];
  });
  const openFrequentHead = (id: number) => {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-head-row="${id}"]`);
    const group = row?.closest('details');
    if (!row || !group) return;
    group.open = true;
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    row.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus({ preventScroll: true });
  };
  const categoryQuickLinks = () => (
    <div className="other-tax-category-shortcuts" data-testid="frequent-tax-categories"
      role="group" aria-label={tx('Frequently used tax payment heads', 'বেশি ব্যবহৃত করের খাত')}>
      {frequentHeads.map(head =>
        <button key={head.id} type="button" data-frequent-head-id={head.id}
          onClick={() => openFrequentHead(head.id)}>
          <span className="other-tax-frequent-head__copy"><small>{head.codeEn}</small>
            <span>{bn ? head.bn || head.en : head.en}</span></span>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
  const count = selectableGroups.reduce((n, group) => n + (maskTaxpayerTin
    ? group.rows.filter(head => headEligible(head.id)).length
    : group.rows.length), 0);
  const usedTotal = otherTaxAllocationTotal(lines);
  const isIncomplete = (line: OtherTaxAllocation) =>
    otherTaxAllocationAmount(line) === null || !eligibleLine(line) ||
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
    if (allowMixedReturn && firstInvalid) {
      const groupName = selectableGroups.find(group => group.rows.some(head => head.id === firstInvalid.headId))?.name;
      if (groupName && activeCategory !== groupName) {
        setActiveCategory(groupName);
        return;
      }
    }
    rootRef.current?.querySelectorAll<HTMLDetailsElement>('[data-head-group]').forEach(group => {
      if (group.querySelector('[data-invalid="true"]')) group.open = true;
    });
  }, [error, activeId, firstInvalid?.id, firstInvalid?.headId, firstMissingTaxpayer?.id, query, allowMixedReturn]);

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
    if (allowMixedReturn) {
      const groupName = selectableGroups.find(group => group.rows.some(head => head.id === selected.headId))?.name;
      if (groupName && activeCategory !== groupName) {
        setActiveCategory(groupName);
        return;
      }
    }
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-head-row="${selected.headId}"]`);
    const group = row?.closest('details');
    if (group) group.open = true;
    lastFocusRequest.current = focusRequest.requestId;
    const input = rootRef.current?.querySelector<HTMLInputElement>(`#other-tax-amount-${selected.id}`);
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  }, [focusRequest, activeId, query, lines, allowMixedReturn, activeCategory]);

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
  const visibleEligible = selectableGroups.flatMap(group => group.rows).filter(head =>
    headEligible(head.id) &&
    (!search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search)));
  // Do not silently truncate Select All or let the UI exceed SQL's hard limit.
  const applyLines = (candidate: OtherTaxAllocation[]) => {
    if (!fitsCombinedAllocationCapacity(candidate.length)) {
      setAllocationLimitError(true);
      return;
    }
    setAllocationLimitError(false);
    onChange(candidate);
  };
  const selectAll = () => {
    if (!activeId) return;
    const additions = visibleEligible.filter(head => !activeLines.some(line => line.headId === head.id))
      .map(head => head.id === RETURN_HEAD_ID ? { ...newLine(head.id), amount: '' } : newLine(head.id));
    if (additions.length) applyLines([...lines, ...additions]);
  };
  const unselectAll = () => {
    if (activeId && activeLines.length) applyLines(lines.filter(line => line.taxpayerId !== activeId));
  };
  // A head may be selected once per assessment year for each taxpayer.
  const toggleHead = (headId: number, checked: boolean) => {
    if (!activeId || !headEligible(headId)) return;
    if (!checked) applyLines(lines.filter(line => !(line.taxpayerId === activeId && line.headId === headId)));
    else if (!activeLines.some(line => line.headId === headId)) applyLines([...lines,
      headId === RETURN_HEAD_ID ? { ...newLine(headId), amount: '' } : newLine(headId)]);
  };
  const addYear = (headId: number) => {
    const chosen = new Set(activeLines.filter(line => line.headId === headId).map(line => line.assessmentYear));
    const year = OTHER_TAX_YEARS.find(candidate => !chosen.has(candidate));
    if (activeId && year && headId !== RETURN_HEAD_ID && isOtherTaxHeadEligible(headId)) applyLines([...lines, newLine(headId, year)]);
  };
  const edit = (id: string, update: Partial<OtherTaxAllocation>) => {
    const current = lines.find(line => line.id === id);
    if (!current) return;
    if (update.assessmentYear && lines.some(line => line.id !== id && line.taxpayerId === current.taxpayerId &&
      line.headId === current.headId && line.assessmentYear === update.assessmentYear)) return;
    // A User1 example amount is tied to one year; other taxpayers keep manual values.
    const nextSuggestion = update.assessmentYear
      ? suggestedFor(current.taxpayerId, current.headId, update.assessmentYear) : null;
    const amount = update.amount ?? (update.assessmentYear && !preserveSourcePaymentAmounts && suggestionTaxpayerIds?.[current.taxpayerId] === 'user1'
      ? nextSuggestion?.amount ?? '' : current.amount);
    applyLines(lines.map(line => line.id === id ? { ...line, ...update, amount } : line));
  };

  return (
    <div ref={rootRef} className={allowMixedReturn ? "payment-form-layout payment-flow-embedded__payment other-tax-batch-panel other-tax-batch-panel--unified-v5" : "payment-form-layout payment-flow-embedded__payment other-tax-batch-panel"} data-testid="other-tax-batch"
      data-original-facilitation={originalFacilitation ? "true" : undefined}>
      <div className="payment-form-layout__sections">
        {serviceSelection}
        <section className={error ? "payment-form-section payment-form-section--static other-tax-section--invalid" : "payment-form-section payment-form-section--static"}>
          <div className="payment-form-section__heading">
            <div className="payment-form-section__heading-copy">
              <h2>{taxpayers.length > 1 || allowMixedReturn ? tx('Paying tax for', 'যার কর পরিশোধ করছেন') : tx('Choose payment heads', 'পরিশোধের খাত নির্বাচন করুন')}</h2>
            </div>
          </div>
          <div className="payment-form-section__body space-y-4">
            {(taxpayers.length > 1 || allowMixedReturn) && <div className="other-tax-taxpayer-section">
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
                    const visibleTin = maskTaxpayerTin ? person.tin.slice(0, 3) + '****' : person.tin;
                    return <button key={person.id} type="button"
                      aria-pressed={active} data-taxpayer-id={person.id}
                      data-invalid={issues > 0 || noHead ? 'true' : undefined}
                      aria-label={name + ', ' + tx('TIN', 'টিআইএন') + ' ' + visibleTin + ', ' + selectedCount + ' ' + tx('selected', 'নির্বাচিত') + (issues || noHead ? ', ' + tx('incomplete', 'অসম্পূর্ণ') : '')}
                      title={name + ' · ' + visibleTin} onClick={() => setActiveTaxpayer(person.id)}
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
            {!allowMixedReturn && taxpayers.length > 1 && <div className="other-tax-head-section__heading">
              <h2>{tx('Choose payment heads', 'পরিশোধের খাত নির্বাচন করুন')}</h2>
            </div>}
            {error && <p className="other-tax-error-heading">{tx('Review highlighted entries', 'চিহ্নিত তথ্য সংশোধন করুন')}</p>}
            {allowMixedReturn && <h3 className="unified-v5-row-heading">{tx('Search and select','খুঁজুন ও নির্বাচন করুন')}</h3>}
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
                    <span>{unifiedV3 ? tx('Select', 'নির্বাচন') : tx('Bulk actions', 'একসাথে নির্বাচন')}</span>
                    <ChevronDown size={16} aria-hidden="true" className="other-tax-selection-menu__chevron" />
                  </summary>
                  <div className="other-tax-selection-menu__panel" role="group" aria-label={tx('Payment head selection actions', 'পরিশোধের খাত নির্বাচনের ব্যবস্থা')}>
                    <button type="button" onClick={() => { selectAll(); selectionMenuRef.current?.removeAttribute('open'); }}
                      disabled={!visibleEligible.some(head => !activeLines.some(line => line.headId === head.id))}>
                      {search ? tx('Select all matching', 'মিল থাকা সব নির্বাচন করুন') : tx('Select all', 'সব নির্বাচন করুন')}
                    </button>
                    {(!originalFacilitation || unifiedV3) && <button type="button" onClick={() => { unselectAll(); selectionMenuRef.current?.removeAttribute('open'); }}
                      disabled={!activeLines.length}>
                      {tx('Clear selection', 'নির্বাচন বাতিল করুন')}
                    </button>}
                  </div>
                </details>
                {originalFacilitation && !unifiedV3 && <button type="button" className="other-tax-clear-selection"
                  disabled={!activeLines.length} onClick={unselectAll}>
                  {tx('Clear selected', 'নির্বাচন মুছুন')}
                </button>}
              </div>
            </div>
            {allowMixedReturn && !search && showFrequentCategories && categoryHistory.ownerKey === ownerKey &&
              categoryHistory.status === 'ready' && frequentHeads.length > 0 && (
                <section className="other-tax-category-shortcut-section" data-testid="frequent-category-section">
                  <h3>{tx('Frequently used tax payment heads', 'বেশি ব্যবহৃত করের খাত')}</h3>
                  {categoryQuickLinks()}
                </section>
              )}
             {allowMixedReturn && <h3 className="unified-v5-row-heading unified-v5-tax-head-heading">{tx('Tax head','করের খাত')}</h3>}
            <p className="other-tax-selection-status" role="status">
              {unifiedV3
                ? tx(new Set(activeLines.map(line => line.headId)).size + ' heads · ' + activeLines.length + ' years · ' + count + ' available payment heads',
                     new Set(activeLines.map(line => line.headId)).size + 'টি খাত · ' + activeLines.length + 'টি করবর্ষ · ' + count + 'টি করের খাত')
                : activeLines.length
                ? tx(new Set(activeLines.map(line => line.headId)).size + ' heads · ' + activeLines.length + ' assessment years selected',
                  new Set(activeLines.map(line => line.headId)).size + 'টি খাত · ' + activeLines.length + 'টি করবর্ষ নির্বাচিত')
                : tx(count + ' payment heads available', count + 'টি করের খাত উপলব্ধ')}
            </p>
            {allocationLimitError && <p className="payment-form-field-error" role="alert" data-testid="combined-allocation-capacity-error">
              {tx('This payment supports up to ' + MAX_COMBINED_ALLOCATIONS + ' beneficiary/head/year allocations. Remove some selections before adding more.',
                  'এই পেমেন্টে সর্বোচ্চ ' + MAX_COMBINED_ALLOCATIONS + 'টি করদাতা/খাত/করবর্ষ বণ্টন রাখা যাবে। নতুন খাত যোগ করতে কিছু নির্বাচন সরান।')}
            </p>}
            {error && <div className="other-tax-error-summary" role="alert" data-testid="other-tax-validation-summary">
              <strong>{tx('Check highlighted payment entries', 'চিহ্নিত পরিশোধের তথ্য পরীক্ষা করুন')}</strong>
              <p>{error}</p>
              {firstInvalid && <button type="button" onClick={() => {
                setActiveTaxpayer(firstInvalid.taxpayerId);
                setQuery('');
              }}>{tx('Show first incomplete payment', 'প্রথম অসম্পূর্ণ পরিশোধ দেখুন')}</button>}
            </div>}
            {allowMixedReturn && <h3 className="other-tax-category-heading">{tx('Choose a tax category', 'করের শ্রেণি নির্বাচন করুন')}</h3>}
            <div className="other-tax-catalogue-shell" data-testid={allowMixedReturn ? 'fixed-tax-categories' : undefined}>
              <div className={error ? 'rounded-lg border border-rose-400' : 'rounded-lg border border-slate-200'}
                data-testid="other-tax-head-catalogue">
              {selectableGroups.map(group => {
                const matched = group.rows.filter(head =>
                  !search || [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search));
                if (!matched.length) return null;
                const groupSelectedCount = group.rows.filter(head => activeLines.some(line => line.headId === head.id)).length;
                const groupErrors = invalidLines.filter(line => line.taxpayerId === activeId && group.rows.some(head => head.id === line.headId)).length;
                return <details key={group.name} open={search ? true : undefined}
                  data-testid={group.name === 'Tax with Return' ? 'unified-v5-return-group' : undefined}
                  className={groupErrors ? "group border-b border-rose-300 last:border-b-0 other-tax-group--invalid" : "group border-b border-slate-200 last:border-b-0"} data-head-group={group.name} data-invalid={groupErrors ? "true" : undefined}>
                  <summary className="other-tax-category-trigger cursor-pointer px-3 py-3 bg-slate-50 text-sm font-semibold text-taxpay-dark focus-visible:outline-2 focus-visible:outline-taxpay-primary">
                    <span className="other-tax-category-trigger__name">{bn ? matched[0].grpBn : group.name}</span>
                    <span className="other-tax-category-trigger__count">{matched.length} {matched.length === 1 ? tx('head', 'খাত') : tx('heads', 'খাত')}</span>
                    {groupErrors > 0 && <span className="other-tax-category-trigger__error">{groupErrors} {tx('incomplete', 'অসম্পূর্ণ')}</span>}
                    {groupSelectedCount > 0 && <span className="other-tax-category-trigger__selected">
                      {groupSelectedCount} {tx('selected', 'নির্বাচিত')}
                    </span>}
                    <ChevronDown className="other-tax-category-trigger__chevron" size={18} aria-hidden="true" />
                  </summary>
                  <ul className="divide-y divide-slate-200 list-none m-0 p-0">
                    {matched.map(head => {
                      const blocked = !headEligible(head.id);
                      const headLines = activeLines.filter(line => line.headId === head.id);
                      const invalid = Boolean(error && headLines.some(isIncomplete));
                      const focused = headLines.some(line => line.id === focusRequest?.lineId);
                      const availableYears = OTHER_TAX_YEARS.filter(year => !headLines.some(line => line.assessmentYear === year));
                      return <li key={head.id} data-head-row={head.id} data-invalid={invalid ? 'true' : undefined}
                        data-highlighted={focused ? 'true' : undefined}
                        className={invalid ? 'other-tax-row--invalid' : focused ? 'other-tax-row--focused' : 'bg-white'}>
                        <label className={`flex gap-3 items-start px-3 py-3 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#2c5ead]"
                            checked={headLines.length > 0} disabled={blocked}
                            data-testid={head.id === RETURN_HEAD_ID && allowMixedReturn ? 'unified-v5-return-checkbox' : undefined}
                            onChange={event => toggleHead(head.id, event.target.checked)}
                            aria-label={tx('Select', 'নির্বাচন করুন') + ' ' + head.codeEn + ' — ' + head.en} />
                          <span className="min-w-0 text-sm">
                            <span className="block text-taxpay-dark">
                              <strong className="font-mono-plex">{head.codeEn}</strong> — {bn ? head.bn || head.en : head.en}
                            </span>
                            {head.bn && <span lang={bn ? 'en' : 'bn'} className="block text-xs text-slate-600 mt-1">
                              {bn ? head.en : head.bn}
                            </span>}
                            {allowMixedReturn && head.id === RETURN_HEAD_ID && <span className="block text-xs text-slate-600 mt-1">
                              {tx('Section 173 · Can be combined with other tax heads', 'ধারা ১৭৩ · অন্যান্য কর খাতের সঙ্গে পরিশোধ করা যায়')}
                            </span>}
                            {blocked && <span className="block text-base text-rose-700 mt-1">
                              {head.id === 5 ? tx('Historical section 19AAAAA was omitted in 2022; not available for new payments.', 'ঐতিহাসিক ধারা ১৯এএএএএ ২০২২ সালে বিলুপ্ত হয়েছে; নতুন পরিশোধের জন্য প্রযোজ্য নয়।') : tx('Unavailable pending verification', 'যাচাই না হওয়া পর্যন্ত নির্বাচন করা যাবে না')}
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
                                onFocus={() => onFocusLine?.(line.id)}
                                onChange={event => edit(line.id, { assessmentYear: event.target.value })}
                                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                                <option value="" disabled>{tx('Select assessment year','করবর্ষ নির্বাচন করুন')}</option>
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
                                data-testid={head.id === RETURN_HEAD_ID && allowMixedReturn ? 'unified-v5-return-amount' : undefined}
                                onFocus={() => onFocusLine?.(line.id)}
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
                              onClick={() => applyLines(lines.filter(item => item.id !== line.id))}
                              aria-label={tx('Remove assessment year', 'করবর্ষ মুছুন') + ': ' + line.assessmentYear}
                              title={tx('Remove assessment year', 'করবর্ষ মুছুন')}>
                              <Trash2 size={18} aria-hidden="true" />
                            </button>}
                            </div>
                          </div>;
                        })}
                        {head.id !== RETURN_HEAD_ID && headLines.length > 0 && availableYears.length > 0 &&
                          <button type="button" className="other-tax-add-year" onClick={() => addYear(head.id)}>
                            <Plus size={16} aria-hidden="true" /> {tx('Add another assessment year', 'আরেকটি করবর্ষ যোগ করুন')}
                          </button>}
                      </li>;
                    })}
                  </ul>
                </details>;
              })}
              {!selectableGroups.some(group => group.rows.some(head => !search ||
                [head.codeEn, head.en, head.bn || '', head.grpEn, head.grpBn].join(' ').toLocaleLowerCase().includes(search))) &&
                <p className="p-4 text-sm text-slate-600">{tx('No matching payment head', 'কোনো খাত পাওয়া যায়নি')}</p>}
              </div>
            </div>
            {error && usedTotal === null && invalidLines.length === 0 && <p className="payment-form-field-error">{tx('Combined amount exceeds the supported limit. Reduce the amounts.', 'মোট পরিমাণ সীমার বেশি। পরিমাণ কমান।')}</p>}

          </div>
        </section>
        {remarks}
      </div>
      {summary}
    </div>
  );
}
